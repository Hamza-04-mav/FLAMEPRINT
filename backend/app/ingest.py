"""PSI data ingestion.

Accepts whatever NASA PSI hands out and normalizes it into the FLAMEPRINT contract:
  * .csv / .tsv / .xlsx  -> TestRecords   (automatic column mapping + unit conversion)
  * .json                -> Investigations (metadata overrides) and/or TestRecords
  * .pdf / .txt / .md    -> document chunks for retrieval (RAG) and optional LLM extraction

Nothing is invented: unmapped columns are kept verbatim in `raw`, and every record keeps its
source file name so it can be cited.
"""
from __future__ import annotations

import csv
import io
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from .models import Investigation, TestRecord

TEST_EXT = {".csv", ".tsv", ".xlsx"}
DOC_EXT = {".pdf", ".txt", ".md"}
SUPPORTED_EXT = TEST_EXT | DOC_EXT | {".json"}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


# ---- column synonyms (matched against normalized header text) -------------------------------
FIELD_PATTERNS: dict[str, list[str]] = {
    "investigationId": ["investigation", "experiment", "investigationid", "experimentid", "project", "study"],
    "id": ["testid", "test", "run", "runid", "testno", "testnumber", "point", "pointid", "id", "case", "caseid"],
    "o2Pct": ["o2", "oxygen", "xo2", "o2concentration", "oxygenconcentration", "o2molefraction", "oxygenfraction",
              "yo2", "o2fraction", "o2pct", "o2percent", "ambiento2", "oxidizero2"],
    "pressureKpa": ["pressure", "p", "chamberpressure", "ambientpressure", "totalpressure", "cabinpressure"],
    "flowCmS": ["flow", "flowspeed", "flowvelocity", "velocity", "airflow", "airspeed", "u", "uinf", "freestream",
                "flowrate_cms", "ventilation", "coflowvelocity", "coflow"],
    "gravityG": ["gravity", "g", "glevel", "gravitylevel", "accel", "acceleration"],
    "fuel": ["fuel", "material", "sample", "samplematerial", "fueltype", "fuelname"],
    "diluent": ["diluent", "inert", "suppressant", "dilutent", "inertgas"],
    "outcome": ["outcome", "result", "burn", "burned", "ignition", "ignited", "extinction", "extinguished",
                "status", "flammable", "sustained"],
}

OUTCOME_MAP = {
    "burned": ["burn", "burned", "burnt", "yes", "y", "1", "true", "sustained", "spread", "flammable", "ignited", "go", "pass"],
    "extinguished": ["extinguished", "extinction", "ext", "quenched", "blowoff", "blowout", "selfextinguished", "out"],
    "no-ignition": ["noignition", "noburn", "no", "n", "0", "false", "nonflammable", "nogo", "fail", "didnotignite", "noign"],
}


@dataclass
class IngestReport:
    file: str
    kind: str
    records: int = 0
    investigations: list[str] = field(default_factory=list)
    mapping: dict[str, str] = field(default_factory=dict)
    conversions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    unmapped: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class ParsedFile:
    report: IngestReport
    tests: list[TestRecord] = field(default_factory=list)
    investigations: list[dict] = field(default_factory=list)
    relations: list[dict] = field(default_factory=list)
    text: str = ""
    doc_investigation: Optional[str] = None


# ---- helpers ---------------------------------------------------------------------------------

def match_investigation(text: str, known_ids: list[str]) -> Optional[str]:
    """Longest known id whose normalized form appears in the text (BASS-II beats BASS)."""
    t = norm(text)
    alias = {norm(k): k for k in known_ids}
    # common written variants
    for k in known_ids:
        alias.setdefault(norm(k.replace("-II", "2").replace("-III", "3").replace("-I", "1")), k)
        alias.setdefault(norm(k.replace("ACME-", "")), k)
    best = None
    for a, k in alias.items():
        if len(a) >= 3 and a in t and (best is None or len(a) > len(norm(best[0]))):
            best = (a, k)
    return best[1] if best else None


def to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if not s or s.lower() in {"na", "n/a", "nan", "none", "-", "--", "null"}:
        return None
    m = re.match(r"^[<>~≈]?\s*(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)", s)
    return float(m.group(1)) if m else None


def norm_outcome(v: Any) -> Optional[str]:
    if v is None or str(v).strip() == "":
        return None
    s = norm(str(v))
    for outcome, keys in OUTCOME_MAP.items():
        if s in keys:
            return outcome
    for outcome, keys in OUTCOME_MAP.items():
        if any(len(k) > 3 and k in s for k in keys):
            return outcome
    return "unknown"


