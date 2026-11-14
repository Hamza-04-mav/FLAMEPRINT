"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ChevronDown, FileSearch, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { clamp, fmtRange, toPsi } from "@/lib/format";
import { DEFAULT_WEIGHTS, useMission } from "@/lib/mission";
import { DUST } from "@/lib/theme";
import type { Range, Ranked, Weights } from "@/lib/types";
import { GradeBadge } from "./GradeBadge";
import { ConfidenceBadge, PageHeader, Skeleton, Slider } from "./ui";

// relevance factors are not risk → dust tints only (no hue)
const FACTOR_COLOR: Record<keyof Weights, string> = {
  o2: DUST[200], pressure: DUST[300], flow: DUST[400], material: DUST[300], pillar: DUST[400], gravity: DUST[500],
};
const FACTOR_NAME: Record<keyof Weights, string> = {
  o2: "Oxygen match", pressure: "Pressure match", flow: "Airflow match", material: "Fuel or material match",
  pillar: "Safety area match", gravity: "Gravity match",
};
const ORDER: (keyof Weights)[] = ["o2", "pressure", "flow", "material", "gravity", "pillar"];
const TOP = 5;
const EASE = [0.2, 0.7, 0.2, 1] as const;

/** One tiny axis strip: tested span as a taupe segment, the habitat as a yellow dot. */
function Strip({ k, value, min, max, tested }: { k: string; value: number; min: number; max: number; tested: Range | null }) {
  const pos = (v: number) => clamp(((v - min) / (max - min)) * 100, 0, 100);
  const d = pos(value), t0 = tested ? pos(tested[0]) : 0, t1 = tested ? pos(tested[1]) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-6 shrink-0 font-mono text-[10px] text-dust-500">{k}</span>
      <span className="relative h-1.5 flex-1 rounded-full" style={{ background: "rgba(138,129,120,0.18)" }}>
        {tested && <span className="absolute inset-y-0 rounded-full" style={{ left: `${t0}%`, width: `${Math.max(2, t1 - t0)}%`, background: "rgba(163,154,144,0.45)" }} />}
        <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${d}%`, background: "var(--sun-500)", boxShadow: "0 0 0 1px var(--sun-ring), 0 0 8px 1px var(--sun-glow)" }} />
      </span>
    </div>
  );
}

/** Compact relevance ring (0–100). Relevance is not risk, so it stays dust. */
function ScoreRing({ value }: { value: number }) {
  const size = 42, stroke = 4, r = size / 2 - stroke, c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }} title={`Relevance ${Math.round(value)} / 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(138,129,120,0.2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={DUST[200]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * clamp(value, 0, 100)) / 100} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] tabular-nums text-dust-100">{Math.round(value)}</span>
    </div>
  );
}

/** Four coverage strips per row: where the habitat sits vs. what this investigation tested. */
function MiniCoverage({ r }: { r: Ranked }) {
  const { scenario } = useMission();
  const p = r.envelope.pressureKpa;
  return (
    <div className="mt-2 grid max-w-[440px] grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
      <Strip k="O₂" value={scenario.o2Pct} min={10} max={100} tested={r.envelope.o2Pct} />
      <Strip k="kPa" value={toPsi(scenario.pressureKpa)} min={0} max={16} tested={p ? [toPsi(p[0]), toPsi(p[1])] : null} />
      <Strip k="air" value={scenario.flowCmS} min={0} max={60} tested={r.envelope.flowCmS} />
      <Strip k="g" value={scenario.gravityG} min={0} max={1} tested={null} />
    </div>
  );
}

