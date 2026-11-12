"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PILLAR_COLOR } from "@/lib/format";
import { useMission } from "@/lib/mission";
import type { Spinoff } from "@/lib/types";
import { PageHeader } from "./ui";

/* ───────── line-art illustrations (palette only) ───────── */
const S = { fill: "none", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Art({ kind }: { kind: string }) {
  const c = "#48BFFF", o = "#FF8B32", a = "#FFC15B";
  const body = {
    mist: (<>
      <path d="M22 66h22v-8H22z" stroke={c} {...S} /><path d="M30 58V44h6v14M36 48h10l4 4" stroke={c} {...S} />
      {[[60, 40], [66, 50], [72, 36], [70, 60], [80, 46], [78, 30], [86, 56]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 2.8} stroke={c} {...S} />)}
      <path d="M88 76c-4-6 2-9 0-15 5 3 8 8 5 15" stroke={o} {...S} opacity=".55" />
    </>),
    smoke: (<>
      <path d="M22 26h64" stroke={c} {...S} /><path d="M32 26v8a22 8 0 0 0 44 0v-8" stroke={c} {...S} />
      <circle cx="54" cy="36" r="3" fill={a} /><path d="M46 36h-6M68 36h-6" stroke={c} {...S} opacity=".6" />
      <path d="M40 74c-6-6 4-8-2-15M54 78c-6-7 5-9-1-17M68 74c-6-6 4-8-2-15" stroke="#A5B8D2" {...S} opacity=".7" />
    </>),
    gear: (<>
      <path d="M26 62c0-20 12-32 28-32s28 12 28 32" stroke={c} {...S} /><path d="M20 62h68v6H20z" stroke={c} {...S} />
      <path d="M54 30v-6M44 34l6 10h8l6-10" stroke={c} {...S} /><path d="M40 52h28" stroke={a} {...S} />
      <path d="M78 80l8-8M86 80l-8-8" stroke={o} {...S} opacity=".5" />
    </>),
    material: (<>
      <rect x="44" y="36" width="20" height="44" rx="2" stroke={c} {...S} />
      <path d="M54 36c-8-6 0-12-3-20 8 5 12 12 7 20" stroke={o} {...S} /><path d="M54 36c-3-3 1-6 0-10 3 3 4 6 2 10" stroke={a} {...S} />
      <path d="M30 80h48" stroke="#A5B8D2" {...S} /><path d="M70 50h10M70 58h7M70 66h10" stroke={c} {...S} opacity=".6" />
    </>),
    combustion: (<>
      <circle cx="54" cy="54" r="22" stroke={c} {...S} /><circle cx="54" cy="54" r="12" stroke={c} {...S} opacity=".6" />
      <path d="M54 62c-6-4 0-9-2-14 6 3 9 9 4 14" stroke="#19C9FF" {...S} />
      <path d="M22 54h10M76 54h10M54 22v10M54 76v10" stroke={a} {...S} opacity=".7" />
    </>),
    confined: (<>
      <path d="M18 56c0-10 10-16 22-16h30c10 0 20 6 20 16s-10 16-20 16H40c-12 0-22-6-22-16Z" stroke={c} {...S} />
      <path d="M50 40v-8h12v8" stroke={c} {...S} />{[38, 52, 66].map((x) => <circle key={x} cx={x} cy={56} r="3.5" stroke={c} {...S} />)}
      <path d="M78 64c-4-4 2-6 0-10 4 2 6 6 3 10" stroke={o} {...S} />
    </>),
  } as Record<string, React.ReactNode>;
  return (
    <svg viewBox="0 0 108 108" className="h-24 w-24" aria-hidden>
      <circle cx="54" cy="54" r="50" fill="rgba(8,123,255,0.06)" stroke="rgba(72,170,255,0.18)" />
      {body[kind] ?? body.material}
    </svg>
  );
}

const kindOf = (t: string) => {
  const s = t.toLowerCase();
  if (s.includes("mist") || s.includes("extinguish")) return "mist";
  if (s.includes("smoke")) return "smoke";
  if (s.includes("gear") || s.includes("firefighter")) return "gear";
  if (s.includes("confined")) return "confined";
  if (s.includes("combustion")) return "combustion";
  return "material";
};

