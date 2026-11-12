"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, Check, ChevronDown, Menu, SlidersHorizontal, Wind } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { type Environment, environmentFor, ENV_LABEL } from "@/lib/environment";
import { toPsi } from "@/lib/format";
import { useMission } from "@/lib/mission";
import { MobileNav } from "./Sidebar";
import { Counter, EVIDENCE, type EvidenceKind, EvidenceMark } from "./ui";

/* ───────── small purpose-built glyphs ───────── */

export function PlanetGlyph({ env, size = 40 }: { env: Environment; size?: number }) {
  const gid = `pg${useId().replace(/:/g, "")}`;
  const body = { lunar: ["#c9d2df", "#5d6878"], mars: ["#e08a5a", "#6e2d17"], orbit: ["#5fb2ff", "#0a3a8c"], earth: ["#5fb2ff", "#0a3a8c"] }[env];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <radialGradient id={gid} cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor={body[0]} />
          <stop offset="1" stopColor={body[1]} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="11" fill={`url(#${gid})`} />
      {env === "lunar" && (<><circle cx="16" cy="17" r="2.2" fill="#8d97a6" opacity=".7" /><circle cx="23" cy="24" r="1.6" fill="#8d97a6" opacity=".6" /><circle cx="24" cy="15" r="1" fill="#8d97a6" opacity=".6" /></>)}
      {(env === "orbit" || env === "earth") && <path d="M12 18c3-2 5 1 8-1s4-3 7-1M13 24c3 1 6-2 9 0" stroke="#7fe0b0" strokeWidth="1.3" fill="none" opacity=".7" />}
      {env === "mars" && <path d="M11 20c4-1 6 2 10 1s5-2 8-1" stroke="#ffc9a8" strokeWidth="1" fill="none" opacity=".5" />}
      <ellipse cx="20" cy="20" rx="18" ry="5.5" fill="none" stroke="#19C9FF" strokeWidth="1.2" transform="rotate(-20 20 20)" opacity=".85" />
    </svg>
  );
}

function GravityGlyph({ g }: { g: number }) {
  const len = 4 + 10 * Math.sqrt(Math.min(1, g));
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="7" r="3.2" fill="none" stroke="#48BFFF" strokeWidth="1.5" />
      <motion.line x1="15" y1="12" x2="15" animate={{ y2: 12 + len }} stroke="#19C9FF" strokeWidth="1.8" strokeLinecap="round" />
      <motion.path animate={{ d: `M11 ${8 + len} L15 ${12 + len} L19 ${8 + len}` }} fill="none" stroke="#19C9FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="6" y1="28" x2="24" y2="28" stroke="#566C8E" strokeWidth="1.2" />
    </svg>
  );
}

function O2Ring({ pct }: { pct: number }) {
  const r = 12, c = 2 * Math.PI * r;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(120,160,210,0.2)" strokeWidth="2.4" />
      <motion.circle cx="16" cy="16" r={r} fill="none" stroke="#19C9FF" strokeWidth="2.4" strokeLinecap="round"
        transform="rotate(-90 16 16)" animate={{ strokeDasharray: `${(c * Math.min(100, pct)) / 100} ${c}` }} transition={{ duration: 0.6 }} />
      <text x="16" y="19.5" textAnchor="middle" className="fill-ink font-sans text-[9.5px] font-semibold">O₂</text>
    </svg>
  );
}

function PressureDial({ kpa }: { kpa: number }) {
  const t = Math.min(1, Math.max(0, kpa / 110));
  const ang = -120 + 240 * t;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <path d="M6.5 23.5 A12 12 0 1 1 25.5 23.5" fill="none" stroke="rgba(120,160,210,0.25)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6.5 23.5 A12 12 0 1 1 25.5 23.5" fill="none" stroke="#087BFF" strokeWidth="2.4" strokeLinecap="round"
        strokeDasharray={`${50 * t} 60`} pathLength={50} />
      <motion.line x1="16" y1="17" x2="16" y2="8" stroke="#F2F7FF" strokeWidth="1.8" strokeLinecap="round"
        animate={{ rotate: ang }} style={{ originX: "16px", originY: "17px" }} transition={{ type: "spring", stiffness: 120, damping: 14 }} />
      <circle cx="16" cy="17" r="2" fill="#F2F7FF" />
    </svg>
  );
}

