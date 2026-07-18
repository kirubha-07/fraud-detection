import { api, StoryStatsResponse } from "@/lib/api";
import Link from "next/link";
import { ArrowRight, ChevronRight, TrendingUp, Shield, Database, Settings, BarChart3 } from "lucide-react";

/**
 * Homepage — hero + live stats + pipeline + CTA
 * All content wrapped inside structural max-width containers.
 * Uses exact Design System variables and fully shadowed cards.
 */

async function getStats(): Promise<StoryStatsResponse | null> {
  try {
    return await api.storyStats();
  } catch {
    return null;
  }
}

const PIPELINE_STEPS = [
  {
    icon: Database,
    title: "Raw Data Source",
    desc: "PaySim mobile-money transactions partitioned to 500k stratified test records",
  },
  {
    icon: Settings,
    title: "Feature Engineering",
    desc: "Reconciliation discrepancy flags, account transaction patterns, & amount ratios",
  },
  {
    icon: TrendingUp,
    title: "Model Pipeline",
    desc: "Training tree ensembles (XGBoost, RF) and anomaly bounds (Isolation Forest)",
  },
  {
    icon: Shield,
    title: "Loss Minimisation",
    desc: "Cost-optimal curve tuning: false negative penalty ($500) vs. false positive ($50)",
  },
  {
    icon: BarChart3,
    title: "Live Operations",
    desc: "Real-time verification dashboard with metrics, live table scoring, & SHAP explainability",
  },
];

export default async function HomePage() {
  const stats = await getStats();

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-bg)", color: "var(--color-text-primary)" }}
    >
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center py-24 text-center overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(207,157,123,0.12) 0%, transparent 70%)",
        }}
      >
        {/* Subtle animated glow ring */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            style={{
              width: "600px",
              height: "600px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(207,157,123,0.06) 0%, transparent 70%)",
              animation: "pulse 6s ease-in-out infinite",
            }}
          />
        </div>

        {/* Outer Max-Width Wrap */}
        <div className="max-w-6xl mx-auto px-8 w-full flex flex-col items-center relative z-10">
          {/* Badge */}
          <span
            className="mb-8 inline-block text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-accent-primary)",
              background: "rgba(207,157,123,0.06)",
              letterSpacing: "0.14em",
            }}
          >
            Fintech Security Analytics — FraudOps Audit
          </span>

          {/* Cohesive Headline */}
          <h1
            className="font-display text-5xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            FraudOps <span style={{ color: "var(--color-accent-primary)" }}>Analytics Platform</span>
          </h1>

          <p
            className="max-w-2xl text-base md:text-lg leading-relaxed mb-10"
            style={{ color: "var(--color-text-muted)" }}
          >
            A high-performance decision intelligence system designed to minimize operational loss.
            Compare production models, inspect SHAP waterfall curves, and optimize transaction flags.
          </p>

          <Link href="/dashboard/overview" className="btn-primary text-sm flex items-center gap-2">
            Open Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Live numbers/stats section ────────────────────────────── */}
      <section className="py-20" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="max-w-6xl mx-auto px-8 w-full">
          <p className="section-title text-center mb-10">Live System Metrics</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard
              label="Filtered Transactions"
              value={stats ? stats.total_transactions.toLocaleString() : "500,000"}
              sub="Stratified Test Partition"
            />
            <StatCard
              label="Overall Fraud Rate"
              value={stats ? `${(stats.overall_fraud_rate * 100).toFixed(3)}%` : "0.164%"}
              sub="Real PaySim Distribution"
            />
            <StatCard
              label="Models Evaluated"
              value="4"
              sub="XGBoost, RF, LR, Anomaly"
            />
            <StatCard
              label="Primary Benchmark"
              value="0.9416*"
              sub="*XGBoost PR-AUC Peak"
            />
          </div>
          {!stats && (
            <p
              className="text-center text-xs mt-6"
              style={{ color: "var(--color-risk-fraud)" }}
            >
              Backend API offline · Showing cached initialization baseline metrics.
            </p>
          )}
        </div>
      </section>

      {/* ── Pipeline: How it works section ───────────────────────── */}
      <section
        className="py-20"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <div className="max-w-6xl mx-auto px-8 w-full">
          <p className="section-title text-center mb-12">How it works</p>

          {/* Horizontal CSS Grid with Connectors */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {PIPELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative flex flex-col">
                  {/* Pipeline Card */}
                  <div
                    className="card flex-1 flex flex-col justify-start"
                    style={{
                      padding: "24px",
                      background: "var(--color-surface)",
                    }}
                  >
                    <div
                      className="mb-4 w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: "rgba(207,157,123,0.1)",
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: "var(--color-accent-primary)" }} />
                    </div>
                    <div
                      className="text-xs font-semibold mb-2 uppercase tracking-wider"
                      style={{ color: "var(--color-accent-primary)" }}
                    >
                      {i + 1}. {step.title}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-subtle)", margin: 0 }}>
                      {step.desc}
                    </p>
                  </div>

                  {/* Connecting arrow (hidden on last item and mobile screen layouts) */}
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div
                      className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-[20px] z-10 pointer-events-none"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <section
        className="py-20 text-center"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <div className="max-w-xl mx-auto px-8 w-full flex flex-col items-center">
          <p className="text-xs mb-6" style={{ color: "var(--color-text-muted)" }}>
            Rebuilt from Streamlit prototype · Cost-Optimal Decision Framework
          </p>
          <Link href="/dashboard/overview" className="btn-primary text-sm flex items-center gap-2">
            Go to Dashboard Overview
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="card text-center"
      style={{
        padding: "24px 20px",
        background: "var(--color-surface)",
      }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontSize: "1.6rem", marginTop: 4 }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
