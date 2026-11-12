"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeftRight, FileSearch, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fmtRange, PHASE_COLOR } from "@/lib/format";
import { useMission } from "@/lib/mission";
import type { CompareResult, GenomeEdge, GenomeNode } from "@/lib/types";
import { ConfidenceBadge, ErrorNote, PageHeader, Skeleton } from "./ui";

const W = 1100, H = 680;
export const REL_COLOR: Record<string, string> = {
  "follow-on": "#19C9FF", discovery: "#FF8B32", "shared-instrument": "#FFC15B", "proxy-for": "#48BFFF", informs: "#DCE7F5",
};
const DEPTH: Record<GenomeNode["kind"], number> = { facility: 0.25, apparatus: 0.6, investigation: 1 };
type P = GenomeNode & { x: number; y: number; r: number; lw: number };

const radius = (n: GenomeNode) => (n.kind === "facility" ? 26 : n.kind === "apparatus" ? 14 : 10 + Math.min(6, (n.tests ?? 0) / 10));
const labelOf = (n: GenomeNode) => (n.label.length > 24 ? n.label.slice(0, 23) + "…" : n.label);

/** Deterministic force layout, then a label-aware collision pass so nothing overlaps. */
function layout(nodes: GenomeNode[], edges: GenomeEdge[]): P[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts: P[] = nodes.map((n) => ({ ...n, x: W / 2 + (rnd() - 0.5) * 640, y: H / 2 + (rnd() - 0.5) * 460, r: radius(n), lw: labelOf(n).length * 6.4 + 8 }));
  const idx = new Map(pts.map((p, i) => [p.id, i]));
  const vx = new Float64Array(pts.length), vy = new Float64Array(pts.length);
  for (let it = 0; it < 520; it++) {
    const alpha = 1 - it / 520;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
      const d2 = Math.max(dx * dx + dy * dy, 50);
      const f = (6200 / d2) * alpha;
      const d = Math.sqrt(d2);
      vx[i] -= (dx / d) * f; vy[i] -= (dy / d) * f; vx[j] += (dx / d) * f; vy[j] += (dy / d) * f;
    }
    for (const e of edges) {
      const a = idx.get(e.source), b = idx.get(e.target);
      if (a === undefined || b === undefined) continue;
      const hier = !REL_COLOR[e.type];
      const len = hier ? (pts[a].kind === "facility" || pts[b].kind === "facility" ? 105 : 78) : 150;
      const k = hier ? 0.06 : 0.012;
      const dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - len) * k * alpha;
      vx[a] += (dx / d) * f; vy[a] += (dy / d) * f; vx[b] -= (dx / d) * f; vy[b] -= (dy / d) * f;
    }
    for (let i = 0; i < pts.length; i++) {
      vx[i] += (W / 2 - pts[i].x) * 0.004 * alpha; vy[i] += (H / 2 - pts[i].y) * 0.007 * alpha;
      pts[i].x += vx[i]; pts[i].y += vy[i];
      vx[i] *= 0.6; vy[i] *= 0.6;
    }
  }
  // collision: node disc + label box below it
  const box = (p: P) => ({ x0: p.x - Math.max(p.r, p.lw / 2) - 4, x1: p.x + Math.max(p.r, p.lw / 2) + 4, y0: p.y - p.r - 4, y1: p.y + p.r + 18 });
  for (let it = 0; it < 260; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = box(pts[i]), b = box(pts[j]);
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > 0 && oy > 0) {
        moved = true;
        if (ox < oy) { const s = (pts[i].x < pts[j].x ? -1 : 1) * (ox / 2 + 0.5); pts[i].x += s; pts[j].x -= s; }
        else { const s = (pts[i].y < pts[j].y ? -1 : 1) * (oy / 2 + 0.5); pts[i].y += s; pts[j].y -= s; }
      }
    }
    if (!moved) break;
  }
  // fit to the canvas
  const minX = Math.min(...pts.map((p) => p.x - Math.max(p.r, p.lw / 2))), maxX = Math.max(...pts.map((p) => p.x + Math.max(p.r, p.lw / 2)));
  const minY = Math.min(...pts.map((p) => p.y - p.r)), maxY = Math.max(...pts.map((p) => p.y + p.r + 18));
  const s = Math.min((W - 60) / (maxX - minX), (H - 50) / (maxY - minY), 1.25);
  return pts.map((p) => ({ ...p, x: 30 + (p.x - minX) * s + ((W - 60) - (maxX - minX) * s) / 2, y: 25 + (p.y - minY) * s + ((H - 50) - (maxY - minY) * s) / 2 }));
}

