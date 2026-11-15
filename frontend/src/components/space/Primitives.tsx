"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ENV_TINT } from "@/lib/environment";
import { DUST, INK, SUN } from "@/lib/theme";

/*
 * Procedural low-poly space primitives (no assets): planets, star field with velocity streaks, dust puffs, astronaut,
 * dome, rover, station, capsule, lander, satellite. Matte taupe and navy; sun only for lights and the craft beacon.
 * Used by the Answer hero (HeroScene). ILLUSTRATIVE, not to scale.
 */

export const GROUND = -1.45;
export type Env = "lunar" | "mars" | "orbit" | "earth";
export const ENV_OF: Record<string, Env> = { iss: "orbit", "lunar-base": "lunar", suit: "lunar", rover: "lunar", mars: "mars", earth: "earth" };

/* ───────────── materials (transparent, so actors can fade at the hand-off) ───────────── */
export function useMats() {
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
export type Mats = ReturnType<typeof useMats>;

/** Fade every material under a group to (1 - k) of its base opacity. */
export function fadeGroup(g: THREE.Object3D | null, k: number) {
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

export function Planet({ env, planet }: { env: Env; planet: React.RefObject<THREE.Mesh | null> }) {
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
export function Stars({ vel }: { vel: React.MutableRefObject<THREE.Vector2> }) {
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
export interface PuffSpec { x: number; y: number; at: number; color?: string; n?: number }
export function Puffs({ puffs, sRef, secs, dir, gravity = 0.55 }: { puffs: PuffSpec[]; sRef: React.MutableRefObject<number>; secs: number; dir: 1 | -1; gravity?: number }) {
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
export interface AstroPose { x: number; y: number; z: number; scale: number; helmet: number; visor: number; walk: number; face: number }
export function Astronaut({ pose, m }: { pose: React.MutableRefObject<AstroPose>; m: Mats }) {
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

export function Dome({ x, y, lights, m }: { x: number; y: number; lights: React.MutableRefObject<number>; m: Mats }) {
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

export function Rover({ g, lights, wheels, m }: { g: React.RefObject<THREE.Group | null>; lights: React.MutableRefObject<number>; wheels: React.MutableRefObject<number>; m: Mats }) {
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

export function Station({ g, m }: { g: React.RefObject<THREE.Group | null>; m: Mats }) {
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

export function Capsule({ g, m }: { g: React.RefObject<THREE.Group | null>; m: Mats }) {
  return (
    <group ref={g}>
      <mesh material={m.hull} position={[0, 0.06, 0]}><coneGeometry args={[0.17, 0.26, 18]} /></mesh>
      <mesh material={m.hullDark} position={[0, -0.12, 0]}><cylinderGeometry args={[0.17, 0.17, 0.1, 18]} /></mesh>
      <mesh material={m.panel} position={[0, 0.06, 0.12]}><boxGeometry args={[0.06, 0.06, 0.02]} /></mesh>
    </group>
  );
}

export function Lander({ g, thrust, m }: { g: React.RefObject<THREE.Group | null>; thrust: React.MutableRefObject<number>; m: Mats }) {
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

export function Satellite({ g, m }: { g: React.RefObject<THREE.Group | null>; m: Mats }) {
  return (
    <group ref={g}>
      <mesh material={m.hull}><boxGeometry args={[0.14, 0.14, 0.14]} /></mesh>
      <mesh material={m.panel} position={[0.28, 0, 0]}><boxGeometry args={[0.4, 0.01, 0.16]} /></mesh>
      <mesh material={m.panel} position={[-0.28, 0, 0]}><boxGeometry args={[0.4, 0.01, 0.16]} /></mesh>
    </group>
  );
}

