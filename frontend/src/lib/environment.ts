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

/** Horizon tint of the planet limb in the cosmic backdrop. */
export const ENV_TINT: Record<Environment, { limb: string; glow: string }> = {
  lunar: { limb: "#9aa6b8", glow: "rgba(150, 175, 210, 0.16)" },
  mars: { limb: "#c46a3f", glow: "rgba(255, 139, 50, 0.13)" },
  orbit: { limb: "#3f8cff", glow: "rgba(8, 123, 255, 0.2)" },
  earth: { limb: "#3f8cff", glow: "rgba(25, 201, 255, 0.16)" },
};
