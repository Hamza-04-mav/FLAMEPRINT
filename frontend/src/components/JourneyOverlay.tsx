"use client";

import { motion, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ENV_TINT } from "@/lib/environment";
import { useJourney } from "@/lib/journey";
import { lazyRetry } from "@/lib/lazyRetry";
import { useMission } from "@/lib/mission";
import { DUR, EASE, JOURNEY } from "@/lib/motion";
import { Horizon } from "./CosmicBackdrop";
import { Evidence } from "./ui";

const JourneyCanvas = dynamic(lazyRetry(() => import("./JourneyScene")), { ssr: false });

const ENV_OF: Record<string, keyof typeof ENV_TINT> = { iss: "orbit", "lunar-base": "lunar", suit: "lunar", rover: "lunar", mars: "mars", earth: "earth" };
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Full-viewport cinematic overlay for a habitat change on the Answer page. Never delays data (the habitat is applied
 * before this mounts). Opaque until JOURNEY.dissolveFrom, then dissolves onto the page while the destination planet
 * settles on CosmicBackdrop's horizon. Click, tap, Esc or any key skips. Only mounts its WebGL canvas after the
 * flame has released its context (journey phase "prep" → two frames → canvas).
 */
export function JourneyOverlay() {
  const j = useJourney();
  const { habitats } = useMission();
  const [canvasOn, setCanvasOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const { phase, plan, progress, play, finish } = j;

  // warm the scene chunk while the user reads the verdict
  useEffect(() => {
    const id = setTimeout(() => { void import("./JourneyScene"); }, 1500);
    return () => clearTimeout(id);
  }, []);

  // mount the canvas only after other canvases have released their contexts; restart on retarget
  useEffect(() => {
    if (phase === "idle") { setCanvasOn(false); setReady(false); setSkipping(false); return; }
    if (phase === "prep" && canvasOn && ready) { play(); return; }
    if (canvasOn) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setCanvasOn(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [phase, plan, canvasOn, ready, play]);

  // fail-safe: if the canvas never comes up (no WebGL, lost context), don't trap the user
  useEffect(() => {
    if (phase !== "prep") return;
    const t = setTimeout(() => { if (!ready) finish(); }, 2500);
    return () => clearTimeout(t);
  }, [phase, ready, finish]);

  // the journey clock
  useEffect(() => {
    if (phase !== "play" || !plan) return;
    const t0 = performance.now(), dur = plan.duration * 1000;
    let raf = 0;
    const tick = () => {
      const p = (performance.now() - t0) / dur;
      progress.set(Math.min(1, p));
      if (p >= 1) finish(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, plan, progress, finish]);

  const skip = useCallback(() => { if (phase !== "idle") setSkipping(true); }, [phase]);
  useEffect(() => {
    if (phase === "idle") return;
    const k = () => skip();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [phase, skip]);

  const onReady = useCallback(() => { setReady(true); play(); }, [play]);
  const opacity = useTransform(progress, (p) => 1 - smooth(JOURNEY.dissolveFrom, 1, p));
  const toSky = useTransform(progress, (p) => smooth(0.42, 0.62, p));
  const horizon = useTransform(progress, (p) => smooth(JOURNEY.handoffFrom, 0.97, p));
  const lastPlan = useRef(plan);
  if (plan) lastPlan.current = plan;
  const pl = plan ?? lastPlan.current;
  const name = (id?: string) => habitats.find((h) => h.id === id)?.name ?? "Custom mission";

  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  // portal: the page-transition wrapper is transformed, which would turn `fixed` into "fixed to that box"
  // no AnimatePresence: the overlay is already transparent at the end, and it must unmount (with its WebGL context)
  // in the same commit the journey ends, never lingering next to the remounting flame
  return createPortal(
    <>
      {phase !== "idle" && pl && (
        <motion.div key="journey" className="fixed inset-0 z-[200] cursor-pointer select-none" style={{ opacity }}
          onPointerDown={skip} aria-hidden>
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: skipping ? 0 : 1 }} transition={{ duration: DUR.micro, ease: EASE }}
            onAnimationComplete={() => { if (skipping) finish(); }}>
            {/* departure sky → destination sky; the destination sky is exactly the backdrop's */}
            <div className="absolute inset-0" style={{ background: ENV_TINT[ENV_OF[pl.from] ?? "lunar"].sky }} />
            <motion.div className="absolute inset-0" style={{ background: ENV_TINT[ENV_OF[pl.to] ?? "lunar"].sky, opacity: toSky }} />
            {/* exact replica of the backdrop horizon the page will show: fades in as the 3D planet hands off */}
            <motion.div className="absolute inset-0 overflow-hidden" style={{ opacity: horizon }}>
              <Horizon envKey={ENV_OF[pl.to] ?? "lunar"} suit={pl.to === "suit"} />
            </motion.div>
            {canvasOn && <JourneyCanvas plan={pl} progress={progress} onReady={onReady} />}
            <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-3 sm:left-8 sm:top-7">
              <span className="text-[13px] text-dust-300">{name(pl.from)}</span>
              <span className="h-px w-8 bg-dust-500" />
              <span className="text-[15px] font-semibold text-dust-100">{name(pl.to)}</span>
            </div>
            <div className="pointer-events-none absolute right-5 top-5 sm:right-8 sm:top-7"><Evidence kind="illustrative" label="illustrative" /></div>
            <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-[12px] text-dust-400">Tap or press any key to skip</div>
          </motion.div>
        </motion.div>
      )}
      {phase !== "idle" && pl && <span key="sr" className="sr-only" aria-live="polite">Travelling from {name(pl.from)} to {name(pl.to)}</span>}
    </>,
    host,
  );
}
