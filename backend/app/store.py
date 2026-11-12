"""Storage & retrieval.

Source of truth = files, so every result can be traced back to an original PSI file:
  data/seed/investigations.json   curated investigation catalog (no test data)
  data/psi/**                     drop-in folder for official PSI files (read at startup)
  data/imported/                  files uploaded through the Data Lab (+ _manifest.json)

On every (re)load, the parsed dataset is indexed for retrieval:
  * DATABASE_URL set  -> synced into PostgreSQL; chunk search uses pgvector (cosine distance)
  * otherwise         -> in-memory index (same embeddings, same results)
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
from copy import deepcopy
from pathlib import Path
from typing import Optional

from . import embed
from .ingest import SUPPORTED_EXT, chunk_text, parse_file
from .models import DataSource, Dataset, Investigation, Relation, Spinoff, TestRecord

log = logging.getLogger("flameprint.store")
SCHEMA_SQL = Path(__file__).with_name("schema.sql")
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _deep_merge(base: dict, over: dict) -> dict:
    out = deepcopy(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        elif v is not None:
            out[k] = v
    return out


def safe_name(name: str) -> str:
    base = Path(name).name
    base = re.sub(r"[^A-Za-z0-9._ -]", "_", base).strip(" .")
    return base[:120] or "upload"


def card_text(inv: Investigation) -> str:
    ins = " ".join(f"{k}: {v}" for k, v in inv.insights.items())
    return (f"{inv.id} {inv.name}. Objective: {inv.objective} Fuels: {', '.join(inv.fuels)} ({', '.join(inv.fuelPhase) or 'none'}). "
            f"Geometry: {inv.geometry}. Hardware: {inv.facility} {inv.apparatus or ''}. Diluents: {', '.join(inv.diluents)}. "
            f"Measurements: {', '.join(inv.measurements)}. {ins} Earth: {', '.join(inv.earthApplications)}")


class Store:
    def __init__(self, root: Path, database_url: Optional[str] = None):
        self.root = root
        self.seed_path = root / "seed" / "investigations.json"
        self.psi_dir = root / "psi"
        self.upload_dir = root / "imported"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.psi_dir.mkdir(parents=True, exist_ok=True)
        self.database_url = database_url
        self._lock = threading.RLock()
        self._ds: Optional[Dataset] = None
        self._chunks: list[dict] = []
        self._reports: list[dict] = []
        self.db_status = {"backend": "files", "ok": True, "detail": "In-memory index (set DATABASE_URL for PostgreSQL + pgvector)."}
        self.loaded_at = 0.0

    # ---------------------------------------------------------------- manifest
    @property
    def manifest_path(self) -> Path:
        return self.upload_dir / "_manifest.json"

    def _manifest(self) -> dict:
        try:
            return json.loads(self.manifest_path.read_text("utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _write_manifest(self, m: dict) -> None:
        self.manifest_path.write_text(json.dumps(m, indent=2), "utf-8")

    # ---------------------------------------------------------------- loading
    def invalidate(self) -> None:
        with self._lock:
            self._ds = None

    @property
    def dataset(self) -> Dataset:
        with self._lock:
            if self._ds is None:
                self._load()
            return self._ds  # type: ignore[return-value]

    @property
    def reports(self) -> list[dict]:
        _ = self.dataset
        return self._reports

    def _files(self) -> list[tuple[Path, str]]:
        out = []
        for base, origin in ((self.psi_dir, "server"), (self.upload_dir, "upload")):
            for p in sorted(base.rglob("*")):
                if p.is_file() and p.suffix.lower() in SUPPORTED_EXT and not p.name.startswith("_") \
                        and p.name.lower() != "readme.md":
                    out.append((p, origin))
        return out

    def _load(self) -> None:
        t0 = time.time()
        seed = json.loads(self.seed_path.read_text("utf-8"))
        inv_by_id: dict[str, dict] = {i["id"]: i for i in seed["investigations"]}
        relations = list(seed.get("relations", []))
        sources = [DataSource(name="seed/investigations.json", origin="seed", kind="investigations",
                              count=len(inv_by_id))]
        manifest = self._manifest()
        tests: list[TestRecord] = []
        docs: list[tuple[str, str, Optional[str]]] = []
        reports = []
        known = list(inv_by_id)

        files = self._files()
        # metadata first so test files can resolve newly described investigations
        files.sort(key=lambda f: 0 if f[0].suffix.lower() == ".json" else 1)
        for path, origin in files:
            rel = path.relative_to(self.root).as_posix()
            default_inv = manifest.get(path.name, {}).get("investigationId") if origin == "upload" else None
            try:
                parsed = parse_file(path.name, path.read_bytes(), known, default_inv)
            except Exception as e:  # noqa: BLE001 - one bad file must never break the app
                log.exception("Failed to parse %s", rel)
                reports.append({"file": rel, "kind": "error", "records": 0, "warnings": [str(e)], "origin": origin})
                continue
            for raw in parsed.investigations:
                iid = raw["id"]
                inv_by_id[iid] = _deep_merge(inv_by_id.get(iid, {"name": iid, "provenance": f"Imported from {path.name}"}), raw)
                if iid not in known:
                    known.append(iid)
            relations += parsed.relations
            tests += parsed.tests
            if parsed.text:
                docs.append((rel, parsed.text, parsed.doc_investigation))
            r = parsed.report.to_dict() | {"file": rel, "origin": origin}
            reports.append(r)
            kind = "document" if parsed.text else ("tests" if parsed.tests else "investigations")
            sources.append(DataSource(name=rel, origin=origin, kind=kind, count=parsed.report.records,
                                      warnings=parsed.report.warnings[:5]))

        # ids must be unique even if the same test appears in two files
        seen: dict[str, int] = {}
        for i, t in enumerate(tests):
            n = seen.get(t.id, 0)
            seen[t.id] = n + 1
            if n:
                tests[i] = t.model_copy(update={"id": f"{t.id}#{n}"})

        investigations = []
        for raw in inv_by_id.values():
            try:
                investigations.append(Investigation.model_validate(raw))
            except Exception as e:  # noqa: BLE001
                reports.append({"file": "metadata", "kind": "error", "records": 0, "warnings": [f"{raw.get('id')}: {e}"[:300]]})
        # tests referencing ids with no metadata get a minimal, clearly-labelled stub
        for iid in sorted({t.investigationId for t in tests} - {i.id for i in investigations}):
            investigations.append(Investigation(id=iid, name=iid, objective="Imported test data without catalog metadata.",
                                                provenance="Imported test file (no metadata)"))

        ds = Dataset(investigations=investigations, tests=tests,
                     relations=[Relation.model_validate(r) for r in relations],
                     spinoffs=[Spinoff.model_validate(s) for s in seed.get("earthSpinoffs", [])],
                     sources=sources)

        chunks = [{"id": f"card:{i.id}", "investigationId": i.id, "source": "catalog", "kind": "card",
                   "text": card_text(i)} for i in investigations]
        for rel, text, inv in docs:
            for n, c in enumerate(chunk_text(text)):
                chunks.append({"id": f"doc:{rel}:{n}", "investigationId": inv, "source": rel, "kind": "document", "text": c})
        for c in chunks:
            c["embedding"] = embed.embed(c["text"])

        self._ds, self._chunks, self._reports = ds, chunks, reports
        self.loaded_at = time.time()
        if self.database_url:
            self._sync_postgres(ds, chunks)
        log.info("Loaded %d investigations, %d tests, %d chunks in %.0f ms",
                 len(investigations), len(tests), len(chunks), (time.time() - t0) * 1000)

    # ---------------------------------------------------------------- postgres
    def _connect(self):
        import psycopg  # imported lazily: optional dependency path
        return psycopg.connect(self.database_url, connect_timeout=3)

    def _sync_postgres(self, ds: Dataset, chunks: list[dict]) -> None:
        try:
            with self._connect() as conn, conn.cursor() as cur:
                cur.execute(SCHEMA_SQL.read_text("utf-8"))
                cur.execute("TRUNCATE doc_chunks, test_records, investigations")
                cur.executemany(
                    "INSERT INTO investigations (id, name, facility, apparatus, fuel_phase, status, data) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    [(i.id, i.name, i.facility, i.apparatus, i.fuelPhase, i.status, json.dumps(i.model_dump())) for i in ds.investigations])
                cur.executemany(
                    "INSERT INTO test_records (id, investigation_id, o2_pct, pressure_kpa, flow_cm_s, gravity_g, fuel, diluent, outcome, metric_name, metric_value, source, raw) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    [(t.id, t.investigationId, t.o2Pct, t.pressureKpa, t.flowCmS, t.gravityG, t.fuel, t.diluent, t.outcome,
                      t.metricName, t.metricValue, t.source, json.dumps(t.raw, default=str)) for t in ds.tests])
                cur.executemany(
                    "INSERT INTO doc_chunks (id, investigation_id, source, kind, text, embedding) VALUES (%s,%s,%s,%s,%s,%s::vector)",
                    [(c["id"], c["investigationId"], c["source"], c["kind"], c["text"], _vec(c["embedding"])) for c in chunks])
                conn.commit()
            self.db_status = {"backend": "postgres", "ok": True,
                              "detail": f"PostgreSQL + pgvector: {len(ds.investigations)} investigations, {len(ds.tests)} tests, {len(chunks)} chunks."}
        except Exception as e:  # noqa: BLE001
            log.warning("PostgreSQL sync failed, using in-memory index: %s", e)
            self.db_status = {"backend": "files", "ok": False,
                              "detail": f"DATABASE_URL set but unreachable ({type(e).__name__}); using in-memory index."}

    # ---------------------------------------------------------------- retrieval
    def search(self, query: str, k: int = 8, investigation_ids: Optional[list[str]] = None) -> list[dict]:
        _ = self.dataset
        q = embed.embed(query)
        if self.db_status["backend"] == "postgres" and self.db_status["ok"]:
            try:
                with self._connect() as conn, conn.cursor() as cur:
                    sql = "SELECT id, investigation_id, source, kind, text, 1 - (embedding <=> %s::vector) AS score FROM doc_chunks"
                    args: list = [_vec(q)]
                    if investigation_ids:
                        sql += " WHERE investigation_id = ANY(%s)"
                        args.append(investigation_ids)
                    sql += " ORDER BY embedding <=> %s::vector LIMIT %s"
                    args += [_vec(q), k]
                    cur.execute(sql, args)
                    return [{"id": r[0], "investigationId": r[1], "source": r[2], "kind": r[3], "text": r[4],
                             "score": round(float(r[5]), 4)} for r in cur.fetchall()]
            except Exception as e:  # noqa: BLE001
                log.warning("pgvector search failed, falling back to memory: %s", e)
        pool = [c for c in self._chunks if not investigation_ids or c["investigationId"] in investigation_ids]
        # lexical bonus for exact id mentions keeps "BASS-II" queries precise
        qn = query.lower()
        scored = []
        for c in pool:
            s = embed.cosine(q, c["embedding"])
            if c["investigationId"] and c["investigationId"].lower() in qn:
                s += 0.25
            scored.append((s, c))
        scored.sort(key=lambda x: -x[0])
        return [{k_: v for k_, v in c.items() if k_ != "embedding"} | {"score": round(s, 4)} for s, c in scored[:k]]

    # ---------------------------------------------------------------- uploads
    def save_upload(self, name: str, data: bytes, investigation_id: Optional[str] = None) -> dict:
        if len(data) > MAX_UPLOAD_BYTES:
            raise ValueError(f"File too large ({len(data) // 1024} KB). Limit is {MAX_UPLOAD_BYTES // 1024 // 1024} MB.")
        fname = safe_name(name)
        if Path(fname).suffix.lower() not in SUPPORTED_EXT:
            raise ValueError(f"Unsupported file type. Use: {', '.join(sorted(SUPPORTED_EXT))}")
        known = [i.id for i in self.dataset.investigations]
        preview = parse_file(fname, data, known, investigation_id)  # validate before saving
        with self._lock:
            (self.upload_dir / fname).write_bytes(data)
            m = self._manifest()
            m[fname] = {"investigationId": investigation_id, "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%S")}
            self._write_manifest(m)
            self.invalidate()
        return preview.report.to_dict() | {"file": f"imported/{fname}", "origin": "upload"}

    def save_extracted(self, source_name: str, investigation: dict) -> str:
        fname = safe_name(Path(source_name).stem) + ".extracted.json"
        (self.upload_dir / fname).write_text(json.dumps({"investigations": [investigation]}, indent=2), "utf-8")
        self.invalidate()
        return fname

    def uploads(self) -> list[dict]:
        m = self._manifest()
        return [{"file": p.name, "bytes": p.stat().st_size, **m.get(p.name, {})}
                for p in sorted(self.upload_dir.iterdir()) if p.is_file() and not p.name.startswith(("_", "."))]

    def delete_upload(self, name: str) -> bool:
        p = self.upload_dir / safe_name(name)
        if not p.exists():
            return False
        with self._lock:
            p.unlink()
            m = self._manifest()
            m.pop(p.name, None)
            self._write_manifest(m)
            self.invalidate()
        return True

    def clear_uploads(self) -> int:
        n = 0
        with self._lock:
            for p in self.upload_dir.iterdir():
                if p.is_file() and not p.name.startswith("."):
                    p.unlink()
                    n += 1
            self.invalidate()
        return n


def _vec(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"
