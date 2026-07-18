/**
 * components/ui/EmptyState.tsx
 * Consistent empty / error state with icon, title, and optional message.
 */
import { AlertCircle, ServerCrash } from "lucide-react";

interface EmptyStateProps {
    title: string;
    message?: string;
    error?: boolean;
}

export default function EmptyState({ title, message, error = false }: EmptyStateProps) {
    const Icon = error ? ServerCrash : AlertCircle;
    return (
        <div
            className="card flex flex-col items-center justify-center gap-4 text-center"
            style={{ minHeight: 200, padding: "48px 32px" }}
        >
            <Icon
                className="h-10 w-10"
                style={{ color: error ? "var(--color-risk-fraud)" : "var(--color-text-muted)" }}
            />
            <div>
                <div
                    className="font-display text-base font-semibold mb-1"
                    style={{ color: error ? "var(--color-risk-fraud)" : "var(--color-text-primary)" }}
                >
                    {title}
                </div>
                {message && (
                    <div className="text-sm" style={{ color: "var(--color-text-muted)", maxWidth: 420 }}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}
