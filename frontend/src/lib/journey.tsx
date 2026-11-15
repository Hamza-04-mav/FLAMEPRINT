"use client";

import { motionValue, type MotionValue, useMotionValue } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type JourneyPlan, planJourney } from "./journeyPlan";

/**
 * Answer-page hero state.
 *  - Travel: a stepper click or Play starts a ~2 s A→B sequence. The provider owns the clock, so the verdict latch
 *    and the stepper ring stay in sync even when the 3D scene is scrolled away. Skippable; a new start retargets.
 *  - GPU slot: one WebGL context per page. Hero, flame and the optional 3D habitat ask for the slot; the one in
 *    view wins. Handover is release-first: owner → "none", two frames later → the new owner.
 */
export type GpuOwner = "hero" | "flame" | "habitat3d" | "none";

/** 0 = no hero on screen, 1 = hero fully shown. CosmicBackdrop fades its horizon against this (no double planet). */
export const heroPresence = motionValue(0);

interface JourneyCtx {
  phase: "idle" | "play";
  plan: JourneyPlan | null;
  progress: MotionValue<number>;
  start: (from: string, to: string) => JourneyPlan | null;
  skip: () => void;
  finish: () => void;
  owner: GpuOwner;
  /** report visibility; the arbiter picks the owner */
  report: (who: "hero" | "flame" | "habitat3d", visible: boolean) => void;
  /** kept for older callers: true while the flame must show its 2D poster */
  gpuBusy: boolean;
}

const Ctx = createContext<JourneyCtx | null>(null);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"idle" | "play">("idle");
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const progress = useMotionValue(1);

  const start = useCallback((from: string, to: string) => {
    const p = planJourney(from, to, typeof window === "undefined" ? 1440 : window.innerWidth);
    if (!p) return null;
    progress.set(0);
    setPlan(p);
    setPhase("play");
    return p;
  }, [progress]);
  const finish = useCallback(() => { progress.set(1); setPhase("idle"); }, [progress]);
  const skip = useCallback(() => { if (phase === "play") finish(); }, [phase, finish]);

  // the travel clock (restarts on every new plan: retarget, no queue)
  useEffect(() => {
    if (phase !== "play" || !plan) return;
    const t0 = performance.now(), dur = plan.duration * 1000;
    let raf = 0;
    const tick = () => {
      const k = (performance.now() - t0) / dur;
      progress.set(Math.min(1, k));
      if (k >= 1) setPhase("idle"); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, plan, progress]);

  // skip with any key while travelling
  useEffect(() => {
    if (phase !== "play") return;
    const k = () => finish();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [phase, finish]);

  // GPU slot arbiter
  const seen = useRef({ hero: false, flame: false, habitat3d: false });
  const [want, setWant] = useState<GpuOwner>("none");
  const [owner, setOwner] = useState<GpuOwner>("none");
  const report = useCallback((who: "hero" | "flame" | "habitat3d", visible: boolean) => {
    seen.current[who] = visible;
    const s = seen.current;
    setWant(s.habitat3d ? "habitat3d" : s.hero ? "hero" : s.flame ? "flame" : "none");
  }, []);
  useEffect(() => {
    if (want === owner) return;
    if (owner !== "none") { setOwner("none"); return; } // release first
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOwner(want)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [want, owner]);

  const value = useMemo<JourneyCtx>(() => ({
    phase, plan, progress, start, skip, finish, owner, report, gpuBusy: owner !== "flame",
  }), [phase, plan, progress, start, skip, finish, owner, report]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Outside a provider (other pages) travel is off and the flame owns the GPU. */
const OFF: JourneyCtx = {
  phase: "idle", plan: null, progress: motionValue(1), start: () => null, skip: () => {}, finish: () => {},
  owner: "flame", report: () => {}, gpuBusy: false,
};
export function useJourney() {
  return useContext(Ctx) ?? OFF;
}
