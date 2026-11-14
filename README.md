# 🔥 FLAMEPRINT

**Fire-safety insights from NASA microgravity combustion data, starting from the mission instead of the database.**
NASA Space Apps Challenge 2026 · _Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data_

> **New to the project?** Read [`CONTEXT.md`](CONTEXT.md) first: goal, status, architecture, rules and what's left.

> **Is my habitat safe from fire, and how sure are we?** Pick where your crew will live (ISS, Moon base, spacesuit, rover,
> Mars) and FLAMEPRINT answers on the first screen: which materials are high risk there, with an evidence grade from A to M
> that says how much NASA PSI data stands behind that answer. Then it shows what NASA should test next.

---

## The problem

NASA's Physical Sciences Informatics (PSI) archive holds decades of microgravity combustion results (BASS, Saffire, FLEX,
CFI, ACME, SAME…). The archive is **hard to find in, harder to compare across, and hardest to interpret** for a specific
habitat. Meanwhile the Moon base will run at **≥30 % O₂ and ≤10.2 psi**, more than 40 % above Earth's oxygen concentration, at a
gravity level where **PSI has no data at all**.

## What FLAMEPRINT does

### Five pages, one question each

| Page              | The one question it answers                                   | What judges see first                                                                                                                                                                                                                                                                                                                        | One click deeper                                                      |
| ----------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Answer** (home) | Is my habitat safe from fire, and how sure are we?            | Mission path with a play button (ISS → Moon base → Spacesuit → Rover → Mars), one verdict sentence (_"6 of 8 materials are high risk at the Moon base."_), a passport-stamp grade with its reason, the gravity flame (blue sphere at 0 g → teardrop at 1 g), the top 5 materials, a "Can I bring this aboard?" box and **Get Fire Passport** | Adjust conditions · all materials · habitat in 3D                     |
| **Evidence**      | Which NASA experiments back this up?                          | The top 5 PSI investigations: rank, one sentence of why, grade stamp                                                                                                                                                                                                                                                                         | Six factor bars + dossier per row · all 22 · Adjust scoring           |
| **Gaps**          | Where does NASA have no data, and what should be tested next? | One O₂ × airflow map: dark untested "void", softly lit tested ranges, the habitat as a glowing dot; top 3 gaps; top 3 next tests naming the planned investigation (LUCI, FM2)                                                                                                                                                                | Schematic curve, inspector, every-habitat list · Explore in 3D        |
| **Brief**         | What should engineers do?                                     | Prevention / Detection / Suppression cards, ≤3 bullets each with PSI citation chips; gaps say _Insufficient evidence_; citation audit                                                                                                                                                                                                        | Full streamed brief and audit · On Earth too                          |
| **Compare**       | What changes between two habitats?                            | ISS → Moon base: grade B → C, materials that moved risk level, new gaps                                                                                                                                                                                                                                                                      | Unchanged items · rank moves · Compare experiments (hardware lineage) |

**Evidence grades** (fixed colours): **A** imported PSI tests at these conditions · **B** one investigation tested this
atmosphere · **C** only bracketed (partial gravity caps everything at C) · **M** modeled. Tap a stamp to open the investigation behind it.

**Tools menu:** Can I bring this aboard? (full page) · Data Lab · Ask the archive · Down to Earth.
**Fire Passport** (`/passport?mission=lunar-base`): one printable light page. Before/after screenshots and the content budget: `docs/screens/`.

### Every challenge objective

