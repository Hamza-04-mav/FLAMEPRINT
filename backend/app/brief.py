"""Mission Fire-Safety Brief and 'Ask the archive'.

build_context() produces a compact, factual packet (scenario, physics estimates, ranking,
coverage gaps, investigation facts). BOTH writers use only this packet:
  * local_brief()  - deterministic writer, works offline / without an API key
  * the LLM writer - Claude, constrained to cite ids present in the packet (see llm.py)
"""
from __future__ import annotations

import re

from .engine import coverage, envelope_for, grade, rank
from .habitats import habitat
from .models import Dataset, Scenario, Weights
from .physics import readout

PILLARS = ("prevention", "detection", "suppression")


def build_context(ds: Dataset, sc: Scenario, w: Weights, top_n: int = 8) -> dict:
    ranked = rank(ds, sc, w)
    r = readout(sc)
    cov = coverage(ds, sc)
    hab = habitat(sc.habitatId)
    g = grade(ds, sc)
    from .materials import assess_all  # local import: materials imports engine
    mats = [{"name": v.name, "level": v.level, "grade": v.grade.letter, "label": v.label}
            for v in assess_all(ds, sc)]
    invs = []
    for x in ranked[:top_n]:
        inv = ds.inv(x.id)
        env = envelope_for(inv, ds.tests)
        invs.append({
            "id": inv.id, "name": inv.name, "relevance": round(x.score), "status": inv.status,
            "hardware": " / ".join(v for v in [inv.facility, inv.apparatus] if v),
            "fuels": inv.fuels, "fuelPhase": inv.fuelPhase, "objective": inv.objective,
            "envelope": {"o2Pct": env.o2Pct, "pressureKpa": env.pressureKpa, "flowCmS": env.flowCmS,
                         "confidence": env.confidence},
            "importedTests": x.totalTests, "testsNearScenario": x.nearbyTests,
            "insights": inv.insights, "earthApplications": inv.earthApplications,
        })
    return {
        "scenario": {"habitat": hab["name"] if hab else "Custom", "o2Pct": sc.o2Pct, "pressureKpa": sc.pressureKpa,
                     "pressurePsi": r["pressurePsi"], "gravityG": sc.gravityG, "ventilationCmS": sc.flowCmS,
                     "fuelPhases": sc.phases, "pillarFocus": sc.pillarFocus.model_dump()},
        "physicsEstimates": {"o2PartialPressureKpa": r["ppO2Kpa"], "o2IncreaseVsEarthPct": r["o2IncreasePct"],
                             "buoyantFlowCmS": r["buoyantFlowCmS"], "effectiveFlowCmS": r["effectiveFlowCmS"],
                             "flowRegime": r["regime"]["label"]},
        "evidenceGrade": {"letter": g.letter, "reason": g.reason},
        "materials": mats,
        "coverage": {"index": cov["index"], "gaps": cov["gaps"], "highestO2AnyFuel": cov["maxO2Tested"],
                     "highestO2AnyFuelBy": cov["maxO2TestedBy"], "highestO2Solids": cov["solidO2Max"]},
        "investigations": invs,
        "dataNote": (f"{len(ds.tests)} imported PSI test records are loaded." if ds.tests else
                     "No PSI test-level data has been imported yet. Only the investigation-level seed catalog is "
                     "loaded, and its tested ranges are approximate."),
    }


def allowed_ids(ctx: dict) -> set[str]:
    return {i["id"] for i in ctx["investigations"]}


CITE_RE = re.compile(r"\[([A-Za-z0-9][A-Za-z0-9 .:_/\-]{0,60}?)\]")


def check_citations(text: str, allowed: set[str]) -> dict:
    found = []
    for m in CITE_RE.finditer(text):
        for part in re.split(r"[,;]\s*", m.group(1)):
            part = part.strip()
            if part and part not in found:
                found.append(part)
    valid = [c for c in found if c in allowed or c.startswith("doc:")]
    return {"valid": valid, "invalid": [c for c in found if c not in valid]}


