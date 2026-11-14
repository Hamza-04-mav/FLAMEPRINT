/**
 * FLAMEPRINT — "Ink sun" palette: the single source of truth for every color.
 *
 * Exactly three colors (Phase 1 brief):
 *   Ink navy  #0E1726  (space)      ~60% of screen
 *   Dust taupe #8A8178 (moon dust)  ~35% of screen
 *   Solar yellow #FFD23F (the sun)  ≤5% of screen, whitelisted roles only
 *
 * Every other value here is a tint / shade / alpha of those three. No other hues.
 * CSS mirrors these as custom properties in `globals.css` (@theme + :root); this
 * module is the JS copy that three.js materials and SVG/chart code read, so a color
 * is defined once and referenced everywhere.
 *
 * Yellow (SUN) is allowed in only six roles — see `globals.css` header and the brief:
 *   1 primary CTA (one per view) · 2 the user's habitat marker ("you are here") ·
 *   3 fire / risk intensity (flame, risk bars, burned points) · 4 active habitat in the
 *   stepper · 5 keyboard focus ring · 6 the logo flame. Nowhere else.
 */

/** Ink navy — backgrounds and surfaces (darkest → elevated). */
export const INK = {
  950: "#0A111D",
  900: "#0E1726", // base surface
  850: "#11192B",
  800: "#152033", // elevated surface
  700: "#1D2A40",
  600: "#26344A",
} as const;

/** Dust taupe — text, borders, icons, chart structure (light → dark). */
export const DUST = {
  100: "#EFEAE3", // primary text on navy
  200: "#D8D1C7",
  300: "#C2BAB0", // bright structure / body text
  400: "#A39A90", // secondary text — passes 4.5:1 on navy
  500: "#8A8178", // borders, icons, chart structure (not small body text)
  600: "#6B6459",
  700: "#4A4540",
} as const;

/** Solar yellow — the rare accent. Whitelisted roles only. */
export const SUN = {
  500: "#FFD23F",
  light: "#FFE08A",
  deep: "#E0A51E",
  glow: "rgba(255,210,63,0.28)",
  wash: "rgba(255,210,63,0.10)",
  /** opacity ladder for risk intensity without inventing new hues */
  a65: "rgba(255,210,63,0.65)",
  a35: "rgba(255,210,63,0.35)",
} as const;

/** Text that sits on a solid yellow fill is always ink-900. */
export const ON_SUN = INK[900];

/**
 * Risk intensity — yellow + opacity, never red/green. Shape (flame/hatch) carries the
 * rest of the meaning in the components; see RISK_SHAPE.
 */
export const RISK: Record<"high" | "elevated" | "low" | "unknown", string> = {
  high: SUN[500],
  elevated: SUN.a65,
  low: DUST[500], // taupe, no flame
  unknown: DUST[500], // dashed taupe + hatch + "?" in the component
};

/** How each risk level is drawn (color alone is never enough). */
export const RISK_SHAPE: Record<"high" | "elevated" | "low" | "unknown", {
  flame: "solid" | "outline" | "none"; glow: boolean; hatch: boolean;
}> = {
  high: { flame: "solid", glow: true, hatch: false },
  elevated: { flame: "outline", glow: false, hatch: false },
  low: { flame: "none", glow: false, hatch: false },
  unknown: { flame: "none", glow: false, hatch: true },
};

/** Evidence grade — neutral dust brightness ramp (grades are not on the yellow whitelist). */
export const GRADE: Record<"A" | "B" | "C" | "M", string> = {
  A: DUST[100], // strongest evidence → brightest
  B: DUST[300],
  C: DUST[400],
  M: DUST[500], // modeled → faintest
};

/** Evidence class colors (the honesty tags). Shape differentiates; see EvidenceMark. */
export const EVIDENCE = {
  psi: DUST[100], // verified — bright, filled square
  catalog: DUST[400], // approx — mid dust, diamond outline
  estimate: DUST[500], // physics estimate — dashed circle
  illustrative: DUST[300], // teaching aid — always hatched
  unknown: DUST[500],
} as const;

/** Fuel phase — dust tints (data category, not risk). Components also show the label. */
export const PHASE: Record<string, string> = {
  solid: DUST[300],
  liquid: DUST[400],
  gas: DUST[500],
};

/** Test outcome — burned is fire (yellow, whitelisted); the rest are dust. */
export const OUTCOME: Record<string, string> = {
  burned: SUN[500],
  extinguished: DUST[300],
  "no-ignition": DUST[500],
  unknown: DUST[400],
};

/** Gap severity — risk intensity ramp (yellow → dust). */
export const SEVERITY: Record<string, string> = {
  critical: SUN[500],
  high: SUN.a65,
  medium: DUST[300],
  info: DUST[500],
};

/** Safety areas (prevention / detection / suppression) — dust tints, labelled in UI. */
export const PILLAR: Record<string, string> = {
  prevention: DUST[300],
  detection: DUST[400],
  suppression: DUST[500],
};

export const LINE = "rgba(138,129,120,0.16)";
export const LINE_STRONG = "rgba(194,186,176,0.28)";

/** Relevance score → dust brightness (relevance is not risk, so no yellow). */
export function scoreColor(s: number): string {
  if (s >= 70) return DUST[100];
  if (s >= 50) return DUST[300];
  if (s >= 35) return DUST[400];
  return DUST[500];
}
