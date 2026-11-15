"use client";

import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OUTCOME_COLOR, toPsi } from "@/lib/format";
import { placeLabels, type LabelIn, type LabelOut } from "@/lib/labels";
import { easeInOutCubic, MORPH } from "@/lib/motion";
import { F_RANGE, habitatFlow, nF, nO2, nP, P_RANGE, plottable } from "@/lib/space";
import { DUST, INK, SUN } from "@/lib/theme";
import type { ConditionSpace, Habitat, Scenario, SpacePoint } from "@/lib/types";

// world mapping: X = O₂ (log), Y = pressure, Z = effective flow
const SX = 12, SY = 6, SZ = 8;
const mx = (v: number) => (nO2(v) - 0.5) * SX;
const my = (v: number) => nP(v) * SY;
const mz = (v: number) => (nF(v) - 0.5) * SZ;
const ZF = mz(F_RANGE[1]) + 0.3; // front edge where the O₂ and pressure axes sit
const XF = SX / 2 + 0.3; // right edge where the airflow axis sits

export type Selection = { kind: "envelope"; id: string } | { kind: "test"; test: SpacePoint } | null;
export type ViewPreset = "iso" | "front" | "top" | "side";
/** Camera direction (from the target) per preset. Up is always +Y for presets (OrbitControls assumes it). */
const PRESET: Record<ViewPreset, { dir: [number, number, number]; up: [number, number, number] }> = {
  iso: { dir: [10, 7.5, 12], up: [0, 1, 0] },
  front: { dir: [0, 0.18, 1], up: [0, 1, 0] },
  top: { dir: [0.0001, 1, 0.12], up: [0, 1, 0] },
  side: { dir: [1, 0.18, 0], up: [0, 1, 0] },
};
/** Morph-only pose: straight down with O₂ (X) pointing up the screen and airflow (Z) to the right, like the 2D map.
 *  Used only while controls are disabled, so its x-up vector never reaches OrbitControls. */
const MORPH_START = { dir: [0, 1, 0.0001] as [number, number, number], up: [1, 0, 0] as [number, number, number] };
const FOV = 42, FOV_FLAT = 14; // the morph starts nearly orthographic
/** Group scale at the start of the 2D→3D morph: squashes pressure flat and matches the 2D map's aspect. */
const FLAT_SCALE = new THREE.Vector3(0.56, 0.02, 1.5);
const FULL_SCALE = new THREE.Vector3(1, 1, 1);

