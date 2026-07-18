import { api, StoryStatsResponse } from "@/lib/api";
import Link from "next/link";
import { ArrowRight, Database, Sliders, Cpu, Target, LineChart } from "lucide-react";

/**
 * Rebuilt Homepage matching the reference mockup EXACTLY.
 * - Left-aligned text layouts inside a centered shell width restriction
 * - 2-line Serif Playfair Display title block
 * - Lowercase eyebrows ("fraud intelligence platform", "how it works")
 * - 4-column KPI row with clear card border shapes, gaps, and shadow highlights
 * - 5-column flow pipeline row with custom icon cells and arrow flows
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
    title: "Raw data",
    desc: "PaySim transactions",
  },
  {
    icon: Sliders,
    title: "Features",
    desc: "Balance reconciliation",
  },
  {
    icon: Cpu,
    title: "Model training",
    desc: "XGBoost, RF, LR",
  },
  {
    icon: Target,
    title: "Scoring",
    desc: "Cost-optimal threshold",
  },
  {
    icon: LineChart,
    title: "Dashboard",
    desc: "Live monitoring",
  },
];

export default async function HomePage() {
  const stats = await getStats();

  return (
    <main
      className="min-h-screen flex flex-col w-full"
      style={{ background: "var(--color-bg)", color: "var(--color-text-primary)" }}
    >
      <div className="max-w-5xl mx-auto px-8 w-full flex flex-col">
        {/* ── 1. HERO (Centered max-w wrap, but text content left-aligned) ── */}
        <section className="py-20 flex flex-col items-start text-left">
          {/* Eyebrow label - lowercase, letter-spaced, muted accent */}
          <span
            className="mb-6 inline-block text-xs font-semibold tracking-wider"
            style={{
              color: "var(--color-accent-primary)",
              opacity: 0.85,
              letterSpacing: "0.14em",
              fontFamily: "var(--font-sans)",
            }}
          >
            fraud intelligence platform
          </span>

          {/* Title - two lines, serif font, same weight, same size, cohesive structure */}
          <h1
            className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-6 leading-[1.15]"
            style={{ color: "var(--color-text-primary)" }}
          >
            Real-time fraud intelligence for mobile
            <br />
            money transactions
          </h1>

          {/* Subtitle - one-line length constrained */}
          <p
            className="max-w-2xl text-base md:text-md mb-8"
            style={{ color: "var(--color-text-muted)", lineHeight: 1.6 }}
          >
            Four models, one cost-optimal threshold, and a live view into every transaction that matters.
          </p>

          {/* CTA Button */}
          <Link
            href="/dashboard/overview"
            className="btn-primary flex items-center gap-2"
            style={{
              padding: "14px 28px",
              borderRadius: "8px",
              background: "var(--color-accent-primary)",
              color: "var(--color-bg)",
              fontWeight: 600,
              fontSize: "0.92rem",
              textDecoration: "none",
            }}
          >
            Enter dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* ── 2. KPI ROW (Exactly 4 cards, border radius 12, shadow) ── */}
        <section className="py-16" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="transactions analyzed"
              value={stats ? stats.total_transactions.toLocaleString() : "221,223"}
            />
            <StatCard
              label="fraud rate"
              value={stats ? `${(stats.overall_fraud_rate * 100).toFixed(2)}%` : "0.29%"}
            />
            <StatCard
              label="models compared"
              value={stats ? String(stats.models_compared) : "4"}
            />
            <StatCard
              label="primary benchmark"
              value={stats ? `${stats.best_pr_auc.toFixed(2)}` : "0.94"}
            />
          </div>
        </section>

        {/* ── 3. PIPELINE SECTION (5 columns + arrow flow pointers) ── */}
        <section className="py-20" style={{ borderTop: "1px solid var(--color-border)" }}>
          {/* Eyebrow - lowercase, left-aligned, muted */}
          <span
            className="section-title block mb-10 text-left text-xs tracking-wider"
            style={{
              color: "var(--color-text-muted)",
              letterSpacing: "0.14em",
              fontFamily: "var(--font-sans)",
            }}
          >
            how it works
          </span>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
            {PIPELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative flex flex-col h-full">
                  <div
                    className="card flex-1 flex flex-col justify-start"
                    style={{
                      padding: "20px",
                      borderRadius: "12px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
                    }}
                  >
                    {/* Icon top-left - orange accent */}
                    <div className="mb-4">
                      <Icon className="h-5 w-5" style={{ color: "var(--color-accent-primary)" }} />
                    </div>

                    {/* Step Title */}
                    <div
                      className="text-xs font-semibold mb-2"
                      style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-sans)" }}
                    >
                      {step.title}
                    </div>

                    {/* Step Description */}
                    <p
                      className="text-xs leading-normal"
                      style={{ color: "var(--color-text-muted)", margin: 0 }}
                    >
                      {step.desc}
                    </p>
                  </div>

                  {/* Flow Arrow - Positioned in the gap space on desktop */}
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div
                      className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-[10px] z-10 opacity-40 pointer-events-none"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="card text-left flex flex-col justify-between"
      style={{
        padding: "20px",
        borderRadius: "12px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      }}
    >
      <div
        className="kpi-label mb-2 text-xs"
        style={{
          textTransform: "lowercase",
          color: "var(--color-text-muted)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        className="kpi-value font-display font-medium leading-none"
        style={{ fontSize: "1.9rem", color: "var(--color-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
