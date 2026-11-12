"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Boxes, Database, FileText, Globe2, Home, MessageSquareText, Network, X,
} from "lucide-react";
import { useId } from "react";
import { type Tab, useMission } from "@/lib/mission";

export const NAV: { id: Tab; label: string; short: string; icon: React.ReactNode; group: "main" | "tools" }[] = [
  { id: "overview", label: "Mission Control", short: "Control", icon: <Home className="h-[18px] w-[18px]" />, group: "main" },
  { id: "space", label: "Coverage Map", short: "Coverage", icon: <Boxes className="h-[18px] w-[18px]" />, group: "main" },
  { id: "ranking", label: "Investigation Rankings", short: "Rankings", icon: <BarChart3 className="h-[18px] w-[18px]" />, group: "main" },
  { id: "brief", label: "Fire Safety Brief", short: "Brief", icon: <FileText className="h-[18px] w-[18px]" />, group: "main" },
  { id: "genome", label: "Investigation Genome", short: "Genome", icon: <Network className="h-[18px] w-[18px]" />, group: "main" },
  { id: "earth", label: "Down to Earth", short: "Earth", icon: <Globe2 className="h-[18px] w-[18px]" />, group: "main" },
  { id: "ask", label: "Ask the Archive", short: "Ask", icon: <MessageSquareText className="h-[18px] w-[18px]" />, group: "tools" },
  { id: "data", label: "Data Lab", short: "Data", icon: <Database className="h-[18px] w-[18px]" />, group: "tools" },
];

