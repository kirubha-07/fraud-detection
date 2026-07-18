"use client";
/**
 * app/dashboard/live-scoring/page.tsx
 * Live scoring page: paginated ranked transaction table, risk badges, filters.
 * Composed from reusable DataTable and RiskBadge components.
 */

import { useEffect, useState, useMemo } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, TransactionRecord } from "@/lib/api";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

// Reusable components
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import RiskBadge from "@/components/ui/RiskBadge";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";

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
            .then((r) => {
                setRecords(r.records);
                setTotal(r.total);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [model, threshold]);

    useEffect(() => {
        if (page === 1) return;
        api.transactions(model, threshold, page, PAGE_SIZE)
            .then((r) => {
                setRecords(r.records);
                setTotal(r.total);
            })
            .catch((e) => setError(e.message));
    }, [page]);

    const filtered = useMemo(() => {
        if (!search) return records;
        const q = search.toLowerCase();
        return records.filter(
            (r) =>
                r.type.toLowerCase().includes(q) ||
                r.risk_band.toLowerCase().includes(q) ||
                String(r.transaction_id).includes(q)
        );
    }, [records, search]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Column definitions for the DataTable component
    const columns: ColumnDef<TransactionRecord>[] = [
        {
            key: "transaction_id",
            label: "ID",
            render: (r) => <span className="font-semibold">#{r.transaction_id}</span>,
        },
        {
            key: "step",
            label: "Step",
            render: (r) => <span>Step {r.step}</span>,
        },
        {
            key: "type",
            label: "Type",
        },
        {
            key: "amount",
            label: "Amount",
            render: (r) => <span>${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
        },
        {
            key: "fraud_probability",
            label: "Score",
            render: (r) => (
                <span
                    style={{
                        color: r.fraud_probability >= threshold ? "var(--color-risk-fraud)" : "var(--color-risk-legit)",
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {r.fraud_probability.toFixed(4)}
                </span>
            ),
        },
        {
            key: "risk_band",
            label: "Risk Band",
            render: (r) => <RiskBadge band={r.risk_band} probability={r.fraud_probability} />,
        },
        {
            key: "flagged",
            label: "Decision",
            render: (r) => (
                <span
                    style={{
                        color: r.flagged ? "var(--color-risk-fraud)" : "var(--color-text-muted)",
                        fontWeight: 500,
                    }}
                >
                    {r.flagged ? "FLAGGED" : "CLEARED"}
                </span>
            ),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {/* Header */}
            <div>
                <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--color-accent-primary)" }}>
                    Live Scoring
                </h1>
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                    Active Model: <strong style={{ color: "var(--color-text-primary)" }}>{model}</strong> — Decision Threshold:{" "}
                    <strong style={{ color: "var(--color-accent-primary)" }}>{threshold.toFixed(2)}</strong> —{" "}
                    <strong style={{ color: "var(--color-text-primary)" }}>{total.toLocaleString()}</strong> processed transactions
                </p>
            </div>

            {error && <EmptyState error title="Failed to score transactions" message={error} />}

            {/* Search Filter Bar */}
            <div
                className="card"
                style={{
                    padding: "16px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <Search className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                <input
                    type="text"
                    placeholder="Filter active page by type, risk band, or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "var(--color-text-primary)",
                        fontSize: "0.875rem",
                        width: "100%",
                    }}
                />
            </div>

            {/* Main Table area */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {loading ? (
                    <div style={{ padding: 32 }}>
                        <LoadingSkeleton rows={10} height={38} />
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={filtered}
                        keyExtractor={(r) => r.transaction_id}
                        emptyMessage="No transactions match filters."
                    />
                )}
            </div>

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between" style={{ padding: "0 8px" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                        Showing page <strong style={{ color: "var(--color-text-primary)" }}>{page}</strong> of{" "}
                        <strong style={{ color: "var(--color-text-primary)" }}>{totalPages}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="card-raised flex items-center justify-center"
                            style={{
                                width: 36,
                                height: 36,
                                padding: 0,
                                border: "1px solid var(--color-border)",
                                borderRadius: 8,
                                color: page === 1 ? "var(--color-text-subtle)" : "var(--color-text-primary)",
                                cursor: page === 1 ? "default" : "pointer",
                                opacity: page === 1 ? 0.35 : 1,
                            }}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="card-raised flex items-center justify-center"
                            style={{
                                width: 36,
                                height: 36,
                                padding: 0,
                                border: "1px solid var(--color-border)",
                                borderRadius: 8,
                                color: page === totalPages ? "var(--color-text-subtle)" : "var(--color-text-primary)",
                                cursor: page === totalPages ? "default" : "pointer",
                                opacity: page === totalPages ? 0.35 : 1,
                            }}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
