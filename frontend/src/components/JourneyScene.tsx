"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ENV_TINT } from "@/lib/environment";
import type { JourneyPlan } from "@/lib/journeyPlan";
import { easeInOutCubic, easeOutBack, JOURNEY } from "@/lib/motion";
import { DUST, INK, SUN } from "@/lib/theme";
import { ReleaseGL } from "./ReleaseGL";

/*
 * Habitat journey: procedural low-poly scenes (primitives only, no assets). ILLUSTRATIVE, not to scale.
 * Fixed camera; scenes move a "rig" group to fake camera moves. One progress value p ∈ [0,1] drives everything:
 *   scene time s = p / 0.86 (reversed for backwards hops), hand-off k = smooth(handoffFrom, 1, p).
 * During the hand-off the destination planet glides onto the exact screen circle of CosmicBackdrop's horizon
 * and every other object fades, so the overlay dissolves into the page without a pop.
 */

const FOV = 40, CAM_Z = 10, GROUND = -1.45;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (s: number, a: number, b: number) => clamp01((s - a) / (b - a));
const smooth = (a: number, b: number, x: number) => { const t = seg(x, a, b); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Env = "lunar" | "mars" | "orbit" | "earth";
const ENV_OF: Record<string, Env> = { iss: "orbit", "lunar-base": "lunar", suit: "lunar", rover: "lunar", mars: "mars", earth: "earth" };

/** Screen circle (px) of CosmicBackdrop's <Horizon>: 118vmax across (170vmax for the suit), anchored bottom-right. */
function horizonCircle(w: number, h: number, suit: boolean) {
  const vmax = Math.max(w, h) / 100;
  const r = (suit ? 85 : 59) * vmax;
  return { cx: w + 26 * vmax - r, cy: h + 80 * vmax - r, r };
}
const focal = (h: number) => (h / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
/** World sphere → screen circle (px) for the fixed camera. */
function toScreen(c: THREE.Vector3, R: number, w: number, h: number) {
  const f = focal(h), rel = c.clone().sub(new THREE.Vector3(0, 0, CAM_Z));
  const depth = Math.max(0.01, -rel.z), dist = Math.max(R * 1.0001, rel.length());
  return { cx: w / 2 + (rel.x / depth) * f, cy: h / 2 - (rel.y / depth) * f, r: f * Math.tan(Math.asin(Math.min(0.999, R / dist))) };
}
/** Screen circle → a sphere at a safe depth, so the camera is never inside it while it moves. */
function fromScreen(cx: number, cy: number, r: number, w: number, h: number, D = 42) {
  const f = focal(h);
  const dir = new THREE.Vector3((cx - w / 2) / f, -(cy - h / 2) / f, -1).normalize();
  return { pos: new THREE.Vector3(0, 0, CAM_Z).addScaledVector(dir, D), R: D * Math.sin(Math.atan(r / f)) };
}

/* ───────────── materials (transparent, so actors can fade at the hand-off) ───────────── */
function useMats() {
  return useMemo(() => {
    const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, transparent: true, ...extra });
      m.userData.base = m.opacity;
      return m;
    };
    const glow = (opacity = 1) => {
      const m = new THREE.MeshBasicMaterial({ color: SUN[500], transparent: true, opacity, toneMapped: false, depthWrite: false });
      m.userData.base = opacity;
      return m;
    };
    return {
      suit: std(DUST[100], { roughness: 0.75 }), suitDark: std(DUST[600]), visor: std(INK[900], { roughness: 0.12, metalness: 0.85 }),
      hull: std(DUST[300]), hullDark: std(DUST[600]), panel: std(INK[600], { roughness: 0.5, metalness: 0.4 }),
      ink: std(INK[700]), inkWall: std(INK[600], { side: THREE.BackSide }), tyre: std(INK[900]),
      print: std(DUST[700], { opacity: 0.85 }), track: std(DUST[700], { opacity: 0.8 }),
      lamp: glow(1), beam: glow(0.12), glint: glow(1), earth: std(ENV_TINT.orbit.limb, { roughness: 1 }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMats>;

/** Fade every material under a group to (1 - k) of its base opacity. */
function fadeGroup(g: THREE.Object3D | null, k: number) {
  g?.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && "opacity" in m && m.userData.base != null) (m as THREE.Material & { opacity: number }).opacity = m.userData.base * (1 - k);
  });
}

/* ───────────── planets ───────────── */
const CRATERS = [...Array(16)].map((_, i) => {
  const a = (i * 2.399) % (Math.PI * 2), y = 0.45 + ((i * 37) % 50) / 100;
  const r = Math.sqrt(1 - y * y);
  return { p: new THREE.Vector3(Math.cos(a) * r * 0.9, y, Math.abs(Math.sin(a)) * r * 0.9 + 0.12).normalize(), s: 0.02 + ((i * 13) % 7) / 220 };
});

function Planet({ env, planet }: { env: Env; planet: React.RefObject<THREE.Mesh | null> }) {
  const t = ENV_TINT[env];
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: t.limb, roughness: 1, metalness: 0, transparent: true }), [t.limb]);
  const crater = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(t.limb).multiplyScalar(0.72), roughness: 1, transparent: true }), [t.limb]);
  const shell = useMemo(() => new THREE.MeshBasicMaterial({ color: DUST[300], transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false }), []);
  useFrame(() => { crater.opacity = mat.opacity; shell.opacity = 0.08 * mat.opacity; }); // fade with the planet
  return (
    <mesh ref={planet} material={mat}>
      <sphereGeometry args={[1, 72, 48]} />
      {t.crater && CRATERS.map((c, i) => (
        <mesh key={i} position={c.p.clone().multiplyScalar(0.995)} material={crater}
          quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), c.p)} scale={[c.s, c.s, c.s * 0.25]}>
          <sphereGeometry args={[1, 12, 8]} />
        </mesh>
      ))}
      {!t.crater && (
        <mesh scale={1.025} material={shell}>
          <sphereGeometry args={[1, 48, 32]} />
        </mesh>
      )}
    </mesh>
  );
}

