"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { heroPresence, useJourney } from "@/lib/journey";
import { lazyRetry } from "@/lib/lazyRetry";
import { TRAVEL } from "@/lib/motion";
import { useStageHabitat } from "@/lib/stage";
import { useWebGL } from "@/lib/webgl";

const HeroCanvas = dynamic(lazyRetry(() => import("./HeroScene")), { ssr: false });

/**
 * The hero's 3D layer: fixed behind the page content (portal, so the page-transition transform can't trap it).
 * As the hero section scrolls away the scene eases back and fades, and CosmicBackdrop's horizon fades back in
 * (heroPresence), so neither ever pops. Mounts its canvas only when it owns the page's single GPU slot.
 */
export function HeroStage({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const j = useJourney();
  const webgl = useWebGL();
  const reduce = useReducedMotion();
  const habitat = useStageHabitat();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  // scroll: 0 while the hero fills the view → 1 when it has scrolled away
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -40]);

  // tell the arbiter whether the hero is worth the GPU (mostly on screen)
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => j.report("hero", e.intersectionRatio > 0.3), { threshold: [0, 0.3, 0.6] });
    io.observe(el);
    return () => { io.disconnect(); j.report("hero", false); };
  }, [sectionRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const showing = webgl === true && j.owner === "hero";
  // presence drives the backdrop horizon cross-fade
  useEffect(() => { heroPresence.set(showing ? opacity.get() : 0); }, [showing, opacity]);
  useMotionValueEvent(opacity, "change", (v) => { if (showing) heroPresence.set(v); });
  useEffect(() => () => heroPresence.set(0), []);

  // gentle settle-in when the scene first appears (deep links land here too)
  const settle = useRef(reduce ? 1 : 0);
  useEffect(() => {
    if (!showing) return;
    if (reduce) { settle.current = 1; return; }
    settle.current = 0;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => { settle.current = Math.min(1, (performance.now() - t0) / (TRAVEL.settle * 1000)); if (settle.current < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showing, reduce]);

  if (!host) return null;
  return createPortal(
    <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[1]" style={{ opacity: showing ? opacity : 0, scale, y }}>
      {showing && (
        <HeroCanvas habitat={habitat} plan={j.phase === "play" ? j.plan : null} progress={j.progress} settle={settle} active={!reduce} />
      )}
      {/* a soft scrim on the text side keeps the hero text readable over the scene */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,17,29,0.78)_0%,rgba(10,17,29,0.45)_38%,transparent_62%)] max-lg:bg-[linear-gradient(180deg,rgba(10,17,29,0.8)_0%,rgba(10,17,29,0.35)_45%,transparent_70%)]" />
    </motion.div>,
    host,
  );
}
