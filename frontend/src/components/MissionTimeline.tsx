"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { environmentFor } from "@/lib/environment";
import { toPsi } from "@/lib/format";
import { useMission } from "@/lib/mission";
import { PlanetGlyph } from "./Header";

const STEP_MS = 4000;

/** ISS → Moon base → Spacesuit → Rover → Mars. Each stop applies that preset; everything below re-computes. */
export function MissionTimeline() {
  const { habitats, scenario, applyHabitat } = useMission();
  const reduce = useReducedMotion();
  const stops = habitats.filter((h) => h.order != null).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const earth = habitats.find((h) => h.id === "earth");
  const idx = stops.findIndex((h) => h.id === scenario.habitatId);
  const [playing, setPlaying] = useState(false);
  const playBtn = useRef<HTMLButtonElement>(null);

  const stop = useCallback(() => setPlaying(false), []);

  // advance while playing
  useEffect(() => {
    if (!playing || !stops.length) return;
    const t = setTimeout(() => {
      const next = idx + 1;
      if (next >= stops.length) setPlaying(false);
      else applyHabitat(stops[next]);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, idx, stops, applyHabitat]);

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
    if (idx === -1 || idx === stops.length - 1) applyHabitat(stops[0]);
    setPlaying(true);
  };

  if (!stops.length) return <div className="h-[68px] skeleton rounded-[14px]" />;
  const pct = idx < 0 ? 0 : (idx / (stops.length - 1)) * 100;

  return (
    <section aria-label="Mission timeline" className="panel flex items-center gap-3 !rounded-[14px] px-3 py-2 sm:gap-5 sm:px-4">
      {!reduce && (
        <button ref={playBtn} onClick={toggle} aria-label={playing ? "Pause mission timeline" : "Play mission timeline"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${playing ? "border-flame-2/70 bg-flame-2/15 text-flame-1" : "border-ox/50 bg-blue/15 text-ox hover:bg-blue/25"}`}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
      )}
      <div className="relative min-w-0 flex-1">
        {/* track */}
        <div className="absolute left-[10%] right-[10%] top-[13px] h-[2px] rounded-full bg-slate-800">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-ox to-flame-2" animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
          {playing && (
            <motion.div key={idx} className="absolute top-0 h-full bg-flame-1/60" style={{ left: `${pct}%` }}
              initial={{ width: 0 }} animate={{ width: `${100 / (stops.length - 1)}%` }} transition={{ duration: STEP_MS / 1000, ease: "linear" }} />
          )}
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0,1fr))` }}>
          {stops.map((h, i) => {
            const on = i === idx;
            return (
              <li key={h.id} className="flex justify-center">
                <button onClick={() => { stop(); applyHabitat(h); }} aria-current={on ? "step" : undefined}
                  title={`${h.name}: ${h.o2Pct}% O₂ · ${toPsi(h.pressureKpa)} psi · ${h.gravityG} g${h.assumed ? " (assumed)" : ""}`}
                  className="group flex flex-col items-center gap-0.5">
                  <span className={`grid h-7 w-7 place-items-center rounded-full border bg-space-950 transition-all ${on ? "scale-110 border-flame-2 shadow-[0_0_18px_-2px_rgba(255,139,50,0.8)]" : i < idx ? "border-ox/60" : "border-[var(--line-strong)] group-hover:border-ox/60"}`}>
                    <PlanetGlyph env={environmentFor(h.id, h.gravityG)} size={22} />
                  </span>
                  <span className={`max-w-full truncate text-[10.5px] font-medium sm:text-[12.5px] ${on ? "text-ink" : "text-mute group-hover:text-ink"}`}>{h.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {earth && (
        <button onClick={() => { stop(); applyHabitat(earth); }}
          className={`hidden shrink-0 rounded-[9px] border px-2.5 py-1.5 text-[11.5px] sm:block ${scenario.habitatId === "earth" ? "border-ox/60 bg-blue/15 text-ink" : "border-[var(--line)] text-mute hover:text-ink"}`}
          title="Earth sea level, as a reference (not part of the mission)">
          Earth ref.
        </button>
      )}
    </section>
  );
}
