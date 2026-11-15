/**
 * One motion vocabulary for the whole app (Phase 7).
 * Spring: stiffness 260, damping 30. Durations: micro 150ms, standard 280ms,
 * page 450ms. Easing: cubic-bezier(0.22, 1, 0.36, 1).
 * prefers-reduced-motion is honoured globally via <MotionConfig reducedMotion="user">
 * plus useReducedMotion() guards on parallax, tilt, camera and glow-breathing.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

export const DUR = { micro: 0.15, standard: 0.28, page: 0.45 } as const;

export const microT = { duration: DUR.micro, ease: EASE };
export const standardT = { duration: DUR.standard, ease: EASE };
export const pageT = { duration: DUR.page, ease: EASE };

/** Content enter/exit for a view: fade + a 12px slide. */
export const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** Stagger helper: 30ms between list items. */
export const stagger = (i: number, base = 0) => base + i * 0.03;

/* ── Cinematic pass (owner-approved exception to the 150–300 ms budget: Answer journey + Gaps morph only) ── */

/** Gaps 2D entrance and data motion. */
export const CHART = {
  axes: 0.45, // axis lines draw in
  grow: 0.5, // each tested range grows from the baseline
  stagger: 0.04, // between tested ranges
  hatch: 0.35, // untested hatch fades in
  trail: 0.6, // habitat dot's fading trail
  connector: 0.5, // dashed gap connector draws on
} as const;

/** A soft drop with one small overshoot (habitat dot landing, orb settling). */
export const DROP = { type: "spring", stiffness: 180, damping: 14, mass: 0.9 } as const;

/** 2D ↔ 3D morph on the Gaps page (seconds); the SVG crossfades only in the first/last `fade`. */
export const MORPH = { duration: 0.7, fade: 0.15, flyTo: 0.6 } as const;

/** Habitat journey on the Answer page (seconds). */
export const JOURNEY = {
  desktop: 2.1, // adjacent hop / transit
  hero: 2.4, // Moon base → Suit gets the most screen time
  mobile: 1.2, // under 768 px
  hold: 1.6, // Play mode: read the verdict before the next hop
  mobileBreakpoint: 768,
  /** Overlay is opaque until this progress, then dissolves into the page (hand-off to the backdrop horizon). */
  dissolveFrom: 0.86,
  /** The destination planet starts settling onto the backdrop's horizon at this progress. */
  handoffFrom: 0.74,
  /** Actors (astronaut, rover, station…) fade out over this window, before the dissolve, so only the planet blends into the page. */
  actorsOut: [0.78, 0.9] as const,
} as const;

/** Ease-in-out with a touch of overshoot for camera moves (cubic). */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number, k = 1.2) => 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);

/* ── Animation pass v2: one site-wide motion vocabulary (owner-approved exception to the 150–300 ms budget) ── */

/** Section reveal: fade + rise as a panel/card/row enters the viewport, once. */
export const REVEAL = { rise: 24, duration: 0.45, stagger: 0.05, maxStagger: 0.25 } as const;
/** Headline type-in with a brief scramble; total stays under 600 ms. */
export const TYPE = { total: 0.55, scramble: 0.12 } as const;
/** Count-up from zero to the real value, once on first view. */
export const COUNT = { duration: 0.9 } as const;
/** Scroll-linked depth (px of travel per px scrolled) and ambient star drift (seconds per cycle). */
export const PARALLAX = { far: 0.02, mid: 0.05, near: 0.09, horizon: 0.06, drift: 140 } as const;
/** Answer hero travel (seconds); `travel` overrides JOURNEY for the in-hero sequence. */
export const TRAVEL = { desktop: 2.0, mobile: 1.2, settle: 0.9 } as const;
