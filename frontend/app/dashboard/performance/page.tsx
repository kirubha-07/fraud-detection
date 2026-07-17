"use client";
/**
 * app/dashboard/performance/page.tsx
 * Model comparison table, overlaid ROC + PR curves, confusion matrix heatmap,
 * and cost-vs-threshold curve — all from the live backend.
 */

import { useEffect, useState } from "react";
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Legend, ReferenceArea, ReferenceLine,
} from "recharts";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, MetricsResponse, ModelCurves, CostCurveResponse } from "@/lib/api";
import { AlertCircle } from "lucide-react";

const C = { accent: "#CF9D7B", fraud: "#C46A52", legit: "#5C896B", muted: "#7A6E69", border: "#3A3534", text: "#E8DDD4", surface: "#162127" };

// Distinct colours per model, all warm-palette-safe
const MODEL_COLORS: Record<string, string> = {
    xgboost: "#CF9D7B",
    random_forest: "#5C896B",
    logistic_regression: "#C46A52",
    isolation_forest: "#724B39",
};
function modelColor(name: string) { return MODEL_COLORS[name] ?? "#A89A93"; }

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

const ALL_MODELS = ["xgboost", "random_forest", "logistic_regression", "isolation_forest"];
const METRIC_COLS = ["pr_auc", "roc_auc", "precision", "recall", "f1"] as const;

function MetricCell({ value }: { value: number }) {
    // Colour-scale: 0.0 (warm dim) → 1.0 (accent bright)
    const alpha = Math.max(0.15, value);
    const bg = `rgba(207,157,123,${alpha * 0.35})`;
    const color = value >= 0.9 ? C.accent : value >= 0.6 ? C.text : C.muted;
    return (
        <td
            style={{
                padding: "10px 14px", textAlign: "right",
                fontFamily: "Inter, sans-serif", fontSize: "0.82rem",
                background: bg, color,
            }}
        >
            {value.toFixed(4)}
        </td>
    );
}

