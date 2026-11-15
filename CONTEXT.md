# FLAMEPRINT: project context

> **Read this first.** It is the single source of truth for the project's goal, current state and next steps.
> Claude (or a person) **must update it at the end of every working session**. See [How to update this file](#how-to-update-this-file).
>
> Last updated: **2026-11-14** · `origin/main` has PR #1, PR #2, the real-data/Groq pass, and UI Phases 0+1 (pushed earlier). UI
> **Phases 2–3 are committed locally only — the owner pushes.** Repo: `github.com/Hamza-04-mav/FLAMEPRINT` (private)
>
> **UI/UX "Ink sun" upgrade in progress** (presentation-layer only — no scoring math/data/logic changed). Spec: 3-colour palette
> (Ink navy / Dust taupe / Solar yellow), SF typography, iOS glass, visual-language-over-text, 5-second read, 375→1920px.
> Commit per phase locally; full `next build` only at the final phase. Plan, defects & phase status: `docs/ui-audit.md` + §7.0.
> Data layers unchanged: **24 investigations**, all 8 material LOI thresholds sourced, 9-file NASA corpus in `data/psi/docs/`,
> **862 real PSI test records** in `data/psi/psi-downloads/` (envelopes `confidence=data`), LLM on **Groq** (`openai/gpt-oss-120b`).

---

## 1. Goal in one paragraph

FLAMEPRINT is our **NASA Space Apps 2026** entry for the challenge **"Flame in Freefall: SI-Powered Fire Safety Insights from
Microgravity Combustion Data"**. It turns NASA's PSI (Physical Sciences Informatics) microgravity combustion archive into an answer to
one question: **"Is my habitat safe from fire, and how sure are we?"** A user picks a habitat (ISS, Moon base, spacesuit, rover,
Mars). FLAMEPRINT says which materials are high risk there, gives an **evidence grade (A/B/C/M)** for how much NASA data stands behind
that answer, shows **where the data stops**, and recommends **what NASA should test next**. Judges must understand the answer
in under 10 seconds on the home page, without scrolling.

**The challenge asks for** (every page serves one of these):

1. Identify the PSI investigations most relevant to a crewed habitat.
2. Summarize, rank and interpret them into fire-safety insight: prevention, detection, suppression.
3. Show where the data stops (no partial-gravity data in PSI; high O₂ at low pressure for the Moon base).
4. Point to research for next-generation fire safety.
   Rockets and propellants are out of scope.

---

## 2. Status at a glance

| Area                                                     | State                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Backend (FastAPI)                                        | ✅ Working. 55 tests pass                                                                                |
| Frontend (Next.js)                                       | ✅ Working. Typecheck, lint, 8 vitest tests and `next build` pass; no console errors                     |
| Five-page declutter (content budget)                     | ✅ Done and within budget on every page (see `docs/screens/README.md`)                                   |
| Offline mode (`FLAMEPRINT_LLM=off`, no DB, no PSI files) | ✅ Full demo flow works                                                                                  |
| Live LLM mode (Groq, openai/gpt-oss-120b)                | ⚠️ Code wired to **Groq**; not yet tested with a real key (team to provide `GROQ_API_KEY`)               |
| Material oxygen thresholds                               | ✅ **All 8 sourced** (1 g LOI from cited literature). Demo fully populated. Silicone is grade-dependent. |
| Deployment (Render + Vercel)                             | 📝 Files ready (`render.yaml`, `DEPLOY.md`); **not deployed yet**                                        |
| GitHub                                                   | ✅ PR #1 and PR #2 merged into `main` on `Hamza-04-mav/FLAMEPRINT`                                       |

---

## 3. Run it

```bash
./start.sh                     # macOS/Linux: backend :8000 + frontend :3000 (start.ps1 on Windows)
open "http://localhost:3000/?noboot&mission=lunar-base"
```

Manual: `cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000 --reload`, then `cd frontend && npm run dev`.
Config lives in `backend/.env` (copied from `.env.example`): `GROQ_API_KEY` (optional), `FLAMEPRINT_LLM=auto|on|off`,
`DATABASE_URL` (optional), `FLAMEPRINT_MODEL` (default `openai/gpt-oss-120b`). LLM provider is **Groq** (OpenAI-compatible).

**Checks to run before every commit:**

```bash
cd backend  && .venv/bin/python -m pytest -q                       # 55 tests
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

Useful links: `#answer #evidence #gaps #brief #compare` (pages), `#stowage #data #ask #earth` (tools), old `#overview #ranking
#space #habitats #genome` still work · `?mission=lunar-base|iss|suit|rover|mars|earth` · `?noboot` skips the intro ·
`?generate#brief` auto-runs the full brief · `/passport?mission=lunar-base` printable Fire Passport.

---

## 4. Rules that must not break

1. **Numbers come from Python, never from the LLM.** Scores, grades, risk levels and gaps are computed in `backend/app`. Claude only
   words evidence it is given, and only picks from fixed lists (stowage: one material id or `none`).
2. **No invented data.** No made-up test rows, thresholds, percentages or citations. A value without a source gets grade **M** and a
   "modeled" / "not rated" label, and goes into `docs/OPEN_QUESTIONS.md`.
3. **Labels stay visible:** `approx`, `PSI data`, `unknown`, `illustrative`, `illustrative model`, `estimate`, plus the grade letter.
4. **Offline works:** no key → deterministic writer and keyword stowage; no DB → in-memory index; no PSI files → seed catalog, labelled.
5. **Citations are audited** (`brief.check_citations`) for every AI or generated text, including the brief cards.
6. **One `/api/analyze` call powers the Answer page.** New home-page data goes into that response.
7. **Tests stay green**, and every new module gets tests.
8. **Accessibility and performance:** `prefers-reduced-motion`, WebGL fallbacks, lazy 3D, at most 1 WebGL canvas per page.
9. **Content budget** (from the declutter brief): 1 headline + at most 1 sentence per page; at most 3 panels above the fold at
   1440×900; at most 5 list items before "Show more"; at most 1 chart; card text = title + 2 short lines; psi first, kPa small;
   plain words ("tested range", not "envelope"; "safety area", not "pillar"); motion 150–300 ms; no looping decoration except the flame.
10. **Hiding is not deleting:** every capability stays reachable via "Show details", the Tools menu or expand rows.

---

## 5. Architecture

```
frontend/ (Next.js 15.5, React 19, Tailwind v4, Framer Motion, React Three Fiber)
   │  /api/* rewrite → FLAMEPRINT_API_URL (default 127.0.0.1:8000), or NEXT_PUBLIC_API_BASE for direct calls
backend/ (FastAPI, Pydantic v2, Python ≥3.9)
   engine.py     ranking (6 factors) · tested ranges · coverage & gaps · grade() · next_experiments() · genome · compare
   materials.py  material verdicts (illustrative model) · stowage keyword match · advice table
   physics.py    ppO₂ · buoyant flow ∝ √g · flow regimes · schematic limiting-O₂ U-curve (labelled schematic)
   brief.py      evidence packet · offline brief writer · brief_cards() · citation audit
   llm.py        Groq streaming (openai/gpt-oss-120b) · PDF→metadata extraction (JSON mode) · pick_material() (fixed-list choice)
   store.py      loads data/seed + data/psi + data/imported; optional PostgreSQL+pgvector, else in-memory index
   ingest.py     CSV/TSV/XLSX/JSON/PDF/TXT parsing, column mapping, unit conversion
   habitats.py   6 presets with basis, `assumed` flag and timeline `order`
data/  seed/investigations.json (24 investigations, metadata only, no test rows) · seed/materials.json (8 materials, 6 LOI thresholds sourced)
       psi/ (drop official PSI files) · psi/docs/ (real NASA source corpus: Researcher's Guide, Apollo 1/13, Mir, spinoffs — indexed for retrieval)
       imported/ (Data Lab uploads, git-ignored) · templates/
```

**Database:** optional. `docker compose up -d db` starts PostgreSQL 16 + pgvector (`backend/app/schema.sql`: `investigations`,
`test_records`, `doc_chunks` with vector embeddings). Files stay the source of truth; the DB is only a search index and falls back
to in-memory if unreachable. Not used in deployment.

### API

| Method          | Path                                                                                                                             | Purpose                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST            | `/api/analyze`                                                                                                                   | **Answer page.** `{scenario, weights}` → `ranked` (each with `grade`), `coverage` (+`grade`, `index`, `gaps`), `materials`, `nextExperiments`, `briefPreview`, `readout`, `dataMode` |
| POST            | `/api/brief-cards`                                                                                                               | Prevention/Detection/Suppression cards: ≤3 cited bullets each, `gap`, `earth`, `audit`. No LLM                                                                                       |
| POST            | `/api/brief` · `/api/ask`                                                                                                        | SSE streams (`meta` → `delta`… → `citations` → `done`); local writer when offline                                                                                                    |
| POST            | `/api/stowage`                                                                                                                   | `{item, scenario}` → `materialId`, `matchedBy` (`keyword`/`claude`/`none`), `verdict`, `advice`                                                                                      |
| POST            | `/api/compare-habitats`                                                                                                          | `{a, b}` → both analyses + `diff` (materials, gapsOnlyInB, grade, rankMoves)                                                                                                         |
| GET             | `/api/next-experiments`                                                                                                          | missing test conditions across all presets                                                                                                                                           |
| GET             | `/api/health` `/api/habitats` `/api/dataset` `/api/investigations/{id}` `/api/condition-space` `/api/genome` `/api/compare`      | meta, maps, dossier                                                                                                                                                                  |
| POST/DELETE/GET | `/api/ingest/preview` `/api/ingest` `/api/extract` `/api/uploads…` `/api/reload` `/api/export/tests.csv` `/api/templates/{name}` | Data Lab                                                                                                                                                                             |

### Key algorithms (all deterministic, in Python)

- **Evidence grade** (`engine.grade`), checked in order. **A**: imported PSI tests within O₂ ±3 points, pressure ±15 kPa and felt
  airflow ±5 cm/s, matching fuel phase (or material). **B**: one tested range jointly covers O₂ (±1) and pressure (±5 kPa) for the
  fuel type, or A-level tests that miss the airflow axis. **C**: only bracketed by separate investigations. **M**: nothing covers it.
  **Partial gravity (0 < g < 1) caps at C**, with the reason "No partial-gravity data in PSI; bracketed by microgravity and 1 g".
- **Material verdict** (`materials.assess`). Effective threshold = sourced 1 g oxygen threshold + shift from the schematic U-curve
  (felt airflow vs 1 g still air). Margin = cabin O₂ − effective threshold → **high** (≥ +3), **elevated**, **low** (≤ −3), or
  **unknown** if the threshold is `null` (grade M). Material grade: B if `testedIn` is non-empty, A only with imported tests of
  that material, else C; partial gravity caps at C. Pressure is **not** modeled (noted in OPEN_QUESTIONS). All constants are in the
  `SCHEMATIC` block.
- **Next experiments** (`engine.next_experiments`). Missing conditions are grouped by (fuel phase, gravity regime) across presets;
  score = severity weight (critical 3 / high 2 / medium 1) × habitats affected. `plannedBy` lists pending investigations whose
  phase _and_ gravity regime match (LUCI and FM2 are **lunar only**, so they never fill Mars gaps). Earth is never a gap.
- **Ranking:** 6 weighted factors (O₂, pressure, flow, material, safety area, gravity). Score = 100·Σwᵢsᵢ/Σwᵢ, with
  sᵢ = exp(−(d/scale)²); approx ranges ×0.92, untested axis gets 0.3 credit, planned investigations ×0.6.

---

## 6. Frontend: pages and where they live

Sidebar = **5 pages + Tools menu**. Header = one habitat pill (tap to change) + status / evidence-key button. Content column 1200 px.

| Page (hash)          | Question                                 | Component                                               | First screen                                                                                                                                                                                                                           | Behind a click                                                                                     |
| -------------------- | ---------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Answer `#answer`     | Is my habitat safe, and how sure are we? | `AnswerScreen.tsx`                                      | `MissionTimeline` (play: ISS → Moon → Suit → Rover → Mars), verdict sentence (`lib/answer.buildVerdict`), grade stamp, `FlameMorph` hero (the only WebGL), top 5 material cards (`FlameCanvas` 2D), `StowageSearch`, Get Fire Passport | Adjust conditions · all materials · habitat in 3D                                                  |
| Evidence `#ranking`  | Which experiments back it up?            | `Ranking.tsx`                                           | top 5 rows: rank, id, one sentence (`rankReason`), approx label, stamp                                                                                                                                                                 | factor bars + dossier · all 22 · Adjust scoring                                                    |
| Gaps `#space`        | Where is there no data? What next?       | `SpaceView.tsx` + `FlammabilityMap.tsx`                 | O₂ × airflow "void" map, top 3 gaps, top 3 next tests                                                                                                                                                                                  | schematic curve, inspector, every-habitat list, not-plottable · Explore in 3D (`ConditionSpace3D`) |
| Brief `#brief`       | What should engineers do?                | `BriefPanel.tsx`                                        | 3 cards from `/api/brief-cards`, citation chips, audit line                                                                                                                                                                            | Read full brief (streamed `FullBrief`) · On Earth too                                              |
| Compare `#habitats`  | What changes between habitats?           | `CompareHabitats.tsx`                                   | ISS → Moon base: grade stamps, changed materials, new gaps                                                                                                                                                                             | unchanged · rank moves · "Compare experiments" toggle (`Genome embedded`, also `#genome`)          |
| Tools                | —                                        | `StowageInspector`, `DataLab`, `AskPanel`, `EarthPanel` |                                                                                                                                                                                                                                        |                                                                                                    |
| Passport `/passport` | printable one page                       | `app/passport/page.tsx`                                 | light theme, no WebGL, prints as 1 page                                                                                                                                                                                                |                                                                                                    |

Shared: `lib/mission.tsx` (state, tabs, `resolveTab` legacy-hash map, debounced `/api/analyze`), `lib/api.ts` (REST + SSE),
`lib/answer.ts` (verdict, grade/level colours, `rankReason`, `firstSentence`, `fmtPressure`), `GradeBadge.tsx` (passport `Stamp`;
pass `inert` inside another button), `InvestigationDrawer.tsx` (dossier). `Overview.tsx` and `CoveragePreview.tsx` are the old v1
home, unused and kept until v2 is accepted.

**Design system** — **"Ink sun"** (UI/UX upgrade, in progress). **Exactly three colours**, all tokens derived as tints/shades/alpha:
**Ink navy `#0E1726`** (surfaces, ~60%), **Dust taupe `#8A8178`** (text/borders/structure, ~35%), **Solar yellow `#FFD23F`**
(≤5%, six whitelisted roles only: the single primary CTA per view, the "you are here" habitat marker, fire/risk intensity, the active
habitat in the stepper, the keyboard focus ring, the logo flame). **No other hues** — no blue CTA, no cyan, no red/green status.
Single source of truth: **`lib/theme.ts`** (JS, for three.js + charts) mirrored by CSS tokens in `globals.css` (`@theme` + `:root`);
legacy token names (`space-*`, `blue`, `ox`, `flame-*`, `ink`, `mute`, `ok`, `danger`, `slate-*`) are remapped onto the three colours.
**Risk** = yellow intensity **+ shape** (high: solid flame + glow · elevated: 65% outline flame · low: taupe, no flame · unknown:
dashed taupe + hatch + "?"), never colour alone. **Grades A/B/C/M** = neutral dust brightness ramp (not on the yellow whitelist).
Font: SF system on Apple, Inter fallback. The intro (`Boot.tsx`) shows on the first visit only (`localStorage`).

---

## 7. What's left (priority order)

0. **UI/UX "Ink sun" upgrade (in progress).** Presentation-layer only. **Phases follow the owner's brief** (not the audit's old
   numbering); `docs/ui-audit.md` holds the full audit + the 9 confirmed defects. **Workflow:** commit per phase **locally** — the owner
   pushes; **run the full `next build` only once, at the final phase (Phase 8)** — per-phase checks are typecheck + lint + vitest only.
   Done: **Phase 0** audit · **Phase 1** colour tokens (`lib/theme.ts` + rewritten `globals.css`, shared TS maps repointed, legacy
   tokens remapped; fixed defect #5 gravity + #6 plural) · **Phase 2** typography (Apple SF stack + Inter `ss01/cv11`, dropped Space
   Grotesk, type scale `.t-display`..`.t-caption`, glassy text `--text-1/2/3`, sentence-case eyebrows) · **Phase 3** glass material
   (iOS-style: `.panel` base glass [navy-800 @55%, blur 24, 20px radius] + `.panel-float` [blur 32, deeper shadow] for sheets/popovers/
   nav; `@supports`/`prefers-reduced-transparency` solid fallbacks; converted Header popovers, stowage dropdown, MissionConfig sheet,
   InvestigationDrawer, sidebar + mobile nav) · **Phase 4** space background & depth (`CosmicBackdrop` rebuilt: dust-100 stars in 3
   parallax layers + a few twinkles, per-habitat moon/planet horizon arc [Moon/Mars taupe with craters, ISS/Earth lighter-navy limb,
   suit close rim] that crossfades 600ms on habitat switch, removed the blue nebulae; recoloured `ENV_TINT` to navy/taupe; new
   `TiltCard` gives the Answer verdict card pointer tilt ≤4° + a moving specular highlight, desktop-only and off for reduced motion).
   Kept to the single always-on backdrop — no second WebGL canvas (≤1-canvas rule) · **Phase 5** Norman's principles (partial):
   new `AnswerPipeline` (Habitat ‣ Evidence ‣ Gaps ‣ Brief, each a live-visual link) at the top of Answer; `Slider` now shows preset
   **tick marks** on the track (sun when the value sits on a preset) + a gravity label row (µg/Moon/Mars/Earth); Answer sliders reordered
   to the chart axis order **O₂ · pressure · airflow · gravity**; **Reset to {preset}** appears when the scenario is custom; new
   `RankingToast` ("Ranking updated · N investigations", dust, no yellow) on each settle · **Phase 6 (part 1)** visual-language — Answer
   - Evidence views: new `ConditionReadout`/`ConditionGauges` (O₂ gauge + pressure/airflow/gravity mini-gauges: NASA-tested span as a
     taupe segment, habitat as a glowing yellow dot, derived from `ranked[].envelope` — no invented data); `GradeBadge` showReason now
     has a **4-segment meter** (A4/B3/C2/M1) + the grade meaning inline; material tiles carry a **flame icon + risk bar** (shape per level)
     and the all-unknown case shows **one banner + Unknown-styled tiles** (dashed + hatch + "?") instead of "Not rated" on every card;
     `FlameCanvas` recoloured dust→sun (no blue); Evidence rows replaced the repeated sentence with **four coverage strips** (O₂/pressure/
     airflow/gravity, tested span + habitat dot) + a compact relevance **ring**, factor bars recoloured to dust · **Phase 6 (part 2)**
     recolour + 3D sweep across the rest: `Header` planet glyph + status LEDs and `Sidebar` status → dust (no red/green; "Groq" label);
     Gaps 2D `FlammabilityMap` → taupe tested boxes / sun habitat dot / **≤4-item legend + "More" popover** (fixes defect #8) + fixed the
     truncated curve label; Gaps 3D `ConditionSpace3D` → dust boxes / **sun emissive marker** / dust axes+grid / ink bg, `SpaceView`
     overlay LEDs recoloured; **Habitat 3D `MissionScene3D` relit** (cool taupe-navy ambient + single warm key light; interior/dome/rover
     lights = soft **sun** as the only yellow; Earth limb, glass, solar arrays, beacon desaturated to navy — no red/blue); `BriefPanel`
     got a one-click **Export Fire Passport** + dust/sun recolour; `CompareHabitats` delta arrows, `Genome`, `EarthPanel`, `CitedMarkdown`,
     `Boot`, `ScenarioBuilder`, `InvestigationDrawer` recoloured to tokens; `fmtGravity` applied in Brief/ScenarioBuilder. Remaining active
     files on-token (dead `Overview`/`CoveragePreview` left as-is until v2 accepted; neutral metal greys in the 3D scene kept) · **Phase 7**
     motion & transitions: new `lib/motion.ts` (one vocabulary — spring 260/30, durations micro 150/standard 280/page 450, ease
     `cubic-bezier(0.22,1,0.36,1)`); page/tab transitions now fade + slide 12px at page timing with a global spring default (`MotionConfig`);
     habitat stepper has a **sliding active ring** (`layoutId`, sun); list items **stagger 30 ms** (pipeline, Evidence rows); gauge tested
     segments + material risk bars **grow once on first view** (`whileInView` + `viewport once`); the background tint already cross-fades
     (Phase 4). `prefers-reduced-motion` keeps opacity fades and disables parallax/tilt/camera/slide/glow-breathe (framer `reducedMotion="user"`
   - the global CSS reduce block) · **Phase 6 complete** (finalisation): Brief `.prose-brief` bullets are now **checklist ticks** (icons +
     `StrengthMeter` priority meters + Export Passport already present); `CompareHabitats` has an **overlaid two-marker axis chart**
     (O₂/pressure/airflow/gravity — dust A-dot vs glowing sun B-dot + per-axis delta arrows); the Stowage tool opens with an illustration +
     input + visual result card; **sidebar footer safe-area** fixed (defect #9). **Status: of 11 planned phases, Phases 0–7 are done and on
     `origin/main`.** **Next — Phase 8:** a11y/perf sweep + before/after screenshots in `docs/screenshots/` + the single full `next build`.
     Phases 9–11 await the owner's specs. **Deferred Norman items** (can fold into a later phase): psi/kPa unit toggle, stowage combobox,
     undo, disabling impossible slider combinations.

1. **[Team] Review the 6 sourced material LOI thresholds** in `data/seed/materials.json` (cotton 18, pu-foam 18, pmma 17,
   nomex 28, ptfe 95, velcro 24 — each with `source`+`url`). Confirm the cited values, and decide a value (or keep `null`)
   for **paper** and **silicone**, which are left `null` on purpose. These are 1 g LOI, not NASA-STD-6001 — say so in the pitch.
2. **[Team] Verify `testedIn`** for each material against real PSI records (it currently comes from catalog fuel lists).
   2b. ✅ **DONE — real PSI test records imported.** 862 test records from 10 investigation Experimental Tables
   (BASS, BASS-II, CFI, FLEX-2, SAFFIRE-I/II/III, SAME, SPICE, ACME-S-Flame) are in `data/psi/psi-downloads/`.
   Real O₂/pressure/flow now drive the engine: envelopes show `confidence=data`, ISS ranking grades are **B**
   ("tested this O₂ and pressure together"), and the Moon base correctly stays M/C (real data tops out at ~22% O₂).
   To add more, drop CSVs in `data/psi/psi-downloads/` (see its README for naming).
3. **Deploy:** Render (API) + Vercel (web), following `DEPLOY.md`. Set `CORS_ORIGINS`, `NEXT_PUBLIC_API_BASE` and `PYTHON_VERSION`
   (`render.yaml` pins 3.12.7; set it to the version you tested). Then check that SSE streaming works on the live URL.
4. **Test live Groq** (`GROQ_API_KEY` set, model `openai/gpt-oss-120b`): full brief streaming plus citation audit, and the stowage LLM fallback for items
   with no keyword match.
5. **[Team] Final airflow values** for the assumed presets (rover, Mars), and decide **live Groq vs `FLAMEPRINT_LLM=off`** for judging.
6. Import real PSI test files (`data/psi/` or the Data Lab) to show grades rising to **A** and labels switching to `PSI data`.
7. Nice to have: delete `Overview.tsx`/`CoveragePreview.tsx` once v2 is accepted; shrink `docs/screens` (~47 MB); record a backup demo video.

---

## 8. Gotchas (learned the hard way)

- **Python 3.9 locally:** Pydantic models need `Optional[X]`, not `X | None` (Pydantic evaluates annotations even with `from __future__`).
- **Don't run `npm run build` while `npm run dev` is running:** both use `frontend/.next` and the dev server breaks. Build in a copy,
  or stop dev first.
- **Never nest a `<button>` inside a `<button>`:** it caused a hydration error. Use `<GradeBadge inert />` inside clickable rows.
- **Headless Chrome screenshots below ~500 px wide are crops.** Use DevTools device emulation to measure real 390 px layouts.
- **`set -e` with `curl` probes in shell scripts** exits early on the first expected connection refusal.
- **LUCI and FM2 are lunar-gravity investigations.** Never list them as planned for Mars.
- **This folder was created from a ZIP**, then its history was grafted onto the team repo's initial commit. `main` is now normal
  shared history; branch from `origin/main` for new work.

---

## 9. Session log

| Date       | Who                        | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13 | Hamza                      | Initial commit: v1 research dashboard (8 tabs, ranking, coverage map, genome, brief, Data Lab, Ask, Earth). 28 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-11-14 | Claude Code (with Cerelva) | **v2 features:** evidence grades A/B/C/M, `materials.json` (thresholds `null`) and `materials.py`, Answer screen, stowage check, next-experiment recommender, mission timeline, compare habitats, Fire Passport, plain-language pass, Render/Vercel files, `requirements-dev.txt`, `OPEN_QUESTIONS.md`. Fixed: partial-g grade reason, LUCI/FM2 shown as planned for Mars, mobile overflow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-14 | Claude Code (with Cerelva) | **Declutter pass:** 5 pages + Tools menu, content budget enforced and measured, passport-stamp grades, void gap map, `/api/brief-cards` (deterministic, audited), slim header pill, 1200 px column; fixed a nested-button hydration error. Before/after screenshots in `docs/screens/`. 55 backend + 8 frontend tests. PR #1 merged into `main`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-14 | Zaki Noorani               | PR #2: NASA SVG assets in `frontend/public/NASA/` (not yet used in the UI); `package-lock.json` fixed for Windows installs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-14 | Claude Code (with Zaki)    | **Real-data pass.** Found PSI combustion test records are NOT bulk-accessible (public AWS bucket has only DSI/OASIS/pk4; repo is a login-gated SPA). Saved a real NASA source corpus to `data/psi/docs/` (Researcher's Guide 2015, Apollo 1/13, Mir, 3 spinoffs) + `_SOURCES_AND_ACCESS.md`. Seed now 24 investigations (added SoFIE, FLARE; FM2 upgraded to the real Moon experiment; real diluents/PIs/findings; 3 new relations). Filled 6/8 material LOI thresholds from cited literature (paper+silicone left null). 55 backend tests pass. Recommendation: RAG over the corpus + deterministic physics, NOT predictive deep ML (no training rows).                                                                                                                                                                                                                                                                                |
| 2026-11-14 | Claude Code (with Zaki)    | **Real PSI test records imported + live Groq verified.** Ingested 862 real test records from 10 PSI Experimental Tables (`data/psi/psi-downloads/`); fixed ingest column-mapping for real PSI headers (BASS-II "Calibrated O₂ % by vol", "Percent O₂", "Air Rate", and a fuel-vs-sample-id guard). Envelopes now `confidence=data`; ISS grades → **B** from real data; Moon base honestly M/C (real data max ~22% O₂). Tested live Groq end-to-end (`openai/gpt-oss-120b`, since the key lacked llama-3.3): RAG chatbot, brief, and stowage all work with citations validated. 55 tests pass.                                                                                                                                                                                                                                                                                                                                           |
| 2026-11-14 | Claude Code (with Zaki)    | **Full-fidelity corpus + Groq.** Re-extracted all 9 accessible NASA sources as full **txt** (dropped the PDF, no duplication): full 56-pg Researcher's Guide (~110k chars), Glenn combustion page, Apollo 1/13, Mir, 3 spinoffs, and the ScienceCasts video transcript. All 8 material LOI thresholds now sourced (added paper 19, silicone 32). **Migrated the LLM layer from Anthropic to Groq** (`openai/gpt-oss-120b`): `llm.py` streaming + JSON-mode extraction/stowage, `GROQ_API_KEY`, updated requirements/docs/render.yaml/.env.example. 55 backend tests pass; live Groq path untested (needs key).                                                                                                                                                                                                                                                                                                                          |
| 2026-11-14 | Claude Code (with Cerelva) | Added `CONTEXT.md` (this file) and `CLAUDE.md` (session instructions), linked from the README                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-11-14 | Claude Code (with Zaki)    | **UI/UX "Ink sun" upgrade — Phase 0 + 1.** Wrote `docs/ui-audit.md` (stack, token map, ~240 hard-coded colours across 26 files, a11y/perf risks, 9 confirmed defects, phase plan). Phase 1 token foundation: new `lib/theme.ts` (single source of truth) + rewritten `globals.css` to the **3-colour palette** (Ink navy / Dust taupe / Solar yellow; legacy tokens remapped so existing classes recolour); repointed `answer.ts`/`format.ts`/`ui.tsx` colour maps; sun CTA + yellow focus ring + `.sun-glow`; retired unused `.holo`. Also fixed defect #5 (shared `fmtGravity`) and #6 (`plural()`). Typecheck, lint, 8 vitest, `next build` all green; scoring untouched. Direct to `main` per owner request.                                                                                                                                                                                                                        |
| 2026-11-14 | Claude Code (with Zaki)    | **UI/UX Phase 2 — typography.** Switched to the Apple SF system stack (real SF Pro on Apple; Inter `ss01`/`cv11` as the cross-platform fallback), dropped Space Grotesk, added the type scale (`.t-display`..`.t-caption`), glassy text vibrancy tokens (`--text-1/2/3`, opaque fallback when no `backdrop-filter`), display-headline vertical fill, and sentence-case eyebrows (retired letter-spaced ALL-CAPS except one `.axis-tag` caption). Applied to the Answer verdict + page headers. Typecheck, lint, 8 vitest, `next build` all green. Committed locally (owner pushes).                                                                                                                                                                                                                                                                                                                                                     |
| 2026-11-14 | Claude Code (with Zaki)    | **UI/UX Phase 3 — iOS glass material.** `.panel` is now base glass (navy-800 @55%, blur 24, 20px radius, 1px specular top highlight) and new `.panel-float` is the floating level (blur 32, deeper shadow) for sheets/popovers/nav; `@supports`/`prefers-reduced-transparency` fall back to solid `--ink-800`; controls → 14px radius. Converted the Header popovers, stowage dropdown, MissionConfig sheet, InvestigationDrawer, desktop sidebar + mobile nav to glass. Typecheck, lint, 8 vitest pass (full `next build` deferred to the final phase per owner). Committed locally.                                                                                                                                                                                                                                                                                                                                                   |
| 2026-11-14 | Claude Code (with Zaki)    | **UI/UX Phase 4 — space background & depth.** Rebuilt `CosmicBackdrop`: dust-100 stars across 3 parallax layers + slow twinkles; a per-habitat moon/planet **horizon arc** (Moon & Mars = taupe with craters, ISS/Earth = lighter-navy limb, suit = close rim) that **crossfades 600 ms** on habitat switch; dropped the blue nebulae; recoloured `ENV_TINT` to navy/taupe. New `TiltCard` adds pointer-tracked tilt (≤4°) + a moving specular highlight to the Answer verdict card (desktop fine-pointer only; off for reduced motion; mounted-gated to avoid SSR mismatch). Still one always-on backdrop, no extra WebGL canvas. Typecheck, lint, 8 vitest pass (build deferred to final phase). Committed locally.                                                                                                                                                                                                                   |
| 2026-11-14 | Claude Code (with Zaki)    | **UI/UX Phase 5 — Norman's principles (partial).** New `AnswerPipeline` (Habitat ‣ Evidence ‣ Gaps ‣ Brief, each a live-visual click-through) atop Answer; `Slider` gains preset **tick marks** (sun when on a preset) + a gravity label row (µg/Moon/Mars/Earth); Answer sliders reordered to chart axis order O₂·pressure·airflow·gravity; **Reset to {preset}** when custom; new `RankingToast` ("Ranking updated · N investigations", dust) on settle. Deferred: psi/kPa unit toggle, stowage combobox, undo, impossible-combo disabling. Typecheck, lint, 8 vitest pass (build deferred to final phase). Committed locally.                                                                                                                                                                                                                                                                                                        |
| 2026-11-14 | Claude Code (with Zaki)    | **UI/UX Phase 6 (part 1) — visual language: Answer + Evidence.** New `ConditionReadout`/`ConditionGauges` (O₂ gauge + pressure/airflow/gravity mini-gauges: tested span = taupe segment, habitat = glowing yellow dot, from `ranked[].envelope`). `GradeBadge` showReason gains a 4-segment meter (A4/B3/C2/M1) + inline meaning. Material tiles get a flame icon + risk bar (shape per level); all-unknown shows one banner + Unknown-styled tiles (dashed+hatch+"?") not per-card "Not rated". `FlameCanvas` recoloured dust→sun. Evidence rows: four coverage strips + relevance ring replace the repeated sentence; factor bars → dust. Typecheck, lint, 8 vitest pass (build deferred to final phase). Committed locally.                                                                                                                                                                                                          |
| 2026-11-14 | Claude Code (with Zaki)    | **UI/UX Phase 6 (part 2) — recolour + 3D sweep.** `Header`/`Sidebar` planet glyphs + status LEDs → dust (no red/green; "Groq"). Gaps 2D `FlammabilityMap`: taupe tested boxes, sun habitat dot, **legend ≤4 + "More" popover** (fixes defect #8), fixed truncated curve label. Gaps 3D `ConditionSpace3D`: dust boxes, **sun emissive marker**, dust axes/grid, ink bg. Habitat 3D `MissionScene3D` **relit** (cool taupe-navy ambient + single warm key; interior/dome/rover lights = soft sun only; Earth limb/glass/arrays/beacon desaturated to navy). `BriefPanel` one-click **Export Fire Passport** + recolour; Compare/Genome/Earth/CitedMarkdown/Boot/ScenarioBuilder/InvestigationDrawer recoloured; `fmtGravity` in Brief/ScenarioBuilder. All active components on-token (dead Overview/CoveragePreview left; neutral metal greys kept). Typecheck, lint, 8 vitest pass (build deferred to final phase). Committed locally. |
| 2026-11-14 | Claude Code (with Zaki)    | **UI/UX Phase 7 — motion & transitions.** New `lib/motion.ts` (spring 260/30; durations micro 150/standard 280/page 450; ease cubic-bezier(0.22,1,0.36,1)). Page/tab transitions fade + slide 12px at page timing with a global `MotionConfig` spring default; habitat stepper gains a sliding active ring (`layoutId`, sun); list items stagger 30 ms (pipeline, Evidence rows); gauge tested segments + material risk bars grow once on first view (`whileInView`/`viewport once`). `prefers-reduced-motion` keeps opacity fades, disables parallax/tilt/camera/slide/glow-breathe. Typecheck, lint, 8 vitest pass (build deferred to final phase). Committed locally.                                                                                                                                                                                                                                                                |
| 2026-11-15 | Claude Code (with Zaki)    | **UI/UX Phase 6 finalised (+ token/context skills).** Brief bullets → **checklist ticks** (`.prose-brief`); `CompareHabitats` **overlaid two-marker axis chart** (dust A-dot vs sun B-dot + delta arrows); Stowage tool opens with illustration + input + visual card; **sidebar footer safe-area** (defect #9). Ran token-saver + context-optimization (compact output). Of 11 planned phases, 0–7 done; owner committed these as `e0044f2` and pushed, so `main` is in sync with `origin`. Typecheck, lint, 8 vitest pass. |

---

## How to update this file

At the **end of every session** (Claude: do this before your final message):

1. Update the **"Last updated"** line and the **Status** table (section 2).
2. Move finished items out of **What's left** (section 7) and add new ones in priority order.
3. Add **one row** to the **Session log** (section 9): date, who, what changed (features, fixes, tests). Keep it to 1–3 lines.
4. If routes, pages, algorithms, rules or gotchas changed, update sections 4–8. Keep facts verifiable (file names, test counts), and
   remove anything no longer true.
5. Keep it short: this file is a briefing, not a changelog. Detailed history belongs in git commits.
