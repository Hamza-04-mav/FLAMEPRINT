"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Copy, Download, FileSearch, FileText, Globe2, Radar, Shield, ShieldCheck, Sparkles, SprayCan, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { firstSentence } from "@/lib/answer";
import { api, streamSSE } from "@/lib/api";
import { fmtGravity, PILLAR_COLOR, toPsi } from "@/lib/format";
import { useMission } from "@/lib/mission";
import type { BriefCards, Investigation, Pillar } from "@/lib/types";
import { CitedMarkdown } from "./CitedMarkdown";
import { ConfidenceBadge, ErrorNote, Evidence, PageHeader, Skeleton } from "./ui";

interface Meta { mode?: string; model?: string; fallbackReason?: string; coverageIndex?: number; investigations?: string[] }
interface Section { title: string; body: string }

const CITE = /\[([A-Za-z0-9][A-Za-z0-9 .:_/\-]{0,60}?)\](?!\()/g;
const PILLARS: Pillar[] = ["prevention", "detection", "suppression"];
const PILLAR_ICON = { prevention: Shield, detection: Radar, suppression: SprayCan };
const APPENDIX: Record<string, string> = { "evidence gaps": "A", "recommended next steps": "B", "down to earth": "C" };

function parseSections(text: string): Section[] {
  const parts = text.split(/^## +(.+)$/m);
  const sections: Section[] = [];
  for (let i = 1; i < parts.length; i += 2) sections.push({ title: parts[i].trim(), body: (parts[i + 1] ?? "").trim() });
  return sections;
}
function citesIn(body: string) {
  const s = new Set<string>();
  for (const m of body.matchAll(CITE)) m[1].split(/[,;]\s*/).forEach((x) => s.add(x.trim()));
  return [...s];
}
function strength(body: string, n: number) {
  const insufficient = /insufficient evidence/i.test(body);
  if (insufficient && n < 2) return { level: 1, label: "Insufficient", color: "#FFD23F" };
  if (n >= 3 && !insufficient) return { level: 3, label: "Strong", color: "#efeae3" };
  return { level: 2, label: "Moderate", color: "#a39a90" };
}

function StrengthMeter({ body, n }: { body: string; n: number }) {
  const s = strength(body, n);
  return (
    <div className="flex items-center gap-2" title="Evidence strength: citations in this section and any 'Insufficient evidence' flags">
      <span className="flex gap-[3px]">{[1, 2, 3].map((i) => <span key={i} className="h-3 w-1.5 rounded-[1px]" style={{ background: i <= s.level ? s.color : "rgba(120,160,210,0.18)" }} />)}</span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: s.color }}>{s.label}</span>
    </div>
  );
}

