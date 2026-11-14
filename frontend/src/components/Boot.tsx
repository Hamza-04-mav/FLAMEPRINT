"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const LINES = [
  "FLAMEPRINT · v2",
  "› linking NASA PSI combustion archive",
  "› loading investigation catalog: BASS · SAFFIRE · FLEX · CFI · ACME · SAME",
  "› calibrating relevance engine (deterministic, explainable)",
  "› evidence-gap detector armed",
  "SYSTEMS NOMINAL",
];

/** ~1.6 s skippable boot sequence; shown on the first visit only (?noboot skips it). */
export function Boot() {
  const [show, setShow] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("noboot")) return;
    try {
      if (localStorage.getItem("fp-booted")) return;
      localStorage.setItem("fp-booted", "1");
    } catch { return; /* storage blocked: skip rather than replay on every load */ }
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    if (n >= LINES.length) {
      const t = setTimeout(() => setShow(false), 380);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v + 1), n === 0 ? 260 : 210);
    return () => clearTimeout(t);
  }, [show, n]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="hud-frame fixed inset-0 z-[100] flex items-center justify-center !rounded-none !border-0"
          exit={{ opacity: 0, filter: "blur(8px)" }} transition={{ duration: 0.5 }}
          onClick={() => setShow(false)} role="dialog" aria-label="Boot sequence. Click to skip."
        >
          <div className="panel w-[min(560px,90vw)] p-6 font-mono text-[12.5px]">
            {LINES.slice(0, n).map((l, i) => (
              <motion.div key={l} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                className={i === 0 ? "mb-3 text-ox" : i === LINES.length - 1 ? "mt-3 tracking-[0.2em] text-dust-200" : "text-slate-400"}>
                {l}
              </motion.div>
            ))}
            <div className="mt-6 h-[2px] w-full overflow-hidden rounded bg-slate-800">
              <motion.div className="h-full bg-ox shadow-[0_0_8px_#8a8178]"
                animate={{ width: `${(n / LINES.length) * 100}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-[10px] tracking-[0.14em] text-slate-600"><span>CLICK TO SKIP</span><span className="tabular-nums">{Math.round((n / LINES.length) * 100)}%</span></div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
