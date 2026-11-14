/** Visual environment for each mission preset. Drives the 3D hero scene and the cosmic backdrop. */
export type Environment = "lunar" | "mars" | "orbit" | "earth";

export function environmentFor(habitatId: string, gravityG: number): Environment {
  if (habitatId === "mars") return "mars";
  if (habitatId === "iss") return "orbit";
  if (habitatId === "earth") return "earth";
  if (habitatId === "lunar-base" || habitatId === "rover" || habitatId === "suit") return "lunar";
  // custom scenarios: pick by gravity
  if (gravityG < 0.05) return "orbit";
  if (gravityG < 0.25) return "lunar";
  if (gravityG < 0.6) return "mars";
  return "earth";
}

export const ENV_LABEL: Record<Environment, string> = {
  lunar: "Lunar surface", mars: "Martian surface", orbit: "Low Earth orbit", earth: "Earth reference",
};

/**
 * Cosmic-backdrop scene per environment — on the "Ink sun" palette (navy + taupe only).
 * `sky` is the full-viewport tint (crossfaded 600ms on habitat switch); `limb`/`glow`
 * colour the moon/planet horizon arc; `crater` adds faint craters (lunar/mars surfaces);
 * `near` draws the very-close crater rim for the spacesuit. Moon = grey taupe arc,
 * Mars = warmer taupe, ISS/Earth = a lighter-navy Earth limb. No blue, no rainbow.
 */
export const ENV_TINT: Record<Environment, { limb: string; glow: string; sky: string; crater: boolean }> = {
  lunar: { limb: "#8a8178", glow: "rgba(194, 186, 176, 0.16)", sky: "radial-gradient(130% 90% at 72% -12%, #1a2135 0%, #0c1322 46%, #0a111d 100%)", crater: true },
  mars:  { limb: "#a08a76", glow: "rgba(200, 170, 148, 0.16)", sky: "radial-gradient(130% 90% at 72% -12%, #211f2c 0%, #0f1322 46%, #0a111d 100%)", crater: true },
  orbit: { limb: "#3a4b6e", glow: "rgba(96, 126, 176, 0.18)", sky: "radial-gradient(130% 90% at 72% -12%, #142241 0%, #0b1322 46%, #0a111d 100%)", crater: false },
  earth: { limb: "#3a4b6e", glow: "rgba(96, 126, 176, 0.16)", sky: "radial-gradient(130% 90% at 72% -12%, #142241 0%, #0b1322 46%, #0a111d 100%)", crater: false },
};
