# FLAMEPRINT — UI/UX audit (Phase 0)

> Read-only audit of the presentation layer before any redesign. **No scoring math, data, or
> deterministic logic is in scope.** This is the baseline the UI/UX upgrade works against.
>
> Author: Claude (with Zaki) · Date: 2026-11-14 · Branch: `feat/ui-ux-upgrade` (from `origin/main`)

---

## 1. Stack, styling and libraries

| Concern            | What's used                                                                                                                                    | Where                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Framework / router | **Next.js 15.5.29**, App Router, React **19.1.0**, TypeScript 5                                                                                | `frontend/src/app/`                                |
| Rendering model    | Single client dashboard: `app/page.tsx` is a `"use client"` SPA shell; only `/passport` is a second route                                      | `app/page.tsx`, `app/passport/page.tsx`            |
| Styling system     | **Tailwind CSS v4** via `@tailwindcss/postcss`, config-in-CSS (`@theme` block). No `tailwind.config.js`.                                       | `app/globals.css`, `postcss.config.mjs`            |
| Design tokens      | CSS custom properties in `@theme` (colors, fonts) + a `:root` block for evidence/line tokens                                                   | `app/globals.css:9-85`                             |
| Animation          | **framer-motion 14.13** (`motion`, `AnimatePresence`, `LayoutGroup`, `MotionConfig`, `useMotionValue`, `useTransform`, `useReducedMotion`)     | throughout                                         |
| 3D                 | **three 0.187**, **@react-three/fiber 9.8**, **@react-three/drei 10.7** (`Html`, `Line`, `OrbitControls`, etc.)                                | `MissionScene3D`, `ConditionSpace3D`, `FlameMorph` |
| Icons              | **lucide-react 1.72**                                                                                                                          | throughout                                         |
| Charts             | **Hand-rolled SVG** (no chart lib): `FlammabilityMap` (2D O₂×flow), `Genome` (SVG graph), `ui.tsx` `Ring`/`Gauge`/`Counter`, `CoveragePreview` | see §2                                             |
| Markdown           | **react-markdown 10** (brief/ask streams)                                                                                                      | `CitedMarkdown`, `BriefPanel`, `AskPanel`          |
| Fonts              | `next/font/google`: **Inter** (sans), **Space Grotesk** (display), **JetBrains Mono** (mono)                                                   | `app/layout.tsx:2-7`                               |
| Tests              | vitest (`lib/lib.test.ts`)                                                                                                                     | `frontend/src/lib/`                                |

**Token system today.** Tailwind v4 `@theme` defines named colors (`--color-blue`, `--color-ox`,
`--color-flame-1..3`, `--color-ink`, `--color-mute`, `--color-ok`, `--color-danger`), re-tinted
`slate-*`, and remapped semantic ramps (`amber-*`, `emerald-*`, `rose-*`, `orange-*`, `sky-*`,
`cyan-*`, plus `indigo/violet/pink` all **aliased to cyan** — a sign hues were already being
collapsed by hand). Evidence tokens live in `:root`: `--ev-psi`, `--ev-catalog`, `--ev-estimate`,
`--ev-illustrative`, `--line`, `--line-strong`. Utility classes: `.panel`, `.panel-glow`, `.well`,
`.btn/.btn-primary/.btn-outline/.btn-ghost`, `.chip-link`, `.label/.kicker`, `.flame-text`,
`.hatch`, `.holo`, `.hud-frame`, `.skeleton`, `.led`, `.rule`.

**The gap:** the token layer exists but is **not enforced**. Dozens of components bypass it with raw
hex (see §3). Grade/level/phase/outcome/severity/pillar color maps are defined _in TypeScript_ with
literal hex, duplicating values that also live in CSS — the same color is spelled in two places and
can drift.

---

## 2. Routes and components (file map)

**Routes (2):** `app/page.tsx` (dashboard shell, tab-switched) · `app/passport/page.tsx` (printable
light Fire Passport).

**Shell:** `page.tsx` → `CosmicBackdrop`, `Sidebar` (+`MobileNav`, `Logo`, `LogoMark`, `NAV`),
`Header` (`MissionPicker`, `StatusPopover`, `PlanetGlyph`), `MissionConfig` (scenario sheet),
`InvestigationDrawer` (dossier), `Boot` (intro). Tab body is one of the page components below.

