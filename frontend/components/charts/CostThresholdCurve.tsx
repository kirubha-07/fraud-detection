/**
 * components/charts/CostThresholdCurve.tsx
 * Area chart visualizing the total business cost vs. the score decision threshold.
 * Displays the cost-optimal decision threshold vs. the currently selected threshold.
 */
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    ReferenceLine,
} from "recharts";
import { CostCurveResponse } from "@/lib/api";
import ChartCard from "../ui/ChartCard";

interface CostThresholdCurveProps {
    costCurve: CostCurveResponse | null;
    selectedThreshold: number;
    loading?: boolean;
}

export default function CostThresholdCurve({
    costCurve,
    selectedThreshold,
    loading = false,
}: CostThresholdCurveProps) {
    const accentColor = "var(--color-accent-primary)";
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textColor = "var(--color-text-primary)";
    const surfaceColor = "var(--color-surface)";
    const optColor = "var(--color-risk-legit)";
    const selColor = "var(--color-risk-high)";

    if (loading || !costCurve) {
        return (
            <ChartCard
                title="Cost Curve vs. Decision Threshold"
                subtitle="Expected operation cost based on threshold selection"
                minHeight={348}
            >
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor }}>Loading cost curve...</span>
                </div>
            </ChartCard>
        );
    }

    // Format points for the AreaChart
    const data = costCurve.points.map((pt) => ({
        threshold: pt.threshold,
        cost: pt.cost,
    }));

    return (
        <ChartCard
            title="Cost Curve vs. Decision Threshold"
            subtitle={`Minimize total loss (Optimum: threshold ${costCurve.optimal_threshold.toFixed(2)} @ $${costCurve.optimal_cost.toLocaleString()})`}
            minHeight={348}
        >
            {data.length === 0 ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor }}>No cost curve data available.</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={data} style={{ fontFamily: "Inter, sans-serif", fontSize: 11 }}>
                        <defs>
                            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={accentColor} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={accentColor} stopOpacity={0.0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke={borderColor} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="threshold"
                            type="number"
                            domain={[0, 1]}
                            stroke={mutedColor}
                            tickFormatter={(v) => v.toFixed(1)}
                            label={{
                                value: "Decision Threshold",
                                position: "insideBottom",
                                fill: mutedColor,
                                dy: 14,
                                fontSize: 10,
                            }}
                        />
                        <YAxis
                            stroke={mutedColor}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                            label={{
                                value: "Total Operating Cost",
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
                            formatter={(v: number) => [`$${v.toLocaleString()}`, "Expected Cost"]}
                            labelFormatter={(l) => `Threshold: ${Number(l).toFixed(2)}`}
                        />
                        <Area
                            type="monotone"
                            dataKey="cost"
                            stroke={accentColor}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#costGradient)"
                        />
                        {/* Optimal reference line */}
                        <ReferenceLine
                            x={costCurve.optimal_threshold}
                            stroke={optColor}
                            strokeDasharray="3 3"
                            strokeWidth={1.5}
                            label={{
                                value: `Optimal (${costCurve.optimal_threshold.toFixed(2)})`,
                                position: "top",
                                fill: optColor,
                                fontSize: 10,
                            }}
                        />
                        {/* Selected threshold reference line */}
                        <ReferenceLine
                            x={selectedThreshold}
                            stroke={selColor}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            label={{
                                value: `Selected (${selectedThreshold.toFixed(2)})`,
                                position: "top",
                                fill: selColor,
                                fontSize: 10,
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}
