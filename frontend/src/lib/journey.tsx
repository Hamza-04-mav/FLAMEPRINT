"use client";

import { type MotionValue, useMotionValue } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type JourneyPlan, planJourney } from "./journeyPlan";

/**
 * Habitat journey state (Answer page only).
 *   idle → prep (other WebGL canvases release their contexts; the overlay shows its sky) → play (overlay canvas runs)
 *   → idle. `gpuBusy` tells FlameMorph and the 3D habitat to show their 2D posters, so there is never more than one
 *   live WebGL context. Data never waits for a journey: callers apply the habitat immediately.
 */
type Phase = "idle" | "prep" | "play";
interface JourneyCtx {
  phase: Phase;
  plan: JourneyPlan | null;
  /** 0 → 1 over the journey; drives the overlay and the stepper ring */
  progress: MotionValue<number>;
  gpuBusy: boolean;
  start: (from: string, to: string) => JourneyPlan | null;
  play: () => void;
  finish: () => void;
}

const Ctx = createContext<JourneyCtx | null>(null);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  // after a journey the GPU stays "held" for two frames, so its context is gone before the flame remounts
  const [releasing, setReleasing] = useState(false);
  useEffect(() => {
    if (phase !== "idle" || !releasing) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setReleasing(false)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [phase, releasing]);
  const progress = useMotionValue(0);
  const start = useCallback((from: string, to: string) => {
    const p = planJourney(from, to, typeof window === "undefined" ? 1440 : window.innerWidth);
    if (!p) return null;
    progress.set(0);
    setPlan(p);
    setPhase("prep"); // a new journey replaces the current one: no queueing
    return p;
  }, [progress]);
  const play = useCallback(() => setPhase((ph) => (ph === "prep" ? "play" : ph)), []);
  const finish = useCallback(() => { setReleasing(true); setPhase("idle"); setPlan(null); progress.set(1); }, [progress]);
  const value = useMemo(() => ({ phase, plan, progress, gpuBusy: phase !== "idle" || releasing, start, play, finish }),
    [phase, plan, progress, releasing, start, play, finish]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Outside a provider (e.g. other pages) journeys are simply off. */
const OFF: JourneyCtx = {
  phase: "idle", plan: null, progress: { get: () => 0 } as unknown as MotionValue<number>, gpuBusy: false,
  start: () => null, play: () => {}, finish: () => {},
};
export function useJourney() {
  return useContext(Ctx) ?? OFF;
}
