"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Box, ChevronDown, FileDown, Flame, RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { buildVerdict, fmtPressure, LEVEL_STYLE, levelRose } from "@/lib/answer";
import { environmentFor } from "@/lib/environment";
import { fmtGravity, toKpa, toPsi } from "@/lib/format";
import { lazyRetry } from "@/lib/lazyRetry";
import { JourneyProvider, useJourney } from "@/lib/journey";
import { useMission } from "@/lib/mission";
import { standardT } from "@/lib/motion";
import type { MaterialVerdict, RiskLevel } from "@/lib/types";
import { useInView, useWebGL } from "@/lib/webgl";
import { AnswerPipeline } from "./AnswerPipeline";
import { ConditionReadout } from "./ConditionGauges";
import { FlameCanvas } from "./FlameCanvas";
import { Safe3D } from "./Safe3D";
import { GradeBadge } from "./GradeBadge";
import { JourneyOverlay } from "./JourneyOverlay";
import { MissionTimeline } from "./MissionTimeline";
import { StowageSearch } from "./StowageInspector";
import { TiltCard } from "./TiltCard";
import { Evidence, Skeleton, Slider } from "./ui";

const FlameMorph = dynamic(lazyRetry(() => import("./FlameMorph")), { ssr: false });
const MissionScene3D = dynamic(lazyRetry(() => import("./MissionScene3D")), { ssr: false, loading: () => <Skeleton className="h-full w-full !rounded-none" /> });

const VISIBLE_MATERIALS = 5;
const EASE = [0.2, 0.7, 0.2, 1] as const;

