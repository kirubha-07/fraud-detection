"""Unsupervised anomaly detection: Isolation Forest and AutoEncoder."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

from src.data_loader import load_data, save_processed
from src.evaluate import evaluate_model, find_cost_optimal_threshold, save_evaluation
from src.feature_engineering import engineer_features
from src.preprocessing import split_data
from src.utils import load_config, resolve_path, set_seed, setup_logging, timer

logger = logging.getLogger(__name__)


def _load_featured_data(config: dict[str, Any]) -> pd.DataFrame:
    """Load the cached engineered dataset when available, otherwise build it once."""
    processed_dir = resolve_path(config["paths"]["processed_dir"])
    processed_path = processed_dir / "featured_transactions.parquet"

    if processed_path.exists():
        logger.info("Loading featured data from %s", processed_path)
        return pd.read_parquet(processed_path)

    df = load_data(config)
    featured = engineer_features(df, config)
    save_processed(featured, processed_path.name, config)
    return featured


def _scores_to_probabilities(scores: np.ndarray) -> np.ndarray:
    """Map anomaly scores to [0, 1] fraud probabilities via min-max scaling."""
    scaler = MinMaxScaler()
    # Isolation Forest: lower score = more anomalous — invert
    inverted = -scores.reshape(-1, 1)
    return scaler.fit_transform(inverted).ravel()


@timer
def train_isolation_forest(split: Any, config: dict[str, Any]) -> IsolationForest:
    """Train Isolation Forest on non-fraud training data only.

    Unsupervised baseline: learns normal transaction manifold, flags deviations.
    """
    if_cfg = config["models"]["isolation_forest"]
    X_normal = split.X_train[split.y_train == 0]

    model = IsolationForest(
        n_estimators=if_cfg["n_estimators"],
        contamination=if_cfg["contamination"],
        random_state=config["project"]["random_state"],
        n_jobs=-1,
    )
    model.fit(X_normal)
    logger.info("Isolation Forest trained on %s normal transactions", f"{len(X_normal):,}")
    return model


def _build_autoencoder(input_dim: int, encoding_dim: int, learning_rate: float):
    """Build a simple dense autoencoder for anomaly detection."""
    import tensorflow as tf

    inputs = tf.keras.Input(shape=(input_dim,))
    encoded = tf.keras.layers.Dense(encoding_dim, activation="relu")(inputs)
    encoded = tf.keras.layers.Dense(encoding_dim // 2, activation="relu")(encoded)
    decoded = tf.keras.layers.Dense(encoding_dim, activation="relu")(encoded)
    decoded = tf.keras.layers.Dense(input_dim, activation="linear")(decoded)

    autoencoder = tf.keras.Model(inputs, decoded)
    autoencoder.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate), loss="mse")
    return autoencoder


@timer
def train_autoencoder(split: Any, config: dict[str, Any]):
    """Train AutoEncoder on normal transactions; high reconstruction error = fraud."""
    ae_cfg = config["models"]["autoencoder"]
    X_normal = split.X_train[split.y_train == 0]

    model = _build_autoencoder(
        input_dim=split.X_train.shape[1],
        encoding_dim=ae_cfg["encoding_dim"],
        learning_rate=ae_cfg["learning_rate"],
    )
    model.fit(
        X_normal,
        X_normal,
        epochs=ae_cfg["epochs"],
        batch_size=ae_cfg["batch_size"],
        validation_split=0.1,
        verbose=0,
    )
    logger.info("AutoEncoder trained on %s normal transactions", f"{len(X_normal):,}")
    return model


@timer
def train_anomaly_models(config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Train and evaluate unsupervised anomaly detection models."""
    config = config or load_config()
    set_seed(config["project"]["random_state"])

    featured = _load_featured_data(config)
    split = split_data(featured, config)

    results = {}

    iso_model = train_isolation_forest(split, config)
    iso_scores = iso_model.decision_function(split.X_test)
    iso_prob = _scores_to_probabilities(iso_scores)
    
    # Compute cost-optimal threshold on validation set (not test set)
    iso_val_scores = iso_model.decision_function(split.X_val)
    iso_val_prob = _scores_to_probabilities(iso_val_scores)
    eval_cfg = config["evaluation"]
    threshold, _ = find_cost_optimal_threshold(
        split.y_val,
        iso_val_prob,
        eval_cfg["cost_false_positive"],
        eval_cfg["cost_false_negative"],
    )
    
    iso_result = evaluate_model("isolation_forest", split.y_test, iso_prob, threshold=threshold, config=config)
    save_evaluation(iso_result, config)
    
    # Save bundled model artifact
    models_dir = resolve_path(config["paths"]["models_dir"])
    models_dir.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": iso_model,
        "scaler": split.scaler,
        "feature_names": split.feature_names,
        "threshold": threshold,
    }
    joblib.dump(bundle, models_dir / "isolation_forest.joblib")
    logger.info("Saved bundled model artifact to %s", models_dir / "isolation_forest.joblib")
    
    results["isolation_forest"] = iso_result

    try:
        ae_model = train_autoencoder(split, config)
        reconstructions = ae_model.predict(split.X_test, verbose=0)
        mse = np.mean(np.square(split.X_test - reconstructions), axis=1)
        ae_prob = _scores_to_probabilities(mse)
        ae_result = evaluate_model("autoencoder", split.y_test, ae_prob, config=config)
        save_evaluation(ae_result, config)
        results["autoencoder"] = ae_result
    except ImportError:
        logger.warning("TensorFlow not available — skipping AutoEncoder.")

    return results


def main() -> None:
    """CLI entry point."""
    setup_logging()
    train_anomaly_models()


if __name__ == "__main__":
    main()
