"""Feature engineering for mobile money fraud detection."""

from __future__ import annotations

import argparse
import logging
from typing import Any

import numpy as np
import pandas as pd

from src.data_loader import load_data, save_processed
from src.utils import load_config, setup_logging, timer

logger = logging.getLogger(__name__)

# PaySim domain knowledge: PAYMENT and CASH_IN cannot be fraudulent in this dataset.
# Fraud only occurs via TRANSFER, CASH_OUT, and DEBIT (balance manipulation attacks).
NON_FRAUD_ELIGIBLE_TYPES_DEFAULT = ["PAYMENT", "CASH_IN"]


@timer
def compute_balance_deltas(df: pd.DataFrame, tolerance: float = 0.01) -> pd.DataFrame:
    """Compute balance reconciliation errors.

    Business rationale: PaySim fraud involves transactions where debits/credits
    do not reconcile with account balances. ``errorBalanceOrig`` captures
    whether the origin account balance change matches the transaction amount;
    ``errorBalanceDest`` does the same for the destination account.

    Args:
        df: Raw transaction DataFrame.
        tolerance: Absolute tolerance for floating-point comparison.

    Returns:
        DataFrame with ``errorBalanceOrig`` and ``errorBalanceDest`` columns.
    """
    out = df.copy()
    expected_orig = out["oldbalanceOrg"] - out["amount"]
    expected_dest = out["oldbalanceDest"] + out["amount"]

    out["errorBalanceOrig"] = (out["newbalanceOrig"] - expected_orig).abs()
    out["errorBalanceDest"] = (out["newbalanceDest"] - expected_dest).abs()
    out["hasBalanceErrorOrig"] = (out["errorBalanceOrig"] > tolerance).astype(int)
    out["hasBalanceErrorDest"] = (out["errorBalanceDest"] > tolerance).astype(int)
    return out


@timer
def compute_ratio_features(df: pd.DataFrame, ratio_cap: float = 10.0) -> pd.DataFrame:
    """Compute amount-to-balance ratio features.

    Business rationale: Draining an account's full balance (ratio ≈ 1) or
    transferring multiples of available balance (ratio > 1) is a common
    fraud pattern in mobile money account takeover scenarios.

    Args:
        df: Transaction DataFrame.
        ratio_cap: Cap extreme ratios to limit outlier influence.

    Returns:
        DataFrame with ratio and drain features.
    """
    out = df.copy()
    denom = out["oldbalanceOrg"].replace(0, np.nan)
    out["amountToOldBalanceRatio"] = (out["amount"] / denom).clip(upper=ratio_cap).fillna(0.0)
    out["drainsFullBalance"] = (
        (out["oldbalanceOrg"] > 0) & (out["amount"] >= out["oldbalanceOrg"] * 0.99)
    ).astype(int)
    out["logAmount"] = np.log1p(out["amount"])
    return out


@timer
def compute_account_flags(df: pd.DataFrame) -> pd.DataFrame:
    """Compute account-level binary flags.

    Business rationale: Fraudsters often route funds to newly created or
    dormant destination accounts (zero balance before transaction).

    Args:
        df: Transaction DataFrame.

    Returns:
        DataFrame with account flag columns.
    """
    out = df.copy()
    out["isNewDestAccount"] = (out["oldbalanceDest"] == 0).astype(int)
    out["isZeroOrigBalance"] = (out["oldbalanceOrg"] == 0).astype(int)
    out["balanceChangeOrig"] = out["newbalanceOrig"] - out["oldbalanceOrg"]
    out["balanceChangeDest"] = out["newbalanceDest"] - out["oldbalanceDest"]
    return out


@timer
def encode_transaction_types(
    df: pd.DataFrame,
    non_fraud_eligible_types: list[str] | None = None,
    drop_ineligible: bool = True,
) -> pd.DataFrame:
    """One-hot encode transaction types, optionally filtering ineligible types.

    Business rationale: PAYMENT and CASH_IN have zero historical fraud in PaySim.
    Including them dilutes the signal and wastes model capacity — filter before modeling.

    Args:
        df: Transaction DataFrame with ``type`` column.
        non_fraud_eligible_types: Types to exclude when ``drop_ineligible=True``.
        drop_ineligible: Whether to remove non-fraud-eligible transaction types.

    Returns:
        Encoded (and optionally filtered) DataFrame.
    """
    non_fraud_eligible_types = non_fraud_eligible_types or NON_FRAUD_ELIGIBLE_TYPES_DEFAULT
    out = df.copy()

    if drop_ineligible:
        before = len(out)
        out = out[~out["type"].isin(non_fraud_eligible_types)].copy()
        logger.info(
            "Filtered non-fraud-eligible types %s: %s -> %s rows (%.2f%% removed)",
            non_fraud_eligible_types,
            f"{before:,}",
            f"{len(out):,}",
            (before - len(out)) / before * 100 if before else 0,
        )

    type_dummies = pd.get_dummies(out["type"], prefix="type", dtype=int)
    out = pd.concat([out, type_dummies], axis=1)
    return out


@timer
def engineer_features(df: pd.DataFrame, config: dict[str, Any] | None = None) -> pd.DataFrame:
    """Run full feature engineering pipeline.

    Args:
        df: Raw or loaded transaction DataFrame.
        config: Optional config dict.

    Returns:
        Feature-enriched DataFrame ready for preprocessing.
    """
    config = config or load_config()
    fe_cfg = config.get("feature_engineering", {})
    data_cfg = config.get("data", {})

    out = compute_balance_deltas(df, tolerance=fe_cfg.get("balance_tolerance", 0.01))
    out = compute_ratio_features(out, ratio_cap=fe_cfg.get("ratio_cap", 10.0))
    out = compute_account_flags(out)
    out = encode_transaction_types(
        out,
        non_fraud_eligible_types=data_cfg.get("non_fraud_eligible_types"),
        drop_ineligible=True,
    )

    fraud_rate = out["isFraud"].mean()
    logger.info(
        "Feature engineering complete: %s rows, fraud_rate=%.6f",
        f"{len(out):,}",
        fraud_rate,
    )
    return out


def get_feature_columns(df: pd.DataFrame) -> list[str]:
    """Return model-ready numeric feature column names.

    Excludes identifiers, target, and PaySim's rule-based flag column.
    """
    exclude = {
        "nameOrig",
        "nameDest",
        "type",
        "isFraud",
        "isFlaggedFraud",
    }
    return [col for col in df.columns if col not in exclude and df[col].dtype != "object"]


def main() -> None:
    """CLI entry point: load data, engineer features, save to processed/."""
    setup_logging()
    config = load_config()
    df = load_data(config)
    featured = engineer_features(df, config)
    save_processed(featured, "featured_transactions.parquet", config)
    feature_cols = get_feature_columns(featured)
    logger.info("Engineered %d feature columns: %s", len(feature_cols), feature_cols[:10])


if __name__ == "__main__":
    main()
