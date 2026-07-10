"""Unit tests for feature engineering logic."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.feature_engineering import (
    compute_account_flags,
    compute_balance_deltas,
    compute_ratio_features,
    encode_transaction_types,
    engineer_features,
    get_feature_columns,
)


@pytest.fixture
def sample_transactions() -> pd.DataFrame:
    """Minimal PaySim-like fixture."""
    return pd.DataFrame(
        {
            "step": [1, 2, 3],
            "type": ["TRANSFER", "PAYMENT", "CASH_OUT"],
            "amount": [100.0, 50.0, 200.0],
            "nameOrig": ["C1", "C2", "C3"],
            "oldbalanceOrg": [500.0, 1000.0, 200.0],
            "newbalanceOrig": [500.0, 950.0, 0.0],  # row 0: balance error (fraud signal)
            "nameDest": ["M1", "M2", "M3"],
            "oldbalanceDest": [0.0, 100.0, 50.0],
            "newbalanceDest": [200.0, 150.0, 250.0],
            "isFraud": [1, 0, 0],
            "isFlaggedFraud": [0, 0, 0],
        }
    )


def test_balance_delta_detects_orig_error(sample_transactions: pd.DataFrame) -> None:
    """Origin balance error should exceed tolerance on inconsistent row."""
    result = compute_balance_deltas(sample_transactions, tolerance=0.01)
    assert result.loc[0, "hasBalanceErrorOrig"] == 1
    assert result.loc[1, "hasBalanceErrorOrig"] == 0


def test_ratio_features_full_drain_flag(sample_transactions: pd.DataFrame) -> None:
    """Full balance drain flag fires when amount >= 99% of old balance."""
    result = compute_ratio_features(sample_transactions, ratio_cap=10.0)
    assert result.loc[2, "drainsFullBalance"] == 1
    assert result.loc[0, "drainsFullBalance"] == 0


def test_new_dest_account_flag(sample_transactions: pd.DataFrame) -> None:
    """Zero pre-transaction destination balance marks new account."""
    result = compute_account_flags(sample_transactions)
    assert result.loc[0, "isNewDestAccount"] == 1
    assert result.loc[1, "isNewDestAccount"] == 0


def test_filter_non_fraud_eligible_types(sample_transactions: pd.DataFrame) -> None:
    """PAYMENT rows are removed when drop_ineligible=True."""
    result = encode_transaction_types(sample_transactions, drop_ineligible=True)
    assert "PAYMENT" not in result["type"].values
    assert len(result) == 2


def test_engineer_features_produces_type_dummies(sample_transactions: pd.DataFrame) -> None:
    """Pipeline adds one-hot type columns."""
    config = {
        "feature_engineering": {"balance_tolerance": 0.01, "ratio_cap": 10.0},
        "data": {"non_fraud_eligible_types": ["PAYMENT", "CASH_IN"]},
    }
    result = engineer_features(sample_transactions, config)
    type_cols = [c for c in result.columns if c.startswith("type_")]
    assert len(type_cols) >= 1


def test_get_feature_columns_excludes_identifiers(sample_transactions: pd.DataFrame) -> None:
    """Feature column list excludes IDs and target."""
    config = {
        "feature_engineering": {"balance_tolerance": 0.01, "ratio_cap": 10.0},
        "data": {"non_fraud_eligible_types": ["PAYMENT", "CASH_IN"]},
    }
    featured = engineer_features(sample_transactions, config)
    cols = get_feature_columns(featured)
    assert "nameOrig" not in cols
    assert "isFraud" not in cols
    assert "step" in cols
