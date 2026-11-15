"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Download, FileUp, RefreshCw, Sparkles, Trash2, TriangleAlert, UploadCloud, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useMission } from "@/lib/mission";
import type { IngestReport, TestRecord } from "@/lib/types";
import { ErrorNote, Pill, PageHeader } from "./ui";

type Preview = { file: File; report: IngestReport; sample: TestRecord[]; textPreview: string };

export function DataLab() {
  const { dataset, health, refreshData } = useMission();
  const [drag, setDrag] = useState(false);
  const [details, setDetails] = useState(false);
  const [inv, setInv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reports, setReports] = useState<IngestReport[]>([]);
  const [uploads, setUploads] = useState<{ file: string; bytes: number; investigationId?: string | null }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSources = useCallback(() => api.sources().then((s) => { setReports(s.reports); setUploads(s.uploads); }).catch(() => {}), []);
  useEffect(() => { void loadSources(); }, [loadSources]);

  const doPreview = async (file: File) => {
    setBusy("preview"); setMsg(null);
    try {
      const p = await api.preview(file, inv || undefined);
      setPreview({ file, ...p });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const doImport = async () => {
    if (!preview) return;
    setBusy("import");
    try {
      const r = await api.ingest(preview.file, inv || undefined);
      setMsg({ ok: true, text: `Imported ${r.report.records} record(s) from ${preview.file.name}. Ranking, coverage and maps have been updated.` });
      setPreview(null);
      await Promise.all([refreshData(), loadSources()]);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const act = async (label: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(label); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await Promise.all([refreshData(), loadSources()]); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void doPreview(f);
  };

  const isDoc = (f: string) => /\.(pdf|txt|md)$/i.test(f);
  const s = health?.stats;

  return (
    <div>
    <PageHeader kicker="Tools · Data Lab" title="Plug in the official PSI dataset"
      actions={<button onClick={() => act("reload", api.reload, "Re-scanned data/psi and re-indexed.")} className="btn btn-outline !py-2 !text-[12.5px]">
        <RefreshCw className={`h-4 w-4 ${busy === "reload" ? "animate-spin" : ""}`} /> Reload data/psi
      </button>}>
      Drop PSI test files here; columns and units are mapped before anything is saved.
    </PageHeader>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
      <div className="space-y-5">
        <div className="panel panel-glow p-5 sm:p-6">

          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            className={`grid cursor-pointer place-items-center rounded-[14px] border-2 border-dashed px-6 py-12 text-center transition-all ${
              drag ? "border-ox bg-ox/10 shadow-[0_0_0_4px_rgba(25,201,255,0.12)]" : "border-[var(--line-strong)] bg-space-950/30 hover:border-ox/50"}`}>
            <motion.div animate={{ y: drag ? -6 : 0 }}><UploadCloud className="h-10 w-10 text-ox" /></motion.div>
            <div className="mt-2 font-medium text-slate-200">Drop a PSI file or click to browse</div>
            <div className="mt-1 text-[12px] text-slate-400">CSV · TSV · XLSX test matrices · JSON metadata · PDF / TXT / MD documents</div>
            <input ref={fileRef} type="file" className="hidden" accept=".csv,.tsv,.xlsx,.json,.pdf,.txt,.md"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void doPreview(f); e.target.value = ""; }} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-slate-400">Assign to investigation:</span>
            <select value={inv} onChange={(e) => setInv(e.target.value)}
              className="rounded-[4px] border border-slate-700 bg-space-900 px-2 py-1 text-slate-200 outline-none focus:border-ox/60">
              <option value="">auto-detect (column or file name)</option>
              {dataset?.investigations.map((i) => <option key={i.id} value={i.id}>{i.id}</option>)}
            </select>
          </div>

          {busy === "preview" && <div className="mt-4 text-sm text-slate-400">Parsing…</div>}
          <AnimatePresence>
            {msg && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
                {msg.ok ? (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{msg.text}
                  </div>
                ) : <ErrorNote message={msg.text} />}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {preview && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-5 overflow-hidden rounded-md border border-slate-700 bg-space-950/60">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
                  <FileUp className="h-4 w-4 text-ox" />
                  <span className="font-medium text-slate-100">{preview.file.name}</span>
                  <Pill>{preview.report.kind}</Pill>
                  <Pill tone="cyan">{preview.report.records} record(s)</Pill>
                  {preview.report.investigations.map((i) => <Pill key={i} tone="emerald">{i}</Pill>)}
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => setPreview(null)} className="rounded-[4px] px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
                    <button onClick={doImport} disabled={busy === "import" || preview.report.kind === "unsupported"}
                      className="rounded-[4px] bg-ox/20 px-3 py-1.5 text-xs font-semibold text-ox hover:bg-ox/30 disabled:opacity-40">
                      {busy === "import" ? "Importing…" : "Import into FLAMEPRINT"}
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {Object.keys(preview.report.mapping).length > 0 && (
                    <div>
                      <div className="label mb-1.5">Column mapping</div>
                      <div className="space-y-1 text-[12px]">
                        {Object.entries(preview.report.mapping).map(([k, v]) => (
                          <div key={k} className="flex gap-2"><span className="w-24 font-mono text-ox">{k}</span><span className="text-slate-400">← “{v}”</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {preview.report.conversions.length > 0 && (
                      <div><div className="label mb-1.5">Unit conversions</div>
                        {preview.report.conversions.map((c) => <div key={c} className="text-[12px] text-slate-300">⇄ {c}</div>)}</div>
                    )}
                    {preview.report.unmapped.length > 0 && (
                      <div><div className="label mb-1.5">Kept verbatim (unmapped)</div>
                        <div className="text-[12px] text-slate-400">{preview.report.unmapped.join(" · ")}</div></div>
                    )}
                  </div>
                </div>
                {preview.report.warnings.length > 0 && (
                  <div className="space-y-1 border-t border-slate-800 px-4 py-3">
                    {preview.report.warnings.map((w) => (
                      <div key={w} className="flex gap-2 text-[12px] text-amber-200"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</div>
                    ))}
                  </div>
                )}
                {preview.sample.length > 0 && (
                  <div className="overflow-x-auto border-t border-slate-800 scrollbar-thin">
                    <table className="w-full min-w-[560px] text-left text-[11.5px]">
                      <thead className="label"><tr>{["investigation", "fuel", "O₂ %", "P kPa", "flow cm/s", "outcome", "metric"].map((h) => <th key={h} className="px-4 py-2 font-normal">{h}</th>)}</tr></thead>
                      <tbody>
                        {preview.sample.map((t) => (
                          <tr key={t.id} className="border-t border-slate-800/70 font-mono text-slate-300">
                            <td className="px-4 py-1.5">{t.investigationId}</td><td className="px-4">{t.fuel ?? "–"}</td>
                            <td className="px-4">{t.o2Pct ?? "–"}</td><td className="px-4">{t.pressureKpa ?? "–"}</td>
                            <td className="px-4">{t.flowCmS ?? "–"}</td><td className="px-4">{t.outcome ?? "–"}</td>
                            <td className="px-4">{t.metricValue != null ? `${t.metricValue} (${t.metricName})` : "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {preview.textPreview && <p className="border-t border-slate-800 px-4 py-3 text-[12px] leading-relaxed text-slate-400">{preview.textPreview}…</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {uploads.length > 0 && <div className="panel p-4 sm:p-5">
          <div className="label mb-3">Uploaded files</div>
          {(
            <div className="space-y-1.5">
              {uploads.map((u) => (
                <div key={u.file} className="flex flex-wrap items-center gap-2 rounded-[4px] border border-slate-800 bg-space-900/50 px-3 py-2 text-[12.5px]">
                  <span className="font-mono text-slate-200">{u.file}</span>
                  <span className="text-slate-400">{(u.bytes / 1024).toFixed(1)} KB</span>
                  {u.investigationId && <Pill>{u.investigationId}</Pill>}
                  <div className="ml-auto flex gap-1.5">
                    {isDoc(u.file) && (
                      <button disabled={!health?.llm.enabled || !!busy} title={health?.llm.enabled ? "Extract structured investigation metadata with the LLM (Groq)" : "Needs GROQ_API_KEY"}
                        onClick={() => act(`x:${u.file}`, () => api.extract(u.file), `Extracted metadata from ${u.file}. Marked unverified until you check it.`)}
                        className="flex items-center gap-1 rounded-md border border-violet-400/40 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-400/10 disabled:opacity-40">
                        <Sparkles className="h-3 w-3" />{busy === `x:${u.file}` ? "Extracting…" : "SI extract"}
                      </button>
                    )}
                    <button onClick={() => act(`d:${u.file}`, () => api.deleteUpload(u.file), `Removed ${u.file}.`)}
                      className="rounded-md p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300" aria-label={`Delete ${u.file}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => confirm("Remove all uploaded files?") && act("clear", api.clearUploads, "All uploads removed.")}
                className="mt-2 text-xs text-slate-400 hover:text-rose-300">Remove all uploads</button>
            </div>
          )}
        </div>}
      </div>

      <div className="space-y-5">
        <div className="panel p-4 sm:p-5">
          <div className="label mb-3">Loaded evidence</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat n={s?.inPsi ?? 0} label="investigations" />
            <Stat n={s?.tests ?? 0} label="PSI test records" />
            <Stat n={s?.withDataEnvelope ?? 0} label="data-derived tested ranges" />
          </div>
          {s && s.tests === 0 && (
            <p className="mt-3 rounded-[4px] border border-amber-400/30 bg-amber-400/5 p-3 text-[12px] leading-relaxed text-amber-100/90">
              Running on the curated investigation catalog only. No test-level numbers are shown until you import PSI files.
              Every view upgrades automatically once you do.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/export/tests.csv" className="flex items-center gap-1.5 rounded-[4px] border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-ox/50 hover:text-ox">
              <Download className="h-3.5 w-3.5" /> Modeling dataset (CSV)
            </a>
            <a href="/api/templates/tests_template.csv" className="flex items-center gap-1.5 rounded-[4px] border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-ox/50 hover:text-ox">
              <Download className="h-3.5 w-3.5" /> Test template
            </a>
            <a href="/api/templates/investigation_template.json" className="flex items-center gap-1.5 rounded-[4px] border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-ox/50 hover:text-ox">
              <Download className="h-3.5 w-3.5" /> Metadata template
            </a>
          </div>
        </div>

        <button onClick={() => setDetails((x) => !x)} aria-expanded={details} className="btn btn-ghost !px-0">
          {details ? "Hide details" : "Show details"}<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${details ? "rotate-180" : ""}`} />
        </button>
        {details && <>
        <div className="panel p-4 sm:p-5">
          <div className="label mb-3">Ingestion log</div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {reports.length === 0 && <p className="text-sm text-slate-400">Only the seed catalog is loaded.</p>}
            {reports.map((r) => (
              <div key={r.file} className="rounded-[4px] border border-slate-800 bg-space-900/50 p-2.5 text-[12px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-slate-200">{r.file}</span>
                  <Pill tone={r.kind === "error" ? "rose" : "slate"}>{r.kind}</Pill>
                  <span className="text-slate-400">{r.records} rec</span>
                </div>
                {r.warnings?.slice(0, 3).map((w) => <div key={w} className="mt-1 text-amber-200/80">⚠ {w}</div>)}
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-4 text-[12.5px] leading-relaxed text-slate-400">
          <div className="label mb-2">How data plugs in</div>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Drop official PSI files into <code className="text-slate-200">data/psi/</code> (server) or upload them here.</li>
            <li>Columns are matched automatically (O₂, pressure, flow, gravity, fuel, outcome) and units are converted.</li>
            <li>Tested ranges become <span className="text-emerald-300">data-derived</span>. Ranking, coverage, the 3D map and briefs update.</li>
            <li>PDFs and text are indexed for retrieval and, with the Groq LLM, can be turned into structured metadata.</li>
          </ol>
        </div>
        </>}
      </div>
    </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-space-950/50 p-3">
      <div className="font-display text-2xl font-semibold text-slate-50">{n}</div>
      <div className="text-[10.5px] text-slate-400">{label}</div>
    </div>
  );
}
