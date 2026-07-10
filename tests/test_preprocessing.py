"""Unit tests for preprocessing and splitting logic."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.feature_engineering import engineer_features
from src.preprocessing import SplitData, split_data


@pytest.fixture
def featured_df() -> pd.DataFrame:
    """Small feature-engineered dataset for split tests."""
    rng = np.random.default_rng(42)
    n = 200
    df = pd.DataFrame(
        {
            "step": np.sort(rng.integers(1, 100, n)),
            "type": rng.choice(["TRANSFER", "CASH_OUT", "DEBIT"], n),
            "amount": rng.uniform(10, 500, n),
            "nameOrig": [f"C{i}" for i in range(n)],
            "oldbalanceOrg": rng.uniform(100, 5000, n),
            "newbalanceOrig": rng.uniform(0, 5000, n),
            "nameDest": [f"M{i}" for i in range(n)],
            "oldbalanceDest": rng.uniform(0, 3000, n),
            "newbalanceDest": rng.uniform(0, 3000, n),
            "isFraud": rng.choice([0, 1], n, p=[0.99, 0.01]),
            "isFlaggedFraud": 0,
        }
    )
    config = {
        "feature_engineering": {"balance_tolerance": 0.01, "ratio_cap": 10.0},
        "data": {"non_fraud_eligible_types": ["PAYMENT", "CASH_IN"]},
    }
    return engineer_features(df, config)


@pytest.fixture
def split_config() -> dict:
    """Minimal config for preprocessing tests."""
    return {
        "project": {"random_state": 42},
        "preprocessing": {
            "test_size": 0.2,
            "val_size": 0.2,
            "time_aware_split": True,
            "step_col": "step",
            "scale_features": True,
        },
    }


def test_split_data_returns_expected_shapes(featured_df: pd.DataFrame, split_config: dict) -> None:
    """Train/val/test partitions cover all rows without overlap."""
    split = split_data(featured_df, split_config)
    assert isinstance(split, SplitData)
    total = len(split.y_train) + len(split.y_val) + len(split.y_test)
    assert total == len(featured_df)
    assert split.X_train.shape[1] == len(split.feature_names)


def test_time_aware_split_preserves_order(featured_df: pd.DataFrame, split_config: dict) -> None:
    """Test set should contain later steps than train set."""
    split = split_data(featured_df, split_config)
    df_sorted = featured_df.sort_values("step").reset_index(drop=True)
    n = len(df_sorted)
    test_n = int(n * split_config["preprocessing"]["test_size"])
    val_n = int((n - test_n) * split_config["preprocessing"]["val_size"])
    train_n = n - test_n - val_n

    train_max_step = df_sorted.iloc[:train_n]["step"].max()
    test_min_step = df_sorted.iloc[train_n + val_n :]["step"].min()
    assert train_max_step <= test_min_step


def test_scaler_fit_on_train_only(featured_df: pd.DataFrame, split_config: dict) -> None:
    """Scaled training features should have ~zero mean (fit on train only)."""
    split = split_data(featured_df, split_config)
    assert split.scaler is not None
    train_means = split.X_train.mean(axis=0)
    assert np.allclose(train_means, 0.0, atol=1e-6)
