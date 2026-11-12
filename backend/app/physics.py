"""Transparent, order-of-magnitude physics used to put a scenario in context.

Everything here is deliberately simple and is labelled 'estimate' / 'schematic' in the UI.
None of it is presented as NASA measurement.
"""
from __future__ import annotations

import math

from .models import Scenario

EARTH_O2 = 20.9
EARTH_KPA = 101.3
PSI_TO_KPA = 6.89476
# Characteristic buoyant velocity near a small (cm-scale) flame at 1 g: order tens of cm/s.
BUOYANT_REF_CMS = 30.0


def kpa(psi: float) -> float:
    return round(psi * PSI_TO_KPA, 1)


def psi(kpa_: float) -> float:
    return round(kpa_ / PSI_TO_KPA, 1)


def o2_partial_pressure_kpa(o2_pct: float, pressure_kpa: float) -> float:
    return o2_pct / 100.0 * pressure_kpa


def o2_increase_pct(o2_pct: float) -> float:
    """Percent change of O2 mole fraction vs. Earth air (30% → +44%)."""
    return (o2_pct / EARTH_O2 - 1.0) * 100.0


def buoyant_flow_cms(gravity_g: float) -> float:
    """Buoyant velocity scales as sqrt(g·L): u_b(g) ≈ u_b(1 g)·sqrt(g/g0)."""
    return BUOYANT_REF_CMS * math.sqrt(max(0.0, gravity_g))


def effective_flow_cms(flow_cms: float, gravity_g: float) -> float:
    """Rough combined flow a flame 'feels': forced ventilation ⊕ buoyancy-induced flow."""
    return math.hypot(flow_cms, buoyant_flow_cms(gravity_g))


def schematic_limiting_o2(flow_cms: float) -> float:
    """Schematic (NOT calibrated) limiting-O2 vs. flow curve with the U-shape seen in published
    microgravity thin-fuel flammability maps: a quenching branch at very low flow and a blow-off
    branch at high flow. Used only as a labelled teaching curve; imported PSI outcomes are plotted on top."""
    u = max(0.3, flow_cms)
    return 14.0 + 9.0 / u + 0.09 * u


def flow_regime(u_eff: float) -> dict:
    if u_eff < 3:
        return {"label": "Near-quiescent", "tone": "cyan",
                "text": "Oxygen arrives mainly by diffusion. Flames can die from radiative loss and oxygen starvation, but the margins are thin."}
    if u_eff < 20:
        return {"label": "Low-speed flow", "tone": "amber",
                "text": "This flow range cannot exist on Earth, because buoyancy always drives faster flow. Microgravity studies of thin fuels report flames surviving here at lower O2 than in 1 g."}
    return {"label": "Forced / buoyant flow", "tone": "orange",
            "text": "Strong, Earth-like flow. Flames spread along with the flow, and blow-off limits matter at high speeds."}


def readout(s: Scenario) -> dict:
    u_eff = effective_flow_cms(s.flowCmS, s.gravityG)
    return {
        "ppO2Kpa": round(o2_partial_pressure_kpa(s.o2Pct, s.pressureKpa), 2),
        "o2IncreasePct": round(o2_increase_pct(s.o2Pct), 1),
        "buoyantFlowCmS": round(buoyant_flow_cms(s.gravityG), 2),
        "effectiveFlowCmS": round(u_eff, 2),
        "pressurePsi": psi(s.pressureKpa),
        "regime": flow_regime(u_eff),
        "schematicLimitingO2": round(schematic_limiting_o2(u_eff), 1),
        "marginToSchematic": round(s.o2Pct - schematic_limiting_o2(u_eff), 1),
        "earthEquivalent": {"o2Pct": EARTH_O2, "pressureKpa": EARTH_KPA,
                             "ppO2Kpa": round(o2_partial_pressure_kpa(EARTH_O2, EARTH_KPA), 2)},
    }


def schematic_curve(points: int = 60) -> list[dict]:
    out = []
    for i in range(points):
        u = 0.5 * (120 / 0.5) ** (i / (points - 1))  # log-spaced 0.5..120 cm/s
        out.append({"flowCmS": round(u, 3), "o2Pct": round(schematic_limiting_o2(u), 2)})
    return out
