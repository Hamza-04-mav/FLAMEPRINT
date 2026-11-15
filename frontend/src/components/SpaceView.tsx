"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Box, ChevronDown, Crosshair, FileSearch, FlaskConical, Map as MapIcon, Pause, Play, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fmtRange, OUTCOME_COLOR, PHASE_COLOR, plural, scoreColor, SEVERITY_COLOR, toPsi } from "@/lib/format";
import { lazyRetry } from "@/lib/lazyRetry";
import { useMission } from "@/lib/mission";
import { effectiveFlow, scenarioInVoid } from "@/lib/space";
import type { ConditionSpace, NextExperiment } from "@/lib/types";
import { MORPH, SPRING, standardT } from "@/lib/motion";
import { DUST, SUN } from "@/lib/theme";
import { useWebGL } from "@/lib/webgl";
import type { Selection, ViewPreset } from "./ConditionSpace3D";
import { FlammabilityMap, MAP_H, MAP_W } from "./FlammabilityMap";

import { Safe3D } from "./Safe3D";
import { ConfidenceBadge, ErrorNote, Evidence, PageHeader, Skeleton } from "./ui";

const ConditionSpace3D = dynamic(lazyRetry(() => import("./ConditionSpace3D")), {
  ssr: false, loading: () => (
    <div className="grid h-full place-items-center">
      <div className="text-center font-mono text-[10.5px] tracking-[0.2em] text-ox/70">
        <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border border-ox/20 border-t-ox" />LOADING 3D MAP
      </div>
    </div>
  ),
});

const VIEWS: { id: ViewPreset; label: string; hint: string }[] = [
  { id: "iso", label: "3D", hint: "Isometric overview" },
  { id: "front", label: "O₂ × P", hint: "Oxygen against pressure" },
  { id: "top", label: "O₂ × flow", hint: "Oxygen against airflow, from above" },
  { id: "side", label: "P × flow", hint: "Pressure against airflow" },
];

function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]">
      <span className="text-mute">{k}</span>
      <span className="text-right font-mono text-[12px]" style={{ color: tone ?? "#efeae3" }}>{v}</span>
    </div>
  );
}

