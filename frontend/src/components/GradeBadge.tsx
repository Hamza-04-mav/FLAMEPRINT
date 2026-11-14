"use client";

import { GRADE_STYLE } from "@/lib/answer";
import { useMission } from "@/lib/mission";
import type { Grade } from "@/lib/types";

const DIM = {
  sm: { box: "h-7 w-7 text-[13px]", tilt: "-rotate-3" },
  md: { box: "h-9 w-9 text-[17px]", tilt: "-rotate-3" },
  lg: { box: "h-[58px] w-[58px] text-[28px]", tilt: "-rotate-6" },
};

/** The letter, styled as a small passport stamp: double ring, slight tilt, fixed colour per grade. */
export function Stamp({ letter, size = "md" }: { letter: Grade["letter"]; size?: keyof typeof DIM }) {
  const c = GRADE_STYLE[letter].color;
  const d = DIM[size];
  return (
    <span aria-hidden className={`relative grid shrink-0 place-items-center rounded-[10px] font-display font-semibold leading-none ${d.box} ${d.tilt}`}
      style={{ color: c, border: `1.5px solid ${c}`, boxShadow: `inset 0 0 0 2px var(--color-space-950), inset 0 0 0 3px ${c}66`, background: `${c}0f` }}>
      {letter}
      {size === "lg" && (
        <span className="absolute -bottom-[7px] rounded-[3px] bg-space-950 px-1 font-mono text-[7.5px] font-normal tracking-[0.18em]" style={{ color: c }}>GRADE</span>
      )}
    </span>
  );
}

/** One letter that answers "how sure are we?". Click opens the dossier of the first investigation it rests on.
 *  `inert` renders a plain span (use it inside another button, e.g. a ranking row, to keep the HTML valid). */
export function GradeBadge({ grade, size = "md", showReason = false, inert = false }: {
  grade?: Grade | null; size?: "sm" | "md" | "lg"; showReason?: boolean; inert?: boolean;
}) {
  const { openInvestigation } = useMission();
  if (!grade) return null;
  const st = GRADE_STYLE[grade.letter];
  const target = inert ? undefined : grade.basis[0];
  const title = `Evidence grade ${grade.letter} (${st.meaning}): ${grade.reason}.${target ? ` Click to open ${target}.` : ""}`;
  const body = showReason ? (
    <span className="flex min-w-0 items-center gap-3.5 text-left">
      <Stamp letter={grade.letter} size={size} />
      <span className="min-w-0 leading-snug">
        <span className="block font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: st.color }}>Confidence {grade.letter}</span>
        <span className="block text-[13px] text-slate-300">{grade.reason}</span>
      </span>
    </span>
  ) : <Stamp letter={grade.letter} size={size} />;
  if (!target) return <span title={title} aria-label={title} className="inline-flex">{body}</span>;
  return (
    <button type="button" title={title} aria-label={title}
      onClick={(e) => { e.stopPropagation(); openInvestigation(target); }}
      className="inline-flex rounded-[10px] transition-transform duration-200 hover:scale-[1.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ox">
      {body}
    </button>
  );
}
