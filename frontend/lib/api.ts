/** lib/api.ts
 * Typed fetch client for the FraudOps FastAPI backend.
 * All API calls go through this module — base URL from env with localhost fallback.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `API error ${res.status}`);
    }
    return res.json() as Promise<T>;
}

// ─── Inline types matching backend Pydantic schemas ───────────────────────────

export interface HealthResponse {
    status: string;
    models_loaded: string[];
    data_rows: number;
}

export interface ModelInfo {
    name: string;
    has_artifact: boolean;
    has_metrics: boolean;
}

export interface KPIsResponse {
    model: string;
    threshold: number;
    total_transactions: number;
    fraud_flagged: number;
    fraud_rate: number;
    precision: number;
    recall: number;
    f1: number;
    pr_auc: number;
    roc_auc: number;
    cost_saved: number;
    baseline_cost: number;
    current_cost: number;
}

export interface MetricsResponse {
    model_name: string;
    precision: number;
    recall: number;
    f1: number;
    pr_auc: number;
    roc_auc: number;
    threshold: number;
    total_cost: number;
    confusion_matrix: number[][];
    cv_pr_auc_mean: number | null;
    cv_pr_auc_std: number | null;
}

export interface TransactionRecord {
    transaction_id: number;
    step: number;
    type: string;
    amount: number;
    old_balance_orig: number;
    new_balance_orig: number;
    fraud_probability: number;
    flagged: boolean;
    risk_band: string;
    is_fraud: number | null;
}

export interface TransactionsResponse {
    model: string;
    threshold: number;
    page: number;
    page_size: number;
    total: number;
    records: TransactionRecord[];
}

export interface TimePoint {
    step: number;
    total: number;
    fraud: number;
    fraud_rate: number;
}

export interface TypeBreakdownItem {
    type: string;
    legitimate: number;
    fraud: number;
    total: number;
    fraud_rate: number;
}

export interface AmountBin {
    bin_label: string;
    log_lower: number;
    log_upper: number;
    legitimate_count: number;
    fraud_count: number;
}

export interface CurvePoint { x: number; y: number; }

export interface ModelCurves {
    model: string;
    roc: CurvePoint[];
    pr: CurvePoint[];
    roc_auc: number;
    pr_auc: number;
}

export interface CostPoint {
    threshold: number;
    cost: number;
}

export interface CostCurveResponse {
    model: string;
    fp_cost: number;
    fn_cost: number;
    points: CostPoint[];
    optimal_threshold: number;
    optimal_cost: number;
}

export interface ShapGlobalItem {
    feature: string;
    mean_abs_shap: number;
    rank: number;
}

export interface ShapLocalItem {
    feature: string;
    value: number;
    shap_value: number;
}

export interface ShapLocalResponse {
    model: string;
    transaction_id: number;
    fraud_probability: number;
    base_value: number;
    items: ShapLocalItem[];
}

export interface StoryStatsResponse {
    total_transactions: number;
    overall_fraud_rate: number;
    models_compared: number;
    best_pr_auc: number;
    best_model: string;
    cost_false_positive: number;
    cost_false_negative: number;
}

// ─── API functions ─────────────────────────────────────────────────────────────

export const api = {
    health: () => get<HealthResponse>("/api/health"),
    models: () => get<{ models: ModelInfo[] }>("/api/models"),
    storyStats: () => get<StoryStatsResponse>("/api/story-stats"),

    kpis: (model: string, threshold: number, fpCost?: number, fnCost?: number) =>
        get<KPIsResponse>(
            `/api/kpis?model=${model}&threshold=${threshold}` +
            (fpCost != null ? `&fp_cost=${fpCost}` : "") +
            (fnCost != null ? `&fn_cost=${fnCost}` : "")
        ),

    metrics: (model: string) => get<MetricsResponse>(`/api/metrics/${model}`),

    costCurve: (model: string, fpCost?: number, fnCost?: number) =>
        get<CostCurveResponse>(
            `/api/cost-curve/${model}` +
            (fpCost != null ? `?fp_cost=${fpCost}&fn_cost=${fnCost ?? 500}` : "")
        ),

    transactions: (model: string, threshold: number, page = 1, pageSize = 25) =>
        get<TransactionsResponse>(
            `/api/transactions?model=${model}&threshold=${threshold}&sort=risk&page=${page}&page_size=${pageSize}`
        ),

    timeseries: () => get<{ points: TimePoint[] }>("/api/timeseries/fraud-rate"),
    typeBreakdown: () => get<{ items: TypeBreakdownItem[] }>("/api/breakdown/transaction-type"),
    amountDist: () => get<{ bins: AmountBin[] }>("/api/distributions/amount"),
    allCurves: () => get<{ curves: ModelCurves[] }>("/api/curves/all"),

    shapGlobal: (model: string, sampleSize = 200) =>
        get<{ model: string; items: ShapGlobalItem[] }>(`/api/shap/global/${model}?sample_size=${sampleSize}`),

    shapLocal: (model: string, transactionId: number) =>
        get<ShapLocalResponse>(`/api/shap/local/${model}/${transactionId}`),
};
