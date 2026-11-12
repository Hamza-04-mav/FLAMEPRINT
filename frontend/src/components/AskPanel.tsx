"use client";

import { motion } from "framer-motion";
import { CornerDownLeft, Search } from "lucide-react";
import { useRef, useState } from "react";
import { streamSSE } from "@/lib/api";
import { useMission } from "@/lib/mission";
import { CitedMarkdown } from "./CitedMarkdown";
import { ErrorNote, PageHeader, Pill } from "./ui";

const EXAMPLES = [
  "Which experiments tested suppression with CO2 or helium?",
  "What data exists above 30% oxygen?",
  "How does microgravity smoke affect detector design?",
  "Which investigations shared the same hardware as BASS?",
  "Is there any partial-gravity data?",
];

interface Hit { id: string; investigationId: string | null; source: string; kind: string; score: number }

export function AskPanel() {
  const { scenario } = useMission();
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [text, setText] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [retrieval, setRetrieval] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState<Set<string> | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const ac = useRef<AbortController | null>(null);

  const ask = async (question: string) => {
    if (question.trim().length < 2) return;
    ac.current?.abort();
    const ctl = new AbortController();
    ac.current = ctl;
    setAsked(question); setText(""); setHits([]); setValid(undefined); setErr(null); setBusy(true);
    try {
      await streamSSE("/api/ask", { question, scenario }, {
        onMeta: (m) => { setHits((m.retrieved as Hit[]) ?? []); setMode(m.mode as string); setRetrieval(m.retrieval as string); },
        onDelta: (t) => setText((x) => x + t),
        onCitations: (c) => setValid(new Set(c.valid)),
      }, ctl.signal);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader index="07" kicker="Ask the archive" title="Retrieval-grounded answers with sources"
        actions={<>
          {retrieval && <Pill>{retrieval === "postgres" ? "pgvector search" : "in-memory vector search"}</Pill>}
          {mode && <Pill tone={mode === "llm" ? "cyan" : "amber"}>{mode === "llm" ? "Claude synthesis" : "extractive (offline)"}</Pill>}
        </>}>
        Semantic search over the investigation catalog and every imported PSI document. Answers cite the passages they use.
      </PageHeader>
      <div className="panel panel-glow p-5 sm:p-7">
      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500}
          placeholder="Ask about fuels, oxygen levels, suppression, detection, hardware…"
          className="w-full rounded-[12px] border border-[var(--line-strong)] bg-space-950/70 py-4 pl-11 pr-24 text-[15px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-ox/60 focus:shadow-[0_0_0_4px_rgba(25,201,255,0.08)]" />
        <button type="submit" disabled={busy}
          className="btn btn-primary absolute right-2 top-1/2 -translate-y-1/2 !px-3.5 !py-2 !text-[12.5px] disabled:opacity-50">
          Ask <CornerDownLeft className="h-3 w-3" />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((x) => (
          <button key={x} onClick={() => { setQ(x); void ask(x); }}
            className="chip-link !text-mute hover:!text-ink">{x}</button>
        ))}
      </div>

      {err && <div className="mt-4"><ErrorNote message={err} onRetry={() => ask(asked)} /></div>}

      {asked && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-3 text-sm font-medium text-slate-200">“{asked}”</div>
            {busy && !text && <div className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2 w-2 animate-ping rounded-full bg-ox" />Searching archive…</div>}
            <CitedMarkdown text={text} valid={valid} streaming={busy} />
          </div>
          <div>
            <div className="label mb-2">Retrieved passages</div>
            <div className="space-y-1.5">
              {hits.map((h, i) => (
                <motion.div key={h.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-space-950/50 px-2.5 py-1.5">
                  <span className={`font-mono text-[11px] ${h.kind === "document" ? "text-flame-1" : "text-ox"}`}>
                    {h.kind === "document" ? `📄 ${h.source.split("/").pop()}` : h.investigationId}
                  </span>
                  <span className="ml-auto h-1 w-14 overflow-hidden rounded-full bg-slate-800">
                    <span className="block h-full bg-ox" style={{ width: `${Math.max(4, Math.min(100, h.score * 160))}%` }} />
                  </span>
                  <span className="w-9 text-right font-mono text-[10px] text-slate-500">{h.score.toFixed(2)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
