"use client";
/**
 * components/Sidebar.tsx
 * Persistent sidebar for all dashboard pages.
 * Reads/writes DashboardContext — model/threshold changes propagate to all pages.
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
            .then((r) => setModels(r.models.filter((m) => m.has_artifact)))
            .catch(() => { });
    }, []);

    return (
        <aside
            className="flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto"
            style={{
                width: "240px",
                background: "var(--surface)",
                borderRight: "1px solid var(--border)",
                padding: "24px 16px",
            }}
        >
            {/* Logo */}
            <div className="mb-8">
                <div
                    className="font-display text-xl font-bold mb-1"
                    style={{ color: "var(--accent)" }}
                >
                    FraudOps
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Analytics Platform
                </div>
            </div>

            {/* Back to home */}
            <Link
                href="/"
                className="nav-item mb-1"
                style={{ fontSize: "0.78rem" }}
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Home
            </Link>

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

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

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--border)", margin: "0 0 16px" }} />

            {/* ── Model ──────────────────────────────────────────────────────── */}
            <div className="mb-5">
                <div className="section-title mb-2">Model</div>
                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{
                        width: "100%",
                        background: "var(--surface-raised)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--text)",
                        padding: "8px 10px",
                        fontSize: "0.85rem",
                        outline: "none",
                    }}
                >
                    {models.length === 0 && (
                        <option value="xgboost">xgboost</option>
                    )}
                    {models.map((m) => (
                        <option key={m.name} value={m.name}>
                            {m.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ── Threshold ──────────────────────────────────────────────────── */}
            <div className="mb-5">
                <div className="section-title mb-2">
                    Threshold
                    <span
                        className="ml-2 font-mono"
                        style={{ color: "var(--accent)", fontFamily: "inherit" }}
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
                    style={{ width: "100%", accentColor: "var(--accent)" }}
                />
                <div
                    className="flex justify-between text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                >
                    <span>0.01</span><span>0.99</span>
                </div>
            </div>

            {/* ── Cost params (collapsible) ───────────────────────────────────── */}
            <button
                onClick={() => setCostOpen((o) => !o)}
                className="flex items-center justify-between w-full text-left"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
                <span className="section-title" style={{ margin: 0 }}>Cost Parameters</span>
                {costOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                )}
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
            <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
            <input
                type="number"
                min={0}
                step={10}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{
                    width: "100%",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--text)",
                    padding: "6px 8px",
                    fontSize: "0.85rem",
                    outline: "none",
                }}
            />
        </div>
    );
}
