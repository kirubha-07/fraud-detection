/**
 * components/ui/KpiCard.tsx
 * Label + large serif number with an optional delta below.
 */
import { ReactNode } from "react";

interface KpiCardProps {
    label: string;
    value: string | number;
    delta?: string;
    deltaPositive?: boolean;
    icon?: ReactNode;
    accent?: boolean;
}

export default function KpiCard({ label, value, delta, deltaPositive, icon, accent }: KpiCardProps) {
    return (
        <div
            className="card"
            style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 0,
            }}
        >
            <div className="flex items-center gap-2">
                {icon && (
                    <span style={{ color: "var(--color-accent-primary)", flexShrink: 0 }}>
                        {icon}
                    </span>
                )}
                <div className="kpi-label">{label}</div>
            </div>
            <div
                className="kpi-value"
                style={accent ? { color: "var(--color-accent-primary)" } : undefined}
            >
                {value}
            </div>
            {delta && (
                <div
                    style={{
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        color: deltaPositive
                            ? "var(--color-risk-legit)"
                            : "var(--color-risk-fraud)",
                    }}
                >
                    {delta}
                </div>
            )}
        </div>
    );
}
