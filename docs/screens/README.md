# Before / after: the declutter pass

Screenshots of every page at **1440×900** and **390×844** (`before/` and `after/`), captured with headless Chrome
on the Moon base preset with `FLAMEPRINT_LLM=off` and the seed catalog (material thresholds not loaded yet).
`after/passport_lunar-base.pdf` is the printed Fire Passport (one page).

## Content budget, measured at 1440×900

Panels = top-level cards visible above the fold (budget 3). List = longest visible list (budget 5 before "Show more").
Words = visible words above the fold. No page scrolls sideways at 390 px; at most one WebGL canvas per page
(the starfield backdrop is Canvas 2D).

| Page | Panels above fold | Longest list | Words above fold | Page height | Budget |
|---|---|---|---|---|---|
| Answer (home) | 6 → **2** | 8 → **5** | 249 → **145** | 1483 → **982** px | within budget |
| Evidence | 1 → **1** | 22 → **5** | 213 → **138** | 1966 → **900** px | within budget |
| Gaps | 3 → **3** | 6 → **3** | 335 → **195** | 1747 → **1041** px | within budget |
| Brief | 3 → **3** | 0 → **4** | 139 → **213** | 1165 → **962** px | within budget |
| Compare | 6 → **2** | 10 → **3** | 212 → **149** | 1244 → **900** px | within budget |
| Compare · experiments | 2 → **2** | 4 → **4** | 145 → **154** | 1780 → **1774** px | within budget |
| Tools · Stowage | 2 → **2** | 8 → **5** | 172 → **115** | 942 → **900** px | within budget |
| Tools · Data Lab | 5 → **2** | 4 → **0** | 181 → **131** | 1135 → **900** px | within budget |
| Tools · Ask | 1 → **1** | 0 → **0** | 107 → **87** | 900 → **900** px | within budget |
| Tools · Down to Earth | 2 → **2** | 4 → **3** | 186 → **174** | 2286 → **1391** px | within budget |

Brief has *more* words now on purpose: before, it showed three empty "Awaiting generation" placeholders until you
clicked a button; now it shows the cited guidance straight away.

## What moved where (nothing was deleted)

| Was on | Now |
|---|---|
| Home: gaps, next tests | Gaps page |
| Home: brief preview, On Earth | Brief page |
| Home: sliders | Answer → "Adjust conditions" |
| Home: materials 6–8, 3D scene | Answer → "Show all materials", "View habitat in 3D" |
| Rankings: rows 6–22, weights, formula | Evidence → "Show all 22", "Adjust scoring" |
| Data map: inspector, schematic curve, legend, all-habitat list | Gaps → "Show details"; 3D → "Explore in 3D" |
| Compare experiments (own page) | Compare → "Compare experiments" toggle (`#genome` still works) |
| Stowage, Data Lab, Ask, Down to Earth (sidebar) | Tools menu |
| Header dials, sidebar status cards | One habitat pill; one status line |
