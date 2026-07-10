"""Data loading with optional stratified sampling for PaySim transactions."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from src.utils import load_config, resolve_path, set_seed, setup_logging, timer

logger = logging.getLogger(__name__)

PAYSIM_COLUMNS = [
    "step",
    "type",
    "amount",
    "nameOrig",
    "oldbalanceOrg",
    "newbalanceOrig",
    "nameDest",
    "oldbalanceDest",
    "newbalanceDest",
    "isFraud",
    "isFlaggedFraud",
]


def _raw_data_path(config: dict[str, Any]) -> Path:
    """Build absolute path to raw CSV."""
    paths = config["paths"]
    return resolve_path(str(Path(paths["raw_dir"]) / paths["raw_filename"]))


def generate_synthetic_paysim(n_rows: int = 10_000, random_state: int = 42) -> pd.DataFrame:
    """Generate a PaySim-like synthetic dataset for pipeline validation.

    Used only when the Kaggle CSV is not yet available. Distribution is
    approximate — not intended for final model reporting.

    Args:
        n_rows: Number of rows to generate.
        random_state: RNG seed for reproducibility.

    Returns:
        DataFrame matching PaySim schema.
    """
    rng = np.random.default_rng(random_state)
    types = np.array(["PAYMENT", "TRANSFER", "CASH_OUT", "DEBIT", "CASH_IN"])
    type_probs = np.array([0.55, 0.10, 0.20, 0.10, 0.05])

    steps = rng.integers(1, 744, size=n_rows)
    tx_type = rng.choice(types, size=n_rows, p=type_probs)
    amounts = rng.lognormal(mean=7.0, sigma=1.5, size=n_rows).round(2)

    oldbalance_org = rng.lognormal(mean=8.0, sigma=2.0, size=n_rows).round(2)
    oldbalance_dest = rng.lognormal(mean=7.5, sigma=2.0, size=n_rows).round(2)

    # Base fraud rate ~0.1% on fraud-eligible types
    is_fraud = np.zeros(n_rows, dtype=int)
    eligible_mask = np.isin(tx_type, ["TRANSFER", "CASH_OUT", "DEBIT"])
    eligible_idx = np.where(eligible_mask)[0]
    n_fraud = max(1, int(len(eligible_idx) * 0.002))
    fraud_idx = rng.choice(eligible_idx, size=n_fraud, replace=False)
    is_fraud[fraud_idx] = 1

    # Fraudulent rows: inject balance inconsistencies (PaySim fraud signal)
    newbalance_orig = oldbalance_org - amounts
    newbalance_dest = oldbalance_dest + amounts
    for idx in fraud_idx:
        # Simulate balance drain / mismatch patterns seen in real PaySim fraud
        newbalance_orig[idx] = oldbalance_org[idx]  # no debit applied
        newbalance_dest[idx] = oldbalance_dest[idx] + amounts[idx] * rng.uniform(1.5, 3.0)

    # Non-fraud: enforce accounting consistency
    non_fraud_idx = np.where(is_fraud == 0)[0]
    for idx in non_fraud_idx:
        if tx_type[idx] in ("TRANSFER", "CASH_OUT", "DEBIT"):
            newbalance_orig[idx] = max(0.0, oldbalance_org[idx] - amounts[idx])
            newbalance_dest[idx] = oldbalance_dest[idx] + amounts[idx]
        elif tx_type[idx] == "CASH_IN":
            newbalance_orig[idx] = oldbalance_org[idx] + amounts[idx]
            newbalance_dest[idx] = max(0.0, oldbalance_dest[idx] - amounts[idx])
        else:
            newbalance_orig[idx] = oldbalance_org[idx]
            newbalance_dest[idx] = oldbalance_dest[idx]

    df = pd.DataFrame(
        {
            "step": steps,
            "type": tx_type,
            "amount": amounts,
            "nameOrig": [f"C{i:08d}" for i in rng.integers(1, 5000, n_rows)],
            "oldbalanceOrg": oldbalance_org,
            "newbalanceOrig": newbalance_orig,
            "nameDest": [f"M{i:08d}" for i in rng.integers(1, 5000, n_rows)],
            "oldbalanceDest": oldbalance_dest,
            "newbalanceDest": newbalance_dest,
            "isFraud": is_fraud,
            "isFlaggedFraud": 0,
        }
    )
    return df


def _log_dataset_stats(df: pd.DataFrame, label: str) -> None:
    """Log row count and fraud rate."""
    n_rows = len(df)
    fraud_rate = df["isFraud"].mean() if n_rows else 0.0
    logger.info(
        "%s: rows=%s, fraud_count=%s, fraud_rate=%.6f (%.4f%%)",
        label,
        f"{n_rows:,}",
        f"{df['isFraud'].sum():,}",
        fraud_rate,
        fraud_rate * 100,
    )


@timer
def load_raw_data(config: dict[str, Any] | None = None) -> pd.DataFrame:
    """Load PaySim CSV from ``data/raw/``.

    If the file is missing, generates a small synthetic dataset and logs a warning.

    Args:
        config: Optional config dict. Loaded from disk when omitted.

    Returns:
        Raw transaction DataFrame.
    """
    config = config or load_config()
    path = _raw_data_path(config)

    if not path.exists():
        logger.warning(
            "Raw file not found at %s — generating synthetic PaySim sample for pipeline validation.",
            path,
        )
        seed = config["project"]["random_state"]
        df = generate_synthetic_paysim(n_rows=50_000, random_state=seed)
        _log_dataset_stats(df, "Synthetic raw data")
        return df

    logger.info("Loading raw data from %s", path)
    df = pd.read_csv(path)
    _log_dataset_stats(df, "Full raw data")
    return df


@timer
def apply_stratified_sample(
    df: pd.DataFrame,
    sample_size: int,
    random_state: int,
    stratify_col: str = "isFraud",
) -> pd.DataFrame:
    """Draw a stratified random sample preserving fraud rate.

    Args:
        df: Input DataFrame.
        sample_size: Target number of rows (capped at len(df)).
        random_state: RNG seed.
        stratify_col: Column used for stratification.

    Returns:
        Sampled DataFrame.
    """
    n_rows = len(df)
    if sample_size >= n_rows:
        logger.info("Sample size %s >= dataset size %s — using full data.", sample_size, n_rows)
        return df.copy()

    fraud_count = df[stratify_col].sum()
    if fraud_count < 2:
        logger.warning("Too few fraud rows for stratified split — using random sample.")
        return df.sample(n=sample_size, random_state=random_state).reset_index(drop=True)

    sample, _ = train_test_split(
        df,
        train_size=sample_size,
        stratify=df[stratify_col],
        random_state=random_state,
    )
    sample = sample.reset_index(drop=True)
    _log_dataset_stats(sample, f"Stratified sample (n={sample_size:,})")
    return sample


@timer
def load_data(config: dict[str, Any] | None = None) -> pd.DataFrame:
    """Load data with optional stratified sampling per config.

    Args:
        config: Optional config dict.

    Returns:
        Loaded (and optionally sampled) DataFrame.
    """
    config = config or load_config()
    set_seed(config["project"]["random_state"])

    df = load_raw_data(config)
    data_cfg = config["data"]

    if data_cfg.get("use_sample", False):
        df = apply_stratified_sample(
            df,
            sample_size=data_cfg["sample_size"],
            random_state=data_cfg["sample_random_state"],
            stratify_col=data_cfg["stratify_col"],
        )
    else:
        logger.info("use_sample=false — using full dataset for final reporting.")

    return df


def save_processed(df: pd.DataFrame, filename: str, config: dict[str, Any] | None = None) -> Path:
    """Persist a processed DataFrame to ``data/processed/``."""
    config = config or load_config()
    out_dir = resolve_path(config["paths"]["processed_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / filename
    df.to_parquet(out_path, index=False)
    logger.info("Saved processed data to %s (%s rows)", out_path, f"{len(df):,}")
    return out_path


def main() -> None:
    """CLI entry point: load data and print summary statistics."""
    setup_logging()
    parser = argparse.ArgumentParser(description="Load PaySim data with optional stratified sampling.")
    parser.add_argument("--full", action="store_true", help="Load full dataset (ignore use_sample config).")
    args = parser.parse_args()

    config = load_config()
    if args.full:
        config["data"]["use_sample"] = False

    df = load_data(config)
    logger.info("Columns: %s", list(df.columns))
    logger.info("Transaction types:\n%s", df["type"].value_counts())
    logger.info("Fraud rate by type:\n%s", df.groupby("type")["isFraud"].mean())


if __name__ == "__main__":
    main()
