"""Unit tests for cost-based evaluation logic."""

from __future__ import annotations

import numpy as np

from src.evaluate import evaluate_model, find_cost_optimal_threshold


def test_cost_optimal_threshold_balances_false_positives_and_false_negatives() -> None:
    """Low FN cost should favor a threshold that catches both fraud cases."""
    y_true = np.array([0, 0, 1, 1])
    y_prob = np.array([0.10, 0.40, 0.35, 0.80])

    threshold, total_cost = find_cost_optimal_threshold(y_true, y_prob, cost_fp=1, cost_fn=5)

    assert threshold == 0.35
    assert total_cost == 1.0


def test_cost_optimal_threshold_shifts_when_false_positives_are_expensive() -> None:
    """High FP cost should push the optimal threshold higher."""
    y_true = np.array([0, 0, 1, 1])
    y_prob = np.array([0.10, 0.40, 0.35, 0.80])

    threshold, total_cost = find_cost_optimal_threshold(y_true, y_prob, cost_fp=10, cost_fn=1)

    assert threshold == 0.80
    assert total_cost == 1.0


def test_evaluate_model_applies_cost_optimal_threshold_and_confusion_matrix() -> None:
    """evaluate_model should reuse the cost model and expose the expected confusion matrix."""
    y_true = np.array([0, 0, 1, 1])
    y_prob = np.array([0.10, 0.40, 0.35, 0.80])
    config = {
        "evaluation": {"cost_false_positive": 1, "cost_false_negative": 5},
        "paths": {"metrics_dir": "outputs/metrics"},
    }

    result = evaluate_model("unit_test_model", y_true, y_prob, config=config)

    assert result.threshold == 0.35
    assert result.total_cost == 1.0
    assert result.confusion_matrix == [[1, 1], [0, 2]]
    assert result.precision == 2 / 3
    assert result.recall == 1.0