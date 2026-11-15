"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useMission } from "@/lib/mission";

const KEY = "flameprint-hints-v1";
const STEPS = [
  { sel: '[data-hint="habitat"]', title: "1 · Choose your habitat", body: "Pick where your crew will live — ISS, Moon base, rover, Mars. Everything on the page recomputes for it." },
  { sel: '[data-hint="verdict"]', title: "2 · Read the verdict", body: "How many materials are high risk here — plus an A–M grade for how sure NASA's data makes us." },
  { sel: '[data-hint="passport"]', title: "3 · Take it with you", body: "Get a one-page Fire Passport: what we know, how sure we are, and what NASA should test next." },
];

/**
 * A 3-step first-visit coach-mark pointing to the habitat selector → the verdict →
 * Get Fire Passport. Dismissible, shown once (localStorage), only on the Answer page,
 * and after the intro settles. Reduced-motion friendly.
 */
export function FirstRunHints() {
  const { tab, ready } = useMission();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!ready || tab !== "answer") return;
    let done = true;
    try { done = localStorage.getItem(KEY) === "done"; } catch { /* private mode */ }
    if (done) return;
    const t = setTimeout(() => setActive(true), 1300);
    return () => clearTimeout(t);
  }, [ready, tab]);

  const finish = useCallback(() => {
    setActive(false);
    try { localStorage.setItem(KEY, "done"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const el = document.querySelector(STEPS[step].sel) as HTMLElement | null;
      if (!el) return setRect(null);
      setRect(el.getBoundingClientRect());
    };
    const el = document.querySelector(STEPS[step].sel) as HTMLElement | null;
    el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    measure();
    const id = setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { clearTimeout(id); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [active, step, reduce]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") setStep((s) => (s + 1 >= STEPS.length ? (finish(), s) : s + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  if (!active) return null;
  const last = step === STEPS.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = rect ? rect.bottom + 170 < vh : true;
  const top = rect ? (below ? rect.bottom + 12 : rect.top - 12) : vh / 2;
  const left = rect ? Math.min(Math.max(rect.left, 16), vw - 316) : 16;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Quick tour">
      <button aria-label="Skip tour" onClick={finish} className="absolute inset-0 h-full w-full cursor-default" />
      {rect && (
        <div className="pointer-events-none absolute rounded-[16px] transition-all duration-200"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12,
            boxShadow: "0 0 0 2px var(--sun-500), 0 0 0 100vmax rgba(5,8,16,0.6), 0 0 24px 2px var(--sun-glow)" }} />
      )}
      <motion.div key={step} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="panel-float absolute w-[300px] max-w-[88vw] p-4"
        style={{ left, top, transform: below ? undefined : "translateY(-100%)" }}>
        <div className="font-mono text-[10px] text-dust-500">Step {step + 1} of {STEPS.length}</div>
        <div className="mt-1 font-display text-[16px] font-semibold text-dust-100">{STEPS[step].title}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-dust-300">{STEPS[step].body}</p>
        <div className="mt-3.5 flex items-center justify-between">
          <button onClick={finish} className="text-[12.5px] text-dust-400 transition-colors hover:text-dust-200">Skip</button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i === step ? "var(--sun-500)" : "rgba(138,129,120,0.4)" }} />)}
            <button onClick={() => (last ? finish() : setStep((s) => s + 1))} className="btn btn-primary ml-2 !py-1.5 !text-[13px]">{last ? "Got it" : "Next"}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
