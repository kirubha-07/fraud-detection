"use client";
/**
 * app/dashboard/overview/page.tsx
 * Overview dashboard: KPI row + fraud-rate timeseries + type donut + amount histogram.
 * All data fetched from the live FastAPI backend, respects DashboardContext.
 */

import { useEffect, useState } from "react";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { TrendingUp, Shield, DollarSign, Target, AlertCircle } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import {
    api, KPIsResponse, TimePoint, TypeBreakdownItem, AmountBin,
} from "@/lib/api";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
    accent: "#CF9D7B",
    fraud: "#C46A52",
    legit: "#5C896B",
    muted: "#7A6E69",
    border: "#3A3534",
    surface: "#1E2D35",
    text: "#E8DDD4",
};

const CHART_PROPS = {
    style: { fontFamily: "Inter, sans-serif", fontSize: 11 },
};

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton({ h = 200 }: { h?: number }) {
    return (
        <div
            style={{
                height: h,
                borderRadius: 10,
                background: "linear-gradient(90deg, #1E2D35 25%, #253540 50%, #1E2D35 75%)",
                backgroundSize: "400% 100%",
                animation: "shimmer 1.8s infinite",
            }}
        />
    );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({
    label, value, sub, icon: Icon, accent = false,
}: { label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean }) {
    return (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="flex items-center gap-2">
                <div
                    style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "rgba(207,157,123,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                >
                    <Icon className="h-4 w-4" style={{ color: accent ? C.fraud : C.accent }} />
                </div>
                <span className="kpi-label" style={{ marginBottom: 0 }}>{label}</span>
            </div>
            <div className="kpi-value">{value}</div>
            {sub && <div style={{ fontSize: "0.75rem", color: C.muted }}>{sub}</div>}
        </div>
    );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorCard({ message }: { message: string }) {
    return (
        <div
            className="card flex items-center gap-3"
            style={{ borderColor: "rgba(196,106,82,0.4)", color: C.fraud }}
        >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{message}</span>
        </div>
    );
}

export default function OverviewPage() {
    const { model, threshold, fpCost, fnCost } = useDashboard();
    const [kpis, setKpis] = useState<KPIsResponse | null>(null);
    const [timeseries, setTimeseries] = useState<TimePoint[] | null>(null);
    const [typeData, setTypeData] = useState<TypeBreakdownItem[] | null>(null);
    const [amountData, setAmountData] = useState<AmountBin[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setKpis(null);
        setError(null);
        api.kpis(model, threshold, fpCost, fnCost)
            .then(setKpis)
            .catch((e) => setError(e.message));
    }, [model, threshold, fpCost, fnCost]);

    useEffect(() => {
        api.timeseries().then((r) => setTimeseries(r.points)).catch(() => { });
        api.typeBreakdown().then((r) => setTypeData(r.items)).catch(() => { });
        api.amountDist().then((r) => setAmountData(r.bins)).catch(() => { });
    }, []);

    // Donut data
    const donutData = typeData
        ? typeData.map((d) => [
            { name: `${d.type} — Legitimate`, value: d.legitimate, color: C.legit },
            { name: `${d.type} — Fraud`, value: d.fraud, color: C.fraud },
        ]).flat().filter((d) => d.value > 0)
        : [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Page header */}
            <div>
                <h1
                    className="font-display text-2xl font-bold mb-1"
                    style={{ color: "var(--accent)" }}
                >
                    Overview
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    Model: <strong style={{ color: C.text }}>{model}</strong> — Threshold:{" "}
                    <strong style={{ color: C.accent }}>{threshold.toFixed(2)}</strong>
                </p>
            </div>

            {error && <ErrorCard message={error} />}

            {/* ── KPI Row ──────────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
                {kpis ? (
                    <>
                        <KPICard
                            label="Transactions"
                            value={kpis.total_transactions.toLocaleString()}
                            icon={Shield}
                        />
                        <KPICard
                            label="Fraud Flagged"
                            value={kpis.fraud_flagged.toLocaleString()}
                            sub={`threshold ${threshold.toFixed(2)}`}
                            icon={AlertCircle}
                            accent
                        />
                        <KPICard
                            label="Fraud Rate"
                            value={`${(kpis.fraud_rate * 100).toFixed(2)}%`}
                            icon={TrendingUp}
                        />
                        <KPICard
                            label="PR-AUC"
                            value={kpis.pr_auc.toFixed(4)}
                            sub="primary metric"
                            icon={Target}
                        />
                        <KPICard
                            label="Cost Saved"
                            value={`$${kpis.cost_saved.toLocaleString()}`}
                            sub="vs. flag-nothing"
                            icon={DollarSign}
                        />
                    </>
                ) : (
                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={110} />)
                )}
            </div>

            {/* ── Fraud rate over time ──────────────────────────────────────────── */}
            <div className="card">
                <h2 className="font-display text-base font-semibold mb-4" style={{ color: C.accent }}>
                    Fraud Rate Over Time — PaySim Steps
                </h2>
                {timeseries ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={timeseries} {...CHART_PROPS}>
                            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                            <XAxis dataKey="step" stroke={C.muted} tick={{ fill: C.muted }} />
                            <YAxis
                                stroke={C.muted}
                                tick={{ fill: C.muted }}
                                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "#162127", border: `1px solid ${C.border}`,
                                    borderRadius: 8, color: C.text,
                                }}
                                formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "Fraud Rate"]} // eslint-disable-line @typescript-eslint/no-explicit-any
                            />
                            <Line
                                type="monotone"
                                dataKey="fraud_rate"
                                stroke={C.fraud}
                                strokeWidth={1.5}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <Skeleton h={220} />
                )}
            </div>

            {/* ── Type donut + Amount histogram ─────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Type Donut */}
                <div className="card">
                    <h2 className="font-display text-base font-semibold mb-4" style={{ color: C.accent }}>
                        Transaction Types — Fraud vs Legitimate
                    </h2>
                    {typeData ? (
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
                                        background: "#162127", border: `1px solid ${C.border}`,
                                        borderRadius: 8, color: C.text,
                                    }}
                                    formatter={(v: number) => [v.toLocaleString(), ""]}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: "11px", color: C.muted }}
                                    iconSize={8}
                                    iconType="circle"
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <Skeleton h={240} />
                    )}
                </div>

                {/* Amount histogram */}
                <div className="card">
                    <h2 className="font-display text-base font-semibold mb-4" style={{ color: C.accent }}>
                        Amount Distribution — log₁₀ scale
                    </h2>
                    {amountData ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart
                                data={amountData}
                                {...CHART_PROPS}
                                barGap={0}
                            >
                                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="log_lower"
                                    stroke={C.muted}
                                    tick={{ fill: C.muted }}
                                    tickFormatter={(v) => v.toFixed(1)}
                                    label={{ value: "log₁₀(amount)", position: "insideBottom", fill: C.muted, dy: 12, fontSize: 11 }}
                                />
                                <YAxis stroke={C.muted} tick={{ fill: C.muted }} />
                                <Tooltip
                                    contentStyle={{
                                        background: "#162127", border: `1px solid ${C.border}`,
                                        borderRadius: 8, color: C.text,
                                    }}
                                    formatter={(v: number, name: string) => [v.toLocaleString(), name === "legitimate_count" ? "Legitimate" : "Fraud"]}
                                />
                                <Bar dataKey="legitimate_count" fill={C.legit} opacity={0.7} name="Legitimate" />
                                <Bar dataKey="fraud_count" fill={C.fraud} opacity={0.85} name="Fraud" />
                                <Legend wrapperStyle={{ fontSize: "11px", color: C.muted }} iconSize={8} iconType="circle" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <Skeleton h={240} />
                    )}
                </div>
            </div>

        </div>
    );
}
