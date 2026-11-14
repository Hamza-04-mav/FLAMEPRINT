"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useMission } from "@/lib/mission";
import { ScenarioBuilder } from "./ScenarioBuilder";

/** Slide-over mission editor. Every page recomputes live as values change. */
export function MissionConfig() {
  const { configOpen, setConfigOpen, analyzing } = useMission();
  useEffect(() => {
    if (!configOpen) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setConfigOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [configOpen, setConfigOpen]);

  return (
    <AnimatePresence>
      {configOpen && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-[#020610]/55 backdrop-blur-[2px]" onClick={() => setConfigOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside role="dialog" aria-label="Mission configuration"
            className="panel-float fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col !rounded-none border-l"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 36 }}>
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <div>
                <div className="kicker !text-[10px]">Mission configuration</div>
                <div className="mt-0.5 font-display text-[18px] font-semibold text-ink">Where will your crew live?</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-[10px] tracking-[0.14em] ${analyzing ? "text-flame-1" : "text-ok"}`}>{analyzing ? "COMPUTING" : "LIVE"}</span>
                <button onClick={() => setConfigOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
              <ScenarioBuilder bare />
            </div>
            <div className="border-t border-[var(--line)] px-5 py-3 text-[11.5px] leading-snug text-slate-500">
              Every view (ranking, coverage, gaps, brief) recomputes from these values with deterministic code.
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