| Tab (`Tab` id)        | Page component                         | Role           | Heavy deps                                                                                                                |
| --------------------- | -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `answer`              | `AnswerScreen`                         | Home / verdict | `FlameMorph` (WebGL), `MissionScene3D` (WebGL, opt), `MissionTimeline`, `FlameCanvas` (2D), `StowageSearch`, `GradeBadge` |
| `ranking`             | `Ranking`                              | Evidence       | factor bars, `InvestigationDrawer`                                                                                        |
| `space`               | `SpaceView`                            | Gaps           | `FlammabilityMap` (2D SVG), `ConditionSpace3D` (WebGL, opt)                                                               |
| `brief`               | `BriefPanel`                           | SI brief       | `CitedMarkdown`, SSE stream, brief-cards                                                                                  |
| `habitats` / `genome` | `CompareHabitats` (+`Genome` embedded) | Compare        | `Genome` SVG graph                                                                                                        |
| `stowage`             | `StowageInspector` (+`StowageSearch`)  | Tool           | —                                                                                                                         |
| `data`                | `DataLab`                              | Tool           | upload/ingest                                                                                                             |
| `ask`                 | `AskPanel`                             | Tool           | SSE stream                                                                                                                |
| `earth`               | `EarthPanel`                           | Tool           | `PlanetGlyph`-style SVG                                                                                                   |

**Shared libs:** `lib/mission.tsx` (state provider, debounced `/api/analyze`, tab routing,
gravity default `0.165`), `lib/api.ts` (REST + SSE), `lib/answer.ts` (`LEVEL_STYLE`, `GRADE_STYLE`,
`buildVerdict`, `rankReason`, `fmtPressure`), `lib/format.ts` (unit conversion, `fmtRange`,
color maps: `PHASE_COLOR`, `OUTCOME_COLOR`, `SEVERITY_*`, `PILLAR_COLOR`, `scoreColor`),
`lib/space.ts`, `lib/environment.ts`, `lib/webgl.ts` (`useWebGL`, `useInView`), `lib/types.ts`.
`ui.tsx` holds the shared primitives (`PageHeader`, `Ring`, `Gauge`, `Slider`, `Toggle`, `Counter`,
`Evidence`/`EvidenceMark`, `ConfidenceBadge`, `Pill`, `Skeleton`, `ErrorNote`).

**Dead/legacy (per CONTEXT.md):** `Overview.tsx`, `CoveragePreview.tsx` — v1 home, unused, kept until
v2 accepted. Both carry large hex payloads (§3). Candidate for deletion in a late phase.

---

## 3. Hard-coded colors (must move to tokens)

Raw color literals were found in **26 files**, ~**240 hex occurrences** (grep: `#[0-9a-fA-F]{3,8}`),
plus TS color maps and a few Tailwind utility classes. Everything below bypasses the token layer.

**TS color maps (literal hex, duplicate the CSS tokens):**

- `lib/answer.ts:4-16` — `LEVEL_STYLE` (`#FF5A4E/#FFC15B/#34D399/#7E94B4`) and `GRADE_STYLE`
  (`A #34D399, B #3D9BFF, C #FFC15B, M #7E94B4`). **Note:** `B` here is `#3D9BFF` but CSS `--color-blue`
  is `#087BFF` and the slider/header use `#087BFF` — grade-blue and brand-blue already disagree.
- `lib/format.ts:19-53` — `PHASE_COLOR`, `OUTCOME_COLOR`, `SEVERITY_STYLE`, `SEVERITY_COLOR`,
  `PILLAR_COLOR`, `scoreColor()` ladder. All literal hex.
- `components/ui.tsx` — `Ring`/`Gauge` default `#19C9FF`, `Gauge` ladder `#19C9FF/#FFC15B/#FF8B32`,
  `EVIDENCE.unknown.color = #64748b` (the only evidence color _not_ a token), `Pill` cyan `#9BE6FF`.

**Per-file literal-hex hotspots (component inline styles / SVG fills / three.js materials):**

