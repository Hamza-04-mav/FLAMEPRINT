from app.habitats import habitat
from app.models import Material, OxygenThreshold, Scenario, TestRecord


def scen(hid: str, **over) -> Scenario:
    h = habitat(hid)
    base = dict(habitatId=hid, o2Pct=h["o2Pct"], pressureKpa=h["pressureKpa"], flowCmS=h["flowCmS"],
                gravityG=h["gravityG"], phases=h["phases"], pillarFocus=h["pillarFocus"])
    return Scenario(**(base | over))


def fixture_material(o2=18.0, tested=("BASS",)) -> Material:
    """SYNTHETIC fixture threshold, not a sourced value. Used only to exercise the model."""
    return Material(id="fixture", name="Fixture fabric", aliases=["fixture"], testedIn=list(tested),
                    oxygenThreshold=OxygenThreshold(o2Pct=o2, source="synthetic test fixture"))


def near_test(inv="BASS", o2=21.0, p=101.3, flow=15.0, fuel="PMMA") -> TestRecord:
    return TestRecord(id=f"T-{inv}-{o2}", investigationId=inv, o2Pct=o2, pressureKpa=p, flowCmS=flow,
                      gravityG=0, fuel=fuel, outcome="burned", source="synthetic.csv")
