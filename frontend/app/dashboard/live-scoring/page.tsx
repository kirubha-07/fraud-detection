"use client";
/**
 * app/dashboard/live-scoring/page.tsx
 * Ranked transaction table with colored risk badges, search filter, sort, and pagination.
 */

import { useEffect, useState, useMemo } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, TransactionRecord } from "@/lib/api";
import { Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

const C = { accent: "#CF9D7B", fraud: "#C46A52", legit: "#5C896B", muted: "#7A6E69", border: "#3A3534", text: "#E8DDD4" };

function RiskBadge({ band }: { band: string }) {
    const cls =
        band === "critical" ? "badge badge-critical" :
            band === "high" ? "badge badge-high" :
                band === "moderate" ? "badge badge-moderate" :
                    "badge badge-low";
    return <span className={cls}>{band}</span>;
}

function Skeleton({ rows = 10 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        height: 36, borderRadius: 6,
                        background: "linear-gradient(90deg, #1E2D35 25%, #253540 50%, #1E2D35 75%)",
                        backgroundSize: "400% 100%",
                        animation: "shimmer 1.8s infinite",
                    }}
                />
            ))}
        </div>
    );
}

const COLS: { key: keyof TransactionRecord; label: string; fmt?: (v: unknown) => string }[] = [
    { key: "transaction_id", label: "ID" },
    { key: "step", label: "Step" },
    { key: "type", label: "Type" },
    { key: "amount", label: "Amount", fmt: (v) => `$${(v as number).toLocaleString()}` },
    { key: "fraud_probability", label: "Score", fmt: (v) => (v as number).toFixed(4) },
    { key: "risk_band", label: "Risk" },
    { key: "flagged", label: "Flagged", fmt: (v) => v ? "Yes" : "No" },
];

export default function LiveScoringPage() {
    const { model, threshold } = useDashboard();
    const [records, setRecords] = useState<TransactionRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const PAGE_SIZE = 25;

    useEffect(() => {
        setLoading(true);
        setError(null);
        setPage(1);
        api.transactions(model, threshold, 1, PAGE_SIZE)
            .then((r) => { setRecords(r.records); setTotal(r.total); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [model, threshold]);

    useEffect(() => {
        if (page === 1) return;
        api.transactions(model, threshold, page, PAGE_SIZE)
            .then((r) => { setRecords(r.records); setTotal(r.total); })
            .catch((e) => setError(e.message));
    }, [page]);

    const filtered = useMemo(() => {
        if (!search) return records;
        const q = search.toLowerCase();
        return records.filter(
            (r) => r.type.toLowerCase().includes(q) || r.risk_band.toLowerCase().includes(q)
        );
    }, [records, search]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
                <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--accent)" }}>
                    Live Scoring
                </h1>
                <p style={{ color: C.muted, fontSize: "0.85rem" }}>
                    Model: <strong style={{ color: C.text }}>{model}</strong> — Threshold:{" "}
                    <strong style={{ color: C.accent }}>{threshold.toFixed(2)}</strong> — {total.toLocaleString()} transactions
                </p>
            </div>

            {error && (
                <div className="card flex items-center gap-3" style={{ borderColor: "rgba(196,106,82,0.4)", color: C.fraud }}>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Search */}
            <div
                className="card"
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}
            >
                <Search className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
                <input
                    type="text"
                    placeholder="Filter by type or risk band..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        background: "transparent", border: "none", outline: "none",
                        color: C.text, fontSize: "0.875rem", width: "100%",
                    }}
                />
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {loading ? (
                    <div style={{ padding: 24 }}><Skeleton /></div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                    {COLS.map((col) => (
                                        <th
                                            key={col.key}
                                            style={{
                                                padding: "12px 16px",
                                                textAlign: "left",
                                                color: C.muted,
                                                fontWeight: 600,
                                                fontSize: "0.72rem",
                                                letterSpacing: "0.05em",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((row, i) => (
                                    <tr
                                        key={row.transaction_id}
                                        style={{
                                            borderBottom: `1px solid ${C.border}`,
                                            background: i % 2 === 0 ? "transparent" : "rgba(30,45,53,0.4)",
                                            transition: "background 0.1s",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(207,157,123,0.05)")}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(30,45,53,0.4)")}
                                    >
                                        {COLS.map((col) => (
                                            <td key={col.key} style={{ padding: "10px 16px", color: C.text }}>
                                                {col.key === "risk_band" ? (
                                                    <RiskBadge band={row.risk_band} />
                                                ) : col.key === "fraud_probability" ? (
                                                    <span style={{ color: row.fraud_probability > 0.5 ? C.fraud : C.legit, fontWeight: 500 }}>
                                                        {row.fraud_probability.toFixed(4)}
                                                    </span>
                                                ) : col.fmt ? (
                                                    col.fmt(row[col.key])
                                                ) : (
                                                    String(row[col.key] ?? "—")
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!loading && (
                <div className="flex items-center justify-between" style={{ color: C.muted, fontSize: "0.82rem" }}>
                    <span>
                        Page {page} of {totalPages} ({total.toLocaleString()} total)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            style={{
                                background: "var(--surface-raised)", border: `1px solid ${C.border}`,
                                borderRadius: 6, padding: "6px 10px", color: C.text, cursor: "pointer",
                                opacity: page <= 1 ? 0.4 : 1,
                            }}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            style={{
                                background: "var(--surface-raised)", border: `1px solid ${C.border}`,
                                borderRadius: 6, padding: "6px 10px", color: C.text, cursor: "pointer",
                                opacity: page >= totalPages ? 0.4 : 1,
                            }}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}

            <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
        </div>
    );
}