def _unit_hint(header: str) -> str:
    h = header.lower()
    m = re.search(r"[\(\[]([^\)\]]+)[\)\]]", h)
    unit = m.group(1) if m else h
    return unit.replace(" ", "")


FUZZY_SKIP = {"test", "case", "point", "sample", "status", "result"}


def _reject(fld: str, nh: str, unit: str) -> bool:
    """Guard fuzzy matches that would be physically wrong (e.g. fuel flow rate ≠ air flow speed)."""
    if fld == "flowCmS":
        return "fuel" in nh or any(u in unit for u in ("sccm", "slpm", "lpm", "mg/s", "g/s", "kg"))
    if fld == "o2Pct":
        return any(x in nh for x in ("flow", "rate", "partial", "pressure"))
    if fld == "pressureKpa":
        return "partial" in nh and "o2" not in nh
    return False


def map_columns(headers: list[str]) -> dict[str, str]:
    """field -> header. Exact synonym match first, then prefix/contains match."""
    mapping: dict[str, str] = {}
    used: set[str] = set()
    normed = {h: norm(re.sub(r"[\(\[].*?[\)\]]", "", h)) for h in headers}
    for exact in (True, False):
        for fld, pats in FIELD_PATTERNS.items():
            if fld in mapping:
                continue
            fuzzy = [p for p in pats if len(p) >= 4 and p not in FUZZY_SKIP]
            for h in headers:
                if h in used:
                    continue
                nh = normed[h]
                if not exact and _reject(fld, nh, _unit_hint(h)):
                    continue
                hit = nh in pats if exact else any(nh.startswith(p) or p in nh for p in fuzzy)
                if hit:
                    mapping[fld] = h
                    used.add(h)
                    break
    return mapping


def convert(fld: str, header: str, values: list[Optional[float]], report: IngestReport) -> list[Optional[float]]:
    unit = _unit_hint(header)
    nums = [v for v in values if v is not None]
    if fld == "o2Pct":
        if nums and max(nums) <= 1.0 and "%" not in unit and "pct" not in unit and "percent" not in unit:
            report.conversions.append(f"{header}: mole fraction ×100 → %")
            return [None if v is None else v * 100 for v in values]
        return values
    if fld == "pressureKpa":
        factor, label = 1.0, None
        if "psi" in unit:
            factor, label = 6.89476, "psia → kPa"
        elif "atm" in unit:
            factor, label = 101.325, "atm → kPa"
        elif "mbar" in unit or "hpa" in unit:
            factor, label = 0.1, "mbar → kPa"
        elif "bar" in unit:
            factor, label = 100.0, "bar → kPa"
        elif "mpa" in unit:
            factor, label = 1000.0, "MPa → kPa"
        elif "torr" in unit or "mmhg" in unit:
            factor, label = 0.133322, "torr → kPa"
        elif re.search(r"(^|[^k])pa($|[^a-z])", unit):
            factor, label = 0.001, "Pa → kPa"
        elif nums and max(nums) <= 5:
            factor, label = 101.325, "values ≤ 5 assumed atm → kPa"
        if label:
            report.conversions.append(f"{header}: {label}")
        return [None if v is None else v * factor for v in values]
    if fld == "flowCmS":
        factor, label = 1.0, None
        if "mm/s" in unit or "mms" == norm(unit):
            factor, label = 0.1, "mm/s → cm/s"
        elif "m/s" in unit and "cm/s" not in unit and "mm/s" not in unit:
            factor, label = 100.0, "m/s → cm/s"
        if label:
            report.conversions.append(f"{header}: {label}")
        return [None if v is None else v * factor for v in values]
    return values


# ---- tabular ---------------------------------------------------------------------------------

