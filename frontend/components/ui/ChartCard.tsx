/**
 * components/ui/ChartCard.tsx
 * Consistent card wrapper for every chart.
 * Provides a title, optional subtitle, and a content slot.
 */
import { ReactNode } from "react";

interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    minHeight?: number;
}

export default function ChartCard({ title, subtitle, children, minHeight }: ChartCardProps) {
    return (
        <div className="card" style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}>
            <div className="chart-title">{title}</div>
            {subtitle && <div className="chart-subtitle">{subtitle}</div>}
            {children}
        </div>
    );
}
