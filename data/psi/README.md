# Drop official NASA PSI files here

Everything in this folder (including subfolders) is parsed when the backend starts, or when you
press **Reload** in the Data Lab or call `POST /api/reload`.

| File type | What FLAMEPRINT does with it |
|---|---|
| `.csv` `.tsv` `.xlsx` | Test records. Columns are matched automatically (O₂, pressure, flow, gravity, fuel, diluent, outcome, test id) and units are converted (psia/atm/bar/Pa → kPa, fraction → %, mm/s / m/s → cm/s). |
| `.json` | Investigation metadata (overrides the seed catalog by `id`) and/or test records. See `data/templates/`. |
| `.pdf` `.txt` `.md` | Indexed for retrieval ("Ask the archive", citations). With an API key, the Data Lab can also extract structured metadata from them. |

**Investigation assignment:** add an `investigation` column, or name the file after the
investigation (`BASS-II_tests.csv`, `flex2-matrix.xlsx`), or put the files in a folder named
after it (`psi/SAFFIRE-II/...` only works through the file name, so prefer the column).

Nothing is invented. Unmapped columns are kept verbatim, and every record keeps its source file
name so the UI can cite it.
