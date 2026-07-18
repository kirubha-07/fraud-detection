/**
 * components/charts/ModelComparisonTable.tsx
 * Table displaying metric overlay comparisons for all models in the repository.
 * Visualizes cell backgrounds as a color gradient maps corresponding to metric strength.
 */
import { MetricsResponse } from "@/lib/api";

const METRIC_COLS = ["pr_auc", "roc_auc", "precision", "recall", "f1"] as const;

interface ModelComparisonTableProps {
    allMetrics: Record<string, MetricsResponse>;
    activeModel: string;
    modelsList: string[];
}

function MetricCell({ value }: { value: number }) {
    // Color scale: 0.0 (warm transparent) to 1.0 (Antique Brass alpha-overlay)
    const alpha = Math.max(0.12, value);
    const bg = `rgba(207, 157, 123, ${alpha * 0.3})`;
    const color = value >= 0.9 ? "var(--color-accent-primary)" : "var(--color-text-primary)";
    return (
        <td
            style={{
                padding: "14px 24px",
                textAlign: "right",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.82rem",
                background: bg,
                color,
                borderBottom: "1px solid var(--color-border)",
            }}
        >
            {value.toFixed(4)}
        </td>
    );
}

export default function ModelComparisonTable({
    allMetrics,
    activeModel,
    modelsList,
}: ModelComparisonTableProps) {
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textAccent = "var(--color-accent-primary)";
    const textNormal = "var(--color-text-primary)";

    return (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "24px", borderBottom: `1px solid ${borderColor}` }}>
                <div className="chart-title">Model Benchmarks</div>
                <div className="chart-subtitle" style={{ margin: 0 }}>
                    Primary metrics collected from static evaluation artifact files. Colored cells represent scale intensity.
                </div>
            </div>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                        <tr>
                            <th
                                style={{
                                    padding: "16px 24px",
                                    textAlign: "left",
                                    color: mutedColor,
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                    borderBottom: `1px solid ${borderColor}`,
                                }}
                            >
                                Model
                            </th>
                            {METRIC_COLS.map((k) => (
                                <th
                                    key={k}
                                    style={{
                                        padding: "16px 24px",
                                        textAlign: "right",
                                        color: mutedColor,
                                        fontSize: "0.72rem",
                                        letterSpacing: "0.05em",
                                        textTransform: "uppercase",
                                        borderBottom: `1px solid ${borderColor}`,
                                    }}
                                >
                                    {k.replace("_", "-").toUpperCase()}
                                </th>
                            ))}
                            <th
                                style={{
                                    padding: "16px 24px",
                                    textAlign: "right",
                                    color: mutedColor,
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                    borderBottom: `1px solid ${borderColor}`,
                                }}
                            >
                                Opt Threshold
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {modelsList.map((name) => {
                            const m = allMetrics[name];
                            const isActive = name === activeModel;

                            if (!m) {
                                return (
                                    <tr key={name}>
                                        <td
                                            style={{
                                                padding: "14px 24px",
                                                color: mutedColor,
                                                fontStyle: "italic",
                                                borderBottom: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            {name}
                                        </td>
                                        <td
                                            colSpan={6}
                                            style={{
                                                padding: "14px 24px",
                                                color: mutedColor,
                                                fontSize: "0.78rem",
                                                borderBottom: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            metrics unavailable — no artifact file found
                                        </td>
                                    </tr>
                                );
                            }

                            return (
                                <tr
                                    key={name}
                                    style={{
                                        background: isActive ? "rgba(207, 157, 123, 0.03)" : "transparent",
                                    }}
                                >
                                    <td
                                        style={{
                                            padding: "14px 24px",
                                            fontWeight: 600,
                                            color: isActive ? textAccent : textNormal,
                                            borderBottom: `1px solid ${borderColor}`,
                                        }}
                                    >
                                        {name}
                                        {isActive && (
                                            <span
                                                style={{
                                                    marginLeft: 8,
                                                    fontSize: "0.72rem",
                                                    color: textAccent,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                (active)
                                            </span>
                                        )}
                                    </td>
                                    {METRIC_COLS.map((k) => (
                                        <MetricCell key={k} value={m[k] as number} />
                                    ))}
                                    <td
                                        style={{
                                            padding: "14px 24px",
                                            textAlign: "right",
                                            color: mutedColor,
                                            fontSize: "0.82rem",
                                            borderBottom: `1px solid ${borderColor}`,
                                        }}
                                    >
                                        {m.threshold.toFixed(3)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
