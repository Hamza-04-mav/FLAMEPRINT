from app import engine
from app.habitats import HABITATS, habitat
from app.models import Pillars, Scenario, TestRecord, Weights
from app.physics import buoyant_flow_cms, kpa, o2_increase_pct, schematic_limiting_o2


def scen(hid: str) -> Scenario:
    h = habitat(hid)
    return Scenario(habitatId=hid, o2Pct=h["o2Pct"], pressureKpa=h["pressureKpa"], flowCmS=h["flowCmS"],
                    gravityG=h["gravityG"], phases=h["phases"], pillarFocus=h["pillarFocus"])


def test_physics_basics():
    assert kpa(14.7) == 101.4
    assert round(o2_increase_pct(30)) == 44  # challenge brief: ">40% increase"
    assert buoyant_flow_cms(0) == 0
    assert buoyant_flow_cms(1) > buoyant_flow_cms(0.165) > 0
    # U-shaped schematic: minimum at intermediate flow
    assert schematic_limiting_o2(0.5) > schematic_limiting_o2(10) < schematic_limiting_o2(120)


def test_rank_sorted_and_explained(store):
    ds = store.dataset
    ranked = engine.rank(ds, scen("iss"), Weights())
    scores = [r.score for r in ranked]
    assert scores == sorted(scores, reverse=True)
    assert all(0 <= s <= 100 for s in scores)
    top = ranked[0]
    assert len(top.factors) == 6 and all(f.why for f in top.factors)
    # ISS cabin + solids: a solid-fuel, cabin-air investigation should lead
    assert "solid" in ds.inv(top.id).fuelPhase


def test_weights_change_order(store):
    ds = store.dataset
    sc = scen("iss").model_copy(update={"pillarFocus": Pillars(prevention=0, detection=1, suppression=0)})
    detect_heavy = engine.rank(ds, sc, Weights(o2=0, pressure=0, flow=0, material=0, pillar=1, gravity=0))
    assert detect_heavy[0].id in {"SAME", "SAME-R"}


def test_pending_investigations_penalized(store):
    ranked = {r.id: r for r in engine.rank(store.dataset, scen("lunar-base"), Weights())}
    assert ranked["FM2"].score < ranked["BASS-II"].score


def test_lunar_base_gaps(store):
    cov = engine.coverage(store.dataset, scen("lunar-base"))
    titles = " ".join(g["title"] for g in cov["gaps"])
    assert "No 0.17 g" in titles or "0.16" in titles or "g combustion data" in titles
    assert any(g["severity"] == "critical" and "Solid materials untested" in g["title"] for g in cov["gaps"])
    assert cov["maxO2Tested"] == 85 and cov["maxO2TestedBy"] == "ACME-CFI-G"
    assert 0 <= cov["index"] <= 100


def test_iss_has_better_coverage_than_suit(store):
    ds = store.dataset
    assert engine.coverage(ds, scen("iss"))["index"] > engine.coverage(ds, scen("suit"))["index"]


def test_envelope_from_imported_tests(store):
    ds = store.dataset
    inv = ds.inv("FLEX")
    tests = [TestRecord(id="a", investigationId="FLEX", o2Pct=16, pressureKpa=70, source="x.csv"),
             TestRecord(id="b", investigationId="FLEX", o2Pct=30, pressureKpa=101, source="x.csv")]
    env = engine.envelope_for(inv, tests)
    assert env.confidence == "data" and env.o2Pct == (16, 30) and env.pressureKpa == (70, 101)
    assert env.flowCmS == inv.conditions.flowCmS  # missing axis falls back to catalog


def test_genome_and_compare(store):
    ds = store.dataset
    g = engine.genome(ds)
    ids = {n["id"] for n in g["nodes"]}
    assert {"fac:CIR", "app:MDCA", "FLEX", "CFI"} <= ids
    assert any(e["source"] == "app:MDCA" and e["target"] == "FLEX" for e in g["edges"])
    assert any(e["type"] == "shared-instrument" for e in g["edges"])
    c = engine.compare(ds, "FLEX", "CFI")
    assert "MDCA" in c["sharedHardware"]
    assert any("Cool flames" in s for s in c["summary"])


def test_all_habitats_rank(store):
    for h in HABITATS:
        assert engine.rank(store.dataset, scen(h["id"]), Weights())
