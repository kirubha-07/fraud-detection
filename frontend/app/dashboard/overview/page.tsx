"use client";
/**
 * app/dashboard/overview/page.tsx
 * Overview dashboard: KPI row + fraud-rate timeseries + type donut + amount histogram.
 * All data fetched from the live FastAPI backend, respects DashboardContext,
 * composed from reusable components.
 */

import { useEffect, useState } from "react";
import { TrendingUp, Shield, DollarSign, Target, AlertCircle } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, KPIsResponse, TimePoint, TypeBreakdownItem, AmountBin } from "@/lib/api";

// Reusable UI/charts components
import KpiCard from "@/components/ui/KpiCard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import FraudRateChart from "@/components/charts/FraudRateChart";
import TransactionTypeDonut from "@/components/charts/TransactionTypeDonut";
import AmountDistribution from "@/components/charts/AmountDistribution";

export default function OverviewPage() {
    const { model, threshold, fpCost, fnCost } = useDashboard();
    const [kpis, setKpis] = useState<KPIsResponse | null>(null);
    const [timeseries, setTimeseries] = useState<TimePoint[] | null>(null);
    const [typeData, setTypeData] = useState<TypeBreakdownItem[] | null>(null);
    const [amountData, setAmountData] = useState<AmountBin[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setKpis(null);

        api.kpis(model, threshold, fpCost, fnCost)
            .then(setKpis)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [model, threshold, fpCost, fnCost]);

    useEffect(() => {
        api.timeseries().then((r) => setTimeseries(r.points)).catch(() => { });
        api.typeBreakdown().then((r) => setTypeData(r.items)).catch(() => { });
        api.amountDist().then((r) => setAmountData(r.bins)).catch(() => { });
    }, []);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {/* Page Header */}
            <div>
                <h1
                    className="font-display text-2xl font-bold mb-1"
                    style={{ color: "var(--color-accent-primary)" }}
                >
                    Overview
                </h1>
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                    Active Model: <strong style={{ color: "var(--color-text-primary)" }}>{model}</strong> — Decision Threshold:{" "}
                    <strong style={{ color: "var(--color-accent-primary)" }}>{threshold.toFixed(2)}</strong>
                </p>
            </div>

            {error && <EmptyState error title="Backend Service Error" message={error} />}

            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 24 }}>
                {loading || !kpis ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="card" style={{ height: 110 }}>
                            <LoadingSkeleton rows={2} height={20} />
                        </div>
                    ))
                ) : (
                    <>
                        <KpiCard
                            label="Transactions"
                            value={kpis.total_transactions.toLocaleString()}
                            icon={<Shield className="h-4 w-4" />}
                        />
                        <KpiCard
                            label="Flagged Fraud"
                            value={kpis.fraud_flagged.toLocaleString()}
                            delta={`Threshold of ${threshold.toFixed(2)}`}
                            icon={<AlertCircle className="h-4 w-4" />}
                            accent
                        />
                        <KpiCard
                            label="Fraud Rate"
                            value={`${(kpis.fraud_rate * 100).toFixed(2)}%`}
                            icon={<TrendingUp className="h-4 w-4" />}
                        />
                        <KpiCard
                            label="PR-AUC"
                            value={kpis.pr_auc.toFixed(4)}
                            delta="Primary Metric"
                            deltaPositive
                            icon={<Target className="h-4 w-4" />}
                        />
                        <KpiCard
                            label="Cost Saved"
                            value={`$${kpis.cost_saved.toLocaleString()}`}
                            delta="vs. Flag None"
                            deltaPositive
                            icon={<DollarSign className="h-4 w-4" />}
                        />
                    </>
                )}
            </div>

            {/* Fraud Rate Time Series Line Chart */}
            <FraudRateChart data={timeseries ?? []} loading={!timeseries} />

            {/* Type Donut + Amount Log-Distribution bar chart Side-by-Side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                <TransactionTypeDonut data={typeData ?? []} loading={!typeData} />
                <AmountDistribution data={amountData ?? []} loading={!amountData} />
            </div>
        </div>
    );
}