/* ───────────────────────── verdict ───────────────────────── */
function Verdict() {
  const { analysis, analyzing, scenario, setScenario, applyHabitat, habitats } = useMission();
  const [adjust, setAdjust] = useState(false);
  const hab = habitats.find((h) => h.id === scenario.habitatId);
  const name = hab?.name ?? "Custom mission";
  const v = analysis ? buildVerdict(analysis.materials, analysis.coverage.grade, name) : null;
  const p = fmtPressure(scenario.pressureKpa);
  const set = (patch: Partial<typeof scenario>) => setScenario((s) => ({ ...s, ...patch, habitatId: "custom" }));

  // remember the last real preset so "Reset" can snap back from a custom scenario
  const lastPreset = useRef<(typeof habitats)[number] | null>(null);
  useEffect(() => { if (hab) lastPreset.current = hab; }, [hab]);
  const custom = scenario.habitatId === "custom" && !!lastPreset.current;

  // preset tick marks on each slider (same axis order as every chart)
  const o2Ticks = habitats.map((h) => ({ value: h.o2Pct }));
  const presTicks = habitats.map((h) => ({ value: toPsi(h.pressureKpa) }));
  const flowTicks = habitats.map((h) => ({ value: h.flowCmS }));
  const gravTicks = [{ value: 0, label: "µg" }, { value: 0.165, label: "Moon" }, { value: 0.38, label: "Mars" }, { value: 1, label: "Earth" }];
  const passport = `/passport?${hab ? `mission=${hab.id}` : new URLSearchParams({
    o2: String(scenario.o2Pct), kpa: String(scenario.pressureKpa), g: String(scenario.gravityG), flow: String(scenario.flowCmS),
    phases: scenario.phases.join(","),
  }).toString()}`;

  return (
    <TiltCard as="section" className="panel flex min-w-0 flex-col p-6 sm:p-8">
      <div className="font-mono text-[12px] text-mute">
        {name} <span className="text-slate-400">· {Math.round(scenario.o2Pct)}% O₂ · {p.psi} <span className="text-[10px]">({Math.round(scenario.pressureKpa)} kPa)</span> · {fmtGravity(scenario.gravityG)} g</span>
        {hab?.assumed && <span className="ml-2 align-middle"><Evidence kind="estimate" label="assumed" /></span>}
      </div>

      <div className="mt-4 min-h-[84px]" aria-live="polite">
        {v ? (
          <motion.h1 key={v.headline} data-hint="verdict" initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: analyzing ? 0.8 : 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}
            className="t-display">
            {v.high > 0
              ? <><span className="text-sun">{v.high} of {v.total}</span>{v.headline.slice(`${v.high} of ${v.total}`.length)}</>
              : v.headline}
          </motion.h1>
        ) : <><Skeleton className="h-10 w-[85%]" /><Skeleton className="mt-2 h-10 w-[50%]" /></>}
      </div>

      <div className="mt-6">
        {analysis ? <GradeBadge grade={analysis.coverage.grade} size="lg" showReason /> : <Skeleton className="h-14 w-72" />}
      </div>

      {analysis ? <ConditionReadout /> : <Skeleton className="mt-6 h-24 w-full" />}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a href={passport} target="_blank" rel="noreferrer" data-hint="passport" className="btn btn-primary"><FileDown className="h-4 w-4" />Get Fire Passport</a>
        <button onClick={() => setAdjust((x) => !x)} aria-expanded={adjust} className="btn btn-ghost">
          <SlidersHorizontal className="h-4 w-4" />Adjust conditions
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${adjust ? "rotate-180" : ""}`} />
        </button>
        {custom && (
          <button onClick={() => applyHabitat(lastPreset.current!)} className="btn btn-ghost" title="Discard custom changes">
            <RotateCcw className="h-4 w-4" />Reset to {lastPreset.current!.name}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {adjust && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
            {/* axis order matches every chart: O₂ · pressure · airflow · gravity */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-6 md:grid-cols-4">
              <Slider label="Oxygen" value={scenario.o2Pct} min={15} max={100} step={0.5} unit="%" ticks={o2Ticks} onChange={(x) => set({ o2Pct: x })} />
              <Slider label="Pressure" value={toPsi(scenario.pressureKpa)} min={3} max={15} step={0.1} unit=" psi" ticks={presTicks} onChange={(x) => set({ pressureKpa: toKpa(x) })} />
              <Slider label="Airflow" value={scenario.flowCmS} min={0} max={60} step={0.5} unit=" cm/s" ticks={flowTicks} onChange={(x) => set({ flowCmS: x })} />
              <Slider label="Gravity" value={scenario.gravityG} min={0} max={1} step={0.005} display={fmtGravity(scenario.gravityG)} unit=" g" ticks={gravTicks} onChange={(x) => set({ gravityG: x })} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TiltCard>
  );
}

/* ───────────────────────── hero flame (the only WebGL canvas here) ───────────────────────── */
function HeroFlame() {
  const { scenario, analysis } = useMission();
  const { gpuBusy } = useJourney(); // a habitat journey owns the only WebGL context while it plays
  const webgl = useWebGL();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const worst: RiskLevel = analysis?.materials.find((m) => m.level !== "unknown")?.level ?? "elevated";
  const g = scenario.gravityG;
  return (
    <section ref={ref} aria-label="Gravity flame"
      className="panel relative h-[240px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_70%,#152033,#0a111d_72%)] lg:h-auto lg:min-h-[340px]">
      <div className="absolute inset-0">
        {webgl === false || gpuBusy
          ? <div className="grid h-full place-items-center"><FlameCanvas g={g} level={worst} width={140} height={180} /></div>
          : webgl && <Safe3D label="The gravity flame"><FlameMorph active={visible} flames={[{ g, o2: scenario.o2Pct, flow: scenario.flowCmS }]} /></Safe3D>}
      </div>
      <div className="absolute left-4 top-4"><Evidence kind="illustrative" label="illustrative" /></div>
      <div className="absolute inset-x-4 bottom-4 text-[13px] text-slate-300">
        {g === 0 ? "No gravity: a dim sphere" : g >= 1 ? "Earth gravity: a tall teardrop" : `${fmtGravity(g)} g: between sphere and teardrop`}
      </div>
    </section>
  );
}

/* ───────────────────────── materials ───────────────────────── */
const RISK_FILL: Record<RiskLevel, number> = { high: 100, elevated: 65, low: 30, unknown: 0 };

function MaterialCard({ m, g, rose }: { m: MaterialVerdict; g: number; rose: boolean }) {
  const lv = LEVEL_STYLE[m.level];
  const unknown = m.level === "unknown";
  return (
    <motion.li layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
      className={`relative flex min-h-[76px] items-center gap-3 overflow-hidden rounded-[14px] py-3 pl-4 pr-3 ${unknown ? "border border-dashed border-dust-500/55 bg-ink-900/40" : "bg-ink-900/70"}`}
      style={{ boxShadow: rose ? "0 0 0 1.5px var(--sun-500), 0 0 22px -6px var(--sun-glow)" : undefined }}>
      {unknown && <span aria-hidden className="hatch pointer-events-none absolute inset-0 opacity-25" />}
      {!unknown && <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: lv.color }} />}
      <FlameCanvas g={g} level={m.level} width={34} height={44} />
      <div className="relative min-w-0 flex-1">
        <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink" title={`${m.name}: ${m.usedFor}`}>{m.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[12px]" style={{ color: lv.color }} title={m.why}>
          {unknown
            ? <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-dust-500 text-[9px] font-semibold text-dust-400">?</span>
            : <Flame className="h-3.5 w-3.5" fill={lv.flame === "solid" ? "currentColor" : "none"} strokeWidth={lv.flame === "none" ? 1.5 : 2} />}
          {lv.label}{rose && <ArrowUp className="h-3.5 w-3.5" aria-label="risk went up" />}
        </div>
        {!unknown && (
          <div className="mt-1.5 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full" style={{ background: "rgba(138,129,120,0.2)" }}>
            <motion.div className="h-full origin-left rounded-full" style={{ width: `${RISK_FILL[m.level]}%`, background: lv.color, boxShadow: lv.glow ? "0 0 10px var(--sun-glow)" : undefined }}
              initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={standardT} />
          </div>
        )}
      </div>
      <GradeBadge grade={m.grade} size="sm" />
    </motion.li>
  );
}

function Materials() {
  const { analysis, scenario } = useMission();
  const mats = analysis?.materials;
  const [all, setAll] = useState(false);
  // briefly ring materials whose level went up when the habitat changes (e.g. ISS → Moon base)
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
  const unrated = !!mats?.length && mats.every((m) => m.level === "unknown");
  const shown = all ? mats : mats?.slice(0, VISIBLE_MATERIALS);
  const hidden = (mats?.length ?? 0) - VISIBLE_MATERIALS;

  return (
    <section aria-label="Materials">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="font-display text-[20px] font-semibold text-ink">Will your things burn here?</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-mute">
            Highest risk first. <Evidence kind="illustrative" label="illustrative model" />
          </p>
        </div>
        <div className="w-full sm:w-[360px]"><StowageSearch /></div>
      </div>
      {unrated && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-dashed border-dust-500/55 bg-ink-900/40 px-4 py-3 text-[13px] text-dust-300">
          <span aria-hidden className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-dust-500 text-[10px] text-dust-400">?</span>
          <span>Oxygen thresholds for these materials aren’t loaded, so risk can’t be rated — the tiles below show the <strong className="text-dust-100">unknown</strong> state, which is not the same as safe. Add sourced thresholds to <code className="text-dust-200">data/seed/materials.json</code>.</span>
        </div>
      )}
      <LayoutGroup>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {!mats && [...Array(VISIBLE_MATERIALS)].map((_, i) => <li key={i}><Skeleton className="h-[68px] !rounded-[14px]" /></li>)}
          <AnimatePresence mode="popLayout" initial={false}>
            {shown?.map((m) => <MaterialCard key={m.id} m={m} g={scenario.gravityG} rose={rose.has(m.id)} />)}
          </AnimatePresence>
        </ul>
      </LayoutGroup>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {hidden > 0 ? (
          <button onClick={() => setAll((x) => !x)} aria-expanded={all} className="btn btn-ghost !px-0">
            {all ? "Show fewer" : `Show all materials (${mats?.length})`}
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${all ? "rotate-180" : ""}`} />
          </button>
        ) : <span />}
        <Habitat3D />
      </div>
    </section>
  );
}

