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
  approx: "Approximate catalog envelope (verify against PSI)",
  unknown: "Not characterized",
};

export const PHASE_COLOR: Record<string, string> = {
  solid: "#FF8B32",
  liquid: "#48BFFF",
  gas: "#FFC15B",
};

export const OUTCOME_COLOR: Record<string, string> = {
  burned: "#FF8B32",
  extinguished: "#19C9FF",
  "no-ignition": "#7E94B4",
  unknown: "#DCE7F5",
};

export const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-rose-500/45 bg-rose-500/[0.08] text-rose-100",
  high: "border-flame-2/40 bg-flame-2/[0.07] text-orange-100",
  medium: "border-amber-300/35 bg-amber-300/[0.06] text-amber-100",
  info: "border-slate-600/40 bg-slate-500/5 text-slate-300",
};
export const SEVERITY_COLOR: Record<string, string> = {
  critical: "#FF5A4E", high: "#FF8B32", medium: "#FFC15B", info: "#7E94B4",
};

/** Pillar colours follow the reference: prevention blue, detection cyan, suppression orange. */
export const PILLAR_COLOR: Record<string, string> = {
  prevention: "#087BFF", detection: "#19C9FF", suppression: "#FF8B32",
};

export function scoreColor(s: number) {
  // relevance is not risk: one blue/cyan intensity ramp, no traffic-light colours
  if (s >= 70) return "#19C9FF";
  if (s >= 50) return "#48BFFF";
  if (s >= 35) return "#8FB6E0";
  return "#7E94B4";
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
