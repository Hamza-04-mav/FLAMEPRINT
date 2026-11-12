# 🔥 FLAMEPRINT

**Fire-safety insights from NASA microgravity combustion data, starting from the mission instead of the database.**
NASA Space Apps Challenge 2026 · *Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data*

> Choose where your crew will live: a Moon base, a pressurized rover, Mars or the ISS. FLAMEPRINT ranks every PSI combustion
> investigation for that atmosphere, shows exactly why each one ranks where it does, maps where the evidence stops, and writes a
> Prevention / Detection / Suppression brief in which every claim is cited.

---

## The problem

NASA's Physical Sciences Informatics (PSI) archive holds decades of microgravity combustion results (BASS, Saffire, FLEX,
CFI, ACME, SAME…). The archive is **hard to find in, harder to compare across, and hardest to interpret** for a specific
habitat. Meanwhile the Moon base will run at **≥30 % O₂ and ≤10.2 psi**, more than 40 % above Earth's oxygen concentration, at a
gravity level where **PSI has no data at all**.

## What FLAMEPRINT does

| Challenge objective | FLAMEPRINT feature |
|---|---|
| Identify investigations most relevant to crewed habitats | **Mission scenario builder** (presets for ISS, Moon Base, rover, Mars, suit and Earth, or custom O₂ / pressure / flow / gravity / fuels / safety focus) → **explainable ranking**. Every score breaks into 6 factors with plain-English reasons, and the weights are live sliders. |
| Summarize, rank, interpret | **SI brief** (Claude, streamed) built only from a deterministic evidence packet. Citations are verified against that packet, and the brief says "Insufficient evidence" rather than guessing. Works offline through a deterministic writer. |
| Extract data for predictive modeling | **Data Lab**: drop in PSI CSV/XLSX/JSON/PDF. Columns are mapped automatically with unit conversion, condition envelopes are derived from test records, and a **model-ready CSV export** joins tests with investigation metadata. |
| Compare similarities and differences | **Investigation genome**: a hardware lineage graph (CIR → MDCA → FLEX/FLEX-2/CFI, MSG → SPICE duct → BASS/BASS-II/SLICE, SAME → DAFT shared instrument) plus a side-by-side diff of any two investigations. |
| Find where knowledge stops | **Evidence-gap detector** and **3D condition-space map** (O₂ × pressure × flow) with the mission beacon. Flags critical gaps such as *"No 0.17 g data in PSI"* and *"Solids untested above 21 % O₂ in μg"*. |
| Next-gen controls & equipment | Brief sections for prevention, detection (including cool flames with no visible flame, and dust as a false-alarm source) and suppression (CO₂/He dilution). |
| Partial gravity | Gravity flame morph (GLSL shader + particles: 1 g, your mission, 0 g) with a **bracketed, unmeasured partial-g** note, plus the E-FIELD proxy and LUCI / FM2 shown as expected investigations. |
| Down to Earth | Water-mist extinguishers, smoke detection, firefighter gear, material screening, cleaner combustion and fire safety in confined spaces, each linked to the investigations behind it and labelled by source (challenge brief vs. inference). |
| Ask questions | **Ask the archive**: vector retrieval (pgvector or in-memory) over catalog cards and imported PSI documents, with cited answers. |

## Scientific integrity (read this before the demo)

* **No fabricated data.** The seed catalog (`data/seed/investigations.json`) holds only investigation-level metadata from the
  challenge brief and public NASA summaries. **It contains zero test-level measurements.** Test points appear only when
  you import real PSI files.
* Condition envelopes are labelled **`approx`** (coarse catalog ranges to verify), **`PSI data`** (derived from imported
  test records) or **`unknown`**. The UI shows that label everywhere it uses an envelope.
* The flame shader and the U-shaped limiting-O₂ curve are labelled **illustrative / schematic**. Buoyant flow ∝ √g is labelled
  an **order-of-magnitude estimate**.
* Ranking and gaps are **deterministic code**. The LLM never decides a number; it only words the evidence it is given, and
  every citation it writes is checked.

---

## Architecture

