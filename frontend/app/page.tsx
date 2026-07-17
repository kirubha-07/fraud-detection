import { api, StoryStatsResponse } from "@/lib/api";
import Link from "next/link";
import { ArrowRight, TrendingUp, Shield, Database, Settings, BarChart3 } from "lucide-react";

/**
 * Homepage — hero + live stats from /api/story-stats + pipeline + CTA
 * All data fetched server-side (Next.js App Router) against the live backend.
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
    title: "Raw Data",
    desc: "PaySim synthetic mobile-money transactions (~6.3M rows)",
  },
  {
    icon: Settings,
    title: "Feature Engineering",
    desc: "Balance-error flags, amount ratios, account drain indicators",
  },
  {
    icon: TrendingUp,
    title: "Model Training",
    desc: "LR, Random Forest, XGBoost, Isolation Forest with cost-aware eval",
  },
  {
    icon: Shield,
    title: "Cost-Optimal Scoring",
    desc: "Threshold tuned to minimise FP × $50 + FN × $500 business cost",
  },
  {
    icon: BarChart3,
    title: "Live Dashboard",
    desc: "Real-time scoring, explainability, and ROC / PR visualisation",
  },
];

export default async function HomePage() {
  const stats = await getStats();

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center px-6 py-32 text-center overflow-hidden"
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

        {/* Mono label */}
        <span
          className="mb-6 inline-block text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full"
          style={{
            border: "1px solid var(--border)",
            color: "var(--accent)",
            background: "rgba(207,157,123,0.06)",
            letterSpacing: "0.14em",
          }}
        >
          Internship Project — PaySim Fraud Detection
        </span>

        <h1
          className="font-display text-5xl md:text-6xl font-bold mb-6 leading-tight"
          style={{ color: "var(--text)" }}
        >
          FraudOps Analytics
          <br />
          <span style={{ color: "var(--accent)" }}>Platform</span>
        </h1>

        <p
          className="max-w-xl text-lg leading-relaxed mb-10"
          style={{ color: "var(--text-subtle)" }}
        >
          Production-quality fraud scoring, explainability, and model comparison
          for PaySim synthetic transactions — powered by XGBoost, Random Forest,
          and cost-optimal thresholding.
        </p>

        <Link href="/dashboard/overview" className="btn-primary text-base">
          Open Dashboard
          <ArrowRight className="inline ml-2 h-4 w-4" />
        </Link>
      </section>

      {/* ── Live stat cards ───────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 pb-16">
        <p className="section-title text-center mb-8">Live numbers from the backend</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <StatCard
            label="Transactions"
            value={stats ? stats.total_transactions.toLocaleString() : "—"}
          />
          <StatCard
            label="Fraud Rate"
            value={
              stats
                ? `${(stats.overall_fraud_rate * 100).toFixed(3)}%`
                : "—"
            }
          />
          <StatCard
            label="Models Compared"
            value={stats ? String(stats.models_compared) : "—"}
          />
          <StatCard
            label="Best PR-AUC"
            value={stats ? stats.best_pr_auc.toFixed(4) : "—"}
            sub={stats ? stats.best_model : ""}
          />
        </div>
        {!stats && (
          <p
            className="text-center text-sm mt-4"
            style={{ color: "var(--risk-fraud)" }}
          >
            Backend unavailable — start the FastAPI server with uvicorn backend.main:app --port 8000
          </p>
        )}
      </section>

      {/* ── Pipeline ─────────────────────────────────────────────────────── */}
      <section
        className="px-6 md:px-12 py-16"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <p className="section-title text-center mb-12">How it works</p>
        <div className="flex flex-col md:flex-row gap-0 max-w-5xl mx-auto">
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex md:flex-col items-start md:items-center flex-1">
                {/* Step card */}
                <div
                  className="card flex-1 md:w-full text-left md:text-center"
                  style={{ borderRadius: "12px", padding: "20px" }}
                >
                  <div
                    className="mb-3 w-9 h-9 rounded-lg flex items-center justify-center mx-0 md:mx-auto"
                    style={{
                      background: "rgba(207,157,123,0.1)",
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <div
                    className="text-xs font-semibold mb-1 uppercase tracking-wider"
                    style={{ color: "var(--accent)" }}
                  >
                    {i + 1}. {step.title}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-subtle)" }}>
                    {step.desc}
                  </p>
                </div>
                {/* Arrow connector (hidden on last) */}
                {i < PIPELINE_STEPS.length - 1 && (
                  <div
                    className="hidden md:flex items-center justify-center w-8 shrink-0"
                    style={{ color: "var(--border)" }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <section
        className="py-12 text-center"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Rebuilt from Streamlit prototype · FastAPI + Next.js 14
        </p>
        <Link href="/dashboard/overview" className="btn-primary">
          Go to Dashboard
        </Link>
      </section>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card text-center" style={{ padding: "20px 16px" }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontSize: "1.6rem" }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
