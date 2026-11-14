"use client";

import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OUTCOME_COLOR } from "@/lib/format";
import { F_RANGE, habitatFlow, nF, nO2, nP, P_RANGE, plottable } from "@/lib/space";
import type { ConditionSpace, Habitat, Scenario, SpacePoint } from "@/lib/types";

// world mapping: X = O₂ (log), Y = pressure, Z = effective flow
const SX = 12, SY = 6, SZ = 8;
const mx = (v: number) => (nO2(v) - 0.5) * SX;
const my = (v: number) => nP(v) * SY;
const mz = (v: number) => (nF(v) - 0.5) * SZ;

export type Selection = { kind: "envelope"; id: string } | { kind: "test"; test: SpacePoint } | null;
export type ViewPreset = "iso" | "front" | "top" | "side";
export const VIEW_POS: Record<ViewPreset, [number, number, number]> = {
  iso: [10, 7.5, 12], front: [0, 3.2, 16], top: [0, 17, 0.01], side: [17, 3.4, 0],
};

const BLUE = "#087BFF", BLUE_EDGE = "#48BFFF", ORANGE = "#FF8B32";

function EnvelopeBox({ e, hovered, selected, highlighted, setHovered, onSelect }: {
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
  const color = highlighted ? ORANGE : BLUE;
  const lit = hovered || selected;
  const op = (partial ? 0.045 : env.confidence === "data" ? 0.3 : 0.16) * (lit ? 2.2 : 1);
  return (
    <group position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}>
      <mesh onPointerOver={(ev) => { ev.stopPropagation(); setHovered(e.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = ""; }}
        onClick={(ev) => { ev.stopPropagation(); onSelect({ kind: "envelope", id: e.id }); }}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} transparent opacity={Math.min(op, 0.55)} emissive={color} emissiveIntensity={lit ? 0.9 : 0.4} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={highlighted ? ORANGE : BLUE_EDGE} transparent opacity={partial ? 0.22 : lit ? 1 : 0.65} />
      </lineSegments>
      {(lit || highlighted) && (
        <Html center distanceFactor={14} position={[0, h / 2 + 0.38, 0]} style={{ pointerEvents: "none" }}>
          <div className={`whitespace-nowrap rounded-md border px-2 py-1 text-[11px] backdrop-blur ${highlighted ? "border-[#FF8B32]/60 bg-[#1a0f06]/85 text-orange-100" : "border-[#48BFFF]/50 bg-[#061226]/85 text-slate-100"}`}>
            <b>{e.id}</b> · {env.confidence === "data" ? "PSI data" : env.confidence}{partial ? " · axis uncharacterized" : ""}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Dashed, hatched volume around the mission when no envelope covers it. */
function GapVolume({ scenario, uEff }: { scenario: Scenario; uEff: number }) {
  const cx = mx(scenario.o2Pct), cy = my(scenario.pressureKpa), cz = mz(uEff);
  const hx = 0.9, hy = 0.6, hz = 0.8;
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.opacity = 0.05 + 0.03 * Math.sin(clock.elapsedTime * 1.6); });
  const c = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
  ] as const;
  const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  return (
    <group position={[cx, Math.max(hy, cy), cz]}>
      <mesh><boxGeometry args={[hx * 2, hy * 2, hz * 2]} /><meshBasicMaterial ref={ref} color="#48BFFF" transparent opacity={0.06} depthWrite={false} /></mesh>
      {E.map(([a, b], i) => (
        <Line key={i} points={[c[a] as unknown as [number, number, number], c[b] as unknown as [number, number, number]]} color="#48BFFF" lineWidth={1.2} dashed dashSize={0.12} gapSize={0.09} transparent opacity={0.85} />
      ))}
    </group>
  );
}

function Target({ scenario, uEff, inVoid, name }: { scenario: Scenario; uEff: number; inVoid: boolean; name: string }) {
  const ref = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => new THREE.Vector3(), []);
  useFrame((s, dt) => {
    pos.set(mx(scenario.o2Pct), my(scenario.pressureKpa), mz(uEff));
    ref.current?.position.lerp(pos, Math.min(1, dt * 5));
    if (ring.current && ref.current) {
      const k = (s.clock.elapsedTime * 0.7) % 1;
      ring.current.scale.setScalar(1 + k * 2.4);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    }
  });
  const x = mx(scenario.o2Pct), y = my(scenario.pressureKpa), z = mz(uEff);
  return (
    <>
      <group ref={ref} position={[x, y, z]}>
        <mesh><sphereGeometry args={[0.15, 24, 24]} /><meshBasicMaterial color="#FFC15B" toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[0.32, 24, 24]} /><meshBasicMaterial color={ORANGE} transparent opacity={0.25} depthWrite={false} /></mesh>
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.24, 0.28, 48]} /><meshBasicMaterial color={ORANGE} transparent side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <pointLight color={ORANGE} intensity={6} distance={4} />
        <Html center distanceFactor={12} position={[0, 0.72, 0]} style={{ pointerEvents: "none" }}>
          <div className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] backdrop-blur ${inVoid ? "border-[#FF8B32]/70 bg-[#1a0d06]/85" : "border-[#34D399]/50 bg-[#05170f]/85"}`}>
            <div className="font-semibold text-slate-50">Your scenario · {name}</div>
            <div className={inVoid ? "text-orange-200" : "text-emerald-200"}>{inVoid ? "No PSI tested range covers this point" : "Inside a tested range"}</div>
          </div>
        </Html>
      </group>
      <Line points={[[x, 0, z], [x, y, z]]} color={ORANGE} lineWidth={1} dashed dashSize={0.12} gapSize={0.1} transparent opacity={0.6} />
    </>
  );
}

function Axes() {
  const tick = (key: string, pos: [number, number, number], text: string) => (
    <Html key={key} position={pos} center distanceFactor={16} style={{ pointerEvents: "none" }}>
      <span className="whitespace-nowrap font-mono text-[10px] text-slate-500">{text}</span>
    </Html>
  );
  const zf = mz(F_RANGE[1]) + 0.3;
  return (
    <group>
      <gridHelper args={[SX + 2, 14, "#17345e", "#0c1c36"]} scale={[1, 1, (SZ + 2) / (SX + 2)]} />
      <Line points={[[-SX / 2, 0, zf], [SX / 2, 0, zf]]} color="#19C9FF" lineWidth={1.6} />
      <Line points={[[-SX / 2, 0, zf], [-SX / 2, SY, zf]]} color="#087BFF" lineWidth={1.6} />
      <Line points={[[SX / 2 + 0.3, 0, -SZ / 2], [SX / 2 + 0.3, 0, SZ / 2]]} color="#8FD8FF" lineWidth={1.6} />
      {[15, 21, 30, 50, 85].map((v) => tick(`o${v}`, [mx(v), -0.35, zf], `${v}%`))}
      {[30, 70, 101].map((v) => tick(`p${v}`, [-SX / 2 - 0.65, my(v), zf], `${v} kPa`))}
      {[0, 20, 40, 60].map((v) => tick(`f${v}`, [SX / 2 + 1, 0, mz(v)], `${v} cm/s`))}
      <Html position={[0, -0.95, zf]} center distanceFactor={14}><span className="label !text-ox">O₂ % (log)</span></Html>
      <Html position={[-SX / 2 - 0.4, SY + 0.5, zf]} center distanceFactor={14}><span className="label !text-[#5aa8ff]">pressure</span></Html>
      <Html position={[SX / 2 + 1.6, 0, 0]} center distanceFactor={14}><span className="label !text-[#8FD8FF]">airflow</span></Html>
    </group>
  );
}

function HabitatMarker({ h }: { h: Habitat }) {
  return (
    <group position={[mx(h.o2Pct), my(h.pressureKpa), mz(habitatFlow(h))]}>
      <mesh><octahedronGeometry args={[0.08]} /><meshBasicMaterial color="#DCE7F5" /></mesh>
      <Html center distanceFactor={16} position={[0, 0.28, 0]} style={{ pointerEvents: "none" }}>
        <span className="whitespace-nowrap font-mono text-[10px] text-slate-400">{h.short}</span>
      </Html>
    </group>
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
      m.setColorAt(i, c.set(OUTCOME_COLOR[t.outcome] ?? "#DCE7F5"));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [pts, selectedId]);
  if (!pts.length) return null;
  return (
    <instancedMesh ref={ref} key={pts.length} args={[undefined, undefined, pts.length]}
      onClick={(e) => { e.stopPropagation(); if (e.instanceId != null) onSelect({ kind: "test", test: pts[e.instanceId] }); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
      <sphereGeometry args={[0.075, 12, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Smoothly flies the camera to a preset; the user can orbit freely afterwards. */
function CameraRig({ view, nonce }: { view: ViewPreset; nonce: number }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3; update: () => void } | null };
  const flying = useRef(false);
  const dest = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { dest.set(...VIEW_POS[view]); flying.current = true; }, [view, nonce, dest]);
  useFrame((_, dt) => {
    if (!flying.current) return;
    camera.position.lerp(dest, Math.min(1, dt * 3.2));
    if (controls) { controls.target.lerp(new THREE.Vector3(0, 2.2, 0), Math.min(1, dt * 3.2)); controls.update(); }
    if (camera.position.distanceTo(dest) < 0.05) flying.current = false;
  });
  return null;
}

export default function ConditionSpace3D({ space, scenario, uEff, habitats, highlight, inVoid, missionName, selection, onSelect, view, viewNonce, autoRotate }: {
  space: ConditionSpace; scenario: Scenario; uEff: number; habitats: Habitat[]; highlight: Set<string>; inVoid: boolean; missionName: string;
  selection: Selection; onSelect: (s: Selection) => void; view: ViewPreset; viewNonce: number; autoRotate: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const boxes = plottable(space);
  const selId = selection?.kind === "envelope" ? selection.id : null;
  return (
    <Canvas camera={{ position: VIEW_POS.iso, fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true }} onPointerMissed={() => onSelect(null)}>
      <color attach="background" args={["#030a18"]} />
      <fog attach="fog" args={["#030a18", 20, 42]} />
      <ambientLight intensity={0.7} />
      <pointLight position={[6, 10, 6]} intensity={40} color="#9BD8FF" />
      <Axes />
      {boxes.map((e) => (
        <EnvelopeBox key={e.id} e={e} hovered={hovered === e.id} selected={selId === e.id} highlighted={highlight.has(e.id)}
          setHovered={setHovered} onSelect={onSelect} />
      ))}
      <TestPoints space={space} onSelect={onSelect} selectedId={selection?.kind === "test" ? selection.test.id : null} />
      {habitats.filter((h) => h.id !== scenario.habitatId).map((h) => <HabitatMarker key={h.id} h={h} />)}
      {inVoid && <GapVolume scenario={scenario} uEff={uEff} />}
      <Target scenario={scenario} uEff={uEff} inVoid={inVoid} name={missionName} />
      <OrbitControls enableDamping makeDefault autoRotate={autoRotate && !hovered && !selection} autoRotateSpeed={0.35} minDistance={6} maxDistance={30} target={[0, 2.2, 0]} />
      <CameraRig view={view} nonce={viewNonce} />
    </Canvas>
  );
}
