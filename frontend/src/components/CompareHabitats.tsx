"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fmtPressure, LEVEL_STYLE, levelRose } from "@/lib/answer";
import { api, ApiError } from "@/lib/api";
import { SEVERITY_COLOR } from "@/lib/format";
import { useMission } from "@/lib/mission";
import type { CompareHabitatsResult, Habitat, Scenario } from "@/lib/types";
import { GradeBadge } from "./GradeBadge";
import { ErrorNote, Evidence, PageHeader, Skeleton } from "./ui";

const toScenario = (h: Habitat): Scenario => ({
  habitatId: h.id, o2Pct: h.o2Pct, pressureKpa: h.pressureKpa, flowCmS: h.flowCmS, gravityG: h.gravityG, phases: h.phases, pillarFocus: h.pillarFocus,
});

function Pick({ value, onChange, habitats, label }: { value: string; onChange: (v: string) => void; habitats: Habitat[]; label: string }) {
  const h = habitats.find((x) => x.id === value);
  const p = h ? fmtPressure(h.pressureKpa) : null;
  return (
    <label className="panel block flex-1 p-4">
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[8px] border border-[var(--line-strong)] bg-space-950 px-3 py-2 font-display text-[17px] font-semibold text-ink focus:border-ox/60 focus:outline-none">
        {habitats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {h && p && <span className="mt-2 block font-mono text-[11.5px] text-mute">{h.o2Pct}% O₂ · {p.psi} ({p.kpa}) · {h.gravityG} g · {h.flowCmS} cm/s</span>}
    </label>
  );
}

export function CompareHabitats() {
  const { habitats, weights } = useMission();
  const [a, setA] = useState("iss");
  const [b, setB] = useState("lunar-base");
  const [res, setRes] = useState<CompareHabitatsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ha = habitats.find((h) => h.id === a), hb = habitats.find((h) => h.id === b);

  useEffect(() => {
    if (!ha || !hb) return;
    let live = true;
    api.compareHabitats(toScenario(ha), toScenario(hb), weights)
      .then((r) => { if (live) { setRes(r); setErr(null); } })
      .catch((e) => live && setErr(e instanceof ApiError ? e.message : String(e)));
    return () => { live = false; };
  }, [ha, hb, weights]);

  const changed = new Map(res?.diff.materials.map((m) => [m.id, m]));
  const levelB = new Map(res?.b.materials.map((m) => [m.id, m]));

  return (
    <div>
      <PageHeader index="06" kicker="Compare habitats" title={<>What changes when the crew <span className="text-ox">moves?</span></>}>
        Pick two habitats. Materials whose risk changed are highlighted; unchanged rows are muted. Same engine, same rules as the Answer screen.
      </PageHeader>
      {err && <div className="mb-4"><ErrorNote message={err} /></div>}
      <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
        <Pick value={a} onChange={setA} habitats={habitats} label="Habitat A" />
        <ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-mute md:rotate-0" />
        <Pick value={b} onChange={setB} habitats={habitats} label="Habitat B" />
      </div>

      {!res ? <Skeleton className="mt-5 h-72" /> : (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <h3 className="font-display text-[16px] font-semibold text-ink">Materials</h3>
              <Evidence kind="illustrative" label="illustrative model" />
            </div>
            <ul>
              {res.a.materials.map((ma) => {
                const mb = levelB.get(ma.id);
                const c = changed.get(ma.id);
                const up = c && levelRose(c.from, c.to);
                return (
                  <motion.li key={ma.id} layout className={`grid grid-cols-[1fr_auto_20px_auto] items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 last:border-0 ${c ? "" : "opacity-50"}`}>
                    <span className="text-[13.5px] text-ink">{ma.name}</span>
                    <span className="text-[12.5px]" style={{ color: LEVEL_STYLE[ma.level].color }}>{LEVEL_STYLE[ma.level].label}</span>
                    <ArrowRight className="h-4 w-4" style={{ color: c ? (up ? "#FF5A4E" : "#34D399") : "#566C8E" }} />
                    <span className="text-[12.5px] font-medium" style={{ color: LEVEL_STYLE[mb?.level ?? "unknown"].color }}>{LEVEL_STYLE[mb?.level ?? "unknown"].label}</span>
                  </motion.li>
                );
              })}
            </ul>
            {res.diff.materials.length === 0 && <p className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-mute">No material changed level{res.a.materials.every((m) => m.level === "unknown") ? " (thresholds not loaded yet)" : ""}.</p>}
          </section>

          <div className="space-y-5">
            <section className="panel p-4">
              <h3 className="mb-3 font-display text-[16px] font-semibold text-ink">Confidence</h3>
              <div className="flex items-center gap-3">
                <GradeBadge grade={res.a.coverage.grade} size="lg" />
                <ArrowRight className="h-5 w-5 text-mute" />
                <GradeBadge grade={res.b.coverage.grade} size="lg" />
                <p className="ml-1 min-w-0 text-[12.5px] leading-snug text-mute">{res.b.coverage.grade.reason}</p>
              </div>
            </section>
            <section className="panel p-4">
              <h3 className="mb-3 font-display text-[16px] font-semibold text-ink">New gaps in {hb?.short ?? "B"}</h3>
              {res.diff.gapsOnlyInB.length === 0 && <p className="text-[12.5px] text-mute">None. Every gap in B already exists in A.</p>}
              <ul className="space-y-2">
                {res.diff.gapsOnlyInB.filter((g) => g.severity !== "info").map((g) => (
                  <li key={g.title} className="relative rounded-[8px] bg-space-950/45 py-2 pl-3.5 pr-3 text-[13px] text-ink" title={g.detail}>
                    <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-[8px]" style={{ background: SEVERITY_COLOR[g.severity] }} />{g.title}
                  </li>
                ))}
              </ul>
            </section>
            {res.diff.rankMoves.length > 0 && (
              <section className="panel p-4">
                <h3 className="mb-3 font-display text-[16px] font-semibold text-ink">Investigations that moved 3+ ranks</h3>
                <ul className="grid grid-cols-2 gap-1.5 text-[12.5px]">
                  {res.diff.rankMoves.slice(0, 10).map((m) => (
                    <li key={m.id} className="flex justify-between rounded-[6px] bg-space-950/40 px-2.5 py-1.5">
                      <span className="text-ink">{m.id}</span>
                      <span className="font-mono" style={{ color: m.to < m.from ? "#34D399" : "#FF8B32" }}>#{m.from} → #{m.to}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
