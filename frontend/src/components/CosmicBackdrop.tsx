"use client";

import { motion, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";
import { environmentFor, ENV_TINT } from "@/lib/environment";
import { useMission } from "@/lib/mission";

/** Static star field painted once into a 2D canvas (cheap, crisp, no animation loop). */
function Stars() {
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
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const n = Math.round((w * h) / 4200);
      for (let i = 0; i < n; i++) {
        const x = rnd() * w, y = rnd() * h;
        const big = rnd() > 0.965;
        const r = big ? 0.9 + rnd() * 0.7 : 0.3 + rnd() * 0.55;
        const a = big ? 0.55 + rnd() * 0.35 : 0.12 + rnd() * 0.35;
        const tint = rnd();
        ctx.fillStyle = tint > 0.85 ? `rgba(160,205,255,${a})` : tint > 0.8 ? `rgba(255,214,170,${a})` : `rgba(235,242,255,${a})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        if (big) {
          ctx.fillStyle = `rgba(160,205,255,${a * 0.12})`;
          ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
        }
      }
    };
    draw();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(t); t = setTimeout(draw, 200); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0" aria-hidden />;
}

export function CosmicBackdrop() {
  const { scenario } = useMission();
  const env = environmentFor(scenario.habitatId, scenario.gravityG);
  const tint = ENV_TINT[env];
  const reduce = useReducedMotion();
  const px = useSpring(0, { stiffness: 40, damping: 20 });
  const py = useSpring(0, { stiffness: 40, damping: 20 });

  useEffect(() => {
    if (reduce) return;
    const h = (e: MouseEvent) => {
      px.set((e.clientX / window.innerWidth - 0.5) * -14);
      py.set((e.clientY / window.innerHeight - 0.5) * -10);
    };
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, [reduce, px, py]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_-10%,#0a1b38_0%,#030814_55%)]" />
      <motion.div className="absolute -inset-6" style={{ x: px, y: py }}>
        <Stars />
        {/* faint nebula */}
        <div className="absolute left-[8%] top-[18%] h-[520px] w-[720px] rounded-full bg-[radial-gradient(closest-side,rgba(8,123,255,0.07),transparent)] blur-2xl" />
        <div className="absolute right-[10%] top-[45%] h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(25,201,255,0.045),transparent)] blur-2xl" />
      </motion.div>
      {/* distant planetary horizon, tinted by the mission environment */}
      <motion.div className="absolute -bottom-[78vmax] -right-[30vmax] h-[110vmax] w-[110vmax] rounded-full"
        style={{ x: px, y: py }}
        animate={{ boxShadow: `0 0 120px 10px ${tint.glow}, inset 30px 40px 80px -20px ${tint.limb}33` }}
        transition={{ duration: 1.2 }}>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,#0d1a30,#040a16_60%)]" />
      </motion.div>
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-space-950/80 to-transparent" />
    </div>
  );
}