function EarthHero({ apps, links }: { apps: number; links: number }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-[18px] border border-[var(--line)] bg-space-950">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id="eh-planet" cx="38%" cy="30%" r="80%"><stop offset="0" stopColor="#2f86ff" /><stop offset="0.55" stopColor="#0b3a8c" /><stop offset="1" stopColor="#04112a" /></radialGradient>
          <radialGradient id="eh-atmo" cx="50%" cy="50%" r="50%"><stop offset="0.86" stopColor="#19C9FF" stopOpacity="0" /><stop offset="0.93" stopColor="#19C9FF" stopOpacity="0.35" /><stop offset="1" stopColor="#19C9FF" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="930" cy="560" r="470" fill="url(#eh-atmo)" />
        <circle cx="930" cy="560" r="430" fill="url(#eh-planet)" />
        <path d="M640 330c80-40 160-20 230-60s170-30 240 0" stroke="#5fd39a" strokeOpacity=".22" strokeWidth="18" fill="none" />
        <ellipse cx="930" cy="560" rx="540" ry="150" fill="none" stroke="#48BFFF" strokeOpacity=".35" strokeDasharray="3 7" transform="rotate(-8 930 560)" />
        <g transform="translate(560 128) rotate(-8)">
          <rect x="-16" y="-2" width="32" height="4" fill="#DCE7F5" /><rect x="-26" y="-7" width="8" height="14" fill="#c79a3a" /><rect x="18" y="-7" width="8" height="14" fill="#c79a3a" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,20,0.95),rgba(3,8,20,0.6)_45%,transparent_75%)]" />
      <div className="relative flex min-h-[240px] flex-col justify-center gap-5 p-7 sm:p-9">
        <p className="max-w-xl text-[15px] leading-relaxed text-slate-300">
          Removing buoyancy exposes combustion physics that gravity hides on Earth. The same experiments that protect crews in orbit
          sharpen how we detect, prevent and fight fires at home.
        </p>
        <div className="flex gap-8">
          <div><div className="font-display text-[30px] font-semibold text-ink">{apps}</div><div className="label !text-[9.5px]">Earth applications</div></div>
          <div><div className="font-display text-[30px] font-semibold text-ink">{links}</div><div className="label !text-[9.5px]">Investigation links</div></div>
        </div>
      </div>
    </section>
  );
}

function AppRow({ s, i }: { s: Spinoff; i: number }) {
  const { dataset, openInvestigation } = useMission();
  const invs = s.related.map((id) => dataset?.investigations.find((x) => x.id === id)).filter(Boolean);
  const c = PILLAR_COLOR[s.pillar];
  const fromBrief = s.basis.startsWith("Challenge");
  return (
    <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
      className="panel grid gap-5 p-5 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)_32px_minmax(0,1fr)] lg:items-center">
      <div className="flex items-center gap-4">
        <Art kind={kindOf(s.title)} />
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: c }}>{s.pillar}</div>
          <h3 className="mt-0.5 font-display text-[18px] font-semibold leading-snug text-ink">{s.title}</h3>
          <span className={`mt-2 inline-block whitespace-nowrap rounded-[5px] border px-1.5 py-0.5 font-mono text-[10px] ${fromBrief ? "border-emerald-400/35 text-emerald-200" : "border-amber-300/35 text-amber-200"}`}>
            {fromBrief ? "Source: challenge brief" : "Inference from objectives"}
          </span>
        </div>
      </div>
      <div className="rounded-[12px] border border-[var(--line)] bg-space-950/40 p-4">
        <div className="label mb-2 !text-[9.5px]">In orbit</div>
        {invs.length ? (
          <ul className="space-y-2">
            {invs.slice(0, 3).map((inv) => (
              <li key={inv!.id} className="text-[12.5px] leading-snug">
                <button onClick={() => openInvestigation(inv!.id)} className="font-mono text-[11.5px] text-[#9BE6FF] hover:underline">{inv!.id}</button>
                <span className="text-slate-400"> · {inv!.objective.length > 110 ? inv!.objective.slice(0, 108) + "…" : inv!.objective}</span>
              </li>
            ))}
            {invs.length > 3 && <li className="text-[11.5px] text-slate-500">+ {invs.slice(3).map((x) => x!.id).join(", ")}</li>}
          </ul>
        ) : <p className="text-[12.5px] text-slate-500">NASA technology broadly. No single PSI investigation is linked.</p>}
      </div>
      <div className="hidden justify-center lg:flex"><ArrowRight className="h-5 w-5 text-ox-2" /></div>
      <div className="rounded-[12px] border p-4" style={{ borderColor: `${c}40`, background: `${c}0d` }}>
        <div className="label mb-2 !text-[9.5px]" style={{ color: c }}>On Earth</div>
        <p className="text-[13.5px] leading-relaxed text-slate-200">{s.text}</p>
      </div>
    </motion.article>
  );
}

export function EarthPanel() {
  const { dataset } = useMission();
  const spin = dataset?.spinoffs ?? [];
  const links = new Set(spin.flatMap((s) => s.related)).size;
  return (
    <div>
      <PageHeader index="06" kicker="Down to Earth" title="From orbit to everyday fire safety">
        How space combustion research connects to suppression, detection, protective equipment and fire safety in confined spaces.
        Each link says whether it comes from the challenge brief or is inferred from investigation objectives.
      </PageHeader>
      <EarthHero apps={spin.length} links={links} />
      <div className="space-y-4">{spin.map((s, i) => <AppRow key={s.title} s={s} i={i} />)}</div>
    </div>
  );
}
