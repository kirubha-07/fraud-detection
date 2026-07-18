import { api, StoryStatsResponse } from "@/lib/api";
import Link from "next/link";
import { ArrowRight, Database, Sliders, Cpu, Target, LineChart } from "lucide-react";

/**
 * Homepage — rebuilt to match reference mockup 1:1.
 * Uses inline styles throughout (no Tailwind utility deps) so the layout
 * is guaranteed whether or not Tailwind's JIT scanner picks up this file.
 */

async function getStats(): Promise<StoryStatsResponse | null> {
  try {
    return await api.storyStats();
  } catch {
    return null;
  }
}

const PIPELINE_STEPS = [
  { icon: Database, title: "Raw data", desc: "PaySim transactions" },
  { icon: Sliders, title: "Features", desc: "Balance reconciliation" },
  { icon: Cpu, title: "Model training", desc: "XGBoost, RF, LR" },
  { icon: Target, title: "Scoring", desc: "Cost-optimal threshold" },
  { icon: LineChart, title: "Dashboard", desc: "Live monitoring" },
];

export default async function HomePage() {
  const stats = await getStats();

  const shell: React.CSSProperties = {
    maxWidth: 960,
    margin: "0 auto",
    padding: "0 40px",
    width: "100%",
  };

  return (
    <main style={{ background: "var(--color-bg)", color: "var(--color-text-primary)", minHeight: "100vh" }}>

      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <section style={{ ...shell, paddingTop: 80, paddingBottom: 64 }}>
        {/* Eyebrow */}
        <p style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          letterSpacing: "0.14em",
          color: "var(--color-accent-primary)",
          marginBottom: 20,
          fontFamily: "Inter, sans-serif",
        }}>
          fraud intelligence platform
        </p>

        {/* Two-line serif title — uniform weight/size */}
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(2rem, 4vw, 2.8rem)",
          fontWeight: 500,
          lineHeight: 1.2,
          color: "var(--color-text-primary)",
          margin: "0 0 20px 0",
          maxWidth: 680,
        }}>
          Real-time fraud intelligence for mobile money transactions
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: "0.95rem",
          color: "var(--color-text-muted)",
          lineHeight: 1.65,
          maxWidth: 520,
          margin: "0 0 32px 0",
          fontFamily: "Inter, sans-serif",
        }}>
          Four models, one cost-optimal threshold, and a live view into every transaction that matters.
        </p>

        {/* CTA */}
        <Link
          href="/dashboard/overview"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--color-accent-primary)",
            color: "var(--color-bg)",
            fontWeight: 600,
            fontSize: "0.88rem",
            padding: "13px 26px",
            borderRadius: 8,
            textDecoration: "none",
            fontFamily: "Inter, sans-serif",
            transition: "opacity 0.15s, transform 0.15s",
          }}
        >
          Enter dashboard
          <ArrowRight style={{ width: 16, height: 16 }} />
        </Link>
      </section>

      {/* ── 2. KPI ROW ──────────────────────────────────────────────────── */}
      <section style={{
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <div style={{
          ...shell,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0,
        }}>
          {[
            { label: "transactions analyzed", value: stats ? stats.total_transactions.toLocaleString("en-US") : "221,223" },
            { label: "fraud rate", value: stats ? `${(stats.overall_fraud_rate * 100).toFixed(2)}%` : "0.29%" },
            { label: "models compared", value: stats ? String(stats.models_compared) : "4" },
            { label: "primary benchmark", value: stats ? stats.best_pr_auc.toFixed(2) : "0.94" },
          ].map((card, i, arr) => (
            <div
              key={i}
              style={{
                padding: "32px 28px",
                borderRight: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
              }}
            >
              <p style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "var(--color-text-muted)",
                margin: "0 0 10px 0",
                fontFamily: "Inter, sans-serif",
              }}>
                {card.label}
              </p>
              <p style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "2rem",
                fontWeight: 400,
                color: "var(--color-text-primary)",
                margin: 0,
                lineHeight: 1,
              }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. HOW IT WORKS PIPELINE ────────────────────────────────────── */}
      <section style={{ ...shell, paddingTop: 56, paddingBottom: 72 }}>
        {/* Section eyebrow */}
        <p style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "var(--color-text-muted)",
          margin: "0 0 28px 0",
          fontFamily: "Inter, sans-serif",
        }}>
          how it works
        </p>

        {/* 5-column pipeline grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          alignItems: "stretch",
          position: "relative",
        }}>
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} style={{ position: "relative" }}>
                {/* Card */}
                <div style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  padding: "20px 18px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  height: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}>
                  <Icon style={{ width: 20, height: 20, color: "var(--color-accent-primary)" }} />
                  <p style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    margin: 0,
                    fontFamily: "Inter, sans-serif",
                  }}>
                    {step.title}
                  </p>
                  <p style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    margin: 0,
                    lineHeight: 1.5,
                    fontFamily: "Inter, sans-serif",
                  }}>
                    {step.desc}
                  </p>
                </div>

                {/* Arrow connector between cards */}
                {i < PIPELINE_STEPS.length - 1 && (
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    right: -14,
                    transform: "translateY(-50%)",
                    zIndex: 10,
                    color: "var(--color-text-muted)",
                    opacity: 0.5,
                    pointerEvents: "none",
                    fontSize: "1rem",
                    lineHeight: 1,
                  }}>
                    →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </main>
  );
}