function EvidencePanel({ ids, pillar, byId, onOpen }: { ids: string[]; pillar?: Pillar; byId: Map<string, Investigation>; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const known = ids.filter((i) => byId.has(i));
  if (!ids.length) return null;
  return (
    <div className="mt-4 rounded-[10px] border border-[var(--line)] bg-space-950/40">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
        <span className="text-[12.5px] text-slate-200">Supporting evidence <span className="font-mono text-mute">({ids.length})</span></span>
        <ChevronDown className={`h-4 w-4 text-mute transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {known.map((id) => {
              const inv = byId.get(id)!;
              const note = (pillar && inv.insights?.[pillar]) || inv.insights?.general || inv.objective;
              return (
                <li key={id} className="border-t border-[var(--line)] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] text-dust-200">{id}</span>
                    <span className="text-[12px] text-mute">{inv.name}</span>
                    <ConfidenceBadge c={inv.conditions.confidence} />
                    <button onClick={() => onOpen(id)} className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-ox hover:underline"><FileSearch className="h-3.5 w-3.5" />Dossier</button>
                  </div>
                  {note && <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{note}</p>}
                  <p className="mt-1 text-[10.5px] text-slate-600">{inv.provenance}</p>
                </li>
              );
            })}
            {ids.filter((i) => !byId.has(i)).map((id) => (
              <li key={id} className="border-t border-[var(--line)] px-4 py-2.5 text-[12px] text-slate-400">
                <span className="font-mono">{id.startsWith("doc:") ? id.slice(4) : id}</span>{id.startsWith("doc:") ? " · imported source document" : " · not in the evidence packet"}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The full streamed brief with its contents and citation audit (opened by 'Read full brief'). */
function FullBrief() {
  const { scenario, weights, health, habitats, analysis, dataset, openInvestigation } = useMission();
  const [text, setText] = useState("");
  const [meta, setMeta] = useState<Meta>({});
  const [cites, setCites] = useState<{ valid: string[]; invalid: string[] } | null>(null);
  const [state, setState] = useState<"idle" | "waiting" | "streaming" | "done">("idle");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stamp, setStamp] = useState<string | null>(null);
  const ac = useRef<AbortController | null>(null);

  const hab = habitats.find((h) => h.id === scenario.habitatId);
  const byId = useMemo(() => new Map(dataset?.investigations.map((i) => [i.id, i])), [dataset]);
  const sections = useMemo(() => parseSections(text), [text]);
  const valid = cites ? new Set(cites.valid) : undefined;

  const run = async () => {
    ac.current?.abort();
    const ctl = new AbortController();
    ac.current = ctl;
    setText(""); setCites(null); setNote(null); setErr(null); setMeta({}); setState("waiting"); setStamp(new Date().toISOString());
    try {
      await streamSSE("/api/brief", { scenario, weights }, {
        onMeta: (m) => setMeta(m as Meta),
        onDelta: (t) => { setState("streaming"); setText((x) => x + t); },
        onCitations: setCites,
        onDone: (d) => { setNote(d.note); setState("done"); },
      }, ctl.signal);
      setState((s) => (s === "done" ? s : "idle"));
    } catch (e) {
      setErr((e as Error).message);
      setState("idle");
    }
  };
  const stop = () => { ac.current?.abort(); setState("done"); };
  // demo deep link: /?generate#brief issues the brief on arrival
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !analysis) return;
    if (new URLSearchParams(window.location.search).has("generate")) { auto.current = true; void run(); }
  }, [analysis]); // eslint-disable-line react-hooks/exhaustive-deps

  const docNo = `FP-${(scenario.habitatId || "custom").toUpperCase()}-${(stamp ?? "").slice(0, 10).replace(/-/g, "") || "DRAFT"}`;
  const header = `# FLAMEPRINT Fire Safety Brief (${docNo})\n\n_Scenario: ${hab?.name ?? "Custom"} · ${scenario.o2Pct}% O₂ · ${toPsi(scenario.pressureKpa)} psi · ${scenario.gravityG} g · ventilation ${scenario.flowCmS} cm/s · fuels: ${scenario.phases.join(", ")}_\n_Generated ${stamp ?? new Date().toISOString()} · ${meta.mode === "llm" ? `Groq (${meta.model})` : "deterministic engine"}_\n\n`;
  const download = () => {
    const blob = new Blob([header + text], { type: "text/markdown" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${docNo.toLowerCase()}.md` });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = async () => { await navigator.clipboard.writeText(header + text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const busy = state === "waiting" || state === "streaming";
  const engine = meta.mode === "llm" ? `Groq · ${meta.model}` : meta.mode === "local" ? "Deterministic writer" : health?.llm.enabled ? `Groq · ${health.llm.model}` : "Deterministic writer";
  const status = state === "idle" && !text ? "Not generated" : busy ? "Drafting…" : "Issued";
  const scrollTo = (i: number) => document.getElementById(`brief-sec-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  let pillarNo = 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-mute">The full brief, written only from the evidence packet. Every citation is audited.</p>
        {busy
          ? <button onClick={stop} className="btn btn-ghost border border-[var(--line-strong)]"><Square className="h-4 w-4" />Stop</button>
          : <motion.button whileTap={{ scale: 0.97 }} onClick={run} className="btn btn-primary"><Sparkles className="h-4 w-4" />{text ? "Regenerate" : "Generate full brief"}</motion.button>}
      </div>
      {err && <div className="mb-4"><ErrorNote message={err} onRetry={run} /></div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <article className="panel overflow-hidden !rounded-[14px]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-blue/[0.06] px-6 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
            <span>Engineering guidance · verify against NASA PSI</span><span className="hidden sm:inline">{docNo}</span>
          </div>
          <header className="border-b border-[var(--line)] px-6 py-6 sm:px-9">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="kicker !text-[10px] text-ox">FLAMEPRINT · SI brief</div>
                <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight text-ink">Fire Safety Brief: {hab?.name ?? "Custom mission"}</h2>
              </div>
              <a href={hab ? `/passport?mission=${hab.id}` : `/passport?${new URLSearchParams({ o2: String(scenario.o2Pct), kpa: String(scenario.pressureKpa), g: String(scenario.gravityG), flow: String(scenario.flowCmS), phases: scenario.phases.join(",") })}`}
                target="_blank" rel="noreferrer" className="btn btn-primary !py-1.5"><Download className="h-4 w-4" />Export Fire Passport</a>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["O₂", `${scenario.o2Pct} %`], ["Pressure", `${toPsi(scenario.pressureKpa)} psi`], ["Gravity", `${fmtGravity(scenario.gravityG)} g`],
                ["Ventilation", `${scenario.flowCmS} cm/s`], ["Evidence grade", analysis ? `${analysis.coverage.grade.letter} · ${analysis.coverage.grade.reason.split(";")[0]}` : "–"], ["Status", status],
              ].map(([k, v]) => (
                <div key={k}><dt className="label !text-[9.5px]">{k}</dt><dd className="mt-0.5 font-mono text-[13px] text-ink">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] text-mute">
              <span>Fuels: {scenario.phases.join(", ")}</span><span className="text-slate-600">·</span>
              <span>Engine: <span className="text-slate-200">{engine}</span></span>
              {meta.fallbackReason && <span className="text-amber-200/90">(Groq unavailable: {meta.fallbackReason})</span>}
            </div>
          </header>

          <div className="px-6 py-7 sm:px-9">
            {state === "idle" && !text && !err && (
              <div className="space-y-4">
                {PILLARS.map((p, i) => {
                  const I = PILLAR_ICON[p];
                  return (
                    <div key={p} className="flex items-center gap-4 rounded-[12px] border border-dashed border-[var(--line-strong)] px-5 py-4 opacity-70">
                      <span className="font-mono text-[12px] text-slate-500">{i + 1}.0</span>
                      <I className="h-5 w-5" style={{ color: PILLAR_COLOR[p] }} />
                      <span className="font-display text-[16px] capitalize text-slate-300">{p}</span>
                      <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Awaiting generation</span>
                    </div>
                  );
                })}
                <div className="flex flex-col items-center gap-3 pt-4 text-center">
                  <FileText className="h-8 w-8 text-slate-600" />
                  <p className="max-w-md text-[13px] text-mute">Gaps are labelled <span className="text-amber-200">Insufficient evidence</span> instead of guessed. Nothing is shown until it is generated.</p>
                  <button onClick={run} className="btn btn-primary"><Sparkles className="h-4 w-4" />Generate brief</button>
                </div>
              </div>
            )}

            {state === "waiting" && (
              <div className="space-y-3 py-4">
                {["Ranking investigations for this atmosphere", "Bracketing gravity and oxygen tested ranges", "Composing the cited brief"].map((s, i) => (
                  <motion.div key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.45 }}
                    className="flex items-center gap-3 font-mono text-[12px] text-slate-400">
                    <span className="w-6 text-[10px] text-ox/70">{String(i + 1).padStart(2, "0")}</span>
                    <span className="h-3 w-3 animate-spin rounded-full border border-ox/25 border-t-ox" />{s}…
                  </motion.div>
                ))}
                <Skeleton className="mt-6 h-24" /><Skeleton className="h-24" />
              </div>
            )}

            <div className="space-y-8">
              {sections.map((s, i) => {
                const key = s.title.toLowerCase();
                const pillar = PILLARS.find((p) => key === p);
                const ids = citesIn(s.body);
                const last = i === sections.length - 1 && state === "streaming";
                if (pillar) {
                  pillarNo += 1;
                  const I = PILLAR_ICON[pillar];
                  const c = PILLAR_COLOR[pillar];
                  return (
                    <motion.section key={s.title} id={`brief-sec-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="scroll-mt-28 rounded-[14px] border border-[var(--line)] bg-space-950/30 p-5 sm:p-6" style={{ ["--bullet" as string]: c }}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-[10px] border" style={{ borderColor: `${c}55`, background: `${c}14`, color: c }}><I className="h-5 w-5" /></span>
                        <div>
                          <div className="font-mono text-[10.5px] text-slate-500">SECTION {pillarNo}.0</div>
                          <h3 className="font-display text-[20px] font-semibold text-ink">{s.title}</h3>
                        </div>
                        <div className="ml-auto flex items-center gap-4">
                          <StrengthMeter body={s.body} n={ids.length} />
                          <span className="font-mono text-[11px] text-mute">{ids.length} cited</span>
                        </div>
                      </div>
                      <div className="mt-4"><CitedMarkdown text={s.body} streaming={last} valid={valid} /></div>
                      <EvidencePanel ids={ids} pillar={pillar} byId={byId} onOpen={openInvestigation} />
                    </motion.section>
                  );
                }
                const app = APPENDIX[key];
                return (
                  <motion.section key={s.title} id={`brief-sec-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="scroll-mt-28">
                    <div className="flex items-baseline gap-3 border-b border-[var(--line)] pb-2">
                      <span className="font-mono text-[11px] text-slate-500">{app ? `APPENDIX ${app}` : "0.0"}</span>
                      <h3 className="font-display text-[17px] font-semibold text-ink">{key === "mission atmosphere" ? "Situation: mission atmosphere" : s.title}</h3>
                      {key === "evidence gaps" && <span className="ml-auto"><Evidence kind="catalog" label="From the gap detector" /></span>}
                    </div>
                    <div className="mt-3" style={{ ["--bullet" as string]: key === "evidence gaps" ? "#FFD23F" : "#a39a90" }}>
                      <CitedMarkdown text={s.body} streaming={last} valid={valid} />
                    </div>
                  </motion.section>
                );
              })}
            </div>

            {state === "done" && text && (
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-5">
                <button onClick={download} className="btn btn-outline !py-1.5 !text-[12.5px]"><Download className="h-4 w-4" />Markdown</button>
                <button onClick={copy} className="btn btn-ghost border border-[var(--line)] !py-1.5 !text-[12.5px]">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button>
                {note && <span className="text-[12px] text-amber-200">{note}</span>}
              </div>
            )}
          </div>
        </article>

        <aside className="space-y-5 xl:sticky xl:top-[112px] xl:self-start">
          <section className="panel p-5">
            <div className="label mb-3">Contents</div>
            {sections.length === 0 ? <p className="text-[12.5px] text-slate-500">Appears as the brief is written.</p> : (
              <ol className="space-y-1">
                {sections.map((s, i) => {
                  const done = i < sections.length - 1 || state === "done";
                  return (
                    <li key={s.title}>
                      <button onClick={() => scrollTo(i)} className="flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-slate-300 hover:bg-white/[0.04] hover:text-ink">
                        <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-ok" : "animate-pulse bg-flame-1"}`} />{s.title}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section className="panel p-5">
            <div className="label mb-3 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-ok" />Citation audit</div>
            {!cites ? <p className="text-[12.5px] text-slate-500">Runs when the brief finishes.</p> : (
              <>
                <div className="flex gap-5">
                  <div><div className="font-display text-[24px] font-semibold text-emerald-300">{cites.valid.length}</div><div className="label !text-[9px]">verified</div></div>
                  <div><div className={`font-display text-[24px] font-semibold ${cites.invalid.length ? "text-rose-300" : "text-slate-600"}`}>{cites.invalid.length}</div><div className="label !text-[9px]">unverified</div></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {cites.valid.map((c) => <span key={c} className="rounded-[4px] border border-emerald-400/30 px-1.5 font-mono text-[10.5px] text-emerald-200">{c}</span>)}
                  {cites.invalid.map((c) => <span key={c} className="rounded-[4px] border border-rose-400/40 px-1.5 font-mono text-[10.5px] text-rose-200 line-through">{c}</span>)}
                </div>
              </>
            )}
            <p className="mt-3 text-[11.5px] leading-snug text-slate-500">The model only receives the evidence packet and must cite its ids. Each citation is checked against it.</p>
          </section>
          {meta.investigations && (
            <section className="panel p-5">
              <div className="label mb-2">Evidence packet</div>
              <div className="flex flex-wrap gap-1">
                {meta.investigations.map((i) => (
                  <button key={i} onClick={() => openInvestigation(i)} className="rounded-[4px] border border-[var(--line-strong)] px-1.5 font-mono text-[10.5px] text-slate-300 hover:border-ox/50">{i}</button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}


function Cite({ id }: { id: string }) {
  const { openInvestigation } = useMission();
  return (
    <button onClick={() => openInvestigation(id)} title={`Open ${id}`}
      className="rounded-[4px] border border-ox/35 bg-ox/10 px-1.5 align-baseline font-mono text-[10.5px] text-dust-200 transition-colors duration-150 hover:bg-ox/20">{id}</button>
  );
}

/** Brief page: three short cited cards first; the full streamed brief on request. */
export function BriefPanel() {
  const { scenario, weights, habitats, dataVersion, setTab } = useMission();
  const [cards, setCards] = useState<BriefCards | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const hab = habitats.find((h) => h.id === scenario.habitatId);

  useEffect(() => { if (new URLSearchParams(window.location.search).has("generate")) setFull(true); }, []);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api.briefCards(scenario, weights).then((c) => { if (live) { setCards(c); setErr(null); } })
        .catch((e) => live && setErr((e as Error).message));
    }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [scenario, weights, dataVersion]);

  return (
    <div>
      <PageHeader kicker="Brief" title="What should engineers do?">
        Cited guidance for {hab ? `the ${hab.name}` : "this habitat"}, in three safety areas.
      </PageHeader>
      {err && <div className="mb-4"><ErrorNote message={err} /></div>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PILLARS.map((p) => {
          const I = PILLAR_ICON[p];
          const c = cards?.cards[p];
          return (
            <section key={p} className="panel flex flex-col p-6">
              <h2 className="flex items-center gap-2.5 font-display text-[19px] font-semibold capitalize text-ink">
                <I className="h-5 w-5" style={{ color: PILLAR_COLOR[p] }} aria-hidden />{p}
              </h2>
              {!c ? <Skeleton className="mt-4 h-28" /> : (
                <ul className="mt-4 space-y-3.5">
                  {c.bullets.map((b) => (
                    <li key={b.text} className="text-[14px] leading-snug text-slate-200" title={b.text}>
                      <span className="line-clamp-2">{firstSentence(b.text)}</span>
                      <span className="mt-1 flex flex-wrap gap-1">{b.cite.map((id) => <Cite key={id} id={id} />)}</span>
                    </li>
                  ))}
                  {c.gap && <li className="text-[13.5px] leading-snug text-amber-200">{c.gap}</li>}
                </ul>
              )}
              {c && c.more > 0 && <p className="mt-auto pt-4 text-[12.5px] text-slate-500">+{c.more} more in the full brief</p>}
            </section>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-mute">
          <Evidence kind="catalog" label="from investigation summaries · approx" />
          {cards && (
            <span className="flex items-center gap-1.5">
              <ShieldCheck className={`h-3.5 w-3.5 ${cards.audit.invalid.length ? "text-rose-300" : "text-ok"}`} />
              {cards.audit.invalid.length ? `${cards.audit.invalid.length} citation(s) failed the audit` : `All ${cards.audit.valid.length} citations checked`}
            </span>
          )}
        </div>
        <button onClick={() => setFull((x) => !x)} aria-expanded={full} className="btn btn-outline">
          <FileText className="h-4 w-4" />{full ? "Hide full brief" : "Read full brief"}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${full ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {full && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="pt-8"><FullBrief /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={() => setTab("earth")}
        className="group mt-10 flex w-full items-center justify-between gap-4 border-t border-[var(--line)] pt-6 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Globe2 className="h-4 w-4 text-ok" aria-hidden />On Earth too</span>
          <span className="mt-1 block text-[13.5px] text-mute">
            {cards?.earth ? <>{cards.earth.text}, and more, from the same experiments.</> : "The same experiments improve fire safety at home."}
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-mute transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
