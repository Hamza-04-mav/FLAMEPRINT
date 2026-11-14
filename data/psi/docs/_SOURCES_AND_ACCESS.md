# FLAMEPRINT real-data sources & access findings

Compiled 2026-11-14. This folder (`data/psi/docs/`) holds real NASA source text; `.txt`/`.md`/`.pdf`
files here are indexed for retrieval ("Ask the archive", citations) per `data/psi/README.md`.

## Critical finding: PSI combustion _test records_ are NOT bulk-accessible

- The PSI web repository (https://psi.nasa.gov/physci/repo) is an **Angular single-page app**.
  Its data loads via an internal API; raw test-record download generally requires a PSI account.
  Page scraping returns only an empty shell.
- The **public AWS Registry of Open Data bucket** `s3://nasa-psi` (us-west-2, CC0, no login)
  contains only `DSI/`, `OASIS/`, and `pk4/` — i.e. Directional Solidification, smectic liquid
  crystals, and Plasma Kristall. **No combustion data.** Verified by listing the bucket over HTTPS.
- Consequence: we currently have **zero test-level combustion rows** we can legally auto-ingest.
  Getting A-grade records needs either (a) a PSI account + manual export, or (b) published
  per-experiment data tables from papers. Until then, grades stay B/C/M by design.

## What IS available and has been saved here

All sources are stored as **.txt** (best for RAG; no PDF duplication). Full-fidelity extraction:
narrative/overview pages via direct HTML text extraction; the mini-book via full 56-page text extraction.

| File                                | Source                                                                              | Use                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `researchers-guide-combustion.txt`  | NASA "Combustion in Reduced Gravity" ISS mini-book (2015), full 56 pp (~110k chars) | Authoritative investigation conditions, PIs, findings |
| `glenn-combustion-science.txt`      | nasa.gov/glenn/.../combustion-science                                               | Current + archived experiments; CIR/MDCA/FCF facts    |
| `apollo-1-fire.txt`                 | sma.nasa.gov/.../apollo-1                                                           | Prevention (atmosphere + materials), egress           |
| `apollo-13-oxygen-tank.txt`         | sma.nasa.gov/.../apollo-13                                                          | Oxygen-system / electrical-thermal safety             |
| `mir-fire-1997.txt`                 | nasa.gov/history/.../mir                                                            | In-orbit fire, detection, suppression, redundancy     |
| `spinoff-firefighter-air-tanks.txt` | spinoff.nasa.gov/node/9582                                                          | Earth spinoff (responder breathing)                   |
| `spinoff-fire-detector.txt`         | spinoff.nasa.gov/node/9407                                                          | Earth spinoff (detection, false alarms)               |
| `spinoff-firefighter-attire.txt`    | spinoff.nasa.gov/node/9918                                                          | Earth spinoff (fire-resistant materials)              |

## Real investigation facts extracted (for seed upgrade)

From the Researcher's Guide + NASA Glenn combustion page (verify against PSI before marking A):

- **MDCA / droplet combustion (CIR):** droplets 1-5 mm, 0-3 atm ambient, up to 40% O2 by volume,
  balance inert (N2/CO2/He/Xe).
- **FLEX:** n-heptane + methanol droplets; diluents N2, CO2, He, **Xe**. Key finding: flammability
  limit is _lower_ in reduced gravity -> terrestrial inert-gas suppressant margins don't hold in
  low-g. (Fig: n-heptane in 70% CO2 / 21% O2 / bal N2, translated 3 cm/s.)
- **FLEX-2:** fuel mixtures, surrogates, soot, slow sub-buoyant flow, droplet arrays.
  (Fig: ethanol in 30% O2 at 2.4 atm.)
- **SoFIE** (Solid Fuel Ignition & Extinction, active ISS; not yet in seed): larger improved flow
  duct (BASS lineage); O2 10-40% vol, pressure 0.2-1.5 atm. NASA-STD-6001 1-g test may not be
  conservative in low gravity.
- **FLARE** (Flammability Limits At Reduced-g; not yet in seed): estimates microgravity
  flammability limits from ground data; JAXA/NASA/ESA/CNES/DLR collaboration.
- **FM2** (Flammability of Materials on the Moon): REAL named experiment — first combustion
  experiment on the Moon, lunar gravity (1/6 g), SIBAL cotton-fiberglass fabric; ground-simulated
  in a drop-tower centrifuge. (Seed currently models it as a TBD placeholder.)
- **BASS:** MSG; ~10 cm/s flow; hypothesis that microgravity materials with adequate ventilation
  burn as well or better than in normal gravity.
- **Facilities:** CIR = 100-liter chamber in Destiny lab, launched Nov 2008 on STS-126; MDCA runs
  in CIR; FCF houses CIR + MDCA.
- **Real PIs:** SPICE/SLICE—D.L. Urban (GRC)/M.B. Long (Yale); BRE—J.G. Quintiere (Maryland);
  CLD Flame—M.B. Long (Yale); E-FIELD—D. Dunn-Rankin (UC Irvine, up to 10 kV); Flame Design—
  R.L. Axelbaum (Washington U.); s-Flame—C.K. Law (Princeton); LSP—G. Faeth (Michigan).

## Not yet fetched

- ScienceCasts video (youtube W1oXykoz9zg): transcript not machine-fetchable without audio; skipped.
- PSI per-investigation metadata pages (blocked by SPA/API).
