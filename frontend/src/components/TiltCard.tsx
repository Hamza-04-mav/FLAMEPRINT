"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * A card with light 3D depth: pointer-tracked tilt (max `maxDeg`, default 4°) plus a
 * moving specular highlight that follows the cursor. Desktop fine-pointer only; disabled
 * for touch and for prefers-reduced-motion (it then renders a plain div).
 */
export function TiltCard({
  children, className = "", maxDeg = 4, as: Tag = "div", ...rest
}: {
  children: ReactNode; className?: string; maxDeg?: number; as?: "div" | "section";
} & Record<string, unknown>) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  // normalized pointer position (-0.5 … 0.5)
  const nx = useMotionValue(0);
  const ny = useMotionValue(0);
  const rx = useSpring(useTransform(ny, (v) => -v * 2 * maxDeg), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(nx, (v) => v * 2 * maxDeg), { stiffness: 180, damping: 18 });
  const mx = useMotionValue(50);
  const my = useMotionValue(50);

  // enable only after mount (and only on a fine, hovering pointer) to avoid an SSR
  // hydration mismatch and to keep tilt off on touch devices
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (reduce) return;
    setEnabled(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false);
  }, [reduce]);

  const onMove = (e: React.PointerEvent) => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width;
    const dy = (e.clientY - r.top) / r.height;
    nx.set(dx - 0.5); ny.set(dy - 0.5);
    mx.set(dx * 100); my.set(dy * 100);
  };
  const reset = () => { nx.set(0); ny.set(0); setHover(false); };

  const MotionTag = Tag === "section" ? motion.section : motion.div;
  const spec = useTransform([mx, my], ([x, y]) => `radial-gradient(220px circle at ${x}% ${y}%, rgba(239,234,227,0.1), transparent 60%)`);

  if (!enabled) {
    const Plain = Tag;
    return <Plain ref={ref as never} className={className} {...rest}>{children}</Plain>;
  }

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      onPointerMove={onMove}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: "preserve-3d" }}
      {...rest}
    >
      {children}
      <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: spec, opacity: hover ? 1 : 0, transition: "opacity 0.3s" }} />
    </MotionTag>
  );
}
