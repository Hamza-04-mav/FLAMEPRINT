from app import engine
from tests.helpers import fixture_material, near_test, scen


def test_moon_base_is_c_at_best(store):
    g = engine.grade(store.dataset, scen("lunar-base"))
    assert g.letter in ("C", "M")
    if g.letter == "C":
        assert "partial-gravity" in g.reason


def test_partial_gravity_caps_even_with_tests(store):
    ds = store.dataset
    ds.tests.append(near_test(o2=30, p=70.3, flow=15.8))
    assert engine.grade(ds, scen("lunar-base", phases=["solid"])).letter == "C"


def test_iss_seed_only_is_not_a(store):
    assert engine.grade(store.dataset, scen("iss")).letter in ("B", "M")


def test_imported_tests_near_scenario_give_a(store):
    ds = store.dataset
    ds.tests.append(near_test(o2=21, p=101.3, flow=15))
    g = engine.grade(ds, scen("iss"))
    assert g.letter == "A" and g.basis == ["BASS"]


def test_every_ranked_row_has_grade(store):
    ranked = engine.rank(store.dataset, scen("iss"), engine.Weights())
    assert all(r.grade and r.grade.reason for r in ranked)


def test_material_a_requires_imported_tests(store):
    ds = store.dataset
    m = fixture_material()
    assert engine.grade(ds, scen("iss"), material=m).letter == "B"
    ds.tests.append(near_test(fuel="fixture fabric strip"))
    assert engine.grade(ds, scen("iss"), material=m).letter == "A"
