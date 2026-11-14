from app.llm import validate_pick
from app.materials import ADVICE, keyword_match


def test_alias_match_offline(client):
    for item, mid in [("foam pillow", "pu-foam"), ("cotton T-shirt", "cotton"), ("acrylic window", "pmma"), ("Velcro strap", "velcro")]:
        r = client.post("/api/stowage", json={"item": item}).json()
        assert r["materialId"] == mid and r["matchedBy"] == "keyword", item
        assert r["advice"] in ADVICE.values()


def test_unknown_item(client):
    r = client.post("/api/stowage", json={"item": "zxqv gizmo"}).json()
    assert r["materialId"] is None and r["matchedBy"] == "none" and r["advice"] == ADVICE["unknown"]


def test_word_match_not_substring(store):
    assert keyword_match("bookshelf", store.dataset.materials) is None  # "book" must not match inside a word


def test_model_answer_outside_list_rejected():
    allowed = ["cotton", "pmma"]
    assert validate_pick("cotton", allowed) == "cotton"
    assert validate_pick("kevlar", allowed) is None
    assert validate_pick("none", allowed) is None
    assert validate_pick(None, allowed) is None
