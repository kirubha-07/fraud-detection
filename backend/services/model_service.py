"""backend/services/model_service.py

Loads all model artifacts and the featured-transaction dataset ONCE at
FastAPI startup (via lifespan). All routers import `state` from here.

Design principle: no I/O per request — everything is pre-loaded.
"""

from __future__ import annotations

import json
import sys
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.evaluate import compute_metrics_at_threshold
from src.feature_engineering import get_feature_columns
from src.preprocessing import SplitData, split_data
from src.utils import load_config

logger = logging.getLogger(__name__)

config = load_config()
MODELS_DIR   = PROJECT_ROOT / config["paths"]["models_dir"]
METRICS_DIR  = PROJECT_ROOT / config["paths"]["metrics_dir"]
PROCESSED_DIR = PROJECT_ROOT / config["paths"]["processed_dir"]

# ── Shared mutable state dict populated at startup ────────────────────────────
state: dict[str, Any] = {
    "bundles":    {},   # model_name -> {"model", "scaler", "feature_names", "threshold"}
    "metrics":    {},   # model_name -> dict from JSON
    "featured":   None, # pd.DataFrame — full featured dataset
    "split":      None, # SplitData
    "feature_cols": [], # list[str]
}


def _load_all_metrics() -> dict[str, dict]:
    """Read every *_metrics.json from outputs/metrics/."""
    all_m: dict[str, dict] = {}
    for p in sorted(METRICS_DIR.glob("*_metrics.json")):
        name = p.stem.replace("_metrics", "")
        try:
            with p.open(encoding="utf-8") as f:
                all_m[name] = json.load(f)
            logger.info("Loaded metrics for %s", name)
        except Exception as e:
            logger.warning("Could not load metrics for %s: %s", name, e)
    return all_m


def _load_model_bundle(name: str) -> dict | None:
    """Load a .joblib artifact; returns None if not found."""
    path = MODELS_DIR / f"{name}.joblib"
    if not path.exists():
        return None
    try:
        artifact = joblib.load(path)
        if isinstance(artifact, dict) and "model" in artifact:
            logger.info("Loaded bundle for %s", name)
            return artifact
        # Bare model — wrap it
        featured = state["featured"]
        sp = state["split"]
        return {
            "model": artifact,
            "scaler": sp.scaler if sp else None,
            "feature_names": state["feature_cols"],
            "threshold": config["dashboard"].get("default_threshold", 0.5),
        }
    except Exception as e:
        logger.warning("Could not load model %s: %s", name, e)
        return None


def startup() -> None:
    """Called from FastAPI lifespan — loads everything into `state`."""
    logger.info("Loading featured transactions…")
    parquet_path = PROCESSED_DIR / "featured_transactions.parquet"
    if not parquet_path.exists():
        raise RuntimeError(f"Featured parquet not found: {parquet_path}")

    featured = pd.read_parquet(parquet_path)
    state["featured"] = featured
    state["feature_cols"] = get_feature_columns(featured)
    logger.info("Loaded %d transactions, %d features", len(featured), len(state["feature_cols"]))

    logger.info("Building train/val/test split…")
    split = split_data(featured, config)
    state["split"] = split

    logger.info("Loading metrics JSONs…")
    state["metrics"] = _load_all_metrics()

    logger.info("Loading model bundles…")
    for name in sorted(state["metrics"].keys()):
        bundle = _load_model_bundle(name)
        if bundle:
            state["bundles"][name] = bundle

    logger.info(
        "Startup complete — models with scoring: %s | metrics-only: %s",
        sorted(state["bundles"].keys()),
        sorted(set(state["metrics"]) - set(state["bundles"])),
    )


def get_bundle(model_name: str) -> dict:
    """Return the model bundle or raise ValueError."""
    if model_name not in state["bundles"]:
        available = sorted(state["bundles"].keys())
        raise ValueError(f"Model '{model_name}' not available for scoring. Available: {available}")
    return state["bundles"][model_name]


def get_metrics(model_name: str) -> dict:
    """Return saved metrics dict or raise ValueError."""
    if model_name not in state["metrics"]:
        available = sorted(state["metrics"].keys())
        raise ValueError(f"No metrics found for '{model_name}'. Available: {available}")
    return state["metrics"][model_name]


def score_test_set(model_name: str, threshold: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Score X_test with the named model; returns (y_true, y_prob, y_pred)."""
    bundle = get_bundle(model_name)
    split: SplitData = state["split"]
    prob = bundle["model"].predict_proba(split.X_test)[:, 1]
    pred = (prob >= threshold).astype(int)
    return split.y_test, prob, pred
