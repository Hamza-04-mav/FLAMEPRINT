"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

type Counted = { __fpMounts?: number };

/**
 * Put inside a <Canvas>. When the canvas unmounts, its WebGL context is released right away instead of
 * ~500 ms later (React Three Fiber's default), so the next canvas never overlaps it: one live context per page.
 * Deferred by a tick and reference-counted, so React StrictMode's dev-only unmount/remount never kills a live canvas.
 */
export function ReleaseGL() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const g = gl as unknown as Counted;
    g.__fpMounts = (g.__fpMounts ?? 0) + 1;
    return () => {
      g.__fpMounts = (g.__fpMounts ?? 1) - 1;
      setTimeout(() => {
        if (g.__fpMounts) return;
        try { gl.dispose(); gl.forceContextLoss(); } catch { /* already gone */ }
      }, 0);
    };
  }, [gl]);
  return null;
}
