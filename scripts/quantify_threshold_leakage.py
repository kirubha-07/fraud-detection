# Supports: README.md — Evaluation section ("Threshold selection is cost-based") and
# Key Insights #5 (cost-based threshold is essential; default 0.5 is the wrong operating point).
# Run: python scripts/quantify_threshold_leakage.py  →  outputs/metrics/threshold_leakage_quantification.json
"""Quantify the impact of threshold leakage on test set metrics.

This script compares the cost difference between:
1. Test-tuned threshold (leaky - old behavior)
2. Validation-tuned threshold (correct - new behavior)

Both are evaluated on the same test set to show the leakage impact.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd

from src.data_loader import load_data, save_processed
from src.evaluate import find_cost_optimal_threshold
from src.feature_engineering import engineer_features
from src.preprocessing import split_data
from src.utils import load_config, resolve_path, setup_logging

logger = logging.getLogger(__name__)


def main() -> None:
    """Run threshold leakage quantification."""
    setup_logging()
    config = load_config()

    logger.info("Loading data for threshold leakage quantification...")
    featured = engineer_features(load_data(config), config)
    split = split_data(featured, config)

    # Load a trained model (XGBoost as it's the primary model)
    models_dir = resolve_path(config["paths"]["models_dir"])
    model_path = models_dir / "xgboost.joblib"

    if not model_path.exists():
        logger.error("XGBoost model not found. Run training first: python -m src.models.tree_ensemble")
        return

    import joblib
    model = joblib.load(model_path)
    logger.info("Loaded XGBoost model from %s", model_path)

    # Get probabilities on all splits
    y_train_prob = model.predict_proba(split.X_train)[:, 1]
    y_val_prob = model.predict_proba(split.X_val)[:, 1]
    y_test_prob = model.predict_proba(split.X_test)[:, 1]

    eval_cfg = config["evaluation"]
    cost_fp = eval_cfg["cost_false_positive"]
    cost_fn = eval_cfg["cost_false_negative"]

    # Compute thresholds on different splits
    threshold_test, cost_test_tuned = find_cost_optimal_threshold(
        split.y_test, y_test_prob, cost_fp, cost_fn
    )
    threshold_val, cost_val_tuned = find_cost_optimal_threshold(
        split.y_val, y_val_prob, cost_fp, cost_fn
    )

    logger.info("Test-tuned threshold: %.4f (cost on test: %.0f)", threshold_test, cost_test_tuned)
    logger.info("Val-tuned threshold: %.4f (cost on val: %.0f)", threshold_val, cost_val_tuned)

    # Evaluate both thresholds on the test set
    def compute_cost_on_test(threshold: float) -> float:
        y_pred = (y_test_prob >= threshold).astype(int)
        tn, fp, fn, tp = (
            (split.y_test == 0) & (y_pred == 0),
            (split.y_test == 0) & (y_pred == 1),
            (split.y_test == 1) & (y_pred == 0),
            (split.y_test == 1) & (y_pred == 1),
        )
        return int(fp.sum()) * cost_fp + int(fn.sum()) * cost_fn

    cost_with_test_threshold = compute_cost_on_test(threshold_test)
    cost_with_val_threshold = compute_cost_on_test(threshold_val)

    leakage_cost = cost_with_val_threshold - cost_with_test_threshold
    leakage_pct = (leakage_cost / cost_with_test_threshold * 100) if cost_with_test_threshold > 0 else 0

    results = {
        "model": "xgboost",
        "test_tuned_threshold": float(threshold_test),
        "val_tuned_threshold": float(threshold_val),
        "cost_test_tuned_on_test": float(cost_with_test_threshold),
        "cost_val_tuned_on_test": float(cost_with_val_threshold),
        "leakage_cost_difference": float(leakage_cost),
        "leakage_percentage": float(leakage_pct),
        "test_size": int(len(split.y_test)),
        "val_size": int(len(split.y_val)),
        "cost_false_positive": cost_fp,
        "cost_false_negative": cost_fn,
    }

    # Save results
    metrics_dir = resolve_path(config["paths"]["metrics_dir"])
    metrics_dir.mkdir(parents=True, exist_ok=True)
    output_path = metrics_dir / "threshold_leakage_quantification.json"

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    logger.info("Threshold leakage quantification saved to %s", output_path)
    logger.info("=" * 60)
    logger.info("THRESHOLD LEAKAGE IMPACT:")
    logger.info("  Test-tuned threshold: %.4f -> cost on test: $%.0f", threshold_test, cost_with_test_threshold)
    logger.info("  Val-tuned threshold:   %.4f -> cost on test: $%.0f", threshold_val, cost_with_val_threshold)
    logger.info("  Leakage cost difference: $%.0f (%.2f%%)", leakage_cost, leakage_pct)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
