"""backend/routers/scoring.py

GET /api/models             — list all models and their availability
GET /api/transactions       — ranked scored transactions (paginated)
GET /api/story-stats        — homepage summary numbers
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from backend.schemas import (
    ModelInfo,
    ModelsResponse,
    StoryStatsResponse,
    TransactionRecord,
    TransactionsResponse,
)
from backend.services.model_service import state, get_bundle
from src.utils import load_config

router = APIRouter()
config = load_config()


@router.get("/models", response_model=ModelsResponse)
def list_models() -> ModelsResponse:
    """Return all models — with/without scoring artifact."""
    all_names = sorted(set(state["bundles"]) | set(state["metrics"]))
    return ModelsResponse(models=[
        ModelInfo(
            name=n,
            has_artifact=n in state["bundles"],
            has_metrics=n in state["metrics"],
        )
        for n in all_names
    ])


@router.get("/transactions", response_model=TransactionsResponse)
def get_transactions(
    model: str = Query("xgboost"),
    threshold: float = Query(0.5, ge=0.0, le=1.0),
    sort: str = Query("risk", description="'risk' (desc) or 'step'"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
) -> TransactionsResponse:
    """Score the test set and return paginated transaction records."""
    try:
        bundle = get_bundle(model)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    split = state["split"]
    featured: pd.DataFrame = state["featured"]

    # Recover test slice (last len(y_test) rows, time-sorted)
    ordered = featured.sort_values("step").reset_index(drop=True)
    test_frame = ordered.iloc[-len(split.y_test):].reset_index(drop=True)

    # Score
    X = test_frame[bundle["feature_names"]].values.astype(float)
    if bundle["scaler"] is not None:
        X = bundle["scaler"].transform(X)
    probs = bundle["model"].predict_proba(X)[:, 1]

    test_frame = test_frame.copy()
    test_frame["fraud_probability"] = probs
    test_frame["flagged"] = probs >= threshold
    test_frame["risk_band"] = pd.cut(
        test_frame["fraud_probability"],
        bins=[-0.001, 0.25, 0.50, 0.75, 1.0],
        labels=["low", "moderate", "high", "critical"],
    ).astype(str)
    test_frame["is_fraud"] = split.y_test

    if sort == "risk":
        test_frame = test_frame.sort_values("fraud_probability", ascending=False)
    else:
        test_frame = test_frame.sort_values("step")

    test_frame = test_frame.reset_index(drop=True)
    total = len(test_frame)
    start = (page - 1) * page_size
    end = start + page_size
    page_df = test_frame.iloc[start:end]

    records: list[TransactionRecord] = []
    for idx, row in page_df.iterrows():
        records.append(TransactionRecord(
            transaction_id=int(idx),
            step=int(row.get("step", 0)),
            type=str(row.get("type", "UNKNOWN")),
            amount=float(row.get("amount", 0.0)),
            old_balance_orig=float(row.get("oldbalanceOrg", 0.0)),
            new_balance_orig=float(row.get("newbalanceOrig", 0.0)),
            fraud_probability=float(row["fraud_probability"]),
            flagged=bool(row["flagged"]),
            risk_band=str(row["risk_band"]),
            is_fraud=int(row.get("is_fraud", 0)) if "is_fraud" in row else None,
        ))

    return TransactionsResponse(
        model=model,
        threshold=threshold,
        page=page,
        page_size=page_size,
        total=total,
        records=records,
    )


@router.get("/story-stats", response_model=StoryStatsResponse)
def get_story_stats() -> StoryStatsResponse:
    """Homepage headline numbers — total transactions, best model, etc."""
    featured: pd.DataFrame = state["featured"]
    fraud_rate = float(featured["isFraud"].mean()) if "isFraud" in featured.columns else 0.0

    # Find best PR-AUC across all saved metrics
    best_pr   = 0.0
    best_name = "N/A"
    for name, m in state["metrics"].items():
        if m.get("pr_auc", 0.0) > best_pr:
            best_pr = m["pr_auc"]
            best_name = name

    eval_cfg = config["evaluation"]
    return StoryStatsResponse(
        total_transactions=len(featured),
        overall_fraud_rate=fraud_rate,
        models_compared=len(state["metrics"]),
        best_pr_auc=best_pr,
        best_model=best_name,
        cost_false_positive=float(eval_cfg["cost_false_positive"]),
        cost_false_negative=float(eval_cfg["cost_false_negative"]),
    )