```
┌──────────────── frontend/ · Next.js 15 · TypeScript · Tailwind v4 ────────────────┐
│ Framer Motion UI · React Three Fiber (3D condition space + GLSL flame) · SVG genome│
│ /api/* proxied to FastAPI (single origin; SSE streaming passes through)           │
└──────────────────────────────────────▲─────────────────────────────────────────────┘
                                       │ REST + Server-Sent Events
┌──────────────────────────────────────┴─────────────────────────────────────────────┐
│ backend/ · FastAPI (Python)                                                         │
│  engine.py   ranking · envelopes · coverage & gaps · genome · compare  (deterministic)│
│  physics.py  ppO₂ · buoyant flow √g · flow regimes (labelled estimates)             │
│  ingest.py   CSV/TSV/XLSX/JSON/PDF/TXT → normalized records (mapping + unit conv.)  │
│  store.py    files = source of truth → index → PostgreSQL+pgvector or in-memory     │
│  brief.py    evidence packet · offline writer · citation audit                      │
│  llm.py      Claude (claude-opus-5-5) streaming + server-side refusal fallbacks,    │
│              structured extraction (messages.parse → pydantic schema)               │
└──────────────────────────────────────▲─────────────────────────────────────────────┘
                                       │
          data/seed (catalog) · data/psi (official PSI drop-in) · data/imported (uploads)
          optional: docker compose → PostgreSQL 16 + pgvector (schema in backend/app/schema.sql)
```

**Graceful degradation:** no API key → deterministic brief and extractive answers. No database → in-memory vector index.
No PSI files → catalog envelopes, clearly labelled. Every feature still works.

---

## Quick start

**Requirements:** Node 18+ (tested on 24), Python 3.10+ (tested on 3.14). Docker is optional.

### One command

```powershell
.\start.ps1          # Windows
```
```bash
./start.sh           # macOS / Linux / Git Bash
```
On first run it creates the venv, installs dependencies and copies `backend/.env.example` → `backend/.env`. Then open **http://localhost:3000**.

### Manual

```bash
# backend
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # (cp on macOS/Linux) then edit as needed
uvicorn app.main:app --port 8000 --reload

# frontend (new terminal)
cd frontend
npm install
npm run dev                       # http://localhost:3000
```

API docs (Swagger): **http://127.0.0.1:8000/docs**

---

## Configuration (`backend/.env`)

| Variable | Needed for | What to provide |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude-written briefs, synthesized Q&A, PDF → metadata extraction | A key from console.anthropic.com. Without it, the deterministic writer is used. |
| `FLAMEPRINT_MODEL` | optional | Default `claude-opus-5-5` |
| `FLAMEPRINT_EFFORT` | optional | `low` / `medium` (default) / `high` |
| `DATABASE_URL` | PostgreSQL + pgvector | e.g. `postgresql://flameprint:flameprint@localhost:5432/flameprint` after `docker compose up -d db` |
| `FLAMEPRINT_LLM` | optional | `auto` (default) · `on` · `off` |

Briefs are requested with the server-side refusal-fallback beta (`fallbacks: "default"`). If an account doesn't support it,
the backend automatically retries without it.

---

## Plugging in the official PSI dataset

1. Put the files in **`data/psi/`** (any subfolders), or upload them in the **Data Lab** tab.
2. Accepted formats:
   * **CSV / TSV / XLSX** test matrices. Columns are auto-mapped: O₂ (% or mole fraction), pressure (psia/atm/bar/Pa/torr →
     kPa), flow (mm/s, m/s → cm/s), gravity, fuel/material, diluent, outcome (burn / no ignition / extinguished…), test id.
     The first unmapped numeric column becomes the primary metric. Everything else is kept verbatim.
   * **JSON**: investigation metadata (overrides the seed by `id`), relations, and/or test rows. See `data/templates/`.
   * **PDF / TXT / MD**: indexed for retrieval. With an API key, **SI extract** turns a document into structured
     investigation metadata. It is saved as `*.extracted.json` and marked *unverified*.
3. To assign records to an investigation, use an `investigation` column, or name the file after it (`BASS-II_tests.csv`),
   or pick the investigation in the Data Lab.
4. Press **Reload data/psi** (or `POST /api/reload`). Envelopes switch to `PSI data`, test dots appear on the maps, and
   ranking, gaps and briefs update automatically.

The **Preview** step shows the column mapping, unit conversions and warnings before anything is saved.

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | DB / LLM / data status |
| GET | `/api/dataset` · `/api/habitats` | catalog, relations, spin-offs · mission presets |
| POST | `/api/analyze` | `{scenario, weights}` → ranking + coverage + gaps + physics readout |
| POST | `/api/brief` | SSE: `meta` → `delta`… → `citations` → `done` |
| POST | `/api/ask` | SSE answer with retrieved passages |
| GET | `/api/condition-space` · `/api/genome` · `/api/compare?a=&b=` | maps & comparisons |
| GET | `/api/investigations/{id}` | dossier + imported tests |
| POST | `/api/ingest/preview` · `/api/ingest` · `/api/extract` | Data Lab |
| GET | `/api/export/tests.csv` | model-ready dataset |
| DELETE | `/api/uploads/{name}` · `/api/uploads` | remove uploads |

