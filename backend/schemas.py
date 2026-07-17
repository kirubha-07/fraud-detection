"""Pydantic v2 schemas — the API contract for every endpoint.

These are the canonical response types. The frontend generates its
TypeScript types directly from the OpenAPI spec derived from these models.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ─── Health ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    models_loaded: list[str]
    data_rows: int


# ─── Models list ─────────────────────────────────────────────────────────────

class ModelInfo(BaseModel):
    name: str
    has_artifact: bool          # True if .joblib exists for scoring
    has_metrics: bool           # True if metrics JSON exists


class ModelsResponse(BaseModel):
    models: list[ModelInfo]


# ─── KPIs ─────────────────────────────────────────────────────────────────────

class KPIsResponse(BaseModel):
    model: str
    threshold: float
    total_transactions: int
    fraud_flagged: int
    fraud_rate: float
    precision: float
    recall: float
    f1: float
    pr_auc: float
    roc_auc: float
    cost_saved: float
    baseline_cost: float
    current_cost: float


# ─── Metrics ─────────────────────────────────────────────────────────────────

class MetricsResponse(BaseModel):
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


# ─── Cost curve ──────────────────────────────────────────────────────────────

class CostPoint(BaseModel):
    threshold: float
    cost: float

class CostCurveResponse(BaseModel):
    model: str
    fp_cost: float
    fn_cost: float
    points: list[CostPoint]
    optimal_threshold: float
    optimal_cost: float


# ─── Transactions (live scoring) ─────────────────────────────────────────────

class TransactionRecord(BaseModel):
    transaction_id: int
    step: int
    type: str
    amount: float
    old_balance_orig: float
    new_balance_orig: float
    fraud_probability: float
    flagged: bool
    risk_band: str             # "low" | "moderate" | "high" | "critical"
    is_fraud: int | None = None


class TransactionsResponse(BaseModel):
    model: str
    threshold: float
    page: int
    page_size: int
    total: int
    records: list[TransactionRecord]


# ─── Time series ─────────────────────────────────────────────────────────────

class TimePoint(BaseModel):
    step: int
    total: int
    fraud: int
    fraud_rate: float


class TimeSeriesResponse(BaseModel):
    points: list[TimePoint]


# ─── Transaction type breakdown ───────────────────────────────────────────────

class TypeBreakdownItem(BaseModel):
    type: str
    legitimate: int
    fraud: int
    total: int
    fraud_rate: float


class TypeBreakdownResponse(BaseModel):
    items: list[TypeBreakdownItem]


# ─── Amount distribution ─────────────────────────────────────────────────────

class AmountBin(BaseModel):
    bin_label: str
    log_lower: float
    log_upper: float
    legitimate_count: int
    fraud_count: int


class AmountDistributionResponse(BaseModel):
    bins: list[AmountBin]


# ─── ROC / PR curves ─────────────────────────────────────────────────────────

class CurvePoint(BaseModel):
    x: float
    y: float


class ModelCurves(BaseModel):
    model: str
    roc: list[CurvePoint]
    pr: list[CurvePoint]
    roc_auc: float
    pr_auc: float


class AllCurvesResponse(BaseModel):
    curves: list[ModelCurves]


# ─── SHAP Global ─────────────────────────────────────────────────────────────

class ShapGlobalItem(BaseModel):
    feature: str
    mean_abs_shap: float
    rank: int


class ShapGlobalResponse(BaseModel):
    model: str
    items: list[ShapGlobalItem]


# ─── SHAP Local ──────────────────────────────────────────────────────────────

class ShapLocalItem(BaseModel):
    feature: str
    value: float
    shap_value: float


class ShapLocalResponse(BaseModel):
    model: str
    transaction_id: int
    fraud_probability: float
    base_value: float
    items: list[ShapLocalItem]


# ─── Story stats (homepage) ───────────────────────────────────────────────────

class StoryStatsResponse(BaseModel):
    total_transactions: int
    overall_fraud_rate: float
    models_compared: int
    best_pr_auc: float
    best_model: str
    cost_false_positive: float
    cost_false_negative: float


# ─── Error ───────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
