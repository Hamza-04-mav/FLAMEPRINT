"""FLAMEPRINT deterministic engine: envelopes, explainable ranking, coverage & gaps,
condition space, investigation genome and comparisons.

The numbers come from this module, never from an LLM. The SI layer only explains them.
"""
from __future__ import annotations

import math
from collections import Counter
from typing import Optional

from .models import (
    ConditionEnvelope, Dataset, FactorScore, Gap, Grade, Investigation, Material, RankedInvestigation,
    Scenario, TestRecord, Weights,
)
from .physics import effective_flow_cms

FACTOR_LABELS = {
    "o2": "O₂ match", "pressure": "Pressure match", "flow": "Flow match",
    "material": "Fuel / material", "pillar": "Safety focus", "gravity": "Gravity regime",
}
# Characteristic distances: how far outside a tested range before relevance decays strongly.
SCALE = {"o2": 8.0, "pressure": 30.0, "flow": 12.0}
UNKNOWN_CREDIT = 0.3      # partial credit when a condition is not characterized
APPROX_PENALTY = 0.92     # unverified envelopes count slightly less than data-derived ones
PENDING_PENALTY = 0.6     # investigations not yet in PSI


def _extent(vals: list[float]) -> Optional[tuple[float, float]]:
    vals = [v for v in vals if v is not None and math.isfinite(v)]
    return (min(vals), max(vals)) if vals else None


def tests_for(ds: Dataset, inv_id: str) -> list[TestRecord]:
    return [t for t in ds.tests if t.investigationId == inv_id]


def envelope_for(inv: Investigation, tests: list[TestRecord]) -> ConditionEnvelope:
    """If imported test records exist, the envelope is derived from them (confidence 'data')."""
    own = [t for t in tests if t.investigationId == inv.id]
    if not own:
        return inv.conditions
    o2 = _extent([t.o2Pct for t in own])
    p = _extent([t.pressureKpa for t in own])
    f = _extent([t.flowCmS for t in own])
    return ConditionEnvelope(
        o2Pct=o2 or inv.conditions.o2Pct,
        pressureKpa=p or inv.conditions.pressureKpa,
        flowCmS=f or inv.conditions.flowCmS,
        confidence="data" if (o2 or p or f) else inv.conditions.confidence,
        note=f"Derived from {len(own)} imported test record(s)."
        + ("" if (o2 and p and f) else " Missing axes fall back to the seed catalog."),
    )


def _axis(value: float, rng, scale: float, conf: str) -> dict:
    if rng is None:
        return {"s": UNKNOWN_CREDIT, "d": None, "inside": False, "known": False}
    lo, hi = rng
    d = lo - value if value < lo else (value - hi if value > hi else 0.0)
    s = math.exp(-((d / scale) ** 2))
    if conf == "approx":
        s *= APPROX_PENALTY
    return {"s": s, "d": d, "inside": d == 0, "known": True}


def _fmt(rng, unit: str) -> str:
    if rng is None:
        return "not characterized"
    lo, hi = rng
    fmt = lambda v: f"{v:g}"
    return f"{fmt(lo)}{unit}" if lo == hi else f"{fmt(lo)}–{fmt(hi)}{unit}"


