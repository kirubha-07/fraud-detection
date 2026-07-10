"""Random Forest and XGBoost with hyperparameter search."""

from __future__ import annotations

import argparse
import logging
import time
from typing import Any

import joblib
import numpy as np
import optuna
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, cross_val_score
from xgboost import XGBClassifier

from src.data_loader import load_data
from src.data_loader import save_processed
from src.evaluate import evaluate_model, find_cost_optimal_threshold, save_evaluation
from src.feature_engineering import engineer_features
from src.imbalance_strategies import apply_resampling
from src.preprocessing import split_data
from src.utils import load_config, resolve_path, set_seed, setup_logging, timer

logger = logging.getLogger(__name__)


def _scale_pos_weight(y: np.ndarray) -> float:
    """Compute XGBoost scale_pos_weight from label distribution."""
    n_neg = (y == 0).sum()
    n_pos = (y == 1).sum()
    return float(n_neg / max(n_pos, 1))


def _xgb_base_params(config: dict[str, Any]) -> dict[str, Any]:
    """Build a stable XGBoost parameter set from config defaults."""
    xgb_cfg = config["models"]["xgboost"]
    return {
        "n_estimators": int(xgb_cfg.get("n_estimators", 300)),
        "max_depth": int(xgb_cfg.get("max_depth", 6)),
        "learning_rate": float(xgb_cfg.get("learning_rate", 0.05)),
        "subsample": float(xgb_cfg.get("subsample", 0.8)),
        "colsample_bytree": float(xgb_cfg.get("colsample_bytree", 0.8)),
        "min_child_weight": float(xgb_cfg.get("min_child_weight", 1.0)),
        "gamma": float(xgb_cfg.get("gamma", 0.0)),
        "reg_alpha": float(xgb_cfg.get("reg_alpha", 0.0)),
        "reg_lambda": float(xgb_cfg.get("reg_lambda", 1.0)),
    }


def _build_xgb_classifier(
    params: dict[str, Any],
    scale_pos_weight: float,
    random_state: int,
) -> XGBClassifier:
    """Create a configured XGBoost classifier."""
    return XGBClassifier(
        n_estimators=int(params["n_estimators"]),
        max_depth=int(params["max_depth"]),
        learning_rate=float(params["learning_rate"]),
        subsample=float(params["subsample"]),
        colsample_bytree=float(params["colsample_bytree"]),
        min_child_weight=float(params["min_child_weight"]),
        gamma=float(params["gamma"]),
        reg_alpha=float(params["reg_alpha"]),
        reg_lambda=float(params["reg_lambda"]),
        scale_pos_weight=float(scale_pos_weight),
        eval_metric="aucpr",
        random_state=random_state,
        n_jobs=-1,
        verbosity=0,
        tree_method="hist",
    )


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


@timer
def train_random_forest(
    split: Any,
    config: dict[str, Any],
) -> RandomForestClassifier:
    """Train Random Forest with randomized hyperparameter search."""
    rf_cfg = config["models"]["random_forest"]
    param_dist = {
        "n_estimators": [100, 200, 300],
        "max_depth": [8, 12, 16, None],
        "min_samples_leaf": [1, 3, 5, 10],
        "max_features": ["sqrt", "log2"],
    }
    base = RandomForestClassifier(
        class_weight=rf_cfg.get("class_weight", "balanced_subsample"),
        random_state=config["project"]["random_state"],
        n_jobs=-1,
    )
    cv = StratifiedKFold(
        n_splits=config["evaluation"]["cv_folds"],
        shuffle=True,
        random_state=config["project"]["random_state"],
    )
    search = RandomizedSearchCV(
        base,
        param_distributions=param_dist,
        n_iter=rf_cfg.get("n_iter_search", 20),
        scoring="average_precision",
        cv=cv,
        random_state=config["project"]["random_state"],
        n_jobs=-1,
        verbose=0,
    )
    search.fit(split.X_train, split.y_train)
    logger.info("Random Forest best params: %s", search.best_params_)
    logger.info("Random Forest best CV PR-AUC: %.4f", search.best_score_)
    return search.best_estimator_


