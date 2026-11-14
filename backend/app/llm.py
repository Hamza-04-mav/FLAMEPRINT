"""LLM integration — Groq (OpenAI-compatible API), default model openai/gpt-oss-120b.

* Streaming briefs / answers (deterministic engine is the fallback on any error).
* Structured extraction of investigation metadata from PSI documents (JSON mode).
* Stowage item -> material-id mapping (JSON mode, validated against a fixed list).
Every call degrades gracefully: callers fall back to the deterministic engine on any error.
Imports of the `groq` SDK are lazy, so the module loads (and offline tests run) without it.
"""
from __future__ import annotations

import json
import logging
import os
from typing import AsyncIterator, Optional

from pydantic import BaseModel, Field

log = logging.getLogger("flameprint.llm")

MODEL = os.getenv("FLAMEPRINT_MODEL", "openai/gpt-oss-120b")
MAX_DOC_CHARS = 400_000


def enabled() -> bool:
    mode = os.getenv("FLAMEPRINT_LLM", "auto").lower()
    if mode == "off":
        return False
    if mode == "on":
        return True
    return bool(os.getenv("GROQ_API_KEY"))


def status() -> dict:
    return {"enabled": enabled(), "model": MODEL if enabled() else None,
            "detail": f"Groq ({MODEL})" if enabled() else "No GROQ_API_KEY: using the deterministic offline writer."}


_client = None


def client():
    global _client
    if _client is None:
        from groq import AsyncGroq
        _client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"), timeout=120.0, max_retries=2)
    return _client


def describe_error(e: Exception) -> str:
    import groq
    if isinstance(e, groq.AuthenticationError):
        return "Invalid Groq API key"
    if isinstance(e, groq.PermissionDeniedError):
        return "API key lacks permission for this model"
    if isinstance(e, groq.NotFoundError):
        return f"Model '{MODEL}' not found on Groq"
    if isinstance(e, groq.RateLimitError):
        return "Rate limited by the Groq API"
    if isinstance(e, groq.BadRequestError):
        return f"Bad request: {getattr(e, 'message', str(e))}"[:200]
    if isinstance(e, groq.APIStatusError):
        return f"Groq API error {e.status_code}"
    if isinstance(e, groq.APIConnectionError):
        return "Could not reach the Groq API"
    return f"{type(e).__name__}"


