"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import * as THREE from "three";
import type { JourneyPlan } from "@/lib/journeyPlan";
import { easeInOutCubic, easeOutBack } from "@/lib/motion";
import { DUST, INK, SUN } from "@/lib/theme";
import { ReleaseGL } from "./ReleaseGL";
import {
  type AstroPose, Astronaut, Capsule, Dome, ENV_OF, type Env, Planet, Rover, Station, Stars, useMats,
} from "./space/Primitives";

/*
 * Answer hero: one body per habitat at rest (slow turn, the craft bobbing beside it), and one basic travel sequence
 * A → B: the origin body recedes, the craft crosses a star field whose stars stretch into short streaks, the
 * destination grows into frame, the craft settles. Backwards hops mirror the motion; the resting composition never
 * changes. The craft carries the only sun accent (the "you are here" marker). ILLUSTRATIVE, not to scale.
 */

const FOV = 40, CAM_Z = 10;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (s: number, a: number, b: number) => clamp01((s - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Kind = "disc" | "surface";
/** How each habitat is drawn: a planet disc with a small object on its limb, or a close surface with an object on it. */
const BODY: Record<string, { kind: Kind; obj: "station" | "dome" | "astro" | "rover" | "none" }> = {
  iss: { kind: "disc", obj: "station" }, "lunar-base": { kind: "disc", obj: "dome" }, suit: { kind: "surface", obj: "astro" },
  rover: { kind: "surface", obj: "rover" }, mars: { kind: "disc", obj: "none" }, earth: { kind: "disc", obj: "none" },
};

/** Resting layout in world units for this viewport: body on the right (text sits on the left), lower on phones. */
function layout(aspect: number) {
  const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_Z, halfW = halfH * aspect;
  const narrow = aspect < 0.9;
  const R = narrow ? halfW * 0.7 : Math.min(halfH * 0.72, halfW * 0.34);
  const cx = narrow ? halfW * 0.25 : halfW * 0.5;
  const cy = narrow ? -halfH * 0.62 : -halfH * 0.12;
  return { halfW, halfH, R, cx, cy, narrow };
}

function Body({ id, groupRef, astro, planetRef, roverRef, stationRef, domeLights }: {
  id: string; groupRef: React.RefObject<THREE.Group | null>;
  astro: React.MutableRefObject<AstroPose>; planetRef: React.RefObject<THREE.Mesh | null>;
  roverRef: React.RefObject<THREE.Group | null>; stationRef: React.RefObject<THREE.Group | null>;
  domeLights: React.MutableRefObject<number>;
}) {
  const m = useMats(); // per body, so fading the origin never fades the destination
  const wheels = useRef(0);
  const env: Env = ENV_OF[id] ?? "lunar";
  const b = BODY[id] ?? BODY["lunar-base"];
  return (
    <group ref={groupRef}>
      <Planet env={env} planet={planetRef} />
      {b.obj === "station" && <Station g={stationRef} m={m} />}
      {b.obj === "dome" && <group position={[0, 0, 0]}><Dome x={0} y={0} lights={domeLights} m={m} /></group>}
      {b.obj === "astro" && <Astronaut pose={astro} m={m} />}
      {b.obj === "rover" && <Rover g={roverRef} lights={domeLights} wheels={wheels} m={m} />}
    </group>
  );
}

function Scene({ habitat, plan, progress, settle }: { habitat: string; plan: JourneyPlan | null; progress: MotionValue<number>; settle: React.MutableRefObject<number> }) {
  const { size } = useThree();
  const m = useMats();
  const vel = useRef(new THREE.Vector2());
  // two body slots: A (origin while travelling) and B (current/destination)
  const gA = useRef<THREE.Group>(null), gB = useRef<THREE.Group>(null);
  const pA = useRef<THREE.Mesh>(null), pB = useRef<THREE.Mesh>(null);
  const rA = useRef<THREE.Group>(null), rB = useRef<THREE.Group>(null), sA = useRef<THREE.Group>(null), sB = useRef<THREE.Group>(null);
  const astA = useRef<AstroPose>({ x: 0, y: 0, z: 0, scale: 0, helmet: 0, visor: 1, walk: 0, face: -0.3 });
  const astB = useRef<AstroPose>({ x: 0, y: 0, z: 0, scale: 0, helmet: 0, visor: 1, walk: 0, face: -0.3 });
  const lightsA = useRef(1), lightsB = useRef(1);
  const craft = useRef<THREE.Group>(null), beacon = useRef<THREE.Mesh>(null), capsule = useRef<THREE.Group>(null);
  const t = useRef(0);

  const travelling = !!plan && plan.to === habitat;
  const from = travelling ? plan!.from : habitat;

  useFrame((_, dt) => {
    t.current += dt;
    const L = layout(size.width / Math.max(1, size.height));
    const p = travelling ? clamp01(progress.get()) : 1;
    const dir = travelling ? plan!.dir : 1;
    const ease = easeInOutCubic;
    const st = clamp01(settle.current);

    // place a body group at its resting pose, scaled by `s`, shifted by (dx, dy, dz)
    const pose = (g: THREE.Group | null, planet: THREE.Mesh | null, id: string, s: number, dx: number, dy: number, dz: number, ast: AstroPose, rover: THREE.Group | null, station: THREE.Group | null, alpha: number) => {
      if (!g || !planet) return;
      const b = BODY[id] ?? BODY["lunar-base"];
      g.visible = s > 0.01 && alpha > 0.01;
      const surf = b.kind === "surface";
      // a close surface is a much bigger sphere whose top crosses the lower right of the frame
      const R = surf ? L.R * 4.2 : L.R;
      const cy = surf ? L.cy - R + L.R * 0.55 : L.cy;
      g.position.set(L.cx + dx, cy + dy, dz);
      g.scale.setScalar(s);
      planet.scale.setScalar(R);
      planet.rotation.y += dt * 0.03; // the body turns very slowly
      (planet.material as THREE.MeshStandardMaterial).opacity = alpha;
      const topY = R; // local top of the sphere
      const objX = surf ? -L.R * 0.35 : -R * 0.45, objY = surf ? topY : Math.sqrt(Math.max(0, R * R - objX * objX));
      const k = surf ? L.R * 0.42 : L.R * 0.22;
      if (b.obj === "astro") { Object.assign(ast, { x: objX, y: objY, z: 0.3, scale: k * 1.4, walk: Math.sin(t.current * 1.4) * 0.15 }); }
      else ast.scale = 0;
      if (rover) { rover.position.set(objX, objY, 0.2); rover.scale.setScalar(k * 1.1); }
      if (station) { station.position.set(-R * 0.55, R * 0.95, R * 0.25); station.scale.setScalar(k * 1.3); station.rotation.set(0.25, t.current * 0.08, 0.1); }
      g.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (mat && o !== planet && mat.userData.base != null) (mat as THREE.Material & { opacity: number }).opacity = mat.userData.base * alpha;
      });
    };

    // origin body recedes (0–0.5), destination grows into frame (0.42–0.95)
    const out = ease(seg(p, 0, 0.5)), inn = ease(seg(p, 0.42, 0.95));
    if (travelling) {
      pose(gA.current, pA.current, from, lerp(1, 0.25, out), -dir * out * L.halfW * 0.9, out * L.halfH * 0.2, -out * 18, astA.current, rA.current, sA.current, 1 - seg(p, 0.25, 0.55));
      pose(gB.current, pB.current, habitat, lerp(0.12, 1, inn), dir * (1 - inn) * L.halfW * 0.8, (1 - inn) * L.halfH * 0.25, -(1 - inn) * 22, astB.current, rB.current, sB.current, seg(p, 0.42, 0.6));
    } else {
      if (gA.current) gA.current.visible = false;
      // gentle settle-in on first show / deep link
      pose(gB.current, pB.current, habitat, lerp(0.92, 1, easeOutBack(st)), 0, (1 - st) * -0.3, 0, astB.current, rB.current, sB.current, st);
    }

    // stars stretch into short streaks while travelling
    const speed = travelling ? Math.sin(seg(p, 0.12, 0.8) * Math.PI) : 0;
    vel.current.set(dir * speed * 1.1, 0);

    // the craft: crosses from the far side, then settles beside the body and bobs
    if (craft.current) {
      const restX = L.cx - L.R * (L.narrow ? 0.2 : 1.25), restY = L.cy + L.R * (L.narrow ? 1.35 : 0.85);
      const c = ease(seg(p, 0.08, 0.88));
      const startX = -dir * (L.halfW + 1.5);
      const x = travelling ? lerp(startX, restX, c) : restX;
      const y = (travelling ? lerp(restY + 0.8, restY, c) + Math.sin(c * Math.PI) * 0.6 : restY) + Math.sin(t.current * 1.6) * 0.06;
      craft.current.position.set(x, y, 1.2);
      craft.current.rotation.z = travelling ? -dir * (Math.PI / 2) * (1 - seg(p, 0.7, 0.95)) : Math.sin(t.current * 1.1) * 0.05;
      craft.current.scale.setScalar(L.narrow ? 0.9 : 1.15);
      craft.current.visible = st > 0.05 || travelling;
    }
    if (beacon.current) (beacon.current.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * Math.sin(t.current * 3);
  });

  return (
    <>
      <Stars vel={vel} />
      <Body key={`a-${from}`} id={from} groupRef={gA} astro={astA} planetRef={pA} roverRef={rA} stationRef={sA} domeLights={lightsA} />
      <Body key={`b-${habitat}`} id={habitat} groupRef={gB} astro={astB} planetRef={pB} roverRef={rB} stationRef={sB} domeLights={lightsB} />
      <group ref={craft}>
        <Capsule g={capsule} m={m} />
        <mesh ref={beacon} position={[0, 0.24, 0]}><sphereGeometry args={[0.045, 12, 10]} /><meshBasicMaterial color={SUN[500]} transparent toneMapped={false} /></mesh>
        <pointLight position={[0, 0.3, 0.3]} color={SUN[500]} intensity={1.2} distance={2.5} />
      </group>
    </>
  );
}

export default function HeroCanvas({ habitat, plan, progress, settle, active }: {
  habitat: string; plan: JourneyPlan | null; progress: MotionValue<number>; settle: React.MutableRefObject<number>; active: boolean;
}) {
  return (
    <Canvas camera={{ position: [0, 0, CAM_Z], fov: FOV, near: 0.1, far: 200 }} dpr={[1, 1.75]} frameloop={active ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: "absolute", inset: 0 }} aria-hidden>
      <hemisphereLight args={[DUST[200], INK[900], 0.5]} />
      <directionalLight position={[-6, 7, 6]} intensity={2.6} color={DUST[100]} />
      <directionalLight position={[5, 2, -4]} intensity={1.3} color={SUN.light} />
      <Scene habitat={habitat} plan={plan} progress={progress} settle={settle} />
      <ReleaseGL />
    </Canvas>
  );
}
