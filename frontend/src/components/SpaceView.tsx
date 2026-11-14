"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Box, Crosshair, FileSearch, FlaskConical, Map as MapIcon, Pause, Play, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { fmtRange, OUTCOME_COLOR, PHASE_COLOR, scoreColor, SEVERITY_COLOR, toPsi } from "@/lib/format";
import { useMission } from "@/lib/mission";
import { effectiveFlow, scenarioInVoid } from "@/lib/space";
import type { ConditionSpace, NextExperiment } from "@/lib/types";
import { useWebGL } from "@/lib/webgl";
import type { Selection, ViewPreset } from "./ConditionSpace3D";
import { FlammabilityMap } from "./FlammabilityMap";
import { ConfidenceBadge, ErrorNote, Evidence, PageHeader, Skeleton } from "./ui";

const ConditionSpace3D = dynamic(() => import("./ConditionSpace3D"), {
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
      <span className="text-right font-mono text-[12px]" style={{ color: tone ?? "#F2F7FF" }}>{v}</span>
    </div>
  );
}

function NextExperimentsList() {
  const { habitats, openInvestigation, dataVersion } = useMission();
  const [items, setItems] = useState<NextExperiment[] | null>(null);
  useEffect(() => { api.nextExperiments().then(setItems).catch(() => setItems([])); }, [dataVersion]);
  const short = (id: string) => habitats.find((h) => h.id === id)?.short ?? id;
  return (
    <section className="panel mb-5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[18px] font-semibold text-ink"><FlaskConical className="h-5 w-5 text-ox" />What NASA should test next</h2>
        <span className="text-[12px] text-mute">Missing test conditions across all mission presets · score = severity × habitats affected</span>
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
            <p className="mt-1 text-[11.5px] text-slate-500">{x.why}. Affects {x.habitatsAffected.map(short).join(", ")}.</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-mute">
              {x.plannedBy.length ? <>planned investigation:{x.plannedBy.map((id) => (
                <button key={id} onClick={() => openInvestigation(id)} className="rounded-[4px] border border-ox/35 bg-ox/10 px-1.5 font-mono text-[10.5px] text-[#9BE6FF] hover:bg-ox/20">{id}</button>
              ))}</> : <span className="text-slate-500">no planned investigation in the catalog</span>}
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
  const [spin, setSpin] = useState(true);
  const [show3d, setShow3d] = useState(false);
  const webgl = useWebGL();
  const load = () => api.space().then((s) => { setSpace(s); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, [dataVersion]);

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

  return (
    <div>
      <PageHeader index="04" kicker="Where data exists" title="Where the evidence stops"
        actions={<Evidence kind={(space?.totalTests ?? 0) > 0 ? "psi" : "catalog"} label={(space?.totalTests ?? 0) > 0 ? `${space?.totalTests} PSI test points` : "Catalog ranges · approx"} />}>
        Each region is the range of O₂, pressure and airflow an investigation actually tested. Your habitat is the marker. Anything outside
        every region has not been tested, so its risk is unknown, not low.
      </PageHeader>
      {err && <div className="mb-4"><ErrorNote message={err} onRetry={load} /></div>}
      <NextExperimentsList />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {!show3d ? (
          <section className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-display text-[17px] font-semibold text-ink"><MapIcon className="h-4 w-4 text-ox" />O₂ × airflow</h3>
              {webgl !== false && <button onClick={() => setShow3d(true)} className="btn btn-outline !py-1.5"><Box className="h-4 w-4" />Explore in 3D</button>}
            </div>
            <p className="mt-1 text-[12px] text-mute">2D slice with imported PSI test outcomes. Add pressure as a third axis in the 3D view.</p>
            <div className="mt-3"><FlammabilityMap space={space} /></div>
          </section>
        ) : (
        <div className="hud-frame relative h-[62vh] min-h-[420px] overflow-hidden !rounded-[16px] xl:h-[min(72vh,700px)]">
          {webgl === false ? (
            <div className="grid h-full place-items-center p-6 text-center text-[13px] text-mute">
              WebGL is not available in this browser. The 2D O₂ × flow plane below shows the same envelopes and your mission.
            </div>
          ) : space ? (
            <ConditionSpace3D space={space} scenario={scenario} uEff={uEff} habitats={habitats} highlight={highlight} inVoid={inVoid} missionName={name}
              selection={sel} onSelect={setSel} view={view} viewNonce={nonce} autoRotate={spin} />
          ) : !err && <Skeleton className="absolute inset-0 !rounded-none !bg-transparent" />}

          {/* overlays */}
          <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
            {[
              [<span key="a" className="led" style={{ color: "#087BFF" }} />, "Tested region"],
              [<span key="b" className="led" style={{ color: "#FF8B32" }} />, "High relevance"],
              [<span key="c" className="hatch h-3 w-3.5 rounded-[2px] border border-dashed border-ox-2" />, "Data gap"],
              [<span key="d" className="h-2.5 w-2.5 rotate-45 bg-slate-300" />, "Mission presets"],
            ].map(([icon, label]) => (
              <span key={label as string} className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-space-950/75 px-3 py-1 text-[11.5px] text-slate-200 backdrop-blur">{icon}{label}</span>
            ))}
          </div>
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <div className="flex rounded-[10px] border border-[var(--line)] bg-space-950/80 p-1 backdrop-blur">
              {VIEWS.map((v) => (
                <button key={v.id} title={v.hint} onClick={() => go(v.id)}
                  className={`relative rounded-[7px] px-2.5 py-1 font-mono text-[11px] transition-colors ${view === v.id ? "text-white" : "text-mute hover:text-ink"}`}>
                  {view === v.id && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-[7px] bg-blue" />}
                  <span className="relative">{v.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setSpin((v) => !v)} title={spin ? "Pause rotation" : "Auto-rotate"}
              className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line)] bg-space-950/80 text-mute backdrop-blur hover:text-ink">
              {spin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => go("iso")} title="Reset camera"
              className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--line)] bg-space-950/80 text-mute backdrop-blur hover:text-ink">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[10px] tracking-[0.16em] text-slate-500">
            DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A REGION OR POINT TO INSPECT
          </div>
          <button onClick={() => setShow3d(false)} className="chip-link absolute bottom-4 right-4">Back to 2D</button>
        </div>
        )}

        {/* inspector */}
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
                  <Row k="Pressure" v={selEnv.envelope.pressureKpa ? `${fmtRange([toPsi(selEnv.envelope.pressureKpa[0]), toPsi(selEnv.envelope.pressureKpa[1])], " psi")} · ${fmtRange(selEnv.envelope.pressureKpa, " kPa")}` : fmtRange(null, "")} tone={selEnv.envelope.pressureKpa ? undefined : "#7E94B4"} />
                  <Row k="Flow" v={fmtRange(selEnv.envelope.flowCmS, " cm/s")} tone={selEnv.envelope.flowCmS ? undefined : "#7E94B4"} />
                  {selRanked && <Row k="Relevance" v={`#${selRank + 1} · ${Math.round(selRanked.score)}`} tone={highlight.has(selEnv.id) ? "#FF8B32" : scoreColor(selRanked.score)} />}
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
                  <Row k="O₂" v={`${scenario.o2Pct} %`} tone="#19C9FF" />
                  <Row k="Pressure" v={`${toPsi(scenario.pressureKpa)} psi · ${scenario.pressureKpa.toFixed(1)} kPa`} />
                  <Row k="Airflow felt" v={`${uEff.toFixed(1)} cm/s`} />
                  {cov && <Row k="O₂ bracketed by" v={`${cov.o2Hits.length} investigations`} />}
                  {cov && <Row k="Pressure bracketed by" v={`${cov.pressureHits.length}`} />}
                  {cov && <Row k="Flow bracketed by" v={`${cov.flowHits.length}`} />}
                  {cov && <Row k="All three jointly" v={`${cov.jointHits.length}`} tone={cov.jointHits.length ? "#34D399" : "#FF8B32"} />}
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
          <div className="mt-4 text-[11px] leading-snug text-slate-500">Airflow includes the buoyancy estimate (∝ √g). Boxes that span a full axis have that axis uncharacterized.</div>
        </aside>
      </div>

      <div className={`mt-5 grid grid-cols-1 gap-5 ${show3d ? "xl:grid-cols-[minmax(0,1.3fr)_1fr]" : ""}`}>
        {show3d && <section className="panel p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[17px] font-semibold text-ink">O₂ × airflow plane</h3>
            <span className="text-[12px] text-mute">2D slice with imported PSI test outcomes</span>
          </div>
          <div className="mt-3"><FlammabilityMap space={space} /></div>
        </section>}
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
  );
}
