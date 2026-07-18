/**
 * components/charts/ShapGlobalBar.tsx
 * Horizontal bar chart visualizing global feature importance (mean absolute SHAP values).
 */
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { ShapGlobalItem } from "@/lib/api";
import ChartCard from "../ui/ChartCard";

interface ShapGlobalBarProps {
    data: ShapGlobalItem[];
    loading?: boolean;
}

export default function ShapGlobalBar({ data, loading = false }: ShapGlobalBarProps) {
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textColor = "var(--color-text-primary)";
    const surfaceColor = "var(--color-surface)";

    // The rendering list should be reversed so high-importance is at the top in vertical layout
    const chartData = data ? [...data].reverse() : [];

    return (
        <ChartCard
            title="Global Feature Importance"
            subtitle="Mean absolute SHAP value impact on model predictions calculated on test set slices"
            minHeight={348}
        >
            {loading ? (
                <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>Loading global SHAP...</span>
                </div>
            ) : chartData.length === 0 ? (
                <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>No feature importance data.</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 24)}>
                    <BarChart
                        layout="vertical"
                        data={chartData}
                        style={{ fontFamily: "Inter, sans-serif", fontSize: 11 }}
                        margin={{ left: 140, right: 24, bottom: 12, top: 12 }}
                    >
                        <CartesianGrid horizontal={false} stroke={borderColor} strokeDasharray="3 3" />
                        <XAxis
                            type="number"
                            stroke={mutedColor}
                            tickFormatter={(v: number) => v.toFixed(3)}
                            label={{
                                value: "mean |SHAP| (impact magnitude)",
                                position: "insideBottom",
                                fill: mutedColor,
                                dy: 12,
                                fontSize: 10,
                            }}
                        />
                        <YAxis
                            type="category"
                            dataKey="feature"
                            stroke={mutedColor}
                            tick={{ fill: textColor, fontSize: 10 }}
                            width={135}
                        />
                        <Tooltip
                            contentStyle={{
                                background: surfaceColor,
                                border: `1px solid ${borderColor}`,
                                borderRadius: 8,
                                color: textColor,
                            }}
                            formatter={(v: number) => [v.toFixed(5), "mean |SHAP|"]}
                        />
                        <Bar dataKey="mean_abs_shap" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, i) => {
                                const max = data[0]?.mean_abs_shap ?? 1;
                                const ratio = entry.mean_abs_shap / max;
                                // Blend from background-surface style to prominent Antique Brass color accent
                                const r = Math.round(207 * ratio + 30 * (1 - ratio));
                                const g = Math.round(157 * ratio + 45 * (1 - ratio));
                                const b = Math.round(123 * ratio + 53 * (1 - ratio));
                                return <Cell key={i} fill={`rgb(${r},${g},${b})`} opacity={0.85} />;
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}
