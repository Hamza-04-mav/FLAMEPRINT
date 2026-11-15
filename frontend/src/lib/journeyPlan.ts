import { JOURNEY } from "./motion";

/** The five scenes of the Answer-page habitat journey. "transit" = generic jump; "to-earth" = calm pull-back. */
export type JourneyScene = "iss-moon" | "moon-suit" | "suit-rover" | "rover-mars" | "to-earth" | "transit";

export interface JourneyPlan {
  from: string;
  to: string;
  scene: JourneyScene;
  /** +1 forwards along the mission path, -1 backwards (the scene plays mirrored and time-reversed). */
  dir: 1 | -1;
  /** seconds */
  duration: number;
}

/** Mission path order, matching habitats.py `order`. */
export const PATH = ["iss", "lunar-base", "suit", "rover", "mars"] as const;
const PAIR: Record<string, JourneyScene> = {
  "iss>lunar-base": "iss-moon", "lunar-base>suit": "moon-suit", "suit>rover": "suit-rover", "rover>mars": "rover-mars",
};

/** Pure: which scene plays between two habitats, in which direction, and for how long. */
export function planJourney(from: string, to: string, viewportWidth = 1440): JourneyPlan | null {
  if (!from || !to || from === to) return null;
  const mobile = viewportWidth < JOURNEY.mobileBreakpoint;
  let scene: JourneyScene = "transit";
  let dir: 1 | -1 = 1;
  if (to === "earth") scene = "to-earth";
  else if (PAIR[`${from}>${to}`]) scene = PAIR[`${from}>${to}`];
  else if (PAIR[`${to}>${from}`]) { scene = PAIR[`${to}>${from}`]; dir = -1; }
  else {
    const a = PATH.indexOf(from as (typeof PATH)[number]), b = PATH.indexOf(to as (typeof PATH)[number]);
    if (a >= 0 && b >= 0 && b < a) dir = -1;
  }
  const duration = mobile ? JOURNEY.mobile : scene === "moon-suit" ? JOURNEY.hero : JOURNEY.desktop;
  return { from, to, scene, dir, duration };
}