def rank(ds: Dataset, sc: Scenario, w: Weights) -> list[RankedInvestigation]:
    u_eff = effective_flow_cms(sc.flowCmS, sc.gravityG)
    focus = sc.pillarFocus.model_dump()
    focus_total = sum(focus.values()) or 1.0
    weights = w.model_dump()
    out: list[RankedInvestigation] = []

    for inv in ds.investigations:
        env = envelope_for(inv, ds.tests)
        conf = env.confidence
        o2 = _axis(sc.o2Pct, env.o2Pct, SCALE["o2"], conf)
        pr = _axis(sc.pressureKpa, env.pressureKpa, SCALE["pressure"], conf)
        fl = _axis(u_eff, env.flowCmS, SCALE["flow"], conf)

        phase_hit = any(p in sc.phases for p in inv.fuelPhase)
        material = 0.15 if not inv.fuelPhase else (1.0 if phase_hit else 0.35)
        pil = inv.pillars.model_dump()
        pillar = sum(focus[k] * pil[k] for k in focus) / focus_total

        is_proxy = "partial-gravity-proxy" in inv.tags
        is_partial = "partial-gravity" in inv.tags
        partial_g = 0 < sc.gravityG < 1
        if is_partial:
            gravity = 1.0 if partial_g else 0.5
        elif sc.gravityG == 0:
            gravity = 1.0
        elif sc.gravityG >= 1:
            gravity = 0.4
        else:
            gravity = 1.0 if is_proxy else 0.7

        def why_axis(a, name, val, rng, unit):
            if not a["known"]:
                return f"{name} not characterized; partial credit"
            if a["inside"]:
                return f"{val:g}{unit} lies inside the tested {_fmt(rng, unit)}"
            return f"{abs(a['d']):.1f}{unit} outside the tested {_fmt(rng, unit)}"

        if is_proxy and partial_g:
            gwhy = "Electric-field body force mimics partial gravity"
        elif is_partial:
            gwhy = "Partial-gravity investigation (expected)" if partial_g else "Partial-gravity data is less relevant here"
        elif sc.gravityG == 0:
            gwhy = "Microgravity data matches a 0 g scenario"
        elif sc.gravityG >= 1:
            gwhy = "Microgravity data adds little in 1 g"
        else:
            gwhy = "Microgravity data bounds partial gravity from below"

        factors = [
            FactorScore(key="o2", label=FACTOR_LABELS["o2"], score=o2["s"], weight=weights["o2"],
                        confidence=conf if o2["known"] else "unknown",
                        why=why_axis(o2, "O₂ range", sc.o2Pct, env.o2Pct, "%")),
            FactorScore(key="pressure", label=FACTOR_LABELS["pressure"], score=pr["s"], weight=weights["pressure"],
                        confidence=conf if pr["known"] else "unknown",
                        why=why_axis(pr, "Pressure", sc.pressureKpa, env.pressureKpa, " kPa")),
            FactorScore(key="flow", label=FACTOR_LABELS["flow"], score=fl["s"], weight=weights["flow"],
                        confidence=conf if fl["known"] else "unknown",
                        why=why_axis(fl, "Flow", round(u_eff, 1), env.flowCmS, " cm/s")),
            FactorScore(key="material", label=FACTOR_LABELS["material"], score=material, weight=weights["material"],
                        confidence="approx",
                        why=("No combustion (aerosol instrument study)" if not inv.fuelPhase
                             else f"Studies {'/'.join(inv.fuelPhase)} fuels you selected" if phase_hit
                             else f"Studies {'/'.join(inv.fuelPhase)} fuels; physics transfers only partly")),
            FactorScore(key="pillar", label=FACTOR_LABELS["pillar"], score=pillar, weight=weights["pillar"],
                        confidence="approx",
                        why=f"Prevention {pil['prevention']:.0%} · Detection {pil['detection']:.0%} · Suppression {pil['suppression']:.0%}"),
            FactorScore(key="gravity", label=FACTOR_LABELS["gravity"], score=gravity, weight=weights["gravity"],
                        confidence="approx", why=gwhy),
        ]
        wsum = sum(f.weight for f in factors) or 1.0
        score = sum(f.weight * f.score for f in factors) / wsum * 100.0
        if inv.status == "pending":
            score *= PENDING_PENALTY

        own = tests_for(ds, inv.id)
        nearby = [t for t in own
                  if (t.o2Pct is None or abs(t.o2Pct - sc.o2Pct) <= 5)
                  and (t.pressureKpa is None or abs(t.pressureKpa - sc.pressureKpa) <= 20)]
        out.append(RankedInvestigation(id=inv.id, name=inv.name, score=round(score, 2), factors=factors,
                                       nearbyTests=len(nearby), totalTests=len(own), envelope=env,
                                       grade=grade(ds, sc, investigation=inv)))
    out.sort(key=lambda r: -r.score)
    return out


def _within(v: float, rng, tol: float) -> bool:
    return rng is not None and rng[0] - tol <= v <= rng[1] + tol