| File                                                                                                                                                                                                                                                     | ~count    | Nature                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `MissionScene3D.tsx`                                                                                                                                                                                                                                     | ~60       | three.js material colors (lunar/mars/orbit palettes, rover, flame)       |
| `ConditionSpace3D.tsx`                                                                                                                                                                                                                                   | ~30       | three.js + `Html` label border/bg hex (`#FF8B32`, `#48BFFF`, `#1a0f06`…) |
| `Overview.tsx` (dead)                                                                                                                                                                                                                                    | ~25       | legacy home visuals                                                      |
| `SpaceView.tsx`                                                                                                                                                                                                                                          | ~12       | inline `tone` hex, legend LED colors `#087BFF/#FF8B32`                   |
| `Header.tsx`                                                                                                                                                                                                                                             | ~18       | `PlanetGlyph` body gradients + `StatusPopover` row colors                |
| `FlammabilityMap.tsx`                                                                                                                                                                                                                                    | ~15       | SVG rect fills `#34D399/#3D9BFF`, mission dot `#FF8B32`, curve `#48BFFF` |
| `Genome.tsx`                                                                                                                                                                                                                                             | ~18       | node/edge fills and strokes                                              |
| `BriefPanel.tsx`, `EarthPanel.tsx`, `CompareHabitats.tsx`, `Ranking.tsx`, `ScenarioBuilder.tsx`, `CoveragePreview.tsx` (dead), `CitedMarkdown.tsx`, `InvestigationDrawer.tsx`, `Boot.tsx`, `MissionConfig.tsx`, `CosmicBackdrop.tsx`, `AnswerScreen.tsx` | 2–10 each | inline `style={{ color/background }}`, gradient stops, risk hex          |

**Tailwind color-utility classes** (fewer, but present): `text-orange-100/200`, `text-emerald-100/200`,
`bg-flame-2/[0.07]`, `fill-orange-100`, `fill-[#48BFFF]`, `border-[#FF8B32]/60` etc. in
`format.ts`, `SpaceView`, `ConditionSpace3D`, `FlammabilityMap`. Most `amber/emerald/rose/orange`
utilities already resolve to tokens via the `@theme` remap, so they're lower-priority; the arbitrary
`[#hex]` classes are not and must move.

**Recommendation:** one source of truth. Define the full palette (surfaces, brand, **grade A/B/C/M**,
**risk high/elevated/low/unknown**, evidence classes, phase/outcome) as CSS tokens, then derive the TS
maps from `var(--…)` (or a single generated constants module) so hex appears **once**. three.js colors
can read the same constants via a small `tokens.ts` export (three needs JS values, not CSS vars).

### Hue-count problem (known issue #1)

Colors currently carry meaning on **six+ axes** at once: brand blue (`#087BFF`), cyan (`#19C9FF`),
flame amber/orange (`#FFC15B/#FF8B32`), danger red (`#FF5A4E`), verified green (`#34D399`), grey
(`#7E94B4`), plus grade-blue (`#3D9BFF`) as a seventh near-duplicate. A viewer can't tell whether blue
means "science", "prevention pillar", "grade B", or "pressure slider" — it means all four. Target: the
**3-color system** ("Ink sun", to be supplied) with each hue owning exactly one meaning, and
grade/risk expressed by a small fixed ramp + shape, not by adding hues.

---

## 4. Fonts

Three families, loaded once in `app/layout.tsx` and exposed as `--font-inter / --font-grotesk /
--font-jetbrains`, mapped in `@theme` to `--font-sans / --font-display / --font-mono`.

- **Inter** → body / UI text (`.font-sans`, default on `body`).
- **Space Grotesk** → display/headlines (`.font-display`, `font-display` utility).
- **JetBrains Mono** → labels, numeric readouts, kickers (`.font-mono`, `.label`, `.kicker`,
  `tabular-nums`).

No other `font-family` declarations exist; the passport reuses `--font-sans`. This is already clean and
consistent — **keep the three roles**, only revisit sizes/weights for the "5-second read" hierarchy.
CONTEXT rule 9 allows "two type weights (semibold + normal)"; code uses `font-semibold`, `font-medium`,
`font-bold`, `font-normal` — a small drift to tighten.

---

