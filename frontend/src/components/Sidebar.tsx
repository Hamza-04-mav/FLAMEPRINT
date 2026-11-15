"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Boxes, ChevronDown, Database, FileText, GitCompareArrows, Globe2, Home, Luggage, MessageSquareText, Wrench, X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { type Tab, useMission } from "@/lib/mission";

export type NavGroup = "main" | "tools";
/** Five pages, each answering one question, plus a small Tools menu. */
export const NAV: { id: Tab; label: string; question: string; icon: React.ReactNode; group: NavGroup; also?: Tab[] }[] = [
  { id: "answer", label: "Answer", question: "Is my habitat safe?", icon: <Home className="h-[18px] w-[18px]" />, group: "main" },
  { id: "ranking", label: "Evidence", question: "What backs it up?", icon: <BarChart3 className="h-[18px] w-[18px]" />, group: "main" },
  { id: "space", label: "Gaps", question: "Where is there no data?", icon: <Boxes className="h-[18px] w-[18px]" />, group: "main" },
  { id: "brief", label: "Brief", question: "What should engineers do?", icon: <FileText className="h-[18px] w-[18px]" />, group: "main" },
  { id: "habitats", label: "Compare", question: "What changes if we move?", icon: <GitCompareArrows className="h-[18px] w-[18px]" />, group: "main", also: ["genome"] },
  { id: "stowage", label: "Can I bring this aboard?", question: "", icon: <Luggage className="h-[16px] w-[16px]" />, group: "tools" },
  { id: "data", label: "Data Lab", question: "", icon: <Database className="h-[16px] w-[16px]" />, group: "tools" },
  { id: "ask", label: "Ask the archive", question: "", icon: <MessageSquareText className="h-[16px] w-[16px]" />, group: "tools" },
  { id: "earth", label: "Down to Earth", question: "", icon: <Globe2 className="h-[16px] w-[16px]" />, group: "tools" },
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

function NavItem({ item, rail, onNavigate, small = false }: { item: (typeof NAV)[number]; rail: boolean; onNavigate?: () => void; small?: boolean }) {
  const { tab, setTab } = useMission();
  const active = tab === item.id || !!item.also?.includes(tab);
  return (
    <button title={rail ? item.label : undefined} aria-current={active ? "page" : undefined}
      onClick={() => { setTab(item.id); onNavigate?.(); }}
      className={`group relative flex w-full items-center gap-3 rounded-[10px] text-left transition-colors duration-150 ${small ? "py-2" : "py-2.5"} ${rail ? "justify-center px-0" : "px-3"} ${
        active ? "text-white" : "text-mute hover:text-ink"}`}>
      {active && (
        <motion.span layoutId={rail ? "nav-active-rail" : "nav-active"} className="absolute inset-0 rounded-[10px] bg-blue/90"
          transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }} />
      )}
      {!active && <span className="absolute inset-0 rounded-[10px] bg-white/[0.035] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />}
      <span className={`relative z-10 ${active ? "text-white" : "text-ox-2/80 group-hover:text-ox"}`}>{item.icon}</span>
      {!rail && (
        <span className="relative z-10 min-w-0 leading-tight">
          <span className={`block ${small ? "text-[13px]" : "text-[14px] font-semibold"}`}>{item.label}</span>
          {item.question && <span className={`block truncate text-[11.5px] ${active ? "text-white/75" : "text-slate-500"}`}>{item.question}</span>}
        </span>
      )}
    </button>
  );
}

function Status({ rail }: { rail: boolean }) {
  const { health, error } = useMission();
  const online = !!health && !error;
  const tone = error ? "#8a8178" : online ? "#efeae3" : "#a39a90";
  const text = error ? "Engine offline" : online ? (health.llm.enabled ? "Online · Groq" : "Online · offline writer") : "Connecting…";
  if (rail) {
    return (
      <div className="flex flex-col items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/NASA/nasa-6.svg" alt="NASA" width={26} height={26} className="shrink-0 opacity-95" title="Built on NASA open data — independent entry, not NASA-endorsed" />
        <span title={text} className="led" style={{ color: tone }} />
      </div>
    );
  }
  return (
    <div className="px-3 text-[11.5px] leading-relaxed text-slate-500">
      <div className="flex items-center gap-2 text-slate-400"><span className="led" style={{ color: tone }} />{text}</div>
      <div className="mt-2.5 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/NASA/nasa-6.svg" alt="NASA insignia" width={30} height={30} className="shrink-0 opacity-95" />
        <span className="text-[11px]">Built on NASA PSI open data. Independent entry, not NASA-endorsed.</span>
      </div>
    </div>
  );
}

function ToolsMenu({ rail, onNavigate }: { rail: boolean; onNavigate?: () => void }) {
  const { tab } = useMission();
  const tools = NAV.filter((n) => n.group === "tools");
  const inTools = tools.some((t) => t.id === tab);
  const [open, setOpen] = useState(inTools);
  useEffect(() => { if (inTools) setOpen(true); }, [inTools]);
  return (
    <div>
      <button onClick={() => setOpen((x) => !x)} aria-expanded={open} title={rail ? "Tools" : undefined}
        className={`flex w-full items-center gap-3 rounded-[10px] py-2 text-[13px] text-mute transition-colors duration-150 hover:text-ink ${rail ? "justify-center" : "px-3"}`}>
        <Wrench className="h-4 w-4" />{!rail && <>Tools<ChevronDown className={`ml-auto h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} /></>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.nav aria-label="Tools" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="flex flex-col gap-0.5 overflow-hidden">
            {tools.map((n) => <NavItem key={n.id} item={n} rail={rail} onNavigate={onNavigate} small />)}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({ rail, onNavigate }: { rail: boolean; onNavigate?: () => void }) {
  return (
    <div className={`flex h-full flex-col ${rail ? "items-stretch px-3 pb-16 pt-5" : "px-4 pb-16 pt-6"}`}>
      <div className={rail ? "" : "px-1"}><Logo compact={rail} /></div>
      <nav aria-label="Pages" className={`flex flex-col gap-1 ${rail ? "mt-8" : "mt-10"}`}>
        {NAV.filter((n) => n.group === "main").map((n) => <NavItem key={n.id} item={n} rail={rail} onNavigate={onNavigate} />)}
      </nav>
      <div className="mt-auto space-y-4 pt-6">
        <ToolsMenu rail={rail} onNavigate={onNavigate} />
        <div className={rail ? "" : "border-t border-[var(--line)] pt-4"}><Status rail={rail} /></div>
      </div>
    </div>
  );
}

/** Desktop sidebar: icon rail on lg, full on xl. Mobile uses <MobileNav>. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden border-r border-[rgba(239,234,227,0.08)] bg-[rgba(21,32,51,0.55)] [backdrop-filter:blur(24px)_saturate(140%)] md:block md:w-[72px] lg:w-[76px] xl:w-[252px]">
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
          <motion.aside className="panel-float fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw] overflow-y-auto !rounded-none border-r lg:hidden"
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
