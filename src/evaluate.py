"""Model evaluation: PR-AUC primary, cost-based thresholds, confusion matrices."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)

from src.utils import load_config, resolve_path, timer

logger = logging.getLogger(__name__)


@dataclass
class EvaluationResult:
    """Container for model evaluation metrics."""

    model_name: str
    precision: float
    recall: float
    f1: float
    pr_auc: float
    roc_auc: float
    threshold: float
    total_cost: float
    confusion_matrix: list[list[int]]
    cv_pr_auc_mean: float | None = None
    cv_pr_auc_std: float | None = None


def compute_metrics_at_threshold(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float,
) -> dict[str, float]:
    """Compute classification metrics at a given decision threshold."""
    y_pred = (y_prob >= threshold).astype(int)
    return {
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "pr_auc": float(average_precision_score(y_true, y_prob)),
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
    }


@timer
def find_cost_optimal_threshold(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    cost_fp: float,
    cost_fn: float,
) -> tuple[float, float]:
    """Find threshold minimizing expected business cost.

    Cost model: each false negative (missed fraud) costs ``cost_fn``;
    each false positive (wrong decline) costs ``cost_fp``.

    Args:
        y_true: Ground truth labels.
        y_prob: Predicted fraud probabilities.
        cost_fp: Cost per false positive.
        cost_fn: Cost per false negative.

    Returns:
        Tuple of (optimal_threshold, minimum_total_cost).
    """
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_prob)
    unique_thresholds = np.unique(np.concatenate([thresholds, [0.0, 1.0]]))

    # Sort arrays to use vectorized cumsum/searchsorted
    sort_idx = np.argsort(y_prob)
    y_prob_sorted = y_prob[sort_idx]
    y_true_sorted = y_true[sort_idx]

    total_pos = int(y_true.sum())
    total_neg = len(y_true) - total_pos

    # For each threshold, find index of first probability >= threshold
    indices = np.searchsorted(y_prob_sorted, unique_thresholds)

    # Calculate actual positive/negative counts >= threshold
    cum_pos = np.cumsum(y_true_sorted)
    cum_pos_padded = np.concatenate([[0], cum_pos])
    pos_ge = total_pos - cum_pos_padded[indices]

    cum_neg = np.cumsum(1 - y_true_sorted)
    cum_neg_padded = np.concatenate([[0], cum_neg])
    neg_ge = total_neg - cum_neg_padded[indices]

    # Calculate costs for all thresholds
    # tp = pos_ge, fp = neg_ge, fn = total_pos - tp
    fns = total_pos - pos_ge
    costs = neg_ge * cost_fp + fns * cost_fn

    best_idx = np.argmin(costs)
    best_cost = float(costs[best_idx])
    best_threshold = float(unique_thresholds[best_idx])

    logger.info(
        "Cost-optimal threshold=%.4f (FP cost=%s, FN cost=%s, total_cost=%.0f)",
        best_threshold,
        cost_fp,
        cost_fn,
        best_cost,
    )
    return best_threshold, best_cost


@timer
def evaluate_model(
    model_name: str,
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float | None = None,
    config: dict[str, Any] | None = None,
    cv_pr_auc_mean: float | None = None,
    cv_pr_auc_std: float | None = None,
) -> EvaluationResult:
    """Full evaluation with cost-optimized threshold.

    Args:
        model_name: Identifier for logging and reporting.
        y_true: Ground truth labels.
        y_prob: Predicted probabilities (or anomaly scores scaled to [0,1]).
        threshold: Decision threshold. Computed from cost model if None.
        config: Optional config dict.
        cv_pr_auc_mean: Optional cross-validated PR-AUC mean.
        cv_pr_auc_std: Optional cross-validated PR-AUC std.

    Returns:
        ``EvaluationResult`` dataclass.
    """
    config = config or load_config()
    eval_cfg = config["evaluation"]

    if threshold is None:
        threshold, total_cost = find_cost_optimal_threshold(
            y_true,
            y_prob,
            eval_cfg["cost_false_positive"],
            eval_cfg["cost_false_negative"],
        )
    else:
        y_pred_tmp = (y_prob >= threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred_tmp, labels=[0, 1]).ravel()
        total_cost = fp * eval_cfg["cost_false_positive"] + fn * eval_cfg["cost_false_negative"]

    metrics = compute_metrics_at_threshold(y_true, y_prob, threshold)
    y_pred = (y_prob >= threshold).astype(int)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist()

    result = EvaluationResult(
        model_name=model_name,
        precision=metrics["precision"],
        recall=metrics["recall"],
        f1=metrics["f1"],
        pr_auc=metrics["pr_auc"],
        roc_auc=metrics["roc_auc"],
        threshold=threshold,
        total_cost=total_cost,
        confusion_matrix=cm,
        cv_pr_auc_mean=cv_pr_auc_mean,
        cv_pr_auc_std=cv_pr_auc_std,
    )

    logger.info(
        "%s @ threshold=%.4f | PR-AUC=%.4f | P=%.4f | R=%.4f | F1=%.4f | cost=%.0f",
        model_name,
        threshold,
        result.pr_auc,
        result.precision,
        result.recall,
        result.f1,
        total_cost,
    )
    return result


def _to_json_serializable(obj: Any) -> Any:
    """Convert numpy scalars to native Python types for JSON export."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: _to_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_json_serializable(v) for v in obj]
    return obj


def save_evaluation(result: EvaluationResult, config: dict[str, Any] | None = None) -> Path:
    """Persist evaluation metrics as JSON."""
    config = config or load_config()
    out_dir = resolve_path(config["paths"]["metrics_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{result.model_name}_metrics.json"
    with out_path.open("w", encoding="utf-8") as handle:
        json.dump(_to_json_serializable(asdict(result)), handle, indent=2)
    logger.info("Saved metrics to %s", out_path)
    return out_path


def results_to_markdown_table(results: list[EvaluationResult]) -> str:
    """Format multiple evaluation results as a markdown table."""
    header = "| Model | PR-AUC | Precision | Recall | F1 | Threshold | CV PR-AUC |"
    sep = "|---|---:|---:|---:|---:|---:|---:|"
    rows = []
    for r in results:
        cv_str = (
            f"{r.cv_pr_auc_mean:.4f} ± {r.cv_pr_auc_std:.4f}"
            if r.cv_pr_auc_mean is not None and r.cv_pr_auc_std is not None
            else "N/A"
        )
        rows.append(
            f"| {r.model_name} | {r.pr_auc:.4f} | {r.precision:.4f} | {r.recall:.4f} | "
            f"{r.f1:.4f} | {r.threshold:.4f} | {cv_str} |"
        )
    return "\n".join([header, sep] + rows)
