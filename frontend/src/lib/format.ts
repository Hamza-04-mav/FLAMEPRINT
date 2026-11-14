import { OUTCOME, PHASE, PILLAR, SEVERITY, scoreColor as scoreColorT } from "./theme";
import type { Confidence, Range } from "./types";

export const PSI_PER_KPA = 1 / 6.89476;
export const toPsi = (kpa: number) => +(kpa * PSI_PER_KPA).toFixed(1);
export const toKpa = (psi: number) => +(psi / PSI_PER_KPA).toFixed(1);

export function fmtRange(r: Range | null | undefined, unit: string) {
  if (!r) return "not characterized";
  const f = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : +v.toFixed(1)).toString();
  return r[0] === r[1] ? `${f(r[0])}${unit}` : `${f(r[0])}–${f(r[1])}${unit}`;
}

export const CONF_LABEL: Record<Confidence, string> = {
  data: "Derived from imported PSI test records",
  approx: "Approximate catalog tested range (verify against PSI)",
  unknown: "Not characterized",
};

/** All colors come from the "Ink sun" token module (src/lib/theme.ts). */
export const PHASE_COLOR = PHASE;
export const OUTCOME_COLOR = OUTCOME;

/** Gap severity — yellow intensity for critical/high, dust for the rest. */
export const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-sun/50 bg-sun/10 text-dust-100",
  high: "border-sun/35 bg-sun/[0.06] text-dust-100",
  medium: "border-dust-500/45 bg-dust-500/[0.06] text-dust-200",
  info: "border-dust-700/55 bg-dust-700/25 text-dust-400",
};
export const SEVERITY_COLOR = SEVERITY;

/** Safety areas — dust tints (labelled in the UI; not on the yellow whitelist). */
export const PILLAR_COLOR = PILLAR;

/** Relevance is not risk: dust brightness ramp, no yellow. */
export const scoreColor = scoreColorT;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * One gravity format for the whole app. Fixes the header-vs-slider mismatch
 * (0.17 vs 0.165): fractional g keeps 3 decimals, trailing zeros trimmed; whole
 * values show no decimals. Use everywhere a gravity value is printed.
 */
export function fmtGravity(g: number): string {
  if (g === 0) return "0";
  if (Number.isInteger(g)) return g.toString();
  return (+g.toFixed(3)).toString();
}

/** "1 investigation" / "2 investigations" — never "1 investigations". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