async def stream_text(system: str, user: str, max_tokens: int = 8000) -> AsyncIterator[dict]:
    """Yields {'type':'delta','text':...} events, then {'type':'final','stop_reason':...,'model':...}.
    Raises before the first delta if the request setup fails, so callers can fall back cleanly."""
    c = client()
    stream = await c.chat.completions.create(
        model=MODEL, max_tokens=max_tokens, temperature=0.3, stream=True,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    stop_reason = "stop"
    async for chunk in stream:
        if not chunk.choices:
            continue
        choice = chunk.choices[0]
        if choice.delta and choice.delta.content:
            yield {"type": "delta", "text": choice.delta.content}
        if choice.finish_reason:
            stop_reason = choice.finish_reason
    yield {"type": "final", "stop_reason": stop_reason, "model": MODEL}


async def _json_completion(system: str, user: str, max_tokens: int) -> str:
    """One non-streaming JSON-mode completion; returns the raw JSON string."""
    c = client()
    resp = await c.chat.completions.create(
        model=MODEL, max_tokens=max_tokens, temperature=0.0,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    return resp.choices[0].message.content or "{}"


# ------------------------------------------------------------------ structured extraction
class ExtractedRange(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None


class ExtractedInvestigation(BaseModel):
    id: str = Field(description="Short investigation id, e.g. BASS-II, FLEX-2, ACME-BRE")
    name: str = ""
    facility: Optional[str] = None
    apparatus: Optional[str] = None
    fuel_phase: list[str] = Field(default_factory=list)
    fuels: list[str] = Field(default_factory=list)
    geometry: Optional[str] = None
    objective: Optional[str] = None
    o2_percent: Optional[ExtractedRange] = None
    pressure_kpa: Optional[ExtractedRange] = None
    flow_cm_s: Optional[ExtractedRange] = None
    diluents: list[str] = Field(default_factory=list)
    measurements: list[str] = Field(default_factory=list)
    key_findings: list[str] = Field(default_factory=list)
    fire_safety_prevention: Optional[str] = None
    fire_safety_detection: Optional[str] = None
    fire_safety_suppression: Optional[str] = None
    relevance_prevention: float = 0.5
    relevance_detection: float = 0.5
    relevance_suppression: float = 0.5


EXTRACT_SYSTEM = """Extract structured metadata about ONE NASA microgravity combustion investigation from the document.
Reply with ONLY a JSON object (no prose). Only record values explicitly stated in the document; use null or [] when a
field is not stated. Do NOT guess numbers. Convert pressure to kPa (1 atm = 101.325 kPa, 1 psi = 6.895 kPa) and flow to cm/s.

JSON shape:
{
  "id": "short id e.g. BASS-II", "name": "", "facility": null, "apparatus": null,
  "fuel_phase": ["solid|liquid|gas"], "fuels": [], "geometry": null, "objective": null,
  "o2_percent": {"min": null, "max": null}, "pressure_kpa": {"min": null, "max": null}, "flow_cm_s": {"min": null, "max": null},
  "diluents": [], "measurements": [], "key_findings": [],
  "fire_safety_prevention": null, "fire_safety_detection": null, "fire_safety_suppression": null,
  "relevance_prevention": 0.5, "relevance_detection": 0.5, "relevance_suppression": 0.5
}"""


async def extract_investigation(text: str, source: str) -> tuple[dict, list[str]]:
    warnings = []
    if len(text) > MAX_DOC_CHARS:
        warnings.append(f"Document is {len(text):,} characters; only the first {MAX_DOC_CHARS:,} were sent for extraction.")
        text = text[:MAX_DOC_CHARS]
    raw = await _json_completion(EXTRACT_SYSTEM, f'<document source="{source}">\n{text}\n</document>', max_tokens=4000)
    try:
        x = ExtractedInvestigation.model_validate_json(raw)
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Model returned invalid extraction JSON: {str(e)[:120]}") from None
    rng = lambda r: [r.min if r.min is not None else r.max, r.max if r.max is not None else r.min] \
        if r and (r.min is not None or r.max is not None) else None
    phases = [p for p in x.fuel_phase if p in ("solid", "liquid", "gas")]
    clamp = lambda v: max(0.0, min(1.0, v))
    insights = {k: v for k, v in {"prevention": x.fire_safety_prevention, "detection": x.fire_safety_detection,
                                  "suppression": x.fire_safety_suppression,
                                  "general": " ".join(x.key_findings[:3]) or None}.items() if v}
    inv = {
        "id": x.id.strip().upper().replace(" ", "-"), "name": x.name or x.id, "facility": x.facility or "Unknown",
        "apparatus": x.apparatus, "fuelPhase": phases, "fuels": x.fuels, "geometry": x.geometry or "",
        "objective": x.objective or "", "diluents": x.diluents, "measurements": x.measurements,
        "conditions": {"o2Pct": rng(x.o2_percent), "pressureKpa": rng(x.pressure_kpa), "flowCmS": rng(x.flow_cm_s),
                       "confidence": "approx", "note": f"LLM-extracted from {source}. Verify before relying on it."},
        "pillars": {"prevention": clamp(x.relevance_prevention), "detection": clamp(x.relevance_detection),
                    "suppression": clamp(x.relevance_suppression)},
        "insights": insights, "provenance": f"LLM-extracted from {source} ({MODEL}); unverified",
    }
    log.info("Extracted %s from %s", inv["id"], source)
    return json.loads(json.dumps(inv)), warnings


# ------------------------------------------------------------------ stowage: item → material id
class MaterialPick(BaseModel):
    material_id: str = Field(description="Exactly one id from the allowed list, or 'none'")


PICK_SYSTEM = """You map a household or spacecraft item to the material it is mostly made of.
Reply with ONLY a JSON object: {"material_id": "<one id from the allowed list, or 'none'>"}.
Never invent an id. Never give a risk, number or advice."""


def validate_pick(raw: Optional[str], allowed: list[str]) -> Optional[str]:
    """Only ids from the fixed list survive. Anything else (including hallucinations) becomes None."""
    if not raw:
        return None
    v = raw.strip().strip('"').lower()
    return v if v in allowed else None


async def pick_material(item: str, materials: list[dict]) -> Optional[str]:
    allowed = [m["id"] for m in materials]
    listing = "\n".join(f"- {m['id']}: {m['name']} (used for {m['usedFor']})" for m in materials)
    raw = await _json_completion(PICK_SYSTEM, f"Allowed ids:\n{listing}\n\nItem: {item[:200]}", max_tokens=60)
    try:
        pick = MaterialPick.model_validate_json(raw)
    except Exception:  # noqa: BLE001
        return None
    return validate_pick(pick.material_id, allowed)
