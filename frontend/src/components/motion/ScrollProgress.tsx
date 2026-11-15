"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";

/** A thin vertical progress line at the right edge of the page. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const y = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  return (
    <div aria-hidden className="pointer-events-none fixed right-1.5 top-24 bottom-24 z-30 hidden w-px bg-dust-700/50 md:block">
      <motion.div className="h-full w-full origin-top bg-dust-300" style={{ scaleY: reduce ? scrollYProgress : y }} />
    </div>
  );
}
