"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, Check, ChevronDown, Menu, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { type Environment, environmentFor, ENV_LABEL } from "@/lib/environment";
import { fmtGravity, toPsi } from "@/lib/format";
import { useMission } from "@/lib/mission";
import { MobileNav } from "./Sidebar";
import { EVIDENCE, type EvidenceKind, EvidenceMark } from "./ui";

/* ───────── small purpose-built glyphs ───────── */

export function PlanetGlyph({ env, size = 40 }: { env: Environment; size?: number }) {
  const gid = `pg${useId().replace(/:/g, "")}`;
  // navy / taupe only — moon = taupe grey, mars = warm taupe, orbit/earth = lighter navy
  const body = { lunar: ["#c2bab0", "#5a5650"], mars: ["#b89a82", "#5a4436"], orbit: ["#5a6e94", "#182a44"], earth: ["#5a6e94", "#182a44"] }[env];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor={body[0]} />
          <stop offset="1" stopColor={body[1]} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="11" fill={`url(#${gid})`} />
      {env === "lunar" && (<><circle cx="16" cy="17" r="2.2" fill="#8a8178" opacity=".7" /><circle cx="23" cy="24" r="1.6" fill="#8a8178" opacity=".6" /><circle cx="24" cy="15" r="1" fill="#8a8178" opacity=".6" /></>)}
      {(env === "orbit" || env === "earth") && <path d="M12 18c3-2 5 1 8-1s4-3 7-1M13 24c3 1 6-2 9 0" stroke="#a7b4cc" strokeWidth="1.3" fill="none" opacity=".6" />}
      {env === "mars" && <path d="M11 20c4-1 6 2 10 1s5-2 8-1" stroke="#c2b4a2" strokeWidth="1" fill="none" opacity=".5" />}
      <ellipse cx="20" cy="20" rx="18" ry="5.5" fill="none" stroke="#a39a90" strokeWidth="1.2" transform="rotate(-20 20 20)" opacity=".8" />
    </svg>
  );
}

function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open, close]);
  return ref;
}

function MissionPicker() {
  const { habitats, scenario, applyHabitat, setConfigOpen } = useMission();
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const hab = habitats.find((h) => h.id === scenario.habitatId);
  const env = environmentFor(scenario.habitatId, scenario.gravityG);
  return (
    <div ref={ref} className="relative inline-flex max-w-full">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox"
        title="Change habitat"
        className="flex min-w-0 max-w-full items-center gap-2.5 rounded-full border border-[var(--line-strong)] bg-space-900/70 py-1 pl-1.5 pr-3 text-left backdrop-blur-xl transition-colors duration-200 hover:border-ox/50">
        <PlanetGlyph env={env} size={28} />
        <span className="truncate text-[14px] font-semibold text-ink">{hab?.name ?? "Custom mission"}</span>
        <span className="hidden truncate font-mono text-[12px] text-mute sm:inline">
          {Math.round(scenario.o2Pct)}% O₂ · {toPsi(scenario.pressureKpa)} psi · {fmtGravity(scenario.gravityG)} g
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-mute transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="listbox" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="panel-float absolute left-0 top-full z-50 mt-2 w-[330px] overflow-hidden p-1.5">
            {habitats.map((h) => {
              const on = h.id === scenario.habitatId;
              return (
                <button key={h.id} role="option" aria-selected={on} onClick={() => { applyHabitat(h); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition-colors ${on ? "bg-blue/15" : "hover:bg-white/[0.04]"}`}>
                  <PlanetGlyph env={environmentFor(h.id, h.gravityG)} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{h.name}</span>
                    <span className="block font-mono text-[10.5px] text-mute">{h.o2Pct}% O₂ · {toPsi(h.pressureKpa)} psi · {fmtGravity(h.gravityG)} g{h.assumed ? " · assumed" : ""}</span>
                  </span>
                  {on && <Check className="h-4 w-4 text-ox" />}
                </button>
              );
            })}
            <div className="my-1 h-px bg-[var(--line)]" />
            <button onClick={() => { setOpen(false); setConfigOpen(true); }}
              className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] text-ox hover:bg-white/[0.04]">
              <SlidersHorizontal className="h-4 w-4" /> Adjust conditions…
            </button>
            <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] text-slate-500">Environment: {ENV_LABEL[env]}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusPopover() {
  const { health, error, analyzing } = useMission();
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const tests = health?.stats.tests ?? 0;
  // status LEDs: dust only (no red/green). bright dust = nominal, dim dust = degraded
  const OK = "#efeae3", WARN = "#8a8178", WAIT = "#a39a90";
  const rows: [string, string, string][] = [
    ["Backend", error ? "Offline" : health ? "Online" : "Connecting", error ? WARN : health ? OK : WAIT],
    ["Data mode", tests ? `PSI · ${tests} tests` : "Catalog (no PSI files yet)", tests ? OK : WAIT],
    ["SI engine", health?.llm.enabled ? `Groq · ${health.llm.model}` : "Offline writer", health?.llm.enabled ? OK : WAIT],
    ["Search index", health?.db.backend === "postgres" ? "PostgreSQL + pgvector" : "In-memory", health?.db.ok ? OK : WAIT],
  ];
  const kinds: EvidenceKind[] = ["psi", "catalog", "estimate", "illustrative"];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="System status and evidence key" aria-expanded={open}
        className={`grid h-10 w-10 place-items-center rounded-full border transition-colors ${open ? "border-ox/60 bg-blue/15" : "border-[var(--line-strong)] bg-space-900/60 hover:border-ox/50"}`}>
        <Activity className={`h-5 w-5 ${analyzing ? "text-flame-1" : "text-ox"}`} />
        {analyzing && <span className="absolute right-2 top-2 h-1.5 w-1.5 animate-ping rounded-full bg-flame-1" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}
            className="panel-float absolute right-0 top-full z-50 mt-2 w-[320px] p-4">
            <div className="label mb-2">System status</div>
            <div className="space-y-1.5">
              {rows.map(([k, v, c]) => (
                <div key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="text-mute">{k}</span>
                  <span className="flex items-center gap-2 text-right text-ink"><span className="led" style={{ color: c }} />{v}</span>
                </div>
              ))}
            </div>
            <div className="rule my-3.5" />
            <div className="label mb-2">Evidence key</div>
            <ul className="space-y-2">
              {kinds.map((k) => (
                <li key={k} className="flex items-start gap-2.5 text-[12px]">
                  <span className="mt-[3px]"><EvidenceMark kind={k} size={9} /></span>
                  <span><span style={{ color: EVIDENCE[k].color }}>{EVIDENCE[k].label}</span>
                    <span className="block text-[11px] text-slate-500">{EVIDENCE[k].hint}</span></span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Slim top bar: one habitat pill (every page depends on it) and the status / evidence-key button. */
export function Header() {
  const [nav, setNav] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-[1200px] items-center gap-2">
          <button onClick={() => setNav(true)} aria-label="Open navigation"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] bg-space-900/70 text-mute backdrop-blur-xl hover:text-ink md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1"><MissionPicker /></div>
          <StatusPopover />
        </div>
      </header>
      <MobileNav open={nav} onClose={() => setNav(false)} />
    </>
  );
}
