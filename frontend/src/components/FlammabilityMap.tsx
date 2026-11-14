"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { useMission } from "@/lib/mission";
import { OUTCOME_COLOR, PHASE_COLOR } from "@/lib/format";
import type { ConditionSpace } from "@/lib/types";
import { EvidenceMark } from "./ui";

const W = 560, H = 300, PAD = { l: 44, r: 14, t: 14, b: 34 };
const X_MAX = 60, Y_MIN = 10, Y_MAX = 50;
const sx = (v: number) => PAD.l + (Math.min(v, X_MAX) / X_MAX) * (W - PAD.l - PAD.r);
const sy = (v: number) => H - PAD.b - ((Math.min(Math.max(v, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b);

/** O₂ × flow plane: catalog envelopes, imported PSI test outcomes, the schematic limiting-O₂ curve and the scenario. */
export function FlammabilityMap({ space }: { space: ConditionSpace | null }) {
  const { scenario, analysis } = useMission();
  const uEff = analysis?.readout.effectiveFlowCmS ?? scenario.flowCmS;

  const curve = useMemo(() => {
    if (!space) return "";
    return space.schematicCurve.filter((p) => p.flowCmS <= X_MAX)
      .map((p, i) => `${i ? "L" : "M"}${sx(p.flowCmS).toFixed(1)},${sy(p.o2Pct).toFixed(1)}`).join(" ");
  }, [space]);

  const boxes = (space?.envelopes ?? []).filter((e) => e.envelope.o2Pct && e.envelope.flowCmS && e.status !== "pending");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="hud-frame w-full" role="img" aria-label="Oxygen versus flow coverage map">
        {/* grid */}
        {[10, 20, 30, 40, 50].map((y) => (
          <g key={y}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(y)} y2={sy(y)} stroke="rgba(148,163,184,0.1)" />
            <text x={PAD.l - 8} y={sy(y) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[9px]">{y}%</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40, 50, 60].map((x) => (
          <g key={x}>
            <line y1={PAD.t} y2={H - PAD.b} x1={sx(x)} x2={sx(x)} stroke="rgba(148,163,184,0.07)" />
            <text x={sx(x)} y={H - PAD.b + 13} textAnchor="middle" className="fill-slate-500 font-mono text-[9px]">{x}</text>
          </g>
        ))}
        <text x={(W + PAD.l) / 2} y={H - 4} textAnchor="middle" className="fill-slate-400 text-[10px]">effective flow (cm/s)</text>
        <text x={11} y={H / 2} textAnchor="middle" transform={`rotate(-90 11 ${H / 2})`} className="fill-slate-400 text-[10px]">O₂ (%)</text>

        {/* Earth-impossible low-flow band in 1 g */}
        <rect x={sx(0)} y={PAD.t} width={sx(20) - sx(0)} height={H - PAD.t - PAD.b} fill="url(#lowflow)" />
        <defs>
          <linearGradient id="lowflow" x1="0" x2="1">
            <stop offset="0" stopColor="#19C9FF" stopOpacity="0.07" />
            <stop offset="1" stopColor="#19C9FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <text x={sx(1)} y={PAD.t + 10} className="fill-ox/60 text-[9px]">flow regime only reachable in μg</text>

        {/* catalog envelopes */}
        {boxes.map((e) => {
          const [o0, o1] = e.envelope.o2Pct!; const [f0, f1] = e.envelope.flowCmS!;
          const c = PHASE_COLOR[e.fuelPhase[0]] ?? "#94a3b8";
          const x = sx(f0), w = Math.max(3, sx(f1) - sx(f0)), y = sy(o1), h = Math.max(3, sy(o0) - sy(o1));
          return (
            <g key={e.id}>
              <rect x={x} y={y} width={w} height={h} rx={2} fill={c} fillOpacity={e.envelope.confidence === "data" ? 0.22 : 0.1}
                stroke={c} strokeOpacity={0.6} strokeDasharray={e.envelope.confidence === "data" ? undefined : "3 3"}>
                <title>{`${e.id}: ${o0}–${o1}% O₂, ${f0}–${f1} cm/s (${e.envelope.confidence})`}</title>
              </rect>
            </g>
          );
        })}

        {/* schematic curve (labelled) */}
        <path d={curve} fill="none" stroke="#48BFFF" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.8} />
        <text x={sx(46)} y={sy(18.5)} className="fill-[#48BFFF] font-mono text-[8.5px]">SCHEMATIC LIMIT · ILLUSTRATIVE</text>

        {/* imported PSI tests */}
        {(space?.tests ?? []).filter((t) => t.flowCmS != null).map((t) => (
          <circle key={t.id} cx={sx(t.flowCmS!)} cy={sy(t.o2Pct)} r={3.2} fill={OUTCOME_COLOR[t.outcome] ?? "#e2e8f0"}
            stroke="#050A15" strokeWidth={0.8}>
            <title>{`${t.investigationId} · ${t.o2Pct}% O₂ · ${t.flowCmS} cm/s · ${t.outcome} (${t.source})`}</title>
          </circle>
        ))}

        {/* scenario */}
        <motion.g animate={{ x: sx(uEff), y: sy(scenario.o2Pct) }} transition={{ type: "spring", stiffness: 140, damping: 18 }}>
          <circle r={14} fill="#FF8B32" opacity={0.12}>
            <animate attributeName="r" values="8;18;8" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle r={5} fill="#FF8B32" stroke="#fff7ed" strokeWidth={1.5} />
          <text x={9} y={-8} className="fill-orange-200 text-[10px] font-semibold">your mission</text>
        </motion.g>
      </svg>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><EvidenceMark kind="catalog" />catalog tested range (approx)</span>
        <span className="flex items-center gap-1.5"><EvidenceMark kind="psi" />tested range from PSI tests</span>
        {Object.entries(OUTCOME_COLOR).map(([k, c]) => (
          <span key={k}><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c }} />{k}</span>
        ))}
        <span className="flex items-center gap-1.5 text-[#48BFFF]"><EvidenceMark kind="illustrative" />schematic U-curve (teaching aid, not data)</span>
      </div>
      {space && space.plottedTests === 0 && (
        <div className="mt-2 text-[11.5px] text-slate-500">No PSI test points imported yet. Import test matrices in the Data Lab and they will appear here as dots.</div>
      )}
    </div>
  );
}
