"use client";

import { AnimatePresence, motion, type MotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import { environmentFor, ENV_TINT } from "@/lib/environment";
import { useMission } from "@/lib/mission";

/**
 * Static star layer painted once into a 2D canvas (cheap, crisp, no animation loop).
 * Stars are dust-100 at varying alpha only — no blue, no amber, no rainbow.
 */
function Stars({ density = 4200, seedBase = 11, big = 0.965 }: { density?: number; seedBase?: number; big?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth, h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      let seed = seedBase;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const n = Math.round((w * h) / density);
      for (let i = 0; i < n; i++) {
        const x = rnd() * w, y = rnd() * h;
        const isBig = rnd() > big;
        const r = isBig ? 0.9 + rnd() * 0.7 : 0.3 + rnd() * 0.55;
        const a = isBig ? 0.5 + rnd() * 0.35 : 0.1 + rnd() * 0.3;
        ctx.fillStyle = `rgba(239, 234, 227, ${a})`; // dust-100
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        if (isBig) {
          ctx.fillStyle = `rgba(239, 234, 227, ${a * 0.1})`;
          ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
        }
      }
    };
    draw();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(t); t = setTimeout(draw, 200); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, [density, seedBase, big]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

/** A handful of slowly twinkling stars (disabled under reduced motion). */
function Twinkles() {
  const stars = useMemo(
    () => [...Array(12)].map((_, i) => ({
      left: `${(i * 83 + 17) % 100}%`, top: `${(i * 41 + 9) % 72}%`,
      size: 1 + (i % 3) * 0.6, dur: 3.2 + (i % 5) * 0.9, delay: (i % 7) * 0.6,
    })),
    [],
  );
  return (
    <>
      {stars.map((s, i) => (
        <motion.span key={i} className="absolute rounded-full"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, background: "rgba(239,234,227,0.9)", boxShadow: "0 0 6px rgba(239,234,227,0.5)" }}
          animate={{ opacity: [0.15, 0.85, 0.15] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "easeInOut" }} />
      ))}
    </>
  );
}

/** The moon / planet horizon arc, low and large. Changes per habitat; signals "where you are". */
function Horizon({ envKey, suit }: { envKey: keyof typeof ENV_TINT; suit: boolean }) {
  const t = ENV_TINT[envKey];
  const size = suit ? "170vmax" : "118vmax"; // the suit sits on a very close crater rim
  const craters = t.crater
    ? [
        { l: "30%", top: "20%", d: 46, o: 0.5 }, { l: "46%", top: "33%", d: 26, o: 0.42 },
        { l: "38%", top: "46%", d: 70, o: 0.38 }, { l: "56%", top: "22%", d: 20, o: 0.4 },
        { l: "24%", top: "38%", d: 16, o: 0.45 }, { l: "60%", top: "40%", d: 34, o: 0.3 },
      ]
    : [];
  return (
    <motion.div
      className="absolute -right-[26vmax] -bottom-[80vmax] rounded-full"
      style={{ width: size, height: size }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}>
      {/* sphere body: lit toward upper-left, dark terminator lower-right */}
      <div className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle at 32% 24%, color-mix(in srgb, ${t.limb} 70%, #0a111d), #0a111d 62%)` }} />
      {/* soft limb glow (atmosphere for Earth; faint rim for a moon) */}
      <div className="absolute -inset-[1.5vmax] rounded-full"
        style={{ boxShadow: `0 0 140px 18px ${t.glow}, inset 40px 44px 110px -30px ${t.limb}` }} />
      {craters.map((c, i) => (
        <span key={i} className="absolute rounded-full"
          style={{
            left: c.l, top: c.top, width: c.d, height: c.d,
            background: `radial-gradient(circle at 38% 34%, color-mix(in srgb, ${t.limb} 40%, transparent), transparent 70%)`,
            boxShadow: `inset -2px -3px 6px rgba(10,17,29,${c.o}), inset 2px 2px 3px rgba(239,234,227,0.05)`,
          }} />
      ))}
    </motion.div>
  );
}

export function CosmicBackdrop() {
  const { scenario } = useMission();
  const env = environmentFor(scenario.habitatId, scenario.gravityG);
  const suit = scenario.habitatId === "suit";
  const t = ENV_TINT[env];
  const reduce = useReducedMotion();

  // pointer parallax (desktop); device tilt is intentionally omitted (iOS permission prompt)
  const px = useSpring(0, { stiffness: 36, damping: 20 });
  const py = useSpring(0, { stiffness: 36, damping: 20 });
  useEffect(() => {
    if (reduce) return;
    const h = (e: MouseEvent) => {
      px.set((e.clientX / window.innerWidth - 0.5) * -1);
      py.set((e.clientY / window.innerHeight - 0.5) * -1);
    };
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, [reduce, px, py]);

  // three parallax depths, far → near
  const far = { x: useT(px, 6), y: useT(py, 4) };
  const mid = { x: useT(px, 14), y: useT(py, 9) };
  const near = { x: useT(px, 26), y: useT(py, 16) };

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* sky tint — crossfades over 600ms on habitat switch */}
      <AnimatePresence initial={false}>
        <motion.div key={t.sky} className="absolute inset-0"
          style={{ background: t.sky }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }} />
      </AnimatePresence>

      {/* three star layers at different parallax depths */}
      <motion.div className="absolute -inset-10" style={{ x: far.x, y: far.y }}><Stars density={6200} seedBase={11} big={0.98} /></motion.div>
      <motion.div className="absolute -inset-10" style={{ x: mid.x, y: mid.y }}><Stars density={5200} seedBase={5717} big={0.955} /></motion.div>
      <motion.div className="absolute -inset-10" style={{ x: near.x, y: near.y }}>
        <Stars density={9000} seedBase={99173} big={0.9} />
        {!reduce && <Twinkles />}
      </motion.div>

      {/* moon / planet horizon — crossfades per habitat */}
      <motion.div className="absolute inset-0" style={{ x: mid.x, y: mid.y }}>
        <AnimatePresence initial={false}>
          <Horizon key={suit ? "suit" : env} envKey={env} suit={suit} />
        </AnimatePresence>
      </motion.div>

      {/* bottom vignette to seat content */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-space-950/80 to-transparent" />
    </div>
  );
}

/** parallax helper: scale a shared pointer spring by a depth factor */
function useT(mv: MotionValue<number>, factor: number) {
  return useTransform(mv, (v) => v * factor);
}