/** Expanded row: the six factor bars, the tested range and the dossier link. No nested boxes. */
function Breakdown({ r, onOpen }: { r: Ranked; onOpen: () => void }) {
  const ws = r.factors.reduce((a, f) => a + f.weight, 0) || 1;
  // ordered by how much each factor adds to the score
  const contrib = r.factors.map((f) => ({ f, pts: (100 * f.weight * f.score) / ws })).sort((a, b) => b.pts - a.pts);
  const p = r.envelope.pressureKpa;
  return (
    <div className="grid gap-x-10 gap-y-6 px-5 pb-6 pt-1 sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <ul className="space-y-3">
        {contrib.map(({ f }) => (
          <li key={f.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-slate-200">{FACTOR_NAME[f.key]}</span>
              <span className="font-mono text-[11.5px] text-mute">{Math.round(f.score * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <motion.div className="h-full rounded-full" style={{ background: FACTOR_COLOR[f.key], opacity: f.confidence === "unknown" ? 0.5 : 1 }}
                initial={{ width: 0 }} animate={{ width: `${Math.max(2, f.score * 100)}%` }} transition={{ duration: 0.3, ease: EASE }} />
            </div>
            <p className="mt-1 text-[12px] leading-snug text-slate-500">{f.why}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 text-[13px]">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-mute">Tested range</div>
        <dl className="space-y-1.5">
          <div className="flex justify-between gap-3"><dt className="text-mute">Oxygen</dt><dd className="font-mono text-ink">{fmtRange(r.envelope.o2Pct, "%")}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-mute">Pressure</dt><dd className="font-mono text-ink">{p ? `${fmtRange([toPsi(p[0]), toPsi(p[1])], " psi")}` : fmtRange(null, "")}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-mute">Airflow</dt><dd className="font-mono text-ink">{fmtRange(r.envelope.flowCmS, " cm/s")}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-mute">Relevance</dt><dd className="font-mono text-ink">{Math.round(r.score)} / 100</dd></div>
        </dl>
        {r.grade && <p className="text-[12.5px] leading-snug text-mute">Grade {r.grade.letter}: {r.grade.reason}.</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <ConfidenceBadge c={r.envelope.confidence} />
          <button onClick={onOpen} className="btn btn-outline !py-1.5"><FileSearch className="h-4 w-4" />Open dossier</button>
        </div>
      </div>
    </div>
  );
}

function Row({ r, i, open, onToggle, planned }: { r: Ranked; i: number; open: boolean; onToggle: () => void; planned: boolean }) {
  const { openInvestigation } = useMission();
  return (
    <motion.li layout="position" transition={{ duration: 0.28, ease: EASE }} className={open ? "bg-white/[0.025]" : ""}>
      <button onClick={onToggle} aria-expanded={open}
        className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto_20px] items-center gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-white/[0.02] sm:px-6">
        <span className={`font-mono text-[13px] ${i < 3 ? "text-dust-200" : "text-slate-500"}`}>{i + 1}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[16px] font-semibold text-ink">{r.id}</span>
            <span className="truncate text-[13px] text-slate-500">{r.name}</span>
            {planned && <span className="font-mono text-[10px] text-dust-400">planned</span>}
          </span>
          <MiniCoverage r={r} />
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden sm:block"><ScoreRing value={r.score} /></span>
          <GradeBadge grade={r.grade} size="md" inert />
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
            <Breakdown r={r} onOpen={() => openInvestigation(r.id)} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function Scoring({ showPending, setShowPending }: { showPending: boolean; setShowPending: (v: boolean) => void }) {
  const { weights, setWeights } = useMission();
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="grid gap-8 px-5 pb-6 pt-2 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {ORDER.map((k) => (
          <Slider key={k} label={FACTOR_NAME[k]} value={weights[k]} min={0} max={1} step={0.05} color={FACTOR_COLOR[k]}
            display={`${Math.round((weights[k] / wsum) * 100)}`} unit="%" onChange={(v) => setWeights({ ...weights, [k]: v })} />
        ))}
      </div>
      <div className="space-y-3 text-[12.5px] text-mute">
        <p className="font-mono text-[11.5px] leading-relaxed text-slate-300">score = 100 · Σ wᵢ·sᵢ / Σ wᵢ · sᵢ = exp(−(d/scale)²)</p>
        <p>d = distance outside the tested range. Approx ranges × 0.92, an untested axis gets 0.3 credit, planned investigations × 0.6.
          Deterministic code: the language model never sets a score.</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showPending} onChange={(e) => setShowPending(e.target.checked)} className="accent-[#8a8178]" />
          Include planned investigations (LUCI, FM2)
        </label>
        <button onClick={() => setWeights(DEFAULT_WEIGHTS)} className="inline-flex items-center gap-1.5 text-ox hover:underline"><RotateCcw className="h-3.5 w-3.5" />Reset weights</button>
      </div>
    </div>
  );
}

export function Ranking() {
  const { analysis, dataset, habitats, scenario } = useMission();
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [showPending, setShowPending] = useState(true);
  const pending = new Set(dataset?.investigations.filter((i) => i.status === "pending").map((i) => i.id));
  const rows = (analysis?.ranked ?? []).filter((r) => showPending || !pending.has(r.id));
  const shown = all ? rows : rows.slice(0, TOP);
  const hab = habitats.find((h) => h.id === scenario.habitatId);

  return (
    <div>
      <PageHeader kicker="Evidence" title="Which NASA experiments back this up?">
        The {TOP} investigations closest to {hab ? `the ${hab.name}` : "this habitat"}, each with an evidence grade.
      </PageHeader>

      <section className="panel overflow-hidden">
        {!analysis && <div className="space-y-2 p-5">{[...Array(TOP)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}
        <LayoutGroup>
          <ol className="divide-y divide-[var(--line)]">
            {shown.map((r, i) => (
              <Row key={r.id} r={r} i={i} planned={pending.has(r.id)} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
            ))}
          </ol>
        </LayoutGroup>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        {rows.length > TOP && (
          <button onClick={() => setAll((x) => !x)} aria-expanded={all} className="btn btn-ghost !px-0">
            {all ? "Show top 5 only" : `Show all ${rows.length}`}<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${all ? "rotate-180" : ""}`} />
          </button>
        )}
        <button onClick={() => setTuning((x) => !x)} aria-expanded={tuning} className="btn btn-ghost !px-0">
          <SlidersHorizontal className="h-4 w-4" />Adjust scoring<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${tuning ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {tuning && (
          <motion.section initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }} className="panel mt-4 overflow-hidden">
            <Scoring showPending={showPending} setShowPending={setShowPending} />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
