/**
 * components/charts/TransactionTypeDonut.tsx
 * Donut chart visualizing transaction count breakdown by type and legitimacy (Fraud vs Legit).
 */
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { TypeBreakdownItem } from "@/lib/api";
import ChartCard from "../ui/ChartCard";

interface TransactionTypeDonutProps {
    data: TypeBreakdownItem[];
    loading?: boolean;
}

export default function TransactionTypeDonut({ data, loading = false }: TransactionTypeDonutProps) {
    const legitColor = "var(--color-risk-legit)";
    const fraudColor = "var(--color-risk-fraud)";
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textColor = "var(--color-text-primary)";
    const surfaceColor = "var(--color-surface)";

    // Format type breakdown data into a flat array of (Type - Legit / Type - Fraud)
    const donutData = data
        ? data
            .map((d) => [
                { name: `${d.type} — Legitimate`, value: d.legitimate, color: legitColor },
                { name: `${d.type} — Fraud`, value: d.fraud, color: fraudColor },
            ])
            .flat()
            .filter((d) => d.value > 0)
        : [];

    return (
        <ChartCard
            title="Transaction Type Breakdown"
            subtitle="Volume breakdown by transaction type, segmented by legitimacy"
            minHeight={348}
        >
            {loading ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>Loading breakdown data...</span>
                </div>
            ) : donutData.length === 0 ? (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: mutedColor, fontSize: "0.85rem" }}>No type data available.</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                        <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {donutData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} opacity={0.85} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                background: surfaceColor,
                                border: `1px solid ${borderColor}`,
                                borderRadius: 8,
                                color: textColor,
                                fontSize: 11,
                            }}
                            formatter={(v: number) => [v.toLocaleString(), "Count"]}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: "11px", color: mutedColor }}
                            iconSize={8}
                            iconType="circle"
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}
