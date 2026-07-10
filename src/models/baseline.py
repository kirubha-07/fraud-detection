"""Baseline logistic regression with class weighting."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score

from src.data_loader import load_data, save_processed
from src.evaluate import evaluate_model, save_evaluation
from src.feature_engineering import engineer_features
from src.imbalance_strategies import ImbalanceStrategy
from src.preprocessing import split_data
from src.utils import load_config, resolve_path, set_seed, setup_logging, timer

logger = logging.getLogger(__name__)


def _load_featured_data(config: dict) -> pd.DataFrame:
    """Load the cached engineered dataset when available, otherwise create it once."""
    processed_dir = resolve_path(config["paths"]["processed_dir"])
    processed_path = processed_dir / "featured_transactions.parquet"

    if processed_path.exists():
        logger.info("Loading featured data from %s", processed_path)
        return pd.read_parquet(processed_path)

    df = load_data(config)
    featured = engineer_features(df, config)
    save_processed(featured, processed_path.name, config)
    return featured


@timer
def train_baseline(config: dict | None = None):
    """Train and evaluate baseline logistic regression.

    Serves as the 'why we need better than this' anchor model.

    Returns:
        Tuple of (fitted model, EvaluationResult).
    """
    config = config or load_config()
    set_seed(config["project"]["random_state"])

    featured = _load_featured_data(config)
    split = split_data(featured, config)

    model_cfg = config["models"]["baseline"]
    model = LogisticRegression(
        max_iter=model_cfg["max_iter"],
        class_weight=model_cfg.get("class_weight", "balanced"),
        random_state=config["project"]["random_state"],
    )

    cv = StratifiedKFold(
        n_splits=config["evaluation"]["cv_folds"],
        shuffle=True,
        random_state=config["project"]["random_state"],
    )
    cv_scores = cross_val_score(
        model,
        split.X_train,
        split.y_train,
        cv=cv,
        scoring="average_precision",
        n_jobs=-1,
    )
    logger.info(
        "Baseline CV PR-AUC: %.4f ± %.4f",
        cv_scores.mean(),
        cv_scores.std(),
    )

    model.fit(split.X_train, split.y_train)
    y_prob = model.predict_proba(split.X_test)[:, 1]

    result = evaluate_model(
        model_name="logistic_regression",
        y_true=split.y_test,
        y_prob=y_prob,
        config=config,
        cv_pr_auc_mean=float(cv_scores.mean()),
        cv_pr_auc_std=float(cv_scores.std()),
    )
    save_evaluation(result, config)
    return model, result


def main() -> None:
    """CLI entry point."""
    setup_logging()
    train_baseline()


if __name__ == "__main__":
    main()
