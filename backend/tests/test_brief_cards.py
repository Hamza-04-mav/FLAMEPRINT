from app.brief import MAX_CARD_BULLETS, allowed_ids, brief_cards, build_context
from app.models import Weights
from tests.helpers import scen


def test_three_cards_short_and_cited(store):
    ctx = build_context(store.dataset, scen("iss"), Weights())
    out = brief_cards(ctx)
    assert set(out["cards"]) == {"prevention", "detection", "suppression"}
    allowed = allowed_ids(ctx)
    for card in out["cards"].values():
        assert len(card["bullets"]) <= MAX_CARD_BULLETS
        for b in card["bullets"]:
            assert b["text"] and b["cite"] and all(c in allowed for c in b["cite"])
    assert out["audit"]["valid"] and not out["audit"]["invalid"]


def test_moon_base_prevention_flags_insufficient_evidence(store):
    out = brief_cards(build_context(store.dataset, scen("lunar-base"), Weights()))
    assert out["cards"]["prevention"]["gap"].startswith("Insufficient evidence")


def test_empty_area_says_insufficient_evidence(store):
    ctx = build_context(store.dataset, scen("iss"), Weights())
    for i in ctx["investigations"]:
        i["insights"] = {}
    out = brief_cards(ctx)
    assert out["cards"]["suppression"]["bullets"] == []
    assert "Insufficient evidence" in out["cards"]["suppression"]["gap"]


def test_brief_cards_api(client):
    r = client.post("/api/brief-cards", json={}).json()
    assert len(r["cards"]) == 3 and not r["audit"]["invalid"]
