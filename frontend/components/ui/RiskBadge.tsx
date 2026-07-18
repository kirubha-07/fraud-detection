/**
 * components/ui/RiskBadge.tsx
 * Coloured pill badge for fraud risk bands.
 * Accepts a risk_band string: "critical" | "high" | "moderate" | "low"
 */

interface RiskBadgeProps {
    band: string;
    probability?: number;
}

export default function RiskBadge({ band, probability }: RiskBadgeProps) {
    const cls =
        band === "critical" ? "badge badge-critical" :
            band === "high" ? "badge badge-high" :
                band === "moderate" ? "badge badge-moderate" :
                    "badge badge-low";
    return (
        <span className={cls}>
            {band}{probability != null ? ` ${(probability * 100).toFixed(1)}%` : ""}
        </span>
    );
}