export default function PerformancePage() {
    const { model, threshold, fpCost, fnCost } = useDashboard();
    const [allMetrics, setAllMetrics] = useState<Record<string, MetricsResponse>>({});
    const [curves, setCurves] = useState<ModelCurves[]>([]);
    const [costCurve, setCostCurve] = useState<CostCurveResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load metrics for all models
        Promise.allSettled(ALL_MODELS.map((n) => api.metrics(n).then((m) => [n, m] as [string, MetricsResponse])))
            .then((results) => {
                const map: Record<string, MetricsResponse> = {};
                results.forEach((r) => { if (r.status === "fulfilled") map[r.value[0]] = r.value[1]; });
                setAllMetrics(map);
            });

        // ROC + PR curves for all
        api.allCurves().then((r) => setCurves(r.curves)).catch(() => { });

        setLoading(false);
    }, []);

    useEffect(() => {
        api.costCurve(model, fpCost, fnCost)
            .then(setCostCurve)
            .catch(() => { });
    }, [model, fpCost, fnCost]);

    // Confusion matrix for selected model
    const cm = allMetrics[model]?.confusion_matrix ?? null;

    // Recharts data for curves
    const rocData = curves.map((c) =>
        c.roc.map((pt) => ({ x: pt.x, [c.model]: pt.y }))
    );
    // Merge all model ROC points by index (curves have same length post-downsampling)
    const mergedRoc = curves.length > 0
        ? curves[0].roc.map((pt, i) => {
            const row: Record<string, number> = { x: pt.x };
            curves.forEach((c) => { row[c.model] = c.roc[i]?.y ?? 0; });
            return row;
        })
        : [];
    const mergedPr = curves.length > 0
        ? curves[0].pr.map((pt, i) => {
            const row: Record<string, number> = { x: pt.x };
            curves.forEach((c) => { row[c.model] = c.pr[i]?.y ?? 0; });
            return row;
        })
        : [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
                <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--accent)" }}>
                    Model Performance
                </h1>
                <p style={{ color: C.muted, fontSize: "0.85rem" }}>Active: <strong style={{ color: C.text }}>{model}</strong></p>
            </div>

            {/* ── Model comparison table ─────────────────────────────────────── */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
                    <h2 className="font-display text-base font-semibold" style={{ color: C.accent }}>
                        Model Comparison
                    </h2>
                    <p style={{ fontSize: "0.75rem", color: C.muted, marginTop: 2 }}>
                        Cell colour = metric magnitude. From saved evaluation JSONs.
                    </p>
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Model</th>
                                {METRIC_COLS.map((k) => (
                                    <th key={k} style={{ padding: "10px 14px", textAlign: "right", color: C.muted, fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                        {k.replace("_", "-").toUpperCase()}
                                    </th>
                                ))}
                                <th style={{ padding: "10px 14px", textAlign: "right", color: C.muted, fontSize: "0.72rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Threshold</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ALL_MODELS.map((name) => {
                                const m = allMetrics[name];
                                if (!m) return (
                                    <tr key={name} style={{ borderBottom: `1px solid ${C.border}` }}>
                                        <td style={{ padding: "10px 14px", color: C.muted, fontStyle: "italic" }}>{name}</td>
                                        <td colSpan={6} style={{ padding: "10px 14px", color: C.muted, fontSize: "0.78rem" }}>No artifact</td>
                                    </tr>
                                );
                                return (
                                    <tr key={name} style={{ borderBottom: `1px solid ${C.border}`, background: name === model ? "rgba(207,157,123,0.04)" : "transparent" }}>
                                        <td style={{ padding: "10px 14px", fontWeight: 600, color: name === model ? C.accent : C.text }}>
                                            {name}{name === model ? " ✓" : ""}
                                        </td>
                                        {METRIC_COLS.map((k) => <MetricCell key={k} value={m[k as keyof MetricsResponse] as number} />)}
                                        <td style={{ padding: "10px 14px", textAlign: "right", color: C.muted, fontSize: "0.82rem" }}>
                                            {m.threshold.toFixed(3)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── ROC + PR curves ───────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div className="card">
                    <h2 className="font-display text-base font-semibold mb-4" style={{ color: C.accent }}>
                        ROC Curves — All Models
                    </h2>
                    {mergedRoc.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={mergedRoc} style={{ fontFamily: "Inter", fontSize: 11 }}>
                                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                                <XAxis dataKey="x" stroke={C.muted} tick={{ fill: C.muted }} tickFormatter={(v) => v.toFixed(1)} label={{ value: "FPR", position: "insideBottom", fill: C.muted, dy: 14, fontSize: 11 }} />
                                <YAxis stroke={C.muted} tick={{ fill: C.muted }} label={{ value: "TPR", angle: -90, position: "insideLeft", fill: C.muted, dx: -10, fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} formatter={(v: number) => v.toFixed(3)} />
                                <Legend wrapperStyle={{ fontSize: "11px", color: C.muted }} iconSize={8} />
                                {curves.map((c) => (
                                    <Line key={c.model} type="monotone" dataKey={c.model} stroke={modelColor(c.model)} strokeWidth={2} dot={false} name={`${c.model} (${c.roc_auc.toFixed(3)})`} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <Skeleton h={240} />}
                </div>

                <div className="card">
                    <h2 className="font-display text-base font-semibold mb-4" style={{ color: C.accent }}>
                        Precision-Recall Curves — All Models
                    </h2>
                    {mergedPr.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={mergedPr} style={{ fontFamily: "Inter", fontSize: 11 }}>
                                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                                <XAxis dataKey="x" stroke={C.muted} tick={{ fill: C.muted }} tickFormatter={(v) => v.toFixed(1)} label={{ value: "Recall", position: "insideBottom", fill: C.muted, dy: 14, fontSize: 11 }} />
                                <YAxis stroke={C.muted} tick={{ fill: C.muted }} label={{ value: "Precision", angle: -90, position: "insideLeft", fill: C.muted, dx: -10, fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} formatter={(v: number) => v.toFixed(3)} />
                                <Legend wrapperStyle={{ fontSize: "11px", color: C.muted }} iconSize={8} />
                                {curves.map((c) => (
                                    <Line key={c.model} type="monotone" dataKey={c.model} stroke={modelColor(c.model)} strokeWidth={2} dot={false} name={`${c.model} (${c.pr_auc.toFixed(3)})`} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <Skeleton h={240} />}
                </div>
            </div>

            {/* ── Confusion matrix + Cost curve ─────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Confusion matrix */}
                <div className="card">
                    <h2 className="font-display text-base font-semibold mb-4" style={{ color: C.accent }}>
                        Confusion Matrix — {model}
                    </h2>
                    {cm ? (
                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 4, maxWidth: 280 }}>
                            <div />
                            {["Pred: Legit", "Pred: Fraud"].map((l) => (
                                <div key={l} style={{ textAlign: "center", fontSize: "0.72rem", color: C.muted, fontWeight: 600, padding: "4px 0" }}>{l}</div>
                            ))}
                            {["Actual: Legit", "Actual: Fraud"].map((rowLabel, ri) => (
                                [
                                    <div key={rowLabel} style={{ display: "flex", alignItems: "center", fontSize: "0.72rem", color: C.muted, fontWeight: 600, paddingRight: 8 }}>{rowLabel}</div>,
                                    ...cm[ri].map((val, ci) => {
                                        const isCorrect = ri === ci;
                                        const alpha = Math.min(1, val / (cm.flat().reduce((a, b) => Math.max(a, b), 1)));
                                        const bg = isCorrect
                                            ? `rgba(92,137,107,${0.15 + alpha * 0.4})`
                                            : `rgba(196,106,82,${0.1 + alpha * 0.35})`;
                                        return (
                                            <div
                                                key={ci}
                                                style={{
                                                    textAlign: "center", padding: "16px 8px",
                                                    borderRadius: 8, background: bg,
                                                    fontSize: "1rem", fontWeight: 700,
                                                    color: isCorrect ? C.legit : C.fraud,
                                                    fontFamily: "Playfair Display, serif",
                                                }}
                                            >
                                                {val.toLocaleString()}
                                            </div>
                                        );
                                    })
                                ]
                            ))}
                        </div>
                    ) : <Skeleton h={180} />}
                </div>

                {/* Cost curve */}
                <div className="card">
                    <h2 className="font-display text-base font-semibold mb-4" style={{ color: C.accent }}>
                        Cost vs Threshold — {model}
                    </h2>
                    {costCurve ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={costCurve.points} style={{ fontFamily: "Inter", fontSize: 11 }}>
                                <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                                <XAxis dataKey="threshold" stroke={C.muted} tick={{ fill: C.muted }} tickFormatter={(v) => v.toFixed(2)} label={{ value: "Threshold", position: "insideBottom", fill: C.muted, dy: 14, fontSize: 11 }} />
                                <YAxis stroke={C.muted} tick={{ fill: C.muted }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }}
                                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Total Cost"]}
                                    labelFormatter={(l) => `Threshold: ${Number(l).toFixed(3)}`}
                                />
                                <Line type="monotone" dataKey="cost" stroke={C.accent} strokeWidth={2} dot={false} name="Total Cost" />
                                <ReferenceLine
                                    x={costCurve.optimal_threshold}
                                    stroke={C.legit}
                                    strokeDasharray="4 4"
                                    label={{ value: `Optimal ${costCurve.optimal_threshold.toFixed(3)}`, fill: C.legit, fontSize: 10, position: "top" }}
                                />
                                <ReferenceLine
                                    x={threshold}
                                    stroke={C.accent}
                                    strokeDasharray="4 4"
                                    label={{ value: `Selected ${threshold.toFixed(3)}`, fill: C.accent, fontSize: 10, position: "insideTopLeft" }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <Skeleton h={220} />}
                </div>
            </div>

            <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
        </div>
    );
}
