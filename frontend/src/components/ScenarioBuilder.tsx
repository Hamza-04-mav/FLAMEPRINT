"use client";

import { motion } from "framer-motion";
import { Car, Globe2, Moon, Orbit, Rocket, Shirt } from "lucide-react";
import { useMission } from "@/lib/mission";
import { fmtGravity, PHASE_COLOR, PILLAR_COLOR, toPsi } from "@/lib/format";
import type { FuelPhase, Pillar, Scenario } from "@/lib/types";
import { Slider, Toggle } from "./ui";

const ICONS: Record<string, React.ReactNode> = {
  iss: <Orbit className="h-4 w-4" />, "lunar-base": <Moon className="h-4 w-4" />, rover: <Car className="h-4 w-4" />,
  mars: <Rocket className="h-4 w-4" />, suit: <Shirt className="h-4 w-4" />, earth: <Globe2 className="h-4 w-4" />,
};

const G_MARKS = [
  { g: 0, label: "μg" }, { g: 0.165, label: "Moon" }, { g: 0.38, label: "Mars" }, { g: 1, label: "Earth" },
];

export function ScenarioBuilder({ bare = false }: { bare?: boolean }) {
  const { habitats, scenario, setScenario, applyHabitat } = useMission();
  const set = (patch: Partial<Scenario>) => setScenario((s) => ({ ...s, ...patch, habitatId: "custom" }));
  const active = habitats.find((h) => h.id === scenario.habitatId);

  const togglePhase = (p: FuelPhase) =>
    setScenario((s) => {
      const has = s.phases.includes(p);
      const phases = has ? s.phases.filter((x) => x !== p) : [...s.phases, p];
      return { ...s, phases: phases.length ? phases : s.phases, habitatId: "custom" };
    });

  return (
    <div className={bare ? "" : "panel panel-glow p-4 sm:p-5"}>
      {!bare && <>
        <div className="label mb-1 text-ox/80">Mission scenario</div>
        <h2 className="font-display text-lg font-semibold text-slate-50">Where will your crew live?</h2>
      </>}
      <div className="label mb-2">Mission presets</div>
      <div className="grid grid-cols-3 gap-2">
        {habitats.map((h) => {
          const on = scenario.habitatId === h.id;
          return (
            <motion.button
              key={h.id} type="button" whileTap={{ scale: 0.96 }} onClick={() => applyHabitat(h)}
              className={`relative flex flex-col items-start gap-1 overflow-hidden rounded-[8px] border px-2.5 py-2 text-left transition-colors ${
                on ? "border-blue/70 text-slate-50" : "border-slate-700/60 bg-space-900/40 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
            >
              {on && <motion.span layoutId={bare ? "hab-on-sheet" : "hab-on"} className="absolute inset-0 -z-0 bg-blue/[0.16]" />}
              <span className="relative z-10 flex items-center gap-1.5 text-[12.5px] font-medium">{ICONS[h.id]}{h.short}</span>
              <span className="relative z-10 font-mono text-[10px] text-slate-500">{h.o2Pct}% · {toPsi(h.pressureKpa)} psi</span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-2 min-h-[2.4em] text-[11.5px] leading-snug text-slate-500">
        {active ? <>{active.basis}{active.assumed && <span className="text-amber-300/80"> (assumed preset)</span>}</> : "Custom scenario."}
      </p>

      <div className="mt-4 space-y-4">
        <Slider label="Oxygen concentration" value={scenario.o2Pct} min={10} max={100} step={0.5} unit="%"
          color="#c2bab0" onChange={(v) => set({ o2Pct: v })}
          hint={scenario.o2Pct > 21 ? `+${Math.round((scenario.o2Pct / 20.9 - 1) * 100)}% vs Earth air` : undefined} />
        <Slider label="Cabin pressure" value={scenario.pressureKpa} min={20} max={110} step={0.5}
          display={`${toPsi(scenario.pressureKpa)} psi`} unit={` · ${scenario.pressureKpa.toFixed(1)} kPa`}
          color="#a39a90" onChange={(v) => set({ pressureKpa: v })} />
        <Slider label="Ventilation flow" value={scenario.flowCmS} min={0} max={60} step={0.5} unit=" cm/s"
          color="#a39a90" onChange={(v) => set({ flowCmS: v })} />
        <div>
          <Slider label="Gravity" value={scenario.gravityG} min={0} max={1} step={0.005}
            display={fmtGravity(scenario.gravityG)} unit=" g" color="#c2bab0" onChange={(v) => set({ gravityG: v })} />
          <div className="relative mt-1 h-4">
            {G_MARKS.map((m) => (
              <button key={m.label} type="button" onClick={() => set({ gravityG: m.g })}
                className="absolute -translate-x-1/2 font-mono text-[10px] text-slate-500 hover:text-flame-2"
                style={{ left: `${m.g * 100}%` }}>{m.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="label mb-2">Materials on board</div>
        <div className="flex flex-wrap gap-2">
          {(["solid", "liquid", "gas"] as FuelPhase[]).map((p) => (
            <Toggle key={p} active={scenario.phases.includes(p)} onClick={() => togglePhase(p)}
              color={PHASE_COLOR[p]}>
              {{ solid: "Solids · fabrics, plastics", liquid: "Liquids · droplets, spills", gas: "Gases · leaks" }[p]}
            </Toggle>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="label mb-2">Safety focus</div>
        <div className="space-y-2">
          {(["prevention", "detection", "suppression"] as Pillar[]).map((p) => (
            <Slider key={p} label={p[0].toUpperCase() + p.slice(1)} value={scenario.pillarFocus[p]} min={0} max={1} step={0.1}
              display={`${Math.round(scenario.pillarFocus[p] * 100)}`} unit="%"
              color={PILLAR_COLOR[p]}
              onChange={(v) => set({ pillarFocus: { ...scenario.pillarFocus, [p]: v } })} />
          ))}
        </div>
      </div>
    </div>
  );
}
