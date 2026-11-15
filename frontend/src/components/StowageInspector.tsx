"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Luggage, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LEVEL_STYLE, placeName } from "@/lib/answer";
import { api, ApiError } from "@/lib/api";
import { useMission } from "@/lib/mission";
import type { StowageResult } from "@/lib/types";
import { FlameCanvas } from "./FlameCanvas";
import { GradeBadge } from "./GradeBadge";
import { Evidence, PageHeader } from "./ui";

export const EXAMPLES = ["foam pillow", "cotton T-shirt", "acrylic window", "Velcro strap"];
const MATCHED: Record<StowageResult["matchedBy"], string> = {
  keyword: "matched by keyword", llm: "matched by the AI (from the fixed list)", none: "no match",
};

function useStowage() {
  const { scenario } = useMission();
  const [item, setItem] = useState("");
  const [res, setRes] = useState<StowageResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ac = useRef<AbortController | null>(null);

  const run = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    setItem(text);
    ac.current?.abort();
    const c = new AbortController();
    ac.current = c;
    setBusy(true);
    try {
      setRes(await api.stowage(text, scenario, c.signal));
      setErr(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      if (ac.current === c) setBusy(false);
    }
  };
  // re-check the last item when the habitat changes, so the verdict always matches the header
  const last = useRef<string | null>(null);
  useEffect(() => { last.current = res?.item ?? null; }, [res]);
  useEffect(() => { if (last.current) void run(last.current); }, [scenario]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = () => { ac.current?.abort(); setRes(null); setErr(null); };
  return { item, setItem, res, busy, err, run, clear };
}

function ResultCard({ res, g, habitatName, compact }: { res: StowageResult; g: number; habitatName: string; compact?: boolean }) {
  const v = res.verdict;
  const lv = LEVEL_STYLE[v?.level ?? "unknown"];
  return (
    <motion.div key={res.item + (v?.level ?? "")} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="relative overflow-hidden rounded-[12px] border bg-space-950/50 p-3.5" style={{ borderColor: `${lv.color}55` }}>
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: lv.color }} />
      <div className="flex items-start gap-3">
        <FlameCanvas g={g} level={v?.level ?? "unknown"} width={compact ? 40 : 56} height={compact ? 48 : 64} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-mute">&ldquo;{res.item}&rdquo; → {res.materialName ?? "no tested material"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="font-display text-[17px] font-semibold" style={{ color: lv.color }}>{lv.label}</span>
            <span className="text-[12px] text-mute">{placeName(habitatName)}</span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink">{res.advice}.</p>
          {!compact && v && <p className="mt-1 text-[12px] text-mute">{v.why}</p>}
        </div>
        {v && <GradeBadge grade={v.grade} size="sm" />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-400">
        <span>{MATCHED[res.matchedBy]}</span>
        {v && <Evidence kind="illustrative" label={v.label} />}
      </div>
    </motion.div>
  );
}

function SearchBox({ s, autoFocus }: { s: ReturnType<typeof useStowage>; autoFocus?: boolean }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(s.item); }} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
      <input value={s.item} onChange={(e) => s.setItem(e.target.value)} autoFocus={autoFocus} maxLength={200}
        placeholder="Type an item, e.g. foam pillow" aria-label="Item to check"
        className="w-full rounded-[10px] border border-[var(--line-strong)] bg-space-950/70 py-2.5 pl-9 pr-20 text-[14px] text-ink placeholder:text-slate-400 focus:border-ox/60 focus:outline-none" />
      <button type="submit" disabled={s.busy || !s.item.trim()}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[8px] bg-blue px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40">
        {s.busy ? "…" : "Check"}
      </button>
    </form>
  );
}

function Chips({ s }: { s: ReturnType<typeof useStowage> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EXAMPLES.map((x) => (
        <button key={x} onClick={() => void s.run(x)}
          className="rounded-full border border-[var(--line)] bg-space-950/50 px-2.5 py-1 text-[12px] text-slate-300 hover:border-ox/50 hover:text-ink">{x}</button>
      ))}
    </div>
  );
}