## 5. Text that could be a visual (known issues #2, #3, #4)

| Place                                                     | Today (text)                                                                                                                     | Could be                                                                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Answer home, first paint** (`AnswerScreen`→`Materials`) | Empty state leads with _"Thresholds not loaded yet"_ and 5 cards each reading **"Not rated"** — the first thing seen is absence. | Lead with the **visual answer**: where the habitat sits vs. tested ranges (a small inline version of the O₂×flow map), and treat "not rated" as one _designed_ state, not five identical grey cards. |
| **Evidence rows** (`Ranking`, `rankReason`)               | Repeats _"Tested solid fuels near your airflow."_ on multiple rows — identical sentences.                                        | Per-row **coverage strip** (O₂ / pressure / flow bars showing how each row overlaps the mission), sentence only as caption.                                                                          |
| **Grade badges** (`GradeBadge`)                           | `C` / `M` stamps with **no inline legend**; meaning is only in the status popover (`GRADE_STYLE.meaning`).                       | Legend/tooltip at point of use; make the four grades self-explanatory with a persistent key and on-hover reason.                                                                                     |
| **Verdict confidence** (`buildVerdict`)                   | One prose sentence; fine, but the grade letter has no visual scale.                                                              | Keep sentence, add a 4-step A→M scale marker so "how sure" is seen, not read.                                                                                                                        |
| **Gaps panel** (`SpaceView`)                              | Good concept ("Untested is not the same as safe") but conveyed mostly in paragraphs + a side list of counts.                     | Promote the map; counts become small bracket bars.                                                                                                                                                   |

Keep (do not strip): sidebar items phrased as questions (`NAV[].question`), the _"Untested is not the
same as safe"_ framing, and the `Evidence` / `illustrative` honesty tags — **restyle, keep the honesty.**

---

## 6. Responsive behaviour today (390 / 768 / 1280 / 1600)

Layout spine: fixed sidebar (`lg:w-[76px]` rail, `xl:w-[252px]` full); main column `max-w-[1200px]`
with `lg:pl-[76px] xl:pl-[252px]`. Breakpoints are Tailwind defaults (sm 640, md 768, lg 1024, xl 1280).

- **390 px (mobile):** Sidebar hidden; hamburger → `MobileNav` drawer (272px). Main is single-column
  (`px-4`). AnswerScreen reorders (verdict+flame first). **Risks:** header pill (`MissionPicker`) shows
  a long mono string `30% O₂ · 10.2 psi · 0.17 g` — on small widths the `sm:inline` secondary string is
  hidden, good, but the pill + status button + hamburger can still crowd at ≤360px. 3D `Html` labels and
  the 2D map's fixed `text-[14-17px]` SVG labels don't scale down. Sliders in a 2-col grid
  (`grid-cols-2`) are tight. Verdict headline `text-[28px]` is okay.
- **768 px (tablet):** Still below `lg` → **sidebar is hidden**, full-width content with hamburger. A lot
  of horizontal space goes unused (no rail yet). AnswerScreen hero grid is single-col until `lg`.
- **1280 px (`xl`):** Full sidebar appears; main capped at 1200. This is the design target and looks
  intended. 3D view tabs ("Missi…") and the Gaps legend are where overlap/clipping shows (see §9).
- **1600 px:** Content stays at 1200 centered; large side gutters. Acceptable but the fixed cap leaves
  wide empty margins — the hero could breathe more.

**Summary:** desktop-first; the **768–1023 band is the weakest** (sidebar gone, no rail), and SVG/3D
text labels use fixed px that don't adapt. Mobile reflow logic exists and mostly works.

---

## 7. Accessibility gaps

- **Contrast:** `text-slate-500` (`#7E94B4`) on `space-950`/panel is used for a lot of secondary and
  footer text (sidebar `Status`, page footers, hints, `text-[10.5-11.5px]`). At those small sizes this
  is likely **below WCAG AA**. Needs a contrast pass (bump to `slate-400`/`mute` or larger size).
