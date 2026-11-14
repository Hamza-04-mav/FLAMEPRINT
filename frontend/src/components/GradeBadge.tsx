"use client";

import { GRADE_STYLE } from "@/lib/answer";
import { useMission } from "@/lib/mission";
import type { Grade } from "@/lib/types";

/** One letter that answers "how sure are we?". Click opens the dossier of the first investigation it rests on. */
export function GradeBadge({ grade, size = "md", showReason = false }: { grade?: Grade | null; size?: "sm" | "md" | "lg"; showReason?: boolean }) {
  const { openInvestigation } = useMission();
  if (!grade) return null;
  const st = GRADE_STYLE[grade.letter];
  const dim = size === "lg" ? "h-12 w-12 text-[24px] rounded-[12px]" : size === "sm" ? "h-6 w-6 text-[12px] rounded-[6px]" : "h-8 w-8 text-[15px] rounded-[8px]";
  const target = grade.basis[0];
  const title = `Evidence grade ${grade.letter}: ${grade.reason}.${target ? ` Click to open ${target}.` : ""}`;
  const badge = (
    <span className={`grid shrink-0 place-items-center border font-display font-bold leading-none ${dim}`}
      style={{ color: st.color, borderColor: `${st.color}66`, background: `${st.color}14` }}>{grade.letter}</span>
  );
  const body = showReason ? (
    <span className="flex min-w-0 items-center gap-2.5 text-left">
      {badge}
      <span className="min-w-0 leading-tight">
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em]" style={{ color: st.color }}>Confidence {grade.letter}</span>
        <span className="block text-[12.5px] text-slate-300">{grade.reason}</span>
      </span>
    </span>
  ) : badge;
  if (!target) return <span title={title} aria-label={title} className="inline-flex">{body}</span>;
  return (
    <button type="button" title={title} aria-label={title}
      onClick={(e) => { e.stopPropagation(); openInvestigation(target); }}
      className="inline-flex rounded-[10px] transition-transform hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-ox">
      {body}
    </button>
  );
}
