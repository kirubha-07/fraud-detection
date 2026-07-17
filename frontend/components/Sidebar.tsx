"use client";
/**
 * components/Sidebar.tsx
 * Persistent sidebar for all dashboard pages.
 *
 * Models with saved .joblib artifacts (xgboost, random_forest) are fully
 * selectable. Models with metrics-only (logistic_regression, isolation_forest)
 * appear disabled with an "(metrics only)" note — selecting them would cause
 * live-scoring endpoints to fail since there's no artifact to score with.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    LayoutDashboard,
    Table2,
    LineChart,
    BrainCircuit,
    ChevronDown,
    ChevronRight,
    ArrowLeft,
    Lock,
} from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, ModelInfo } from "@/lib/api";

const NAV = [
    { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/live-scoring", label: "Live Scoring", icon: Table2 },
    { href: "/dashboard/performance", label: "Performance", icon: LineChart },
    { href: "/dashboard/explainability", label: "Explainability", icon: BrainCircuit },
];

export default function Sidebar() {
    const path = usePathname();
    const { model, threshold, fpCost, fnCost, setModel, setThreshold, setFpCost, setFnCost } =
        useDashboard();

    const [models, setModels] = useState<ModelInfo[]>([]);
    const [costOpen, setCostOpen] = useState(false);

    useEffect(() => {
        api.models()
            .then((r) => setModels(r.models))
            .catch(() => { });
    }, []);

    // Separate models that have a scoring artifact from metrics-only ones
    const scoringModels = models.filter((m) => m.has_artifact);
    const metricsOnlyModels = models.filter((m) => !m.has_artifact);

    return (
        <aside
            className="flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto"
            style={{
                width: "248px",
                background: "var(--color-surface)",
                borderRight: "1px solid var(--color-border)",
                padding: "24px 16px",
            }}
        >
            {/* Logo */}
            <div className="mb-8">
                <div
                    className="font-display text-xl font-bold mb-1"
                    style={{ color: "var(--color-accent-primary)" }}
                >
                    FraudOps
                </div>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Analytics Platform
                </div>
            </div>

            {/* Back to home */}
            <Link href="/" className="nav-item mb-1" style={{ fontSize: "0.78rem" }}>
                <ArrowLeft className="h-4 w-4" />
                Home
            </Link>

            <div style={{ borderTop: "1px solid var(--color-border)", margin: "12px 0" }} />

            {/* Navigation */}
            <nav className="flex flex-col gap-1 mb-6">
                {NAV.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={`nav-item${path === href ? " active" : ""}`}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                    </Link>
                ))}
            </nav>

            <div style={{ borderTop: "1px solid var(--color-border)", margin: "0 0 16px" }} />

            {/* ── Model selector ─────────────────────────────────────────────── */}
            <div className="mb-5">
                <div className="section-title mb-2">Model</div>

                {/* Selectable models with artifact */}
                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{
                        width: "100%",
                        background: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        color: "var(--color-text-primary)",
                        padding: "8px 10px",
                        fontSize: "0.85rem",
                        outline: "none",
                    }}
                >
                    {scoringModels.length === 0 && (
                        <>
                            <option value="xgboost">xgboost</option>
                            <option value="random_forest">random_forest</option>
                        </>
                    )}
                    {scoringModels.map((m) => (
                        <option key={m.name} value={m.name}>
                            {m.name}
                        </option>
                    ))}
                </select>

                {/* Metrics-only models — shown as disabled info, not selectable */}
                {metricsOnlyModels.length > 0 && (
                    <div className="mt-3" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {metricsOnlyModels.map((m) => (
                            <div
                                key={m.name}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "6px 10px",
                                    borderRadius: 6,
                                    border: "1px solid var(--color-border)",
                                    opacity: 0.5,
                                }}
                            >
                                <Lock className="h-3 w-3 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {m.name}
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--color-text-muted)" }}>
                                        metrics only — no artifact
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Threshold ──────────────────────────────────────────────────── */}
            <div className="mb-5">
                <div className="section-title mb-2">
                    Threshold
                    <span
                        className="ml-2"
                        style={{ color: "var(--color-accent-primary)", fontVariantNumeric: "tabular-nums" }}
                    >
                        {threshold.toFixed(2)}
                    </span>
                </div>
                <input
                    type="range"
                    min={0.01}
                    max={0.99}
                    step={0.01}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--color-accent-primary)" }}
                />
                <div
                    className="flex justify-between text-xs mt-1"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    <span>0.01</span>
                    <span>0.99</span>
                </div>
            </div>

            {/* ── Cost params (collapsible) ───────────────────────────────────── */}
            <button
                onClick={() => setCostOpen((o) => !o)}
                className="flex items-center justify-between w-full text-left"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
                <span className="section-title" style={{ margin: 0 }}>Cost Parameters</span>
                {costOpen
                    ? <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
                    : <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
                }
            </button>
            {costOpen && (
                <div className="mt-3 flex flex-col gap-3">
                    <CostInput label="FP Cost ($/txn)" value={fpCost} onChange={setFpCost} />
                    <CostInput label="FN Cost ($/fraud)" value={fnCost} onChange={setFnCost} />
                </div>
            )}
        </aside>
    );
}

function CostInput({
    label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>{label}</div>
            <input
                type="number"
                min={0}
                step={10}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{
                    width: "100%",
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    color: "var(--color-text-primary)",
                    padding: "6px 8px",
                    fontSize: "0.85rem",
                    outline: "none",
                }}
            />
        </div>
    );
}
