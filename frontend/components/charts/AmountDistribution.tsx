/**
 * components/charts/AmountDistribution.tsx
 * Histogram bar chart displaying transaction amounts log scale distribution comparing fraud and legitimate.
 */
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { AmountBin } from "@/lib/api";
import ChartCard from "../ui/ChartCard";

interface AmountDistributionProps {
    data: AmountBin[];
    loading?: boolean;
}

export default function AmountDistribution({ data, loading = false }: AmountDistributionProps) {
    const legitColor = "var(--color-risk-legit)";
    const fraudColor = "var(--color-risk-fraud)";
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textColor = "var(--color-text-primary)";
    const surfaceColor = "var(--color-surface)";

    return (
        <ChartCard
            title="Amount Log-Distribution"
            subtitle="Transaction value distribution comparing fraud and legitimate transactions (log₁₀ scale)"
            minHeight={348}
        >
            {loading ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>Loading distribution data...</span>
                </div>
            ) : data.length === 0 ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>No distribution data available.</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data} style={{ fontFamily: "Inter, sans-serif", fontSize: 11 }}>
                        <CartesianGrid stroke={borderColor} strokeDasharray="3 3" />
                        <XAxis dataKey="bin_label" stroke={mutedColor} />
                        <YAxis stroke={mutedColor} tickFormatter={(v) => v.toLocaleString()} />
                        <Tooltip
                            contentStyle={{
                                background: surfaceColor,
                                border: `1px solid ${borderColor}`,
                                borderRadius: 8,
                                color: textColor,
                            }}
                            formatter={(v: number) => [v.toLocaleString(), ""]}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px" }} iconSize={8} iconType="circle" />
                        <Bar dataKey="legitimate_count" name="Legitimate" fill={legitColor} opacity={0.8} />
                        <Bar dataKey="fraud_count" name="Fraud" fill={fraudColor} opacity={0.8} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}
