import { afterEach, describe, expect, it, vi } from "vitest";
import { streamSSE } from "./api";
import { buildVerdict, fmtPressure, levelRose } from "./answer";
import { fmtRange, scoreColor, toKpa, toPsi } from "./format";
import type { MaterialVerdict } from "./types";

describe("format", () => {
  it("formats ranges and units", () => {
    expect(fmtRange([21, 21], "%")).toBe("21%");
    expect(fmtRange([15, 21.25], "%")).toBe("15–21.3%");
    expect(fmtRange(null, "%")).toBe("not characterized");
    expect(toPsi(70.3)).toBe(10.2);
    expect(toKpa(14.7)).toBeCloseTo(101.4, 1);
    expect(scoreColor(90)).toBe("#19C9FF");
  });
});

describe("streamSSE", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses events split across network chunks", async () => {
    const enc = new TextEncoder();
    const chunks = [
      'event: meta\ndata: {"mode":"local"}\n\nevent: delta\ndata: {"text":"Hel',
      'lo [BASS]"}\n\nevent: citations\ndata: {"valid":["BASS"],"invalid":[]}\n\n',
      'event: done\ndata: {"mode":"local","note":null}\n\n',
    ];
    const body = new ReadableStream({
      start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));
    const got: string[] = [];
    let meta: unknown, cites: unknown, done: unknown;
    await streamSSE("/api/brief", {}, {
      onMeta: (m) => (meta = m), onDelta: (t) => got.push(t), onCitations: (c) => (cites = c), onDone: (d) => (done = d),
    });
    expect(meta).toEqual({ mode: "local" });
    expect(got.join("")).toBe("Hello [BASS]");
    expect(cites).toEqual({ valid: ["BASS"], invalid: [] });
    expect(done).toEqual({ mode: "local", note: null });
  });

  it("reports an unreachable backend clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(streamSSE("/api/brief", {}, { onDelta: () => {} })).rejects.toThrow(/Backend unreachable/);
  });
});

describe("answer screen helpers", () => {
  const mv = (level: MaterialVerdict["level"]): MaterialVerdict => ({
    id: level + Math.random(), name: "x", usedFor: "", level, margin: null, threshold1g: null, effectiveThreshold: null,
    grade: { letter: "C", reason: "", basis: [] }, label: "illustrative model", why: "",
  });
  const grade = { letter: "C" as const, reason: "No partial-gravity data in PSI; bracketed by microgravity and 1 g", basis: [] };

  it("builds the verdict sentence from engine output", () => {
    const v = buildVerdict([mv("high"), mv("high"), mv("low"), mv("elevated")], grade, "Moon Base");
    expect(v.headline).toBe("2 of 4 materials are high risk at the Moon base.");
    expect(v.confidence).toBe("Confidence C: no partial-gravity data in PSI; bracketed by microgravity and 1 g.");
    expect(buildVerdict([mv("high")], grade, "Spacesuit").headline).toBe("1 of 1 materials is high risk in a spacesuit.");
  });

  it("never claims safety when thresholds are missing", () => {
    const v = buildVerdict([mv("unknown"), mv("unknown")], grade, "ISS / Orion cabin");
    expect(v.headline).toMatch(/not rated yet/);
    expect(v.rated).toBe(0);
  });

  it("formats pressure psi first", () => {
    expect(fmtPressure(70.3)).toEqual({ psi: "10.2 psi", kpa: "70.3 kPa" });
  });

  it("detects rising risk only between rated levels", () => {
    expect(levelRose("low", "high")).toBe(true);
    expect(levelRose("high", "low")).toBe(false);
    expect(levelRose("unknown", "high")).toBe(false);
  });
});