function NextExperimentsList() {
  const { habitats, openInvestigation, dataVersion } = useMission();
  const [items, setItems] = useState<NextExperiment[] | null>(null);
  useEffect(() => { api.nextExperiments().then(setItems).catch(() => setItems([])); }, [dataVersion]);
  const short = (id: string) => habitats.find((h) => h.id === id)?.short ?? id;
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[16px] font-semibold text-ink">Missing test conditions across every habitat</h2>
        <span className="text-[12px] text-mute">score = severity × habitats affected</span>
      </div>
      {!items && <Skeleton className="mt-4 h-24" />}
      <ol className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {items?.map((x, i) => (
          <li key={x.id} className="relative overflow-hidden rounded-[10px] border border-[var(--line)] bg-space-950/45 p-3 pl-4">
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: SEVERITY_COLOR[x.severity] }} />
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13.5px] font-medium leading-snug text-ink"><span className="mr-1.5 font-mono text-[11px] text-flame-2">{String(i + 1).padStart(2, "0")}</span>{x.title}</span>
              <span className="shrink-0 font-mono text-[11px] text-mute" title="severity weight × habitats affected">{x.score}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-slate-400">{x.why}. Affects {x.habitatsAffected.map(short).join(", ")}.</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-mute">
              {x.plannedBy.length ? <>planned investigation:{x.plannedBy.map((id) => (
                <button key={id} onClick={() => openInvestigation(id)} className="rounded-[4px] border border-ox/35 bg-ox/10 px-1.5 font-mono text-[10.5px] text-dust-200 hover:bg-ox/20">{id}</button>
              ))}</> : <span className="text-slate-400">no planned investigation in the catalog</span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SpaceView() {
  const { scenario, analysis, habitats, openInvestigation, dataVersion, dataset } = useMission();
  const [space, setSpace] = useState<ConditionSpace | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [view, setView] = useState<ViewPreset>("iso");
  const [nonce, setNonce] = useState(0);
  const reduce = useReducedMotion();
  const [spin, setSpin] = useState(!reduce);
  // 2D ↔ 3D is one continuous move: "to3d"/"to2d" are the 700 ms morphs (instant with reduced motion)
  const [mode, setMode] = useState<"2d" | "to3d" | "3d" | "to2d">("2d");
  const [svgOn, setSvgOn] = useState(true);
  const [details, setDetails] = useState(false);
  const [topH, setTopH] = useState(56);
  const topBar = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const stageVisible = useInView(stage);
  const [tabHidden, setTabHidden] = useState(false);
  const webgl = useWebGL();
  const load = () => api.space().then((s) => { setSpace(s); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, [dataVersion]);
  useEffect(() => {
    const v = () => setTabHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", v);
    return () => document.removeEventListener("visibilitychange", v);
  }, []);
  useEffect(() => {
    const el = topBar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTopH(el.offsetHeight + 20));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  const show3d = mode !== "2d";
  const morphing = mode === "to3d" || mode === "to2d";
  const enter3d = () => { setSel(null); setView("iso"); setSvgOn(true); setMode("to3d"); };
  const leave3d = () => {
    setSel(null);
    setMode("to2d");
    // the SVG returns only in the last 150 ms of the reverse morph
    if (reduce) setSvgOn(true);
    else setTimeout(() => setSvgOn(true), (MORPH.duration - MORPH.fade) * 1000);
  };
  const onMorphDone = () => setMode((m) => (m === "to3d" ? "3d" : m === "to2d" ? "2d" : m));
  const onCanvasReady = () => { if (mode === "to3d") setSvgOn(false); };
  const frameloop: "always" | "demand" | "never" = !stageVisible || tabHidden ? "never" : spin || morphing ? "always" : "demand";
  const stopSpin = useCallback(() => setSpin(false), []);

  const hab = habitats.find((h) => h.id === scenario.habitatId);
  const name = hab?.short ?? "Custom";
  const uEff = analysis?.readout.effectiveFlowCmS ?? effectiveFlow(scenario.flowCmS, scenario.gravityG);
  const inVoid = scenarioInVoid(space, scenario, uEff);
  const highlight = useMemo(() => new Set(analysis?.ranked.slice(0, 3).map((r) => r.id)), [analysis]);
  const unplotted = space?.envelopes.filter((e) => !e.envelope.o2Pct && e.status !== "pending") ?? [];
  const cov = analysis?.coverage;

  const selEnv = sel?.kind === "envelope" ? space?.envelopes.find((e) => e.id === sel.id) : null;
  const selRank = selEnv ? analysis?.ranked.findIndex((r) => r.id === selEnv.id) ?? -1 : -1;
  const selRanked = selRank >= 0 ? analysis!.ranked[selRank] : null;
  const selInv = selEnv ? dataset?.investigations.find((i) => i.id === selEnv.id) : null;
  const go = (v: ViewPreset) => { setView(v); setNonce((n) => n + 1); };
  const gaps = analysis?.coverage.gaps.filter((g) => g.severity !== "info").slice(0, 3);
  const next = analysis?.nextExperiments.slice(0, 3);
  const short = (id: string) => habitats.find((h) => h.id === id)?.short ?? id;
  const missionLabel = hab?.name ?? "Custom mission";

  const gapCards = (
    <>
        <section className="panel p-6">
          <h2 className="font-display text-[18px] font-semibold text-ink">Biggest gaps</h2>
          {!gaps && <Skeleton className="mt-4 h-32" />}
          {gaps?.length === 0 && <p className="mt-3 text-[14px] text-emerald-300">No major gaps for this habitat in the loaded data.</p>}
          <ul className="mt-4 space-y-3.5">
            {gaps?.map((g) => (
              <li key={g.title} className="relative pl-4" title={g.detail}>
                <span className="absolute inset-y-1 left-0 w-[3px] rounded-full" style={{ background: SEVERITY_COLOR[g.severity] }} />
                <div className="text-[14.5px] font-semibold leading-snug text-ink">{g.title}</div>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-mute">{g.detail.split(/(?<=\.)\s/)[0]}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-6">
          <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold text-ink"><FlaskConical className="h-[18px] w-[18px] text-ox" />What to test next</h2>
          {!next && <Skeleton className="mt-4 h-32" />}
          {next?.length === 0 && <p className="mt-3 text-[14px] text-emerald-300">No missing test condition for this habitat.</p>}
          <ol className="mt-4 space-y-3.5">
            {next?.map((x) => (
              <li key={x.id} className="relative pl-4">
                <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-ox" />
                <div className="text-[14.5px] font-semibold leading-snug text-ink">{x.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-mute">
                  {x.plannedBy.length ? <>Planned investigation:{x.plannedBy.map((id) => (
                    <button key={id} onClick={() => openInvestigation(id)} className="rounded-[4px] border border-ox/35 bg-ox/10 px-1.5 font-mono text-[11px] text-dust-200 hover:bg-ox/20">{id}</button>
                  ))}</> : <>No planned investigation yet · affects {x.habitatsAffected.map(short).join(", ")}</>}
                </div>
              </li>
            ))}
          </ol>
        </section>
    </>
  );

  const inspector = (
        <aside className="panel flex flex-col p-5">
          <div className="flex items-center justify-between">
            <div className="label">Inspector</div>
            {sel && <button onClick={() => setSel(null)} className="flex items-center gap-1 text-[12px] text-mute hover:text-ink"><X className="h-3.5 w-3.5" />Clear</button>}
          </div>
          <AnimatePresence mode="wait">
            {selEnv ? (
              <motion.div key={selEnv.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mt-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[22px] font-semibold text-ink">{selEnv.id}</span>
                  <ConfidenceBadge c={selEnv.envelope.confidence} />
                </div>
                <p className="mt-0.5 text-[13px] text-mute">{selEnv.name}</p>
                <div className="mt-4 divide-y divide-[var(--line)]">
                  <Row k="Facility" v={selEnv.facility} />
                  <Row k="Fuel phase" v={selEnv.fuelPhase.join(", ")} tone={PHASE_COLOR[selEnv.fuelPhase[0]]} />
                  <Row k="O₂" v={fmtRange(selEnv.envelope.o2Pct, " %")} />
                  <Row k="Pressure" v={selEnv.envelope.pressureKpa ? `${fmtRange([toPsi(selEnv.envelope.pressureKpa[0]), toPsi(selEnv.envelope.pressureKpa[1])], " psi")} · ${fmtRange(selEnv.envelope.pressureKpa, " kPa")}` : fmtRange(null, "")} tone={selEnv.envelope.pressureKpa ? undefined : "#8a8178"} />
                  <Row k="Flow" v={fmtRange(selEnv.envelope.flowCmS, " cm/s")} tone={selEnv.envelope.flowCmS ? undefined : "#8a8178"} />
                  {selRanked && <Row k="Relevance" v={`#${selRank + 1} · ${Math.round(selRanked.score)}`} tone={highlight.has(selEnv.id) ? "#FFD23F" : scoreColor(selRanked.score)} />}
                </div>
                {selRanked && (
                  <ul className="mt-4 space-y-2">
                    {selRanked.factors.slice().sort((a, b) => b.weight * b.score - a.weight * a.score).slice(0, 3).map((f) => (
                      <li key={f.key} className="rounded-[8px] bg-space-950/50 px-3 py-2 text-[12px] leading-snug text-slate-300">
                        <span className="font-medium text-ink">{f.label}</span> · {f.why}
                      </li>
                    ))}
                  </ul>
                )}
                {selInv?.objective && <p className="mt-4 text-[12.5px] leading-relaxed text-mute">{selInv.objective}</p>}
                <button onClick={() => openInvestigation(selEnv.id)} className="btn btn-outline mt-5 w-full justify-center"><FileSearch className="h-4 w-4" />Open dossier</button>
              </motion.div>
            ) : sel?.kind === "test" ? (
              <motion.div key={sel.test.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mt-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[20px] font-semibold text-ink">Test {sel.test.id}</span>
                  <Evidence kind="psi" label="PSI record" />
                </div>
                <div className="mt-4 divide-y divide-[var(--line)]">
                  <Row k="Investigation" v={sel.test.investigationId} />
                  <Row k="O₂" v={`${sel.test.o2Pct} %`} />
                  <Row k="Pressure" v={sel.test.pressureKpa != null ? `${toPsi(sel.test.pressureKpa)} psi · ${sel.test.pressureKpa} kPa` : "not recorded"} />
                  <Row k="Flow" v={sel.test.flowCmS != null ? `${sel.test.flowCmS} cm/s` : "not recorded"} />
                  <Row k="Outcome" v={sel.test.outcome} tone={OUTCOME_COLOR[sel.test.outcome]} />
                  {sel.test.fuel && <Row k="Fuel" v={sel.test.fuel} />}
                  <Row k="Source file" v={sel.test.source} />
                </div>
                <button onClick={() => openInvestigation(sel.test.investigationId)} className="btn btn-outline mt-5 w-full justify-center"><FileSearch className="h-4 w-4" />Open {sel.test.investigationId}</button>
              </motion.div>
            ) : (
              <motion.div key="mission" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 flex-1">
                <div className="flex items-center gap-2">
                  <Crosshair className="h-5 w-5 text-flame-2" />
                  <span className="font-display text-[20px] font-semibold text-ink">{hab?.name ?? "Custom mission"}</span>
                </div>
                <div className={`mt-3 rounded-[10px] border px-3 py-2.5 text-[12.5px] ${inVoid ? "border-flame-2/40 bg-flame-2/[0.07] text-orange-100" : "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-100"}`}>
                  {space ? (inVoid ? "No investigation jointly covers this O₂, pressure and airflow. Risk here is unknown, not low." : "At least one investigation's tested range covers this point.") : "Locating…"}
                </div>
                <div className="mt-3 divide-y divide-[var(--line)]">
                  <Row k="O₂" v={`${scenario.o2Pct} %`} />
                  <Row k="Pressure" v={`${toPsi(scenario.pressureKpa)} psi · ${scenario.pressureKpa.toFixed(1)} kPa`} />
                  <Row k="Airflow felt" v={`${uEff.toFixed(1)} cm/s`} />
                  {cov && <Row k="O₂ bracketed by" v={plural(cov.o2Hits.length, "investigation")} />}
                  {cov && <Row k="Pressure bracketed by" v={plural(cov.pressureHits.length, "investigation")} />}
                  {cov && <Row k="Flow bracketed by" v={plural(cov.flowHits.length, "investigation")} />}
                  {cov && <Row k="All three jointly" v={plural(cov.jointHits.length, "investigation")} tone={cov.jointHits.length ? undefined : "#FFD23F"} />}
                </div>
                <div className="label mb-2 mt-5">Highest relevance</div>
                <div className="space-y-1.5">
                  {analysis?.ranked.slice(0, 3).map((r) => (
                    <button key={r.id} onClick={() => setSel({ kind: "envelope", id: r.id })}
                      className="flex w-full items-center justify-between rounded-[8px] border border-flame-2/25 bg-flame-2/[0.05] px-3 py-2 text-left text-[12.5px] hover:border-flame-2/50">
                      <span className="text-ink">{r.id}</span><span className="font-mono text-flame-1">{Math.round(r.score)}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-4 text-[11px] leading-snug text-slate-400">Airflow includes the buoyancy estimate (∝ √g). Boxes that span a full axis have that axis uncharacterized.</div>
        </aside>
  );


  const renderStage = (svg: React.ReactNode) => (
    <div ref={stage} className={`relative w-full overflow-hidden rounded-[14px] transition-[min-height] duration-700 ${show3d ? "min-h-[400px] lg:min-h-[520px]" : ""}`}
      style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
      {show3d && space && webgl !== false && (
        <div className="absolute inset-0">
          <Safe3D label="The 3D coverage map">
            <ConditionSpace3D space={space} scenario={scenario} uEff={uEff} habitats={habitats} highlight={highlight} inVoid={inVoid} missionName={name}
              selection={sel} onSelect={setSel} view={view} viewNonce={nonce} autoRotate={spin && mode === "3d"} onUserMove={stopSpin}
              morph={mode === "to3d" ? "in" : mode === "to2d" ? "out" : null} onMorphDone={onMorphDone} onReady={onCanvasReady}
              frameloop={frameloop} instant={!!reduce} topInset={topH} bottomInset={40} />
          </Safe3D>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: mode === "3d" ? 1 : 0 }} transition={{ duration: MORPH.fade }}
            className={mode === "3d" ? "" : "pointer-events-none"}>
            {/* one wrapping row: the legend can never run under the view toggle */}
            <div ref={topBar} className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
              <div className="pointer-events-none flex min-w-0 flex-1 flex-wrap gap-1.5">
                {[
                  [<span key="a" className="led" style={{ color: DUST[400] }} />, "Tested range"],
                  [<span key="b" className="led" style={{ color: SUN[500] }} />, "High relevance"],
                  [<span key="c" className="hatch h-3 w-3.5 rounded-[2px] border border-dashed border-dust-400" />, "Untested gap"],
                  [<span key="d" className="h-2 w-2 rotate-45 bg-dust-300" />, "Other habitats"],
                ].map(([icon, label]) => (
                  <span key={label as string} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-space-950/80 px-2.5 py-0.5 text-[11px] text-dust-200 backdrop-blur">{icon}{label}</span>
                ))}
              </div>
              <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
                <div className="flex rounded-[10px] border border-[var(--line)] bg-space-950/85 p-0.5 backdrop-blur">
                  {VIEWS.map((v) => (
                    <button key={v.id} title={v.hint} onClick={() => go(v.id)}
                      className={`relative rounded-[8px] px-1.5 py-1 font-mono text-[10.5px] transition-colors sm:px-2 sm:text-[11px] ${view === v.id ? "text-ink-900" : "text-dust-300 hover:text-dust-100"}`}>
                      {view === v.id && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-[8px] bg-dust-200" transition={SPRING} />}
                      <span className="relative">{v.label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setSpin((v) => !v)} title={spin ? "Stop the idle drift" : "Slow idle drift"} aria-pressed={spin}
                  className="grid h-7 w-7 place-items-center rounded-[9px] border border-[var(--line)] bg-space-950/85 text-dust-300 backdrop-blur hover:text-dust-100">
                  {spin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => go("iso")} title="Reset camera"
                  className="grid h-7 w-7 place-items-center rounded-[9px] border border-[var(--line)] bg-space-950/85 text-dust-300 backdrop-blur hover:text-dust-100">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 truncate font-mono text-[10px] tracking-[0.14em] text-slate-400">
              DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A RANGE TO FLY TO IT
            </div>
          </motion.div>
        </div>
      )}
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: svgOn ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : MORPH.fade }} style={{ pointerEvents: mode === "2d" ? "auto" : "none" }}>
        {svg}
      </motion.div>
    </div>
  );

  return (
    <div>
      <PageHeader kicker="Gaps" title="Where NASA has no data yet">
        Untested is not the same as safe. Here is what is missing, and what to test next.
      </PageHeader>
      {err && <div className="mb-4"><ErrorNote message={err} onRetry={load} /></div>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="panel min-w-0 p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[20px] font-semibold text-ink">Oxygen and airflow tested so far</h2>
              <p className="mt-1 text-[14px] text-dust-200">
                {!space ? "Locating your habitat…" : inVoid
                  ? `${missionLabel} sits outside every tested range: its risk is unknown, not low.`
                  : `${missionLabel} sits inside at least one tested range.`}
              </p>
            </div>
            {webgl !== false && (
              mode === "2d"
                ? <button onClick={enter3d} className="btn btn-ghost"><Box className="h-4 w-4" />Explore in 3D</button>
                : <button onClick={leave3d} disabled={morphing} className="btn btn-ghost disabled:opacity-50"><MapIcon className="h-4 w-4" />Back to 2D</button>
            )}
          </div>
          {space
            ? <FlammabilityMap space={space} missionName={hab?.short ?? "Custom"} showCurve={details} detailed={details} renderStage={renderStage} chrome={mode === "2d"} />
            : <Skeleton className="h-[360px]" />}
        </section>
        <AnimatePresence mode="wait" initial={false}>
          {mode === "3d" || mode === "to2d"
            ? <motion.div key="inspector" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={standardT}>{inspector}</motion.div>
            : <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={standardT} className="flex flex-col gap-6">{gapCards}</motion.div>}
        </AnimatePresence>
      </div>

      {(mode === "3d" || mode === "to2d") && <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">{gapCards}</div>}

      <button onClick={() => setDetails((x) => !x)} aria-expanded={details} className="btn btn-ghost mt-6 !px-0">
        {details ? "Hide details" : "Show details"}<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${details ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {details && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="mt-4 space-y-6">
              <p className="text-[12.5px] text-mute">The chart now also shows the schematic limiting-oxygen curve (a teaching aid, not data) and the PSI test legend.</p>
              <NextExperimentsList />
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                {mode === "2d" && inspector}
        <section className="panel p-5">
          <h3 className="font-display text-[17px] font-semibold text-ink">Not plottable yet</h3>
          <p className="mt-1 text-[12.5px] text-mute">O₂ not characterized in the catalog. Import their PSI test matrices in the Data Lab to place them in the map.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {unplotted.map((e) => (
              <button key={e.id} onClick={() => openInvestigation(e.id)} className="rounded-[8px] border border-[var(--line)] bg-space-950/50 px-2.5 py-1.5 font-mono text-[11.5px] text-slate-200 hover:border-ox/40">{e.id}</button>
            ))}
            {space && unplotted.length === 0 && <span className="text-[12.5px] text-emerald-300">Everything is plottable.</span>}
          </div>
          <div className="rule my-5" />
          <div className="label mb-2">Test points</div>
          <p className="text-[13px] text-slate-200">{space?.plottedTests ?? 0} plotted of {space?.totalTests ?? 0} imported</p>
          {space?.totalTests === 0 && <p className="mt-1 text-[12px] text-mute">No PSI test files imported yet, so tested ranges come from the catalog (approx). No points are invented.</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(OUTCOME_COLOR).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1.5 text-[11.5px] text-mute"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{k}</span>
            ))}
          </div>
        </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