def coverage(ds: Dataset, sc: Scenario) -> dict:
    """How well the loaded evidence brackets the scenario, plus explicit gaps."""
    u_eff = effective_flow_cms(sc.flowCmS, sc.gravityG)
    active = [i for i in ds.investigations if i.status != "pending"]
    envs = [(i, envelope_for(i, ds.tests)) for i in active]

    o2_hits = [i.id for i, e in envs if _within(sc.o2Pct, e.o2Pct, 1)]
    p_hits = [i.id for i, e in envs if _within(sc.pressureKpa, e.pressureKpa, 5)]
    f_hits = [i.id for i, e in envs if _within(u_eff, e.flowCmS, 2)]
    joint = [i for i, e in envs if _within(sc.o2Pct, e.o2Pct, 1) and _within(sc.pressureKpa, e.pressureKpa, 5)]
    phase_joint = [i.id for i in joint if any(p in sc.phases for p in i.fuelPhase)]

    max_o2 = max((e.o2Pct[1] for _, e in envs if e.o2Pct), default=0.0)
    max_o2_by = next((i.id for i, e in envs if e.o2Pct and e.o2Pct[1] == max_o2), None)
    min_p = min((e.pressureKpa[0] for _, e in envs if e.pressureKpa), default=None)
    solid_o2 = max((e.o2Pct[1] for i, e in envs if e.o2Pct and "solid" in i.fuelPhase), default=0.0)

    # Imported tests near the scenario (real data points)
    near_tests = [t for t in ds.tests
                  if t.o2Pct is not None and abs(t.o2Pct - sc.o2Pct) <= 3
                  and (t.pressureKpa is None or abs(t.pressureKpa - sc.pressureKpa) <= 15)]

    gaps: list[Gap] = []
    if 0 < sc.gravityG < 1:
        gaps.append(Gap(severity="critical", title=f"No {sc.gravityG:.2f} g combustion data in PSI",
                        detail="PSI holds microgravity data only, so the scenario has to be bracketed between μg and 1 g results. ACME E-FIELD Flames is the only partial-gravity proxy (an electric body force). LUCI and FM2 are expected to fill this gap."))
    if "solid" in sc.phases and sc.o2Pct > solid_o2 + 1:
        gaps.append(Gap(severity="critical", title=f"Solid materials untested above {solid_o2:g}% O₂ in microgravity",
                        detail=f"The scenario is {sc.o2Pct:g}% O₂, {sc.o2Pct - solid_o2:.0f} points above the highest O₂ at which solid fuels were tested in microgravity in the loaded data. Material acceptance has to rely on normal-gravity tests or new experiments."))
    if sc.o2Pct > max_o2 + 1:
        gaps.append(Gap(severity="critical", title=f"{sc.o2Pct:g}% O₂ is above every microgravity test",
                        detail=f"The highest O₂ in the loaded data is {max_o2:g}% ({max_o2_by})."))
    elif not o2_hits:
        gaps.append(Gap(severity="high", title="No investigation brackets this O₂ level",
                        detail="Values have to be interpolated between investigations."))
    if min_p is not None and sc.pressureKpa < min_p - 5:
        gaps.append(Gap(severity="high", title=f"{sc.pressureKpa / 6.89476:.1f} psi ({sc.pressureKpa:g} kPa) is below every tested pressure range",
                        detail=f"The lowest tested pressure is about {min_p / 6.89476:.1f} psi ({min_p:g} kPa). Reduced pressure changes flame heat losses and oxygen supply. Several investigations have uncharacterized pressure; import their test matrices to check."))
    if not phase_joint:
        gaps.append(Gap(severity="high", title="No joint O₂ + pressure match for your fuel types",
                        detail="No single investigation tested your fuel type at this O₂ and pressure together, so conclusions combine evidence from separate investigations."))
    if 0 < u_eff < 3 and sc.gravityG > 0:
        gaps.append(Gap(severity="medium", title="Near-quiescent partial-g flow",
                        detail="Buoyancy is weak but not zero here. Flames may behave like neither microgravity nor Earth."))
    unknown = [i.id for i in active if i.conditions.o2Pct is None and not tests_for(ds, i.id)]
    if unknown:
        gaps.append(Gap(severity="info", title=f"{len(unknown)} investigations lack characterized O₂ data",
                        detail="Import their PSI test matrices in the Data Lab to sharpen ranking and coverage: " + ", ".join(unknown)))

    gravity_cov = 1.0 if sc.gravityG == 0 else (0.6 if sc.gravityG >= 1 else 0.25)
    index = 100 * (0.2 * min(1, len(o2_hits) / 3) + 0.15 * min(1, len(p_hits) / 3)
                   + 0.15 * min(1, len(f_hits) / 3) + 0.3 * min(1, len(phase_joint) / 2) + 0.2 * gravity_cov)
    return {
        "index": round(index),
        "o2Hits": o2_hits, "pressureHits": p_hits, "flowHits": f_hits, "jointHits": phase_joint,
        "nearTests": len(near_tests),
        "gaps": [g.model_dump() for g in gaps],
        "maxO2Tested": max_o2, "maxO2TestedBy": max_o2_by, "solidO2Max": solid_o2,
        "minPressureTested": min_p,
    }


