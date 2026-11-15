"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtGravity, toPsi } from "@/lib/format";
import { useJourney } from "@/lib/journey";
import { useMission } from "@/lib/mission";
import { JOURNEY, SPRING } from "@/lib/motion";
import type { Habitat } from "@/lib/types";
import { useWebGL } from "@/lib/webgl";
import { HabitatGlyph } from "./HabitatGlyph";

const STEP_MS = 4000; // Play pacing without journeys (reduced motion / no WebGL)

/**
 * ISS → Moon base → Spacesuit → Rover → Mars. Each stop applies its preset immediately (data never waits) and,
 * on the Answer page with motion and WebGL available, starts the habitat journey. The sun ring travels along the
 * line in sync with the journey while the line fills behind it.
 */
export function MissionTimeline() {
  const { habitats, scenario, applyHabitat } = useMission();
  const journey = useJourney();
  const reduce = useReducedMotion();
  const webgl = useWebGL();
  const journeysOn = !reduce && webgl === true;
  const stops = habitats.filter((h) => h.order != null).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const earth = habitats.find((h) => h.id === "earth");
  const idx = stops.findIndex((h) => h.id === scenario.habitatId);
  const n = stops.length;
  const [playing, setPlaying] = useState(false);
  const playBtn = useRef<HTMLButtonElement>(null);
  const stop = useCallback(() => setPlaying(false), []);
  const planRef = useRef(journey.plan);
  planRef.current = journey.plan;

  /** Go to a habitat: data first, then (optionally) the cinematic. A click mid-journey retargets; no queueing. */
  const goTo = useCallback((h: Habitat) => {
    const from = planRef.current?.to ?? scenario.habitatId;
    if (h.id === from) return;
    if (journeysOn) journey.start(from, h.id);
    applyHabitat(h);
  }, [scenario.habitatId, journeysOn, journey, applyHabitat]);

  // Play: hop, let the journey finish, hold so the verdict can be read, then the next hop
  const [stepMs, setStepMs] = useState(STEP_MS);
  useEffect(() => {
    if (!playing || !n) return;
    const ms = journeysOn && planRef.current ? (planRef.current.duration + JOURNEY.hold) * 1000 : STEP_MS;
    setStepMs(ms);
    const t = setTimeout(() => {
      const next = idx + 1;
      if (next >= n) setPlaying(false);
      else goTo(stops[next]);
    }, ms);
    return () => clearTimeout(t);
  }, [playing, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // any user input elsewhere stops playback
  useEffect(() => {
    if (!playing) return;
    const h = (e: Event) => { if (!playBtn.current?.contains(e.target as Node)) stop(); };
    window.addEventListener("pointerdown", h, true);
    window.addEventListener("keydown", h, true);
    window.addEventListener("wheel", h, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", h, true);
      window.removeEventListener("keydown", h, true);
      window.removeEventListener("wheel", h, true);
    };
  }, [playing, stop]);

  const toggle = () => {
    if (playing) return stop();
    if (idx === -1 || idx === n - 1) goTo(stops[0]);
    setPlaying(true);
  };

  // the travelling ring: in step with the journey, or a spring without one
  const pos = useMotionValue(Math.max(0, idx));
  useEffect(() => {
    if (idx < 0) return;
    const p = planRef.current;
    const c = p && p.to === stops[idx]?.id
      ? animate(pos, idx, { duration: p.duration * 0.86, ease: [0.65, 0, 0.35, 1] })
      : animate(pos, idx, SPRING);
    return () => c.stop();
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  const ringLeft = useTransform(pos, (v) => `${((v + 0.5) / Math.max(1, n)) * 100}%`);
  const fill = useTransform(pos, (v) => `${(v / Math.max(1, n - 1)) * 100}%`);

  if (!n) return <div className="skeleton h-[60px] rounded-[14px]" />;
  const edge = `${50 / n}%`;

  return (
    <section aria-label="Mission path" className="flex items-center gap-4 sm:gap-6">
      {!reduce && (
        <button ref={playBtn} onClick={toggle} aria-label={playing ? "Pause mission timeline" : "Play mission timeline"}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-colors ${playing ? "border-sun/70 bg-sun/10 text-sun" : "border-dust-500/60 bg-space-900/60 text-dust-200 hover:border-dust-300"}`}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
      )}
      <div className="relative min-w-0 flex-1">
        {/* track: the line fills behind the travelling ring */}
        <div className="absolute top-[17px] h-[2px] rounded-full bg-slate-800" style={{ left: edge, right: edge }}>
          <motion.div className="h-full rounded-full bg-gradient-to-r from-dust-500 to-sun" style={{ width: idx < 0 ? 0 : fill }} />
          {playing && (
            <motion.div key={idx} className="absolute top-0 h-full bg-sun/40" style={{ left: `${(Math.max(0, idx) / Math.max(1, n - 1)) * 100}%` }}
              initial={{ width: 0 }} animate={{ width: idx < n - 1 ? `${100 / (n - 1)}%` : 0 }} transition={{ duration: stepMs / 1000, ease: "linear" }} />
          )}
        </div>
        {idx >= 0 && (
          <motion.span aria-hidden style={{ left: ringLeft }}
            className="pointer-events-none absolute top-[-2px] z-10 h-10 w-10 -translate-x-1/2 rounded-full border-2 border-sun shadow-[0_0_18px_-2px_var(--sun-glow)]" />
        )}
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
          {stops.map((h, i) => {
            const on = i === idx;
            return (
              <li key={h.id} className="flex justify-center">
                <button onClick={() => { stop(); goTo(h); }} aria-current={on ? "step" : undefined}
                  title={`${h.name}: ${h.o2Pct}% O₂ · ${toPsi(h.pressureKpa)} psi · ${fmtGravity(h.gravityG)} g${h.assumed ? " (assumed)" : ""}`}
                  className="group flex flex-col items-center gap-0.5">
                  <span className={`relative grid h-9 w-9 place-items-center rounded-full border bg-space-950 transition-colors ${on ? "border-transparent" : i < idx ? "border-dust-400/60" : "border-[var(--line-strong)] group-hover:border-dust-400/60"}`}>
                    <HabitatGlyph id={h.id} size={24} />
                  </span>
                  <span className={`text-[12px] sm:text-[13px] ${on ? "whitespace-nowrap text-ink" : "hidden max-w-full truncate text-mute group-hover:text-ink sm:block"}`}>{h.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {earth && (
        <button onClick={() => { stop(); goTo(earth); }}
          className={`hidden shrink-0 items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-[12px] sm:flex ${scenario.habitatId === "earth" ? "border-sun/70 text-ink" : "border-[var(--line)] text-mute hover:text-ink"}`}
          title="Earth sea level, as a reference (not part of the mission)">
          <HabitatGlyph id="earth" size={20} />Earth ref.
        </button>
      )}
    </section>
  );
}
