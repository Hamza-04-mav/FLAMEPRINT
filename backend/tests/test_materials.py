from app.materials import LEVEL_ORDER, assess, assess_all
from tests.helpers import fixture_material, scen

RISK = {"low": 0, "elevated": 1, "high": 2}


def test_more_oxygen_never_lowers_risk():
    m = fixture_material(o2=20)
    levels = [assess(m, scen("iss", o2Pct=o2)).level for o2 in range(10, 60, 2)]
    ranks = [RISK[x] for x in levels]
    assert ranks == sorted(ranks) and ranks[-1] == 2


def test_still_air_at_zero_g_is_lower_risk_than_gentle_flow():
    m = fixture_material(o2=20)
    still = assess(m, scen("iss", gravityG=0, flowCmS=0))
    gentle = assess(m, scen("iss", gravityG=0, flowCmS=10))
    assert still.margin < gentle.margin


def test_null_threshold_is_unknown_with_grade_m():
    m = fixture_material(o2=None)
    v = assess(m, scen("lunar-base"))
    assert v.level == "unknown" and v.grade.letter == "M" and v.margin is None


def test_seed_catalog_has_no_invented_thresholds(store):
    for m in store.dataset.materials:
        assert m.oxygenThreshold.o2Pct is None or m.oxygenThreshold.source, m.id


def test_sorted_high_to_unknown(store):
    vs = assess_all(store.dataset, scen("lunar-base"))
    assert len(vs) == 8
    assert [LEVEL_ORDER[v.level] for v in vs] == sorted(LEVEL_ORDER[v.level] for v in vs)
    assert all(v.label == "illustrative model" for v in vs)


def test_no_material_grade_a_without_imported_tests(store):
    assert all(v.grade.letter != "A" for v in assess_all(store.dataset, scen("iss")))