| Challenge objective                                      | FLAMEPRINT feature                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identify investigations most relevant to crewed habitats | **Mission scenario builder** (presets for ISS, Moon Base, rover, Mars, suit and Earth, or custom O₂ / pressure / flow / gravity / fuels / safety focus) → **explainable ranking**. Every score breaks into 6 factors with plain-English reasons, and the weights are live sliders. |
| Summarize, rank, interpret                               | **SI brief** (Groq openai/gpt-oss-120b, streamed) built only from a deterministic evidence packet. Citations are verified against that packet, and the brief says "Insufficient evidence" rather than guessing. Works offline through a deterministic writer.                      |
| Extract data for predictive modeling                     | **Data Lab**: drop in PSI CSV/XLSX/JSON/PDF. Columns are mapped automatically with unit conversion, condition envelopes are derived from test records, and a **model-ready CSV export** joins tests with investigation metadata.                                                   |
| Compare similarities and differences                     | **Investigation genome**: a hardware lineage graph (CIR → MDCA → FLEX/FLEX-2/CFI, MSG → SPICE duct → BASS/BASS-II/SLICE, SAME → DAFT shared instrument) plus a side-by-side diff of any two investigations.                                                                        |
| Find where knowledge stops                               | **Evidence-gap detector** and **3D condition-space map** (O₂ × pressure × flow) with the mission beacon. Flags critical gaps such as _"No 0.17 g data in PSI"_ and _"Solids untested above 21 % O₂ in μg"_.                                                                        |
| Next-gen controls & equipment                            | Brief sections for prevention, detection (including cool flames with no visible flame, and dust as a false-alarm source) and suppression (CO₂/He dilution).                                                                                                                        |
| Partial gravity                                          | Gravity flame morph (GLSL shader + particles: 1 g, your mission, 0 g) with a **bracketed, unmeasured partial-g** note, plus the E-FIELD proxy and LUCI / FM2 shown as expected investigations.                                                                                     |
| Down to Earth                                            | Water-mist extinguishers, smoke detection, firefighter gear, material screening, cleaner combustion and fire safety in confined spaces, each linked to the investigations behind it and labelled by source (challenge brief vs. inference).                                        |
| Ask questions                                            | **Ask the archive**: vector retrieval (pgvector or in-memory) over catalog cards and imported PSI documents, with cited answers.                                                                                                                                                   |

## Scientific integrity (read this before the demo)

- **No fabricated data.** The seed catalog (`data/seed/investigations.json`) holds only investigation-level metadata from the
  challenge brief and public NASA summaries. **It contains zero test-level measurements.** Test points appear only when
  you import real PSI files.
- Condition envelopes are labelled **`approx`** (coarse catalog ranges to verify), **`PSI data`** (derived from imported
  test records) or **`unknown`**. The UI shows that label everywhere it uses an envelope.
- The flame shader and the U-shaped limiting-O₂ curve are labelled **illustrative / schematic**. Buoyant flow ∝ √g is labelled
  an **order-of-magnitude estimate**.
- Ranking and gaps are **deterministic code**. The LLM never decides a number; it only words the evidence it is given, and
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
│  llm.py      Groq (openai/gpt-oss-120b) streaming + deterministic fallback,     │
│              structured extraction (JSON mode → pydantic schema)                     │
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

| Variable           | Needed for                                                     | What to provide                                                                                     |
| ------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GROQ_API_KEY`     | LLM-written briefs, synthesized Q&A, PDF → metadata extraction | A key from console.groq.com. Without it, the deterministic writer is used.                          |
| `FLAMEPRINT_MODEL` | optional                                                       | Default `openai/gpt-oss-120b` (Groq)                                                                |
| `DATABASE_URL`     | PostgreSQL + pgvector                                          | e.g. `postgresql://flameprint:flameprint@localhost:5432/flameprint` after `docker compose up -d db` |
| `FLAMEPRINT_LLM`   | optional                                                       | `auto` (default) · `on` · `off`                                                                     |

Briefs are requested with the server-side refusal-fallback beta (`fallbacks: "default"`). If an account doesn't support it,
the backend automatically retries without it.

---

## Plugging in the official PSI dataset

