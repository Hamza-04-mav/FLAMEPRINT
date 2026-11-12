"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { nF, nO2, nP, plottable } from "@/lib/space";
import type { ConditionSpace } from "@/lib/types";

const W = 470, H = 300;
// linear isometric basis: u = pressure (front-left edge), w = airflow (receding right), v = O₂ (up, log)
const O = { x: 52, y: 196 };
const UA = { x: 200, y: 46 }, WA = { x: 180, y: -76 }, VA = { x: 0, y: -150 };
const proj = (u: number, v: number, w: number) => ({ x: O.x + UA.x * u + WA.x * w + VA.x * v, y: O.y + UA.y * u + WA.y * w + VA.y * v });

type Pt = { x: number; y: number };
function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const poly = (pts: Pt[]) => pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
function box(u0: number, u1: number, v0: number, v1: number, w0: number, w1: number) {
  const c: Pt[] = [];
  for (const u of [u0, u1]) for (const v of [v0, v1]) for (const w of [w0, w1]) c.push(proj(u, v, w));
  return hull(c);
}

export function CoveragePreview({ space, scenario, uEff, missionName, highlight, inVoid, onOpen }: {
  space: ConditionSpace | null; scenario: { o2Pct: number; pressureKpa: number }; uEff: number; missionName: string;
  highlight: Set<string>; inVoid: boolean; onOpen: () => void;
}) {
  const envs = useMemo(() => plottable(space), [space]);
  const target = proj(nP(scenario.pressureKpa), nO2(scenario.o2Pct), nF(uEff));
  const floor = proj(nP(scenario.pressureKpa), 0, nF(uEff));
  const gapBox = inVoid ? box(
    Math.max(0, nP(scenario.pressureKpa) - 0.09), Math.min(1, nP(scenario.pressureKpa) + 0.09),
    Math.max(0, nO2(scenario.o2Pct) - 0.1), Math.min(1, nO2(scenario.o2Pct) + 0.1),
    Math.max(0, nF(uEff) - 0.1), Math.min(1, nF(uEff) + 0.1),
  ) : null;
  const tests = space?.tests.filter((t) => t.pressureKpa != null || t.flowCmS != null) ?? [];

  const frame = {
    floor: [proj(0, 0, 0), proj(1, 0, 0), proj(1, 0, 1), proj(0, 0, 1)],
    left: [proj(0, 0, 0), proj(0, 1, 0), proj(0, 1, 1), proj(0, 0, 1)],
    back: [proj(0, 0, 1), proj(0, 1, 1), proj(1, 1, 1), proj(1, 0, 1)],
  };
  const pLabel = proj(0.5, 0, 0), fLabel = proj(1, 0, 0.5);

  return (
    <button onClick={onOpen} className="group block w-full text-left" aria-label="Open the 3D coverage map">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        <defs>
          <pattern id="gap-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#48BFFF" strokeOpacity="0.35" strokeWidth="1.4" />
          </pattern>
          <radialGradient id="beacon"><stop offset="0" stopColor="#FFC15B" /><stop offset="0.5" stopColor="#FF8B32" stopOpacity="0.5" /><stop offset="1" stopColor="#FF8B32" stopOpacity="0" /></radialGradient>
        </defs>
        {/* walls with grid */}
        {[frame.left, frame.back, frame.floor].map((f, i) => (
          <polygon key={i} points={poly(f)} fill={i === 2 ? "rgba(8,123,255,0.06)" : "rgba(8,123,255,0.025)"} stroke="rgba(72,170,255,0.3)" strokeWidth={0.8} />
        ))}
        {[0.2, 0.4, 0.6, 0.8].map((t) => {
          const L = (a: Pt, b: Pt) => <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          return (
            <g key={t} stroke="rgba(72,170,255,0.11)" strokeWidth={0.6}>
              {L(proj(t, 0, 0), proj(t, 0, 1))}{L(proj(0, 0, t), proj(1, 0, t))}
              {L(proj(0, t, 0), proj(0, t, 1))}{L(proj(0, t, 1), proj(1, t, 1))}
              {L(proj(0, 0, t), proj(0, 1, t))}{L(proj(t, 0, 1), proj(t, 1, 1))}
            </g>
          );
        })}
        {[15, 21, 30, 50, 85].map((o) => {
          const q = proj(0, nO2(o), 0);
          return <text key={o} x={q.x - 7} y={q.y + 3} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">{o}%</text>;
        })}
        {[30, 70, 101].map((k) => {
          const q = proj(nP(k), 0, 0);
          return <text key={k} x={q.x - 2} y={q.y + 14} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">{k}</text>;
        })}
        {[0, 20, 40, 60].map((f) => {
          const q = proj(1, 0, nF(f));
          return <text key={f} x={q.x + 9} y={q.y + 9} className="fill-slate-500 font-mono text-[10px]">{f}</text>;
        })}
        <text x={proj(0, 1, 0).x} y={proj(0, 1, 0).y - 10} textAnchor="middle" className="fill-mute text-[11.5px]">O₂ % (log)</text>
        <text x={pLabel.x - 8} y={pLabel.y + 32} textAnchor="middle" className="fill-mute text-[11.5px]">Pressure (kPa)</text>
        <text x={fLabel.x + 30} y={fLabel.y + 30} textAnchor="middle" className="fill-mute text-[11.5px]">Airflow (cm/s)</text>

        {/* envelopes */}
        {envs.map((e, i) => {
          const env = e.envelope;
          const p = env.pressureKpa, f = env.flowCmS;
          const hb = box(p ? nP(p[0]) : 0, p ? nP(p[1]) : 1, nO2(env.o2Pct![0]), nO2(env.o2Pct![1]), f ? nF(f[0]) : 0, f ? nF(f[1]) : 1);
          const hot = highlight.has(e.id);
          const partial = !p || !f;
          const c = hot ? "#FF8B32" : "#087BFF";
          return (
            <motion.polygon key={e.id} points={poly(hb)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.03 }}
              fill={c} fillOpacity={partial ? 0.05 : hot ? 0.24 : 0.16} stroke={hot ? "#FF8B32" : "#48BFFF"} strokeOpacity={partial ? 0.35 : 0.8}
              strokeWidth={hot ? 1.2 : 0.8} strokeDasharray={env.confidence === "data" ? undefined : partial ? "2 3" : undefined}>
              <title>{`${e.id} · ${env.confidence}${partial ? " · an axis is not characterized (spans full range)" : ""}`}</title>
            </motion.polygon>
          );
        })}

        {/* imported PSI tests */}
        {tests.map((t) => {
          const q = proj(nP(t.pressureKpa ?? 0), nO2(t.o2Pct), nF(t.flowCmS ?? 0));
          return <circle key={t.id} cx={q.x} cy={q.y} r={1.8} fill="#19C9FF" opacity={0.85} />;
        })}

        {/* data gap around the mission */}
        {gapBox && <polygon points={poly(gapBox)} fill="url(#gap-hatch)" stroke="#48BFFF" strokeWidth={1} strokeDasharray="4 3" />}

        {/* beacon */}
        <line x1={floor.x} y1={floor.y} x2={target.x} y2={target.y} stroke="#FF8B32" strokeDasharray="3 3" strokeOpacity={0.6} />
        <ellipse cx={floor.x} cy={floor.y} rx={7} ry={2.5} fill="none" stroke="#FF8B32" strokeOpacity={0.6} />
        <motion.g animate={{ x: target.x, y: target.y }} transition={{ type: "spring", stiffness: 120, damping: 18 }}>
          <circle r={18} fill="url(#beacon)">
            <animate attributeName="r" values="12;20;12" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <circle r={6.5} fill="none" stroke="#FFC15B" strokeWidth={1.5} />
          <circle r={3} fill="#FFF3DC" />
          <g transform="translate(14,-46)">
            <rect width={132} height={36} rx={6} fill="rgba(7,18,37,0.92)" stroke="#FF8B32" strokeOpacity={0.7} />
            <text x={10} y={15} className="fill-ink text-[10.5px] font-medium">Your scenario</text>
            <text x={10} y={28} className="fill-mute text-[9.5px]">{missionName.length > 22 ? missionName.slice(0, 21) + "…" : missionName}</text>
          </g>
        </motion.g>
      </svg>
    </button>
  );
}
