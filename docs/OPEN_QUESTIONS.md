# Open questions for the team

FLAMEPRINT never invents a number. Everything below is either **modeled** (grade `M` or the "illustrative model" label)
or **unverified**, and needs a team decision before the demo. Keep this file current: the acceptance checklist requires it.

## 1. Material oxygen thresholds (blocks the main demo)

`data/seed/materials.json` → `materials[].oxygenThreshold`. Every value is `null` today, so every material shows
**Not rated / grade M**, and the Answer screen shows a team notice. When a value is filled in, the material is rated
automatically (level, margin, grade, verdict sentence, stowage, passport, timeline highlights).

For each material, fill in `o2Pct` (1 g limiting oxygen index, %), `source` (citation) and `url`, or leave `null`
and note "none found".

| id | Material | Candidate value to verify | Where it was seen (not verified, may be a secondary source) |
|---|---|---|---|
| `cotton` | Cotton fabric | ≈ 16–18 % (untreated) | Workwear catalogue (Fristads), secondary. Find a primary textile LOI study. |
| `pu-foam` | Polyurethane foam | not found | Search ISO 4589 data for flexible PU foam. |
| `pmma` | PMMA (acrylic) | ≈ 17 % | Zeus Industrial Products, "Flammability of polymers" technical note: https://www.appstate.edu/~clementsjs/journalarticles/zeus_flammability.pdf (403 from our tooling, so check it by hand) |
| `nomex` | Nomex | ≈ 31 % (100 % Nomex fabric) | PMC peer-reviewed fabric study table: https://pmc.ncbi.nlm.nih.gov/articles/PMC9898679/table/tbl3 (check sample and test standard). NASA notes Nomex failed at 30 % O₂ in a "J" configuration: https://ntrs.nasa.gov/api/citations/20070018178/downloads/20070018178.pdf |
| `ptfe` | PTFE wire insulation | ≈ 95 % | Zeus note above; SpecialChem LOI guide: https://www.specialchem.com/plastics/guide/fire-resistance-loi |
| `velcro` | Velcro (nylon) | not found | Nylon 6,6 LOI from a polymer handbook or datasheet. |
| `paper` | Paper | not found | Cellulose / paper LOI study. |
| `silicone` | Silicone rubber | not found | Values vary widely by filler; use the grade actually flown. |

LOI depends on specimen form and test setup, and is a 1 g, candle-like test, not a spacecraft acceptance test
(NASA-STD-6001 Test 1). Say so in the pitch.

## 2. Which materials each investigation actually burned (`testedIn`)

`testedIn` is filled from the **seed catalog fuel lists**, not from PSI test records (`testedInBasis` says so).
Verify each entry against the PSI records and remove anything that is not there:

- `cotton` ← BASS, BASS-II, SAFFIRE-I, SAFFIRE-III. The catalog lists **SIBAL cotton-fiberglass blend**, not pure cotton.
- `pmma` ← BASS, BASS-II.
- `paper` ← BASS-II. The catalog lists **thin cellulose**, close to but not the same as paper.
- `silicone` ← SAFFIRE-II. The catalog lists "multiple spacecraft materials (fabrics, plastics, silicone)".

A non-empty `testedIn` raises a material's grade from C to B, so this matters.

## 3. Modeled values in the material verdicts (label: "illustrative model")

`backend/app/materials.py`, block `SCHEMATIC`:

- Threshold shift = schematic U-curve (`physics.schematic_limiting_o2`) at the scenario's felt airflow minus the same
  curve at 1 g still air. **Uncalibrated teaching curve.**
- Level bands: high if margin ≥ +3 O₂ points, low if ≤ −3. **Team choice, not a standard.**
- Pressure is **not** modeled in the material verdict. Lower total pressure at the same O₂ % changes flammability; the
  brief and the gap list say pressure is untested, but the material level ignores it.

## 4. Assumed presets

- Pressurized rover and Mars habitat atmospheres (8.2 psi / 34 % O₂) are marked `assumed` in `habitats.py`.
- Airflow for every preset (`flowCmS`) is an assumption. The challenge brief does not give ventilation speeds.

## 5. Demo decision

- Live Claude (`FLAMEPRINT_LLM=auto` + key) or offline (`FLAMEPRINT_LLM=off`)? Offline is deterministic and cannot fail
  on venue Wi-Fi; everything except Claude-written briefs and the Claude stowage fallback still works.
