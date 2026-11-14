# Open questions for the team

FLAMEPRINT never invents a number. Everything below is either **modeled** (grade `M` or the "illustrative model" label)
or **unverified**, and needs a team decision before the demo. Keep this file current: the acceptance checklist requires it.

## 1. Material oxygen thresholds (demo UNBLOCKED — now review the sourced values)

`data/seed/materials.json` → `materials[].oxygenThreshold`. **All 8 are now filled with cited 1 g LOI values**
(2026-11-14). Each value carries `source` + `url`; every material is rated automatically (level, margin, grade,
verdict sentence, stowage, passport, timeline highlights).

Team action: **confirm each cited value** (grade/specimen/test standard). Two to watch: `silicone` uses a typical
commercial-grade LOI (unfilled PDMS is lower ~21%, so this is optimistic — swap for the grade actually flown if known),
and `paper`/`cotton` are cellulose values that sit just above the ~21% air line.

| id         | Material             | Value used | Source (cited in materials.json)                                                                                              | Status                       |
| ---------- | -------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `cotton`   | Cotton fabric        | **18 %**   | BioResources review (Islam et al., 2021): untreated cotton LOI 16–22 %                                                        | ✅ sourced                   |
| `pu-foam`  | Polyurethane foam    | **18 %**   | Fire and Materials (2018): virgin flexible PU foam LOI 17.0–21.3 %                                                            | ✅ sourced                   |
| `pmma`     | PMMA (acrylic)       | **17 %**   | Lyon & Janssens, "LOI test revisited" (ASTM D2863-06): PMMA 17.0                                                              | ✅ sourced                   |
| `nomex`    | Nomex                | **28 %**   | Aramid datasheets / ASTM D-2863 (range 28–31 %); NASA NTRS 20070018178 (failed at 30 % O₂, "J" config)                        | ✅ sourced                   |
| `ptfe`     | PTFE wire insulation | **95 %**   | SpecialChem LOI guide / ASTM D2863 tables                                                                                     | ✅ sourced                   |
| `velcro`   | Velcro (nylon 6,6)   | **24 %**   | Nylon 6,6 oxygen index ~24–29 % (ScienceDirect)                                                                               | ✅ sourced                   |
| `paper`    | Paper                | **19 %**   | Chen et al., BioResources 16(4):7953 (2021): untreated cellulose paper LOI ~19.6 % (ASTM D2863)                               | ✅ sourced                   |
| `silicone` | Silicone rubber      | **32 %**   | Typical commercial silicone rubber VMQ ~32 % (MakeItFrom; Wacker Elastosil R 501/75, ASTM D2863). Unfilled PDMS lower (~21 %) | ✅ sourced (grade-dependent) |

LOI depends on specimen form and test setup, and is a 1 g, candle-like test, not a spacecraft acceptance test
(NASA-STD-6001 Test 1). Say so in the pitch. These are literature LOI values, not PSI test records — material grades
stay B (if `testedIn`) or C, never A, until real PSI rows are imported.

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

- Live Groq (`FLAMEPRINT_LLM=auto` + `GROQ_API_KEY`, model `openai/gpt-oss-120b`) or offline (`FLAMEPRINT_LLM=off`)?
  Offline is deterministic and cannot fail on venue Wi-Fi; everything except LLM-written briefs and the LLM stowage
  fallback still works.
