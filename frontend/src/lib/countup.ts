/**
 * Count-up helpers. A count-up must end on the exact original text, so we parse the text, animate the number,
 * and format every intermediate value in the same shape (decimals, thousands separators, sign).
 */
const NUM = /^(-?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;

export interface ParsedNumber { value: number; decimals: number; grouped: boolean; text: string }

/** Only pure numbers count up ("1,248", "30", "10.2"); anything else (dates, "#1", "0.17 g") returns null. */
export function parseCountable(text: string): ParsedNumber | null {
  const t = text.trim();
  const m = NUM.exec(t);
  if (!m) return null;
  const value = Number(`${m[1]}${m[2].replace(/,/g, "")}${m[3] ? `.${m[3]}` : ""}`);
  if (!Number.isFinite(value) || value === 0) return null;
  return { value, decimals: m[3]?.length ?? 0, grouped: m[2].includes(","), text };
}

/** Format an intermediate value like the original; at t = 1 callers write the original text itself. */
export function formatLike(p: ParsedNumber, v: number) {
  const fixed = Math.abs(v).toFixed(p.decimals);
  const [i, d] = fixed.split(".");
  const int = p.grouped ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : i;
  return `${v < 0 ? "-" : ""}${int}${d ? `.${d}` : ""}`;
}
