-- FLAMEPRINT PostgreSQL schema (requires the pgvector extension).
-- Idempotent: executed by the backend on every data reload.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS investigations (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    facility    TEXT,
    apparatus   TEXT,
    fuel_phase  TEXT[] NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'in-psi',
    data        JSONB NOT NULL            -- full Investigation record (see app/models.py)
);

CREATE TABLE IF NOT EXISTS test_records (
    id               TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL,
    o2_pct           DOUBLE PRECISION,
    pressure_kpa     DOUBLE PRECISION,
    flow_cm_s        DOUBLE PRECISION,
    gravity_g        DOUBLE PRECISION,
    fuel             TEXT,
    diluent          TEXT,
    outcome          TEXT,
    metric_name      TEXT,
    metric_value     DOUBLE PRECISION,
    source           TEXT NOT NULL,        -- original PSI file: every point is citable
    raw              JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS test_records_inv_idx ON test_records (investigation_id);
CREATE INDEX IF NOT EXISTS test_records_cond_idx ON test_records (o2_pct, pressure_kpa, flow_cm_s);

CREATE TABLE IF NOT EXISTS doc_chunks (
    id               TEXT PRIMARY KEY,
    investigation_id TEXT,
    source           TEXT NOT NULL,
    kind             TEXT NOT NULL,        -- 'card' (catalog) | 'document' (PSI text/PDF)
    text             TEXT NOT NULL,
    embedding        vector(384) NOT NULL
);
CREATE INDEX IF NOT EXISTS doc_chunks_inv_idx ON doc_chunks (investigation_id);
