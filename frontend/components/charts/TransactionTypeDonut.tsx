/**
 * components/charts/TransactionTypeDonut.tsx
 * Donut chart visualizing transaction count breakdown by type and legitimacy (Fraud vs Legit).
 *
 * Color strategy: each transaction type gets its own distinct hue from the warm palette
 * derived from --color-accent-primary (#CF9D7B) and --color-accent-secondary (#724B39).
 * Within each type, Legit = lighter/base tone, Fraud = darker + reddish tint.
 */
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { TypeBreakdownItem } from "@/lib/api";
import ChartCard from "../ui/ChartCard";

interface TransactionTypeDonutProps {
    data: TypeBreakdownItem[];
    loading?: boolean;
}

/**
 * Palette rooted in --color-accent-primary (#CF9D7B, Antique Brass) and
 * --color-accent-secondary (#724B39, dark walnut).
 * Each type gets a distinct base hue; Legit = lighter, Fraud = darker + redder.
 */
const TYPE_PALETTE: Record<string, { legit: string; fraud: string }> = {
    TRANSFER: { legit: "#CF9D7B", fraud: "#8B3A2C" },  // Antique Brass → deep rust
    CASH_OUT: { legit: "#B8976A", fraud: "#6B2D20" },  // warm tan → dark ember
    DEBIT: { legit: "#D4B896", fraud: "#9C4A38" },  // pale brass → burnt sienna
    PAYMENT: { legit: "#A08060", fraud: "#5C2418" },  // medium bronze → mahogany
    CASH_IN: { legit: "#C4A882", fraud: "#7A3828" },  // sandy brass → deep russet
};

/** Returns the type's legit/fraud colors, falling back to a neutral warm pair. */
function typeColors(type: string) {
    return (
        TYPE_PALETTE[type.toUpperCase()] ?? { legit: "#BFA585", fraud: "#7D3C2C" }
    );
}

/** Custom legend rendered outside Recharts so we can group by type. */
function GroupedLegend({
    types,
    mutedColor,
    textColor,
}: {
    types: string[];
    mutedColor: string;
    textColor: string;
}) {
    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px 20px",
                justifyContent: "center",
                marginTop: 8,
                fontSize: "11px",
                fontFamily: "Inter, sans-serif",
            }}
        >
            {types.map((type) => {
                const { legit, fraud } = typeColors(type);
                return (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {/* Type label */}
                        <span style={{ color: mutedColor, fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {type}:
                        </span>
                        {/* Legit swatch */}
                        <span
                            style={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: legit,
                            }}
                        />
                        <span style={{ color: textColor }}>Legit</span>
                        {/* Fraud swatch */}
                        <span
                            style={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: fraud,
                            }}
                        />
                        <span style={{ color: textColor }}>Fraud</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function TransactionTypeDonut({ data, loading = false }: TransactionTypeDonutProps) {
    const borderColor = "var(--color-border)";
    const mutedColor = "var(--color-text-muted)";
    const textColor = "var(--color-text-primary)";
    const surfaceColor = "var(--color-surface)";

    // Build flat array with per-type per-legitimacy colors
    const donutData = data
        ? data
            .map((d) => {
                const { legit, fraud } = typeColors(d.type);
                return [
                    { name: `${d.type} — Legitimate`, value: d.legitimate, color: legit },
                    { name: `${d.type} — Fraud`, value: d.fraud, color: fraud },
                ];
            })
            .flat()
            .filter((d) => d.value > 0)
        : [];

    // Unique type names present in data (preserving order)
    const presentTypes = data
        ? [...new Set(data.map((d) => d.type))]
        : [];

    return (
        <ChartCard
            title="Transaction Type Breakdown"
            subtitle="Volume breakdown by transaction type — grouped by type, Legit (lighter) vs Fraud (darker)"
            minHeight={380}
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
                <>
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
                                    <Cell key={i} fill={entry.color} opacity={0.9} />
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
                                formatter={(v: any, name: any) => [Number(v).toLocaleString(), String(name)]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <GroupedLegend types={presentTypes} mutedColor={mutedColor} textColor={textColor} />
                </>
            )}
        </ChartCard>
    );
}
