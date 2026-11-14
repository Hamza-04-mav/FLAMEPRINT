import { toPsi } from "./format";
import type { Grade, GradeLetter, MaterialVerdict, Ranked, RiskLevel, Scenario } from "./types";

export const LEVEL_STYLE: Record<RiskLevel, { label: string; color: string }> = {
  high: { label: "High risk", color: "#FF5A4E" },
  elevated: { label: "Elevated", color: "#FFC15B" },
  low: { label: "Low risk", color: "#34D399" },
  unknown: { label: "Not rated", color: "#7E94B4" },
};

export const GRADE_STYLE: Record<GradeLetter, { color: string; meaning: string }> = {
  A: { color: "#34D399", meaning: "Imported PSI tests at these conditions" },
  B: { color: "#19C9FF", meaning: "One investigation tested this atmosphere" },
  C: { color: "#FFC15B", meaning: "Only bracketed between investigations" },
  M: { color: "#7E94B4", meaning: "Modeled: no test covers this" },
};

const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, elevated: 1, high: 2, unknown: -1 };
export const levelRose = (from: RiskLevel, to: RiskLevel) => LEVEL_RANK[to] > LEVEL_RANK[from] && LEVEL_RANK[from] >= 0;

/** "10.2 psi" first; kPa is shown as secondary text by callers. */
export const fmtPressure = (kpa: number) => ({ psi: `${toPsi(kpa)} psi`, kpa: `${(+kpa.toFixed(1)).toString()} kPa` });

const PLACE: [RegExp, string][] = [
  [/^custom/i, "in this custom mission"], [/suit/i, "in a spacesuit"], [/rover/i, "in a pressurized rover"],
  [/^iss/i, "aboard the ISS"], [/moon/i, "at the Moon base"], [/mars/i, "in the Mars habitat"], [/earth/i, "at Earth sea level"],
];
/** Prepositional phrase for a habitat: "at the Moon base", "in a spacesuit". */
export const placeName = (name: string) => PLACE.find(([re]) => re.test(name))?.[1] ?? `in ${name}`;

/** One sentence that answers "is my habitat safe from fire, and how sure are we?". Pure: built from engine output only. */
export function buildVerdict(materials: MaterialVerdict[], grade: Grade | undefined, habitatName: string) {
  const where = placeName(habitatName);
  const rated = materials.filter((m) => m.level !== "unknown");
  const high = rated.filter((m) => m.level === "high").length;
  const elevated = rated.filter((m) => m.level === "elevated").length;
  let headline: string;
  if (!materials.length || !rated.length) {
    headline = `Material risk ${where} is not rated yet: no sourced oxygen thresholds are loaded.`;
  } else if (high) {
    headline = `${high} of ${materials.length} materials ${high === 1 ? "is" : "are"} high risk ${where}.`;
  } else if (elevated) {
    headline = `No material is high risk ${where}, but ${elevated} ${elevated === 1 ? "is" : "are"} close to the line.`;
  } else {
    headline = `All rated materials are low risk ${where}.`;
  }
  const confidence = grade ? `Confidence ${grade.letter}: ${grade.reason.charAt(0).toLowerCase()}${grade.reason.slice(1)}.` : "";
  return { headline, confidence, high, elevated, rated: rated.length, total: materials.length };
}

/** "#1 because it tested solid fuels at 21–30% O₂ near your airflow." */
export function rankReason(r: Ranked, index: number, scenario: Scenario) {
  const f = new Map(r.factors.map((x) => [x.key, x]));
  const parts: string[] = [];
  const mat = f.get("material");
  if (mat && mat.score >= 0.99) {
    const m = mat.why.match(/Studies (\S+) fuels/);
    parts.push(`it tested ${m ? m[1].replace("/", " and ") : scenario.phases.join(" and ")} fuels`);
  } else if (mat && mat.score < 0.2) parts.push("it studied fire detection, not burning");
  const o2 = r.envelope.o2Pct;
  if (o2 && f.get("o2")?.score && f.get("o2")!.score > 0.5) {
    parts.push(`at ${o2[0] === o2[1] ? `${o2[0]}` : `${o2[0]}–${o2[1]}`}% O₂`);
  }
  if ((f.get("flow")?.score ?? 0) > 0.7) parts.push("near your airflow");
  if (!parts.length) parts.push((r.factors.slice().sort((a, b) => b.score * b.weight - a.score * a.weight)[0]?.why ?? "it is the closest match").replace(/^./, (c) => c.toLowerCase()));
  return `#${index + 1} because ${parts.join(" ")}.`;
}
