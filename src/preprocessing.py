"""Preprocessing: encoding, scaling, and train/validation/test splitting."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from src.feature_engineering import get_feature_columns
from src.utils import load_config, timer

logger = logging.getLogger(__name__)


@dataclass
class SplitData:
    """Container for train/validation/test feature matrices and labels."""

    X_train: np.ndarray
    X_val: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_val: np.ndarray
    y_test: np.ndarray
    feature_names: list[str]
    scaler: StandardScaler | None = None


def _time_aware_split_indices(
    n_rows: int,
    test_size: float,
    val_size: float,
    step_values: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Split positional indices by temporal order.

    Rationale: PaySim ``step`` simulates hours. Random splits leak future fraud
    patterns into training — time-aware splits better mimic production deployment.

    Args:
        n_rows: Number of rows (assumed sorted by time).
        test_size: Fraction for test set.
        val_size: Fraction for validation set (from remaining train pool).
        step_values: Optional step column for logging temporal ranges.

    Returns:
        Tuple of (train_idx, val_idx, test_idx) positional integer arrays.
    """
    test_n = int(n_rows * test_size)
    val_n = int((n_rows - test_n) * val_size)
    train_n = n_rows - test_n - val_n

    train_idx = np.arange(0, train_n)
    val_idx = np.arange(train_n, train_n + val_n)
    test_idx = np.arange(train_n + val_n, n_rows)

    step_min = step_values[train_idx].min() if step_values is not None and len(train_idx) else "N/A"
    step_max = step_values[train_idx].max() if step_values is not None and len(train_idx) else "N/A"
    logger.info(
        "Time-aware split: train=%s, val=%s, test=%s (step range train=%s-%s)",
        f"{len(train_idx):,}",
        f"{len(val_idx):,}",
        f"{len(test_idx):,}",
        step_min,
        step_max,
    )
    return train_idx, val_idx, test_idx


@timer
def split_data(
    df: pd.DataFrame,
    config: dict[str, Any] | None = None,
) -> SplitData:
    """Split features and target into train/val/test sets.

    Args:
        df: Feature-engineered DataFrame.
        config: Optional config dict.

    Returns:
        ``SplitData`` with numpy arrays and feature names.
    """
    config = config or load_config()
    prep_cfg = config["preprocessing"]
    df_sorted = df.sort_values(prep_cfg.get("step_col", "step")).reset_index(drop=True)
    feature_cols = get_feature_columns(df_sorted)
    X = df_sorted[feature_cols].values.astype(np.float64)
    y = df_sorted["isFraud"].values.astype(np.int64)

    test_size = prep_cfg["test_size"]
    val_size = prep_cfg["val_size"]
    random_state = config["project"]["random_state"]

    if prep_cfg.get("time_aware_split", True) and prep_cfg.get("step_col", "step") in df_sorted.columns:
        step_col = prep_cfg.get("step_col", "step")
        train_idx, val_idx, test_idx = _time_aware_split_indices(
            len(df_sorted),
            test_size,
            val_size,
            step_values=df_sorted[step_col].values,
        )
        X_train, y_train = X[train_idx], y[train_idx]
        X_val, y_val = X[val_idx], y[val_idx]
        X_test, y_test = X[test_idx], y[test_idx]
    else:
        X_temp, X_test, y_temp, y_test = train_test_split(
            X, y, test_size=test_size, stratify=y, random_state=random_state
        )
        val_relative = val_size / (1 - test_size)
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp, test_size=val_relative, stratify=y_temp, random_state=random_state
        )

    scaler: StandardScaler | None = None
    if prep_cfg.get("scale_features", True):
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_val = scaler.transform(X_val)
        X_test = scaler.transform(X_test)
        logger.info("Applied StandardScaler fit on training set only.")

    for name, labels in [("train", y_train), ("val", y_val), ("test", y_test)]:
        rate = labels.mean() if len(labels) else 0.0
        logger.info("%s set: n=%s, fraud_rate=%.6f", name, f"{len(labels):,}", rate)

    return SplitData(
        X_train=X_train,
        X_val=X_val,
        X_test=X_test,
        y_train=y_train,
        y_val=y_val,
        y_test=y_test,
        feature_names=feature_cols,
        scaler=scaler,
    )