export function Genome() {
  const { openInvestigation, dataVersion, dataset } = useMission();
  const [graph, setGraph] = useState<{ nodes: GenomeNode[]; edges: GenomeEdge[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>("BASS-II");
  const [pair, setPair] = useState<[string, string] | null>(["BASS", "BASS-II"]);
  const [cmp, setCmp] = useState<CompareResult | null>(null);
  const [m, setM] = useState({ x: 0, y: 0 });
  const reduce = useReducedMotion();
  const raf = useRef(0);

  useEffect(() => { api.genome().then(setGraph).catch((e) => setErr(e.message)); }, [dataVersion]);
  useEffect(() => {
    if (pair) api.compare(pair[0], pair[1]).then(setCmp).catch((e) => setErr(e.message));
    else setCmp(null);
  }, [pair, dataVersion]);

  const pts = useMemo(() => (graph ? layout(graph.nodes, graph.edges) : []), [graph]);
  const neighbors = useMemo(() => {
    const mm = new Map<string, Set<string>>();
    graph?.edges.forEach((e) => {
      if (!mm.has(e.source)) mm.set(e.source, new Set());
      if (!mm.has(e.target)) mm.set(e.target, new Set());
      mm.get(e.source)!.add(e.target); mm.get(e.target)!.add(e.source);
    });
    return mm;
  }, [graph]);
  // parallax offset per depth layer
  const pos = useMemo(() => new Map(pts.map((p) => [p.id, { ...p, x: p.x + m.x * DEPTH[p.kind] * 16, y: p.y + m.y * DEPTH[p.kind] * 12 }])), [pts, m]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setM({ x: -nx, y: -ny }));
  };

  const focus = hover ?? sel;
  const near = (id: string) => !focus || focus === id || !!neighbors.get(focus)?.has(id);
  // strong isolation while hovering, a gentle one for a persistent selection
  const nodeOpacity = (id: string) => (near(id) ? 1 : hover ? 0.16 : 0.5);
  const node = sel ? pts.find((p) => p.id === sel) : null;
  const inv = node?.kind === "investigation" ? dataset?.investigations.find((i) => i.id === node.id) : null;
  const rels = (dataset?.relations ?? []).filter((r) => sel && (r.from === sel || r.to === sel));
  const hosted = node && node.kind !== "investigation" ? [...(neighbors.get(node.id) ?? [])].filter((id) => pts.find((p) => p.id === id)?.kind === "investigation") : [];
  const siblings = inv ? (dataset?.investigations ?? []).filter((x) => x.id !== inv.id && x.apparatus && x.apparatus === inv.apparatus).map((x) => x.id) : [];
  const allInv = pts.filter((p) => p.kind === "investigation").map((p) => p.id).sort();

  return (
    <div>
      <PageHeader index="05" kicker="Investigation genome" title="Hardware lineage & scientific ancestry">
        Facilities host apparatus, and apparatus host investigations. Experiments on the same hardware differ only in conditions and fuels, so they compare directly.
        Select any node to inspect it.
      </PageHeader>
      {err && <div className="mb-4"><ErrorNote message={err} /></div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="hud-frame relative overflow-hidden !rounded-[16px]">
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-x-4 gap-y-1.5 rounded-[10px] border border-[var(--line)] bg-space-950/75 px-3 py-2 backdrop-blur">
            {Object.entries(REL_COLOR).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] text-slate-300"><span className="h-0.5 w-4" style={{ background: c }} />{k}</span>
            ))}
          </div>
          {!graph ? <Skeleton className="h-[560px] !rounded-none !bg-transparent" /> : (
            <div className="overflow-x-auto scrollbar-thin">
              <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[760px]" onMouseMove={onMove} onMouseLeave={() => setM({ x: 0, y: 0 })}
                onClick={() => setSel(null)} role="img" aria-label="Investigation lineage graph">
                <defs>
                  <radialGradient id="g-fac" cx="40%" cy="35%"><stop offset="0" stopColor="#1b3354" /><stop offset="1" stopColor="#071225" /></radialGradient>
                  <radialGradient id="g-sel"><stop offset="0" stopColor="#FF8B32" stopOpacity="0.45" /><stop offset="1" stopColor="#FF8B32" stopOpacity="0" /></radialGradient>
                  <radialGradient id="g-hot"><stop offset="0" stopColor="#19C9FF" stopOpacity="0.35" /><stop offset="1" stopColor="#19C9FF" stopOpacity="0" /></radialGradient>
                </defs>
                <style>{`.flow{animation:dash 2.2s linear infinite}@keyframes dash{to{stroke-dashoffset:-18}}`}</style>
                {/* edges */}
                {graph.edges.map((e, i) => {
                  const a = pos.get(e.source), b = pos.get(e.target);
                  if (!a || !b) return null;
                  const rel = REL_COLOR[e.type];
                  const on = !focus || focus === e.source || focus === e.target;
                  const mx = (a.x + b.x) / 2 + (rel ? (b.y - a.y) * 0.2 : 0), my = (a.y + b.y) / 2 - (rel ? (b.x - a.x) * 0.2 : 0);
                  return (
                    <path key={i} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} fill="none" className={rel && on ? "flow" : undefined}
                      stroke={rel ?? "#2a3e5e"} strokeWidth={rel ? 1.7 : 1} strokeDasharray={rel ? "6 3" : undefined}
                      style={{ opacity: on ? (rel ? 0.95 : 0.6) : hover ? 0.06 : rel ? 0.45 : 0.3, transition: "opacity .25s" }}>
                      {e.note && <title>{`${e.source} → ${e.target}: ${e.type} · ${e.note}`}</title>}
                    </path>
                  );
                })}
                {/* nodes, back layer first */}
                {[...pts].sort((a, b) => DEPTH[a.kind] - DEPTH[b.kind]).map((p0, i) => {
                  const n = pos.get(p0.id)!;
                  const chosen = sel === n.id;
                  const inPair = pair?.includes(n.id);
                  const color = n.kind === "facility" ? "#A5B8D2" : n.kind === "apparatus" ? "#48BFFF"
                    : n.status === "pending" ? "#8FD8FF" : PHASE_COLOR[n.fuelPhase?.[0] ?? ""] ?? "#A5B8D2";
                  return (
                    <motion.g key={n.id} initial={{ opacity: 0 }} animate={{ opacity: nodeOpacity(n.id) }}
                      transition={{ delay: graph ? 0.1 + i * 0.01 : 0, duration: 0.3 }}
                      style={{ cursor: "pointer" }} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                      onClick={(ev) => { ev.stopPropagation(); setSel(n.id); }}
                      onDoubleClick={() => n.kind === "investigation" && openInvestigation(n.id)}>
                      {chosen && <circle cx={n.x} cy={n.y} r={n.r + 18} fill="url(#g-sel)" />}
                      {!chosen && hover === n.id && <circle cx={n.x} cy={n.y} r={n.r + 14} fill="url(#g-hot)" />}
                      {n.kind === "facility" ? (
                        <>
                          <circle cx={n.x} cy={n.y} r={n.r + 7} fill="none" stroke="#2a3e5e" strokeDasharray="2 4" />
                          <circle cx={n.x} cy={n.y} r={n.r} fill="url(#g-fac)" stroke={chosen ? "#FF8B32" : "#566C8E"} strokeWidth={chosen ? 2 : 1.2} />
                          <text x={n.x} y={n.label.length <= 5 ? n.y + 4 : n.y + n.r + 15} textAnchor="middle" className="fill-slate-200 font-mono text-[10.5px] font-semibold">{labelOf(n)}</text>
                        </>
                      ) : (
                        <>
                          <circle cx={n.x} cy={n.y} r={n.r} fill={n.kind === "investigation" ? `${color}2e` : "#0B1930"}
                            stroke={chosen ? "#FF8B32" : inPair ? "#FFC15B" : color} strokeWidth={chosen ? 2.4 : inPair ? 2 : 1.4}
                            strokeDasharray={n.status === "pending" ? "3 2" : undefined} />
                          {n.kind === "investigation" && <circle cx={n.x} cy={n.y} r={2.4} fill={color} />}
                          <text x={n.x} y={n.y + n.r + 13} textAnchor="middle"
                            className={n.kind === "apparatus" ? "fill-[#8fc3ff] text-[10.5px]" : "fill-slate-200 font-mono text-[11px]"}>{labelOf(n)}</text>
                        </>
                      )}
                      <title>{n.name ?? n.label}</title>
                    </motion.g>
                  );
                })}
              </svg>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] tracking-[0.14em] text-slate-500">CLICK TO INSPECT · DOUBLE-CLICK FOR DOSSIER</div>
        </section>

        {/* inspector */}
        <aside className="panel p-5">
          <div className="label">Inspector</div>
          <AnimatePresence mode="wait">
            {!node ? (
              <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 text-[13px] text-mute">
                Select a facility, apparatus or investigation in the graph.
              </motion.p>
            ) : (
              <motion.div key={node.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mt-3">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500">{node.kind}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-display text-[22px] font-semibold text-ink">{node.label}</span>
                  {inv && <ConfidenceBadge c={inv.conditions.confidence} />}
                </div>
                {node.name && <p className="mt-0.5 text-[13px] text-mute">{node.name}</p>}

                {inv ? (
                  <>
                    <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      <span className="rounded-[6px] border border-[var(--line)] px-2 py-0.5 text-slate-300">{inv.facility}</span>
                      <span className="text-slate-600">→</span>
                      <span className="rounded-[6px] border border-[var(--line)] px-2 py-0.5 text-[#8fc3ff]">{inv.apparatus ?? "apparatus n/a"}</span>
                      <span className="text-slate-600">→</span>
                      <span className="rounded-[6px] border border-ox/40 px-2 py-0.5 text-ink">{inv.id}</span>
                    </div>
                    <div className="mt-4 divide-y divide-[var(--line)] text-[12.5px]">
                      <div className="flex justify-between py-1.5"><span className="text-mute">Fuel</span><span className="text-right text-ink">{inv.fuelPhase.join(", ")}</span></div>
                      <div className="flex justify-between py-1.5"><span className="text-mute">Status</span><span className="text-ink">{inv.status === "pending" ? "Expected" : "In PSI"}</span></div>
                      <div className="flex justify-between py-1.5"><span className="text-mute">O₂</span><span className="font-mono text-[12px] text-ink">{fmtRange(inv.conditions.o2Pct, " %")}</span></div>
                    </div>
                    {rels.length > 0 && (
                      <>
                        <div className="label mb-2 mt-4">Relations</div>
                        <ul className="space-y-1.5">
                          {rels.map((r, i) => {
                            const other = r.from === inv.id ? r.to : r.from;
                            return (
                              <li key={i} className="rounded-[8px] bg-space-950/50 px-3 py-2 text-[12px]">
                                <div className="flex items-center gap-2">
                                  <span className="h-0.5 w-3" style={{ background: REL_COLOR[r.type] }} />
                                  <span style={{ color: REL_COLOR[r.type] }}>{r.type}</span>
                                  <button onClick={() => setSel(other)} className="ml-auto font-mono text-ink hover:text-ox">{other}</button>
                                </div>
                                {r.note && <p className="mt-1 leading-snug text-slate-500">{r.note}</p>}
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                    {siblings.length > 0 && (
                      <>
                        <div className="label mb-2 mt-4">Same hardware</div>
                        <div className="flex flex-wrap gap-1.5">{siblings.map((s) => <button key={s} onClick={() => setSel(s)} className="rounded-[6px] border border-[var(--line)] px-2 py-0.5 font-mono text-[11px] text-slate-200 hover:border-ox/40">{s}</button>)}</div>
                      </>
                    )}
                    <div className="label mb-2 mt-5">Compare with</div>
                    <div className="flex gap-2">
                      <select aria-label="Compare with" value={pair && pair.includes(inv.id) ? pair.find((x) => x !== inv.id) : ""}
                        onChange={(e) => e.target.value && setPair([inv.id, e.target.value])}
                        className="min-w-0 flex-1 rounded-[8px] border border-[var(--line-strong)] bg-space-900 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-ox/60">
                        <option value="">Choose an investigation…</option>
                        {allInv.filter((x) => x !== inv.id).map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                    <button onClick={() => openInvestigation(inv.id)} className="btn btn-outline mt-4 w-full justify-center"><FileSearch className="h-4 w-4" />Open dossier</button>
                  </>
                ) : (
                  <>
                    <div className="label mb-2 mt-4">Hosts {hosted.length} investigation{hosted.length === 1 ? "" : "s"}</div>
                    <div className="flex flex-wrap gap-1.5">{hosted.map((s) => <button key={s} onClick={() => setSel(s)} className="rounded-[6px] border border-[var(--line)] px-2 py-0.5 font-mono text-[11px] text-slate-200 hover:border-ox/40">{s}</button>)}</div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>

      <AnimatePresence mode="wait">
        {cmp && pair && (
          <motion.section key={pair.join("|")} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="panel mt-5 p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <ArrowLeftRight className="h-4 w-4 text-ox" />
              <h3 className="font-display text-[18px] font-semibold text-ink">{cmp.a.id} <span className="text-slate-500">vs</span> {cmp.b.id}</h3>
              {cmp.sharedHardware.length > 0 && <span className="rounded-[6px] border border-ox/30 bg-ox/[0.06] px-2 py-0.5 text-[11.5px] text-[#9BE6FF]">shared: {cmp.sharedHardware.join(", ")}</span>}
              <button onClick={() => setPair(null)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink" aria-label="Clear comparison"><X className="h-4 w-4" /></button>
            </div>
            <ul className="mb-4 space-y-1 text-[13px] text-slate-300">{cmp.summary.map((s) => <li key={s}>› {s}</li>)}</ul>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead><tr className="label"><th className="w-40 py-2 font-normal">Attribute</th><th className="py-2 font-normal">{cmp.a.id}</th><th className="py-2 font-normal">{cmp.b.id}</th><th className="w-16 py-2 text-center font-normal">Same</th></tr></thead>
                <tbody>
                  {cmp.rows.map((r) => (
                    <tr key={r.label} className="border-t border-[var(--line)] align-top">
                      <td className="py-2 text-mute">{r.label}</td>
                      <td className="py-2 pr-4 text-slate-200">{String(r.a)}</td>
                      <td className="py-2 pr-4 text-slate-200">{String(r.b)}</td>
                      <td className="py-2 text-center">{r.label === "Imported tests" ? "–" : r.same ? <span className="text-emerald-300">●</span> : <span className="text-flame-1">◆</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
