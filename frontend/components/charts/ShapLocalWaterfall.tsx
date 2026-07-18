/**
 * components/charts/ShapLocalWaterfall.tsx
 * Horizontal waterfall-like bar chart explaining local prediction SHAP values.
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
import { ShapLocalItem } from "@/lib/api";
import ChartCard from "../ui/ChartCard";

interface ShapLocalWaterfallProps {
    data: ShapLocalItem[];
    baseValue: number;
    fraudProbability: number;
    loading?: boolean;
}

export default function ShapLocalWaterfall({
    data,
    baseValue,
    fraudProbability,
    loading = false,
}: ShapLocalWaterfallProps) {
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textColor = "var(--color-text-primary)";
    const surfaceColor = "var(--color-surface)";
    const legitColor = "var(--color-risk-legit)";
    const fraudColor = "var(--color-risk-fraud)";

    return (
        <ChartCard
            title="Local Model Explanation (SHAP Waterfall)"
            subtitle="Visual shifts showing how features push predictions away from the baseline probability"
            minHeight={348}
        >
            {loading ? (
                <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>Computing local explanation...</span>
                </div>
            ) : data.length === 0 ? (
                <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>
                        Select a transaction ID above and click explain to see details.
                    </span>
                </div>
            ) : (
                <>
                    <div
                        style={{
                            padding: "16px 20px",
                            borderRadius: 8,
                            marginBottom: 20,
                            background: "rgba(207, 157, 123, 0.06)",
                            border: `1px solid rgba(207, 157, 123, 0.15)`,
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            fontSize: "0.85rem",
                            fontFamily: "Inter, sans-serif",
                        }}
                    >
                        <div>
                            <span style={{ color: mutedColor }}>Base Prediction: </span>
                            <strong style={{ color: textColor }}>{baseValue.toFixed(4)}</strong>
                        </div>
                        <div style={{ borderLeft: `1px solid ${borderColor}`, height: 16 }} />
                        <div>
                            <span style={{ color: mutedColor }}>Calculated Probability: </span>
                            <strong style={{ color: fraudProbability > 0.5 ? fraudColor : legitColor }}>
                                {(fraudProbability * 100).toFixed(2)}%
                            </strong>
                        </div>
                    </div>

                    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 26)}>
                        <BarChart
                            layout="vertical"
                            data={data}
                            style={{ fontFamily: "Inter, sans-serif", fontSize: 11 }}
                            margin={{ left: 140, right: 32, bottom: 12, top: 12 }}
                        >
                            <CartesianGrid horizontal={false} stroke={borderColor} strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                stroke={mutedColor}
                                tickFormatter={(v: number) => (v > 0 ? `+${v.toFixed(3)}` : v.toFixed(3))}
                                label={{
                                    value: "SHAP value contribution",
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
                                formatter={(v: number, name: string, props: any) => {
                                    const item = props?.payload as ShapLocalItem;
                                    return [
                                        `SHAP contribution: ${v > 0 ? "+" : ""}${v.toFixed(5)} (Value: ${item?.value?.toLocaleString() ?? "—"})`,
                                        item?.feature ?? "",
                                    ];
                                }}
                            />
                            <Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>
                                {data.map((entry, i) => {
                                    const maxVal = Math.abs(data[0]?.shap_value ?? 1);
                                    const strength = Math.max(
                                        0.4,
                                        Math.min(1, Math.abs(entry.shap_value) / maxVal + 0.3)
                                    );
                                    return (
                                        <Cell
                                            key={i}
                                            fill={entry.shap_value >= 0 ? fraudColor : legitColor}
                                            opacity={strength}
                                        />
                                    );
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </>
            )}
        </ChartCard>
    );
}