1. Put the files in **`data/psi/`** (any subfolders), or upload them in the **Data Lab** tab.
2. Accepted formats:
   - **CSV / TSV / XLSX** test matrices. Columns are auto-mapped: O₂ (% or mole fraction), pressure (psia/atm/bar/Pa/torr →
     kPa), flow (mm/s, m/s → cm/s), gravity, fuel/material, diluent, outcome (burn / no ignition / extinguished…), test id.
     The first unmapped numeric column becomes the primary metric. Everything else is kept verbatim.
   - **JSON**: investigation metadata (overrides the seed by `id`), relations, and/or test rows. See `data/templates/`.
   - **PDF / TXT / MD**: indexed for retrieval. With an API key, **SI extract** turns a document into structured
     investigation metadata. It is saved as `*.extracted.json` and marked _unverified_.
3. To assign records to an investigation, use an `investigation` column, or name the file after it (`BASS-II_tests.csv`),
   or pick the investigation in the Data Lab.
4. Press **Reload data/psi** (or `POST /api/reload`). Envelopes switch to `PSI data`, test dots appear on the maps, and
   ranking, gaps and briefs update automatically.

The **Preview** step shows the column mapping, unit conversions and warnings before anything is saved.

---

## API

| Method | Path                                                          | Purpose                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`                                                 | DB / LLM / data status                                                                                                                                                                        |
| GET    | `/api/dataset` · `/api/habitats`                              | catalog, relations, spin-offs · mission presets                                                                                                                                               |
| POST   | `/api/analyze`                                                | `{scenario, weights}` → ranking (each with a grade) + coverage (with `grade`) + gaps + `materials` + `nextExperiments` + `briefPreview` + physics readout. One call powers the Answer screen. |
| POST   | `/api/stowage`                                                | `{item, scenario}` → closest material, `matchedBy` (`keyword` · `claude` · `none`), verdict, advice                                                                                           |
| POST   | `/api/compare-habitats`                                       | `{a, b}` → both analyses + `diff` (materials, new gaps, grade change, rank moves)                                                                                                             |
| GET    | `/api/next-experiments`                                       | missing test conditions across all presets                                                                                                                                                    |
| POST   | `/api/brief-cards`                                            | `{scenario, weights}` → Prevention / Detection / Suppression cards (≤3 cited bullets each, gaps, citation audit). Deterministic, no LLM                                                       |
| POST   | `/api/brief`                                                  | SSE: `meta` → `delta`… → `citations` → `done`                                                                                                                                                 |
| POST   | `/api/ask`                                                    | SSE answer with retrieved passages                                                                                                                                                            |
| GET    | `/api/condition-space` · `/api/genome` · `/api/compare?a=&b=` | maps & comparisons                                                                                                                                                                            |
| GET    | `/api/investigations/{id}`                                    | dossier + imported tests                                                                                                                                                                      |
| POST   | `/api/ingest/preview` · `/api/ingest` · `/api/extract`        | Data Lab                                                                                                                                                                                      |
| GET    | `/api/export/tests.csv`                                       | model-ready dataset                                                                                                                                                                           |
| DELETE | `/api/uploads/{name}` · `/api/uploads`                        | remove uploads                                                                                                                                                                                |

---

## Tests

```bash
cd backend  && pip install -r requirements-dev.txt && python -m pytest -q   # 55 tests: engine, grades, materials, stowage, next experiments, brief cards, API
cd frontend && npm test                               # vitest: SSE parser, formatting, verdict sentence, brief-card text
cd frontend && npm run typecheck && npm run lint && npm run build
```

---

## 2-minute demo script

1. **Answer (0:00).** Open the site. Press **play** on the mission path: ISS → Moon base. Read the verdict aloud:
   _"6 of 8 materials are high risk at the Moon base. Confidence C: no partial-gravity data in PSI."_ The cards re-sort and
   the ones that got riskier ring red; the flame stretches from a sphere toward a teardrop.
2. **Tap a grade (0:30).** Tap the **C** stamp: the dossier of the investigation behind it opens. _"Every answer says how sure it is, and why."_
3. **Gaps (0:50).** The Moon base glows alone in the dark untested area. Next test #1: _solid materials at lunar gravity_,
   planned investigations **LUCI** and **FM2**.
4. **Brief (1:15).** Three cards: what to do for prevention, detection, suppression, each line cited to a PSI id;
   prevention says _Insufficient evidence_ above 21 % O₂. All citations checked.
5. **Compare (1:35).** ISS → Moon base: grade **B → C**, which materials got riskier, the new partial-gravity gap.
6. **Fire Passport (1:50).** **Get Fire Passport** → a one-page PDF. _"What we know, how sure we are, and what to test next."_

Works the same with `FLAMEPRINT_LLM=off`: every number, grade and gap comes from Python; the LLM only words the full brief.

**Judge Q&A, "what's real and what's mocked?"** Every number comes from deterministic code or imported PSI files. Catalog tested ranges are
labelled approximate, material verdicts are labelled _illustrative model_, unsourced values are grade **M**, and the flame is
labelled illustrative. Material thresholds are only shown when they have a cited source (see `docs/OPEN_QUESTIONS.md`).

---

## Project structure

```
backend/app/        main.py · engine.py (ranking, grades, next experiments) · materials.py · physics.py · ingest.py · store.py · brief.py · llm.py · embed.py · models.py
backend/tests/      test_engine · test_grades · test_materials · test_stowage · test_next_experiments · test_ingest · test_api
frontend/src/app/   layout.tsx · page.tsx · globals.css
frontend/src/components/  Sidebar · Header (mission status bar) · MissionConfig (scenario sheet) · CosmicBackdrop · Boot · ui
                          AnswerScreen (home) · MissionTimeline · GradeBadge · FlameCanvas (2D) · StowageInspector · CompareHabitats
                          MissionScene3D · FlameMorph · (Overview + CoveragePreview: v1 home, kept until v2 is accepted)
                          SpaceView + ConditionSpace3D (Where data exists) · FlammabilityMap · Ranking · BriefPanel · CitedMarkdown
                          Genome · EarthPanel · AskPanel · DataLab · InvestigationDrawer · ScenarioBuilder
