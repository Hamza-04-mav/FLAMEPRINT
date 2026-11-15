/**
 * Greedy screen-space label placement with collision avoidance (Gaps 3D view).
 * Labels are placed in priority order (lower number first). Each tries a few offsets around its anchor;
 * the first that stays inside the bounds and clear of exclusion zones and already-placed labels wins.
 * A label placed away from its default spot gets a leader line. Labels that fit nowhere are hidden,
 * except priority 0 (the user's scenario), which is always shown, clamped into bounds.
 */
/** `fixed` labels (axis titles, ticks, value chips) only sit centred on their anchor, or hide on collision. */
export interface LabelIn { id: string; x: number; y: number; w: number; h: number; priority: number; fixed?: boolean }
export interface LabelOut { id: string; left: number; top: number; leader: boolean; anchorX: number; anchorY: number }
export interface Rect { x: number; y: number; w: number; h: number }

const GAP = 10;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function placeLabels(labels: LabelIn[], bounds: { w: number; h: number }, exclude: Rect[] = []): LabelOut[] {
  const placed: Rect[] = [];
  const out: LabelOut[] = [];
  const sorted = [...labels].sort((a, b) => a.priority - b.priority);
  for (const l of sorted) {
    const cands: [number, number, boolean][] = l.fixed ? [[l.x - l.w / 2, l.y - l.h / 2, false]] : [
      [l.x - l.w / 2, l.y - l.h - GAP, false], // above (default)
      [l.x + GAP + 4, l.y - l.h / 2, true], // right
      [l.x - l.w - GAP - 4, l.y - l.h / 2, true], // left
      [l.x - l.w / 2, l.y + GAP, true], // below
      [l.x - l.w / 2, l.y - l.h - GAP * 4, true], // high above
      [l.x + GAP * 3, l.y - l.h - GAP * 3, true], // up-right
      [l.x - l.w - GAP * 3, l.y - l.h - GAP * 3, true], // up-left
    ];
    let chosen: [number, number, boolean] | null = null;
    for (const c of cands) {
      const r = { x: c[0], y: c[1], w: l.w, h: l.h };
      const inside = r.x >= 4 && r.y >= 4 && r.x + r.w <= bounds.w - 4 && r.y + r.h <= bounds.h - 4;
      if (inside && !exclude.some((e) => overlaps(r, e)) && !placed.some((p) => overlaps(r, p))) { chosen = c; break; }
    }
    if (!chosen && l.priority === 0) {
      const x = Math.min(Math.max(l.x - l.w / 2, 4), bounds.w - l.w - 4);
      const y = Math.min(Math.max(l.y - l.h - GAP, 4), bounds.h - l.h - 4);
      chosen = [x, y, true];
    }
    if (!chosen) continue;
    placed.push({ x: chosen[0], y: chosen[1], w: l.w, h: l.h });
    out.push({ id: l.id, left: chosen[0], top: chosen[1], leader: chosen[2], anchorX: l.x, anchorY: l.y });
  }
  return out;
}
