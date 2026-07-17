"use client";
/**
 * app/dashboard/layout.tsx
 * Persistent sidebar + main content area for all dashboard pages.
 */

import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
            <Sidebar />
            <main className="flex-1 overflow-y-auto" style={{ padding: "32px 36px" }}>
                {children}
            </main>
        </div>
    );
}
