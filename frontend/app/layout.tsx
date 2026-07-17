import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { DashboardProvider } from "@/contexts/DashboardContext";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FraudOps — Fraud Analytics Platform",
  description:
    "Production fraud-detection analytics: PaySim transaction scoring with " +
    "XGBoost, Random Forest, Logistic Regression, and Isolation Forest.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="antialiased">
        <DashboardProvider>{children}</DashboardProvider>
      </body>
    </html>
  );
}