/* ───────────── stars: three layers, streak with velocity ───────────── */
function Stars({ vel }: { vel: React.MutableRefObject<THREE.Vector2> }) {
  const layers = useMemo(() => [0, 1, 2].map((L) => {
    const n = [220, 150, 90][L];
    const pts = new Float32Array(n * 3), seg = new Float32Array(n * 6);
    let seed = 7 + L * 101;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * 40, y = (rnd() - 0.5) * 24, z = -6 - L * 6 - rnd() * 6;
      pts.set([x, y, z], i * 3);
      seg.set([x, y, z, x, y, z], i * 6);
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(seg, 3));
    return { n, pts, pg, sg, depth: [0.35, 0.65, 1][L] };
  }), []);
  const lines = useRef<(THREE.LineSegments | null)[]>([]);
  useFrame(() => {
    const v = vel.current, speed = v.length();
    layers.forEach((l, L) => {
      const a = l.sg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < l.n; i++) {
        a.array[i * 6 + 3] = l.pts[i * 3] - v.x * l.depth * 2.1;
        a.array[i * 6 + 4] = l.pts[i * 3 + 1] - v.y * l.depth * 2.1;
      }
      a.needsUpdate = true;
      const ln = lines.current[L];
      if (ln) (ln.material as THREE.LineBasicMaterial).opacity = Math.min(0.55, speed * 1.2) * (0.45 + l.depth / 2);
    });
  });
  return (
    <group>
      {layers.map((l, L) => (
        <group key={L}>
          <points geometry={l.pg}>
            <pointsMaterial color={DUST[100]} size={L === 2 ? 2.2 : 1.5} sizeAttenuation={false} transparent opacity={0.35 + L * 0.2} depthWrite={false} />
          </points>
          <lineSegments ref={(r) => { lines.current[L] = r; }} geometry={l.sg}>
            <lineBasicMaterial color={DUST[100]} transparent opacity={0} depthWrite={false} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/* ───────────── dust: slow low-gravity puffs ───────────── */
interface PuffSpec { x: number; y: number; at: number; color?: string; n?: number }
function Puffs({ puffs, sRef, secs, dir, gravity = 0.55 }: { puffs: PuffSpec[]; sRef: React.MutableRefObject<number>; secs: number; dir: 1 | -1; gravity?: number }) {
  const sets = useMemo(() => puffs.map((p, j) => {
    const n = p.n ?? 46;
    const v = new Float32Array(n * 3);
    let seed = 31 + j * 17;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.08 + rnd() * 0.84), sp = 0.35 + rnd() * 0.9;
      v.set([Math.cos(a) * sp, Math.sin(a) * sp * 0.75, (rnd() - 0.5) * 0.6], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.PointsMaterial({ color: p.color ?? DUST[300], size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
    return { p, n, v, g, m };
  }), [puffs]);
  useFrame(() => {
    for (const st of sets) {
      // age counts from the event in playback order, so reversed hops still kick dust *after* each landing
      const age = (dir > 0 ? sRef.current - st.p.at : st.p.at - sRef.current) * secs;
      const live = age >= 0 && age < 1.5;
      st.m.opacity = live ? 0.75 * (1 - age / 1.5) : 0;
      if (!live) continue;
      const a = st.g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < st.n; i++) {
        a.array[i * 3] = st.p.x + st.v[i * 3] * age;
        a.array[i * 3 + 1] = Math.max(st.p.y, st.p.y + st.v[i * 3 + 1] * age - 0.5 * gravity * age * age);
        a.array[i * 3 + 2] = st.v[i * 3 + 2] * age;
      }
      a.needsUpdate = true;
    }
  });
  return <>{sets.map((st, i) => <points key={i} geometry={st.g} material={st.m} />)}</>;
}

/* ───────────── actors ───────────── */
interface AstroPose { x: number; y: number; z: number; scale: number; helmet: number; visor: number; walk: number; face: number }
function Astronaut({ pose, m }: { pose: React.MutableRefObject<AstroPose>; m: Mats }) {
  const root = useRef<THREE.Group>(null), helmet = useRef<THREE.Group>(null), visor = useRef<THREE.Mesh>(null);
  const legL = useRef<THREE.Group>(null), legR = useRef<THREE.Group>(null), armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = pose.current;
    if (!root.current) return;
    root.current.position.set(p.x, p.y, p.z);
    root.current.scale.setScalar(Math.max(0.0001, p.scale));
    root.current.visible = p.scale > 0.01;
    root.current.rotation.y = p.face;
    if (helmet.current) { helmet.current.position.y = 0.74 + p.helmet * 0.45; helmet.current.rotation.z = p.helmet * 0.3; }
    if (visor.current) visor.current.rotation.x = -1.2 * (1 - p.visor);
    const sw = Math.sin(p.walk) * 0.5;
    if (legL.current) legL.current.rotation.z = sw;
    if (legR.current) legR.current.rotation.z = -sw;
    if (armL.current) armL.current.rotation.z = -sw * 0.7 + 0.2;
    if (armR.current) armR.current.rotation.z = sw * 0.7 - 0.2;
  });
  return (
    <group ref={root}>
      <mesh position={[0, 0.44, 0]} material={m.suit}><capsuleGeometry args={[0.17, 0.26, 6, 14]} /></mesh>
      <mesh position={[-0.02, 0.46, -0.16]} material={m.suitDark}><boxGeometry args={[0.28, 0.34, 0.12]} /></mesh>
      <mesh position={[0, 0.5, 0.155]} material={m.suitDark}><boxGeometry args={[0.14, 0.1, 0.03]} /></mesh>
      <mesh position={[0, 0.29, 0]} material={m.suitDark}><torusGeometry args={[0.15, 0.025, 6, 20]} /></mesh>
      {([[legL, -0.07, 0.02], [legR, 0.07, -0.02]] as const).map(([r, x, z], i) => (
        <group key={i} ref={r} position={[x, 0.24, z]}>
          <mesh position={[0, -0.1, 0]} material={m.suit}><capsuleGeometry args={[0.066, 0.13, 4, 10]} /></mesh>
          <mesh position={[0.02, -0.22, 0.02]} material={m.suitDark}><boxGeometry args={[0.13, 0.07, 0.17]} /></mesh>
        </group>
      ))}
      {([[armL, -0.21], [armR, 0.21]] as const).map(([r, x], i) => (
        <group key={i} ref={r} position={[x, 0.56, 0]}>
          <mesh position={[0, -0.11, 0]} material={m.suit}><capsuleGeometry args={[0.052, 0.15, 4, 10]} /></mesh>
          <mesh position={[0, -0.24, 0]} material={m.suitDark}><sphereGeometry args={[0.058, 10, 8]} /></mesh>
        </group>
      ))}
      <group ref={helmet} position={[0, 0.74, 0]}>
        <mesh material={m.suit}><sphereGeometry args={[0.15, 24, 18]} /></mesh>
        <mesh ref={visor} material={m.visor}><sphereGeometry args={[0.153, 28, 18, Math.PI / 2 - 0.95, 1.9, 0.62, 1.2]} /></mesh>
      </group>
    </group>
  );
}

function Dome({ x, y, lights, m }: { x: number; y: number; lights: React.MutableRefObject<number>; m: Mats }) {
  const lamps = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    lamps.current?.children.forEach((c) => { ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lights.current; });
    if (light.current) light.current.intensity = lights.current * 2.5;
  });
  return (
    <group position={[x, y, -0.6]}>
      <mesh material={m.hull}><sphereGeometry args={[0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh material={m.hullDark} position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.62, 0.025, 8, 40]} /></mesh>
      <mesh material={m.hull} position={[0.66, 0.14, 0.1]}><boxGeometry args={[0.22, 0.28, 0.26]} /></mesh>
      <group ref={lamps}>
        {[-0.3, 0, 0.3].map((dx, i) => (
          <mesh key={i} position={[dx, 0.32 - Math.abs(dx) * 0.3, 0.52]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshBasicMaterial color={SUN[500]} transparent opacity={0} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 0.5, 0.9]} color={SUN[500]} intensity={0} distance={3} />
    </group>
  );
}

function Rover({ g, lights, wheels, m }: { g: React.RefObject<THREE.Group | null>; lights: React.MutableRefObject<number>; wheels: React.MutableRefObject<number>; m: Mats }) {
  const ws = useRef<THREE.Group>(null);
  const beams = useRef<THREE.Group>(null);
  useFrame(() => {
    ws.current?.children.forEach((w) => { w.rotation.z = -wheels.current; });
    beams.current?.children.forEach((b, i) => {
      const mat = (b as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = (i < 2 ? 1 : 0.12) * lights.current * (mat.userData.fade ?? 1);
    });
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.34, 0]} material={m.hull}><boxGeometry args={[1.25, 0.3, 0.62]} /></mesh>
      <mesh position={[0.36, 0.58, 0]} material={m.hull}><boxGeometry args={[0.5, 0.26, 0.56]} /></mesh>
      <mesh position={[0.62, 0.6, 0]} material={m.panel}><boxGeometry args={[0.02, 0.16, 0.44]} /></mesh>
      <mesh position={[-0.35, 0.55, 0]} material={m.hullDark}><boxGeometry args={[0.4, 0.14, 0.5]} /></mesh>
      <group ref={ws}>
        {[-0.45, 0, 0.45].flatMap((x) => [0.33, -0.33].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.15, z]} rotation={[Math.PI / 2, 0, 0]} material={m.tyre}>
            <cylinderGeometry args={[0.15, 0.15, 0.1, 14]} />
          </mesh>
        )))}
      </group>
      <group ref={beams}>
        {[0.17, -0.17].map((z) => (
          <mesh key={z} position={[0.64, 0.4, z]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshBasicMaterial color={SUN[500]} transparent opacity={0} toneMapped={false} />
          </mesh>
        ))}
        {[0.17, -0.17].map((z) => (
          <mesh key={`b${z}`} position={[1.25, 0.32, z]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.24, 1.2, 16, 1, true]} />
            <meshBasicMaterial color={SUN[500]} transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Station({ g, m }: { g: React.RefObject<THREE.Group | null>; m: Mats }) {
  return (
    <group ref={g}>
      <mesh material={m.hull}><boxGeometry args={[2.2, 0.06, 0.06]} /></mesh>
      <mesh material={m.hull} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.13, 0.13, 0.5, 16]} /></mesh>
      <mesh material={m.hull} position={[0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.11, 0.11, 0.42, 16]} /></mesh>
      {[-0.95, -0.55, 0.55, 0.95].flatMap((x) => [0.34, -0.34].map((y) => (
        <mesh key={`${x}${y}`} position={[x, y, 0]} material={m.panel}><boxGeometry args={[0.34, 0.5, 0.015]} /></mesh>
      )))}
      <mesh material={m.hullDark} position={[0, 0, -0.32]}><boxGeometry args={[0.6, 0.02, 0.3]} /></mesh>
    </group>
  );
}

function Capsule({ g, m }: { g: React.RefObject<THREE.Group | null>; m: Mats }) {
  return (
    <group ref={g}>
      <mesh material={m.hull} position={[0, 0.06, 0]}><coneGeometry args={[0.17, 0.26, 18]} /></mesh>
      <mesh material={m.hullDark} position={[0, -0.12, 0]}><cylinderGeometry args={[0.17, 0.17, 0.1, 18]} /></mesh>
      <mesh material={m.panel} position={[0, 0.06, 0.12]}><boxGeometry args={[0.06, 0.06, 0.02]} /></mesh>
    </group>
  );
}

function Lander({ g, thrust, m }: { g: React.RefObject<THREE.Group | null>; thrust: React.MutableRefObject<number>; m: Mats }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!flame.current) return;
    flame.current.scale.set(1, 0.2 + thrust.current * 1.4, 1);
    (flame.current.material as THREE.MeshBasicMaterial).opacity = thrust.current * 0.9;
  });
  return (
    <group ref={g}>
      <mesh material={m.hull} position={[0, 0.55, 0]}><boxGeometry args={[0.8, 0.55, 0.7]} /></mesh>
      <mesh material={m.hullDark} position={[0, 0.95, 0]}><coneGeometry args={[0.42, 0.32, 4]} /></mesh>
      {[[-0.42, 0.33], [0.42, 0.33], [-0.42, -0.33], [0.42, -0.33]].map(([x, z], i) => (
        <mesh key={i} material={m.hullDark} position={[x * 1.15, 0.14, z]} rotation={[0, 0, x > 0 ? -0.35 : 0.35]}><cylinderGeometry args={[0.025, 0.025, 0.42, 6]} /></mesh>
      ))}
      <mesh material={m.hullDark} position={[-0.72, 0.16, 0]} rotation={[0, 0, 0.42]}><boxGeometry args={[0.8, 0.03, 0.42]} /></mesh>
      <mesh ref={flame} position={[0, 0.12, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.14, 0.5, 14, 1, true]} />
        <meshBasicMaterial color={SUN[500]} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Satellite({ g, m }: { g: React.RefObject<THREE.Group | null>; m: Mats }) {
  return (
    <group ref={g}>
      <mesh material={m.hull}><boxGeometry args={[0.14, 0.14, 0.14]} /></mesh>
      <mesh material={m.panel} position={[0.28, 0, 0]}><boxGeometry args={[0.4, 0.01, 0.16]} /></mesh>
      <mesh material={m.panel} position={[-0.28, 0, 0]}><boxGeometry args={[0.4, 0.01, 0.16]} /></mesh>
    </group>
  );
}

/* ───────────── the scene ───────────── */
function Scene({ plan, progress }: { plan: JourneyPlan; progress: MotionValue<number> }) {
  const { size } = useThree();
  const m = useMats();
  const fromEnv = ENV_OF[plan.from] ?? "lunar", toEnv = ENV_OF[plan.to] ?? "lunar";
  // the two planets of this hop: "a" is where we leave, "b" where we arrive (swapped for reversed scenes)
  const kind = plan.scene;
  const paired = kind !== "transit" && kind !== "to-earth";
  const sceneFromEnv: Env = plan.dir > 0 ? fromEnv : toEnv;
  const sceneToEnv: Env = plan.dir > 0 ? toEnv : fromEnv;
  const envA: Env = kind === "transit" || kind === "to-earth" ? fromEnv : sceneFromEnv;
  const envB: Env = kind === "to-earth" ? "earth" : kind === "transit" ? toEnv : sceneToEnv;
  const secs = plan.duration * 0.86;

  const mirror = useRef<THREE.Group>(null), rig = useRef<THREE.Group>(null), actors = useRef<THREE.Group>(null);
  const planetA = useRef<THREE.Mesh>(null), planetB = useRef<THREE.Mesh>(null);
  const interior = useRef<THREE.Group>(null), door = useRef<THREE.Mesh>(null), glint = useRef<THREE.Mesh>(null);
  const station = useRef<THREE.Group>(null), capsule = useRef<THREE.Group>(null), sat = useRef<THREE.Group>(null);
  const earthSmall = useRef<THREE.Mesh>(null), rover = useRef<THREE.Group>(null), lander = useRef<THREE.Group>(null);
  const prints = useRef<THREE.Group>(null), tracks = useRef<THREE.Group>(null);
  const astro = useRef<AstroPose>({ x: 0, y: GROUND, z: 0, scale: 0, helmet: 0, visor: 1, walk: 0, face: 0 });
  const domeLights = useRef(0), roverLights = useRef(0), wheels = useRef(0), thrust = useRef(0);
  const sRef = useRef(0), vel = useRef(new THREE.Vector2());

  // footprint + track positions (scene space)
  const HOPS = [2.0, 3.05, 4.1, 5.15];
  const TRACKS = useMemo(() => [...Array(28)].map((_, i) => 0.2 + i * 0.16), []);

  const puffs = useMemo<PuffSpec[]>(() => {
    if (kind === "iss-moon") return [{ x: 1.9, y: GROUND, at: 0.79 }];
    if (kind === "moon-suit") return HOPS.slice(1).map((x, i) => ({ x, y: GROUND, at: 0.52 + i * 0.105, n: 26 }));
    if (kind === "suit-rover") return [0.62, 0.72, 0.82].map((at, i) => ({ x: -0.4 + i * 1.1, y: GROUND, at, n: 22 }));
    if (kind === "rover-mars") return [{ x: 0.2, y: GROUND, at: 0.86, color: ENV_TINT.mars.limb, n: 56 }];
    if (kind === "transit" && (toEnv === "lunar" || toEnv === "mars")) return [{ x: 0.4, y: GROUND, at: 0.84, color: ENV_TINT[toEnv].limb }];
    return [];
  }, [kind, toEnv]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const p = clamp01(progress.get());
    const sf = clamp01(p / 0.86);
    const s = paired && plan.dir < 0 ? 1 - sf : sf; // transits only mirror; paired scenes also run backwards
    sRef.current = s;
    const k = smooth(JOURNEY.handoffFrom, 1, p);
    const ka = smooth(JOURNEY.actorsOut[0], JOURNEY.actorsOut[1], p);
    if (mirror.current) mirror.current.scale.x = plan.dir;
    vel.current.set(0, 0);

    // planet A (leaving) and B (arriving): local transform as {x, y (centre), R}
    let A = { x: 0, y: GROUND - 30, R: 30 }, B = { x: 0, y: -90, R: 30 };
    let rx = 0, ry = 0, rs = 1; // rig: x, y, scale
    const a = astro.current;
    a.scale = 0; a.helmet = 0; a.visor = 1; a.walk = 0; a.face = 0;
    domeLights.current = 0; roverLights.current = 0; thrust.current = 0;
    const vis = (r: React.RefObject<THREE.Object3D | null>, v: boolean) => { if (r.current) r.current.visible = v; };
    [interior, station, capsule, sat, earthSmall, rover, lander, prints, tracks, door, glint].forEach((r) => vis(r, false));

    if (kind === "iss-moon") {
      const sink = easeInOutCubic(seg(s, 0.25, 0.62));
      A = { x: 0, y: lerp(-34, -76, sink), R: 31 };
      B = { x: 0.6, y: lerp(-84, GROUND - 32, easeInOutCubic(seg(s, 0.3, 0.64))), R: 32 };
      vis(station, true); vis(capsule, true);
      const und = easeInOutCubic(seg(s, 0.05, 0.24)), arc = easeInOutCubic(seg(s, 0.22, 0.6)), des = easeInOutCubic(seg(s, 0.6, 0.79));
      const cx = lerp(lerp(0.27, 1.0, und), 2.1, arc), cy = lerp(lerp(1.0, 1.15, und), -0.4, arc);
      const fx = cx, fy = lerp(cy, GROUND + 0.18, des);
      station.current!.position.set(-1.0, 1.0 - arc * 2.2, -0.3);
      station.current!.rotation.set(0.2, -0.4 + s * 0.3, 0.05);
      capsule.current!.position.set(fx, fy, 0);
      capsule.current!.rotation.z = lerp(-Math.PI / 2, 0, seg(s, 0.1, 0.7));
      rx = -lerp(0.1, 1.5, seg(s, 0.05, 0.8)); ry = lerp(0, 0.35, arc);
      vel.current.set(0, (arc > 0 && arc < 1 ? Math.sin(arc * Math.PI) : 0) * -0.5);
      domeLights.current = smooth(0.82, 0.9, s);
    } else if (kind === "moon-suit") {
      A = { x: 0, y: GROUND - 30, R: 30 }; B = A;
      vis(interior, s < 0.5); vis(door, s < 0.46); vis(sat, true); vis(earthSmall, true); vis(prints, true); vis(glint, true);
      const suitUp = seg(s, 0.02, 0.17);
      a.scale = 1.55; a.helmet = 1 - easeOutBack(suitUp); a.visor = smooth(0.17, 0.22, s);
      // glint: one flash as the visor closes
      const gl = seg(s, 0.215, 0.27);
      if (glint.current) { glint.current.scale.setScalar(Math.sin(gl * Math.PI) * 0.22 + 0.0001); }
      // walk to the airlock, then three long low-gravity hops
      let x = 0, y = GROUND, walk = 0;
      if (s < 0.42) { const w = easeInOutCubic(seg(s, 0.3, 0.42)); x = lerp(0, HOPS[0], w); walk = w * 9; }
      else {
        const h = seg(s, 0.42, 0.82) * 3, i = Math.min(2, Math.floor(h)), ph = h - i;
        x = lerp(HOPS[i], HOPS[i + 1], ph);
        y = GROUND + 0.62 * Math.pow(Math.sin(Math.PI * ph), 0.65) * (h < 3 ? 1 : 0);
        walk = Math.sin(ph * Math.PI) * 1.1;
      }
      a.x = x; a.y = y; a.walk = walk; a.face = -0.25;
      if (glint.current) glint.current.position.set(x + 0.08, y + 0.74 * 1.55 + 0.05, 0.3);
      if (door.current) door.current.position.y = GROUND + 0.9 + easeInOutCubic(seg(s, 0.25, 0.36)) * 2.2;
      prints.current?.children.forEach((c, i) => { c.visible = s > 0.42 + (i + 1) * 0.133 - 0.02; });
      if (sat.current) { const t = seg(s, 0.36, 0.95); sat.current.position.set(lerp(-7, 7, t), lerp(2.6, 3.3, t), -5); sat.current.rotation.set(0.3, t * 2, 0.2); }
      if (earthSmall.current) earthSmall.current.position.set(-3.4, 2.4, -7);
      // follow the astronaut, then push in until the suit fills the frame
      const follow = clamp01((x - 0.6) / 4);
      const push = easeInOutCubic(seg(s, 0.74, 0.97));
      rs = lerp(1, 3.1, push);
      rx = lerp(-follow * (x - 0.6) * 0.9, 0.25 - x * rs, push);
      ry = lerp(0.35, -0.25 - (GROUND + 0.85) * rs, push);
    } else if (kind === "suit-rover") {
      A = { x: 0, y: GROUND - 30, R: 30 }; B = A;
      vis(rover, true); vis(tracks, true);
      const w = easeInOutCubic(seg(s, 0, 0.32)), climb = easeInOutCubic(seg(s, 0.32, 0.43));
      a.scale = (1 - climb) * 1.1; a.x = lerp(-2.4, -0.45, w) + climb * 0.5; a.y = GROUND + climb * 0.4 + Math.abs(Math.sin(w * Math.PI * 4)) * 0.18 * (1 - climb);
      a.walk = w * 12; a.face = 0;
      roverLights.current = smooth(0.44, 0.52, s);
      const drive = Math.pow(seg(s, 0.5, 1), 1.6);
      const rxPos = lerp(0, 5, drive);
      wheels.current = rxPos / 0.15;
      rover.current!.position.set(rxPos, GROUND, -0.2);
      tracks.current?.children.forEach((c, i) => { c.visible = TRACKS[i % TRACKS.length] < rxPos - 0.6; });
      rx = -Math.max(0, rxPos - 0.4) * 0.85 + 0.4;
      vel.current.set(drive > 0 && drive < 1 ? 0.15 : 0, 0);
    } else if (kind === "rover-mars") {
      const up = easeInOutCubic(seg(s, 0, 0.22)), lift = Math.pow(seg(s, 0.26, 0.44), 2), land = easeInOutCubic(seg(s, 0.74, 0.86));
      const arrive = easeInOutCubic(seg(s, 0.5, 0.82));
      A = { x: 0, y: GROUND - 30 - lift * 50, R: 30 }; // the Moon falls away: ascent
      B = { x: lerp(14, 0, arrive), y: lerp(18, GROUND - 32, arrive), R: lerp(1.2, 32, arrive) };
      vis(rover, s < 0.24); vis(lander, true);
      roverLights.current = 1;
      rover.current!.position.set(lerp(-2.3, 0.4, up), GROUND + Math.max(0, up - 0.55) * 0.9, -0.2);
      rover.current!.scale.setScalar(1 - smooth(0.17, 0.24, s));
      wheels.current = up * 18;
      const flyY = GROUND + 1.2;
      lander.current!.position.set(0.6, s < 0.74 ? lerp(GROUND, flyY, Math.sqrt(lift)) : lerp(flyY, GROUND, land), -0.3);
      thrust.current = (s > 0.25 && s < 0.5) ? 1 : (s > 0.72 && s < 0.86) ? 0.7 : 0;
      vel.current.set(0, -1.1 * seg(s, 0.36, 0.5) * (1 - seg(s, 0.66, 0.76)));
    } else if (kind === "to-earth") {
      const back = easeInOutCubic(seg(s, 0, 0.85));
      A = { x: lerp(0, -14, back), y: lerp(GROUND - 30, 12, back), R: lerp(30, 1.4, back) };
      B = { x: lerp(8, 0, back), y: lerp(-60, GROUND - 31, back), R: 31 };
      vel.current.set(0, 0.08 * Math.sin(back * Math.PI));
    } else {
      // transit: leave, streak through the stars, arrive
      const leave = easeInOutCubic(seg(s, 0, 0.3)), arrive = easeInOutCubic(seg(s, 0.5, 0.84));
      A = { x: 0, y: lerp(GROUND - 30, -80, leave), R: 30 };
      B = { x: lerp(12, 0, arrive), y: lerp(14, GROUND - 31, arrive), R: lerp(1.0, 31, arrive) };
      vel.current.set(0, Math.sin(seg(s, 0.15, 0.78) * Math.PI) * -1.2);
      if (toEnv === "lunar" && plan.to === "lunar-base") domeLights.current = smooth(0.84, 0.92, s);
      // the craft we ride in: lifts off, cruises with a slight wobble, settles onto the destination
      vis(capsule, true);
      const cruise = Math.sin(s * Math.PI * 6) * 0.04;
      capsule.current!.position.set(0.2, lerp(GROUND + 0.18, 0.5, easeInOutCubic(seg(s, 0, 0.22))) - easeInOutCubic(seg(s, 0.7, 0.86)) * (0.32 - GROUND) + cruise, 0);
      capsule.current!.rotation.z = cruise * 2;
      capsule.current!.scale.setScalar(1.6);
    }

    if (rig.current) { rig.current.position.set(rx, ry, 0); rig.current.scale.setScalar(rs); }
    // place planets in world space (rig applied). The destination planet glides, in screen space, onto the backdrop's
    // horizon circle while it fades; the overlay fades in an exact replica of that horizon, so the dissolve has no pop.
    const W = size.width, Hh = size.height;
    const target = horizonCircle(W, Hh, plan.to === "suit");
    const place = (mesh: THREE.Mesh | null, P: { x: number; y: number; R: number }, dest: boolean) => {
      if (!mesh) return;
      const wx = P.x * rs + rx, wy = P.y * rs + ry, R = P.R * rs;
      mesh.visible = R > 0.01;
      if (!dest || k <= 0) { mesh.position.set(wx, wy, 0); mesh.scale.setScalar(R); return; }
      const c = toScreen(new THREE.Vector3(wx * plan.dir, wy, 0), R, W, Hh); // mirror group flips x
      const sph = fromScreen(lerp(c.cx, target.cx, k), lerp(c.cy, target.cy, k), lerp(c.r, target.r, k), W, Hh);
      mesh.position.set(sph.pos.x * plan.dir, sph.pos.y, sph.pos.z);
      mesh.scale.setScalar(sph.R);
    };
    const same = envA === envB && (kind === "moon-suit" || kind === "suit-rover");
    const destIsA = same || (paired && plan.dir < 0); // reversed scenes end where the forward scene began
    place(planetA.current, A, destIsA);
    place(planetB.current, B, !destIsA);
    if (planetB.current && same) planetB.current.visible = false;
    const other = destIsA ? planetB.current : planetA.current;
    const dest = destIsA ? planetA.current : planetB.current;
    if (other && !same) (other.material as THREE.MeshStandardMaterial).opacity = 1 - k;
    if (dest) (dest.material as THREE.MeshStandardMaterial).opacity = 1 - k; // the replica horizon takes over
    fadeGroup(actors.current, ka);
    domeLights.current *= 1 - ka; roverLights.current *= 1 - ka; thrust.current *= 1 - ka;
    // 5) the dome interior fades with the walk-out AND the hand-off (applied after the actor fade)
    if (kind === "moon-suit") { const f = smooth(0.38, 0.5, s); fadeGroup(interior.current, 1 - (1 - ka) * (1 - f)); }
  }, -1);

  return (
    <group ref={mirror}>
      <Stars vel={vel} />
      <Planet env={envA} planet={planetA} />
      <Planet env={envB} planet={planetB} />
      <group ref={actors}>
        <mesh ref={earthSmall} material={m.earth}><sphereGeometry args={[0.42, 32, 24]} /></mesh>
        <Satellite g={sat} m={m} />
        <group ref={rig}>
          <group ref={interior}>
            <mesh position={[0, GROUND + 1.6, -1.6]} material={m.inkWall}><cylinderGeometry args={[3.6, 3.6, 4.2, 40, 1, true, Math.PI / 2, Math.PI]} /></mesh>
            <mesh position={[0, GROUND - 0.05, 0]} material={m.ink}><boxGeometry args={[8, 0.1, 4.4]} /></mesh>
            {[-1.6, 0, 1.6].map((x) => (
              <mesh key={x} position={[x, GROUND + 3.0, -1.2]}><sphereGeometry args={[0.06, 10, 8]} /><meshBasicMaterial color={SUN[500]} transparent opacity={0.9} toneMapped={false} /></mesh>
            ))}
            <pointLight position={[0, GROUND + 2.6, 0.6]} color={SUN[500]} intensity={2.2} distance={6} />
          </group>
          <mesh ref={door} position={[HOPS[0] + 0.45, GROUND + 0.9, -0.4]} material={m.hullDark}><boxGeometry args={[0.9, 1.8, 0.08]} /></mesh>
          <mesh ref={glint} material={m.glint}><sphereGeometry args={[1, 12, 10]} /></mesh>
          <group ref={prints}>
            {HOPS.slice(1).map((x) => (
              <mesh key={x} position={[x, GROUND + 0.006, 0.1]} rotation={[-Math.PI / 2, 0, 0]} material={m.print}><circleGeometry args={[0.09, 12]} /></mesh>
            ))}
          </group>
          <group ref={tracks}>
            {TRACKS.flatMap((x) => [0.13, -0.53].map((z) => (
              <mesh key={`${x}${z}`} position={[x, GROUND + 0.005, z]} rotation={[-Math.PI / 2, 0, 0]} material={m.track}><planeGeometry args={[0.1, 0.06]} /></mesh>
            )))}
          </group>
          {(kind === "iss-moon" || (kind === "transit" && plan.to === "lunar-base")) && <DomeOnPlanet m={m} lights={domeLights} sRef={sRef} kind={kind} />}
          <Station g={station} m={m} />
          <Capsule g={capsule} m={m} />
          <Rover g={rover} lights={roverLights} wheels={wheels} m={m} />
          <Lander g={lander} thrust={thrust} m={m} />
          <Astronaut pose={astro} m={m} />
          <Puffs puffs={puffs} sRef={sRef} secs={secs} dir={paired && plan.dir < 0 ? -1 : 1} gravity={kind === "rover-mars" ? 1.1 : 0.55} />
        </group>
      </group>
    </group>
  );
}

