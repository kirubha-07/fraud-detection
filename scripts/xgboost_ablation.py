# Supports: README.md — Key Insights #2 (balance-reconciliation features as core signal)
# and Key Insights #3 (near-perfect metrics explanation due to synthetic fraud mechanism).
# Run: python scripts/xgboost_ablation.py  →  outputs/metrics/xgboost_ablation_no_balance_features.json
"""XGBoost ablation study: measure impact of balance reconciliation features.

This script retrains XGBoost with the balance features removed to quantify
how much of the near-perfect performance comes from these engineered features.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd

from src.data_loader import load_data, save_processed
from src.evaluate import evaluate_model, find_cost_optimal_threshold, save_evaluation
from src.feature_engineering import engineer_features, get_feature_columns
from src.models.tree_ensemble import _build_xgb_classifier, _scale_pos_weight, _xgb_base_params
from src.preprocessing import split_data
from src.utils import load_config, resolve_path, set_seed, setup_logging, timer

logger = logging.getLogger(__name__)

# Balance reconciliation features to ablate
BALANCE_FEATURES = [
    "errorBalanceOrig",
    "errorBalanceDest",
    "hasBalanceErrorOrig",
    "hasBalanceErrorDest",
    "drainsFullBalance",
]


@timer
def train_xgboost_ablation(
    split,
    config: dict,
    drop_features: list[str],
) -> tuple:
    """Train XGBoost with specified features dropped."""
    # Get feature indices to keep
    feature_names = split.feature_names
    keep_mask = [name not in drop_features for name in feature_names]
    keep_indices = [i for i, keep in enumerate(keep_mask) if keep]
    kept_features = [feature_names[i] for i in keep_indices]
    
    logger.info(
        "Ablation: dropping %d features, keeping %d features",
        len(drop_features),
        len(kept_features),
    )
    logger.info("Dropped features: %s", drop_features)
    
    # Subset training data
    X_train_ablated = split.X_train[:, keep_indices]
    X_val_ablated = split.X_val[:, keep_indices]
    X_test_ablated = split.X_test[:, keep_indices]
    
    # Train XGBoost with default config params
    base_params = _xgb_base_params(config)
    scale_pos_weight = _scale_pos_weight(split.y_train)
    
    model = _build_xgb_classifier(
        base_params,
        scale_pos_weight=scale_pos_weight,
        random_state=config["project"]["random_state"],
    )
    
    logger.info("Training XGBoost with ablated features...")
    model.fit(X_train_ablated, split.y_train)
    
    # Compute threshold on validation set
    y_val_prob = model.predict_proba(X_val_ablated)[:, 1]
    eval_cfg = config["evaluation"]
    threshold, _ = find_cost_optimal_threshold(
        split.y_val,
        y_val_prob,
        eval_cfg["cost_false_positive"],
        eval_cfg["cost_false_negative"],
    )
    
    # Evaluate on test set
    y_test_prob = model.predict_proba(X_test_ablated)[:, 1]
    result = evaluate_model(
        "xgboost_ablation_no_balance_features",
        split.y_test,
        y_test_prob,
        threshold=threshold,
        config=config,
    )
    
    return model, result, kept_features


def main() -> None:
    """Run XGBoost ablation study."""
    setup_logging()
    config = load_config()
    set_seed(config["project"]["random_state"])

    logger.info("Loading data for XGBoost ablation study...")
    featured = engineer_features(load_data(config), config)
    split = split_data(featured, config)

    logger.info("Running ablation: dropping balance reconciliation features...")
    model, result, kept_features = train_xgboost_ablation(
        split, config, drop_features=BALANCE_FEATURES
    )

    # Load full model metrics for comparison
    metrics_dir = resolve_path(config["paths"]["metrics_dir"])
    full_metrics_path = metrics_dir / "xgboost_metrics.json"
    
    ablation_result = {
        "model_name": "xgboost_ablation_no_balance_features",
        "dropped_features": BALANCE_FEATURES,
        "kept_features": kept_features,
        "kept_feature_count": len(kept_features),
        "pr_auc": result.pr_auc,
        "precision": result.precision,
        "recall": result.recall,
        "f1": result.f1,
        "roc_auc": result.roc_auc,
        "threshold": result.threshold,
        "total_cost": result.total_cost,
        "confusion_matrix": result.confusion_matrix,
    }
    
    if full_metrics_path.exists():
        with full_metrics_path.open("r") as f:
            full_metrics = json.load(f)
        
        ablation_result["full_model_pr_auc"] = full_metrics["pr_auc"]
        ablation_result["pr_auc_drop"] = full_metrics["pr_auc"] - result.pr_auc
        ablation_result["pr_auc_drop_percentage"] = (
            (ablation_result["pr_auc_drop"] / full_metrics["pr_auc"] * 100)
            if full_metrics["pr_auc"] > 0
            else 0
        )
        
        logger.info("=" * 60)
        logger.info("ABLATION RESULTS:")
        logger.info("  Full model PR-AUC:  %.4f", full_metrics["pr_auc"])
        logger.info("  Ablated PR-AUC:     %.4f", result.pr_auc)
        logger.info("  PR-AUC drop:        %.4f (%.2f%%)", 
                    ablation_result["pr_auc_drop"], 
                    ablation_result["pr_auc_drop_percentage"])
        logger.info("=" * 60)
    else:
        logger.warning("Full model metrics not found for comparison")

    # Save ablation results
    output_path = metrics_dir / "xgboost_ablation_no_balance_features.json"
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(ablation_result, f, indent=2)

    logger.info("Ablation results saved to %s", output_path)


if __name__ == "__main__":
    main()
