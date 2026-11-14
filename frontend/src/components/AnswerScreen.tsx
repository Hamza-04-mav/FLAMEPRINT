"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUp, Box, FileDown, FileText, FlaskConical, Globe2, RefreshCw, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { buildVerdict, fmtPressure, LEVEL_STYLE, levelRose } from "@/lib/answer";
import { environmentFor } from "@/lib/environment";
import { SEVERITY_COLOR, toKpa, toPsi } from "@/lib/format";
import { useMission } from "@/lib/mission";
import type { MaterialVerdict, RiskLevel } from "@/lib/types";
import { useInView, useWebGL } from "@/lib/webgl";
import { FlameCanvas } from "./FlameCanvas";
import { GradeBadge } from "./GradeBadge";
import { MissionTimeline } from "./MissionTimeline";
import { StowageCard } from "./StowageInspector";
import { Evidence, Skeleton, Slider } from "./ui";

const FlameMorph = dynamic(() => import("./FlameMorph"), { ssr: false });
const MissionScene3D = dynamic(() => import("./MissionScene3D"), { ssr: false, loading: () => <Skeleton className="h-full w-full !rounded-none" /> });

const strip = (md: string) => md.replace(/^- /, "").replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\s*\*\(([^)]*)\)\*/g, " ($1)");

/* ───────────────────────── verdict + hero flame ───────────────────────── */
function Verdict() {
  const { analysis, analyzing, scenario, setScenario, habitats } = useMission();
  const hab = habitats.find((h) => h.id === scenario.habitatId);
  const name = hab?.name ?? "Custom mission";
  const v = analysis ? buildVerdict(analysis.materials, analysis.coverage.grade, name) : null;
  const p = fmtPressure(scenario.pressureKpa);
  const set = (patch: Partial<typeof scenario>) => setScenario((s) => ({ ...s, ...patch, habitatId: "custom" }));
  const passport = `/passport?${hab ? `mission=${hab.id}` : new URLSearchParams({
    o2: String(scenario.o2Pct), kpa: String(scenario.pressureKpa), g: String(scenario.gravityG), flow: String(scenario.flowCmS),
    phases: scenario.phases.join(","),
  }).toString()}`;

  return (
    <section className="panel relative flex min-w-0 flex-col overflow-hidden p-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-0 sm:pr-36">
        <span className="kicker !text-[10.5px]">Habitat passport</span>
        <span className="min-w-0 break-words font-mono text-[11.5px] text-slate-300">
          {name} · {scenario.o2Pct}% O₂ · {p.psi} <span className="text-slate-500">({p.kpa})</span> · {+scenario.gravityG.toFixed(3)} g
        </span>
        {hab?.assumed && <Evidence kind="estimate" label="assumed preset" />}
      </div>
      <a href={passport} target="_blank" rel="noreferrer" className="btn btn-outline mt-3 self-start !py-1.5 sm:absolute sm:right-5 sm:top-4 sm:mt-0">
        <FileDown className="h-4 w-4" />Fire Passport
      </a>

      <div className="mt-2.5 min-h-[62px]" aria-live="polite">
        {v ? (
          <motion.h1 key={v.headline} initial={{ opacity: 0.35, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className={`font-display text-[22px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[27px] ${analyzing ? "opacity-85" : ""}`}>
            {v.high > 0 ? <><span className="text-[#FF6F63]">{v.high} of {v.total}</span>{v.headline.slice(`${v.high} of ${v.total}`.length)}</> : v.headline}
          </motion.h1>
        ) : <><Skeleton className="h-8 w-[85%]" /><Skeleton className="mt-2 h-8 w-[55%]" /></>}
      </div>

      <div className="mt-2.5">
        {analysis ? <GradeBadge grade={analysis.coverage.grade} size="lg" showReason /> : <Skeleton className="h-12 w-72" />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-[var(--line)] pt-3 md:grid-cols-4">
        <Slider label="Oxygen" value={scenario.o2Pct} min={15} max={100} step={0.5} unit="%" color="#19C9FF" onChange={(x) => set({ o2Pct: x })} />
        <Slider label="Pressure" value={toPsi(scenario.pressureKpa)} min={3} max={15} step={0.1} unit=" psi" color="#087BFF"
          onChange={(x) => set({ pressureKpa: toKpa(x) })} />
        <Slider label="Gravity" value={scenario.gravityG} min={0} max={1} step={0.005} display={scenario.gravityG.toFixed(3)} unit=" g" color="#FF8B32" onChange={(x) => set({ gravityG: x })} />
        <Slider label="Airflow" value={scenario.flowCmS} min={0} max={60} step={0.5} unit=" cm/s" color="#48BFFF" onChange={(x) => set({ flowCmS: x })} />
      </div>
    </section>
  );
}

function HeroFlame() {
  const { scenario, analysis } = useMission();
  const webgl = useWebGL();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const worst: RiskLevel = analysis?.materials.find((m) => m.level !== "unknown")?.level ?? "unknown";
  const r = analysis?.readout;
  return (
    <section ref={ref} className="panel relative hidden min-h-[230px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_75%,#0d1d38,#030814_70%)] lg:block">
      <div className="absolute inset-0">
        {webgl === false
          ? <div className="grid h-full place-items-center"><FlameCanvas g={scenario.gravityG} level={worst === "unknown" ? "elevated" : worst} width={150} height={190} /></div>
          : webgl && <FlameMorph active={visible} flames={[{ g: scenario.gravityG, o2: scenario.o2Pct, flow: scenario.flowCmS }]} />}
      </div>
      <div className="absolute left-3 top-3"><Evidence kind="illustrative" label="Flame · illustrative" /></div>
      <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-[11.5px]">
        <span className="text-slate-300">{scenario.gravityG === 0 ? "Microgravity: dim blue sphere" : scenario.gravityG >= 1 ? "1 g: buoyant teardrop" : `${+scenario.gravityG.toFixed(3)} g: between the two`}</span>
        {r && <span className="font-mono text-slate-500" title="Order-of-magnitude estimate">{r.effectiveFlowCmS.toFixed(0)} cm/s felt</span>}
      </div>
    </section>
  );
}

/* ───────────────────────── material cards ───────────────────────── */
function MaterialCard({ m, g, rose }: { m: MaterialVerdict; g: number; rose: boolean }) {
  const lv = LEVEL_STYLE[m.level];
  return (
    <motion.li layout transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="relative flex items-center gap-3 overflow-hidden rounded-[12px] border bg-space-900/60 px-3 py-2"
      style={{ borderColor: rose ? "#FF5A4E" : "var(--line)" }}>
      {rose && <motion.span className="pointer-events-none absolute inset-0 bg-[#FF5A4E]/10" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 2.4 }} />}
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: lv.color }} />
      <FlameCanvas g={g} level={m.level} width={36} height={46} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-ink" title={`${m.name}: ${m.usedFor}`}>{m.name}</div>
        <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: lv.color }}>
          {lv.label}{rose && <ArrowUp className="h-3.5 w-3.5" aria-label="risk went up" />}
          {m.margin != null && <span className="font-mono text-[10.5px] font-normal text-slate-500">{m.margin > 0 ? "+" : ""}{m.margin} pts</span>}
        </div>
        <div className="truncate text-[11px] leading-snug text-slate-500" title={m.why}>{m.level === "unknown" ? m.usedFor : m.why}</div>
      </div>
      <GradeBadge grade={m.grade} size="sm" />
    </motion.li>
  );
}