- **Charts / 3D have no text alternative:** `FlammabilityMap`, `ConditionSpace3D`, `MissionScene3D`,
  `Genome`, `Ring`/`Gauge` convey data purely visually. SVG `<title>` exists on some marks (good for
  hover tooltips) but there's no `role="img"` + `aria-label` summary, no data-table fallback. `FlameMorph`
  hero is decorative-ish but unlabeled beyond the section `aria-label="Gravity flame"`.
- **Focus states:** range inputs have `:focus-visible` outline (good). Most `.btn`/icon buttons rely on
  default focus; the nav uses `aria-current`. No global visible focus ring is defined for custom
  buttons/`chip-link`/`Toggle` — keyboard focus can be invisible on dark surfaces.
- **Color-only meaning:** risk level is shown by a 3px color bar + colored label text; grade by colored
  stamp. The `Evidence`/`EvidenceMark` system _does_ add shape (square/diamond/hatch/dashed) — that
  pattern should extend to risk/grade so meaning isn't color-only.
- **Keyboard:** popovers (`MissionPicker`, `StatusPopover`) close on Escape and outside-click (good);
  listbox roles present. 3D `OrbitControls` and canvas interactions are mouse-only.
- **Good already:** `prefers-reduced-motion` honored globally (`globals.css:298` + `MotionConfig
reducedMotion="user"` + `useReducedMotion`), `aria-live="polite"` on the verdict, semantic
  `aria-expanded/haspopup/selected`, WebGL fallbacks via `useWebGL`.

---

## 8. Performance risks

- **WebGL canvases:** `FlameMorph` (Answer hero, always mounted when WebGL+visible), `MissionScene3D`
  (Answer, opt-in), `ConditionSpace3D` (Gaps, opt-in). Mitigations already present: `dynamic(ssr:false)`,
  `useInView` gating, `useWebGL` fallback to 2D `FlameCanvas`, `still` on reduced-motion. CONTEXT rule 8
  ("≤1 WebGL canvas per page") is respected. **Watch:** the hero `FlameMorph` runs a GLSL shader +
  particles continuously while on screen; confirm it pauses off-screen/tab-blur.
- **Blur layers:** heavy `backdrop-filter: blur(14px) saturate(120%)` on **every `.panel`**, plus
  `backdrop-blur-xl` on sidebar, header pill, popovers, mobile overlay, and `Html` labels inside the 3D
  canvas. Many simultaneous blurred, semi-transparent stacked layers are a known mobile/low-GPU cost.
  Consider reducing blur radius or limiting blur to focal surfaces.
- **Looping decorations:** `.holo` sweep (10s infinite), `.skeleton` shimmer, `.caret` blink, Gaps 3D
  gap-volume pulse, `StatusPopover` ping. CONTEXT rule 9 says "no looping decoration except the flame" —
  `.holo` and any always-on shimmer are candidates to retire.
- **Re-analysis cadence:** `/api/analyze` is debounced 140ms on every scenario/weights change
  (`mission.tsx:101`) with `AbortController` — fine.
- **Bundle:** three + drei + fiber are the largest deps; already code-split via `dynamic`. No evidence of
  eager 3D import on first paint.

---

## 9. Specific defects to fix (from the brief, confirmed in code)

| #   | Issue                                                                   | Confirmed location                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Too many hues, color meaning overloaded                                 | §3; `globals.css`, `answer.ts`, `format.ts`                                                                                                                                        |
| 2   | Answer leads with absence (5× "Not rated", "Thresholds not loaded yet") | `AnswerScreen.tsx:149-161` (`Materials`), `buildVerdict` empty branch `answer.ts:38-40`                                                                                            |
| 3   | Evidence rows repeat the same sentence                                  | `Ranking.tsx` + `rankReason` (`answer.ts:52-67`)                                                                                                                                   |
| 4   | Grade badges `C`/`M` have no inline legend                              | `GradeBadge.tsx`; meaning only in `StatusPopover`                                                                                                                                  |
| 5   | **Gravity shown two ways:** header/pill `0.17 g`, slider `0.165 g`      | `AnswerScreen.tsx:42` & `Header.tsx:61` use `+g.toFixed(2)`; `AnswerScreen.tsx:76` slider uses `g.toFixed(3)`; flame caption `toFixed(2)` (`:104`). **No shared `formatGravity`.** |
| 6   | Grammar: _"1 investigations"_                                           | `SpaceView.tsx:209-212` (`${cov.o2Hits.length} investigations`) and similar count renders — need a `plural()` helper                                                               |
| 7   | 3D labels overlap (Mars/Rover), legend/tabs clip ("Missi…")             | `ConditionSpace3D.tsx:50-56,102-107` (`Html` labels, no collision avoidance); view-tabs row `SpaceView.tsx:274-280` overlaps the top-left legend `:264-273`                        |
| 8   | Gaps chart: truncated label, 8-item legend                              | `FlammabilityMap.tsx:83` (`"schematic limit · illustrative"` can clip) and legend `:98-111` = 3 base + (PSI range + 4 outcomes) = **8 items** when `detailed`                      |
| 9   | Sidebar footer hidden under Next.js dev indicator                       | `Sidebar.tsx:133-136` (`Status` at `mt-auto`, bottom-left) collides with the Next dev badge; needs bottom safe-area padding                                                        |

