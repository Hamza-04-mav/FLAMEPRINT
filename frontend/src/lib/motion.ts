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