def condition_space(ds: Dataset) -> dict:
    """Everything needed to draw the 3D O₂ × pressure × flow coverage map."""
    envs = []
    for inv in ds.investigations:
        e = envelope_for(inv, ds.tests)
        envs.append({"id": inv.id, "name": inv.name, "fuelPhase": inv.fuelPhase, "status": inv.status,
                     "facility": inv.facility, "envelope": e.model_dump()})
    pts = [{"id": t.id, "investigationId": t.investigationId, "o2Pct": t.o2Pct, "pressureKpa": t.pressureKpa,
            "flowCmS": t.flowCmS, "outcome": t.outcome or "unknown", "fuel": t.fuel, "source": t.source}
           for t in ds.tests if t.o2Pct is not None]
    return {"envelopes": envs, "tests": pts, "totalTests": len(ds.tests), "plottedTests": len(pts)}


def genome(ds: Dataset) -> dict:
    """Hardware lineage: facility → apparatus → investigation, plus scientific relations."""
    nodes, edges, seen = [], [], set()

    def add(nid, label, kind, **kw):
        if nid not in seen:
            seen.add(nid)
            nodes.append({"id": nid, "label": label, "kind": kind, **kw})

    for inv in ds.investigations:
        fac = f"fac:{inv.facility}"
        add(fac, inv.facility, "facility")
        parent = fac
        if inv.apparatus:
            app = f"app:{inv.apparatus}"
            add(app, inv.apparatus, "apparatus")
            if not any(e["source"] == fac and e["target"] == app for e in edges):
                edges.append({"source": fac, "target": app, "type": "hosts"})
            parent = app
        add(inv.id, inv.id, "investigation", name=inv.name, fuelPhase=inv.fuelPhase, status=inv.status,
            pillars=inv.pillars.model_dump(), tests=len(tests_for(ds, inv.id)))
        edges.append({"source": parent, "target": inv.id, "type": "used-by"})
    for r in ds.relations:
        if r.from_ in seen and r.to in seen:
            edges.append({"source": r.from_, "target": r.to, "type": r.type, "note": r.note})
    return {"nodes": nodes, "edges": edges}


def _hardware_chain(inv: Investigation) -> list[str]:
    return [x for x in [inv.facility, inv.apparatus] if x]


def compare(ds: Dataset, a_id: str, b_id: str) -> dict:
    a, b = ds.inv(a_id), ds.inv(b_id)
    if not a or not b:
        raise KeyError(a_id if not a else b_id)
    ea, eb = envelope_for(a, ds.tests), envelope_for(b, ds.tests)

    def row(label, va, vb, same=None):
        return {"label": label, "a": va, "b": vb, "same": (va == vb) if same is None else same}

    shared_meas = sorted(set(a.measurements) & set(b.measurements))
    rows = [
        row("Facility", a.facility, b.facility),
        row("Apparatus", a.apparatus or "–", b.apparatus or "–"),
        row("Fuel phase", ", ".join(a.fuelPhase) or "none", ", ".join(b.fuelPhase) or "none"),
        row("Fuels", "; ".join(a.fuels), "; ".join(b.fuels), same=bool(set(a.fuels) & set(b.fuels))),
        row("Geometry", a.geometry, b.geometry),
        row("O₂ range", _fmt(ea.o2Pct, "%"), _fmt(eb.o2Pct, "%")),
        row("Pressure", _fmt(ea.pressureKpa, " kPa"), _fmt(eb.pressureKpa, " kPa")),
        row("Flow", _fmt(ea.flowCmS, " cm/s"), _fmt(eb.flowCmS, " cm/s")),
        row("Diluents", ", ".join(a.diluents) or "–", ", ".join(b.diluents) or "–"),
        row("Measurements", ", ".join(a.measurements), ", ".join(b.measurements), same=bool(shared_meas)),
        row("Imported tests", len(tests_for(ds, a.id)), len(tests_for(ds, b.id)), same=False),
    ]
    rel = [r.model_dump(by_alias=True) for r in ds.relations
           if {r.from_, r.to} == {a.id, b.id}]
    shared_hw = [h for h in _hardware_chain(a) if h in _hardware_chain(b)]
    summary = []
    if shared_hw:
        summary.append(f"Both ran on the same hardware ({' → '.join(shared_hw)}), so differences come from test conditions and fuels rather than the apparatus.")
    if set(a.fuelPhase) & set(b.fuelPhase):
        summary.append(f"Both studied {'/'.join(sorted(set(a.fuelPhase) & set(b.fuelPhase)))} fuels.")
    else:
        summary.append("They studied different fuel phases, so transfer conclusions with care.")
    if shared_meas:
        summary.append("Shared measurements: " + ", ".join(shared_meas) + ".")
    for r in rel:
        summary.append(f"Relation: {r['from']} → {r['to']} ({r['type']}{': ' + r['note'] if r['note'] else ''}).")
    return {"a": a.model_dump(), "b": b.model_dump(), "rows": rows, "relations": rel,
            "sharedHardware": shared_hw, "summary": summary}


