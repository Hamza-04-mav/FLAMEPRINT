"""Claude integration (Anthropic Python SDK).

* Streaming briefs / answers with server-side refusal fallbacks (fallbacks="default").
* Structured extraction of investigation metadata from PSI documents (messages.parse).
Every call degrades gracefully: callers fall back to the deterministic engine on any error.
"""
from __future__ import annotations

import json
import logging
import os
from typing import AsyncIterator, Optional

from pydantic import BaseModel, Field

log = logging.getLogger("flameprint.llm")

MODEL = os.getenv("FLAMEPRINT_MODEL", "claude-opus-5-5")
EFFORT = os.getenv("FLAMEPRINT_EFFORT", "medium")
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_DOC_CHARS = 400_000


def enabled() -> bool:
    mode = os.getenv("FLAMEPRINT_LLM", "auto").lower()
    if mode == "off":
        return False
    if mode == "on":
        return True
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


def status() -> dict:
    return {"enabled": enabled(), "model": MODEL if enabled() else None,
            "detail": f"Claude ({MODEL})" if enabled() else "No ANTHROPIC_API_KEY: using the deterministic offline writer."}


_client = None


def client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.AsyncAnthropic(timeout=120.0, max_retries=2)
    return _client


def describe_error(e: Exception) -> str:
    import anthropic
    if isinstance(e, anthropic.AuthenticationError):
        return "Invalid Anthropic API key"
    if isinstance(e, anthropic.PermissionDeniedError):
        return "API key lacks permission for this model"
    if isinstance(e, anthropic.NotFoundError):
        return f"Model '{MODEL}' not found"
    if isinstance(e, anthropic.RateLimitError):
        return "Rate limited by the Claude API"
    if isinstance(e, anthropic.BadRequestError):
        return f"Bad request: {e.message}"[:200]
    if isinstance(e, anthropic.APIStatusError):
        return f"Claude API error {e.status_code}"
    if isinstance(e, anthropic.APIConnectionError):
        return "Could not reach the Claude API"
    return f"{type(e).__name__}"


async def stream_text(system: str, user: str, max_tokens: int = 8000) -> AsyncIterator[dict]:
    """Yields {'type':'delta','text':...} events, then {'type':'final', 'stop_reason':..., 'model':...}.
    Raises before the first delta if the request fails, so callers can fall back cleanly."""
    import anthropic
    c = client()
    common = dict(model=MODEL, max_tokens=max_tokens, system=system,
                  messages=[{"role": "user", "content": user}],
                  thinking={"type": "adaptive"}, output_config={"effort": EFFORT})
    try:
        cm = c.beta.messages.stream(betas=[FALLBACK_BETA], fallbacks="default", **common)
        stream = await cm.__aenter__()
    except (anthropic.BadRequestError, TypeError):
        # account/platform without server-side fallbacks: plain request
        cm = c.messages.stream(**common)
        stream = await cm.__aenter__()
    try:
        async for text in stream.text_stream:
            yield {"type": "delta", "text": text}
        final = await stream.get_final_message()
        yield {"type": "final", "stop_reason": final.stop_reason, "model": final.model}
    finally:
        await cm.__aexit__(None, None, None)


# ------------------------------------------------------------------ structured extraction
class ExtractedRange(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None


class ExtractedInvestigation(BaseModel):
    id: str = Field(description="Short investigation id, e.g. BASS-II, FLEX-2, ACME-BRE")
    name: str
    facility: Optional[str] = Field(None, description="e.g. CIR, MSG")
    apparatus: Optional[str] = Field(None, description="e.g. MDCA, ACME, SPICE flow duct")
    fuel_phase: list[str] = Field(default_factory=list, description="subset of: solid, liquid, gas")
    fuels: list[str] = Field(default_factory=list)
    geometry: Optional[str] = None
    objective: Optional[str] = None
    o2_percent: Optional[ExtractedRange] = Field(None, description="ambient O2 mole percent range tested, only if stated")
    pressure_kpa: Optional[ExtractedRange] = Field(None, description="pressure range in kPa, only if stated (convert units)")
    flow_cm_s: Optional[ExtractedRange] = Field(None, description="imposed flow speed range in cm/s, only if stated")
    diluents: list[str] = Field(default_factory=list)
    measurements: list[str] = Field(default_factory=list)
    key_findings: list[str] = Field(default_factory=list, description="findings stated in the document, verbatim or close paraphrase")
    fire_safety_prevention: Optional[str] = None
    fire_safety_detection: Optional[str] = None
    fire_safety_suppression: Optional[str] = None
    relevance_prevention: float = Field(0.5, description="0..1")
    relevance_detection: float = Field(0.5, description="0..1")
    relevance_suppression: float = Field(0.5, description="0..1")


EXTRACT_SYSTEM = """Extract structured metadata about ONE NASA microgravity combustion investigation from the document.
Only record values explicitly stated in the document; leave a field null/empty when it is not stated. Do not guess numbers.
Convert pressure to kPa (1 atm = 101.325 kPa, 1 psi = 6.895 kPa) and flow speed to cm/s."""


async def extract_investigation(text: str, source: str) -> tuple[dict, list[str]]:
    warnings = []
    if len(text) > MAX_DOC_CHARS:
        warnings.append(f"Document is {len(text):,} characters; only the first {MAX_DOC_CHARS:,} were sent for extraction.")
        text = text[:MAX_DOC_CHARS]
    resp = await client().messages.parse(
        model=MODEL, max_tokens=16000, system=EXTRACT_SYSTEM,
        output_config={"effort": EFFORT},
        messages=[{"role": "user", "content": f"<document source=\"{source}\">\n{text}\n</document>"}],
        output_format=ExtractedInvestigation,
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("The model declined to extract this document.")
    x: ExtractedInvestigation = resp.parsed_output
    rng = lambda r: [r.min if r.min is not None else r.max, r.max if r.max is not None else r.min] \
        if r and (r.min is not None or r.max is not None) else None
    phases = [p for p in x.fuel_phase if p in ("solid", "liquid", "gas")]
    clamp = lambda v: max(0.0, min(1.0, v))
    insights = {k: v for k, v in {"prevention": x.fire_safety_prevention, "detection": x.fire_safety_detection,
                                  "suppression": x.fire_safety_suppression,
                                  "general": " ".join(x.key_findings[:3]) or None}.items() if v}
    inv = {
        "id": x.id.strip().upper().replace(" ", "-"), "name": x.name, "facility": x.facility or "Unknown",
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
