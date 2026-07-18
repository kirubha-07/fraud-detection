/**
 * components/charts/RocPrCurves.tsx
 * Double chart display: ROC Curves overlay on the left, Precision-Recall Curves overlay on the right.
 * Visualizes and compares all trained models.
 */
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { ModelCurves } from "@/lib/api";
import ChartCard from "../ui/ChartCard";

interface RocPrCurvesProps {
    curves: ModelCurves[];
    loading?: boolean;
}

// Warm-palette-safe model colors
const MODEL_COLORS: Record<string, string> = {
    xgboost: "var(--color-accent-primary)",
    random_forest: "var(--color-risk-legit)",
    logistic_regression: "var(--color-risk-fraud)",
    isolation_forest: "var(--color-accent-secondary)",
};

function modelColor(name: string) {
    return MODEL_COLORS[name] ?? "var(--color-text-muted)";
}

export default function RocPrCurves({ curves, loading = false }: RocPrCurvesProps) {
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textColor = "var(--color-text-primary)";
    const surfaceColor = "var(--color-surface)";

    // Merge the curves data for Recharts (points range from 0 to 1, length match post-downsampling)
    const mergedRoc =
        curves.length > 0
            ? curves[0].roc.map((pt, i) => {
                const row: Record<string, number> = { x: pt.x };
                curves.forEach((c) => {
                    row[c.model] = c.roc[i]?.y ?? 0;
                });
                return row;
            })
            : [];

    const mergedPr =
        curves.length > 0
            ? curves[0].pr.map((pt, i) => {
                const row: Record<string, number> = { x: pt.x };
                curves.forEach((c) => {
                    row[c.model] = c.pr[i]?.y ?? 0;
                });
                return row;
            })
            : [];

    if (loading) {
        return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div className="card" style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor }}>Loading ROC curves...</span>
                </div>
                <div className="card" style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor }}>Loading PR curves...</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "1.0fr 1.0fr", gap: 24 }}>
            {/* ROC Curves */}
            <ChartCard
                title="ROC Curves — All Models"
                subtitle="True Positive Rate (Sensitivity) vs. False Positive Rate (1 - Specificity)"
                minHeight={320}
            >
                {mergedRoc.length === 0 ? (
                    <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: mutedColor }}>No ROC data available.</span>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={mergedRoc} style={{ fontFamily: "Inter, sans-serif", fontSize: 11 }}>
                            <CartesianGrid stroke={borderColor} strokeDasharray="3 3" />
                            <XAxis
                                dataKey="x"
                                stroke={mutedColor}
                                tickFormatter={(v) => v.toFixed(1)}
                                label={{
                                    value: "False Positive Rate (FPR)",
                                    position: "insideBottom",
                                    fill: mutedColor,
                                    dy: 14,
                                    fontSize: 10,
                                }}
                            />
                            <YAxis
                                stroke={mutedColor}
                                label={{
                                    value: "True Positive Rate (TPR)",
                                    angle: -90,
                                    position: "insideLeft",
                                    fill: mutedColor,
                                    dx: -10,
                                    fontSize: 10,
                                }}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: surfaceColor,
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 8,
                                    color: textColor,
                                }}
                                formatter={(v: number) => [v.toFixed(4), "TPR"]}
                                labelFormatter={(l) => `FPR: ${Number(l).toFixed(3)}`}
                            />
                            <Legend wrapperStyle={{ fontSize: "11px", color: mutedColor }} iconSize={8} />
                            {curves.map((c) => (
                                <Line
                                    key={c.model}
                                    type="monotone"
                                    dataKey={c.model}
                                    stroke={modelColor(c.model)}
                                    strokeWidth={2}
                                    dot={false}
                                    name={`${c.model} (AUC: ${c.roc_auc.toFixed(3)})`}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            {/* PR Curves */}
            <ChartCard
                title="Precision-Recall Curves — All Models"
                subtitle="Precision vs. Recall overlaid comparison for all models in repository"
                minHeight={320}
            >
                {mergedPr.length === 0 ? (
                    <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: mutedColor }}>No PR data available.</span>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={mergedPr} style={{ fontFamily: "Inter, sans-serif", fontSize: 11 }}>
                            <CartesianGrid stroke={borderColor} strokeDasharray="3 3" />
                            <XAxis
                                dataKey="x"
                                stroke={mutedColor}
                                tickFormatter={(v) => v.toFixed(1)}
                                label={{
                                    value: "Recall",
                                    position: "insideBottom",
                                    fill: mutedColor,
                                    dy: 14,
                                    fontSize: 10,
                                }}
                            />
                            <YAxis
                                stroke={mutedColor}
                                label={{
                                    value: "Precision",
                                    angle: -90,
                                    position: "insideLeft",
                                    fill: mutedColor,
                                    dx: -10,
                                    fontSize: 10,
                                }}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: surfaceColor,
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 8,
                                    color: textColor,
                                }}
                                formatter={(v: number) => [v.toFixed(4), "Precision"]}
                                labelFormatter={(l) => `Recall: ${Number(l).toFixed(3)}`}
                            />
                            <Legend wrapperStyle={{ fontSize: "11px", color: mutedColor }} iconSize={8} />
                            {curves.map((c) => (
                                <Line
                                    key={c.model}
                                    type="monotone"
                                    dataKey={c.model}
                                    stroke={modelColor(c.model)}
                                    strokeWidth={2}
                                    dot={false}
                                    name={`${c.model} (AUC: ${c.pr_auc.toFixed(3)})`}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>
        </div>
    );
}
