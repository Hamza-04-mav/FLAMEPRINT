import { afterEach, describe, expect, it, vi } from "vitest";
import { streamSSE } from "./api";
import { buildVerdict, firstSentence, fmtPressure, levelRose } from "./answer";
import { fmtRange, scoreColor, toKpa, toPsi } from "./format";
import type { MaterialVerdict } from "./types";

describe("format", () => {
  it("formats ranges and units", () => {
    expect(fmtRange([21, 21], "%")).toBe("21%");
    expect(fmtRange([15, 21.25], "%")).toBe("15–21.3%");
    expect(fmtRange(null, "%")).toBe("not characterized");
    expect(toPsi(70.3)).toBe(10.2);
    expect(toKpa(14.7)).toBeCloseTo(101.4, 1);
    expect(scoreColor(90)).toBe("#EFEAE3"); // relevance ramp is dust, not a hue
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

describe("brief cards", () => {
  it("keeps only the first sentence of a summary", () => {
    expect(firstSentence("Solids keep burning in low flow. Ventilation matters.")).toBe("Solids keep burning in low flow.");
    expect(firstSentence("Use CO₂, e.g. at 1 g. It works.")).toBe("Use CO₂, e.g. at 1 g.");
    expect(firstSentence("No full stop here")).toBe("No full stop here");
  });
});

describe("gaps helpers", () => {
  it("finds the nearest tested point and the O₂ distance", async () => {
    const { nearestTested } = await import("./space");
    const rects = [{ f0: 0, f1: 40, o0: 15, o1: 22 }];
    const n = nearestTested(16, 30, rects)!;
    expect(n.flow).toBe(16);
    expect(n.o2).toBe(22);
    expect(n.dO2).toBe(8);
    expect(nearestTested(10, 20, rects)).toBeNull(); // inside a tested range: no connector
    expect(nearestTested(10, 20, [])).toBeNull(); // no data: no connector
  });

  it("places labels without overlaps and always keeps the scenario", async () => {
    const { placeLabels } = await import("./labels");
    const labels = [
      { id: "you", x: 100, y: 100, w: 80, h: 20, priority: 0 },
      { id: "a", x: 100, y: 100, w: 80, h: 20, priority: 2 },
      { id: "b", x: 102, y: 101, w: 80, h: 20, priority: 3 },
    ];
    const out = placeLabels(labels, { w: 400, h: 300 });
    expect(out[0].id).toBe("you");
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const A = out[i], B = out[j];
      expect(A.left < B.left + 80 && A.left + 80 > B.left && A.top < B.top + 20 && A.top + 20 > B.top).toBe(false);
    }
    // a label that only fits inside an exclusion zone is hidden; the scenario never is
    const tight = placeLabels([{ id: "x", x: 50, y: 30, w: 80, h: 20, priority: 3 }, { id: "you", x: 50, y: 30, w: 80, h: 20, priority: 0 }],
      { w: 140, h: 70 }, [{ x: 0, y: 0, w: 140, h: 70 }]);
    expect(tight.map((l) => l.id)).toEqual(["you"]);
    // fixed labels never move: a tick under the axis title is hidden rather than displaced
    const axis = placeLabels([
      { id: "title", x: 200, y: 200, w: 90, h: 16, priority: 1, fixed: true },
      { id: "tick30", x: 205, y: 202, w: 30, h: 14, priority: 5, fixed: true },
      { id: "tick15", x: 100, y: 202, w: 30, h: 14, priority: 5, fixed: true },
    ], { w: 400, h: 300 });
    expect(axis.map((l) => l.id)).toEqual(["title", "tick15"]);
    expect(axis[0]).toMatchObject({ left: 155, top: 192, leader: false });
  });
});

describe("habitat journey planner", () => {
  it("picks the scene, direction and duration", async () => {
    const { planJourney } = await import("./journeyPlan");
    expect(planJourney("iss", "lunar-base")).toMatchObject({ scene: "iss-moon", dir: 1, duration: 2.1 });
    expect(planJourney("lunar-base", "suit")).toMatchObject({ scene: "moon-suit", dir: 1, duration: 2.4 });
    expect(planJourney("suit", "lunar-base")).toMatchObject({ scene: "moon-suit", dir: -1 }); // mirrored backwards
    expect(planJourney("iss", "mars")).toMatchObject({ scene: "transit", dir: 1 }); // non-adjacent: one transit
    expect(planJourney("mars", "iss")).toMatchObject({ scene: "transit", dir: -1 });
    expect(planJourney("rover", "earth")).toMatchObject({ scene: "to-earth" });
    expect(planJourney("earth", "suit")).toMatchObject({ scene: "transit" });
    expect(planJourney("suit", "rover", 375)?.duration).toBe(1.2); // shorter on phones
    expect(planJourney("iss", "iss")).toBeNull();
  });
});
