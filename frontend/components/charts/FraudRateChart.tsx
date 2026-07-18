/**
 * components/charts/FraudRateChart.tsx
 * Line chart displaying fraud rate trends over PaySim steps (time proxy).
 */
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { TimePoint } from "@/lib/api";
import ChartCard from "../ui/ChartCard";

interface FraudRateChartProps {
    data: TimePoint[];
    loading?: boolean;
}

export default function FraudRateChart({ data, loading = false }: FraudRateChartProps) {
    const chartColor = "var(--color-risk-fraud)";
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textColor = "var(--color-text-primary)";
    const surfaceColor = "var(--color-surface)";

    return (
        <ChartCard
            title="Fraud Rate Trend"
            subtitle="Temporal distribution of fraud rate across PaySim transaction steps"
            minHeight={348}
        >
            {loading ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>Loading timeseries data...</span>
                </div>
            ) : data.length === 0 ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>No trend data available.</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data} style={{ fontFamily: "Inter, sans-serif", fontSize: 11 }}>
                        <CartesianGrid stroke={borderColor} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="step"
                            stroke={mutedColor}
                            label={{
                                value: "PaySim Steps (Time Proxy)",
                                position: "insideBottom",
                                fill: mutedColor,
                                dy: 10,
                                fontSize: 10,
                            }}
                        />
                        <YAxis
                            stroke={mutedColor}
                            tickFormatter={(v) => `${(v * 100).toFixed(2)}%`}
                            label={{
                                value: "Fraud Rate",
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
                            formatter={(v: any) => [`${(Number(v) * 100).toFixed(4)}%`, "Fraud Rate"]}
                            labelFormatter={(l) => `Step ${l}`}
                        />
                        <Line
                            type="monotone"
                            dataKey="fraud_rate"
                            stroke={chartColor}
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}
