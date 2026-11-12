import type { ConditionSpace, Habitat, Scenario } from "./types";

/** Axis ranges of the condition space: O₂ % (log), pressure kPa, effective flow cm/s. */
export const O2_RANGE: [number, number] = [10, 100];
export const P_RANGE: [number, number] = [0, 120];
export const F_RANGE: [number, number] = [0, 60];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Normalised 0..1 coordinates. O₂ is log-scaled so 15–35 % (cabins, Moon base) gets room next to 85–100 %. */
export const nO2 = (v: number) =>
  clamp01((Math.log(Math.min(Math.max(v, O2_RANGE[0]), O2_RANGE[1])) - Math.log(O2_RANGE[0])) / (Math.log(O2_RANGE[1]) - Math.log(O2_RANGE[0])));
export const nP = (v: number) => clamp01((v - P_RANGE[0]) / (P_RANGE[1] - P_RANGE[0]));
export const nF = (v: number) => clamp01((v - F_RANGE[0]) / (F_RANGE[1] - F_RANGE[0]));

/** Effective flow a flame feels: forced ventilation combined with the buoyant estimate (∝ √g, 30 cm/s at 1 g). */
export const effectiveFlow = (flowCmS: number, gravityG: number) => Math.hypot(flowCmS, 30 * Math.sqrt(Math.max(0, gravityG)));
export const habitatFlow = (h: Habitat) => effectiveFlow(h.flowCmS, h.gravityG);

export type Env = ConditionSpace["envelopes"][number];

/** Envelopes that can be drawn: O₂ characterized and the investigation is already in PSI. */
export const plottable = (space: ConditionSpace | null) =>
  (space?.envelopes ?? []).filter((e) => e.envelope.o2Pct && e.status !== "pending");

/** True when no characterized envelope jointly covers the scenario's O₂, pressure and flow. */
export function scenarioInVoid(space: ConditionSpace | null, scenario: Scenario, uEff: number) {
  return !plottable(space).some((e) => {
    const env = e.envelope;
    const inside = (v: number, r: [number, number] | null, tol: number) => !r || (v >= r[0] - tol && v <= r[1] + tol);
    return inside(scenario.o2Pct, env.o2Pct, 1) && !!env.pressureKpa && inside(scenario.pressureKpa, env.pressureKpa, 5) && inside(uEff, env.flowCmS, 2);
  });
}
