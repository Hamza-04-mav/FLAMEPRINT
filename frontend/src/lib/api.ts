import type {
  Analysis, BriefCards, CompareHabitatsResult, CompareResult, NextExperiment, StowageResult, ConditionSpace, DatasetResponse, GenomeEdge, GenomeNode, Habitat, Health,
  IngestReport, Investigation, Relation, Scenario, TestRecord, Weights,
} from "./types";

/** Empty BASE → same-origin /api (Next.js rewrite to FastAPI). In production set NEXT_PUBLIC_API_BASE to call the API directly (CORS) so SSE streams unbuffered. */
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(0, "Backend unreachable. It may be waking up; try again in a moment.");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch { /* non-JSON error */ }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export const api = {
  health: () => req<Health>("/api/health"),
  habitats: () => req<Habitat[]>("/api/habitats"),
  dataset: () => req<DatasetResponse>("/api/dataset"),
  analyze: (scenario: Scenario, weights: Weights, signal?: AbortSignal) =>
    req<Analysis>("/api/analyze", { ...json({ scenario, weights }), signal }),
  stowage: (item: string, scenario: Scenario, signal?: AbortSignal) =>
    req<StowageResult>("/api/stowage", { ...json({ item, scenario }), signal }),
  compareHabitats: (a: Scenario, b: Scenario, weights: Weights) =>
    req<CompareHabitatsResult>("/api/compare-habitats", json({ a, b, weights })),
  nextExperiments: () => req<NextExperiment[]>("/api/next-experiments"),
  briefCards: (scenario: Scenario, weights: Weights) => req<BriefCards>("/api/brief-cards", json({ scenario, weights })),
  investigation: (id: string) =>
    req<{ investigation: Investigation; tests: TestRecord[]; totalTests: number; relations: Relation[] }>(
      `/api/investigations/${encodeURIComponent(id)}`),
  space: () => req<ConditionSpace>("/api/condition-space"),
  genome: () => req<{ nodes: GenomeNode[]; edges: GenomeEdge[] }>("/api/genome"),
  compare: (a: string, b: string) =>
    req<CompareResult>(`/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
  sources: () => req<{ reports: IngestReport[]; uploads: { file: string; bytes: number; investigationId?: string | null; uploadedAt?: string }[] }>("/api/sources"),
  preview: (file: File, inv?: string) => req<{ report: IngestReport; sample: TestRecord[]; textPreview: string }>(
    "/api/ingest/preview", { method: "POST", body: form(file, inv) }),
  ingest: (file: File, inv?: string) => req<{ report: IngestReport }>("/api/ingest", { method: "POST", body: form(file, inv) }),
  extract: (file: string) => {
    const f = new FormData();
    f.append("file", file);
    return req<{ investigation: Investigation; savedAs: string; warnings: string[] }>("/api/extract", { method: "POST", body: f });
  },
  deleteUpload: (name: string) => req(`/api/uploads/${encodeURIComponent(name)}`, { method: "DELETE" }),
  clearUploads: () => req<{ deleted: number }>("/api/uploads", { method: "DELETE" }),
  reload: () => req("/api/reload", { method: "POST" }),
};

function form(file: File, inv?: string) {
  const f = new FormData();
  f.append("file", file);
  if (inv) f.append("investigation_id", inv);
  return f;
}

export interface StreamHandlers {
  onMeta?: (m: Record<string, unknown>) => void;
  onDelta: (text: string) => void;
  onCitations?: (c: { valid: string[]; invalid: string[] }) => void;
  onDone?: (d: { mode: string; note: string | null }) => void;
}

/** Parses the backend's Server-Sent Events stream (event: x / data: json). */
export async function streamSSE(path: string, body: unknown, h: StreamHandlers, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...json(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    throw new ApiError(0, "Backend unreachable. It may be waking up; try again in a moment.");
  }
  if (!res.ok || !res.body) throw new ApiError(res.status, `Stream failed (${res.status})`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message", data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!data) continue;
      const parsed = JSON.parse(data);
      if (event === "meta") h.onMeta?.(parsed);
      else if (event === "delta") h.onDelta(parsed.text);
      else if (event === "citations") h.onCitations?.(parsed);
      else if (event === "done") h.onDone?.(parsed);
    }
  }
}
