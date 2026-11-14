"use client";

import { ChevronRight, FileText, LayoutGrid, Sliders } from "lucide-react";
import { environmentFor } from "@/lib/environment";
import { plural } from "@/lib/format";
import { useMission } from "@/lib/mission";
import { DUST, SUN } from "@/lib/theme";
import { GradeBadge } from "./GradeBadge";
import { PlanetGlyph } from "./Header";

/**
 * The whole story in one glance (Norman: visibility / conceptual model):
 * your Habitat ‣ the Evidence that backs the verdict ‣ where the data has Gaps ‣
 * the Brief of what to do. Each node shows a tiny live visual and is a real link.
 */
export function AnswerPipeline() {
  const { analysis, scenario, habitats, setTab, setConfigOpen } = useMission();
  const hab = habitats.find((h) => h.id === scenario.habitatId);
  const env = environmentFor(scenario.habitatId, scenario.gravityG);
  const mats = analysis?.materials ?? [];
  const high = mats.filter((m) => m.level === "high").length;
  const dot = high > 0 ? SUN[500] : mats.some((m) => m.level === "elevated") ? SUN.a65 : DUST[400];
  const grade = analysis?.coverage.grade;
  const gaps = analysis?.coverage.gaps.length ?? 0;
  const ranked = analysis?.ranked.length ?? 0;

  const nodes = [
    {
      key: "habitat", label: "Habitat", onClick: () => setConfigOpen(true),
      visual: (
        <span className="relative">
          <PlanetGlyph env={env} size={26} />
          <span className="led absolute -right-0.5 -top-0.5" style={{ color: dot }} />
        </span>
      ),
      value: hab?.name ?? "Custom mission",
    },
    {
      key: "evidence", label: "Evidence", onClick: () => setTab("ranking"),
      visual: grade ? <GradeBadge grade={grade} size="sm" inert /> : <LayoutGrid className="h-[18px] w-[18px] text-dust-400" />,
      value: plural(ranked, "investigation"),
    },
    {
      key: "gaps", label: "Gaps", onClick: () => setTab("space"),
      visual: <LayoutGrid className="h-[18px] w-[18px]" style={{ color: gaps > 0 ? SUN[500] : DUST[400] }} />,
      value: analysis ? plural(gaps, "data gap") : "—",
    },
    {
      key: "brief", label: "Brief", onClick: () => setTab("brief"),
      visual: <FileText className="h-[18px] w-[18px] text-dust-400" />,
      value: "Prevention · detection · suppression",
    },
  ];

  return (
    <nav aria-label="Answer pipeline" className="flex items-stretch gap-1.5 overflow-x-auto no-scrollbar">
      {nodes.map((n, i) => (
        <div key={n.key} className="flex items-center gap-1.5">
          <button onClick={n.onClick}
            className="group flex min-w-0 items-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-ink-800/40 px-3 py-2 text-left transition duration-150 hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-ink-800/70">
            <span className="shrink-0">{n.visual}</span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[11px] text-dust-400">{n.label}</span>
              <span className="block truncate text-[13px] font-medium text-dust-100 group-hover:text-white" title={n.value}>{n.value}</span>
            </span>
            {i === 0 && <Sliders className="ml-1 h-3.5 w-3.5 shrink-0 text-dust-500 group-hover:text-dust-300" />}
          </button>
          {i < nodes.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-dust-500" aria-hidden />}
        </div>
      ))}
    </nav>
  );
}
