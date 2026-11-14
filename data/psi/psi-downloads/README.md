# Drop PSI investigation data here

Put the files you download from **psi.nasa.gov** in this folder. On the next backend restart
(or **Data Lab → Reload**, or `POST /api/reload`) they are auto-ingested, and the matching
investigation's grade jumps from **C/M → A/B** and its labels switch from "approx" to **"PSI data"**.

Everything in this folder (and subfolders) is parsed. You can make one subfolder per investigation
if you like — it does not affect matching (only the **file name** matters, see below).

---

## 1. Where to download on each PSI investigation page

On a page like `psi.nasa.gov/physci/repo/data/investigations/PSI-107` (SPICE):

**Best — the Experimental Table (the real test records):**

- Open the **Experimental Table** section. Export it (look for a download / export / CSV icon near
  the table's "Filter" row). This CSV/XLSX is exactly what FLAMEPRINT ingests.

**Also good — Data files and documents:**

- Expand **Data files and documents** → open the **Experimental table** folder (or **Raw Data** /
  **Reference Data**) → download the `.csv` / `.xlsx` files (use the per-file download / "View Content").

Skip for now: Reports, Science Documents, Presentations, Engineering Documents (PDFs — not test rows;
drop any you want into `data/psi/docs/` instead for the "Ask the archive" corpus).

---

## 2. CRITICAL: name each file with our catalog id

The importer matches a file to an investigation by finding our **acronym** in the file name
(it is NOT the PSI-xx number). The acronym is the one in parentheses in the PSI page title, e.g.
"Smoke Point In Co-flow Experiment **(SPICE)**".

- Rename each download so its name **starts with the acronym**, e.g.:
  - `SPICE_experimental_table.csv`
  - `BASS-II_tests.csv` ← use `BASS-II` (not `BASS`) for the BASS-II data; the longer id wins
  - `FLEX_tests.csv`, `FLEX-2_tests.csv`, `CFI_tests.csv`, `ACME-CFI-G_tests.csv`
- Alternatively, if the CSV already has a column named `investigation` / `experiment` / `project`,
  that is used instead and you don't need to rename.

Our catalog ids (use these exact spellings in file names):
`BASS, BASS-II, SAFFIRE-I, SAFFIRE-II, SAFFIRE-III, FLEX, FLEX-2, CFI, ACME-BRE, ACME-CFI-G,
ACME-EFIELD, ACME-CLD, ACME-FLAME-DESIGN, ACME-S-FLAME, SPICE, SLICE, SAME, SAME-R, DAFT, DAFT-2, SoFIE, FLARE`

Known PSI-number ↔ our-id (add more as you open them): **PSI-107 = SPICE**, **PSI-39 = CFI**.
For any other page, just read the acronym in the title and use it as the file name prefix.

---

## 3. Highest-value investigations to grab first

These have oxygen / pressure / diluent variation, so they lift grades the most:
**BASS-II, FLEX, FLEX-2, CFI, ACME-CFI-G** — then SPICE, SLICE, SAFFIRE-II, SAME.

---

## 4. What the importer does automatically

- Maps columns by synonym: oxygen %, pressure, flow speed, gravity, fuel, diluent, outcome, test id.
- Converts units: psia/atm/bar/Pa → kPa, mole-fraction → %, mm/s or m/s → cm/s.
- Keeps every unmapped column verbatim and records the source file name for citations.
- Nothing is invented; a column it can't map is kept but ignored for scoring.

After importing, check `GET /api/health` (or the Data Lab) — the investigation should show real test
records, and material/investigation grades near those tested conditions become **A** or **B**.