/* ─────────────────────────── glass volumes (fresnel edges) ─────────────────────────── */
const glassVert = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const glassFrag = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uLit;
varying vec3 vN; varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float a = uOpacity * (0.35 + 1.7 * f) * (1.0 + uLit);
  gl_FragColor = vec4(uColor * (0.55 + 0.9 * f + 0.4 * uLit), clamp(a, 0.0, 0.85));
}`;

function GlassBox({ e, hovered, selected, highlighted, setHovered, onSelect }: {
  e: ConditionSpace["envelopes"][number]; hovered: boolean; selected: boolean; highlighted: boolean;
  setHovered: (id: string | null) => void; onSelect: (s: Selection) => void;
}) {
  const env = e.envelope;
  const o = env.o2Pct!;
  const partial = !env.pressureKpa || !env.flowCmS;
  const p = env.pressureKpa ?? P_RANGE, f = env.flowCmS ?? F_RANGE;
  const x0 = mx(o[0]), x1 = mx(o[1]), y0 = my(p[0]), y1 = my(p[1]), z0 = mz(f[0]), z1 = mz(f[1]);
  const w = Math.max(0.12, x1 - x0), h = Math.max(0.12, y1 - y0), d = Math.max(0.12, z1 - z0);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d]);
  useEffect(() => () => edges.dispose(), [edges]);
  const color = highlighted ? SUN[500] : DUST[300];
  const lit = hovered || selected;
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.1 }, uLit: { value: 0 },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  uniforms.uColor.value.set(color);
  uniforms.uOpacity.value = partial ? 0.04 : env.confidence === "data" ? 0.13 : 0.08;
  uniforms.uLit.value = lit ? 1.2 : 0;
  return (
    <group position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}>
      <mesh onPointerOver={(ev) => { ev.stopPropagation(); setHovered(e.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = ""; }}
        onClick={(ev) => { ev.stopPropagation(); onSelect({ kind: "envelope", id: e.id }); }}>
        <boxGeometry args={[w, h, d]} />
        <shaderMaterial vertexShader={glassVert} fragmentShader={glassFrag} uniforms={uniforms} transparent depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={highlighted ? SUN[500] : DUST[200]} transparent opacity={partial ? 0.25 : lit ? 1 : 0.7} />
      </lineSegments>
    </group>
  );
}

/** Static dashed volume around the habitat when no tested range covers it (no looping pulse). */
function GapVolume({ scenario, uEff }: { scenario: Scenario; uEff: number }) {
  const hx = 0.9, hy = 0.6, hz = 0.8;
  const c = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] as const;
  const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  return (
    <group position={[mx(scenario.o2Pct), Math.max(hy, my(scenario.pressureKpa)), mz(uEff)]}>
      <mesh><boxGeometry args={[hx * 2, hy * 2, hz * 2]} /><meshBasicMaterial color={DUST[400]} transparent opacity={0.05} depthWrite={false} /></mesh>
      {E.map(([a, b], i) => (
        <Line key={i} points={[c[a] as unknown as [number, number, number], c[b] as unknown as [number, number, number]]}
          color={DUST[400]} lineWidth={1.1} dashed dashSize={0.12} gapSize={0.09} transparent opacity={0.75} />
      ))}
    </group>
  );
}

/** The habitat: sun orb + one halo, a drop line to a floor reticle, and projection lines to all three axes. */
function Target({ scenario, uEff }: { scenario: Scenario; uEff: number }) {
  const ref = useRef<THREE.Group>(null);
  const dest = useMemo(() => new THREE.Vector3(), []);
  const x = mx(scenario.o2Pct), y = my(scenario.pressureKpa), z = mz(uEff);
  useFrame((_, dt) => {
    dest.set(x, y, z);
    if (ref.current && ref.current.position.distanceTo(dest) > 0.001) ref.current.position.lerp(dest, Math.min(1, dt * 6));
  });
  const proj = { color: SUN[500], lineWidth: 1, dashed: true, dashSize: 0.1, gapSize: 0.1, transparent: true, opacity: 0.5 } as const;
  return (
    <>
      <group ref={ref} position={[x, y, z]}>
        <mesh><sphereGeometry args={[0.16, 24, 24]} /><meshBasicMaterial color={SUN[500]} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[0.34, 24, 24]} /><meshBasicMaterial color={SUN[500]} transparent opacity={0.18} depthWrite={false} /></mesh>
        <pointLight color={SUN[500]} intensity={5} distance={4} />
      </group>
      <Line points={[[x, 0, z], [x, y, z]]} {...proj} opacity={0.65} />
      <mesh position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.27, 40]} /><meshBasicMaterial color={SUN[500]} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={[[x, 0, z], [x, 0, ZF]]} {...proj} />
      <Line points={[[x, y, z], [-SX / 2, y, ZF]]} {...proj} opacity={0.35} />
      <Line points={[[x, 0, z], [XF, 0, z]]} {...proj} />
    </>
  );
}

function AxesLines() {
  return (
    <group>
      <gridHelper args={[SX + 2, 14, DUST[700], INK[700]]} scale={[1, 1, (SZ + 2) / (SX + 2)]} />
      <Line points={[[-SX / 2, 0, ZF], [SX / 2, 0, ZF]]} color={DUST[300]} lineWidth={1.6} />
      <Line points={[[-SX / 2, 0, ZF], [-SX / 2, SY, ZF]]} color={DUST[400]} lineWidth={1.6} />
      <Line points={[[XF, 0, -SZ / 2], [XF, 0, SZ / 2]]} color={DUST[500]} lineWidth={1.6} />
    </group>
  );
}

function HabitatMarker({ h }: { h: Habitat }) {
  return (
    <mesh position={[mx(h.o2Pct), my(h.pressureKpa), mz(habitatFlow(h))]}>
      <octahedronGeometry args={[0.09]} /><meshBasicMaterial color={DUST[300]} />
    </mesh>
  );
}

function TestPoints({ space, onSelect, selectedId }: { space: ConditionSpace; onSelect: (s: Selection) => void; selectedId: string | null }) {
  const pts = useMemo(() => space.tests.filter((t) => t.pressureKpa != null || t.flowCmS != null), [space]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    pts.forEach((t, i) => {
      o.position.set(mx(t.o2Pct), my(t.pressureKpa ?? P_RANGE[0]), mz(t.flowCmS ?? 0));
      o.scale.setScalar(t.id === selectedId ? 2.2 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(OUTCOME_COLOR[t.outcome] ?? DUST[200]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [pts, selectedId]);
  if (!pts.length) return null;
  return (
    <instancedMesh ref={ref} key={pts.length} args={[undefined, undefined, pts.length]}
      onClick={(e) => { e.stopPropagation(); if (e.instanceId != null) onSelect({ kind: "test", test: pts[e.instanceId] }); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
      <sphereGeometry args={[0.07, 10, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/* ─────────────────────────── camera: fit, tween, morph ─────────────────────────── */
/** World-space points the camera must keep in frame: every axis label anchor plus the content. */
function frameBounds(extra: THREE.Vector3[]) {
  const b = new THREE.Box3(new THREE.Vector3(-SX / 2 - 1.9, -1.3, -SZ / 2 - 0.2), new THREE.Vector3(XF + 2.0, SY + 0.9, ZF + 0.9));
  extra.forEach((p) => b.expandByPoint(p));
  return b;
}

interface Pose { pos: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3; fov: number; scale: THREE.Vector3 }

/** Exact fit: the camera distance at which every corner of `bounds` lands inside both the vertical and horizontal FOV. */
function fitPose(preset: ViewPreset | "morph", bounds: THREE.Box3, aspect: number, fov = FOV, scale = FULL_SCALE): Pose {
  const pr = preset === "morph" ? MORPH_START : PRESET[preset];
  const min = bounds.min.clone().multiply(scale), max = bounds.max.clone().multiply(scale);
  const center = min.clone().add(max).multiplyScalar(0.5);
  const dir = new THREE.Vector3(...pr.dir).normalize();
  const up0 = new THREE.Vector3(...pr.up);
  const right = new THREE.Vector3().crossVectors(up0, dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  const tv = Math.tan(THREE.MathUtils.degToRad(fov) / 2), th = tv * aspect;
  let dist = 0;
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
    const p = new THREE.Vector3(x, y, z).sub(center);
    const depth = p.dot(dir); // towards the camera
    dist = Math.max(dist, depth + Math.abs(p.dot(right)) / th, depth + Math.abs(p.dot(up)) / tv);
  }
  dist *= 1.04;
  return { pos: center.clone().addScaledVector(dir, dist), target: center, up: up0, fov, scale: scale.clone() };
}

function CameraRig({ view, nonce, focus, morph, instant, scaleRef, onMorphDone, onUserMove, tweening }: {
  view: ViewPreset; nonce: number; focus: THREE.Vector3 | null; morph: "in" | "out" | null; instant: boolean;
  scaleRef: React.MutableRefObject<THREE.Vector3>; onMorphDone: () => void; onUserMove: () => void;
  tweening: React.MutableRefObject<boolean>;
}) {
  const { camera, controls, size, invalidate } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera; size: { width: number; height: number }; invalidate: () => void;
    controls: { target: THREE.Vector3; enabled: boolean; update: () => void; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } | null;
  };
  const tw = useRef<{ from: Pose; to: Pose; t0: number; dur: number; done?: () => void } | null>(null);
  const userMoved = useRef(false);
  const aspect = size.width / Math.max(1, size.height);
  const bounds = useMemo(() => frameBounds([]), []);

  const current = (): Pose => ({
    pos: camera.position.clone(), target: controls?.target.clone() ?? new THREE.Vector3(), up: camera.up.clone(),
    fov: camera.fov, scale: scaleRef.current.clone(),
  });
  const apply = (p: Pose) => {
    camera.position.copy(p.pos); camera.up.copy(p.up).normalize(); camera.fov = p.fov; camera.updateProjectionMatrix();
    scaleRef.current.copy(p.scale);
    if (controls) { controls.target.copy(p.target); controls.update(); } else camera.lookAt(p.target);
  };
  const go = (to: Pose, dur: number, done?: () => void) => {
    if (instant || dur <= 0) { apply(to); tw.current = null; tweening.current = false; done?.(); invalidate(); return; }
    tw.current = { from: current(), to, t0: performance.now(), dur: dur * 1000, done };
    tweening.current = true;
    if (controls) controls.enabled = false;
    invalidate();
  };

  // morph in / out (2D ↔ 3D)
  useEffect(() => {
    if (morph === "in") {
      apply(fitPose("morph", bounds, aspect, FOV_FLAT, FLAT_SCALE));
      go(fitPose(view, bounds, aspect), MORPH.duration, onMorphDone);
    } else if (morph === "out") {
      go(fitPose("morph", bounds, aspect, FOV_FLAT, FLAT_SCALE), MORPH.duration, onMorphDone);
    }
  }, [morph]); // eslint-disable-line react-hooks/exhaustive-deps

  // view tabs and reset: animate to the fitted face
  useEffect(() => {
    if (morph) return;
    userMoved.current = false;
    go(fitPose(view, bounds, aspect), MORPH.flyTo);
  }, [view, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // click a volume: fly to it, keeping the current viewing angle
  useEffect(() => {
    if (!focus || morph) return;
    const dir = camera.position.clone().sub(controls?.target ?? new THREE.Vector3()).normalize();
    go({ pos: focus.clone().addScaledVector(dir, 7.5), target: focus.clone(), up: new THREE.Vector3(0, 1, 0), fov: FOV, scale: FULL_SCALE.clone() }, MORPH.flyTo);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // refit on resize unless the user has moved the camera
  useEffect(() => {
    if (tw.current || userMoved.current || morph) return;
    apply(fitPose(view, bounds, aspect));
    invalidate();
  }, [aspect]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!controls) return;
    const start = () => { if (!tweening.current) { userMoved.current = true; onUserMove(); } };
    controls.addEventListener("start", start);
    return () => controls.removeEventListener("start", start);
  }, [controls, onUserMove, tweening]);

  useFrame(() => {
    const t = tw.current;
    if (!t) return;
    const k = Math.min(1, (performance.now() - t.t0) / t.dur);
    const e = easeInOutCubic(k);
    apply({
      pos: t.from.pos.clone().lerp(t.to.pos, e), target: t.from.target.clone().lerp(t.to.target, e),
      up: t.from.up.clone().lerp(t.to.up, e).normalize(), fov: THREE.MathUtils.lerp(t.from.fov, t.to.fov, e),
      scale: t.from.scale.clone().lerp(t.to.scale, e),
    });
    if (k >= 1) {
      tw.current = null; tweening.current = false;
      if (controls) controls.enabled = true;
      t.done?.();
    } else invalidate();
  });
  return null;
}

/** The scene's content group follows the morph scale (pressure extrudes, aspect relaxes). */
function ScaledGroup({ scaleRef, children }: { scaleRef: React.MutableRefObject<THREE.Vector3>; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current && !ref.current.scale.equals(scaleRef.current)) ref.current.scale.copy(scaleRef.current); });
  return <group ref={ref}>{children}</group>;
}

/* ─────────────────────────── labels (one HTML layer outside the canvas) ─────────────────────────── */
interface Anchor { id: string; world: [number, number, number]; text: string; sub?: string; priority: number; fixed?: boolean; kind: "you" | "value" | "title" | "tick" | "box" | "hab" }

const textW = (s: string, px = 11) => Math.ceil(s.length * px * 0.6) + 16;

function Projector({ anchors, scaleRef, onLabels }: { anchors: Anchor[]; scaleRef: React.MutableRefObject<THREE.Vector3>; onLabels: (l: (LabelOut & { a: Anchor })[]) => void }) {
  const { camera, size } = useThree();
  const last = useRef("");
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const s = scaleRef.current;
    const ins: LabelIn[] = [];
    const byId = new Map<string, Anchor>();
    for (const a of anchors) {
      v.set(a.world[0] * s.x, a.world[1] * s.y, a.world[2] * s.z).project(camera);
      if (v.z > 1 || v.z < -1) continue;
      const x = ((v.x + 1) / 2) * size.width, y = ((1 - v.y) / 2) * size.height;
      const px = a.kind === "tick" || a.kind === "hab" ? 10 : 11;
      const w = Math.max(textW(a.text, px), a.sub ? textW(a.sub, 10.5) : 0);
      const h = a.sub ? 36 : a.kind === "tick" ? 16 : 22;
      ins.push({ id: a.id, x, y, w, h, priority: a.priority, fixed: a.fixed });
      byId.set(a.id, a);
    }
    const out = placeLabels(ins, { w: size.width, h: size.height }, EXCLUDE.current);
    const sig = out.map((o) => `${o.id}:${Math.round(o.left)}:${Math.round(o.top)}`).join("|");
    if (sig !== last.current) { last.current = sig; onLabels(out.map((o) => ({ ...o, a: byId.get(o.id)! }))); }
  });
  return null;
}
/** Screen zones labels must avoid (legend/toolbar band at the top, hint/back button at the bottom). Set by the parent. */
const EXCLUDE: { current: { x: number; y: number; w: number; h: number }[] } = { current: [] };

function LabelLayer({ labels, visible }: { labels: (LabelOut & { a: Anchor })[]; visible: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-150" style={{ opacity: visible ? 1 : 0 }} aria-hidden>
      <svg className="absolute inset-0 h-full w-full">
        {labels.filter((l) => l.leader && (l.a.kind === "you" || l.a.kind === "box" || l.a.kind === "hab")).map((l) => {
          const w = Math.max(textW(l.a.text), l.a.sub ? textW(l.a.sub, 10.5) : 0), h = l.a.sub ? 36 : 22;
          const tx = Math.min(Math.max(l.anchorX, l.left), l.left + w), ty = Math.min(Math.max(l.anchorY, l.top), l.top + h);
          return <line key={l.id} x1={l.anchorX} y1={l.anchorY} x2={tx} y2={ty} stroke={l.a.kind === "you" ? SUN[500] : DUST[400]} strokeOpacity={0.6} strokeWidth={1} />;
        })}
      </svg>
      {labels.map((l) => {
        const a = l.a;
        const base = "absolute whitespace-nowrap";
        if (a.kind === "tick") return <span key={l.id} className={`${base} font-mono text-[10px] leading-4 text-dust-400`} style={{ left: l.left, top: l.top }}>{a.text}</span>;
        if (a.kind === "title") return <span key={l.id} className={`${base} text-[11px] leading-[22px] text-dust-300`} style={{ left: l.left, top: l.top }}>{a.text}</span>;
        if (a.kind === "value") return (
          <span key={l.id} className={`${base} rounded-[6px] border border-sun/60 bg-ink-900/90 px-1.5 font-mono text-[10.5px] leading-5 text-dust-100`} style={{ left: l.left, top: l.top }}>{a.text}</span>);
        if (a.kind === "hab") return <span key={l.id} className={`${base} font-mono text-[10px] leading-[22px] text-dust-400`} style={{ left: l.left, top: l.top }}>{a.text}</span>;
        return (
          <div key={l.id} className={`${base} rounded-[8px] border px-2 py-1 text-[11px] leading-tight backdrop-blur ${a.kind === "you" ? "border-sun/70 bg-ink-900/85" : a.priority <= 2 && a.id.startsWith("hl:") ? "border-sun/45 bg-ink-900/85" : "border-dust-500/50 bg-ink-900/85"}`}
            style={{ left: l.left, top: l.top }}>
            <div className={a.kind === "you" ? "font-semibold text-dust-100" : "text-dust-100"}>{a.text}</div>
            {a.sub && <div className="text-dust-300">{a.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── main ─────────────────────────── */
export default function ConditionSpace3D({
  space, scenario, uEff, habitats, highlight, inVoid, missionName, selection, onSelect, view, viewNonce, autoRotate,
  onUserMove, morph = null, onMorphDone, onReady, frameloop = "always", instant = false, topInset = 56, bottomInset = 44,
}: {
  space: ConditionSpace; scenario: Scenario; uEff: number; habitats: Habitat[]; highlight: Set<string>; inVoid: boolean; missionName: string;
  selection: Selection; onSelect: (s: Selection) => void; view: ViewPreset; viewNonce: number; autoRotate: boolean;
  onUserMove?: () => void; morph?: "in" | "out" | null; onMorphDone?: () => void; onReady?: () => void;
  frameloop?: "always" | "demand" | "never"; instant?: boolean; topInset?: number; bottomInset?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [labels, setLabels] = useState<(LabelOut & { a: Anchor })[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const tweening = useRef(false);
  const boxes = plottable(space);
  const selId = selection?.kind === "envelope" ? selection.id : null;

  // label exclusion zones follow the overlay insets and the canvas size
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const set = () => {
      const w = el.clientWidth, h = el.clientHeight;
      EXCLUDE.current = [{ x: 0, y: 0, w, h: topInset }, { x: 0, y: h - bottomInset, w, h: bottomInset }];
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [topInset, bottomInset]);

  const focus = useMemo(() => {
    const e = selId ? boxes.find((b) => b.id === selId) : null;
    if (!e) return null;
    const o = e.envelope.o2Pct!, p = e.envelope.pressureKpa ?? P_RANGE, f = e.envelope.flowCmS ?? F_RANGE;
    return new THREE.Vector3((mx(o[0]) + mx(o[1])) / 2, (my(p[0]) + my(p[1])) / 2, (mz(f[0]) + mz(f[1])) / 2);
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const anchors = useMemo<Anchor[]>(() => {
    const x = mx(scenario.o2Pct), y = my(scenario.pressureKpa), z = mz(uEff);
    const list: Anchor[] = [
      { id: "you", world: [x, y, z], text: `Your scenario · ${missionName}`, sub: inVoid ? "No PSI tested range covers this point" : "Inside a tested range", priority: 0, kind: "you" },
      { id: "v:o2", world: [x, -0.42, ZF], text: `${Math.round(scenario.o2Pct)}%`, priority: 1, fixed: true, kind: "value" },
      { id: "v:p", world: [-SX / 2 - 0.85, y, ZF], text: `${toPsi(scenario.pressureKpa)} psi`, priority: 1, fixed: true, kind: "value" },
      { id: "v:f", world: [XF + 1.1, 0, z], text: `${uEff.toFixed(0)} cm/s`, priority: 1, fixed: true, kind: "value" },
      { id: "t:o2", world: [mx(11), -1.2, ZF + 0.6], text: "Oxygen (%, log scale)", priority: 1.2, fixed: true, kind: "title" },
      { id: "t:p", world: [-SX / 2, SY + 0.6, ZF], text: "Pressure (psi)", priority: 1.2, fixed: true, kind: "title" },
      { id: "t:f", world: [XF + 1.1, 0, mz(F_RANGE[1]) + 0.75], text: "Airflow (cm/s)", priority: 1.2, fixed: true, kind: "title" },
      ...[15, 21, 30, 50, 85].map((v) => ({ id: `k:o${v}`, world: [mx(v), -0.42, ZF] as [number, number, number], text: `${v}%`, priority: 5, fixed: true, kind: "tick" as const })),
      ...[30, 70, 101].map((v) => ({ id: `k:p${v}`, world: [-SX / 2 - 0.85, my(v), ZF] as [number, number, number], text: `${toPsi(v)} psi`, priority: 5, fixed: true, kind: "tick" as const })),
      ...[0, 20, 40, 60].map((v) => ({ id: `k:f${v}`, world: [XF + 1.1, 0, mz(v)] as [number, number, number], text: `${v}`, priority: 5, fixed: true, kind: "tick" as const })),
      ...habitats.filter((h) => h.id !== scenario.habitatId).map((h) => ({
        id: `h:${h.id}`, world: [mx(h.o2Pct), my(h.pressureKpa) + 0.05, mz(habitatFlow(h))] as [number, number, number], text: h.short, priority: 3, kind: "hab" as const,
      })),
    ];
    for (const b of boxes) {
      const lit = b.id === hovered || b.id === selId, hl = highlight.has(b.id);
      if (!lit && !hl) continue;
      const o = b.envelope.o2Pct!, p = b.envelope.pressureKpa ?? P_RANGE, f = b.envelope.flowCmS ?? F_RANGE;
      list.push({
        id: `${hl ? "hl:" : "bx:"}${b.id}`, world: [(mx(o[0]) + mx(o[1])) / 2, my(p[1]) + 0.25, (mz(f[0]) + mz(f[1])) / 2],
        text: `${b.id} · ${b.envelope.confidence === "data" ? "PSI data" : b.envelope.confidence}`, priority: lit ? 1.5 : 2, kind: "box",
      });
    }
    return list;
  }, [scenario, uEff, habitats, boxes, hovered, selId, highlight, inVoid, missionName]);

  return (
    <div ref={wrap} className="relative h-full w-full">
      <Canvas camera={{ position: [10, 7.5, 12], fov: FOV }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: "low-power" }}
        frameloop={frameloop} onPointerMissed={() => onSelect(null)}
        onCreated={() => requestAnimationFrame(() => onReady?.())}
        role="img" aria-label={`3D map of NASA-tested conditions (oxygen, pressure, airflow). ${missionName} ${inVoid ? "sits in an untested gap" : "sits inside a tested range"}. Use the 2D map's "View as table" for a text version.`}>
        <color attach="background" args={[INK[950]]} />
        <fog attach="fog" args={[INK[950], 22, 46]} />
        <ambientLight intensity={0.7} />
        <pointLight position={[6, 10, 6]} intensity={40} color={DUST[100]} />
        <ScaledGroup scaleRef={scaleRef}>
          <AxesLines />
          {boxes.map((e) => (
            <GlassBox key={e.id} e={e} hovered={hovered === e.id} selected={selId === e.id} highlighted={highlight.has(e.id)}
              setHovered={setHovered} onSelect={onSelect} />
          ))}
          <TestPoints space={space} onSelect={onSelect} selectedId={selection?.kind === "test" ? selection.test.id : null} />
          {habitats.filter((h) => h.id !== scenario.habitatId).map((h) => <HabitatMarker key={h.id} h={h} />)}
          {inVoid && <GapVolume scenario={scenario} uEff={uEff} />}
          <Target scenario={scenario} uEff={uEff} />
        </ScaledGroup>
        <OrbitControls enableDamping dampingFactor={0.08} makeDefault minDistance={5} maxDistance={40}
          autoRotate={autoRotate && !hovered && !selection} autoRotateSpeed={0.3} />
        <CameraRig view={view} nonce={viewNonce} focus={focus} morph={morph} instant={instant} scaleRef={scaleRef}
          onMorphDone={() => onMorphDone?.()} onUserMove={onUserMove ?? (() => {})} tweening={tweening} />
        <Projector anchors={anchors} scaleRef={scaleRef} onLabels={setLabels} />
      </Canvas>
      {/* labels appear once the camera has landed, so they never clutter the 2D↔3D morph */}
      <LabelLayer labels={labels} visible={!morph} />
    </div>
  );
}
