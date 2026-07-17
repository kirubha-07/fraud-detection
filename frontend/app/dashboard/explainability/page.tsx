"use client";
/**
 * app/dashboard/explainability/page.tsx
 * Global SHAP importance (horizontal bar) + local waterfall explanation
 * for a selected transaction from the live backend.
 */

import { useEffect, useState } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Cell,
} from "recharts";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, ShapGlobalItem, ShapLocalItem, ShapLocalResponse } from "@/lib/api";
import { AlertCircle } from "lucide-react";

const C = { accent: "#CF9D7B", fraud: "#C46A52", legit: "#5C896B", muted: "#7A6E69", border: "#3A3534", text: "#E8DDD4", surface: "#162127" };

function Skeleton({ h = 200 }: { h?: number }) {
    return (
        <div
            style={{
                height: h, borderRadius: 10,
                background: "linear-gradient(90deg, #1E2D35 25%, #253540 50%, #1E2D35 75%)",
                backgroundSize: "400% 100%",
                animation: "shimmer 1.8s infinite",
            }}
        />
    );
}

export default function ExplainabilityPage() {
    const { model } = useDashboard();
    const [global_, setGlobal] = useState<ShapGlobalItem[] | null>(null);
    const [globalLoading, setGlobalLoading] = useState(true);
    const [globalError, setGlobalError] = useState<string | null>(null);

    // Local explanation
    const [txnId, setTxnId] = useState<number>(0);
    const [local, setLocal] = useState<ShapLocalResponse | null>(null);
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Load global SHAP when model changes
    useEffect(() => {
        setGlobal(null);
        setGlobalLoading(true);
        setGlobalError(null);
        api.shapGlobal(model, 200)
            .then((r) => setGlobal(r.items))
            .catch((e) => setGlobalError(e.message))
            .finally(() => setGlobalLoading(false));
    }, [model]);

    // Load local SHAP on demand
    function fetchLocal() {
        setLocal(null);
        setLocalLoading(true);
        setLocalError(null);
        api.shapLocal(model, txnId)
            .then(setLocal)
            .catch((e) => setLocalError(e.message))
            .finally(() => setLocalLoading(false));
    }

    // Waterfall: each feature's shap_value as a bar, sorted by abs value
    const waterfallData = local?.items ?? [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
                <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--accent)" }}>
                    Explainability
                </h1>
                <p style={{ color: C.muted, fontSize: "0.85rem" }}>
                    SHAP values for model: <strong style={{ color: C.text }}>{model}</strong>
                </p>
            </div>

            {/* ── Global SHAP ──────────────────────────────────────────────────── */}
            <div className="card">
                <h2 className="font-display text-base font-semibold mb-1" style={{ color: C.accent }}>
                    Global Feature Importance — mean |SHAP|
                </h2>
                <p style={{ fontSize: "0.75rem", color: C.muted, marginBottom: 16 }}>
                    Computed on a 200-row sample of the test set. Tree-based SHAP values.
                </p>

                {globalError && (
                    <div className="flex items-center gap-2 text-sm mb-4" style={{ color: C.fraud }}>
                        <AlertCircle className="h-4 w-4" /> {globalError}
                    </div>
                )}

                {globalLoading ? (
                    <Skeleton h={380} />
                ) : global_ ? (
                    <ResponsiveContainer width="100%" height={Math.max(300, global_.length * 22)}>
                        <BarChart
                            layout="vertical"
                            data={[...global_].reverse()}
                            style={{ fontFamily: "Inter", fontSize: 11 }}
                            margin={{ left: 150, right: 32 }}
                        >
                            <CartesianGrid horizontal={false} stroke={C.border} strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                stroke={C.muted}
                                tick={{ fill: C.muted }}
                                tickFormatter={(v: number) => v.toFixed(3)}
                                label={{ value: "mean |SHAP|", position: "insideBottom", fill: C.muted, dy: 14, fontSize: 11 }}
                            />
                            <YAxis
                                type="category"
                                dataKey="feature"
                                stroke={C.muted}
                                tick={{ fill: C.text, fontSize: 11 }}
                                width={145}
                            />
                            <Tooltip
                                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}
                                formatter={(v: number) => [v.toFixed(5), "mean |SHAP|"]}
                            />
                            <Bar dataKey="mean_abs_shap" radius={[0, 4, 4, 0]}>
                                {[...global_].reverse().map((entry, i) => {
                                    const max = global_[0]?.mean_abs_shap ?? 1;
                                    const ratio = entry.mean_abs_shap / max;
                                    const r = Math.round(207 * ratio + 92 * (1 - ratio));
                                    const g = Math.round(157 * ratio + 137 * (1 - ratio));
                                    const b = Math.round(123 * ratio + 107 * (1 - ratio));
                                    return <Cell key={i} fill={`rgb(${r},${g},${b})`} opacity={0.85} />;
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : null}
            </div>

            {/* ── Local SHAP ───────────────────────────────────────────────────── */}
            <div className="card">
                <h2 className="font-display text-base font-semibold mb-1" style={{ color: C.accent }}>
                    Local Transaction Explanation
                </h2>
                <p style={{ fontSize: "0.75rem", color: C.muted, marginBottom: 16 }}>
                    SHAP waterfall for a single transaction. Red bars increase fraud probability; green bars decrease it.
                </p>

                {/* Transaction selector */}
                <div className="flex items-center gap-3 mb-5">
                    <label style={{ fontSize: "0.82rem", color: C.muted, whiteSpace: "nowrap" }}>
                        Transaction ID (0–33182):
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={33182}
                        value={txnId}
                        onChange={(e) => setTxnId(Number(e.target.value))}
                        style={{
                            background: "var(--surface-raised)", border: `1px solid ${C.border}`,
                            borderRadius: 8, color: C.text, padding: "6px 10px",
                            fontSize: "0.85rem", width: 120, outline: "none",
                        }}
                    />
                    <button
                        onClick={fetchLocal}
                        disabled={localLoading}
                        style={{
                            background: "rgba(207,157,123,0.15)", border: `1px solid ${C.accent}`,
                            borderRadius: 8, color: C.accent, padding: "6px 16px",
                            fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                            opacity: localLoading ? 0.5 : 1,
                        }}
                    >
                        {localLoading ? "Computing..." : "Explain"}
                    </button>
                </div>

                {localError && (
                    <div className="flex items-center gap-2 text-sm mb-4" style={{ color: C.fraud }}>
                        <AlertCircle className="h-4 w-4" /> {localError}
                    </div>
                )}

                {local && (
                    <div
                        style={{
                            padding: "12px 16px", borderRadius: 8, marginBottom: 16,
                            background: "rgba(207,157,123,0.08)", border: `1px solid rgba(207,157,123,0.2)`
                        }}
                    >
                        <span style={{ fontSize: "0.8rem", color: C.muted }}>Fraud probability: </span>
                        <span
                            style={{
                                fontFamily: "Playfair Display, serif", fontSize: "1.4rem", fontWeight: 700,
                                color: local.fraud_probability > 0.5 ? C.fraud : C.legit,
                            }}
                        >
                            {local.fraud_probability.toFixed(4)}
                        </span>
                        <span style={{ fontSize: "0.8rem", color: C.muted, marginLeft: 16 }}>
                            Base value: {local.base_value.toFixed(4)}
                        </span>
                    </div>
                )}

                {localLoading ? (
                    <Skeleton h={320} />
                ) : waterfallData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(280, waterfallData.length * 26)}>
                        <BarChart
                            layout="vertical"
                            data={waterfallData}
                            style={{ fontFamily: "Inter", fontSize: 11 }}
                            margin={{ left: 180, right: 60 }}
                        >
                            <CartesianGrid horizontal={false} stroke={C.border} strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                stroke={C.muted}
                                tick={{ fill: C.muted }}
                                tickFormatter={(v: number) => v > 0 ? `+${v.toFixed(3)}` : v.toFixed(3)}
                                label={{ value: "SHAP value", position: "insideBottom", fill: C.muted, dy: 14, fontSize: 11 }}
                            />
                            <YAxis
                                type="category"
                                dataKey="feature"
                                stroke={C.muted}
                                tick={{ fill: C.text, fontSize: 11 }}
                                width={175}
                            />
                            <Tooltip
                                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}
                                formatter={(v: number, name: string, props: { payload?: ShapLocalItem }) => {
                                    const item = props.payload;
                                    return [
                                        `SHAP: ${v > 0 ? "+" : ""}${v.toFixed(5)}\nValue: ${item?.value?.toFixed(4) ?? ""}`,
                                        item?.feature ?? "",
                                    ];
                                }}
                            />
                            <Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>
                                {waterfallData.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={entry.shap_value >= 0 ? C.fraud : C.legit}
                                        opacity={Math.max(0.4, Math.min(1, Math.abs(entry.shap_value) / (Math.abs(waterfallData[0]?.shap_value ?? 1)) + 0.3))}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    !local && (
                        <div style={{ textAlign: "center", color: C.muted, fontSize: "0.85rem", padding: "32px 0" }}>
                            Enter a transaction ID and click Explain to see the SHAP breakdown.
                        </div>
                    )
                )}
            </div>

        </div>
    );
}
