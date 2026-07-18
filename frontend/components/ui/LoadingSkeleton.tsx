/**
 * components/ui/LoadingSkeleton.tsx
 * Shimmer skeleton placeholder for any loading state.
 * Reads @keyframes shimmer from globals.css.
 */

interface LoadingSkeletonProps {
    rows?: number;
    height?: number;
    className?: string;
}

export default function LoadingSkeleton({ rows = 4, height = 40, className }: LoadingSkeletonProps) {
    return (
        <div className={`flex flex-col gap-3 ${className ?? ""}`}>
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        height,
                        borderRadius: 8,
                        background: "linear-gradient(90deg, var(--color-surface) 25%, var(--color-surface-raised) 50%, var(--color-surface) 75%)",
                        backgroundSize: "400% 100%",
                        animation: "shimmer 1.8s infinite",
                        opacity: 1 - i * 0.1,
                    }}
                />
            ))}
        </div>
    );
}
