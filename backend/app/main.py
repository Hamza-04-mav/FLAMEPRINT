"""FLAMEPRINT API (FastAPI)."""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import AsyncIterator, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from . import engine, llm  # noqa: E402
from .brief import (SYSTEM_ASK, SYSTEM_BRIEF, allowed_ids, build_context, check_citations,  # noqa: E402
                    local_answer, local_brief)
from .habitats import HABITATS  # noqa: E402
from .ingest import parse_file  # noqa: E402
from .models import AskRequest, RankRequest  # noqa: E402
from .physics import readout, schematic_curve  # noqa: E402
from .store import Store  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("flameprint")

DATA_DIR = Path(os.getenv("FLAMEPRINT_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
store = Store(DATA_DIR, os.getenv("DATABASE_URL") or None)

app = FastAPI(title="FLAMEPRINT API", version="1.0.0",
              description="Fire-safety insights from NASA PSI microgravity combustion data.")
app.add_middleware(CORSMiddleware,
                   allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
                   allow_methods=["*"], allow_headers=["*"])


def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


# ------------------------------------------------------------------ meta
@app.get("/api/health")
def health():
    ds = store.dataset
    return {"ok": True, "db": store.db_status, "llm": llm.status(), "stats": engine.stats(ds),
            "dataDir": str(DATA_DIR), "loadedAt": store.loaded_at}


@app.get("/api/habitats")
def habitats():
    return HABITATS


@app.get("/api/dataset")
def dataset():
    ds = store.dataset
    return {
        "investigations": [i.model_dump() for i in ds.investigations],
        "relations": [r.model_dump(by_alias=True) for r in ds.relations],
        "spinoffs": [s.model_dump() for s in ds.spinoffs],
        "sources": [s.model_dump() for s in ds.sources],
        "stats": engine.stats(ds),
    }


@app.get("/api/investigations/{inv_id}")
def investigation(inv_id: str, limit: int = Query(200, le=5000)):
    ds = store.dataset
    inv = ds.inv(inv_id)
    if not inv:
        raise HTTPException(404, f"Unknown investigation '{inv_id}'")
    tests = engine.tests_for(ds, inv_id)
    return {"investigation": inv.model_dump(), "envelope": engine.envelope_for(inv, ds.tests).model_dump(),
            "tests": [t.model_dump() for t in tests[:limit]], "totalTests": len(tests),
            "relations": [r.model_dump(by_alias=True) for r in ds.relations if inv_id in (r.from_, r.to)]}


# ------------------------------------------------------------------ analysis
@app.post("/api/analyze")
def analyze(req: RankRequest):
    """One call powers the dashboard: ranking + coverage + physics readout for a scenario."""
    ds = store.dataset
    ranked = engine.rank(ds, req.scenario, req.weights)
    return {"ranked": [r.model_dump() for r in ranked], "coverage": engine.coverage(ds, req.scenario),
            "readout": readout(req.scenario)}


@app.get("/api/condition-space")
def condition_space():
    return engine.condition_space(store.dataset) | {"schematicCurve": schematic_curve()}


@app.get("/api/genome")
def genome():
    return engine.genome(store.dataset)


@app.get("/api/compare")
def compare(a: str, b: str):
    try:
        return engine.compare(store.dataset, a, b)
    except KeyError as e:
        raise HTTPException(404, f"Unknown investigation {e}") from None


# ------------------------------------------------------------------ SI: brief & ask (SSE)
async def _stream(system: str, user: str, fallback_text: str, allowed: set[str], meta: dict) -> AsyncIterator[str]:
    text, mode, note = "", "local", None
    if llm.enabled():
        try:
            gen = llm.stream_text(system, user)
            first = await gen.__anext__()  # surfaces request errors before we commit to LLM mode
            yield sse("meta", meta | {"mode": "llm", "model": llm.MODEL})
            mode = "llm"
            ev = first
            while True:
                if ev["type"] == "delta":
                    text += ev["text"]
                    yield sse("delta", {"text": ev["text"]})
                elif ev["type"] == "final" and ev["stop_reason"] == "refusal":
                    note = "The model declined part of this request."
                elif ev["type"] == "final" and ev["stop_reason"] == "max_tokens":
                    note = "The response hit the length limit."
                try:
                    ev = await gen.__anext__()
                except StopAsyncIteration:
                    break
        except StopAsyncIteration:
            pass
        except Exception as e:  # noqa: BLE001
            reason = llm.describe_error(e)
            log.warning("LLM stream failed: %s", reason)
            if mode == "llm":
                note = f"Stream interrupted ({reason})."
            else:
                meta = meta | {"fallbackReason": reason}
    if mode == "local":
        yield sse("meta", meta | {"mode": "local"})
        text = fallback_text
        # chunk the deterministic text so the UI streams it the same way
        for i in range(0, len(text), 48):
            yield sse("delta", {"text": text[i:i + 48]})
    yield sse("citations", check_citations(text, allowed))
    yield sse("done", {"mode": mode, "note": note})


@app.post("/api/brief")
async def brief(req: RankRequest):
    ds = store.dataset
    ctx = build_context(ds, req.scenario, req.weights)
    user = ("Write the mission fire-safety brief for this scenario. Context (JSON):\n"
            + json.dumps(ctx, ensure_ascii=False, default=str))
    meta = {"coverageIndex": ctx["coverage"]["index"], "investigations": [i["id"] for i in ctx["investigations"]]}
    return StreamingResponse(_stream(SYSTEM_BRIEF, user, local_brief(ctx), allowed_ids(ctx), meta),
                             media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/ask")
async def ask(req: AskRequest):
    hits = store.search(req.question, k=8)
    passages, allowed = [], set()
    for n, h in enumerate(hits, 1):
        tag = h["investigationId"] if h["kind"] == "card" else f"doc:{h['source']}"
        allowed.add(tag)
        if h["investigationId"]:
            allowed.add(h["investigationId"])
        passages.append(f"[{n}] citation tag: [{tag}]\n{h['text']}")
    scen = f"\nUser's current mission scenario: {req.scenario.model_dump_json()}" if req.scenario else ""
    user = f"Question: {req.question}{scen}\n\nPassages:\n\n" + "\n\n".join(passages)
    meta = {"retrieved": [{k: h[k] for k in ("id", "investigationId", "source", "kind", "score")} for h in hits],
            "retrieval": store.db_status["backend"]}
    return StreamingResponse(_stream(SYSTEM_ASK, user, local_answer(req.question, hits), allowed, meta),
                             media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ------------------------------------------------------------------ data lab
@app.get("/api/sources")
def sources():
    return {"reports": store.reports, "uploads": store.uploads(),
            "sources": [s.model_dump() for s in store.dataset.sources]}


@app.post("/api/ingest/preview")
async def ingest_preview(file: UploadFile = File(...), investigation_id: Optional[str] = Form(None)):
    data = await file.read()
    known = [i.id for i in store.dataset.investigations]
    parsed = parse_file(file.filename or "upload", data, known, investigation_id or None)
    return {"report": parsed.report.to_dict(), "sample": [t.model_dump() for t in parsed.tests[:8]],
            "investigations": parsed.investigations[:5], "textPreview": parsed.text[:600]}


@app.post("/api/ingest")
async def ingest(file: UploadFile = File(...), investigation_id: Optional[str] = Form(None)):
    data = await file.read()
    try:
        report = store.save_upload(file.filename or "upload", data, investigation_id or None)
    except ValueError as e:
        raise HTTPException(400, str(e)) from None
    return {"report": report, "stats": engine.stats(store.dataset)}


@app.post("/api/extract")
async def extract(file: str = Form(...)):
    """LLM structured extraction of investigation metadata from an imported document."""
    if not llm.enabled():
        raise HTTPException(503, "Structured extraction needs ANTHROPIC_API_KEY in backend/.env.")
    from .ingest import parse_document
    candidates = [DATA_DIR / "imported" / Path(file).name, DATA_DIR / file]
    path = next((p for p in candidates if p.is_file() and DATA_DIR.resolve() in p.resolve().parents), None)
    if not path:
        raise HTTPException(404, "Document not found among imported/PSI files.")
    parsed = parse_document(path.name, path.read_bytes(), [i.id for i in store.dataset.investigations])
    if not parsed.text:
        raise HTTPException(422, "No extractable text in this document.")
    try:
        inv, warnings = await llm.extract_investigation(parsed.text, path.name)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Extraction failed: {llm.describe_error(e)}") from None
    saved = store.save_extracted(path.name, inv)
    return {"investigation": inv, "savedAs": f"imported/{saved}", "warnings": warnings}


@app.delete("/api/uploads/{name}")
def delete_upload(name: str):
    if not store.delete_upload(name):
        raise HTTPException(404, "No such upload")
    return {"ok": True, "stats": engine.stats(store.dataset)}


@app.delete("/api/uploads")
def clear_uploads():
    n = store.clear_uploads()
    return {"deleted": n, "stats": engine.stats(store.dataset)}


@app.post("/api/reload")
def reload():
    store.invalidate()
    return {"stats": engine.stats(store.dataset), "db": store.db_status}


@app.get("/api/export/tests.csv")
def export_tests(investigation: Optional[str] = None):
    """Normalized, model-ready table: every imported test joined with its investigation's metadata."""
    import csv
    import io
    ds = store.dataset
    cols = ["test_id", "investigation_id", "facility", "apparatus", "fuel_phase", "fuel", "o2_pct", "pressure_kpa",
            "flow_cm_s", "gravity_g", "diluent", "outcome", "metric_name", "metric_value", "source_file"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    for t in ds.tests:
        if investigation and t.investigationId != investigation:
            continue
        inv = ds.inv(t.investigationId)
        w.writerow([t.id, t.investigationId, inv.facility if inv else "", inv.apparatus if inv else "",
                    "|".join(inv.fuelPhase) if inv else "", t.fuel, t.o2Pct, t.pressureKpa, t.flowCmS, t.gravityG,
                    t.diluent, t.outcome, t.metricName, t.metricValue, t.source])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="flameprint_modeling_dataset.csv"'})


@app.get("/api/templates/{name}")
def template(name: str):
    p = DATA_DIR / "templates" / Path(name).name
    if not p.is_file():
        raise HTTPException(404, "Unknown template")
    return FileResponse(p, filename=p.name)
