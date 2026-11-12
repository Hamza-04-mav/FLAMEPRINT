"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Box, ChevronRight, Expand, Flame, Info, Radar, Shield, SprayCan, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { environmentFor, ENV_LABEL } from "@/lib/environment";
import { PILLAR_COLOR, scoreColor, SEVERITY_COLOR, toPsi } from "@/lib/format";
import { useMission } from "@/lib/mission";
import { effectiveFlow, scenarioInVoid } from "@/lib/space";
import type { ConditionSpace, Pillar } from "@/lib/types";
import { useInView, useWebGL } from "@/lib/webgl";
import { CoveragePreview } from "./CoveragePreview";
import { Evidence, Ring, Skeleton, Slider } from "./ui";

const MissionScene3D = dynamic(() => import("./MissionScene3D"), { ssr: false, loading: () => <SceneLoading /> });
const FlameMorph = dynamic(() => import("./FlameMorph"), { ssr: false, loading: () => <Skeleton className="h-full w-full !bg-transparent" /> });

function SceneLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="text-center font-mono text-[10.5px] tracking-[0.22em] text-ox/70">
        <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border border-ox/20 border-t-ox" />RENDERING MISSION ENVIRONMENT
      </div>
    </div>
  );
}

/** Static scene for devices without WebGL. */
function SceneFallback({ env }: { env: string }) {
  const ground = env === "mars" ? "#6b2c17" : "#3a4250";
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 480" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="fb-planet" cx="40%" cy="35%"><stop offset="0" stopColor="#5fb2ff" /><stop offset="1" stopColor="#0a2a6c" /></radialGradient>
        <linearGradient id="fb-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ground} /><stop offset="1" stopColor="#05080f" /></linearGradient>
      </defs>
      {env !== "mars" && <circle cx="860" cy="150" r="120" fill="url(#fb-planet)" opacity="0.85" />}
      <path d="M0 360 Q600 300 1200 350 L1200 480 L0 480 Z" fill="url(#fb-ground)" />
      <path d="M720 340 a110 90 0 0 1 220 0 Z" fill="#9fd2ff" opacity="0.2" stroke="#cfe9ff" strokeOpacity="0.6" />
      <rect x="600" y="318" width="120" height="24" rx="12" fill="#a9b3c0" />
      <rect x="940" y="320" width="110" height="22" rx="11" fill="#a9b3c0" />
    </svg>
  );
}

function PillarIcon({ p }: { p: Pillar }) {
  const c = PILLAR_COLOR[p];
  const I = p === "prevention" ? Shield : p === "detection" ? Radar : SprayCan;
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border" style={{ borderColor: `${c}55`, background: `${c}14`, color: c }}>
      <I className="h-5 w-5" />
    </span>
  );
}

