import json

from tests.conftest import SYNTHETIC_CSV


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def test_health_and_dataset(client):
    h = client.get("/api/health").json()
    assert h["ok"] and h["llm"]["enabled"] is False and h["db"]["backend"] == "files"
    assert h["stats"]["tests"] == 0  # seed only: no fabricated test data
    d = client.get("/api/dataset").json()
    assert len(d["investigations"]) >= 20 and d["relations"] and d["spinoffs"]


def test_analyze_lunar(client):
    hab = next(h for h in client.get("/api/habitats").json() if h["id"] == "lunar-base")
    body = {"scenario": {k: hab[k] for k in ("o2Pct", "pressureKpa", "flowCmS", "gravityG", "phases", "pillarFocus")} | {"habitatId": "lunar-base"}}
    r = client.post("/api/analyze", json=body).json()
    assert r["ranked"][0]["score"] >= r["ranked"][-1]["score"]
    assert r["coverage"]["gaps"] and r["readout"]["o2IncreasePct"] > 40


def test_validation_error(client):
    assert client.post("/api/analyze", json={"scenario": {"o2Pct": 150}}).status_code == 422


def test_brief_streams_local_with_valid_citations(client):
    res = client.post("/api/brief", json={})
    assert res.status_code == 200
    ev = parse_sse(res.text)
    kinds = [e for e, _ in ev]
    assert kinds[0] == "meta" and ev[0][1]["mode"] == "local"
    assert "delta" in kinds and kinds[-1] == "done"
    text = "".join(d["text"] for e, d in ev if e == "delta")
    assert "## Prevention" in text and "## Evidence gaps" in text
    cites = next(d for e, d in ev if e == "citations")
    assert cites["valid"] and not cites["invalid"]


def test_ask_retrieves_relevant(client):
    res = client.post("/api/ask", json={"question": "Which experiments used helium or CO2 to extinguish droplet flames?"})
    ev = parse_sse(res.text)
    meta = ev[0][1]
    assert meta["retrieved"][0]["investigationId"] in {"FLEX", "FLEX-2", "CFI"}


def test_ingest_roundtrip(client):
    files = {"file": ("BASS-II_synthetic.csv", SYNTHETIC_CSV.encode(), "text/csv")}
    prev = client.post("/api/ingest/preview", files=files).json()
    assert prev["report"]["records"] == 3 and len(prev["sample"]) == 3
    assert client.get("/api/health").json()["stats"]["tests"] == 0  # preview doesn't save
    r = client.post("/api/ingest", files=files).json()
    assert r["stats"]["tests"] == 3
    inv = client.get("/api/investigations/BASS-II").json()
    assert inv["envelope"]["confidence"] == "data" and inv["totalTests"] == 3
    space = client.get("/api/condition-space").json()
    assert space["plottedTests"] == 3
    csv_text = client.get("/api/export/tests.csv").text
    assert csv_text.splitlines()[0].startswith("test_id,investigation_id") and len(csv_text.splitlines()) == 4
    assert client.delete("/api/uploads/BASS-II_synthetic.csv").json()["stats"]["tests"] == 0


def test_ingest_rejects_bad_type(client):
    r = client.post("/api/ingest", files={"file": ("x.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400


def test_compare_genome_space(client):
    assert client.get("/api/compare", params={"a": "BASS", "b": "BASS-II"}).json()["sharedHardware"]
    assert client.get("/api/compare", params={"a": "BASS", "b": "NOPE"}).status_code == 404
    assert client.get("/api/genome").json()["nodes"]
    assert client.get("/api/condition-space").json()["schematicCurve"]


def test_extract_requires_key(client):
    assert client.post("/api/extract", data={"file": "x.pdf"}).status_code == 503


def test_template_download(client):
    assert client.get("/api/templates/tests_template.csv").status_code == 200
    assert client.get("/api/templates/..%2F..%2Fsecret").status_code == 404


def _body(client, hid):
    hab = next(h for h in client.get("/api/habitats").json() if h["id"] == hid)
    return {k: hab[k] for k in ("o2Pct", "pressureKpa", "flowCmS", "gravityG", "phases", "pillarFocus")} | {"habitatId": hid}


def test_analyze_v2_fields(client):
    r = client.post("/api/analyze", json={"scenario": _body(client, "lunar-base")}).json()
    assert r["coverage"]["grade"]["letter"] in "ABCM" and "index" in r["coverage"]
    assert len(r["materials"]) == 8 and all("grade" in m for m in r["materials"])
    assert all(x["grade"]["letter"] for x in r["ranked"])
    assert r["nextExperiments"][0]["plannedBy"]
    assert len(r["briefPreview"]) == 3 and r["dataMode"] == "seed"


def test_compare_habitats_diff(client):
    r = client.post("/api/compare-habitats", json={"a": _body(client, "iss"), "b": _body(client, "lunar-base")}).json()
    d = r["diff"]
    assert {"materials", "gapsOnlyInB", "grade", "rankMoves"} <= set(d)
    assert any("g combustion data" in g["title"] for g in d["gapsOnlyInB"])


def test_health_reports_seed_loaded_from_default_dir():
    from fastapi.testclient import TestClient
    from app import main
    h = TestClient(main.app).get("/api/health").json()
    assert h["ok"] and h["stats"]["investigations"] == 24
    assert main.DATA_DIR.name == "data"
