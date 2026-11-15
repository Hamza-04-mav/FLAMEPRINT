import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0a111d" };

/**
 * Apple devices render real SF Pro from the system stack (see globals.css).
 * Inter is the cross-platform fallback; ss01/cv11 (applied in globals.css) make
 * its a/g/l read close to SF on Windows/Android. We do not self-host SF Pro.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "FLAMEPRINT · Fire safety from microgravity combustion data",
  description:
    "Mission-driven fire-safety insights from NASA PSI microgravity combustion investigations: explainable ranking, evidence coverage, and cited SI briefs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
