"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { plural } from "@/lib/format";
import { useMission } from "@/lib/mission";

/**
 * Feedback (Norman): when a re-analysis settles, a small glass toast confirms the
 * change. Dust only — no yellow (yellow is reserved for risk/CTA). The first settle
 * after load is skipped so it doesn't greet the user on arrival.
 */
export function RankingToast() {
  const { analyzing, analysis } = useMission();
  const [show, setShow] = useState(false);
  const [n, setN] = useState(0);
  const was = useRef(false);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (was.current && !analyzing && analysis) {
      if (first.current) first.current = false; // skip the initial load settle
      else {
        setN(analysis.ranked.length);
        setShow(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setShow(false), 1600);
      }
    }
    was.current = analyzing;
  }, [analyzing, analysis]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18 }} className="pointer-events-none fixed bottom-5 left-1/2 z-[60] -translate-x-1/2">
          <div className="panel-float flex items-center gap-2 px-3.5 py-2 text-[12.5px] text-dust-200">
            <span className="led" style={{ color: "var(--dust-300)" }} />
            Ranking updated · {plural(n, "investigation")}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
