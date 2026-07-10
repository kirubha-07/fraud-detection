"""SHAP-based model explainability for fraud scoring."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
import shap

from src.utils import load_config, timer

logger = logging.getLogger(__name__)


@timer
def compute_shap_values(
    model: Any,
    X: np.ndarray,
    feature_names: list[str],
    config: dict[str, Any] | None = None,
) -> tuple[np.ndarray, pd.DataFrame]:
    """Compute SHAP values for tree-based or linear models.

    Args:
        model: Fitted sklearn-compatible model with ``predict_proba``.
        X: Feature matrix for explanation (typically a sample).
        feature_names: Column names aligned with X.
        config: Optional config dict.

    Returns:
        Tuple of (shap_values array, summary DataFrame).
    """
    config = config or load_config()
    exp_cfg = config.get("explainability", {})
    sample_size = min(exp_cfg.get("shap_sample_size", 500), len(X))
    rng = np.random.default_rng(config["project"]["random_state"])
    sample_idx = rng.choice(len(X), size=sample_size, replace=False)
    X_sample = X[sample_idx]

    logger.info("Computing SHAP values on %s samples", f"{sample_size:,}")

    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_sample)
    except Exception:
        logger.info("TreeExplainer failed — falling back to KernelExplainer (slower).")
        background = shap.sample(X, min(100, len(X)))
        explainer = shap.KernelExplainer(model.predict_proba, background)
        shap_values = explainer.shap_values(X_sample)

    # Binary classification: use positive class SHAP values
    if isinstance(shap_values, list):
        shap_values = shap_values[1]

    mean_abs = np.abs(shap_values).mean(axis=0)
    summary_df = (
        pd.DataFrame({"feature": feature_names, "mean_abs_shap": mean_abs})
        .sort_values("mean_abs_shap", ascending=False)
        .reset_index(drop=True)
    )
    return shap_values, summary_df


def explain_instance(
    shap_values: np.ndarray,
    feature_names: list[str],
    instance_idx: int,
    X_sample: np.ndarray,
) -> pd.DataFrame:
    """Build local explanation for a single transaction.

    Args:
        shap_values: SHAP value matrix.
        feature_names: Feature names.
        instance_idx: Row index within the SHAP sample.
        X_sample: Feature matrix used for SHAP.

    Returns:
        DataFrame with feature, value, and SHAP contribution sorted by impact.
    """
    contributions = shap_values[instance_idx]
    return (
        pd.DataFrame(
            {
                "feature": feature_names,
                "value": X_sample[instance_idx],
                "shap_value": contributions,
            }
        )
        .assign(abs_shap=lambda d: d["shap_value"].abs())
        .sort_values("abs_shap", ascending=False)
        .drop(columns="abs_shap")
        .reset_index(drop=True)
    )
