"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { TYPE } from "@/lib/motion";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%+-";

/**
 * A headline that writes itself in once (character by character, with a short scramble ahead of the cursor).
 * Screen readers get the full text immediately; the animated characters are aria-hidden. Static with reduced motion.
 */
export function TypeIn({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? text : "");
  useEffect(() => {
    if (reduce) { setShown(text); return; }
    const n = text.length, t0 = performance.now(), total = TYPE.total * 1000;
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / total);
      const done = Math.floor(k * n);
      const tail = Math.min(n - done, Math.ceil(n * TYPE.scramble));
      let s = text.slice(0, done);
      for (let i = 0; i < tail; i++) {
        const c = text[done + i];
        s += c === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setShown(s);
      if (k < 1) raf = requestAnimationFrame(tick); else setShown(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, reduce]);
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span className="sr-only">{text}</span>
      {/* invisible in-flow copy reserves the final size; the typed text sits on top, so nothing reflows */}
      <span aria-hidden className="invisible">{text}</span>
      <span aria-hidden className="absolute inset-0">{shown}</span>
    </span>
  );
}