**Fixed in the cinematic motion pass (2026-11-15):**

- **#7 (3D labels overlap, legend/tabs clip):** `ConditionSpace3D` labels moved out of drei `<Html>` into one HTML layer
  with priority-based collision avoidance and leader lines (`lib/labels.placeLabels`, tested); axis titles, ticks and the
  habitat's value chips are fixed labels that hide rather than overlap; the legend and view toggle share one wrapping row
  whose height is an exclusion zone for labels. Also fixed: clipped pressure ticks (now psi, inside an exact projected
  camera fit), the O₂ title colliding with the 30% tick, the scene sitting high and off-centre, and the console error
  "Attempted to synchronously unmount a root while React was already rendering" (caused by drei `<Html>`).
- **Gaps 2D:** y-axis title no longer clipped (left pad 74), tested ranges readable (stacked low-opacity fills, 1.25 px
  outlines), ghost-habitat names only on hover/focus so nothing overlaps the gap connector.
- **Hero flame:** the dark "fuel droplet" disc in `FlameMorph` (a hard-edged mask, visible at every gravity) replaced by
  a soft core.

**Keep-as-is (explicitly):** question-phrased nav, "untested ≠ safe", the evidence/illustrative tags
(restyle only).

---

## 10. Proposed phase plan (post-audit)

Commit after each phase; run `npm run typecheck && npm run lint && npm test && npm run build` (not while
`dev` is running) and the backend `pytest -q` each time. Presentation-layer only.

0. **Audit** — this document. _(no code)_
1. **Token foundation** — define the "Ink sun" 3-color system as the single source of truth (CSS tokens +
   a `tokens.ts` for three.js/TS maps); derive `LEVEL_STYLE`/`GRADE_STYLE`/`PHASE`/`OUTCOME`/etc. from it;
   add grade & risk _shape_ alongside color. Fix #1. No visual redesign yet — just de-duplicate.
2. **Formatting + copy correctness** — shared `formatGravity`, `plural()`, one place for the pill string;
   fix #5, #6. Tiny, high-trust.
3. **Shell & chrome** — sidebar (tablet rail at `md`, footer safe-area), header pill crowding, global
   focus ring, retire `.holo`/stray loops. Fix #9, a11y focus, perf blur pass.
4. **Answer home redesign** — lead with the visual answer; redesign "not rated" as one designed state;
   grade scale marker + inline legend. Fix #2, #4.
5. **Evidence + Gaps charts** — per-row coverage strips; 3D label collision/leader lines; collapse the
   Gaps legend to ≤4 + a "?" popover; fix truncation. Fix #3, #7, #8.
6. **Brief / Compare / Tools / Passport polish** — consistency pass to the new tokens; responsive 390/768.
7. **A11y + perf verification** — contrast sweep, chart `aria`/table fallbacks, measure at real widths;
   optionally delete `Overview.tsx`/`CoveragePreview.tsx`.

### Blocker before Phase 1

The pasted brief references a **"3-color system below" ("Ink sun" / Palette 5)** whose exact values were
**not included**. Phase 1 needs those three hex values (and whether grade/risk keep their current
A/B/C/M and high/elevated/low/unknown colors or fold into the new ramp). Flagged to confirm before
touching tokens.
