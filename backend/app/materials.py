"""Material verdicts: "Will my things burn here?"

Every verdict is an ILLUSTRATIVE MODEL built from two inputs:
  1. a sourced 1 g oxygen threshold (limiting oxygen index) from data/seed/materials.json, and
  2. a gravity/airflow shift taken from the schematic U-curve in physics.py.
No threshold is ever invented: a material without a sourced value is 'unknown' with grade M.
"""
from __future__ import annotations

from typing import Optional

from .engine import grade
from .models import Dataset, Material, MaterialVerdict, Scenario
from .physics import effective_flow_cms, schematic_limiting_o2

# ─────────────────────────── SCHEMATIC ───────────────────────────
# Uncalibrated teaching constants. Change them here only, and keep the "illustrative model" label.
SCHEMATIC_REFERENCE_FLOW_CMS = effective_flow_cms(0.0, 1.0)  # still room air at 1 g: buoyancy only
HIGH_MARGIN = 3.0      # O2 points above the effective threshold → high
LOW_MARGIN = -3.0      # O2 points below the effective threshold → low
LABEL = "illustrative model"
# ──────────────────────────────────────────────────────────────────

LEVEL_ORDER = {"high": 0, "elevated": 1, "low": 2, "unknown": 3}


def threshold_shift(sc: Scenario) -> float:
    """How the schematic limiting-O2 curve moves from 1 g still air to this scenario's felt airflow.
    Negative = the material burns at lower O2 than in a 1 g test (e.g. microgravity with gentle flow)."""
    u = effective_flow_cms(sc.flowCmS, sc.gravityG)
    return schematic_limiting_o2(u) - schematic_limiting_o2(SCHEMATIC_REFERENCE_FLOW_CMS)


def level_for(margin: Optional[float]) -> str:
    if margin is None:
        return "unknown"
    if margin >= HIGH_MARGIN:
        return "high"
    if margin <= LOW_MARGIN:
        return "low"
    return "elevated"


def assess(material: Material, sc: Scenario, ds: Optional[Dataset] = None) -> MaterialVerdict:
    ds = ds or Dataset(investigations=[], tests=[])
    g = grade(ds, sc, material=material)
    t1g = material.oxygenThreshold.o2Pct
    if t1g is None:
        return MaterialVerdict(id=material.id, name=material.name, usedFor=material.usedFor, level="unknown",
                               grade=g, label=LABEL, why="No sourced oxygen threshold yet, so FLAMEPRINT does not guess.")
    eff = t1g + threshold_shift(sc)
    margin = sc.o2Pct - eff
    level = level_for(margin)
    # short enough for a card: the margin is shown separately
    if level == "high":
        why = f"Keeps burning down to ≈{eff:.0f}% O₂ here"
    elif level == "low":
        why = f"Needs ≈{eff:.0f}% O₂ to keep burning here"
    else:
        why = f"Close to its limit of ≈{eff:.0f}% O₂ here"
    return MaterialVerdict(id=material.id, name=material.name, usedFor=material.usedFor, level=level,
                           margin=round(margin, 1), threshold1g=t1g, effectiveThreshold=round(eff, 1),
                           grade=g, label=LABEL, why=why,
                           source=material.oxygenThreshold.source, url=material.oxygenThreshold.url)


def assess_all(ds: Dataset, sc: Scenario) -> list[MaterialVerdict]:
    out = [assess(m, sc, ds) for m in ds.materials]
    out.sort(key=lambda v: (LEVEL_ORDER[v.level], -(v.margin if v.margin is not None else 0), v.name))
    return out


# ─────────────────────────── stowage ───────────────────────────
ADVICE = {
    "high": "Store in a fire-resistant bag or replace with a flame-resistant option",
    "elevated": "Keep away from ignition sources and limit the amount",
    "low": "No special storage beyond normal rules",
    "unknown": "No NASA test data for this kind of material",
}


def _words(text: str) -> str:
    return " " + " ".join("".join(c if c.isalnum() else " " for c in text.lower()).split()) + " "


def keyword_match(item: str, materials: list[Material]) -> Optional[Material]:
    """Case-insensitive whole-word match against ids, names and aliases. Longest alias wins."""
    hay = _words(item)
    best: Optional[tuple[int, Material]] = None
    for m in materials:
        for k in [m.id, m.name.split(" (")[0], *m.aliases]:
            kw = _words(k)
            if kw.strip() and kw in hay and (best is None or len(kw) > best[0]):
                best = (len(kw), m)
    return best[1] if best else None
