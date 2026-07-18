/**
 * components/charts/ConfusionMatrixHeatmap.tsx
 * Custom CSS Grid based Heatmap to show the confusion matrix for the active model.
 * Avoids Recharts generic type issues with heatmaps and is clean and precise.
 */
import ChartCard from "../ui/ChartCard";

interface ConfusionMatrixHeatmapProps {
    modelName: string;
    confusionMatrix: number[][] | null;
    loading?: boolean;
}

export default function ConfusionMatrixHeatmap({
    modelName,
    confusionMatrix,
    loading = false,
}: ConfusionMatrixHeatmapProps) {
    const mutedColor = "var(--color-text-muted)";
    const borderColor = "var(--color-border)";

    if (loading) {
        return (
            <ChartCard title="Confusion Matrix" subtitle="Detailed performance breakdown of predictions" minHeight={348}>
                <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor }}>Loading confusion matrix...</span>
                </div>
            </ChartCard>
        );
    }

    if (!confusionMatrix || confusionMatrix.length < 2) {
        return (
            <ChartCard title="Confusion Matrix" subtitle={`Predictions comparison for ${modelName}`} minHeight={348}>
                <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor }}>No confusion matrix data.</span>
                </div>
            </ChartCard>
        );
    }

    // matrix shape [[TN, FP], [FN, TP]]
    const tn = confusionMatrix[0][0];
    const fp = confusionMatrix[0][1];
    const fn = confusionMatrix[1][0];
    const tp = confusionMatrix[1][1];

    const total = tn + fp + fn + tp;

    // Render cell details
    const cells = [
        { label: "True Negative (TN)", value: tn, type: "legit", desc: "Correctly classified legitimate" },
        { label: "False Positive (FP)", value: fp, type: "fraud", desc: "Type I: Legit flagged as fraud" },
        { label: "False Negative (FN)", value: fn, type: "fraud", desc: "Type II: Fraud missed!" },
        { label: "True Positive (TP)", value: tp, type: "legit", desc: "Correctly caught fraud" },
    ];

    return (
        <ChartCard
            title="Confusion Matrix"
            subtitle={`Prediction classification breakdown for ${modelName} (${total.toLocaleString()} total)`}
            minHeight={348}
        >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                {cells.map((c, i) => {
                    const pct = total > 0 ? (c.value / total) * 100 : 0;
                    // Color-gradient intensity based on volume
                    const intensity = Math.max(0.04, c.value / total);
                    const isFpFn = c.label.includes("FP") || c.label.includes("FN");
                    const bg = isFpFn
                        ? `rgba(181, 101, 79, ${intensity * 0.4})` // rust base
                        : `rgba(124, 139, 104, ${intensity * 0.4})`; // sage base
                    const border = isFpFn
                        ? `1px solid rgba(181, 101, 79, 0.2)`
                        : `1px solid rgba(124, 139, 104, 0.2)`;

                    return (
                        <div
                            key={i}
                            className="card-raised"
                            style={{
                                background: bg,
                                border: border,
                                borderRadius: 8,
                                padding: "20px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                minHeight: 110,
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: "0.68rem",
                                        textTransform: "uppercase",
                                        fontWeight: 600,
                                        letterSpacing: "0.05em",
                                        color: isFpFn ? "var(--color-risk-fraud)" : "var(--color-risk-legit)",
                                    }}
                                >
                                    {c.label}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                                    {c.desc}
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                                <div className="font-display text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                                    {c.value.toLocaleString()}
                                </div>
                                <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                                    ({pct.toFixed(2)}%)
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ChartCard>
    );
}