function Materials() {
  const { analysis, scenario } = useMission();
  const mats = analysis?.materials;
  // briefly mark materials whose level went up when the habitat changes (e.g. ISS → Moon base)
  const prev = useRef<{ hab: string; levels: Map<string, RiskLevel> } | null>(null);
  const [rose, setRose] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!mats) return;
    const levels = new Map(mats.map((m) => [m.id, m.level]));
    const p = prev.current;
    if (p && p.hab !== scenario.habitatId) {
      const up = new Set(mats.filter((m) => levelRose(p.levels.get(m.id) ?? "unknown", m.level)).map((m) => m.id));
      setRose(up);
      if (up.size) setTimeout(() => setRose(new Set()), 2600);
    }
    prev.current = { hab: scenario.habitatId, levels };
  }, [mats]); // eslint-disable-line react-hooks/exhaustive-deps
  const unrated = mats && mats.length > 0 && mats.every((m) => m.level === "unknown");

  return (
    <section aria-label="Materials">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[16px] font-semibold text-ink">Will your things burn here?</h2>
        <span className="flex items-center gap-2"><Evidence kind="illustrative" label="illustrative model" /></span>
      </div>
      {unrated && (
        <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-amber-300/30 bg-amber-300/[0.06] px-3 py-1.5 text-[12px] text-amber-100"
          title="Add sourced oxygen thresholds to data/seed/materials.json (see docs/OPEN_QUESTIONS.md). FLAMEPRINT will not guess them.">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate"><b>Team notice:</b> material thresholds not loaded. Add sourced values to <code className="font-mono">data/seed/materials.json</code>.</span>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {!mats && [...Array(8)].map((_, i) => <li key={i}><Skeleton className="h-[76px] !rounded-[12px]" /></li>)}
        {mats?.map((m) => <MaterialCard key={m.id} m={m} g={scenario.gravityG} rose={rose.has(m.id)} />)}
      </ul>
    </section>
  );
}

/* ───────────────────────── evidence row ───────────────────────── */
function NextTests() {
  const { analysis, habitats, setTab, openInvestigation } = useMission();
  const items = analysis?.nextExperiments.slice(0, 3);
  const short = (id: string) => habitats.find((h) => h.id === id)?.short ?? id;
  return (
    <section className="panel flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><FlaskConical className="h-4 w-4 text-ox" />What NASA should test next</h3>
        <button onClick={() => setTab("space")} className="chip-link shrink-0">All <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
      {!items && <Skeleton className="h-28" />}
      {items?.length === 0 && <p className="text-[12.5px] text-emerald-300">No missing test condition for this habitat in the loaded data.</p>}
      <ol className="space-y-2.5">
        {items?.map((x, i) => (
          <li key={x.id} className="rounded-[10px] bg-space-950/45 p-3">
            <div className="flex items-start gap-2.5">
              <span className="font-mono text-[11px] text-flame-2">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium leading-snug text-ink">{x.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span style={{ color: SEVERITY_COLOR[x.severity] }}>missing test condition</span>
                  <span>· {x.habitatsAffected.map(short).join(", ")}</span>
                </div>
                {x.plannedBy.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-mute">planned investigation:
                    {x.plannedBy.map((id) => (
                      <button key={id} onClick={() => openInvestigation(id)} className="rounded-[4px] border border-ox/35 bg-ox/10 px-1.5 font-mono text-[10.5px] text-[#9BE6FF] hover:bg-ox/20">{id}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Gaps() {
  const { analysis } = useMission();
  const gaps = analysis?.coverage.gaps.filter((g) => g.severity !== "info").slice(0, 3);
  return (
    <section className="panel flex flex-col p-4">
      <h3 className="mb-3 font-display text-[16px] font-semibold text-ink">Where the evidence stops</h3>
      {!gaps && <Skeleton className="h-28" />}
      {gaps?.length === 0 && <p className="text-[12.5px] text-emerald-300">No major gaps: this habitat is well bracketed.</p>}
      <ul className="space-y-2.5">
        {gaps?.map((g) => (
          <li key={g.title} className="relative overflow-hidden rounded-[10px] bg-space-950/45 py-2.5 pl-3.5 pr-3" title={g.detail}>
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: SEVERITY_COLOR[g.severity] }} />
            <div className="font-mono text-[9.5px] uppercase tracking-[0.16em]" style={{ color: SEVERITY_COLOR[g.severity] }}>{g.severity}</div>
            <div className="text-[13px] leading-snug text-ink">{g.title}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BriefPreview() {
  const { analysis, setTab } = useMission();
  return (
    <section className="panel flex flex-col p-4">
      <h3 className="mb-2.5 flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><FileText className="h-4 w-4 text-ox" />Fire safety brief</h3>
      {!analysis ? <Skeleton className="h-20" /> : (
        <ul className="space-y-1.5 text-[12.5px] leading-snug text-slate-300">
          {analysis.briefPreview.map((l) => <li key={l} className="line-clamp-2">{strip(l)}</li>)}
        </ul>
      )}
      <button onClick={() => setTab("brief")} className="btn btn-outline mt-3 self-start !py-1.5">Open full brief <ArrowRight className="h-4 w-4" /></button>
    </section>
  );
}

function OnEarth() {
  const { setTab } = useMission();
  return (
    <button onClick={() => setTab("earth")} className="panel group flex flex-col p-4 text-left transition-colors hover:border-ox/40">
      <h3 className="flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><Globe2 className="h-4 w-4 text-ok" />On Earth too</h3>
      <p className="mt-1.5 text-[12.5px] leading-snug text-mute">The same experiments improve water-mist extinguishers, smoke detectors and firefighter gear.</p>
      <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[12.5px] text-ox group-hover:underline">See how <ArrowRight className="h-3.5 w-3.5" /></span>
    </button>
  );
}

function Habitat3D() {
  const { scenario } = useMission();
  const [open, setOpen] = useState(false);
  const webgl = useWebGL();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  if (webgl === false) return null;
  return (
    <div ref={ref}>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn btn-ghost w-full justify-center border border-dashed border-[var(--line-strong)] !py-3">
          <Box className="h-4 w-4" />View habitat in 3D
        </button>
      ) : (
        <div className="panel relative h-[360px] overflow-hidden">
          <MissionScene3D env={environmentFor(scenario.habitatId, scenario.gravityG)} withRover={scenario.habitatId === "rover"} active={visible} still={!!reduce} />
          <div className="absolute bottom-3 right-3"><Evidence kind="illustrative" label="Scene · illustrative" /></div>
          <button onClick={() => setOpen(false)} className="chip-link absolute right-3 top-3">Hide 3D</button>
        </div>
      )}
    </div>
  );
}

export function AnswerScreen() {
  const { analysis, error, refreshData } = useMission();
  const offline = !analysis && !!error;
  const ready = !!analysis;
  return (
    <div className="space-y-3.5">
      <MissionTimeline />
      <AnimatePresence>
        {offline && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="panel flex flex-col items-center gap-3 p-8 text-center">
            <div className="font-display text-[20px] font-semibold text-ink">The FLAMEPRINT engine is not answering</div>
            <p className="max-w-md text-[13px] text-mute">A free server can take up to a minute to wake up. Your scenario is kept; nothing is lost.</p>
            <button onClick={() => void refreshData()} className="btn btn-primary"><RefreshCw className="h-4 w-4" />Try again</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_260px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Verdict />
        <HeroFlame />
      </div>
      <Materials />
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 ${ready ? "" : "opacity-80"}`}>
        <NextTests />
        <Gaps />
        <StowageCard />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <BriefPreview />
        <OnEarth />
      </div>
      <Habitat3D />
    </div>
  );
}
