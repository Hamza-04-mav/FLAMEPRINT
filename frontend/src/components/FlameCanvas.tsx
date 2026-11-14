"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { RiskLevel } from "@/lib/types";

const SIZE: Record<RiskLevel, number> = { high: 1, elevated: 0.72, low: 0.42, unknown: 0.6 };

/**
 * Canvas 2D flame (no WebGL, so dozens can share a page). ILLUSTRATIVE ONLY.
 * Shape: blue sphere at 0 g → orange teardrop at 1 g. Size: risk level. Unknown: dashed outline only.
 */
export function FlameCanvas({ g, level, className = "", width = 56, height = 64 }: {
  g: number; level: RiskLevel; className?: string; width?: number; height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const target = useRef({ g, s: SIZE[level], level });
  target.current = { g, s: SIZE[level], level };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    const cur = { g: target.current.g, s: target.current.s };
    let raf = 0, t = Math.random() * 10, visible = true;
    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
    io?.observe(cv);

    const draw = () => {
      const tg = target.current;
      cur.g += (tg.g - cur.g) * 0.12;
      cur.s += (tg.s - cur.s) * 0.12;
      const gs = Math.sqrt(Math.min(1, Math.max(0, cur.g)));
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2, base = height * (0.72 - 0.08 * gs);
      const r = Math.min(width, height) * 0.3 * cur.s;
      const flick = reduce ? 0 : Math.sin(t * 7) * 0.05 * gs + Math.sin(t * 2.3) * 0.03;
      const tall = r * (1 + 1.6 * gs) * (1 + flick);
      // teardrop: circle bottom, pointed top that grows with sqrt(g)
      const path = new Path2D();
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const sx = Math.sin(a), cy = Math.cos(a);
        const up = cy > 0 ? cy : 0; // upper half stretches
        const pinch = 1 - gs * 0.55 * up * up;
        const x = cx + sx * r * pinch + (reduce ? 0 : Math.sin(t * 5 + a) * 0.6 * gs * up);
        const y = base - r - (cy * (cy > 0 ? tall : r));
        if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      path.closePath();
      if (tg.level === "unknown") {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(138,129,120,0.85)"; // dust, dashed = untested
        ctx.lineWidth = 1.2;
        ctx.stroke(path);
        ctx.setLineDash([]);
      } else {
        // Ink-sun recolour: 0 g = dim dust sphere → 1 g = warm sun teardrop (no blue)
        const cyMid = base - r;
        const grad = ctx.createRadialGradient(cx, cyMid, r * 0.1, cx, cyMid - tall * 0.3 * gs, Math.max(r, tall));
        const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
        const inner = mix([239, 234, 227], [255, 224, 138], gs);
        const mid = mix([163, 154, 144], [255, 210, 63], gs);
        const outer = mix([74, 69, 64], [224, 165, 30], gs);
        grad.addColorStop(0, `rgba(${inner},0.95)`);
        grad.addColorStop(0.45, `rgba(${mid},0.85)`);
        grad.addColorStop(1, `rgba(${outer},0.0)`);
        ctx.shadowColor = `rgba(${mid},0.7)`;
        ctx.shadowBlur = 12 * cur.s;
        ctx.fillStyle = grad;
        ctx.fill(path);
        ctx.shadowBlur = 0;
        // cool dust base at the foot of the flame
        ctx.fillStyle = "rgba(194,186,176,0.3)";
        ctx.beginPath();
        ctx.ellipse(cx, base - r * 0.25, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      t += 1 / 60;
    };

    const loop = () => {
      if (visible) draw();
      raf = requestAnimationFrame(loop);
    };
    if (reduce) {
      // static: settle immediately and redraw only when props change
      cur.g = target.current.g; cur.s = target.current.s;
      draw();
    } else loop();
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, [width, height, reduce, reduce ? g : 0, reduce ? level : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} aria-hidden className={className} style={{ width, height }} />;
}
