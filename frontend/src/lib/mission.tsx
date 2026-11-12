"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { Analysis, DatasetResponse, Habitat, Health, Scenario, Weights } from "./types";

export const DEFAULT_WEIGHTS: Weights = { o2: 0.25, pressure: 0.15, flow: 0.15, material: 0.2, pillar: 0.2, gravity: 0.05 };

export const FALLBACK_SCENARIO: Scenario = {
  habitatId: "lunar-base", o2Pct: 30, pressureKpa: 70.3, flowCmS: 10, gravityG: 0.165,
  phases: ["solid", "gas"], pillarFocus: { prevention: 1, detection: 0.8, suppression: 0.8 },
};

export const TABS = ["overview", "space", "ranking", "brief", "genome", "earth", "ask", "data"] as const;
export type Tab = (typeof TABS)[number];

interface MissionCtx {
  habitats: Habitat[];
  dataset: DatasetResponse | null;
  health: Health | null;
  scenario: Scenario;
  setScenario: (s: Scenario | ((s: Scenario) => Scenario)) => void;
  applyHabitat: (h: Habitat) => void;
  weights: Weights;
  setWeights: (w: Weights) => void;
  analysis: Analysis | null;
  analyzing: boolean;
  error: string | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  focusId: string | null;
  openInvestigation: (id: string | null) => void;
  refreshData: () => Promise<void>;
  dataVersion: number;
  configOpen: boolean;
  ready: boolean;
  setConfigOpen: (v: boolean) => void;
}

const Ctx = createContext<MissionCtx | null>(null);

export function MissionProvider({ children }: { children: React.ReactNode }) {
  const [habitats, setHabitats] = useState<Habitat[]>([]);
  const [dataset, setDataset] = useState<DatasetResponse | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [scenario, setScenario] = useState<Scenario>(FALLBACK_SCENARIO);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>("overview");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [configOpen, setConfigOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [h, d, hb] = await Promise.all([api.health(), api.dataset(), api.habitats()]);
      setHealth(h);
      setDataset(d);
      setHabitats(hb);
      setDataVersion((v) => v + 1);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void refreshData(); }, [refreshData]);

  // Deep-linkable tabs (#ranking, #brief, ...) for demos and sharing
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.includes(h)) setTabState(h);
    };
    read();
    setReady(true);
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Debounced re-analysis whenever the scenario, weights or data change
  useEffect(() => {
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setAnalyzing(true);
      try {
        const a = await api.analyze(scenario, weights, ac.signal);
        setAnalysis(a);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        if (abortRef.current === ac) setAnalyzing(false);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [scenario, weights, dataVersion]);

  // deep link: ?mission=mars preselects a preset once the presets arrive
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current || !habitats.length) return;
    linked.current = true;
    const id = new URLSearchParams(window.location.search).get("mission");
    const h = id && habitats.find((x) => x.id === id);
    if (h) setScenario({ habitatId: h.id, o2Pct: h.o2Pct, pressureKpa: h.pressureKpa, flowCmS: h.flowCmS, gravityG: h.gravityG, phases: h.phases, pillarFocus: h.pillarFocus });
  }, [habitats]);

  const applyHabitat = useCallback((h: Habitat) => {
    setScenario({ habitatId: h.id, o2Pct: h.o2Pct, pressureKpa: h.pressureKpa, flowCmS: h.flowCmS,
      gravityG: h.gravityG, phases: h.phases, pillarFocus: h.pillarFocus });
  }, []);

  const value = useMemo<MissionCtx>(() => ({
    habitats, dataset, health, scenario, setScenario, applyHabitat, weights, setWeights, analysis, analyzing,
    error, tab, setTab, focusId, openInvestigation: setFocusId, refreshData, dataVersion, configOpen, setConfigOpen, ready,
  }), [ready, habitats, dataset, health, scenario, applyHabitat, weights, analysis, analyzing, error, tab, setTab, focusId, refreshData, dataVersion, configOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMission() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMission must be used inside <MissionProvider>");
  return c;
}