function Readout({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} title={`Adjust ${label.toLowerCase()}`}
      className="group flex min-w-fit shrink-0 items-center gap-3 rounded-[10px] px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04] sm:px-4">
      <span className="grid h-9 w-9 place-items-center">{icon}</span>
      <span className="leading-tight">
        <span className="block text-[11.5px] text-mute">{label}</span>
        <span className="block whitespace-nowrap font-display text-[17px] font-semibold tabular-nums text-ink">{value}</span>
      </span>
    </button>
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
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox"
        className="flex items-center gap-3 rounded-[10px] py-1.5 pl-2 pr-3 text-left transition-colors hover:bg-white/[0.04]">
        <PlanetGlyph env={env} size={42} />
        <span className="leading-tight">
          <span className="block text-[11.5px] text-mute">Mission Scenario</span>
          <span className="block whitespace-nowrap font-display text-[19px] font-semibold text-ink">{hab?.name ?? "Custom mission"}</span>
        </span>
        <ChevronDown className={`ml-2 h-4 w-4 text-mute transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="listbox" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-50 mt-2 w-[330px] overflow-hidden rounded-[12px] border border-[var(--line-strong)] bg-space-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
            {habitats.map((h) => {
              const on = h.id === scenario.habitatId;
              return (
                <button key={h.id} role="option" aria-selected={on} onClick={() => { applyHabitat(h); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition-colors ${on ? "bg-blue/15" : "hover:bg-white/[0.04]"}`}>
                  <PlanetGlyph env={environmentFor(h.id, h.gravityG)} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{h.name}</span>
                    <span className="block font-mono text-[10.5px] text-mute">{h.o2Pct}% O₂ · {toPsi(h.pressureKpa)} psi · {h.gravityG} g{h.assumed ? " · assumed" : ""}</span>
                  </span>
                  {on && <Check className="h-4 w-4 text-ox" />}
                </button>
              );
            })}
            <div className="my-1 h-px bg-[var(--line)]" />
            <button onClick={() => { setOpen(false); setConfigOpen(true); }}
              className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] text-ox hover:bg-white/[0.04]">
              <SlidersHorizontal className="h-4 w-4" /> Custom parameters…
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
  const rows: [string, string, string][] = [
    ["Backend", error ? "Offline" : health ? "Online" : "Connecting", error ? "#FF5A4E" : health ? "#34D399" : "#7E94B4"],
    ["Data mode", tests ? `PSI · ${tests} tests` : "Catalog (no PSI files yet)", tests ? "#34D399" : "#FFC15B"],
    ["SI engine", health?.llm.enabled ? `Claude · ${health.llm.model}` : "Offline writer", health?.llm.enabled ? "#19C9FF" : "#FFC15B"],
    ["Search index", health?.db.backend === "postgres" ? "PostgreSQL + pgvector" : "In-memory", health?.db.ok ? "#34D399" : "#FFC15B"],
  ];
  const kinds: EvidenceKind[] = ["psi", "catalog", "estimate", "illustrative"];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="System status and evidence key" aria-expanded={open}
        className={`grid h-11 w-11 place-items-center rounded-[12px] border transition-colors ${open ? "border-ox/60 bg-blue/15" : "border-[var(--line-strong)] bg-space-900/60 hover:border-ox/50"}`}>
        <Activity className={`h-5 w-5 ${analyzing ? "text-flame-1" : "text-ox"}`} />
        {analyzing && <span className="absolute right-2 top-2 h-1.5 w-1.5 animate-ping rounded-full bg-flame-1" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-[12px] border border-[var(--line-strong)] bg-space-900/95 p-4 shadow-2xl backdrop-blur-xl">
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

/** Top mission status bar: the scenario every page is computed for. */
export function Header() {
  const { scenario, setConfigOpen } = useMission();
  const [nav, setNav] = useState(false);
  const cfg = () => setConfigOpen(true);
  return (
    <>
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-[1720px] items-center gap-2 sm:gap-3">
          <button onClick={() => setNav(true)} aria-label="Open navigation"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[var(--line-strong)] bg-space-900/70 text-mute backdrop-blur-xl hover:text-ink lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="panel flex min-w-0 flex-1 items-center !rounded-[16px] px-2 py-1.5 sm:px-3">
            <div className="flex min-w-0 flex-1 items-center overflow-x-auto no-scrollbar">
              <MissionPicker />
              <span className="mx-1 hidden h-10 w-px shrink-0 bg-[var(--line-strong)] md:block" />
              <div className="hidden items-center md:flex">
                <Readout onClick={cfg} label="Gravity" icon={<GravityGlyph g={scenario.gravityG} />}
                  value={<><Counter value={scenario.gravityG} decimals={scenario.gravityG > 0 && scenario.gravityG < 0.1 ? 3 : 2} /> g</>} />
                <span className="h-10 w-px shrink-0 bg-[var(--line)]" />
                <Readout onClick={cfg} label="O₂" icon={<O2Ring pct={scenario.o2Pct} />} value={<><Counter value={scenario.o2Pct} decimals={scenario.o2Pct % 1 ? 1 : 0} />%</>} />
                <span className="h-10 w-px shrink-0 bg-[var(--line)]" />
                <Readout onClick={cfg} label="Pressure" icon={<PressureDial kpa={scenario.pressureKpa} />}
                  value={<><Counter value={toPsi(scenario.pressureKpa)} decimals={1} /> psi</>} />
                <span className="h-10 w-px shrink-0 bg-[var(--line)]" />
                <Readout onClick={cfg} label="Airflow" icon={<Wind className="h-6 w-6 text-ox-2" />}
                  value={<><Counter value={scenario.flowCmS} decimals={scenario.flowCmS % 1 ? 1 : 0} /> cm/s</>} />
              </div>
            </div>
            <button onClick={cfg} className="btn btn-ghost ml-1 shrink-0 !px-3" aria-label="Configure mission">
              <SlidersHorizontal className="h-[18px] w-[18px]" /><span className="hidden 2xl:inline">Configure</span>
            </button>
          </div>
          <StatusPopover />
        </div>
        {/* compact readouts below md */}
        <div className="mx-auto mt-2 flex max-w-[1720px] gap-2 overflow-x-auto no-scrollbar md:hidden">
          {[
            ["g", `${scenario.gravityG} g`], ["O₂", `${scenario.o2Pct}%`], ["P", `${toPsi(scenario.pressureKpa)} psi`], ["flow", `${scenario.flowCmS} cm/s`],
          ].map(([k, v]) => (
            <button key={k} onClick={cfg} className="shrink-0 rounded-[8px] border border-[var(--line)] bg-space-900/70 px-2.5 py-1 font-mono text-[11px] text-mute backdrop-blur">
              {k} <span className="text-ink">{v}</span>
            </button>
          ))}
        </div>
      </header>
      <MobileNav open={nav} onClose={() => setNav(false)} />
    </>
  );
}
