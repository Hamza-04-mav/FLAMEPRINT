"""Mission habitat presets. Each records where its numbers come from."""
from .physics import kpa

HABITATS = [
    {"id": "iss", "order": 1, "name": "ISS / Orion cabin", "short": "ISS/Orion", "o2Pct": 21, "pressureKpa": kpa(14.7),
     "gravityG": 0, "flowCmS": 15, "phases": ["solid", "gas"],
     "pillarFocus": {"prevention": 1, "detection": 1, "suppression": 1},
     "basis": "Sea-level-equivalent atmosphere (14.7 psi, ~21% O2) with forced cabin ventilation.", "assumed": False},
    {"id": "lunar-base", "order": 2, "name": "Moon Base", "short": "Moon Base", "o2Pct": 30, "pressureKpa": kpa(10.2),
     "gravityG": 0.165, "flowCmS": 10, "phases": ["solid", "gas"],
     "pillarFocus": {"prevention": 1, "detection": 0.8, "suppression": 0.8},
     "basis": "Challenge brief: O2 likely 30% or greater at 10.2 psi or less, to shorten EVA pre-breathe.", "assumed": False},
    {"id": "rover", "order": 4, "name": "Pressurized rover", "short": "Rover", "o2Pct": 34, "pressureKpa": kpa(8.2),
     "gravityG": 0.165, "flowCmS": 8, "phases": ["solid", "liquid", "gas"],
     "pillarFocus": {"prevention": 1, "detection": 1, "suppression": 0.7},
     "basis": "Assumed exploration atmosphere (8.2 psi / 34% O2) in a small cabin at lunar gravity. Adjust as needed.", "assumed": True},
    {"id": "mars", "order": 5, "name": "Mars habitat", "short": "Mars", "o2Pct": 34, "pressureKpa": kpa(8.2),
     "gravityG": 0.38, "flowCmS": 10, "phases": ["solid", "liquid", "gas"],
     "pillarFocus": {"prevention": 1, "detection": 0.8, "suppression": 0.8},
     "basis": "Assumes the same exploration atmosphere at Mars gravity (0.38 g). Adjust as needed.", "assumed": True},
    {"id": "suit", "order": 3, "name": "Spacesuit", "short": "Suit", "o2Pct": 100, "pressureKpa": kpa(4.3),
     "gravityG": 0.165, "flowCmS": 5, "phases": ["solid"],
     "pillarFocus": {"prevention": 1, "detection": 0.3, "suppression": 0.2},
     "basis": "Challenge brief: suits hold 100% O2 at 4.3 psi.", "assumed": False},
    {"id": "earth", "order": None, "name": "Earth reference", "short": "Earth", "o2Pct": 20.9, "pressureKpa": kpa(14.7),
     "gravityG": 1, "flowCmS": 0, "phases": ["solid", "liquid", "gas"],
     "pillarFocus": {"prevention": 1, "detection": 1, "suppression": 1},
     "basis": "Sea level, 1 g. Buoyancy drives the flow.", "assumed": False},
]


def habitat(hid: str):
    return next((h for h in HABITATS if h["id"] == hid), None)
