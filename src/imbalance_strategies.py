"""Imbalance handling strategies: compare class weighting, SMOTE, SMOTE-ENN, undersampling."""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any

import numpy as np
from imblearn.combine import SMOTEENN
from imblearn.over_sampling import SMOTE
from imblearn.under_sampling import RandomUnderSampler

from src.utils import load_config

logger = logging.getLogger(__name__)


class ImbalanceStrategy(str, Enum):
    """Supported resampling / weighting strategies."""

    CLASS_WEIGHT = "class_weight"
    SMOTE = "smote"
    SMOTE_ENN = "smote_enn"
    UNDERSAMPLE = "undersample"


def apply_resampling(
    X: np.ndarray,
    y: np.ndarray,
    strategy: str | ImbalanceStrategy,
    config: dict[str, Any] | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Apply a resampling strategy to training data.

    Note: ``class_weight`` does not alter X/y — handled at model fit time.

    Args:
        X: Training feature matrix.
        y: Training labels.
        strategy: Strategy name from config.
        config: Optional config dict.

    Returns:
        Resampled (X, y). Unchanged for ``class_weight``.
    """
    config = config or load_config()
    imb_cfg = config["imbalance"]
    strategy = ImbalanceStrategy(strategy)
    random_state = config["project"]["random_state"]

    before_rate = y.mean()
    logger.info("Applying imbalance strategy: %s (pre-resample fraud_rate=%.6f)", strategy.value, before_rate)

    if strategy == ImbalanceStrategy.CLASS_WEIGHT:
        return X, y

    if strategy == ImbalanceStrategy.SMOTE:
        k = min(imb_cfg.get("smote_k_neighbors", 5), int(y.sum()) - 1)
        if k < 1:
            logger.warning("Insufficient fraud samples for SMOTE — returning original data.")
            return X, y
        sampler = SMOTE(random_state=random_state, k_neighbors=k)
        X_res, y_res = sampler.fit_resample(X, y)

    elif strategy == ImbalanceStrategy.SMOTE_ENN:
        k = min(imb_cfg.get("smote_k_neighbors", 5), int(y.sum()) - 1)
        if k < 1:
            logger.warning("Insufficient fraud samples for SMOTE-ENN — returning original data.")
            return X, y
        sampler = SMOTEENN(random_state=random_state, smote=SMOTE(k_neighbors=k))
        X_res, y_res = sampler.fit_resample(X, y)

    elif strategy == ImbalanceStrategy.UNDERSAMPLE:
        ratio = imb_cfg.get("undersample_ratio", 0.1)
        sampler = RandomUnderSampler(
            sampling_strategy=ratio,
            random_state=random_state,
        )
        X_res, y_res = sampler.fit_resample(X, y)
    else:
        raise ValueError(f"Unknown strategy: {strategy}")

    after_rate = y_res.mean()
    logger.info(
        "Resampling complete: %s -> %s rows, fraud_rate=%.6f",
        f"{len(y):,}",
        f"{len(y_res):,}",
        after_rate,
    )
    return X_res, y_res


def get_sklearn_class_weight(y: np.ndarray) -> dict[int, float]:
    """Compute balanced class weights for sklearn models."""
    n_samples = len(y)
    n_classes = np.bincount(y)
    weights = n_samples / (len(n_classes) * n_classes)
    return {i: w for i, w in enumerate(weights)}
