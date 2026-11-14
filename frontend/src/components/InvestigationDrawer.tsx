"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtRange, OUTCOME_COLOR, PHASE_COLOR } from "@/lib/format";
import { useMission } from "@/lib/mission";
import type { Investigation, Relation, TestRecord } from "@/lib/types";
import { ConfidenceBadge, Skeleton } from "./ui";

type Detail = { investigation: Investigation; tests: TestRecord[]; totalTests: number; relations: Relation[]; envelope?: Investigation["conditions"] };

export function InvestigationDrawer() {
  const { focusId, openInvestigation, analysis, dataVersion } = useMission();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!focusId) return;
    setD(null); setErr(null);
    api.investigation(focusId).then((x) => setD(x as Detail)).catch((e) => setErr(e.message));
  }, [focusId, dataVersion]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && openInvestigation(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [openInvestigation]);

  const rank = analysis?.ranked.findIndex((r) => r.id === focusId) ?? -1;
  const score = rank >= 0 ? analysis!.ranked[rank].score : null;
  const inv = d?.investigation;
  const env = d?.envelope ?? inv?.conditions;

  return (
    <AnimatePresence>
      {focusId && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => openInvestigation(null)} />
          <motion.aside role="dialog" aria-label={`${focusId} dossier`}
            className="panel-float fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto !rounded-none border-l p-5 scrollbar-thin sm:p-6"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="label text-ox/80">Investigation dossier</div>
                <h3 className="font-display text-2xl font-semibold text-slate-50">{focusId}</h3>
                <div className="text-sm text-slate-400">{inv?.name}</div>
              </div>
              {score !== null && (
                <div className="text-right">
                  <div className="font-display text-3xl font-semibold text-ox">{Math.round(score)}</div>
                  <div className="label !text-[9px]">rank #{rank + 1}</div>
                </div>
              )}
              <button onClick={() => openInvestigation(null)} className="rounded-[4px] p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>

            {err && <div className="mt-4 text-sm text-rose-300">{err}</div>}
            {!inv && !err && <div className="mt-6 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-32" /><Skeleton className="h-40" /></div>}

            {inv && env && (
              <div className="mt-5 space-y-5 text-[13px]">
                <p className="leading-relaxed text-slate-300">{inv.objective}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field k="Hardware" v={[inv.facility, inv.apparatus].filter(Boolean).join(" → ")} />
                  <Field k="Platform" v={inv.platform} />
                  <Field k="Fuels" v={inv.fuels.join("; ") || "–"} />
                  <Field k="Geometry" v={inv.geometry || "–"} />
                  <Field k="Diluents" v={inv.diluents.join(", ") || "–"} />
                  <Field k="Measurements" v={inv.measurements.join(", ") || "–"} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inv.fuelPhase.map((p) => <span key={p} className="rounded-md px-2 py-0.5 text-[11px]" style={{ background: `${PHASE_COLOR[p]}22`, color: PHASE_COLOR[p] }}>{p}</span>)}
                  {inv.status === "pending" && <span className="rounded-md bg-violet-400/15 px-2 py-0.5 text-[11px] text-violet-200">expected · not yet in PSI</span>}
                  {inv.tags.map((t) => <span key={t} className="rounded-md bg-slate-700/40 px-2 py-0.5 text-[11px] text-slate-300">{t}</span>)}
                </div>

                <div className="rounded-md border border-slate-700/60 bg-space-950/50 p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="label">Tested range</span><ConfidenceBadge c={env.confidence} /></div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[12px]">
                    <div><div className="text-slate-500">O₂</div><div className="text-dust-200">{fmtRange(env.o2Pct, "%")}</div></div>
                    <div><div className="text-slate-500">pressure</div><div className="text-indigo-200">{fmtRange(env.pressureKpa, " kPa")}</div></div>
                    <div><div className="text-slate-500">flow</div><div className="text-emerald-200">{fmtRange(env.flowCmS, " cm/s")}</div></div>
                  </div>
                  {env.note && <div className="mt-2 text-[11.5px] text-slate-500">{env.note}</div>}
                </div>

                <div>
                  <div className="label mb-2">Fire-safety relevance</div>
                  <div className="space-y-1.5">
                    {(["prevention", "detection", "suppression"] as const).map((p) => (
                      <div key={p} className="flex items-center gap-2">
                        <span className="w-24 capitalize text-slate-400">{p}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${inv.pillars[p] * 100}%` }} className="h-full bg-ox" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {Object.keys(inv.insights).length > 0 && (
                  <div>
                    <div className="label mb-2">Findings & interpretation</div>
                    <div className="space-y-2">
                      {Object.entries(inv.insights).map(([k, v]) => (
                        <div key={k} className="rounded-[4px] border-l-2 border-ox/50 bg-space-950/40 py-1.5 pl-3 pr-2">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
                          <div className="text-slate-300">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {d!.relations.length > 0 && (
                  <div>
                    <div className="label mb-2">Lineage</div>
                    {d!.relations.map((r) => (
                      <button key={`${r.from}${r.to}`} onClick={() => openInvestigation(r.from === focusId ? r.to : r.from)}
                        className="mr-2 mb-1.5 rounded-md border border-slate-700 px-2 py-1 text-[11.5px] text-slate-300 hover:border-ox/50">
                        {r.from} → {r.to} <span className="text-slate-500">· {r.type}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <div className="label mb-2">Imported PSI tests ({d!.totalTests})</div>
                  {d!.totalTests === 0 ? (
                    <p className="text-[12px] text-slate-500">No test records imported for this investigation yet. Use the Data Lab to add its PSI test matrix.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-[4px] border border-slate-800 scrollbar-thin">
                      <table className="w-full text-left font-mono text-[11px]">
                        <thead className="text-slate-500"><tr>{["id", "O₂", "kPa", "cm/s", "outcome", "source"].map((h) => <th key={h} className="px-2 py-1.5 font-normal">{h}</th>)}</tr></thead>
                        <tbody>
                          {d!.tests.slice(0, 60).map((t) => (
                            <tr key={t.id} className="border-t border-slate-800/70 text-slate-300">
                              <td className="px-2 py-1">{t.id.split(":").pop()}</td><td className="px-2">{t.o2Pct ?? "–"}</td>
                              <td className="px-2">{t.pressureKpa ?? "–"}</td><td className="px-2">{t.flowCmS ?? "–"}</td>
                              <td className="px-2" style={{ color: OUTCOME_COLOR[t.outcome ?? "unknown"] }}>{t.outcome ?? "–"}</td>
                              <td className="px-2 text-slate-500">{t.source}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-800 pt-3 text-[11.5px] text-slate-500">Provenance: {inv.provenance}</div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[4px] bg-space-950/40 p-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
      <div className="text-slate-200">{v}</div>
    </div>
  );
}