/** The base dome rises with the moon in ISS → Moon (and on a transit to the Moon base), lights on after touchdown. */
function DomeOnPlanet({ m, lights, sRef, kind }: { m: Mats; lights: React.MutableRefObject<number>; sRef: React.MutableRefObject<number>; kind: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = sRef.current;
    const rise = kind === "iss-moon" ? easeInOutCubic(seg(s, 0.3, 0.64)) : easeInOutCubic(seg(s, 0.5, 0.84));
    if (g.current) { g.current.position.y = lerp(-40, 0, rise); g.current.visible = rise > 0.02; }
  });
  return <group ref={g}><Dome x={0.4} y={GROUND} lights={lights} m={m} /></group>;
}

export default function JourneyCanvas({ plan, progress, onReady }: { plan: JourneyPlan; progress: MotionValue<number>; onReady: () => void }) {
  return (
    <Canvas camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 0.1, far: 200 }} dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); requestAnimationFrame(onReady); }}
      style={{ position: "absolute", inset: 0 }}>
      <hemisphereLight args={[DUST[200], INK[900], 0.55]} />
      <directionalLight position={[-6, 7, 6]} intensity={2.8} color={DUST[100]} />
      <directionalLight position={[4, 3, -5]} intensity={1.6} color={SUN.light} />
      <Scene plan={plan} progress={progress} />
      <ReleaseGL />
    </Canvas>
  );
}
