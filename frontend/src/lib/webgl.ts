"use client";

import { useEffect, useState } from "react";

let cached: boolean | null = null;

/** null while unknown (SSR / first paint), then whether WebGL can actually create a context. */
export function useWebGL(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(cached);
  useEffect(() => {
    if (cached === null) {
      try {
        const c = document.createElement("canvas");
        cached = !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
      } catch {
        cached = false;
      }
    }
    setOk(cached);
  }, []);
  return ok;
}

/** Pauses render loops for canvases that are scrolled out of view. */
export function useInView<T extends Element>(ref: React.RefObject<T | null>, rootMargin = "120px") {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}
