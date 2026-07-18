/**
 * components/ui/DataTable.tsx
 * Reusable, consistently styled table for dashboard data displays.
 * Follows spacing rules (no padding under 24px) for cards, and uses CSS variables.
 */
import { ReactNode } from "react";

export interface ColumnDef<T> {
    key: string;
    label: string;
    render?: (item: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
    columns: ColumnDef<T>[];
    data: T[];
    keyExtractor: (item: T, index: number) => string | number;
    emptyMessage?: string;
    onRowClick?: (item: T) => void;
}

export default function DataTable<T>({
    columns,
    data,
    keyExtractor,
    emptyMessage = "No records found.",
    onRowClick,
}: DataTableProps<T>) {
    return (
        <div style={{ overflowX: "auto", width: "100%" }}>
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.825rem",
                    fontFamily: "Inter, sans-serif",
                }}
            >
                <thead>
                    <tr
                        style={{
                            borderBottom: "1px solid var(--color-border)",
                            textAlign: "left",
                        }}
                    >
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                style={{
                                    padding: "16px 24px",
                                    color: "var(--color-text-muted)",
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
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                style={{
                                    padding: "32px 24px",
                                    textAlign: "center",
                                    color: "var(--color-text-muted)",
                                    fontStyle: "italic",
                                }}
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, idx) => (
                            <tr
                                key={keyExtractor(row, idx)}
                                onClick={() => onRowClick?.(row)}
                                style={{
                                    borderBottom: "1px solid var(--color-border)",
                                    background: idx % 2 === 0 ? "transparent" : "rgba(30, 45, 53, 0.3)",
                                    cursor: onRowClick ? "pointer" : "default",
                                    transition: "background 0.1s",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "rgba(207, 157, 123, 0.04)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                        idx % 2 === 0 ? "transparent" : "rgba(30, 45, 53, 0.3)";
                                }}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        style={{
                                            padding: "14px 24px",
                                            color: "var(--color-text-primary)",
                                            verticalAlign: "middle",
                                        }}
                                    >
                                        {col.render ? col.render(row, idx) : String((row as any)[col.key] ?? "—")}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
