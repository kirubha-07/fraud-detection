/** lib/theme.ts
 * Design tokens for the FraudOps analytics platform.
 * Single source of truth — consumed by Tailwind config and inline styles.
 *
 * Palette rationale: warm dark (Chinese Black base) with Antique Brass
 * accents. Risk scale uses desaturated rust/sage consistent with the warmth.
 * Pure white (#FFFFFF) is banned — text-primary is an off-white derived
 * from the surface family.
 */

export const colors = {
    background: "#0C1519",  // Chinese Black — primary bg
    surface: "#162127",  // Dark Jungle Green — card / panel bg
    surfaceRaised: "#1E2D35",  // slightly lighter card variant
    border: "#3A3534",  // Jet — dividers, muted outlines
    accentSecondary: "#724B39",  // Coffee — medium-risk, hover states
    accentPrimary: "#CF9D7B",  // Antique Brass — headings, CTAs, active
    textPrimary: "#E8DDD4",  // warm off-white (NOT #FFFFFF)
    textMuted: "#7A6E69",  // dimmed Jet-derived
    textSubtle: "#A89A93",  // mid-tone label text
    riskFraud: "#C46A52",  // desaturated rust/red
    riskLegit: "#5C896B",  // desaturated sage/green
    riskHigh: "#C48E52",  // amber-adjacent
    riskLow: "#5C896B",  // same as legit
} as const;

export const fonts = {
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
} as const;

export const spacing = {
    cardPadding: "24px",
    sectionGap: "32px",
    pagePadding: "48px",
} as const;

/** Returns a Tailwind-compatible arbitrary-value class for a risk band. */
export function riskColorClass(band: string): string {
    switch (band) {
        case "critical": return "text-[#C46A52] bg-[#C46A52]/10 border-[#C46A52]/30";
        case "high": return "text-[#C48E52] bg-[#C48E52]/10 border-[#C48E52]/30";
        case "moderate": return "text-[#CF9D7B] bg-[#CF9D7B]/10 border-[#CF9D7B]/30";
        case "low":
        default: return "text-[#5C896B] bg-[#5C896B]/10 border-[#5C896B]/30";
    }
}
