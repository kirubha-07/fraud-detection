"""backend/routers/metrics.py

Endpoints for saved model metrics, ROC/PR curves, cost curve,
time-series, type breakdown, and amount distribution.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from backend.schemas import (
    AllCurvesResponse,
    AmountBin,
    AmountDistributionResponse,
    CostCurveResponse,
    CostPoint,
    CurvePoint,
    MetricsResponse,
    ModelCurves,
    TimePoint,
    TimeSeriesResponse,
    TypeBreakdownItem,
    TypeBreakdownResponse,
)
from backend.services.model_service import state, score_test_set, get_metrics
from src.utils import load_config

router = APIRouter()
config = load_config()
eval_cfg = config["evaluation"]


@router.get("/metrics/{model}", response_model=MetricsResponse)
def get_model_metrics(model: str) -> MetricsResponse:
    """Return saved evaluation metrics for a model."""
    try:
        m = get_metrics(model)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return MetricsResponse(
        model_name=m["model_name"],
        precision=m["precision"],
        recall=m["recall"],
        f1=m["f1"],
        pr_auc=m["pr_auc"],
        roc_auc=m["roc_auc"],
        threshold=m["threshold"],
        total_cost=m["total_cost"],
        confusion_matrix=m["confusion_matrix"],
        cv_pr_auc_mean=m.get("cv_pr_auc_mean"),
        cv_pr_auc_std=m.get("cv_pr_auc_std"),
    )


@router.get("/cost-curve/{model}", response_model=CostCurveResponse)
def get_cost_curve(
    model: str,
    fp_cost: float = Query(None),
    fn_cost: float = Query(None),
) -> CostCurveResponse:
    """Return expected total cost at 200 evenly-spaced thresholds."""
    fp_cost = fp_cost if fp_cost is not None else float(eval_cfg["cost_false_positive"])
    fn_cost = fn_cost if fn_cost is not None else float(eval_cfg["cost_false_negative"])
    try:
        y_true, y_prob, _ = score_test_set(model, 0.5)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    thresholds = np.linspace(0.01, 0.99, 200)
    costs: list[float] = []
    for t in thresholds:
        ypred = (y_prob >= t).astype(int)
        fp = int(((ypred == 1) & (y_true == 0)).sum())
        fn = int(((ypred == 0) & (y_true == 1)).sum())
        costs.append(fp * fp_cost + fn * fn_cost)

    costs_arr = np.array(costs)
    opt_idx = int(np.argmin(costs_arr))
    points = [CostPoint(threshold=float(t), cost=float(c)) for t, c in zip(thresholds, costs)]
    return CostCurveResponse(
        model=model,
        fp_cost=fp_cost,
        fn_cost=fn_cost,
        points=points,
        optimal_threshold=float(thresholds[opt_idx]),
        optimal_cost=float(costs_arr[opt_idx]),
    )


@router.get("/curves/all", response_model=AllCurvesResponse)
def get_all_curves() -> AllCurvesResponse:
    """ROC and PR curves for every model that has a scoring artifact."""
    from sklearn.metrics import precision_recall_curve, roc_curve, auc, average_precision_score

    curves: list[ModelCurves] = []
    split = state["split"]

    for model_name, bundle in state["bundles"].items():
        try:
            prob = bundle["model"].predict_proba(split.X_test)[:, 1]
            y = split.y_test

            # ROC — downsample to 300 points for API payload size
            fpr, tpr, _ = roc_curve(y, prob)
            step = max(1, len(fpr) // 300)
            roc_pts = [CurvePoint(x=float(fpr[i]), y=float(tpr[i])) for i in range(0, len(fpr), step)]

            # PR
            prec, rec, _ = precision_recall_curve(y, prob)
            step = max(1, len(prec) // 300)
            pr_pts = [CurvePoint(x=float(rec[i]), y=float(prec[i])) for i in range(0, len(prec), step)]

            curves.append(ModelCurves(
                model=model_name,
                roc=roc_pts,
                pr=pr_pts,
                roc_auc=float(auc(fpr, tpr)),
                pr_auc=float(average_precision_score(y, prob)),
            ))
        except Exception as exc:
            pass  # skip models that fail silently

    return AllCurvesResponse(curves=curves)


@router.get("/timeseries/fraud-rate", response_model=TimeSeriesResponse)
def get_fraud_rate_timeseries() -> TimeSeriesResponse:
    """Fraud rate per PaySim step (time proxy) from the full featured dataset."""
    featured: pd.DataFrame = state["featured"]
    if "step" not in featured.columns or "isFraud" not in featured.columns:
        return TimeSeriesResponse(points=[])

    grp = (
        featured.groupby("step")["isFraud"]
        .agg(total="count", fraud="sum")
        .reset_index()
    )
    points = [
        TimePoint(
            step=int(r["step"]),
            total=int(r["total"]),
            fraud=int(r["fraud"]),
            fraud_rate=float(r["fraud"] / r["total"]) if r["total"] else 0.0,
        )
        for _, r in grp.iterrows()
    ]
    return TimeSeriesResponse(points=points)


@router.get("/breakdown/transaction-type", response_model=TypeBreakdownResponse)
def get_type_breakdown() -> TypeBreakdownResponse:
    """Transaction count split by type and fraud label."""
    featured: pd.DataFrame = state["featured"]
    if "type" not in featured.columns:
        return TypeBreakdownResponse(items=[])

    grp = (
        featured.groupby(["type", "isFraud"])
        .size()
        .reset_index(name="count")
    )
    types = featured["type"].unique()
    items: list[TypeBreakdownItem] = []
    for t in sorted(types):
        sub = grp[grp["type"] == t]
        legit = int(sub[sub["isFraud"] == 0]["count"].sum())
        fraud = int(sub[sub["isFraud"] == 1]["count"].sum())
        total = legit + fraud
        items.append(TypeBreakdownItem(
            type=t,
            legitimate=legit,
            fraud=fraud,
            total=total,
            fraud_rate=fraud / total if total else 0.0,
        ))
    return TypeBreakdownResponse(items=items)


@router.get("/distributions/amount", response_model=AmountDistributionResponse)
def get_amount_distribution() -> AmountDistributionResponse:
    """Log10-scale amount histogram, fraud vs legitimate."""
    featured: pd.DataFrame = state["featured"]
    if "amount" not in featured.columns:
        return AmountDistributionResponse(bins=[])

    log_amounts = np.log10(featured["amount"].clip(lower=1.0))
    labels = featured["isFraud"].values
    n_bins = 40
    bin_edges = np.linspace(log_amounts.min(), log_amounts.max(), n_bins + 1)

    bins: list[AmountBin] = []
    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        mask = (log_amounts >= lo) & (log_amounts < hi)
        legit = int(((mask) & (labels == 0)).sum())
        fraud = int(((mask) & (labels == 1)).sum())
        bins.append(AmountBin(
            bin_label=f"10^{lo:.1f}–10^{hi:.1f}",
            log_lower=float(lo),
            log_upper=float(hi),
            legitimate_count=legit,
            fraud_count=fraud,
        ))
    return AmountDistributionResponse(bins=bins)