def local_brief(ctx: dict) -> str:
    s, p, c, invs = ctx["scenario"], ctx["physicsEstimates"], ctx["coverage"], ctx["investigations"]
    ids = {i["id"] for i in invs}
    out: list[str] = []
    out.append("## Mission atmosphere")
    g = "microgravity" if s["gravityG"] == 0 else f"{s['gravityG']:g} g"
    out.append(f"- **{s['habitat']}: {s['o2Pct']:g}% O₂ at {s['pressurePsi']:g} psi ({s['pressureKpa']:g} kPa), {g}.** "
               f"O₂ partial pressure ≈ {p['o2PartialPressureKpa']:g} kPa.")
    if p["o2IncreaseVsEarthPct"] > 5:
        out.append(f"- The O₂ concentration is **{p['o2IncreaseVsEarthPct']:.0f}% higher than Earth air**. Flammability "
                   f"rises strongly with O₂ concentration, so materials that pass in air may not pass here.")
    out.append(f"- A flame here would feel about **{p['effectiveFlowCmS']:g} cm/s** of flow (ventilation {s['ventilationCmS']:g} cm/s, "
               f"buoyancy about {p['buoyantFlowCmS']:g} cm/s). Regime: **{p['flowRegime']}**. *(Order-of-magnitude estimate.)*")
    verdict = ("Mostly outside the tested ranges, so treat conclusions as extrapolation." if c["index"] < 40 else
               "Partly covered, with the gaps listed below." if c["index"] < 70 else "Well bracketed by PSI investigations.")
    eg = ctx.get("evidenceGrade")
    if eg:
        out.append(f"- Evidence grade: **{eg['letter']}**. {eg['reason']}. {verdict}")
    else:
        out.append(f"- Evidence coverage index: **{c['index']}/100**. {verdict}")
    rated = [m for m in ctx.get("materials", []) if m["level"] != "unknown"]
    if rated:
        hi = [m["name"] for m in rated if m["level"] == "high"]
        out.append(f"- Materials: **{len(hi)} of {len(ctx['materials'])} high risk**"
                   + (f" ({', '.join(hi[:4])})" if hi else "") + ". *(Illustrative model.)*")

    for pl in PILLARS:
        out.append(f"\n## {pl.capitalize()}")
        rel = [i for i in invs if i["insights"].get(pl)][:4]
        if pl == "prevention" and len(rel) < 2:
            rel += [i for i in invs if i["insights"].get("modeling") and i not in rel][: 2 - len(rel)]
        if not rel:
            out.append("- Insufficient evidence among the top-ranked investigations for this pillar.")
        for i in rel:
            txt = i["insights"].get(pl) or i["insights"].get("modeling")
            env = i["envelope"]
            if env["o2Pct"]:
                lo, hi = env["o2Pct"]
                fit = "tested at your O₂" if lo - 1 <= s["o2Pct"] <= hi + 1 else f"tested at {lo:g}–{hi:g}% O₂"
            else:
                fit = "O₂ range not characterized"
            approx = ", approximate tested range" if env["confidence"] == "approx" else ""
            out.append(f"- {txt} [{i['id']}] *(relevance {i['relevance']}, {fit}{approx})*")
        if pl == "prevention" and "solid" in s["fuelPhases"] and s["o2Pct"] > c["highestO2Solids"] + 1:
            out.append(f"- ⚠ **Insufficient evidence: no microgravity solid-material data at {s['o2Pct']:g}% O₂** "
                       f"(loaded maximum: {c['highestO2Solids']:g}%). Screen materials at the worst-case atmosphere in "
                       f"normal gravity and plan targeted tests.")
        if pl == "detection":
            extra = []
            if "FLEX" in ids or "CFI" in ids:
                extra.append(f"Burning can continue with no visible flame (cool flames) [{('FLEX' if 'FLEX' in ids else 'CFI')}], so pair optical sensors with gas and particle sensing.")
            dust = next((x for x in ("DAFT", "DAFT-2") if x in ids), None)
            if dust:
                extra.append(f"Set alarm thresholds against background cabin dust [{dust}].")
            for e in extra:
                out.append(f"- {e}")

    out.append("\n## Evidence gaps")
    if not c["gaps"]:
        out.append("- No major gaps detected for this scenario.")
    for gp in c["gaps"]:
        out.append(f"- **{gp['severity'].upper()}: {gp['title']}.** {gp['detail']}")

    out.append("\n## Recommended next steps")
    if 0 < s["gravityG"] < 1:
        proxy = " and compare with the electric-field proxy [ACME-EFIELD]" if "ACME-EFIELD" in ids else ""
        out.append(f"- Bracket {s['gravityG']:g} g behaviour between microgravity results (one bound) and 1 g results (the other){proxy}.")
    lo, hi = max(1, round(p["effectiveFlowCmS"] / 2)), max(2, round(p["effectiveFlowCmS"] * 2))
    out.append(f"- Run flammability tests on the actual cabin materials at {s['o2Pct']:g}% O₂ / {s['pressurePsi']:g} psi "
               f"across {lo}–{hi} cm/s flows.")
    if not any(i["importedTests"] for i in invs):
        out.append("- Import PSI test matrices in the Data Lab to replace the approximate tested ranges with measured test points.")

    earth = [(e, i["id"]) for i in invs for e in i["earthApplications"]][:4]
    if earth:
        out.append("\n## Down to Earth")
        for e, iid in earth:
            out.append(f"- {e} [{iid}]")
    out.append(f"\n*{ctx['dataNote']} Written by the deterministic offline engine.*")
    return "\n".join(out)