def read_table(name: str, data: bytes) -> tuple[list[str], list[dict]]:
    ext = Path(name).suffix.lower()
    if ext == ".xlsx":
        try:
            import openpyxl
        except ImportError as e:  # pragma: no cover
            raise ValueError("Reading .xlsx needs openpyxl (pip install openpyxl) or export to CSV.") from e
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb.worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        # header = first row with >= 2 non-empty text cells
        hi = next((i for i, r in enumerate(rows) if sum(1 for c in r if isinstance(c, str) and c.strip()) >= 2), 0)
        headers = [str(c).strip() if c is not None else f"col{j}" for j, c in enumerate(rows[hi])]
        body = [dict(zip(headers, r)) for r in rows[hi + 1:] if any(c not in (None, "") for c in r)]
        return headers, body
    text = data.decode("utf-8-sig", errors="replace")
    lines = [ln for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    if not lines:
        return [], []
    sample = "\n".join(lines[:20])
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
    except csv.Error:
        dialect = csv.excel_tab if ext == ".tsv" else csv.excel
    reader = csv.DictReader(io.StringIO("\n".join(lines)), dialect=dialect)
    headers = [h.strip() for h in (reader.fieldnames or [])]
    reader.fieldnames = headers
    return headers, [r for r in reader]


def parse_tests(name: str, data: bytes, known_ids: list[str], default_inv: Optional[str] = None) -> ParsedFile:
    rep = IngestReport(file=name, kind="tests")
    headers, rows = read_table(name, data)
    if not rows:
        rep.warnings.append("No data rows found.")
        return ParsedFile(report=rep)
    mapping = map_columns(headers)
    rep.mapping = mapping
    file_inv = default_inv or match_investigation(Path(name).stem, known_ids)

    if "investigationId" not in mapping and not file_inv:
        rep.warnings.append("Could not tell which investigation this file belongs to. Add an 'investigation' column, "
                            "name the file after it (e.g. BASS-II_tests.csv) or choose one on upload. Records were "
                            "filed under 'UNASSIGNED'.")
    if not any(k in mapping for k in ("o2Pct", "pressureKpa", "flowCmS")):
        rep.warnings.append("No O₂ / pressure / flow column recognized. Records are kept but cannot be placed on the coverage map.")

    numeric = {}
    for fld in ("o2Pct", "pressureKpa", "flowCmS", "gravityG"):
        if fld in mapping:
            numeric[fld] = convert(fld, mapping[fld], [to_float(r.get(mapping[fld])) for r in rows], rep)

    mapped_headers = set(mapping.values())
    # first unmapped mostly-numeric column becomes the primary metric
    metric_header = None
    for h in headers:
        if h in mapped_headers:
            continue
        vals = [to_float(r.get(h)) for r in rows]
        if sum(v is not None for v in vals) >= max(1, len(rows) // 2):
            metric_header = h
            break
    rep.unmapped = [h for h in headers if h not in mapped_headers]

    stem = norm(Path(name).stem)[:24] or "file"
    tests: list[TestRecord] = []
    for i, r in enumerate(rows):
        inv = None
        if "investigationId" in mapping and r.get(mapping["investigationId"]):
            raw_inv = str(r.get(mapping["investigationId"]))
            inv = match_investigation(raw_inv, known_ids) or raw_inv.strip()
        inv = inv or file_inv or "UNASSIGNED"
        rid = str(r.get(mapping["id"])).strip() if "id" in mapping and r.get(mapping["id"]) not in (None, "") else str(i + 1)
        o2 = numeric.get("o2Pct", [None] * len(rows))[i]
        if o2 is not None and not (0 <= o2 <= 100):
            rep.warnings.append(f"Row {i + 1}: O₂ {o2:g} outside 0–100 %, ignored.")
            o2 = None
        tests.append(TestRecord(
            id=f"{inv}:{stem}:{rid}",
            investigationId=inv,
            o2Pct=None if o2 is None else round(o2, 3),
            pressureKpa=_r(numeric.get("pressureKpa", [None] * len(rows))[i]),
            flowCmS=_r(numeric.get("flowCmS", [None] * len(rows))[i]),
            gravityG=_r(numeric.get("gravityG", [None] * len(rows))[i]),
            fuel=_s(r.get(mapping["fuel"])) if "fuel" in mapping else None,
            diluent=_s(r.get(mapping["diluent"])) if "diluent" in mapping else None,
            outcome=norm_outcome(r.get(mapping["outcome"])) if "outcome" in mapping else None,
            metricName=metric_header,
            metricValue=to_float(r.get(metric_header)) if metric_header else None,
            source=name,
            raw={k: (v if isinstance(v, (int, float)) or v is None else str(v)) for k, v in r.items()},
        ))
    rep.records = len(tests)
    rep.investigations = sorted({t.investigationId for t in tests})
    unknown = [x for x in rep.investigations if x not in known_ids]
    if unknown:
        rep.warnings.append(f"Investigation id(s) not in the catalog: {', '.join(unknown)}. They are kept; add metadata JSON to describe them.")
    rep.warnings = rep.warnings[:25]
    return ParsedFile(report=rep, tests=tests)


def _r(v: Optional[float]) -> Optional[float]:
    return None if v is None else round(v, 4)


def _s(v: Any) -> Optional[str]:
    return None if v is None or str(v).strip() == "" else str(v).strip()


# ---- json ------------------------------------------------------------------------------------

INV_KEYS = {"objective", "fuelPhase", "fuels", "facility", "apparatus", "pillars", "conditions", "geometry"}


def parse_json(name: str, data: bytes, known_ids: list[str], default_inv: Optional[str] = None) -> ParsedFile:
    rep = IngestReport(file=name, kind="json")
    try:
        obj = json.loads(data.decode("utf-8-sig"))
    except json.JSONDecodeError as e:
        rep.warnings.append(f"Invalid JSON: {e}")
        return ParsedFile(report=rep)
    out = ParsedFile(report=rep)
    invs, tests_rows = [], []
    if isinstance(obj, dict):
        invs = obj.get("investigations", []) or ([obj] if "id" in obj and INV_KEYS & obj.keys() else [])
        tests_rows = obj.get("tests", []) or obj.get("records", [])
        out.relations = obj.get("relations", [])
    elif isinstance(obj, list):
        if obj and isinstance(obj[0], dict) and INV_KEYS & obj[0].keys():
            invs = obj
        else:
            tests_rows = obj
    for raw in invs:
        try:
            Investigation.model_validate({"name": raw.get("id", "?"), **raw})
            out.investigations.append(raw)
        except Exception as e:  # noqa: BLE001
            rep.warnings.append(f"Investigation {raw.get('id')}: {e}".splitlines()[0][:200])
    if tests_rows:
        headers = sorted({k for r in tests_rows if isinstance(r, dict) for k in r})
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=headers)
        w.writeheader()
        for r in tests_rows:
            if isinstance(r, dict):
                w.writerow({k: v for k, v in r.items()})
        sub = parse_tests(Path(name).with_suffix(".csv").name, buf.getvalue().encode(), known_ids, default_inv)
        out.tests = [t.model_copy(update={"source": name}) for t in sub.tests]
        rep.mapping, rep.conversions, rep.unmapped = sub.report.mapping, sub.report.conversions, sub.report.unmapped
        rep.warnings += sub.report.warnings
    rep.kind = "investigations+tests" if invs and tests_rows else ("investigations" if invs else "tests")
    rep.records = len(out.investigations) + len(out.tests)
    rep.investigations = sorted({i.get("id") for i in out.investigations} | {t.investigationId for t in out.tests})
    return out


# ---- documents -------------------------------------------------------------------------------

def parse_document(name: str, data: bytes, known_ids: list[str], default_inv: Optional[str] = None) -> ParsedFile:
    rep = IngestReport(file=name, kind="document")
    ext = Path(name).suffix.lower()
    text = ""
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception as e:  # noqa: BLE001
            rep.warnings.append(f"Could not read PDF: {e}")
    else:
        text = data.decode("utf-8", errors="replace")
    text = re.sub(r"[ \t]+", " ", text).strip()
    if not text:
        rep.warnings.append("No extractable text (scanned PDF?).")
    inv = default_inv or match_investigation(Path(name).stem, known_ids) or match_investigation(text[:4000], known_ids)
    rep.records = len(chunk_text(text))
    rep.investigations = [inv] if inv else []
    return ParsedFile(report=rep, text=text, doc_investigation=inv)


def chunk_text(text: str, size: int = 900, overlap: int = 150) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n|(?<=[.!?])\s+(?=[A-Z])", text) if p.strip()]
    chunks, cur = [], ""
    for p in paras:
        if len(cur) + len(p) + 1 <= size:
            cur = f"{cur} {p}".strip()
        else:
            if cur:
                chunks.append(cur)
            cur = (cur[-overlap:] + " " + p).strip() if cur else p
            while len(cur) > size * 1.5:
                chunks.append(cur[:size])
                cur = cur[size - overlap:]
    if cur:
        chunks.append(cur)
    return chunks


def parse_file(name: str, data: bytes, known_ids: list[str], default_inv: Optional[str] = None) -> ParsedFile:
    ext = Path(name).suffix.lower()
    if ext not in SUPPORTED_EXT:
        rep = IngestReport(file=name, kind="unsupported", warnings=[f"Unsupported file type '{ext}'. Use CSV, TSV, XLSX, JSON, PDF, TXT or MD."])
        return ParsedFile(report=rep)
    if ext in TEST_EXT:
        try:
            return parse_tests(name, data, known_ids, default_inv)
        except ValueError as e:
            return ParsedFile(report=IngestReport(file=name, kind="tests", warnings=[str(e)]))
    if ext == ".json":
        return parse_json(name, data, known_ids, default_inv)
    return parse_document(name, data, known_ids, default_inv)
