"use client";
/**
 * app/dashboard/explainability/page.tsx
 * Explainability Page: Global SHAP importance (horizontal bar) +
 * local waterfall chart explanation for selected transaction.
 * Composed from reusable components.
 */

import { useEffect, useState } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, ShapGlobalItem, ShapLocalResponse } from "@/lib/api";
import { AlertCircle } from "lucide-react";

// Reusable components
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import ShapGlobalBar from "@/components/charts/ShapGlobalBar";
import ShapLocalWaterfall from "@/components/charts/ShapLocalWaterfall";

export default function ExplainabilityPage() {
    const { model } = useDashboard();
    const [globalData, setGlobalData] = useState<ShapGlobalItem[]>([]);
    const [globalLoading, setGlobalLoading] = useState(true);
    const [globalError, setGlobalError] = useState<string | null>(null);

    // Local explanation section
    const [txnId, setTxnId] = useState<number>(0);
    const [localResponse, setLocalResponse] = useState<ShapLocalResponse | null>(null);
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Load global SHAP values when active model changes
    useEffect(() => {
        setGlobalData([]);
        setGlobalLoading(true);
        setGlobalError(null);

        api.shapGlobal(model, 200)
            .then((res) => setGlobalData(res.items))
            .catch((err) => setGlobalError(err.message))
            .finally(() => setGlobalLoading(false));
    }, [model]);

    // Load local SHAP explanation on user click
    function handleFetchLocal() {
        setLocalResponse(null);
        setLocalLoading(true);
        setLocalError(null);

        api.shapLocal(model, txnId)
            .then(setLocalResponse)
            .catch((err) => setLocalError(err.message))
            .finally(() => setLocalLoading(false));
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {/* Page Header */}
            <div>
                <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--color-accent-primary)" }}>
                    Explainability
                </h1>
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                    SHAP values for model: <strong style={{ color: "var(--color-text-primary)" }}>{model}</strong>
                </p>
            </div>

            {globalError && <EmptyState error title="Global explainability failed" message={globalError} />}

            {/* Global SHAP Importance bar chart */}
            <ShapGlobalBar data={globalData} loading={globalLoading} />

            {/* Local Transaction Explanation section */}
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                    <div className="chart-title">Local Transaction Explanation</div>
                    <div className="chart-subtitle" style={{ margin: 0 }}>
                        Enter a transaction index (0 - 33,182) to compute path force SHAP values explaining the risk prediction score.
                    </div>
                </div>

                {/* Transaction ID input field + submit button */}
                <div className="flex items-center gap-3">
                    <label style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                        Transaction ID (Index):
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={33182}
                        value={txnId}
                        onChange={(e) => setTxnId(Number(e.target.value))}
                        style={{
                            background: "var(--color-surface)",
                            border: `1px solid var(--color-border)`,
                            borderRadius: 8,
                            color: "var(--color-text-primary)",
                            padding: "8px 12px",
                            fontSize: "0.85rem",
                            width: 120,
                            outline: "none",
                        }}
                    />
                    <button
                        onClick={handleFetchLocal}
                        disabled={localLoading}
                        style={{
                            background: "rgba(207, 157, 123, 0.15)",
                            border: `1px solid var(--color-accent-primary)`,
                            borderRadius: 8,
                            color: "var(--color-accent-primary)",
                            padding: "8px 20px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity: localLoading ? 0.5 : 1,
                            transition: "opacity 0.2s",
                        }}
                    >
                        {localLoading ? "Computing..." : "Explain Prediction"}
                    </button>
                </div>

                {localError && (
                    <div
                        className="flex items-center gap-3"
                        style={{
                            color: "var(--color-risk-fraud)",
                            fontSize: "0.85rem",
                            padding: "12px 16px",
                            borderRadius: 8,
                            border: "1px solid rgba(196, 106, 82, 0.2)",
                            background: "rgba(196, 106, 82, 0.05)",
                        }}
                    >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{localError}</span>
                    </div>
                )}

                <ShapLocalWaterfall
                    data={localResponse?.items ?? []}
                    baseValue={localResponse?.base_value ?? 0}
                    fraudProbability={localResponse?.fraud_probability ?? 0}
                    loading={localLoading}
                />
            </div>
        </div>
    );
}