def local_answer(question: str, hits: list[dict]) -> str:
    """Extractive answer: the most relevant sentences from retrieved chunks, each cited."""
    from .embed import tokens
    q = set(tokens(question))
    if not hits:
        return "Insufficient evidence: nothing in the loaded catalog or documents matches this question."
    lines = ["**Most relevant evidence in the archive** *(extractive answer, offline mode)*", ""]
    used = 0
    for h in hits[:6]:
        sents = re.split(r"(?<=[.!?])\s+", h["text"])
        best = max(sents, key=lambda s_: len(q & set(tokens(s_))))
        if not q & set(tokens(best)):
            continue
        cite = h["investigationId"] if h["kind"] == "card" else f"doc:{h['source']}"
        lines.append(f"- {best.strip()} [{cite}]")
        used += 1
    if not used:
        return "Insufficient evidence: the retrieved passages don't directly address this question."
    lines.append("\n*Add an Anthropic API key for synthesized answers.*")
    return "\n".join(lines)


SYSTEM_BRIEF = """You are FLAMEPRINT, a fire-safety analyst for human space exploration. You write mission fire-safety briefs from NASA Physical Sciences Informatics (PSI) microgravity combustion investigations.

Rules:
- Use ONLY the facts in the JSON context. Never invent experiments, numbers, test results, dates or sources.
- Cite every evidence-based claim with the investigation id in square brackets, e.g. [BASS-II]. Use only ids present in the context.
- If the context does not support a conclusion, write "Insufficient evidence" and say what data would close the gap.
- Envelopes with confidence "approx" are approximate. Say so when a conclusion depends on one.
- Partial gravity: PSI has only microgravity data. Present partial-g behaviour as bracketed between μg and 1 g results, never as measured.
- physicsEstimates are order-of-magnitude estimates. Label them as estimates.
- Audience: aerospace engineers and researchers. Be specific and concise.

Format (Markdown): sections "## Mission atmosphere", "## Prevention", "## Detection", "## Suppression", "## Evidence gaps", "## Recommended next steps", "## Down to Earth". Use bullets. Keep the brief under 450 words."""

SYSTEM_ASK = """You are FLAMEPRINT's research assistant for NASA PSI microgravity combustion investigations.
Answer using ONLY the numbered passages provided. Cite each claim with the passage's citation tag exactly as given, e.g. [FLEX] or [doc:psi/flex_report.pdf].
If the passages don't answer the question, say "Insufficient evidence" and name the data that would help. Never invent numbers or results.
Be concise (under 220 words), using Markdown bullets where helpful."""