def stats(ds: Dataset) -> dict:
    by_inv = Counter(t.investigationId for t in ds.tests)
    by_outcome = Counter(t.outcome or "unknown" for t in ds.tests)
    return {
        "investigations": len(ds.investigations),
        "inPsi": sum(1 for i in ds.investigations if i.status == "in-psi"),
        "pending": sum(1 for i in ds.investigations if i.status == "pending"),
        "tests": len(ds.tests),
        "testsByInvestigation": dict(by_inv),
        "testsByOutcome": dict(by_outcome),
        "withDataEnvelope": sum(1 for i in ds.investigations if by_inv.get(i.id)),
    }


# ------------------------------------------------------------------ evidence grades (A/B/C/M)
# Tolerances for an imported test to count as "at" the scenario (grade A).
GRADE_TOL = {"o2": 3.0, "pressure": 15.0, "flow": 5.0}
# Tolerances for an envelope to count as covering an axis (same as coverage()).
COVER_TOL = {"o2": 1.0, "pressure": 5.0}
PARTIAL_G_REASON = "No partial-gravity data in PSI; bracketed by microgravity and 1 g"
_ORDER = {"A": 0, "B": 1, "C": 2, "M": 3}


def _cap(letter: str, sc: Scenario) -> tuple[str, bool]:
    """Partial gravity caps every grade at C (PSI has no partial-g measurements); the reason then says so."""
    if 0 < sc.gravityG < 1 and letter != "M":
        return ("C" if _ORDER[letter] < _ORDER["C"] else letter), True
    return letter, False


def material_matches(m: Material, fuel: Optional[str]) -> bool:
    if not fuel:
        return False
    f = fuel.lower()
    keys = [m.id, m.name.split(" (")[0], *m.aliases]
    return any(k and k.lower() in f for k in keys)


def _near_tests(ds: Dataset, sc: Scenario, inv_ids: Optional[set[str]] = None,
                material: Optional[Material] = None) -> tuple[list[TestRecord], list[TestRecord]]:
    """(tests near on every axis, tests near on O2 + pressure but missing/mismatching flow)."""
    u_eff = effective_flow_cms(sc.flowCmS, sc.gravityG)
    full, partial = [], []
    for t in ds.tests:
        if inv_ids is not None and t.investigationId not in inv_ids:
            continue
        if material is not None and not material_matches(material, t.fuel):
            continue
        if t.o2Pct is None or abs(t.o2Pct - sc.o2Pct) > GRADE_TOL["o2"]:
            continue
        if t.pressureKpa is None or abs(t.pressureKpa - sc.pressureKpa) > GRADE_TOL["pressure"]:
            continue
        if t.flowCmS is not None and abs(t.flowCmS - u_eff) <= GRADE_TOL["flow"]:
            full.append(t)
        else:
            partial.append(t)
    return full, partial


