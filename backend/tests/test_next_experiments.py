from app import engine
from app.habitats import HABITATS
from tests.helpers import scen


def test_moon_base_lists_partial_gravity_solids_first(store):
    items = engine.experiments_for(engine.next_experiments(store.dataset, HABITATS, limit=0), scen("lunar-base"))
    top = items[0]
    assert top["phase"] == "solid" and top["gravity"] == "lunar gravity"
    assert set(top["plannedBy"]) == {"LUCI", "FM2"}
    assert "lunar-base" in top["habitatsAffected"] and len(top["habitatsAffected"]) >= 2


def test_scores_and_wording(store):
    items = engine.next_experiments(store.dataset, HABITATS)
    assert len(items) <= 5 and [x["score"] for x in items] == sorted((x["score"] for x in items), reverse=True)
    for x in items:
        assert "decided" not in x["why"].lower()


def test_earth_never_listed(store):
    items = engine.next_experiments(store.dataset, HABITATS, limit=0)
    assert all("earth" not in x["habitatsAffected"] for x in items)


def test_lunar_investigations_do_not_fill_mars_gaps(store):
    items = engine.next_experiments(store.dataset, HABITATS, limit=0)
    mars_solids = next(x for x in items if x["phase"] == "solid" and x["gravity"] == "Martian gravity")
    assert mars_solids["plannedBy"] == []