/** FLAMEPRINT mark: a flame held inside an orbital ring. */
export function LogoMark({ size = 40 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const fl = `fl${uid}`, rg = `rg${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id={fl} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#E2552B" />
          <stop offset="0.45" stopColor="#FF8B32" />
          <stop offset="1" stopColor="#FFC15B" />
        </linearGradient>
        <linearGradient id={rg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#19C9FF" />
          <stop offset="1" stopColor="#087BFF" />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="27" rx="20" ry="8.5" fill="none" stroke={`url(#${rg})`} strokeWidth="1.6" transform="rotate(-18 24 27)" opacity="0.9" />
      <path d="M24 6c2.6 6.3 9.4 9.6 9.4 18.1A9.4 9.4 0 0 1 24 33.5a9.4 9.4 0 0 1-9.4-9.4c0-4.9 2.6-7.6 4.6-9.9.3 3 1.6 4.8 3.4 5.6C22 15.3 21.6 10.6 24 6Z" fill={`url(#${fl})`} />
      <path d="M24 22.5c1.6 2.3 3.6 3.6 3.6 6.3a3.6 3.6 0 0 1-7.2 0c0-1.9 1.2-3.1 2.2-4 .1 1 .5 1.6 1.1 1.9-.2-1.6-.1-2.9.3-4.2Z" fill="#FFF3DC" opacity="0.9" />
      <path d="M8.3 31.6a20 8.5 -18 0 0 31.4-9.4" fill="none" stroke={`url(#${rg})`} strokeWidth="1.6" />
      <circle cx="40.6" cy="20.2" r="2" fill="#19C9FF" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? "justify-center" : "gap-3"}`}>
      <LogoMark size={compact ? 36 : 42} />
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[19px] font-bold tracking-[0.08em] text-ink">FLAMEPRINT</div>
          <div className="text-[11.5px] text-mute">Space Fire Intelligence</div>
        </div>
      )}
    </div>
  );
}

function NavItem({ id, label, icon, rail, onNavigate }: { id: Tab; label: string; icon: React.ReactNode; rail: boolean; onNavigate?: () => void }) {
  const { tab, setTab } = useMission();
  const active = tab === id;
  return (
    <button title={rail ? label : undefined} aria-current={active ? "page" : undefined}
      onClick={() => { setTab(id); onNavigate?.(); }}
      className={`group relative flex w-full items-center gap-3 rounded-[10px] py-2.5 text-left transition-colors ${rail ? "justify-center px-0" : "px-3.5"} ${
        active ? "text-white" : "text-mute hover:text-ink"}`}>
      {active && (
        <motion.span layoutId={rail ? "nav-active-rail" : "nav-active"}
          className="absolute inset-0 rounded-[10px] bg-[linear-gradient(180deg,#1688ff,#0868e0)] shadow-[0_8px_24px_-10px_rgba(8,123,255,0.9),inset_0_1px_0_rgba(255,255,255,0.18)]"
          transition={{ type: "spring", stiffness: 420, damping: 36 }} />
      )}
      {!active && <span className="absolute inset-0 rounded-[10px] bg-white/[0.035] opacity-0 transition-opacity group-hover:opacity-100" />}
      <span className={`relative z-10 transition-colors ${active ? "text-white" : "text-ox-2/80 group-hover:text-ox"}`}>{icon}</span>
      {!rail && <span className="relative z-10 text-[13.5px] font-medium">{label}</span>}
    </button>
  );
}

function SystemCard({ compact }: { compact?: boolean }) {
  const { health, error } = useMission();
  const online = !!health && !error;
  const tone = error ? "#FF5A4E" : online ? "#34D399" : "#7E94B4";
  if (compact) {
    return <span title={error ? "Backend offline" : online ? "System online" : "Connecting"} className="led mx-auto block" style={{ color: tone }} />;
  }
  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-space-900/60 px-3.5 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: online ? "#6EE7B7" : error ? "#FF9A91" : "#A5B8D2" }}>
        <span className="led" style={{ color: tone }} />
        {error ? "Backend offline" : online ? "System Online" : "Connecting…"}
      </div>
      <div className="mt-1 text-[11.5px] text-mute">
        {health ? `${health.llm.enabled ? "Claude SI" : "Offline SI"} · ${health.db.backend === "postgres" ? "pgvector" : "local index"}` : "Linking archive"}
      </div>
    </div>
  );
}

function Attribution() {
  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-[var(--line)] bg-space-900/40 px-3.5 py-3">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <circle cx="16" cy="16" r="10" fill="#0B1930" stroke="#087BFF" strokeWidth="1.3" />
        <ellipse cx="16" cy="16" rx="15" ry="5" fill="none" stroke="#19C9FF" strokeWidth="1.1" transform="rotate(-25 16 16)" />
        <circle cx="16" cy="16" r="3" fill="#48BFFF" />
      </svg>
      <div className="leading-snug">
        <div className="text-[11px] text-mute">Built on open data from</div>
        <div className="text-[12.5px] font-medium text-ink">NASA PSI</div>
        <div className="mt-0.5 text-[10.5px] text-slate-500">Physical Sciences Informatics. Independent project, not NASA-endorsed.</div>
      </div>
    </div>
  );
}

function Panel({ rail, onNavigate }: { rail: boolean; onNavigate?: () => void }) {
  const main = NAV.filter((n) => n.group === "main");
  const tools = NAV.filter((n) => n.group === "tools");
  return (
    <div className={`flex h-full flex-col ${rail ? "items-stretch px-3 py-5" : "px-4 py-6"}`}>
      <div className={rail ? "" : "px-1"}><Logo compact={rail} /></div>
      <nav aria-label="Pages" className={`flex flex-col gap-1 ${rail ? "mt-8" : "mt-9"}`}>
        {main.map((n) => <NavItem key={n.id} id={n.id} label={n.label} icon={n.icon} rail={rail} onNavigate={onNavigate} />)}
      </nav>
      <div className={`mt-6 ${rail ? "mx-auto w-6" : "px-3.5"}`}>
        {rail ? <div className="rule" /> : <div className="label !text-[9.5px] !tracking-[0.22em] text-slate-500">Tools</div>}
      </div>
      <nav aria-label="Tools" className="mt-2 flex flex-col gap-1">
        {tools.map((n) => <NavItem key={n.id} id={n.id} label={n.label} icon={n.icon} rail={rail} onNavigate={onNavigate} />)}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        {!rail && <Attribution />}
        <SystemCard compact={rail} />
      </div>
    </div>
  );
}

/** Desktop sidebar: icon rail on lg, full on xl. Mobile uses <MobileNav>. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--line)] bg-[linear-gradient(180deg,rgba(7,18,37,0.92),rgba(3,8,20,0.94))] backdrop-blur-xl lg:block lg:w-[76px] xl:w-[252px]">
      <div className="hidden h-full overflow-y-auto no-scrollbar xl:block"><Panel rail={false} /></div>
      <div className="h-full overflow-y-auto no-scrollbar xl:hidden"><Panel rail /></div>
    </aside>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside className="fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw] overflow-y-auto border-r border-[var(--line)] bg-space-950 lg:hidden"
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}>
            <button onClick={onClose} aria-label="Close navigation"
              className="absolute right-3 top-5 z-10 grid h-8 w-8 place-items-center rounded-lg text-mute hover:text-ink">
              <X className="h-4 w-4" />
            </button>
            <Panel rail={false} onNavigate={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
