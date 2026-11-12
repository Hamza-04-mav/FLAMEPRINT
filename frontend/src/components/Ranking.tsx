"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ChevronDown, FileSearch, RotateCcw } from "lucide-react";
import { useState } from "react";
import { fmtRange, scoreColor } from "@/lib/format";
import { DEFAULT_WEIGHTS, useMission } from "@/lib/mission";
import type { Factor, Ranked, Weights } from "@/lib/types";
import { ConfidenceBadge, PageHeader, Skeleton, Slider } from "./ui";

export const FACTOR_COLOR: Record<keyof Weights, string> = {
  o2: "#19C9FF", pressure: "#087BFF", flow: "#8FD8FF", material: "#FF8B32", pillar: "#FFC15B", gravity: "#A5B8D2",
};
const FACTOR_NAME: Record<keyof Weights, string> = {
  o2: "O₂ proximity", pressure: "Pressure proximity", flow: "Flow compatibility", material: "Material compatibility",
  pillar: "Safety focus", gravity: "Gravity compatibility",
};
const FACTOR_SHORT: Record<keyof Weights, string> = { o2: "O₂", pressure: "Pressure", flow: "Flow", material: "Material", gravity: "Gravity", pillar: "Focus" };
const ORDER: (keyof Weights)[] = ["o2", "pressure", "flow", "material", "gravity", "pillar"];
const COLS = "md:grid-cols-[40px_minmax(170px,1.5fr)_84px_repeat(6,minmax(52px,1fr))_96px_24px]";

function FactorCell({ f }: { f?: Factor }) {
  if (!f) return <span className="text-slate-600">–</span>;
  const pct = Math.round(f.score * 100);
  return (
    <div title={`${f.label}: ${pct}% · ${f.why}`} className="pr-2">
      <div className="font-mono text-[11.5px] tabular-nums text-slate-200">{pct}</div>
      <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-slate-800">
        <motion.div className="h-full rounded-full" style={{ background: FACTOR_COLOR[f.key], opacity: f.confidence === "unknown" ? 0.45 : 1 }}
          animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  );
}