def grade(ds: Dataset, sc: Scenario, *, investigation: Optional[Investigation] = None,
          material: Optional[Material] = None) -> Grade:
    """How sure are we? One letter, one reason, and the investigation ids it rests on.

    A  imported PSI test records at this O2 (±3), pressure (±15 kPa) and felt airflow (±5 cm/s)
    B  one tested range jointly covers O2 and pressure for the fuel type (or A-level tests missing one axis)
    C  only bracketed between separate investigations
    M  nothing covers the scenario; the value is modeled
    Partial gravity caps the result at C.
    """
    if material is not None:
        return _grade_material(ds, sc, material)

    phase_ok = lambda inv: any(p in sc.phases for p in inv.fuelPhase)
    if investigation is not None:
        pool = [investigation] if investigation.status != "pending" else []
    else:
        pool = [i for i in ds.investigations if i.status != "pending" and phase_ok(i)]
    ids = {i.id for i in pool}
    full, partial = _near_tests(ds, sc, ids)
    envs = [(i, envelope_for(i, ds.tests)) for i in pool]
    o2_cov = [i.id for i, e in envs if _within(sc.o2Pct, e.o2Pct, COVER_TOL["o2"])]
    p_cov = [i.id for i, e in envs if _within(sc.pressureKpa, e.pressureKpa, COVER_TOL["pressure"])]
    joint = [i for i in o2_cov if i in p_cov]
    if investigation is not None and not phase_ok(investigation):
        joint = []  # covers the atmosphere but not your fuel type

    if full:
        letter, basis = "A", sorted({t.investigationId for t in full})
        reason = f"{len(full)} imported PSI test record(s) at this O₂, pressure and airflow"
    elif joint or partial:
        letter = "B"
        basis = joint or sorted({t.investigationId for t in partial})
        reason = (f"{basis[0]} tested this O₂ and pressure together" if joint
                  else "Imported PSI tests match O₂ and pressure but not airflow")
    elif o2_cov or p_cov:
        letter, basis = "C", (o2_cov + [x for x in p_cov if x not in o2_cov])
        reason = ("Only bracketed: O₂ and pressure were tested in separate investigations" if investigation is None
                  else f"Tested range covers {'O₂' if o2_cov else 'pressure'} only")
    else:
        letter, basis = "M", []
        reason = ("No tested range covers this O₂ or pressure; values are modeled" if investigation is None
                  else "Tested range does not reach this O₂ or pressure")
    letter, capped = _cap(letter, sc)
    if capped:
        reason = PARTIAL_G_REASON
    return Grade(letter=letter, reason=reason, basis=basis)


def _grade_material(ds: Dataset, sc: Scenario, m: Material) -> Grade:
    if m.oxygenThreshold.o2Pct is None:
        return Grade(letter="M", reason="No sourced oxygen threshold yet; risk is not rated", basis=m.testedIn)
    full, _ = _near_tests(ds, sc, material=m)
    if full:
        letter, basis = "A", sorted({t.investigationId for t in full})
        reason = f"{len(full)} imported PSI test(s) of this material near these conditions"
    elif m.testedIn:
        letter, basis = "B", list(m.testedIn)
        reason = f"Burned in {', '.join(m.testedIn[:2])}; threshold shifted by a schematic model"
    else:
        letter, basis = "C", []
        reason = "Not in any PSI investigation; 1 g threshold shifted by a schematic model"
    letter, capped = _cap(letter, sc)
    if capped:
        reason = PARTIAL_G_REASON
    return Grade(letter=letter, reason=reason, basis=basis)


# ------------------------------------------------------------------ next experiments
SEVERITY_WEIGHT = {"critical": 3, "high": 2, "medium": 1, "info": 0}
PHASE_NAME = {"solid": "Solid materials", "liquid": "Liquid fuels", "gas": "Gaseous fuels"}


def gravity_regime(g: float) -> Optional[str]:
    if g <= 0:
        return "microgravity"
    if g >= 1:
        return None  # Earth: buoyant flames are well studied, not a missing condition
    if abs(g - 0.165) < 0.03:
        return "lunar gravity"
    if abs(g - 0.38) < 0.04:
        return "Martian gravity"
    return f"{g:g} g"


def _missing(ds: Dataset, sc: Scenario, phase: str) -> Optional[str]:
    """Severity of the missing test condition for one fuel phase in one scenario, or None if covered."""
    if gravity_regime(sc.gravityG) is None:
        return None
    if 0 < sc.gravityG < 1:
        return "critical"
    active = [(i, envelope_for(i, ds.tests)) for i in ds.investigations if i.status != "pending" and phase in i.fuelPhase]
    max_o2 = max((e.o2Pct[1] for _, e in active if e.o2Pct), default=0.0)
    if sc.o2Pct > max_o2 + COVER_TOL["o2"]:
        return "critical"
    joint = [i for i, e in active if _within(sc.o2Pct, e.o2Pct, COVER_TOL["o2"])
             and _within(sc.pressureKpa, e.pressureKpa, COVER_TOL["pressure"])]
    return None if joint else "high"


