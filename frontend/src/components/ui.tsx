"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { CONF_LABEL } from "@/lib/format";
import { DUST } from "@/lib/theme";
import type { Confidence } from "@/lib/types";

const DUST_TRACK = "rgba(138,129,120,0.2)";

/** Page header: a small quiet label, one calm headline, at most one supporting sentence, actions on the right. */
export function PageHeader({ kicker, title, children, actions }: {
  index?: string; kicker: string; title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <div className="kicker">{kicker}</div>
        <h1 className="mt-2 t-title">{title}</h1>
        {children && <p className="mt-2 text-[15px] leading-relaxed text-mute">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

/** Full-circle progress ring used for coverage. */
export function Ring({ value, size = 132, stroke = 10, color = DUST[300], label }: { value: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={DUST_TRACK} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${(c * Math.min(100, Math.max(0, value))) / 100} ${c}` }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display font-semibold leading-none text-ink ${value >= 99.5 ? "text-[27px]" : "text-[34px]"}`}><Counter value={value} />%</span>
        {label && <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-mute">{label}</span>}
      </div>
    </div>
  );
}

export function SectionTitle({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="label text-ox/80">{kicker}</div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export interface SliderTick { value: number; label?: string }

export function Slider({
  label, value, min, max, step, onChange, unit, color = DUST[300], hint, display, ticks,
}: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
  unit?: string; color?: string; hint?: string; display?: string; ticks?: SliderTick[];
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const posOf = (v: number) => ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100;
  const hasLabels = !!ticks?.some((t) => t.label);
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-slate-300">{label}</span>
        <span className="font-mono text-[13px] tabular-nums text-slate-100">
          {display ?? value}
          {unit && <span className="ml-0.5 text-slate-500">{unit}</span>}
        </span>
      </div>
      <div className="relative">
        {/* preset tick marks sit on the track (signifiers) */}
        {ticks?.map((t, i) => {
          const p = posOf(t.value);
          const active = Math.abs(p - pct) < 1.2;
          return <span key={i} aria-hidden title={t.label}
            className="pointer-events-none absolute top-1/2 h-2 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${p}%`, background: active ? "var(--sun-500)" : "rgba(138,129,120,0.6)" }} />;
        })}
        <input
          type="range" className="fp-range" min={min} max={max} step={step} value={value}
          aria-label={label}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ ["--pct" as string]: `${pct}%`, ["--fill" as string]: color }}
        />
      </div>
      {hasLabels && (
        <div className="relative mt-1 h-3">
          {ticks!.filter((t) => t.label).map((t, i) => {
            const p = posOf(t.value);
            const align = p <= 4 ? "translate-x-0" : p >= 96 ? "-translate-x-full" : "-translate-x-1/2";
            return <span key={i} className={`axis-tag absolute whitespace-nowrap ${align}`} style={{ left: `${p}%` }}>{t.label}</span>;
          })}
        </div>
      )}
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</div>}
    </label>
  );
}

export function Toggle({ active, onClick, children, color = DUST[300] }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active}
      className={`rounded-[4px] border px-2.5 py-1.5 text-xs font-medium capitalize transition-all ${
        active ? "text-slate-50" : "border-slate-700/70 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
      style={active ? { borderColor: color, background: `${color}1f`, boxShadow: `0 0 18px -6px ${color}` } : undefined}
    >
      {children}
    </button>
  );
}

export function ConfidenceBadge({ c }: { c: Confidence }) {
  const kind: EvidenceKind = c === "data" ? "psi" : c === "approx" ? "catalog" : "unknown";
  const text = { data: "PSI data", approx: "approx", unknown: "unknown" }[c];
  return <span title={CONF_LABEL[c]}><Evidence kind={kind} label={text} /></span>;
}

export function Counter({ value, decimals = 0, className = "" }: { value: number; decimals?: number; className?: string }) {
  const mv = useMotionValue(0);
  const txt = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={`tabular-nums ${className}`}>{txt}</motion.span>;
}

export function Gauge({ value, label, size = 148 }: { value: number; label: string; size?: number }) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const arc = 0.75;
  const color = value >= 70 ? DUST[100] : value >= 40 ? DUST[300] : DUST[500];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={DUST_TRACK} strokeWidth="9"
          strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${(c * arc * value) / 100} ${c}` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 3px ${color}66)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Counter value={value} className="font-display text-4xl font-semibold text-slate-50" />
        <span className="label mt-0.5 !text-[9.5px]">{label}</span>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Evidence classes: the single visual language for how far a number can be trusted. */
export type EvidenceKind = "psi" | "catalog" | "estimate" | "illustrative" | "unknown";
export const EVIDENCE: Record<EvidenceKind, { label: string; color: string; hint: string }> = {
  psi: { label: "Verified · PSI data", color: "var(--ev-psi)", hint: "Derived from imported NASA PSI test records" },
  catalog: { label: "Catalog · approx", color: "var(--ev-catalog)", hint: "Coarse range from public NASA summaries. Verify against PSI" },
  estimate: { label: "Estimate", color: "var(--ev-estimate)", hint: "Order-of-magnitude physics estimate, not a measurement" },
  illustrative: { label: "Illustrative", color: "var(--ev-illustrative)", hint: "Simulation / teaching aid. Not experimental data" },
  unknown: { label: "Not characterized", color: "var(--dust-500)", hint: "No value available for this axis" },
};

export function EvidenceMark({ kind, size = 8 }: { kind: EvidenceKind; size?: number }) {
  const c = EVIDENCE[kind].color;
  const common = { width: size, height: size, flex: "none" } as const;
  if (kind === "psi") return <span style={{ ...common, background: c, borderRadius: 1 }} />;
  if (kind === "catalog") return <span style={{ ...common, border: `1.5px solid ${c}`, transform: "rotate(45deg) scale(.85)" }} />;
  if (kind === "illustrative") return <span className="hatch" style={{ ...common, border: `1px solid ${c}`, borderRadius: 1 }} />;
  if (kind === "estimate") return <span style={{ ...common, border: `1.5px dashed ${c}`, borderRadius: 9999 }} />;
  return <span style={{ ...common, border: `1px solid ${c}`, borderRadius: 1, opacity: 0.7 }} />;
}

export function Evidence({ kind, label, className = "" }: { kind: EvidenceKind; label?: string; className?: string }) {
  const e = EVIDENCE[kind];
  return (
    <span title={e.hint}
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${className}`}
      style={{ color: e.color, borderColor: `color-mix(in srgb, ${e.color} 35%, transparent)`, background: `color-mix(in srgb, ${e.color} 8%, transparent)` }}>
      <EvidenceMark kind={kind} size={7} />
      {label ?? e.label}
    </span>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      <span>⚠ {message}</span>
      {onRetry && <button onClick={onRetry} className="rounded-md border border-rose-300/40 px-2 py-0.5 text-xs hover:bg-rose-400/20">Retry</button>}
    </div>
  );
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "cyan" | "amber" | "emerald" | "rose" }) {
  const t = {
    slate: "border-dust-600/50 text-dust-300",
    cyan: "border-dust-500/40 text-dust-200 bg-dust-500/10",
    amber: "border-sun/40 text-sun bg-sun/[0.06]",
    emerald: "border-dust-400/40 text-dust-200 bg-dust-400/[0.06]",
    rose: "border-sun/40 text-sun bg-sun/[0.06]",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10.5px] tracking-wide ${t}`}>{children}</span>;
}