function Breakdown({ r, onOpen }: { r: Ranked; onOpen: () => void }) {
  const ws = r.factors.reduce((a, f) => a + f.weight, 0) || 1;
  const contrib = r.factors.map((f) => ({ f, pts: (100 * f.weight * f.score) / ws })).sort((a, b) => b.pts - a.pts);
  return (
    <div className="grid gap-5 border-t border-[var(--line)] p-4 lg:grid-cols-[1.2fr_1fr] sm:p-5">
      <div>
        <div className="label mb-3">How the score is built</div>
        <div className="space-y-2.5">
          {contrib.map(({ f, pts }) => (
            <div key={f.key}>
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="flex items-center gap-2 text-slate-200"><span className="h-2 w-2 rounded-[2px]" style={{ background: FACTOR_COLOR[f.key] }} />{FACTOR_NAME[f.key]}</span>
                <span className="font-mono text-[11.5px] text-mute">{Math.round(f.score * 100)}% × {Math.round((f.weight / ws) * 100)}% = <span className="text-ink">{pts.toFixed(1)}</span></span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <motion.div className="h-full rounded-full" style={{ background: FACTOR_COLOR[f.key] }} initial={{ width: 0 }} animate={{ width: `${pts}%` }} transition={{ duration: 0.6 }} />
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{f.why}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        <div className="label mb-3">Tested envelope</div>
        <div className="well divide-y divide-[var(--line)] px-3">
          {[["O₂", fmtRange(r.envelope.o2Pct, " %")], ["Pressure", fmtRange(r.envelope.pressureKpa, " kPa")], ["Flow", fmtRange(r.envelope.flowCmS, " cm/s")]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 text-[12.5px]"><span className="text-mute">{k}</span><span className="font-mono text-[12px] text-ink">{v}</span></div>
          ))}
          <div className="flex items-center justify-between py-2 text-[12.5px]"><span className="text-mute">Evidence</span><ConfidenceBadge c={r.envelope.confidence} /></div>
          <div className="flex justify-between py-2 text-[12.5px]"><span className="text-mute">Imported tests near you</span><span className="font-mono text-[12px] text-ink">{r.totalTests ? `${r.nearbyTests} / ${r.totalTests}` : "none imported"}</span></div>
        </div>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="font-mono text-[11px] text-slate-500">Σ = {Math.round(r.score)}</span>
          <button onClick={onOpen} className="btn btn-outline !py-1.5"><FileSearch className="h-4 w-4" />Open dossier</button>
        </div>
      </div>
    </div>
  );
}

export function Ranking() {
  const { analysis, weights, setWeights, openInvestigation, dataset, habitats, scenario } = useMission();
  const [open, setOpen] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const pending = new Set(dataset?.investigations.filter((i) => i.status === "pending").map((i) => i.id));
  const rows = (analysis?.ranked ?? []).filter((r) => showPending || !pending.has(r.id));
  const hab = habitats.find((h) => h.id === scenario.habitatId);

  return (
    <div>
      <PageHeader index="03" kicker="Investigation rankings" title={<>Which experiments matter for <span className="text-ox">{hab?.name ?? "this mission"}</span></>}>
        A transparent weighted score over six compatibility factors. Change a weight and the leaderboard re-ranks live. Expand any row to audit it.
      </PageHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel overflow-hidden">
          {/* header row */}
          <div className={`hidden items-end gap-2 border-b border-[var(--line)] px-4 py-3 md:grid ${COLS}`}>
            <span className="label !text-[9.5px]">#</span>
            <span className="label !text-[9.5px]">Investigation</span>
            <span className="label !text-[9.5px]">Relevance</span>
            {ORDER.map((k) => (
              <span key={k} className="label flex items-center gap-1.5 !text-[9.5px]"><span className="h-1.5 w-1.5 rounded-[1px]" style={{ background: FACTOR_COLOR[k] }} />{FACTOR_SHORT[k]}</span>
            ))}
            <span className="label !text-[9.5px]">Evidence</span>
            <span />
          </div>
          {!analysis && <div className="space-y-2 p-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
          <LayoutGroup>
            <ol>
              {rows.map((r, i) => {
                const isOpen = open === r.id;
                const top = i < 3;
                const fx = new Map(r.factors.map((f) => [f.key, f]));
                return (
                  <motion.li layout key={r.id} transition={{ type: "spring", stiffness: 280, damping: 32 }}
                    className={`relative border-b border-[var(--line)] last:border-0 ${isOpen ? "bg-blue/[0.06]" : "hover:bg-white/[0.02]"}`}>
                    {top && <span className="absolute inset-y-0 left-0 w-[2px] bg-flame-2" />}
                    <button onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}
                      className={`grid w-full grid-cols-[32px_1fr_auto_20px] items-center gap-2 px-4 py-3 text-left ${COLS}`}>
                      <span className={`font-mono text-[12px] ${top ? "text-flame-2" : "text-slate-500"}`}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-display text-[15px] font-semibold text-ink">{r.id}</span>
                          {pending.has(r.id) && <span className="rounded-[4px] border border-ox-2/40 px-1.5 font-mono text-[9.5px] uppercase text-ox-2">expected</span>}
                        </span>
                        <span className="block truncate text-[11.5px] text-slate-500">{r.name}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-display text-[22px] font-semibold tabular-nums" style={{ color: top ? "#FFC15B" : scoreColor(r.score) }}>{Math.round(r.score)}</span>
                      </span>
                      {ORDER.map((k) => <span key={k} className="hidden md:block"><FactorCell f={fx.get(k)} /></span>)}
                      <span className="hidden md:block"><ConfidenceBadge c={r.envelope.confidence} /></span>
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      {/* compact contribution bar on mobile */}
                      <span className="col-span-4 flex h-1.5 overflow-hidden rounded-full bg-slate-800 md:hidden">
                        {r.factors.map((f) => (
                          <motion.span key={f.key} animate={{ width: `${(f.weight * f.score * 100) / wsum}%` }} style={{ background: FACTOR_COLOR[f.key] }} className="block h-full" />
                        ))}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
                          <Breakdown r={r} onOpen={() => openInvestigation(r.id)} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ol>
          </LayoutGroup>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-[112px] xl:self-start">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[16px] font-semibold text-ink">Factor weights</h3>
              <button onClick={() => setWeights(DEFAULT_WEIGHTS)} className="flex items-center gap-1.5 text-[12px] text-mute hover:text-ox"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
            </div>
            {/* weight distribution */}
            <div className="mt-4 flex h-2 overflow-hidden rounded-full">
              {ORDER.map((k) => <motion.span key={k} animate={{ width: `${(weights[k] / wsum) * 100}%` }} style={{ background: FACTOR_COLOR[k] }} className="block h-full" />)}
            </div>
            <div className="mt-5 space-y-4">
              {ORDER.map((k) => (
                <Slider key={k} label={FACTOR_NAME[k]} value={weights[k]} min={0} max={1} step={0.05} color={FACTOR_COLOR[k]}
                  display={`${Math.round((weights[k] / wsum) * 100)}`} unit="%" onChange={(v) => setWeights({ ...weights, [k]: v })} />
              ))}
            </div>
            <label className="mt-5 flex items-center gap-2 text-[12.5px] text-mute">
              <input type="checkbox" checked={showPending} onChange={(e) => setShowPending(e.target.checked)} className="accent-[#087BFF]" />
              Include expected investigations (LUCI, FM2)
            </label>
          </section>
          <section className="panel p-5">
            <div className="label mb-2">Scoring model</div>
            <div className="well p-3 font-mono text-[11px] leading-relaxed text-slate-300">
              score = 100 · Σ wᵢ·sᵢ / Σ wᵢ<br />
              sᵢ = exp(−(d/scale)²)<br />
              <span className="text-slate-500">d = distance outside the tested range</span>
            </div>
            <ul className="mt-3 space-y-1 text-[11.5px] text-mute">
              <li>approx envelopes × 0.92</li><li>uncharacterized axis → 0.3 credit</li><li>expected, not yet in PSI × 0.6</li>
            </ul>
            <p className="mt-3 text-[11.5px] leading-snug text-slate-500">Deterministic code. The language model never sets a score.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