frontend/src/app/passport/  printable Fire Passport (?mission=lunar-base)
frontend/src/lib/   answer.ts (verdict sentence, grades, levels) · api.ts (REST + SSE) · mission.tsx (state) · space.ts (condition-space math) · environment.ts · webgl.ts · types.ts · format.ts
data/seed/          curated investigation catalog (no test data) · materials.json (thresholds: cited or null)
docs/               OPEN_QUESTIONS.md (every modeled or unverified value)
render.yaml · DEPLOY.md   Render (API) + Vercel (web) deployment
data/psi/           ← drop official PSI files here
data/templates/     CSV + JSON import templates
docker-compose.yml  PostgreSQL 16 + pgvector
```

Deep links for demos: `?noboot` skips the intro (it only plays on the first visit anyway) · `#answer`, `#evidence`, `#gaps`, `#brief`, `#compare` open the five pages
(older `#overview`, `#ranking`, `#space`, `#habitats`, `#genome` still work) · `#stowage`, `#data`, `#ask`, `#earth` open the tools ·
`?mission=mars` (or `iss`, `lunar-base`, `rover`, `suit`, `earth`) preselects a mission · `?generate#brief` issues the brief on arrival.

## Design system

One palette across every page: deep-space navy surfaces (`#030814` / `#071225` / `#0B1930`), primary blue `#087BFF` and cyan `#19C9FF`
for scientific intelligence, flame orange `#FF8B32` and amber `#FFC15B` for combustion, restrained green for verified or live states.
Tokens live in `frontend/src/app/globals.css`. 3D (React Three Fiber + GLSL) is used where it explains something: the mission environment
(lunar, Martian, orbital or Earth, chosen by the preset), the gravity flame, and the condition-space explorer. Expensive canvases load
lazily, pause when off screen, fall back to static visuals without WebGL, and motion respects `prefers-reduced-motion`.
