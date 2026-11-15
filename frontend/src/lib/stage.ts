"use client";

import { useRef } from "react";
import { useMission } from "./mission";

/**
 * The habitat the scenery shows. Custom conditions ("Adjust conditions" sliders) keep the last preset's scenery:
 * only the illustrative flame reacts to slider changes, never the hero body or the backdrop horizon.
 */
export function useStageHabitat(): string {
  const { scenario, habitats } = useMission();
  const last = useRef<string | null>(null);
  if (habitats.some((h) => h.id === scenario.habitatId)) last.current = scenario.habitatId;
  return last.current ?? (scenario.habitatId === "custom" ? "lunar-base" : scenario.habitatId);
}
