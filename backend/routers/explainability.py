"""backend/routers/explainability.py

GET /api/shap/global/{model}                       — global feature importance
GET /api/shap/local/{model}/{transaction_id}       — local explanation for one row
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from backend.schemas import ShapGlobalItem, ShapGlobalResponse, ShapLocalItem, ShapLocalResponse
from backend.services.model_service import state, get_bundle
from src.explainability import compute_shap_values, explain_instance
from src.feature_engineering import get_feature_columns
from src.utils import load_config

router = APIRouter()
config = load_config()


@router.get("/shap/global/{model}", response_model=ShapGlobalResponse)
def get_shap_global(
    model: str,
    sample_size: int = Query(200, ge=50, le=1000),
) -> ShapGlobalResponse:
    """Compute global SHAP feature importance on a sample of the test set."""
    try:
        bundle = get_bundle(model)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    split = state["split"]
    X_sample = split.X_test[: min(len(split.X_test), sample_size)]
    feature_names = bundle["feature_names"]

    try:
        _, summary_df = compute_shap_values(bundle["model"], X_sample, feature_names, config)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SHAP computation failed: {exc}")

    items = [
        ShapGlobalItem(
            feature=str(row["feature"]),
            mean_abs_shap=float(row["mean_abs_shap"]),
            rank=int(i + 1),
        )
        for i, (_, row) in enumerate(summary_df.iterrows())
    ]
    return ShapGlobalResponse(model=model, items=items)


@router.get("/shap/local/{model}/{transaction_id}", response_model=ShapLocalResponse)
def get_shap_local(
    model: str,
    transaction_id: int,
    sample_size: int = Query(200, ge=50, le=1000),
) -> ShapLocalResponse:
    """Compute local SHAP explanation for one transaction in the test set."""
    try:
        bundle = get_bundle(model)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    split = state["split"]
    featured: pd.DataFrame = state["featured"]

    # Reconstruct test frame (time-sorted tail)
    ordered = featured.sort_values("step").reset_index(drop=True)
    test_frame = ordered.iloc[-len(split.y_test):].reset_index(drop=True)

    if transaction_id < 0 or transaction_id >= len(test_frame):
        raise HTTPException(
            status_code=404,
            detail=f"transaction_id {transaction_id} out of range [0, {len(test_frame) - 1}]",
        )

    feature_names = bundle["feature_names"]
    row = test_frame.iloc[[transaction_id]]
    row_values = row[feature_names].values.astype(float)
    if bundle["scaler"] is not None:
        row_values = bundle["scaler"].transform(row_values)

    # Score this row
    prob = float(bundle["model"].predict_proba(row_values)[:, 1][0])

    # SHAP explanation
    import shap
    try:
        explainer = shap.TreeExplainer(bundle["model"])
        shap_vals = explainer.shap_values(row_values)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[1]  # positive class for binary classifiers
    except Exception:
        # Fallback: KernelExplainer on a small background
        X_bg = split.X_test[: min(100, len(split.X_test))]
        explainer = shap.KernelExplainer(bundle["model"].predict_proba, X_bg)
        shap_vals = explainer.shap_values(row_values)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[1]

    local_df = explain_instance(shap_vals, feature_names, 0, row_values)
    max_feat = int(config.get("explainability", {}).get("max_display_features", 15))
    local_df = local_df.head(max_feat)

    # Base value (mean prediction)
    try:
        base_value = float(explainer.expected_value)
        if isinstance(base_value, (list, np.ndarray)):
            base_value = float(base_value[-1])
    except Exception:
        base_value = 0.5

    items = [
        ShapLocalItem(
            feature=str(r["feature"]),
            value=float(r["value"]),
            shap_value=float(r["shap_value"]),
        )
        for _, r in local_df.iterrows()
    ]
    return ShapLocalResponse(
        model=model,
        transaction_id=transaction_id,
        fraud_probability=prob,
        base_value=base_value,
        items=items,
    )
