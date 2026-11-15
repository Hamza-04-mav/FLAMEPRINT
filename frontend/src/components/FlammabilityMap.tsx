"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { AreaChart, Info, Table2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fmtRange, OUTCOME_COLOR } from "@/lib/format";
import { useMission } from "@/lib/mission";
import { CHART, DROP, SPRING } from "@/lib/motion";
import { habitatFlow, nearestTested } from "@/lib/space";
import { DUST, INK, SUN } from "@/lib/theme";
import type { ConditionSpace } from "@/lib/types";
import { EvidenceMark } from "./ui";

export const MAP_W = 700, MAP_H = 420;
const W = MAP_W, H = MAP_H, PAD = { l: 74, r: 18, t: 18, b: 58 };
const X_MAX = 60, Y_MIN = 10, Y_MAX = 50;
const sx = (v: number) => PAD.l + (Math.min(Math.max(v, 0), X_MAX) / X_MAX) * (W - PAD.l - PAD.r);
const sy = (v: number) => H - PAD.b - ((Math.min(Math.max(v, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b);
const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;

type Hot = { id: string; x: number; y: number } | null;

/**
 * Oxygen × airflow gap map. The whole plot is dark "untested" space; tested ranges light up where they exist
 * (stacked ranges read brighter: "more tested here"); the habitat is a glowing dot with a dashed connector to the
 * nearest tested data, labelled with the oxygen distance. Everything plotted comes from /api/condition-space and
 * /api/analyze; nothing is invented. Entrance plays once, when scrolled into view (not with reduced motion).
 */
export function FlammabilityMap({ space, missionName = "your habitat", showCurve = false, detailed = false, renderStage, chrome = true }: {
  space: ConditionSpace | null; missionName?: string; showCurve?: boolean; detailed?: boolean;
  /** Wrap the SVG (e.g. to stack a 3D canvas behind it for the 2D↔3D morph). */
  renderStage?: (svg: React.ReactNode) => React.ReactNode;
  /** Show the table toggle and legend (hidden while in 3D). */
  chrome?: boolean;
}) {
  const { scenario, analysis, habitats, applyHabitat } = useMission();
  const [more, setMore] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const [hot, setHot] = useState<Hot>(null);
  const [landed, setLanded] = useState(false); // after the entrance drop, moves glide on a plain spring
  const uid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion();
  const seen = useInView(box, { once: true, margin: "-40px" });
  const started = seen || !!reduce;
  const anim = !reduce;

  const uEff = analysis?.readout.effectiveFlowCmS ?? scenario.flowCmS;
  const curve = useMemo(() => !space ? "" : space.schematicCurve.filter((p) => p.flowCmS <= X_MAX)
    .map((p, i) => `${i ? "L" : "M"}${sx(p.flowCmS).toFixed(1)},${sy(p.o2Pct).toFixed(1)}`).join(" "), [space]);
  // big ranges first, so small ones sit on top and stay hoverable
  const boxes = useMemo(() => (space?.envelopes ?? [])
    .filter((e) => e.envelope.o2Pct && e.envelope.flowCmS && e.status !== "pending")
    .sort((a, b) => {
      const area = (e: typeof a) => (e.envelope.flowCmS![1] - e.envelope.flowCmS![0] + 1) * (e.envelope.o2Pct![1] - e.envelope.o2Pct![0] + 1);
      return area(b) - area(a);
    }), [space]);
  const tests = useMemo(() => (space?.tests ?? []).filter((t) => t.flowCmS != null), [space]);
  const mxp = sx(uEff), myp = sy(scenario.o2Pct);
  const labelLeft = mxp > W - 200;

  // gap connector: nearest tested data (ranges + PSI points) to the habitat
  const near = useMemo(() => nearestTested(uEff, scenario.o2Pct,
    boxes.map((e) => ({ f0: e.envelope.flowCmS![0], f1: e.envelope.flowCmS![1], o0: e.envelope.o2Pct![0], o1: e.envelope.o2Pct![1] })),
    tests.map((t) => ({ flow: t.flowCmS!, o2: t.o2Pct }))), [boxes, tests, uEff, scenario.o2Pct]);

  // a short fading trail when the habitat moves
  const prev = useRef<{ x: number; y: number } | null>(null);
  const [trail, setTrail] = useState<{ x0: number; y0: number; x1: number; y1: number; k: number } | null>(null);
  useEffect(() => {
    const p = prev.current;
    if (p && started && anim && (Math.abs(p.x - mxp) > 2 || Math.abs(p.y - myp) > 2)) setTrail({ x0: p.x, y0: p.y, x1: mxp, y1: myp, k: Date.now() });
    prev.current = { x: mxp, y: myp };
  }, [mxp, myp]); // eslint-disable-line react-hooks/exhaustive-deps

  const ghosts = habitats.filter((h) => h.id !== scenario.habitatId);
  const n = boxes.length;
  const dotDelay = anim ? CHART.axes * 0.6 + n * CHART.stagger + CHART.grow * 0.6 : 0;

  const toLocal = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };
  const svgToLocal = (x: number, y: number) => {
    const s = svgRef.current!.getBoundingClientRect(), b = box.current!.getBoundingClientRect();
    const k = Math.min(s.width / W, s.height / H), ox = (s.width - W * k) / 2, oy = (s.height - H * k) / 2;
    return { x: s.left - b.left + ox + x * k, y: s.top - b.top + oy + y * k };
  };
  const hotBox = hot ? boxes.find((e) => e.id === hot.id) : null;

  const svg = (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className={renderStage ? "absolute inset-0 h-full w-full" : "w-full"} role="img"
      aria-label={`Oxygen versus airflow: tested ranges and ${missionName} at ${Math.round(scenario.o2Pct)}% oxygen, ${uEff.toFixed(0)} centimetres per second`}>
      <defs>
        <pattern id={`void${uid}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke={DUST[500]} strokeOpacity="0.2" strokeWidth="1" />
        </pattern>
        <radialGradient id={`glow${uid}`}>
          <stop offset="0" stopColor={SUN[500]} stopOpacity="0.5" />
          <stop offset="1" stopColor={SUN[500]} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`plot${uid}`}><rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} rx={10} /></clipPath>
      </defs>

      {/* the void: everything is untested unless a range lights it up */}
      <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} rx={10} fill={INK[950]} />
      {started && (
        <motion.rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} rx={10} fill={`url(#void${uid})`}
          initial={anim ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: CHART.hatch, delay: anim ? CHART.axes * 0.4 : 0 }} />
      )}
      <text x={W - PAD.r - 14} y={PAD.t + 24} textAnchor="end" className="fill-slate-400 font-mono text-[14px] tracking-[0.2em]">UNTESTED</text>

      {/* axes draw in */}
      {started && (
        <g stroke={DUST[600]} strokeWidth={1.2} fill="none">
          <motion.path d={`M${PAD.l},${H - PAD.b} L${W - PAD.r},${H - PAD.b}`} initial={anim ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: CHART.axes }} />
          <motion.path d={`M${PAD.l},${H - PAD.b} L${PAD.l},${PAD.t}`} initial={anim ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: CHART.axes }} />
        </g>
      )}
      {[10, 20, 30, 40, 50].map((y) => (
        <text key={y} x={PAD.l - 10} y={sy(y) + 5} textAnchor="end" className="fill-slate-400 font-mono text-[14px]">{y}%</text>
      ))}
      {[0, 10, 20, 30, 40, 50, 60].map((x) => (
        <text key={x} x={sx(x)} y={H - PAD.b + 24} textAnchor="middle" className="fill-slate-400 font-mono text-[14px]">{x}</text>
      ))}
      <text x={PAD.l + plotW / 2} y={H - 10} textAnchor="middle" className="fill-slate-400 text-[15px]">Airflow the flame feels (cm/s)</text>
      <text x={20} y={PAD.t + plotH / 2} textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 20 ${PAD.t + plotH / 2})`} className="fill-slate-400 text-[15px]">Oxygen</text>

      {/* tested ranges: low-opacity fills stack, so overlaps read as "more tested here" */}
      <g clipPath={`url(#plot${uid})`}>
        {started && boxes.map((e, i) => {
          const [o0, o1] = e.envelope.o2Pct!; const [f0, f1] = e.envelope.flowCmS!;
          const data = e.envelope.confidence === "data";
          const x = sx(f0), w = Math.max(5, sx(f1) - sx(f0)), y = sy(o1), h = Math.max(5, sy(o0) - sy(o1));
          const isHot = hot?.id === e.id, dim = !!hot && !isHot;
          const label = `${e.id}: tested ${fmtRange(e.envelope.o2Pct, "% O₂")}, ${fmtRange(e.envelope.flowCmS, " cm/s")} (${data ? "PSI data" : "approx"})`;
          return (
            <motion.g key={e.id} tabIndex={0} role="img" aria-label={label} className="cursor-default outline-none"
              animate={{ opacity: dim ? 0.4 : 1, y: isHot ? -3 : 0 }} transition={SPRING}
              onPointerEnter={(ev) => setHot({ id: e.id, ...toLocal(ev.clientX, ev.clientY) })}
              onPointerMove={(ev) => setHot({ id: e.id, ...toLocal(ev.clientX, ev.clientY) })}
              onPointerLeave={() => setHot(null)}
              onFocus={() => setHot({ id: e.id, ...svgToLocal(x + w / 2, y) })} onBlur={() => setHot(null)}>
              <motion.rect x={x} y={y} width={w} height={h} rx={4}
                style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                initial={anim ? { scaleY: 0 } : false} animate={{ scaleY: 1 }}
                transition={{ duration: CHART.grow, ease: [0.22, 1, 0.36, 1], delay: anim ? CHART.axes * 0.6 + i * CHART.stagger : 0 }}
                fill={data ? DUST[300] : DUST[400]} fillOpacity={isHot ? 0.32 : data ? 0.11 : 0.07}
                stroke={isHot ? DUST[100] : data ? DUST[300] : DUST[400]} strokeOpacity={isHot ? 1 : 0.6} strokeWidth={isHot ? 1.8 : 1.25}
                strokeDasharray={data ? undefined : "5 4"} />
            </motion.g>
          );
        })}
      </g>

      {showCurve && (
        <g>
          <path d={curve} fill="none" stroke={DUST[400]} strokeWidth={1.4} strokeDasharray="5 4" opacity={0.7} />
          <text x={sx(44)} y={sy(19)} className="fill-dust-400 font-mono text-[12px]">schematic limit<title>Schematic limiting-O₂ curve — illustrative teaching aid, not measured.</title></text>
        </g>
      )}

      {started && tests.map((t) => (
        <circle key={t.id} cx={sx(t.flowCmS!)} cy={sy(t.o2Pct)} r={3} fill={OUTCOME_COLOR[t.outcome] ?? DUST[200]} fillOpacity={0.85} stroke={INK[950]} strokeWidth={0.8}
          pointerEvents="none" />
      ))}

      {/* other habitats: faint ghost dots, tap to switch */}
      {started && ghosts.map((h) => {
        const gx = sx(habitatFlow(h)), gy = sy(h.o2Pct), clipped = h.o2Pct > Y_MAX;
        return (
          <g key={h.id} role="button" tabIndex={0} aria-label={`Switch to ${h.name} (${Math.round(h.o2Pct)}% O₂)`} className="group cursor-pointer outline-none [&:focus-visible>circle]:stroke-[var(--sun)]"
            onClick={() => applyHabitat(h)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); applyHabitat(h); } }}>
            <title>{`${h.name}: ${Math.round(h.o2Pct)}% O₂${clipped ? " (above this chart)" : ""}. Tap to switch.`}</title>
            <circle cx={gx} cy={gy} r={12} fill="transparent" />
            <circle cx={gx} cy={gy} r={5} fill={DUST[400]} fillOpacity={0.45} stroke={DUST[300]} strokeOpacity={0.6} strokeWidth={1.2} />
            {/* names appear on hover/focus only, so they never collide with the connector or the habitat label */}
            <text x={gx + 9} y={gy + (clipped ? 18 : -9)} className="fill-dust-300 text-[12px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">{h.short}{clipped ? " ↑" : ""}</text>
          </g>
        );
      })}

      {/* trail + gap connector + the habitat ("you are here") */}
      <AnimatePresence>
        {trail && (
          <motion.line key={trail.k} x1={trail.x0} y1={trail.y0} x2={trail.x1} y2={trail.y1} stroke={SUN[500]} strokeWidth={4} strokeLinecap="round"
            initial={{ opacity: 0.5 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: CHART.trail }}
            onAnimationComplete={() => setTrail(null)} />
        )}
      </AnimatePresence>
      {started && near && (() => {
        const nx = sx(near.flow), ny = sy(near.o2);
        const tx = (mxp + nx) / 2, ty = (myp + ny) / 2;
        const label = Math.abs(near.dO2) >= 0.5 ? `${near.dO2 > 0 ? "+" : ""}${near.dO2} pts O₂ from tested data` : "outside the tested airflow";
        return (
          <g key={`c-${scenario.habitatId}-${Math.round(mxp)}-${Math.round(myp)}`} pointerEvents="none">
            <motion.line x1={mxp} y1={myp} stroke={DUST[200]} strokeWidth={1.6} strokeDasharray="6 5"
              initial={anim ? { x2: mxp, y2: myp } : { x2: nx, y2: ny }} animate={{ x2: nx, y2: ny }}
              transition={{ duration: CHART.connector, ease: [0.22, 1, 0.36, 1], delay: anim ? dotDelay + 0.35 : 0 }} />
            <motion.circle cx={nx} cy={ny} r={3.5} fill={DUST[100]} initial={anim ? { opacity: 0 } : false} animate={{ opacity: 1 }}
              transition={{ delay: anim ? dotDelay + 0.35 + CHART.connector : 0 }} />
            <motion.text x={tx + 10} y={ty} className="fill-dust-200 text-[13px]" dominantBaseline="middle"
              initial={anim ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: anim ? dotDelay + 0.35 + CHART.connector : 0 }}>
              {label}
            </motion.text>
          </g>
        );
      })()}
      {started && (
        <motion.g initial={anim ? { x: mxp, y: myp - 46, opacity: 0 } : false} animate={{ x: mxp, y: myp, opacity: 1 }}
          onAnimationComplete={() => setLanded(true)}
          transition={landed || !anim ? DROP : { ...DROP, opacity: { duration: 0.2, delay: dotDelay }, y: { ...DROP, delay: dotDelay } }}>
          {anim && (
            <motion.circle r={7} fill="none" stroke={SUN[500]} strokeWidth={2} initial={{ r: 7, opacity: 0.7 }} animate={{ r: 30, opacity: 0 }}
              transition={{ duration: 0.9, delay: dotDelay + 0.3, ease: "easeOut" }} />
          )}
          <circle r={30} fill={`url(#glow${uid})`} />
          <circle r={7} fill={SUN[500]} stroke={INK[950]} strokeWidth={1.5} />
          <text x={labelLeft ? -14 : 14} y={-14} textAnchor={labelLeft ? "end" : "start"} className="fill-dust-100 text-[17px] font-semibold">{missionName}</text>
        </motion.g>
      )}
    </svg>
  );

  return (
    <div ref={box} className="relative">
      {chrome && (
        <div className="mb-2 flex justify-end">
          <button onClick={() => setAsTable((x) => !x)} aria-pressed={asTable} className="btn btn-ghost !px-2 !py-1 text-[12px]">
            {asTable ? <><AreaChart className="h-3.5 w-3.5" />View as chart</> : <><Table2 className="h-3.5 w-3.5" />View as table</>}
          </button>
        </div>
      )}
      {asTable && chrome ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <caption className="sr-only">NASA-tested oxygen and airflow ranges, and where {missionName} sits.</caption>
            <thead>
              <tr className="text-dust-400">
                <th scope="col" className="py-1.5 pr-3 font-medium">Investigation</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Tested O₂</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Tested airflow</th>
                <th scope="col" className="py-1.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-dust-200">
              <tr className="border-y border-[var(--line)]">
                <th scope="row" className="py-1.5 pr-3 font-semibold text-sun">{missionName} (you)</th>
                <td className="py-1.5 pr-3">{Math.round(scenario.o2Pct)} %</td>
                <td className="py-1.5 pr-3">{uEff.toFixed(1)} cm/s</td>
                <td className="py-1.5 font-sans text-dust-400">your scenario</td>
              </tr>
              {boxes.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)]">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-dust-100">{e.id}</th>
                  <td className="py-1.5 pr-3">{fmtRange(e.envelope.o2Pct, " %")}</td>
                  <td className="py-1.5 pr-3">{fmtRange(e.envelope.flowCmS, " cm/s")}</td>
                  <td className="py-1.5 font-sans text-dust-400">{e.envelope.confidence === "data" ? "PSI data" : "catalog approx"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (renderStage ? renderStage(svg) : svg)}

      {/* tooltip springs out from the pointer */}
      <AnimatePresence>
        {hotBox && hot && !asTable && (
          <motion.div key={hot.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={SPRING} style={{ left: hot.x, top: hot.y, transformOrigin: "0% 100%" }}
            className="panel-float pointer-events-none absolute z-20 -translate-y-[calc(100%+12px)] translate-x-3 whitespace-nowrap px-3 py-2 text-[12px] text-dust-200">
            <div className="font-semibold text-dust-100">{hotBox.id}</div>
            <div className="font-mono tabular-nums">{fmtRange(hotBox.envelope.o2Pct, "% O₂")} · {fmtRange(hotBox.envelope.flowCmS, " cm/s")}</div>
            <div className="text-dust-400">{hotBox.envelope.confidence === "data" ? "PSI data" : "approx"}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* legend: at most 4 visible; the rest live in a "More" popover */}
      {chrome && (
        <div className="relative mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-dust-400">
          <span className="flex items-center gap-2"><span className="h-3 w-4 shrink-0 rounded-[3px] border border-dust-400/60 bg-dust-400/20" />Tested range</span>
          <span className="flex items-center gap-2"><span className="hatch h-3 w-4 shrink-0 rounded-[3px] ring-1 ring-dust-700" />Untested</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sun shadow-[0_0_8px_var(--sun-glow)]" />{missionName}</span>
          <button onClick={() => setMore((x) => !x)} aria-expanded={more} className="flex items-center gap-1 text-dust-500 transition-colors hover:text-dust-200">
            <Info className="h-3.5 w-3.5" />More
          </button>
          {more && (
            <div className="panel-float absolute left-0 top-full z-20 mt-2 flex flex-col gap-2 p-3 text-[12px] text-dust-300">
              <span className="flex items-center gap-2"><EvidenceMark kind="psi" />Solid range = from PSI test records · dashed = catalog approx</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-dust-400/50 ring-1 ring-dust-300/60" />Faint dots = other habitats (tap to switch)</span>
              <span className="flex items-center gap-2"><span className="h-px w-5 border-t border-dashed border-dust-200" />Dashed line = distance to the nearest tested data</span>
              {detailed && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  {Object.entries(OUTCOME_COLOR).map(([k, c]) => (
                    <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{k}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