/* optional 3D scene, never on by default */
function Habitat3D() {
  const { scenario } = useMission();
  const { gpuBusy } = useJourney();
  const webgl = useWebGL();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  if (webgl === false) return null;
  return (
    <>
      <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="btn btn-ghost !px-0 text-[13px]">
        <Box className="h-4 w-4" />{open ? "Hide 3D habitat" : "View habitat in 3D"}
      </button>
      {open && (
        <div ref={ref} className="panel relative h-[360px] w-full basis-full overflow-hidden">
          {gpuBusy ? <div className="grid h-full place-items-center text-[13px] text-dust-400">Travelling…</div> : (
            <Safe3D label="The 3D habitat">
              <MissionScene3D env={environmentFor(scenario.habitatId, scenario.gravityG)} withRover={scenario.habitatId === "rover"} active={visible} still={!!reduce} />
            </Safe3D>
          )}
          <div className="absolute bottom-3 right-3"><Evidence kind="illustrative" label="Scene · illustrative" /></div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────── page ───────────────────────── */
export function AnswerScreen() {
  const { analysis, error, refreshData } = useMission();
  const offline = !analysis && !!error;
  if (offline) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center">
        <div className="font-display text-[22px] font-semibold text-ink">The FLAMEPRINT engine is not answering</div>
        <p className="max-w-md text-[14px] text-mute">A free server can take up to a minute to wake up. Your habitat choice is kept.</p>
        <button onClick={() => void refreshData()} className="btn btn-primary"><RefreshCw className="h-4 w-4" />Try again</button>
      </div>
    );
  }
  return (
    <JourneyProvider>
    <JourneyOverlay />
    <div className="flex flex-col gap-8">
      {/* the whole story in one glance, before anything else */}
      <div className="order-first"><AnswerPipeline /></div>
      {/* mobile: verdict and flame first; desktop: the mission path leads */}
      <div className="order-2 lg:order-1"><MissionTimeline /></div>
      <div className="order-1 grid grid-cols-1 gap-6 lg:order-2 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Verdict />
        <HeroFlame />
      </div>
      <div className="order-3"><Materials /></div>
    </div>
    </JourneyProvider>
  );
}