function CardHead({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div>
          <h3 className="font-display text-[17px] font-semibold text-ink">{title}</h3>
          {sub && <p className="mt-0.5 text-[12.5px] text-mute">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const INCIDENTS = [
  { y: "1967", t: "Apollo 1", d: "Pure-oxygen cabin fire during a pre-launch test." },
  { y: "1997", t: "Mir", d: "An oxygen-generator failure started a fire aboard the station." },
  { y: "2026", t: "Artemis II", d: "Crewed lunar flyby. Fire safety far from home." },
];

export function Overview() {
  const { scenario, setScenario, analysis, habitats, setTab, openInvestigation, dataVersion, dataset } = useMission();
  const [space, setSpace] = useState<ConditionSpace | null>(null);
  const [flameOpen, setFlameOpen] = useState(false);
  const webgl = useWebGL();
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const flameRef = useRef<HTMLDivElement>(null);
  const heroVisible = useInView(heroRef);
  const flameVisible = useInView(flameRef);

  useEffect(() => { api.space().then(setSpace).catch(() => setSpace(null)); }, [dataVersion]);

  const hab = habitats.find((h) => h.id === scenario.habitatId);
  const name = hab?.name ?? "Custom mission";
  const env = environmentFor(scenario.habitatId, scenario.gravityG);
  const cov = analysis?.coverage;
  const uEff = analysis?.readout.effectiveFlowCmS ?? effectiveFlow(scenario.flowCmS, scenario.gravityG);
  const inVoid = scenarioInVoid(space, scenario, uEff);
  const top3 = useMemo(() => new Set(analysis?.ranked.slice(0, 3).map((r) => r.id)), [analysis]);
  const gaps = cov?.gaps.filter((g) => g.severity !== "info") ?? [];
  const crit = gaps.filter((g) => g.severity === "critical").length;
  const high = gaps.filter((g) => g.severity === "high").length;
  const uncertainty = crit ? ["High", "#FF5A4E"] : high ? ["Medium", "#FF8B32"] : ["Low", "#34D399"];
  const partialG = scenario.gravityG > 0.02 && scenario.gravityG < 0.9;

  // Quick intelligence: the best-ranked investigation that has a curated insight for each pillar
  const intel = useMemo(() => {
    const byId = new Map(dataset?.investigations.map((i) => [i.id, i]));
    return (["prevention", "detection", "suppression"] as Pillar[]).map((p) => {
      for (const r of analysis?.ranked ?? []) {
        const inv = byId.get(r.id);
        const text = inv?.insights?.[p];
        if (text) return { p, id: r.id, text };
      }
      return { p, id: null, text: null };
    });
  }, [analysis, dataset]);

  const setG = (g: number) => setScenario((s) => ({ ...s, gravityG: g, habitatId: "custom" }));

  return (
    <div className="space-y-5">
      {/* ───────── HERO ───────── */}
      <section ref={heroRef} className="relative overflow-hidden rounded-[18px] border border-[var(--line)] bg-space-950">
        <div className="absolute inset-0">
          {webgl === false ? <SceneFallback env={env} /> : webgl && (
            <MissionScene3D env={env} withRover={scenario.habitatId === "rover"} active={heroVisible} still={!!reduce} />
          )}
        </div>
        {/* legibility gradients */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,20,0.92)_0%,rgba(3,8,20,0.65)_32%,rgba(3,8,20,0)_60%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-space-950 to-transparent" />

        <div className="relative grid min-h-[480px] gap-6 p-6 sm:p-9 xl:grid-cols-[1fr_360px] xl:p-10">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
            className="flex max-w-xl flex-col justify-center">
            <div className="kicker flex items-center gap-4 !text-[12px] !tracking-[0.42em] text-ink/85">
              FLAMEPRINT <span className="h-px w-28 bg-gradient-to-r from-[rgba(165,184,210,0.5)] to-transparent" />
            </div>
            <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.04] tracking-tight text-ink sm:text-[54px]">
              Mission Ready.<br /><span className="text-ox">Evidence Driven.</span>
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-slate-300">
              Discover what NASA knows, and what remains unknown, about fire in space.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={() => setTab("space")} className="btn btn-outline !rounded-[12px] !px-5 !py-3 !text-[14.5px]">
                Explore Mission <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => setTab("brief")} className="btn btn-ghost !px-4 !py-3">Read the fire-safety brief</button>
            </div>
            <div className="mt-9 hidden gap-6 sm:flex">
              {INCIDENTS.map((i) => (
                <div key={i.t} title={i.d} className="max-w-[160px]">
                  <div className="font-mono text-[10.5px] text-flame-1/80">{i.y}</div>
                  <div className="text-[12.5px] font-medium text-slate-200">{i.t}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{i.d}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Mission overview card */}
          <motion.aside initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
            className="panel w-full max-w-md self-center !rounded-[16px] !bg-[rgba(7,18,37,0.78)] p-5 xl:max-w-none">
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 items-end gap-[3px]">{[8, 13, 18, 11].map((h, i) => <span key={i} className="w-[4px] rounded-sm bg-blue" style={{ height: h }} />)}</span>
              <h2 className="font-display text-[17px] font-semibold text-ink">Mission Overview</h2>
            </div>
            <div className="mt-5 flex items-center gap-5">
              {cov ? <Ring value={cov.index} size={128} stroke={10} color={cov.index >= 60 ? "#19C9FF" : cov.index >= 35 ? "#48BFFF" : "#087BFF"} label="coverage" />
                : <Skeleton className="h-[128px] w-[128px] !rounded-full" />}
              <ul className="min-w-0 flex-1 space-y-3 text-[12.5px]">
                <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-slate-300"><span className="led" style={{ color: "#34D399" }} />Covered conditions</span><span className="font-mono text-ink">{cov ? `${Math.round(cov.index)}%` : "–"}</span></li>
                <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-slate-300"><span className="led" style={{ color: "#087BFF" }} />Evidence gaps</span><span className="font-mono text-ink">{cov ? gaps.length : "–"}</span></li>
                <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-slate-300"><span className="led" style={{ color: "#FF8B32" }} />Critical uncertainty</span><span className="font-medium" style={{ color: uncertainty[1] }}>{cov ? uncertainty[0] : "–"}</span></li>
              </ul>
            </div>
            <div className="mt-5 flex gap-3 rounded-[12px] border border-[var(--line)] bg-space-950/50 p-3.5">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue" />
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-slate-200">
                  {space ? (inVoid ? `${name} conditions lie outside every characterized test envelope.` : `${name} conditions fall inside at least one tested envelope.`) : "Locating your mission in the evidence…"}
                </p>
                {gaps[0] && <p className="mt-1 text-[11.5px] leading-snug text-mute">{gaps[0].title}.</p>}
                <button onClick={() => setTab("space")} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-ox hover:underline">
                  View details <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.aside>
        </div>
        <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-slate-500">{ENV_LABEL[env].toUpperCase()}</span>
          <Evidence kind="illustrative" label="Scene · illustrative" />
        </div>
      </section>

      {/* ───────── PREVIEW CARDS ───────── */}
      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {/* Flame */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="panel flex flex-col p-5">
          <CardHead icon={<Flame className="h-5 w-5 text-flame-2" />} title="Gravity Flame Morph" sub="How flame shape changes with gravity."
            action={<button onClick={() => setFlameOpen(true)} aria-label="Expand flame view" className="grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink"><Expand className="h-4 w-4" /></button>} />
          <div ref={flameRef} className="relative mt-3 h-[210px]">
            <div className="pointer-events-none absolute inset-x-0 bottom-7 grid grid-cols-3">
              {[0, 1, 2].map((i) => <div key={i} className="mx-auto h-5 w-28 rounded-[50%] border border-ox/25 bg-[radial-gradient(closest-side,rgba(25,201,255,0.12),transparent)]" />)}
            </div>
            {webgl === false
              ? <div className="grid h-full place-items-center text-[12px] text-mute">WebGL unavailable: flame visualization disabled.</div>
              : <FlameMorph active={flameVisible && !flameOpen} flames={[
                  { g: 1, o2: scenario.o2Pct, flow: scenario.flowCmS },
                  { g: scenario.gravityG, o2: scenario.o2Pct, flow: scenario.flowCmS },
                  { g: 0, o2: scenario.o2Pct, flow: scenario.flowCmS },
                ]} />}
            <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 text-center text-[13px]">
              <span className="text-slate-200">1 g</span>
              <span className="font-medium text-flame-1">{+scenario.gravityG.toFixed(3)} g · mission</span>
              <span className="text-slate-200">0 g</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-y-[9px] rounded-full bg-[linear-gradient(90deg,rgba(25,201,255,0.25),rgba(255,193,91,0.18)_10%,rgba(255,193,91,0.18)_90%,rgba(255,139,50,0.25))]" style={{ left: 0, right: 0 }} />
              <input type="range" className="fp-range relative" min={0} max={1} step={0.005} value={scenario.gravityG} aria-label="Gravity"
                style={{ ["--pct" as string]: `${scenario.gravityG * 100}%`, ["--fill" as string]: "#FF8B32" }}
                onChange={(e) => setG(parseFloat(e.target.value))} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
              {[["μg", 0], ["Moon", 0.165], ["Mars", 0.38], ["Earth", 1]].map(([l, g]) => (
                <button key={l} onClick={() => setG(g as number)} className="hover:text-flame-1">{l}</button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Evidence kind="illustrative" />
            {partialG && <span className="text-[11.5px] text-amber-200/90">Partial g: bracketed by μg and 1 g data, not measured</span>}
          </div>
        </motion.section>

        {/* Coverage */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="panel flex flex-col p-5">
          <CardHead icon={<Box className="h-5 w-5 text-ox" />} title="Condition-Space Coverage" sub="Where PSI evidence exists around your mission."
            action={<button onClick={() => setTab("space")} className="chip-link shrink-0">3D View <ArrowRight className="h-3.5 w-3.5" /></button>} />
          <div className="mt-2 flex-1">
            {space ? <CoveragePreview space={space} scenario={scenario} uEff={uEff} missionName={name} highlight={top3} inVoid={inVoid} onOpen={() => setTab("space")} />
              : <Skeleton className="h-[260px]" />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-slate-300">
            <span className="flex items-center gap-2"><span className="led" style={{ color: "#087BFF" }} />Tested region</span>
            <span className="flex items-center gap-2"><span className="led" style={{ color: "#FF8B32" }} />High relevance</span>
            <span className="flex items-center gap-2"><span className="hatch h-3 w-3.5 rounded-[2px] border border-dashed border-ox-2" />Data gap</span>
            <span className="ml-auto"><Evidence kind={(space?.totalTests ?? 0) > 0 ? "psi" : "catalog"} label={(space?.totalTests ?? 0) > 0 ? "PSI tests" : "approx"} /></span>
          </div>
        </motion.section>

        {/* Quick intelligence */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.29 }} className="panel flex flex-col p-5 lg:col-span-2 2xl:col-span-1">
          <CardHead icon={<span className="grid h-5 w-5 place-items-center rounded-[4px] bg-blue text-[10px] font-bold text-white">SI</span>} title="Quick Intelligence"
            sub="From the top-ranked investigations for this mission."
            action={<button onClick={() => setTab("brief")} className="chip-link shrink-0">View Brief <ArrowRight className="h-3.5 w-3.5" /></button>} />
          <ul className="mt-3 flex-1 divide-y divide-[var(--line)]">
            {intel.map(({ p, id, text }) => (
              <li key={p} className="flex gap-3.5 py-3.5">
                <PillarIcon p={p} />
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold capitalize text-ink">{p}</div>
                  {text ? (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-slate-300">
                      {text}{" "}
                      <button onClick={() => openInvestigation(id!)} className="ml-0.5 inline rounded-[4px] border border-ox/35 bg-ox/10 px-1 font-mono text-[10px] text-[#9BE6FF] hover:bg-ox/20">{id}</button>
                    </p>
                  ) : analysis ? <p className="mt-0.5 text-[12.5px] text-amber-200/90">Insufficient evidence in the catalog for this pillar.</p>
                    : <Skeleton className="mt-1.5 h-8 w-full" />}
                </div>
              </li>
            ))}
          </ul>
          <div className="pt-1"><Evidence kind="catalog" label="Investigation summaries · approx" /></div>
        </motion.section>
      </div>

      {/* ───────── GAPS + TOP ───────── */}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[17px] font-semibold text-ink">Evidence gaps for this mission</h3>
            <span className="font-mono text-[11px] text-mute">{cov ? `${gaps.length} found` : ""}</span>
          </div>
          <div className="mt-4 grid gap-2.5 md:grid-cols-2">
            {!cov && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
            {gaps.map((g, i) => (
              <motion.div key={g.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="relative overflow-hidden rounded-[10px] border border-[var(--line)] bg-space-950/40 py-3 pl-4 pr-3">
                <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: SEVERITY_COLOR[g.severity] }} />
                <div className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: SEVERITY_COLOR[g.severity] }}>{g.severity}</div>
                <div className="mt-0.5 text-[13.5px] font-medium leading-snug text-ink">{g.title}</div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-mute" title={g.detail}>{g.detail}</p>
              </motion.div>
            ))}
            {cov && gaps.length === 0 && <div className="text-[13px] text-emerald-300">No major gaps: this scenario is well bracketed.</div>}
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[17px] font-semibold text-ink">Most relevant investigations</h3>
            <button onClick={() => setTab("ranking")} className="inline-flex items-center gap-1 text-[12.5px] text-ox hover:underline">Full ranking <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <ol className="mt-3 space-y-1">
            {!analysis && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}
            {analysis?.ranked.slice(0, 6).map((x, i) => (
              <li key={x.id}>
                <button onClick={() => openInvestigation(x.id)} className="flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-white/[0.04]">
                  <span className={`w-5 font-mono text-[11px] ${i < 3 ? "text-flame-2" : "text-slate-500"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{x.id}</span>
                    <span className="block truncate text-[11.5px] text-slate-500">{x.name}</span>
                  </span>
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                    <motion.span className="block h-full rounded-full" style={{ background: i < 3 ? "#FF8B32" : scoreColor(x.score) }}
                      initial={{ width: 0 }} animate={{ width: `${x.score}%` }} transition={{ duration: 0.7, delay: i * 0.05 }} />
                  </span>
                  <span className="w-8 text-right font-mono text-[13px] text-ink">{Math.round(x.score)}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <FlameModal open={flameOpen} onClose={() => setFlameOpen(false)} />
    </div>
  );
}

/** Full-screen flame laboratory bound to the live scenario. */
function FlameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { scenario, setScenario, analysis } = useMission();
  const r = analysis?.readout;
  const set = (patch: Partial<typeof scenario>) => setScenario((s) => ({ ...s, ...patch, habitatId: "custom" }));
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-[#020610]/80 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-label="Gravity flame laboratory" onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }}
            className="panel grid max-h-[92vh] w-full max-w-[1100px] overflow-hidden !rounded-[18px] lg:grid-cols-[1fr_360px]">
            <div className="relative h-[46vh] min-h-[320px] bg-[radial-gradient(ellipse_at_50%_70%,#0b1930,#020610_70%)] lg:h-auto">
              <FlameMorph flames={[{ g: scenario.gravityG, o2: scenario.o2Pct, flow: scenario.flowCmS }]} />
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <Evidence kind="illustrative" label="Illustrative · not a combustion model" />
              </div>
              <div className="absolute bottom-4 left-4 font-mono text-[12px] text-slate-300">
                g = {scenario.gravityG.toFixed(3)} · O₂ {scenario.o2Pct}% · {toPsi(scenario.pressureKpa)} psi · {scenario.flowCmS} cm/s
              </div>
            </div>
            <div className="overflow-y-auto p-6 scrollbar-thin">
              <div className="flex items-start justify-between">
                <div>
                  <div className="kicker !text-[10px]">Flame laboratory</div>
                  <h3 className="mt-1 font-display text-[20px] font-semibold text-ink">Gravity flame morph</h3>
                </div>
                <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-5 space-y-4">
                <Slider label="Gravity" value={scenario.gravityG} min={0} max={1} step={0.005} display={scenario.gravityG.toFixed(3)} unit=" g" color="#FF8B32" onChange={(v) => set({ gravityG: v })} />
                <Slider label="Oxygen" value={scenario.o2Pct} min={10} max={100} step={0.5} unit="%" color="#19C9FF" onChange={(v) => set({ o2Pct: v })} />
                <Slider label="Ventilation flow" value={scenario.flowCmS} min={0} max={60} step={0.5} unit=" cm/s" color="#48BFFF" onChange={(v) => set({ flowCmS: v })} />
              </div>
              <div className="mt-6 space-y-2.5 rounded-[12px] border border-[var(--line)] bg-space-950/50 p-4 text-[12.5px]">
                <div className="flex items-center justify-between"><span className="text-mute">Buoyant flow ≈ 30·√g cm/s</span><span className="font-mono text-ink">{r ? r.buoyantFlowCmS.toFixed(1) : "–"} cm/s</span></div>
                <div className="flex items-center justify-between"><span className="text-mute">Flow a flame feels</span><span className="font-mono text-ink">{r ? r.effectiveFlowCmS.toFixed(1) : "–"} cm/s</span></div>
                <div className="flex items-center justify-between"><span className="text-mute">Regime</span><span className="text-ink">{r?.regime.label ?? "–"}</span></div>
                <div className="pt-1"><Evidence kind="estimate" label="Order-of-magnitude estimate" /></div>
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-mute">
                At 1 g, hot gas rises and stretches the flame into a bright, sooty teardrop. Without buoyancy it becomes a dim, blue,
                near-spherical diffusion flame fed only by diffusion and forced flow. Lunar and Martian gravity sit between these
                extremes, where PSI holds no measurements.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
