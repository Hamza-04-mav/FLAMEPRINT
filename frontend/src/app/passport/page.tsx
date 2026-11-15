"use client";

import { useEffect, useState } from "react";
import { buildVerdict, fmtPressure, GRADE_STYLE, LEVEL_STYLE } from "@/lib/answer";
import { api, ApiError } from "@/lib/api";
import { fmtGravity } from "@/lib/format";
import { DEFAULT_WEIGHTS, FALLBACK_SCENARIO } from "@/lib/mission";
import type { Analysis, FuelPhase, Habitat, Scenario } from "@/lib/types";

/** Scenario from the URL: ?mission=lunar-base, or custom ?o2=30&kpa=70.3&g=0.165&flow=10&phases=solid,gas */
function scenarioFrom(q: URLSearchParams, habitats: Habitat[]): { sc: Scenario; name: string } {
  const h = habitats.find((x) => x.id === q.get("mission"));
  if (h) return { sc: { habitatId: h.id, o2Pct: h.o2Pct, pressureKpa: h.pressureKpa, flowCmS: h.flowCmS, gravityG: h.gravityG, phases: h.phases, pillarFocus: h.pillarFocus }, name: h.name };
  const num = (k: string, d: number) => { const v = parseFloat(q.get(k) ?? ""); return Number.isFinite(v) ? v : d; };
  const phases = (q.get("phases")?.split(",").filter((p): p is FuelPhase => ["solid", "liquid", "gas"].includes(p)) ?? []);
  return {
    sc: { ...FALLBACK_SCENARIO, habitatId: "custom", o2Pct: num("o2", FALLBACK_SCENARIO.o2Pct), pressureKpa: num("kpa", FALLBACK_SCENARIO.pressureKpa),
      gravityG: num("g", FALLBACK_SCENARIO.gravityG), flowCmS: num("flow", FALLBACK_SCENARIO.flowCmS), phases: phases.length ? phases : FALLBACK_SCENARIO.phases },
    name: "Custom mission",
  };
}

function Grade({ letter }: { letter: keyof typeof GRADE_STYLE }) {
  const c = { A: "#047857", B: "#0369a1", C: "#b45309", M: "#475569" }[letter];
  return <span className="inline-grid h-6 w-6 place-items-center rounded border font-bold" style={{ color: c, borderColor: c }}>{letter}</span>;
}

export default function PassportPage() {
  const [state, setState] = useState<{ a: Analysis; sc: Scenario; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const habitats = await api.habitats();
        const { sc, name } = scenarioFrom(new URLSearchParams(window.location.search), habitats);
        setState({ a: await api.analyze(sc, DEFAULT_WEIGHTS), sc, name });
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : String(e));
      }
    })();
  }, []);

  useEffect(() => { if (state) document.title = `Fire Passport · ${state.name}`; }, [state]);

  if (err) return <main className="passport grid min-h-screen place-items-center p-8"><p>Could not build the passport: {err}</p></main>;
  if (!state) return <main className="passport grid min-h-screen place-items-center p-8"><p>Building Fire Passport…</p></main>;

  const { a, sc, name } = state;
  const v = buildVerdict(a.materials, a.coverage.grade, name);
  const p = fmtPressure(sc.pressureKpa);
  const today = new Date().toISOString().slice(0, 10);
  const gaps = a.coverage.gaps.filter((g) => g.severity !== "info").slice(0, 3);

  return (
    <main className="passport min-h-screen">
      <div className="mx-auto max-w-[800px] px-8 py-8 print:p-0">
        <div className="no-print mb-6 flex justify-end gap-2">
          <button onClick={() => window.print()} className="rounded bg-[#087BFF] px-4 py-2 text-sm font-medium text-white">Print / Save as PDF</button>
        </div>

        <header className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">FLAMEPRINT · Fire Passport</div>
            <h1 className="mt-1 text-[26px] font-bold leading-tight">{name}</h1>
            <div className="mt-1 font-mono text-[12px] text-slate-700">
              {sc.o2Pct}% O₂ · {p.psi} ({p.kpa}) · {fmtGravity(sc.gravityG)} g · {sc.flowCmS} cm/s ventilation · fuels: {sc.phases.join(", ")}
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-600">
            <div>{today}</div>
            <div>Data: {a.dataMode === "psi" ? "PSI data imported" : "seed catalog"}</div>
          </div>
        </header>

        <section className="mt-4 flex items-start gap-4 rounded border border-slate-300 p-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border-2 text-[24px] font-bold"
            style={{ borderColor: GRADE_STYLE[a.coverage.grade.letter].color, color: "#0f172a" }}>{a.coverage.grade.letter}</span>
          <div>
            <p className="text-[16px] font-semibold leading-snug">{v.headline}</p>
            <p className="mt-0.5 text-[12.5px] text-slate-700">{v.confidence}</p>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="pp-h">Materials <span className="font-normal text-slate-500">(illustrative model)</span></h2>
          <table className="pp-table">
            <thead><tr><th>Material</th><th>Risk</th><th>Grade</th><th>Why</th></tr></thead>
            <tbody>
              {a.materials.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td style={{ color: m.level === "elevated" ? "#b45309" : m.level === "low" ? "#047857" : m.level === "high" ? "#b91c1c" : "#475569" }} className="font-semibold">{LEVEL_STYLE[m.level].label}</td>
                  <td><Grade letter={m.grade.letter} /></td>
                  <td className="text-slate-700">{m.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-5">
          <section>
            <h2 className="pp-h">Top evidence gaps</h2>
            <ol className="list-decimal space-y-1 pl-5 text-[12px]">{gaps.map((g) => <li key={g.title}><b className="uppercase text-[10px] tracking-wider text-slate-500">{g.severity}</b> {g.title}</li>)}</ol>
          </section>
          <section>
            <h2 className="pp-h">Missing test conditions</h2>
            <ol className="list-decimal space-y-1 pl-5 text-[12px]">
              {a.nextExperiments.slice(0, 3).map((x) => <li key={x.id}>{x.title}{x.plannedBy.length ? <span className="text-slate-600"> (planned investigation: {x.plannedBy.join(", ")})</span> : null}</li>)}
              {a.nextExperiments.length === 0 && <li className="list-none text-slate-500">None for this habitat in the loaded data.</li>}
            </ol>
          </section>
        </div>

        <section className="mt-4">
          <h2 className="pp-h">Most relevant PSI investigations <span className="font-normal text-slate-500">(catalog ranges, approx)</span></h2>
          <table className="pp-table">
            <thead><tr><th>#</th><th>PSI id</th><th>Investigation</th><th>Relevance</th><th>Grade</th></tr></thead>
            <tbody>
              {a.ranked.slice(0, 5).map((r, i) => (
                <tr key={r.id}><td>{i + 1}</td><td className="font-mono">{r.id}</td><td>{r.name}</td><td>{Math.round(r.score)}</td><td>{r.grade && <Grade letter={r.grade.letter} />}</td></tr>
              ))}
            </tbody>
          </table>
        </section>


        <footer className="mt-5 border-t border-slate-300 pt-2 text-[10.5px] leading-snug text-slate-600">
          Independent project, not NASA-endorsed. Values marked illustrative or modeled must be verified against PSI.
          Grades: A = imported PSI tests at these conditions · B = one investigation tested this atmosphere · C = bracketed only · M = modeled.
        </footer>
      </div>
    </main>
  );
}
