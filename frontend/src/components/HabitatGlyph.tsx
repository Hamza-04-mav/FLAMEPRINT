"use client";

import { ENV_TINT } from "@/lib/environment";
import { DUST, INK } from "@/lib/theme";

/**
 * One glyph per habitat, so the stepper is readable at a glance: station, dome, helmet, rover, Mars, Earth.
 * Dust taupe on ink only; the active stop gets the sun ring from the stepper, never here.
 */
export function HabitatGlyph({ id, size = 26 }: { id: string; size?: number }) {
  const s = DUST[300], d = DUST[500], f = INK[700];
  const common = { width: size, height: size, viewBox: "0 0 32 32", "aria-hidden": true } as const;
  switch (id) {
    case "iss": // station: truss, solar arrays, module
      return (
        <svg {...common}>
          <rect x="4" y="15" width="24" height="2" rx="1" fill={s} />
          <rect x="5" y="7" width="6" height="7" fill={f} stroke={s} strokeWidth="1" />
          <rect x="5" y="18" width="6" height="7" fill={f} stroke={s} strokeWidth="1" />
          <rect x="21" y="7" width="6" height="7" fill={f} stroke={s} strokeWidth="1" />
          <rect x="21" y="18" width="6" height="7" fill={f} stroke={s} strokeWidth="1" />
          <rect x="13" y="12.5" width="6" height="7" rx="1.5" fill={s} />
        </svg>
      );
    case "lunar-base": // dome on the surface, with an airlock
      return (
        <svg {...common}>
          <path d="M5 23 A11 11 0 0 1 27 23 Z" fill={f} stroke={s} strokeWidth="1.4" />
          <path d="M10 23 A6 6 0 0 1 22 23" fill="none" stroke={d} strokeWidth="1" />
          <rect x="24" y="19" width="4" height="4" fill={s} />
          <path d="M2 23 H30" stroke={d} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "suit": // helmet with visor
      return (
        <svg {...common}>
          <circle cx="16" cy="15" r="10" fill={f} stroke={s} strokeWidth="1.4" />
          <path d="M9 14 Q16 9 23 14 L22 19 Q16 22 10 19 Z" fill={d} />
          <path d="M11 14.5 Q14 12.5 17 12.8" stroke={DUST[100]} strokeWidth="1" fill="none" strokeLinecap="round" opacity=".8" />
          <path d="M8 26 Q16 30 24 26" stroke={s} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "rover": // pressurised rover
      return (
        <svg {...common}>
          <path d="M5 19 V14 Q5 11 8 11 H20 L25 15 H27 V19 Z" fill={f} stroke={s} strokeWidth="1.3" strokeLinejoin="round" />
          <rect x="16" y="12.5" width="4" height="3" fill={d} />
          {[9, 16, 23].map((cx) => <circle key={cx} cx={cx} cy="21.5" r="2.8" fill={INK[900]} stroke={s} strokeWidth="1.2" />)}
        </svg>
      );
    case "mars": // Mars disc with a dust band
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="10.5" fill={ENV_TINT.mars.limb} stroke={s} strokeWidth="1" />
          <path d="M7 14 Q12 12 16 14 T25 13" stroke={DUST[600]} strokeWidth="1.4" fill="none" opacity=".8" />
          <circle cx="12" cy="19" r="1.6" fill={DUST[600]} opacity=".7" />
          <circle cx="20" cy="20.5" r="1" fill={DUST[600]} opacity=".7" />
        </svg>
      );
    case "earth": // Earth limb with cloud bands (navy, as in the backdrop)
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="10.5" fill={ENV_TINT.earth.limb} stroke={s} strokeWidth="1" />
          <path d="M8 13 Q12 11 16 13 T24 12 M9 19 Q13 21 17 19 T24 20" stroke={DUST[200]} strokeWidth="1.1" fill="none" opacity=".55" />
        </svg>
      );
    default:
      return <svg {...common}><circle cx="16" cy="16" r="9" fill={f} stroke={s} strokeWidth="1.4" /></svg>;
  }
}
