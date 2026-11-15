"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { fmtPressure, LEVEL_STYLE, levelRose } from "@/lib/answer";
import { api, ApiError } from "@/lib/api";
import { clamp, fmtGravity, SEVERITY_COLOR, toPsi } from "@/lib/format";
import { useMission } from "@/lib/mission";
import type { CompareHabitatsResult, Habitat, Scenario } from "@/lib/types";
import { Genome } from "./Genome";
import { GradeBadge } from "./GradeBadge";
import { ErrorNote, Evidence, PageHeader, Skeleton } from "./ui";

const EASE = [0.2, 0.7, 0.2, 1] as const;
const toScenario = (h: Habitat): Scenario => ({
  habitatId: h.id, o2Pct: h.o2Pct, pressureKpa: h.pressureKpa, flowCmS: h.flowCmS, gravityG: h.gravityG, phases: h.phases, pillarFocus: h.pillarFocus,
});

function Pick({ value, onChange, habitats, label }: { value: string; onChange: (v: string) => void; habitats: Habitat[]; label: string }) {
  const h = habitats.find((x) => x.id === value);
  const p = h ? fmtPressure(h.pressureKpa) : null;
  return (
    <label className="block min-w-0 flex-1">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-mute">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[10px] border border-[var(--line-strong)] bg-space-950 px-3 py-2.5 font-display text-[17px] font-semibold text-ink focus:border-ox/60 focus:outline-none">
        {habitats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {h && p && <span className="mt-1.5 block font-mono text-[12px] text-slate-400">{Math.round(h.o2Pct)}% O₂ · {p.psi} · {fmtGravity(h.gravityG)} g</span>}
    </label>
  );
}

function Toggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-expanded={open} className="btn btn-ghost !px-0">
      {children}<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

/** Both habitats overlaid on each atmosphere axis: A = dust marker, B = sun marker, with the delta. */
function AxisCompare({ ha, hb }: { ha: Habitat; hb: Habitat }) {
  const rows = [
    { k: "Oxygen", a: ha.o2Pct, b: hb.o2Pct, min: 10, max: 100, fmt: (v: number) => `${Math.round(v)}%` },
    { k: "Pressure", a: toPsi(ha.pressureKpa), b: toPsi(hb.pressureKpa), min: 0, max: 16, fmt: (v: number) => `${v} psi` },
    { k: "Airflow", a: ha.flowCmS, b: hb.flowCmS, min: 0, max: 60, fmt: (v: number) => `${+v.toFixed(1)} cm/s` },
    { k: "Gravity", a: ha.gravityG, b: hb.gravityG, min: 0, max: 1, fmt: (v: number) => `${fmtGravity(v)} g` },
  ];
  const pos = (v: number, min: number, max: number) => clamp(((v - min) / (max - min)) * 100, 0, 100);
  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-4 text-[12px] text-dust-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-dust-400" />{ha.short}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sun shadow-[0_0_8px_var(--sun-glow)]" />{hb.short}</span>
      </div>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((r) => {
          const pa = pos(r.a, r.min, r.max), pb = pos(r.b, r.min, r.max);
          const up = r.b > r.a, same = Math.abs(r.b - r.a) < 1e-6;
          return (
            <div key={r.k}>
              <div className="mb-1 flex items-baseline justify-between text-[12px]">
                <span className="text-dust-400">{r.k}</span>
                <span className="flex items-center gap-1.5 font-mono tabular-nums">
                  <span className="text-dust-300">{r.fmt(r.a)}</span>
                  {!same && <ArrowRight className={`h-3 w-3 ${up ? "-rotate-45 text-sun" : "rotate-45 text-dust-400"}`} />}
                  <span className="text-dust-100">{r.fmt(r.b)}</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full" style={{ background: "rgba(138,129,120,0.16)" }}>
                {!same && <span className="absolute inset-y-0 rounded-full" style={{ left: `${Math.min(pa, pb)}%`, width: `${Math.abs(pb - pa)}%`, background: "rgba(163,154,144,0.35)" }} />}
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-dust-400 ring-1 ring-ink-900" style={{ left: `${pa}%` }} />
                <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${pb}%`, background: "var(--sun-500)", boxShadow: "0 0 0 1px var(--sun-ring), 0 0 12px 2px var(--sun-glow)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HabitatDiff() {
  const { habitats, weights } = useMission();
  const [a, setA] = useState("iss");
  const [b, setB] = useState("lunar-base");
  const [res, setRes] = useState<CompareHabitatsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unchanged, setUnchanged] = useState(false);
  const [moves, setMoves] = useState(false);
  const ha = habitats.find((h) => h.id === a), hb = habitats.find((h) => h.id === b);

  useEffect(() => {
    if (!ha || !hb) return;
    let live = true;
    api.compareHabitats(toScenario(ha), toScenario(hb), weights)
      .then((r) => { if (live) { setRes(r); setErr(null); } })
      .catch((e) => live && setErr(e instanceof ApiError ? e.message : String(e)));
    return () => { live = false; };
  }, [ha, hb, weights]);

  const changedIds = new Set(res?.diff.materials.map((m) => m.id));
  const same = res?.b.materials.filter((m) => !changedIds.has(m.id)) ?? [];
  const newGaps = res?.diff.gapsOnlyInB.filter((g) => g.severity !== "info").slice(0, 3) ?? [];
  const unrated = !!res && res.b.materials.every((m) => m.level === "unknown");
  const gradeChanged = res && res.diff.grade.from !== res.diff.grade.to;

  return (
    <>
      {err && <div className="mb-4"><ErrorNote message={err} /></div>}
      <section className="panel flex flex-col items-stretch gap-4 p-6 sm:flex-row sm:items-end">
        <Pick value={a} onChange={setA} habitats={habitats} label="From" />
        <ArrowRight className="mx-auto mb-3 h-5 w-5 shrink-0 rotate-90 text-mute sm:rotate-0" aria-hidden />
        <Pick value={b} onChange={setB} habitats={habitats} label="To" />
      </section>

      {ha && hb && <div className="mt-4"><AxisCompare ha={ha} hb={hb} /></div>}

      {!res ? <Skeleton className="mt-6 h-64" /> : (
        <section className="panel mt-6 grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-3">
          <div>
            <h2 className="font-display text-[17px] font-semibold text-ink">Confidence</h2>
            <div className="mt-4 flex items-center gap-3">
              <GradeBadge grade={res.a.coverage.grade} size="lg" />
              <ArrowRight className="h-5 w-5 text-mute" aria-hidden />
              <GradeBadge grade={res.b.coverage.grade} size="lg" />
            </div>
            <p className="mt-4 text-[13.5px] leading-snug text-mute">
              {gradeChanged ? res.b.coverage.grade.reason : "Unchanged."}
            </p>
          </div>

          <div>
            <h2 className="font-display text-[17px] font-semibold text-ink">Materials that changed</h2>
            {res.diff.materials.length === 0 ? (
              <p className="mt-4 text-[13.5px] text-mute">{unrated ? "None yet: material thresholds are not loaded." : "None. Every material keeps its level."}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {res.diff.materials.slice(0, 5).map((m) => {
                  const up = levelRose(m.from, m.to);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 text-[14px]">
                      <span className="min-w-0 truncate text-ink">{m.name}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[13px]">
                        <span style={{ color: LEVEL_STYLE[m.from].color }}>{LEVEL_STYLE[m.from].label}</span>
                        <ArrowRight className="h-3.5 w-3.5" style={{ color: up ? "#FFD23F" : "#a39a90" }} aria-label={up ? "riskier" : "safer"} />
                        <span className="font-semibold" style={{ color: LEVEL_STYLE[m.to].color }}>{LEVEL_STYLE[m.to].label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3"><Evidence kind="illustrative" label="illustrative model" /></div>
          </div>

          <div>
            <h2 className="font-display text-[17px] font-semibold text-ink">New gaps in {hb?.short ?? "B"}</h2>
            {newGaps.length === 0 ? <p className="mt-4 text-[13.5px] text-mute">None. Every gap here already existed.</p> : (
              <ul className="mt-4 space-y-3">
                {newGaps.map((g) => (
                  <li key={g.title} className="relative pl-3.5 text-[14px] leading-snug text-ink" title={g.detail}>
                    <span className="absolute inset-y-0.5 left-0 w-[3px] rounded-full" style={{ background: SEVERITY_COLOR[g.severity] }} />{g.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {res && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Toggle open={unchanged} onClick={() => setUnchanged((x) => !x)}>Show unchanged ({same.length})</Toggle>
          {res.diff.rankMoves.length > 0 && <Toggle open={moves} onClick={() => setMoves((x) => !x)}>Experiments that moved 3+ ranks ({res.diff.rankMoves.length})</Toggle>}
        </div>
      )}
      <AnimatePresence initial={false}>
        {res && unchanged && (
          <motion.ul key="same" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }} className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 overflow-hidden text-[13.5px] sm:grid-cols-2">
            {same.map((m) => (
              <li key={m.id} className="flex justify-between gap-3 text-slate-400">
                <span>{m.name}</span><span>{LEVEL_STYLE[m.level].label}</span>
              </li>
            ))}
          </motion.ul>
        )}
        {res && moves && (
          <motion.ul key="moves" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }} className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 overflow-hidden text-[13.5px] sm:grid-cols-3">
            {res.diff.rankMoves.map((m) => (
              <li key={m.id} className="flex justify-between gap-3">
                <span className="text-ink">{m.id}</span>
                <span className="font-mono" style={{ color: m.to < m.from ? "#a39a90" : "#FFD23F" }}>#{m.from} → #{m.to}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </>
  );
}

/** Compare page: what changes between two habitats; "Compare experiments" switches to the hardware-lineage diff. */
export function CompareHabitats({ initialMode = "habitats" }: { initialMode?: "habitats" | "experiments" }) {
  const [mode, setMode] = useState(initialMode);
  useEffect(() => setMode(initialMode), [initialMode]);
  return (
    <div>
      <PageHeader kicker="Compare" title="What changes between two habitats?"
        actions={
          <div role="tablist" aria-label="Compare" className="flex rounded-full border border-[var(--line-strong)] p-1">
            {(["habitats", "experiments"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`relative rounded-full px-3.5 py-1.5 text-[13px] transition-colors duration-200 ${mode === m ? "text-white" : "text-mute hover:text-ink"}`}>
                {mode === m && <motion.span layoutId="compare-mode" className="absolute inset-0 rounded-full bg-blue" transition={{ duration: 0.25, ease: EASE }} />}
                <span className="relative">{m === "habitats" ? "Habitats" : "Compare experiments"}</span>
              </button>
            ))}
          </div>
        }>
        Only what changed is shown. The engine and rules are the same as on the Answer page.
      </PageHeader>
      {mode === "habitats" ? <HabitatDiff /> : <Genome embedded />}
    </div>
  );
}