---

## Tests

```bash
cd backend  && .venv\Scripts\python -m pytest -q     # 28 tests: engine, ingestion, API, SSE, citations
cd frontend && npm test                               # vitest: SSE parser, formatting
cd frontend && npm run typecheck && npm run lint && npm run build
```

---

## 3-minute demo script

1. **Hook (0:00).** Mission Control opens on the 3D lunar base under an Earth-rise. Drag the **gravity** slider in the flame card: the mission flame morphs between the 1 g teardrop and the 0 g blue sphere. *"Fire behaves differently up there."*
2. **Pain (0:25).** Pick **Moon Base** in the mission bar. Coverage reads ~27 %, critical uncertainty *High*, and the gap cards say *no partial-g data* and *solids untested above 21 % O₂*.
3. **Where the knowledge stops (0:50).** **Explore Mission** opens the **Coverage Map**. The beacon sits inside a hatched data-gap volume: "No PSI envelope covers this point". Click a region to inspect it.
4. **Explainability (1:15).** In **Investigation Rankings**, drag the *Safety focus* weight. The leaderboard re-orders, and you can expand any row to audit how its score is built.
5. **SI brief (1:45).** **Generate brief.** It streams into a numbered engineering document with evidence-strength meters, the audit shows every citation verified, and gaps say *Insufficient evidence*.
6. **Data-ready (2:20).** In the **Data Lab**, drop a PSI CSV. The column mapping and unit conversions appear, you import it, and the envelopes turn into `PSI data`.
7. **Close (2:45).** *"FLAMEPRINT tells engineers what we know, and what we don't, before the alarm goes off."*

**Judge Q&A, "what's real and what's mocked?"** Every number comes from deterministic code or imported PSI files. The catalog envelopes are labelled approximate. The shader is labelled illustrative. Nothing is mocked behind the scenes.

---

## Project structure

```
backend/app/        main.py · engine.py · physics.py · ingest.py · store.py · brief.py · llm.py · embed.py · models.py · schema.sql
backend/tests/      test_engine.py · test_ingest.py · test_api.py
frontend/src/app/   layout.tsx · page.tsx · globals.css
frontend/src/components/  Sidebar · Header (mission status bar) · MissionConfig (scenario sheet) · CosmicBackdrop · Boot · ui
                          Overview (Mission Control) · MissionScene3D · FlameMorph · CoveragePreview
                          SpaceView + ConditionSpace3D (Coverage Map) · FlammabilityMap · Ranking · BriefPanel · CitedMarkdown
                          Genome · EarthPanel · AskPanel · DataLab · InvestigationDrawer · ScenarioBuilder
frontend/src/lib/   api.ts (REST + SSE) · mission.tsx (state) · space.ts (condition-space math) · environment.ts · webgl.ts · types.ts · format.ts
data/seed/          curated investigation catalog (no test data)
data/psi/           ← drop official PSI files here
data/templates/     CSV + JSON import templates
docker-compose.yml  PostgreSQL 16 + pgvector
```

Deep links for demos: `?noboot` skips the intro · `#space`, `#ranking`, `#brief`, `#genome`, `#earth`, `#ask`, `#data` open a page ·
`?mission=mars` (or `iss`, `lunar-base`, `rover`, `suit`, `earth`) preselects a mission · `?generate#brief` issues the brief on arrival.

## Design system

One palette across every page: deep-space navy surfaces (`#030814` / `#071225` / `#0B1930`), primary blue `#087BFF` and cyan `#19C9FF`
for scientific intelligence, flame orange `#FF8B32` and amber `#FFC15B` for combustion, restrained green for verified or live states.
Tokens live in `frontend/src/app/globals.css`. 3D (React Three Fiber + GLSL) is used where it explains something: the mission environment
(lunar, Martian, orbital or Earth, chosen by the preset), the gravity flame, and the condition-space explorer. Expensive canvases load
lazily, pause when off screen, fall back to static visuals without WebGL, and motion respects `prefers-reduced-motion`.
