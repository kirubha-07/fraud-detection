"""backend/routers/kpis.py

GET /api/kpis?model=xgboost&threshold=0.5&fp_cost=50&fn_cost=500
Returns the five headline KPIs shown in the top row of every dashboard view.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.schemas import KPIsResponse
from backend.services.model_service import score_test_set, state
from src.evaluate import compute_metrics_at_threshold
from src.utils import load_config

router = APIRouter()
config = load_config()
eval_cfg = config["evaluation"]


@router.get("/kpis", response_model=KPIsResponse)
def get_kpis(
    model: str = Query("xgboost", description="Model name"),
    threshold: float = Query(0.5, ge=0.0, le=1.0, description="Decision threshold"),
    fp_cost: float = Query(None, description="Cost per false positive"),
    fn_cost: float = Query(None, description="Cost per false negative"),
) -> KPIsResponse:
    """Return headline KPIs for the selected model at the given threshold."""
    fp_cost = fp_cost if fp_cost is not None else float(eval_cfg["cost_false_positive"])
    fn_cost = fn_cost if fn_cost is not None else float(eval_cfg["cost_false_negative"])

    try:
        y_true, y_prob, y_pred = score_test_set(model, threshold)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    metrics = compute_metrics_at_threshold(y_true, y_prob, threshold)

    n_total = len(y_true)
    n_flagged = int(y_pred.sum())
    n_fraud = int(y_true.sum())

    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())

    current_cost = fp * fp_cost + fn * fn_cost
    baseline_cost = n_fraud * fn_cost          # flag nothing
    cost_saved = baseline_cost - current_cost

    return KPIsResponse(
        model=model,
        threshold=threshold,
        total_transactions=n_total,
        fraud_flagged=n_flagged,
        fraud_rate=n_flagged / n_total if n_total else 0.0,
        precision=metrics["precision"],
        recall=metrics["recall"],
        f1=metrics["f1"],
        pr_auc=metrics["pr_auc"],
        roc_auc=metrics["roc_auc"],
        cost_saved=cost_saved,
        baseline_cost=baseline_cost,
        current_cost=current_cost,
    )