@timer
def train_xgboost(
    split: Any,
    config: dict[str, Any],
    optuna_trials: int | None = None,
) -> XGBClassifier:
    """Train XGBoost with Optuna-driven hyperparameter search."""
    xgb_cfg = config["models"]["xgboost"]
    n_trials = int(optuna_trials or xgb_cfg.get("optuna_trials", 25))
    cv = StratifiedKFold(
        n_splits=config["evaluation"]["cv_folds"],
        shuffle=True,
        random_state=config["project"]["random_state"],
    )
    sampler = optuna.samplers.TPESampler(seed=config["project"]["random_state"])
    study = optuna.create_study(direction="maximize", sampler=sampler)
    scale_pos_weight = _scale_pos_weight(split.y_train)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 500, step=50),
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.15, log=True),
            "subsample": trial.suggest_float("subsample", 0.7, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.7, 1.0),
            "min_child_weight": trial.suggest_float("min_child_weight", 1.0, 10.0),
            "gamma": trial.suggest_float("gamma", 0.0, 5.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 20.0, log=True),
        }
        model = _build_xgb_classifier(
            params,
            scale_pos_weight=scale_pos_weight,
            random_state=config["project"]["random_state"],
        )
        scores = cross_val_score(
            model,
            split.X_train,
            split.y_train,
            cv=cv,
            scoring="average_precision",
            n_jobs=1,
        )
        trial.set_user_attr("cv_std", float(scores.std()))
        return float(scores.mean())

    logger.info("Running Optuna search for XGBoost (%s trials)", n_trials)
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best_params = study.best_params
    best_cv_std = float(study.best_trial.user_attrs.get("cv_std", 0.0))
    logger.info("XGBoost best params: %s", best_params)
    logger.info("XGBoost best CV PR-AUC: %.4f ± %.4f", study.best_value, best_cv_std)

    model = _build_xgb_classifier(
        best_params,
        scale_pos_weight=scale_pos_weight,
        random_state=config["project"]["random_state"],
    )
    model.fit(split.X_train, split.y_train)
    return model


@timer
def compare_imbalance_strategies(config: dict[str, Any] | None = None) -> pd.DataFrame:
    """Train XGBoost under each imbalance strategy and save a comparison table."""
    config = config or load_config()
    set_seed(config["project"]["random_state"])

    featured = _load_featured_data(config)
    split = split_data(featured, config)

    base_params = _xgb_base_params(config)
    strategies = ["class_weight", "smote", "smote_enn", "undersample"]
    rows: list[dict[str, Any]] = []

    for strategy in strategies:
        start_time = time.perf_counter()
        X_train, y_train = split.X_train, split.y_train
        scale_pos_weight = _scale_pos_weight(y_train)

        if strategy != "class_weight":
            X_train, y_train = apply_resampling(X_train, y_train, strategy, config)
            scale_pos_weight = 1.0

        model = _build_xgb_classifier(
            base_params,
            scale_pos_weight=scale_pos_weight,
            random_state=config["project"]["random_state"],
        )
        model.fit(X_train, y_train)
        elapsed = time.perf_counter() - start_time

        y_prob = model.predict_proba(split.X_test)[:, 1]
        result = evaluate_model(f"xgboost_{strategy}", split.y_test, y_prob, config=config)
        rows.append(
            {
                "strategy": strategy,
                "pr_auc": result.pr_auc,
                "precision": result.precision,
                "recall": result.recall,
                "f1": result.f1,
                "training_time_seconds": elapsed,
                "threshold": result.threshold,
                "total_cost": result.total_cost,
            }
        )

    comparison = pd.DataFrame(rows).sort_values(
        ["pr_auc", "f1", "training_time_seconds"],
        ascending=[False, False, True],
    )

    metrics_dir = resolve_path(config["paths"]["metrics_dir"])
    metrics_dir.mkdir(parents=True, exist_ok=True)
    comparison.to_csv(metrics_dir / "xgboost_imbalance_comparison.csv", index=False)
    comparison.to_json(metrics_dir / "xgboost_imbalance_comparison.json", orient="records", indent=2)

    logger.info("Imbalance strategy comparison saved to %s", metrics_dir)
    logger.info("Best strategy: %s", comparison.iloc[0]["strategy"])
    return comparison


@timer
def train_tree_ensemble(
    config: dict[str, Any] | None = None,
    optuna_trials: int | None = None,
) -> dict[str, Any]:
    """Train RF and XGBoost, evaluate on test set, save models and metrics."""
    config = config or load_config()
    set_seed(config["project"]["random_state"])

    featured = _load_featured_data(config)
    split = split_data(featured, config)

    models_dir = resolve_path(config["paths"]["models_dir"])
    models_dir.mkdir(parents=True, exist_ok=True)

    results = {}
    for name, train_fn in [("random_forest", train_random_forest), ("xgboost", train_xgboost)]:
        if name == "xgboost":
            model = train_fn(split, config, optuna_trials=optuna_trials)
        else:
            model = train_fn(split, config)
        y_prob = model.predict_proba(split.X_test)[:, 1]
        result = evaluate_model(name, split.y_test, y_prob, config=config)
        save_evaluation(result, config)
        joblib.dump(model, models_dir / f"{name}.joblib")
        results[name] = {"model": model, "result": result}

    return results


def main() -> None:
    """CLI entry point."""
    setup_logging()
    parser = argparse.ArgumentParser(description="Train tree models or compare imbalance strategies.")
    parser.add_argument(
        "--compare-imbalance",
        action="store_true",
        help="Train XGBoost under class_weight, SMOTE, SMOTE-ENN, and undersampling.",
    )
    parser.add_argument(
        "--trials",
        type=int,
        default=None,
        help="Override the number of Optuna trials for XGBoost.",
    )
    args = parser.parse_args()

    if args.compare_imbalance:
        compare_imbalance_strategies()
    else:
        train_tree_ensemble(optuna_trials=args.trials)


if __name__ == "__main__":
    main()