/** One small search box for the Answer screen. The verdict floats under it so the page does not jump. */
export function StowageSearch() {
  const s = useStowage();
  const { setTab } = useMission();
  const v = s.res?.verdict;
  const lv = LEVEL_STYLE[v?.level ?? "unknown"];
  const close = () => { s.setItem(""); s.clear(); };
  return (
    <div className="relative">
      <form onSubmit={(e) => { e.preventDefault(); void s.run(s.item); }} className="relative">
        <Luggage className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dust-400" />
        <input value={s.item} onChange={(e) => s.setItem(e.target.value)} maxLength={200}
          onKeyDown={(e) => e.key === "Escape" && close()}
          placeholder="Can I bring this aboard? e.g. foam pillow" aria-label="Can I bring this aboard? Type an item"
          className="w-full rounded-full border border-[var(--line-strong)] bg-space-950/70 py-2.5 pl-10 pr-4 text-[14px] text-ink placeholder:text-slate-400 focus:border-ox/60 focus:outline-none" />
      </form>
      <AnimatePresence>
        {(s.res || s.err) && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            role="status" className="panel-float absolute inset-x-0 top-full z-20 mt-2 p-3.5">
            <button onClick={close} aria-label="Close" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-mute hover:text-ink"><X className="h-3.5 w-3.5" /></button>
            {s.err ? <p className="text-[13px] text-rose-300">{s.err}</p> : s.res && (
              <div className="pr-6">
                <div className="text-[12.5px] text-mute">{s.res.materialName ? <>Closest tested material: <span className="text-ink">{s.res.materialName}</span></> : "No tested material matches this item."}</div>
                <div className="mt-1 text-[15px] font-semibold" style={{ color: lv.color }}>{lv.label}</div>
                <div className="mt-0.5 text-[13px] text-slate-300">{s.res.advice}.</div>
                <button onClick={() => setTab("stowage")} className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-ox hover:underline">Details <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Full tab. */
export function StowageInspector() {
  const [allMats, setAllMats] = useState(false);
  const s = useStowage();
  const { scenario, habitats, analysis } = useMission();
  const name = habitats.find((h) => h.id === scenario.habitatId)?.name ?? "Custom mission";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker="Tools · Stowage check" title="Can I bring this aboard?">
        Type any item to see the closest tested material and its risk in this habitat.
      </PageHeader>
      <div className="panel p-5">
        <SearchBox s={s} autoFocus />
        <div className="mt-3"><Chips s={s} /></div>
        <div className="mt-5">
          <AnimatePresence mode="wait">
            {s.err ? <p key="e" className="text-[13px] text-rose-300">{s.err}</p>
              : s.res ? <ResultCard res={s.res} g={scenario.gravityG} habitatName={name} />
              : (
                <div key="h" className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-dust-500/50">
                    <Luggage className="h-7 w-7 text-dust-400" />
                  </span>
                  <p className="max-w-xs text-[13px] text-mute">Type any item — a foam pillow, a laptop, a cotton shirt — to see the closest NASA-tested material and its fire risk in {name}.</p>
                </div>
              )}
          </AnimatePresence>
        </div>
      </div>
      {analysis && (
        <div className="panel mt-5 p-5">
          <div className="label mb-3">Materials FLAMEPRINT knows</div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(allMats ? analysis.materials : analysis.materials.slice(0, 5)).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-[8px] bg-space-950/40 px-3 py-2 text-[13px]">
                <span className="min-w-0"><span className="text-ink">{m.name}</span><span className="block truncate text-[11.5px] text-slate-400">{m.usedFor}</span></span>
                <span className="shrink-0 text-[12px]" style={{ color: LEVEL_STYLE[m.level].color }}>{LEVEL_STYLE[m.level].label}</span>
              </li>
            ))}
          </ul>
          {analysis.materials.length > 5 && (
            <button onClick={() => setAllMats((x) => !x)} className="btn btn-ghost mt-3 !px-0">
              {allMats ? "Show fewer" : `Show all ${analysis.materials.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