_REGIME_WORDS = {"lunar gravity": ("lunar", "moon"), "Martian gravity": ("mars", "martian")}


def _plans_regime(inv: Investigation, regime: Optional[str]) -> bool:
    """A planned investigation only fills a gap at the gravity it will actually fly at (LUCI/FM2 are lunar)."""
    words = _REGIME_WORDS.get(regime or "")
    if words is None:
        return regime == "microgravity"
    text = f"{inv.name} {inv.platform} {inv.objective}".lower()
    return any(w in text for w in words)


def next_experiments(ds: Dataset, habitats: list[dict], extra: Optional[Scenario] = None, limit: int = 5) -> list[dict]:
    """Missing test conditions, grouped by fuel phase and gravity regime across mission presets.
    score = severity weight × number of habitats affected. 'plannedBy' lists pending investigations
    whose tags and fuel phase match. Never claims NASA has decided anything."""
    groups: dict[tuple[str, str], dict] = {}
    scen_list: list[tuple[str, Scenario]] = []
    for h in habitats:
        scen_list.append((h["id"], Scenario(habitatId=h["id"], o2Pct=h["o2Pct"], pressureKpa=h["pressureKpa"],
                                            flowCmS=h["flowCmS"], gravityG=h["gravityG"], phases=h["phases"])))
    if extra is not None and extra.habitatId not in {h["id"] for h in habitats}:
        scen_list.append(("custom", extra))
    for hid, sc in scen_list:
        regime = gravity_regime(sc.gravityG)
        for phase in sc.phases:
            sev = _missing(ds, sc, phase)
            if not sev:
                continue
            key = (phase, regime or "")
            gp = groups.setdefault(key, {"phase": phase, "gravity": regime, "habitats": [], "severity": sev,
                                         "o2": [], "flow": [], "pressure": []})
            if SEVERITY_WEIGHT[sev] > SEVERITY_WEIGHT[gp["severity"]]:
                gp["severity"] = sev
            if hid not in gp["habitats"]:
                gp["habitats"].append(hid)
            gp["o2"].append(sc.o2Pct)
            gp["flow"].append(sc.flowCmS)
            gp["pressure"].append(sc.pressureKpa)

    pending = [i for i in ds.investigations if i.status == "pending"]
    out = []
    for gp in groups.values():
        lo, hi = min(gp["o2"]), max(gp["o2"])
        flo, fhi = min(gp["flow"]), max(gp["flow"])
        o2s = f"{lo:g}% O₂" if lo == hi else f"{lo:g}–{hi:g}% O₂"
        fls = f"about {flo:g} cm/s" if flo == fhi else f"about {flo:g}–{fhi:g} cm/s"
        partial = gp["gravity"] not in ("microgravity", None)
        planned = [i.id for i in pending if gp["phase"] in i.fuelPhase
                   and (("partial-gravity" in i.tags) == partial)
                   and _plans_regime(i, gp["gravity"])]
        sev_w = SEVERITY_WEIGHT[gp["severity"]]
        out.append({
            "id": f"{gp['phase']}:{gp['gravity']}",
            "title": f"{PHASE_NAME[gp['phase']]} at {o2s}, {fls}, {gp['gravity']}",
            "phase": gp["phase"], "gravity": gp["gravity"],
            "habitatsAffected": gp["habitats"], "severity": gp["severity"],
            "score": sev_w * len(gp["habitats"]),
            "plannedBy": planned,
            "why": ("No PSI investigation burned this fuel type at partial gravity" if partial
                    else "No PSI investigation tested this fuel type at this O₂ and pressure together"),
        })
    phase_order = {"solid": 0, "liquid": 1, "gas": 2}
    out.sort(key=lambda x: (-x["score"], phase_order[x["phase"]], x["id"]))
    return out[:limit] if limit else out


def experiments_for(items: list[dict], sc: Scenario) -> list[dict]:
    regime = gravity_regime(sc.gravityG)
    return [x for x in items if x["gravity"] == regime and x["phase"] in sc.phases
            and (sc.habitatId in x["habitatsAffected"] or "custom" in x["habitatsAffected"])]
