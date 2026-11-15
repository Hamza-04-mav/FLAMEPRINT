"use client";

import { motion } from "framer-motion";
import { AreaChart, Info, Table2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { fmtRange, OUTCOME_COLOR } from "@/lib/format";
import { useMission } from "@/lib/mission";
import type { ConditionSpace } from "@/lib/types";
import { EvidenceMark } from "./ui";

const W = 700, H = 420, PAD = { l: 58, r: 16, t: 16, b: 54 };
const X_MAX = 60, Y_MIN = 10, Y_MAX = 50;
const sx = (v: number) => PAD.l + (Math.min(Math.max(v, 0), X_MAX) / X_MAX) * (W - PAD.l - PAD.r);
const sy = (v: number) => H - PAD.b - ((Math.min(Math.max(v, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b);

/**
 * Oxygen × airflow gap map. The whole plot is dark "untested" space; tested ranges light up softly where they exist;
 * the habitat is a glowing dot. Optional: the schematic limiting-O₂ curve (teaching aid) and the full legend.
 */
export function FlammabilityMap({ space, missionName = "your habitat", showCurve = false, detailed = false }: {
  space: ConditionSpace | null; missionName?: string; showCurve?: boolean; detailed?: boolean;
}) {
  const { scenario, analysis } = useMission();
  const [more, setMore] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const uid = useId().replace(/:/g, "");
  const uEff = analysis?.readout.effectiveFlowCmS ?? scenario.flowCmS;
  const curve = useMemo(() => !space ? "" : space.schematicCurve.filter((p) => p.flowCmS <= X_MAX)
    .map((p, i) => `${i ? "L" : "M"}${sx(p.flowCmS).toFixed(1)},${sy(p.o2Pct).toFixed(1)}`).join(" "), [space]);
  const boxes = (space?.envelopes ?? []).filter((e) => e.envelope.o2Pct && e.envelope.flowCmS && e.status !== "pending");
  const tests = (space?.tests ?? []).filter((t) => t.flowCmS != null);
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const mx = sx(uEff), my = sy(scenario.o2Pct);
  const labelLeft = mx > W - 190;

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button onClick={() => setAsTable((x) => !x)} aria-pressed={asTable} className="btn btn-ghost !px-2 !py-1 text-[12px]">
          {asTable ? <><AreaChart className="h-3.5 w-3.5" />View as chart</> : <><Table2 className="h-3.5 w-3.5" />View as table</>}
        </button>
      </div>
      {asTable ? (
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
      ) : (
      <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Oxygen versus airflow: tested ranges and ${missionName} at ${Math.round(scenario.o2Pct)}% oxygen, ${uEff.toFixed(0)} centimetres per second`}>
        <defs>
          <pattern id={`void${uid}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="9" stroke="#8a8178" strokeOpacity="0.18" strokeWidth="1" />
          </pattern>
          <radialGradient id={`glow${uid}`}>
            <stop offset="0" stopColor="#FFD23F" stopOpacity="0.5" />
            <stop offset="1" stopColor="#FFD23F" stopOpacity="0" />
          </radialGradient>
          <filter id={`soft${uid}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>

        {/* the void: everything is untested unless a range lights it up */}
        <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} rx={10} fill="#0a111d" />
        <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} rx={10} fill={`url(#void${uid})`} />
        <text x={W - PAD.r - 14} y={PAD.t + 22} textAnchor="end" className="fill-slate-400 font-mono text-[14px] tracking-[0.2em]">UNTESTED</text>

        {/* axes */}
        {[10, 20, 30, 40, 50].map((y) => (
          <text key={y} x={PAD.l - 10} y={sy(y) + 4} textAnchor="end" className="fill-slate-400 font-mono text-[14px]">{y}%</text>
        ))}
        {[0, 10, 20, 30, 40, 50, 60].map((x) => (
          <text key={x} x={sx(x)} y={H - PAD.b + 22} textAnchor="middle" className="fill-slate-400 font-mono text-[14px]">{x}</text>
        ))}
        <text x={PAD.l + plotW / 2} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[15px]">Airflow the flame feels (cm/s)</text>
        <text x={14} y={PAD.t + plotH / 2} textAnchor="middle" transform={`rotate(-90 14 ${PAD.t + plotH / 2})`} className="fill-slate-400 text-[15px]">Oxygen</text>

        {/* tested ranges: soft light inside the void */}
        {boxes.map((e) => {
          const [o0, o1] = e.envelope.o2Pct!; const [f0, f1] = e.envelope.flowCmS!;
          const data = e.envelope.confidence === "data";
          const x = sx(f0), w = Math.max(4, sx(f1) - sx(f0)), y = sy(o1), h = Math.max(4, sy(o0) - sy(o1));
          return (
            <g key={e.id}>
              <rect x={x} y={y} width={w} height={h} rx={4} fill={data ? "#c2bab0" : "#a39a90"} fillOpacity={data ? 0.22 : 0.14} filter={`url(#soft${uid})`} />
              <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={data ? "#c2bab0" : "#a39a90"} strokeOpacity={0.5}
                strokeDasharray={data ? undefined : "4 4"}>
                <title>{`${e.id}: tested ${o0}–${o1}% O₂, ${f0}–${f1} cm/s (${data ? "PSI data" : "approx"})`}</title>
              </rect>
            </g>
          );
        })}

        {showCurve && (
          <g>
            <path d={curve} fill="none" stroke="#a39a90" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.7} />
            <text x={sx(44)} y={sy(19)} className="fill-dust-400 font-mono text-[12px]">schematic limit<title>Schematic limiting-O₂ curve — illustrative teaching aid, not measured.</title></text>
          </g>
        )}

        {tests.map((t) => (
          <circle key={t.id} cx={sx(t.flowCmS!)} cy={sy(t.o2Pct)} r={3.5} fill={OUTCOME_COLOR[t.outcome] ?? "#d8d1c7"} stroke="#0a111d" strokeWidth={1}>
            <title>{`${t.investigationId} · ${t.o2Pct}% O₂ · ${t.flowCmS} cm/s · ${t.outcome} (${t.source})`}</title>
          </circle>
        ))}

        {/* the habitat: a glowing yellow dot ("you are here"), no looping pulse */}
        <motion.g initial={false} animate={{ x: mx, y: my }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}>
          <circle r={30} fill={`url(#glow${uid})`} />
          <circle r={7} fill="#FFD23F" stroke="#0a111d" strokeWidth={1.5} />
          <text x={labelLeft ? -14 : 14} y={-12} textAnchor={labelLeft ? "end" : "start"} className="fill-dust-100 text-[17px] font-semibold">{missionName}</text>
        </motion.g>
      </svg>

      {/* legend: at most 4 visible; the rest live in a "?" popover */}
      <div className="relative mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-dust-400">
        <span className="flex items-center gap-2"><span className="h-3 w-4 rounded-[3px] border border-dust-400/60 bg-dust-400/20" />Tested range</span>
        <span className="flex items-center gap-2"><span className="hatch h-3 w-4 rounded-[3px] ring-1 ring-dust-700" />Untested</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sun shadow-[0_0_8px_var(--sun-glow)]" />{missionName}</span>
        <button onClick={() => setMore((x) => !x)} aria-expanded={more} className="flex items-center gap-1 text-dust-500 transition-colors hover:text-dust-200">
          <Info className="h-3.5 w-3.5" />More
        </button>
        {more && (
          <div className="panel-float absolute left-0 top-full z-20 mt-2 flex flex-col gap-2 p-3 text-[12px] text-dust-300">
            <span className="flex items-center gap-2"><EvidenceMark kind="psi" />Solid range = from PSI test records · dashed = catalog approx</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-4 rounded-[3px] border border-dashed border-dust-400/60" />Dashed box = approximate (verify vs PSI)</span>
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
      </>
      )}
    </div>
  );
}
