// Mirrors backend/app/models.py
export type Range = [number, number];
export type FuelPhase = "solid" | "liquid" | "gas";
export type Pillar = "prevention" | "detection" | "suppression";
export type Confidence = "data" | "approx" | "unknown";

export interface Envelope {
  o2Pct: Range | null;
  pressureKpa: Range | null;
  flowCmS: Range | null;
  confidence: Confidence;
  note?: string | null;
}

export interface Investigation {
  id: string;
  name: string;
  project?: string | null;
  facility: string;
  apparatus?: string | null;
  platform: string;
  fuelPhase: FuelPhase[];
  fuels: string[];
  geometry: string;
  objective: string;
  pillars: Record<Pillar, number>;
  conditions: Envelope;
  diluents: string[];
  measurements: string[];
  insights: Record<string, string>;
  earthApplications: string[];
  tags: string[];
  status: "in-psi" | "pending";
  provenance: string;
}

export interface TestRecord {
  id: string;
  investigationId: string;
  o2Pct?: number | null;
  pressureKpa?: number | null;
  flowCmS?: number | null;
  gravityG?: number | null;
  fuel?: string | null;
  diluent?: string | null;
  outcome?: string | null;
  metricName?: string | null;
  metricValue?: number | null;
  source: string;
}

export interface Habitat {
  id: string;
  order: number | null;
  name: string;
  short: string;
  o2Pct: number;
  pressureKpa: number;
  gravityG: number;
  flowCmS: number;
  phases: FuelPhase[];
  pillarFocus: Record<Pillar, number>;
  basis: string;
  assumed: boolean;
}

export interface Scenario {
  habitatId: string;
  o2Pct: number;
  pressureKpa: number;
  flowCmS: number;
  gravityG: number;
  phases: FuelPhase[];
  pillarFocus: Record<Pillar, number>;
}

export interface Weights {
  o2: number;
  pressure: number;
  flow: number;
  material: number;
  pillar: number;
  gravity: number;
}

export interface Factor {
  key: keyof Weights;
  label: string;
  score: number;
  weight: number;
  why: string;
  confidence: Confidence;
}

export type GradeLetter = "A" | "B" | "C" | "M";
export interface Grade { letter: GradeLetter; reason: string; basis: string[] }

export type RiskLevel = "high" | "elevated" | "low" | "unknown";
export interface MaterialVerdict {
  id: string;
  name: string;
  usedFor: string;
  level: RiskLevel;
  margin: number | null;
  threshold1g: number | null;
  effectiveThreshold: number | null;
  grade: Grade;
  label: string;
  why: string;
  source?: string | null;
  url?: string | null;
}

export interface NextExperiment {
  id: string;
  title: string;
  phase: FuelPhase;
  gravity: string;
  habitatsAffected: string[];
  severity: Gap["severity"];
  score: number;
  plannedBy: string[];
  why: string;
}

export interface StowageResult {
  item: string;
  materialId: string | null;
  materialName: string | null;
  matchedBy: "keyword" | "claude" | "none";
  verdict: MaterialVerdict | null;
  advice: string;
}

export interface CompareHabitatsResult {
  a: Analysis;
  b: Analysis;
  diff: {
    materials: { id: string; name: string; from: RiskLevel; to: RiskLevel }[];
    gapsOnlyInB: Gap[];
    grade: { from: GradeLetter; to: GradeLetter };
    rankMoves: { id: string; from: number; to: number }[];
  };
}

export interface Ranked {
  id: string;
  name: string;
  score: number;
  grade?: Grade | null;
  factors: Factor[];
  nearbyTests: number;
  totalTests: number;
  envelope: Envelope;
}

export interface Gap {
  severity: "critical" | "high" | "medium" | "info";
  title: string;
  detail: string;
}

export interface Coverage {
  index: number;
  grade: Grade;
  o2Hits: string[];
  pressureHits: string[];
  flowHits: string[];
  jointHits: string[];
  nearTests: number;
  gaps: Gap[];
  maxO2Tested: number;
  maxO2TestedBy: string | null;
  solidO2Max: number;
  minPressureTested: number | null;
}

export interface Readout {
  ppO2Kpa: number;
  o2IncreasePct: number;
  buoyantFlowCmS: number;
  effectiveFlowCmS: number;
  pressurePsi: number;
  regime: { label: string; tone: string; text: string };
  schematicLimitingO2: number;
  marginToSchematic: number;
  earthEquivalent: { o2Pct: number; pressureKpa: number; ppO2Kpa: number };
}

export interface Analysis {
  ranked: Ranked[];
  coverage: Coverage;
  readout: Readout;
  materials: MaterialVerdict[];
  nextExperiments: NextExperiment[];
  briefPreview: string[];
  dataMode: "seed" | "psi";
}

export interface Relation { from: string; to: string; type: string; note: string }
export interface Spinoff { title: string; text: string; pillar: Pillar; related: string[]; basis: string }
export interface DataSource { name: string; origin: string; kind: string; count: number; warnings: string[] }

export interface Stats {
  investigations: number;
  inPsi: number;
  pending: number;
  tests: number;
  testsByInvestigation: Record<string, number>;
  testsByOutcome: Record<string, number>;
  withDataEnvelope: number;
}

export interface DatasetResponse {
  investigations: Investigation[];
  relations: Relation[];
  spinoffs: Spinoff[];
  sources: DataSource[];
  stats: Stats;
}

export interface Health {
  ok: boolean;
  db: { backend: string; ok: boolean; detail: string };
  llm: { enabled: boolean; model: string | null; detail: string };
  stats: Stats;
}

export interface SpacePoint {
  id: string;
  investigationId: string;
  o2Pct: number;
  pressureKpa: number | null;
  flowCmS: number | null;
  outcome: string;
  fuel?: string | null;
  source: string;
}

export interface ConditionSpace {
  envelopes: { id: string; name: string; fuelPhase: FuelPhase[]; status: string; facility: string; envelope: Envelope }[];
  tests: SpacePoint[];
  totalTests: number;
  plottedTests: number;
  schematicCurve: { flowCmS: number; o2Pct: number }[];
}

export interface GenomeNode {
  id: string;
  label: string;
  kind: "facility" | "apparatus" | "investigation";
  name?: string;
  fuelPhase?: FuelPhase[];
  status?: string;
  pillars?: Record<Pillar, number>;
  tests?: number;
}
export interface GenomeEdge { source: string; target: string; type: string; note?: string }

export interface CompareResult {
  a: Investigation;
  b: Investigation;
  rows: { label: string; a: string | number; b: string | number; same: boolean }[];
  relations: Relation[];
  sharedHardware: string[];
  summary: string[];
}

export interface IngestReport {
  file: string;
  kind: string;
  records: number;
  investigations: string[];
  mapping: Record<string, string>;
  conversions: string[];
  warnings: string[];
  unmapped: string[];
  origin?: string;
}

export interface BriefBullet { text: string; cite: string[]; approx: boolean }
export interface BriefCards {
  cards: Record<Pillar, { bullets: BriefBullet[]; more: number; gap: string | null }>;
  earth: { text: string; cite: string[] } | null;
  audit: { valid: string[]; invalid: string[] };
  dataNote: string;
}
