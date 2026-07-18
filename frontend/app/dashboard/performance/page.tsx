"use client";
/**
 * app/dashboard/performance/page.tsx
 * Performance Page: model comparison table, ROC/PR curves overlay, confusion matrix,
 * cost curves. Composed from reusable components.
 */

import { useEffect, useState } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, MetricsResponse, ModelCurves, CostCurveResponse } from "@/lib/api";

// Reusable components
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import RocPrCurves from "@/components/charts/RocPrCurves";
import ConfusionMatrixHeatmap from "@/components/charts/ConfusionMatrixHeatmap";
import CostThresholdCurve from "@/components/charts/CostThresholdCurve";
import ModelComparisonTable from "@/components/charts/ModelComparisonTable";

const ALL_MODELS = ["xgboost", "random_forest", "logistic_regression", "isolation_forest"];

export default function PerformancePage() {
    const { model, threshold, fpCost, fnCost } = useDashboard();
    const [allMetrics, setAllMetrics] = useState<Record<string, MetricsResponse>>({});
    const [curves, setCurves] = useState<ModelCurves[]>([]);
    const [costCurve, setCostCurve] = useState<CostCurveResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        // Fetch benchmarks and curves
        Promise.allSettled([
            Promise.allSettled(
                ALL_MODELS.map((name) =>
                    api.metrics(name).then((res) => [name, res] as [string, MetricsResponse])
                )
            ).then((results) => {
                const map: Record<string, MetricsResponse> = {};
                results.forEach((r) => {
                    if (r.status === "fulfilled") {
                        map[r.value[0]] = r.value[1];
                    }
                });
                setAllMetrics(map);
            }),
            api.allCurves().then((res) => setCurves(res.curves)),
        ])
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        api.costCurve(model, fpCost, fnCost)
            .then(setCostCurve)
            .catch(() => { });
    }, [model, fpCost, fnCost]);

    const cmData = allMetrics[model]?.confusion_matrix ?? null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {/* Header */}
            <div>
                <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--color-accent-primary)" }}>
                    Model Performance
                </h1>
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                    Active Model: <strong style={{ color: "var(--color-text-primary)" }}>{model}</strong>
                </p>
            </div>

            {error && <EmptyState error title="Failed to load performance metrics" message={error} />}

            {/* Model benchmarks table overlay grid */}
            {loading ? (
                <div className="card">
                    <LoadingSkeleton rows={5} height={42} />
                </div>
            ) : (
                <ModelComparisonTable
                    allMetrics={allMetrics}
                    activeModel={model}
                    modelsList={ALL_MODELS}
                />
            )}

            {/* Multi-model ROC + PR curves overlay */}
            <RocPrCurves curves={curves} loading={loading} />

            {/* Confusion Matrix and Cost curve overlay split block */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                <ConfusionMatrixHeatmap
                    modelName={model}
                    confusionMatrix={cmData}
                    loading={loading}
                />
                <CostThresholdCurve
                    costCurve={costCurve}
                    selectedThreshold={threshold}
                    loading={loading}
                />
            </div>
        </div>
    );
}
