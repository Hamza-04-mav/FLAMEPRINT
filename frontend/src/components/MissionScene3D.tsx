"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Environment } from "@/lib/environment";

/* ───────── deterministic value noise (JS, for terrain) ───────── */
function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const p = Array.from({ length: 256 }, (_, i) => i).sort(() => rnd() - 0.5);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h: number) => (perm[h] / 255) * 2 - 1;
  const fade = (t: number) => t * t * (3 - 2 * t);
  const n2 = (x: number, y: number) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const a = grad(perm[xi] + yi), b = grad(perm[xi + 1] + yi), c = grad(perm[xi] + yi + 1), d = grad(perm[xi + 1] + yi + 1);
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x: number, y: number, oct = 5) => {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += amp * n2(x * f, y * f); f *= 2.02; amp *= 0.5; }
    return v;
  };
}

const BASE = new THREE.Vector3(4.2, 0, -1.5);

/* ───────── terrain ───────── */
function Terrain({ env }: { env: "lunar" | "mars" }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(110, 70, 220, 140);
    g.rotateX(-Math.PI / 2);
    const fbm = makeNoise(env === "lunar" ? 7 : 21);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const lo = new THREE.Color(env === "lunar" ? "#4d5664" : "#6a2e17");
    const hi = new THREE.Color(env === "lunar" ? "#d2d8e2" : "#d27a46");
    const craters = Array.from({ length: 34 }, (_, i) => {
      const a = fbm(i * 3.1, 9.7) * 40, b = fbm(4.2, i * 2.3) * 26;
      return { x: a * 1.4, z: b * 1.3 - 6, r: 0.8 + Math.abs(fbm(i, i)) * 3.4 };
    });
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let h = fbm(x * 0.06, z * 0.06) * (env === "lunar" ? 1.6 : 2.4) + fbm(x * 0.4, z * 0.4, 3) * 0.18;
      for (const k of craters) {
        const d = Math.hypot(x - k.x, z - k.z) / k.r;
        if (d < 1.35) h += d < 1 ? -0.55 * k.r * 0.25 * (1 - d * d) : 0.35 * k.r * 0.18 * Math.cos((d - 1) * 4.5);
      }
      // flatten the pad around the habitat
      const db = Math.hypot(x - BASE.x, z - BASE.z);
      const flat = THREE.MathUtils.smoothstep(db, 5.5, 9);
      h *= flat;
      // planetary curvature: the horizon falls away with distance from the camera
      const dz = z - 14;
      h -= (x * x * 0.0016 + dz * dz * 0.0024);
      pos.setY(i, h - 0.02);
      const t = THREE.MathUtils.clamp(0.55 + fbm(x * 0.15, z * 0.15, 3) * 0.6 + h * 0.08, 0, 1);
      c.copy(lo).lerp(hi, t);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [env]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}

/* ───────── planet shader (Earth) ───────── */
const planetVert = /* glsl */ `
varying vec3 vObj; varying vec3 vW; varying vec3 vWP;
void main(){
  vObj = normal;
  vW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const planetFrag = /* glsl */ `
precision highp float;
varying vec3 vObj; varying vec3 vW; varying vec3 vWP;
uniform vec3 uSun; uniform float uTime;
float h(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h(i+vec3(0,0,0)),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*n3(p); p*=2.03; a*=0.5;} return v; }
void main(){
  vec3 p = vObj;
  float c = fbm(p*2.4 + 3.0);
  float land = smoothstep(0.50, 0.535, c);
  float lat = abs(p.y);
  vec3 ocean = mix(vec3(0.01,0.07,0.22), vec3(0.03,0.18,0.42), smoothstep(0.35,0.5,c));
  vec3 ground = mix(vec3(0.10,0.24,0.10), vec3(0.42,0.34,0.22), fbm(p*6.0));
  ground = mix(ground, vec3(0.9), smoothstep(0.78, 0.9, lat));
  vec3 col = mix(ocean, ground, land);
  float cl = smoothstep(0.52, 0.78, fbm(p*3.5 + vec3(uTime*0.004, 0.0, uTime*0.002)));
  col = mix(col, vec3(0.95,0.97,1.0), cl*0.85);
  float diff = max(dot(normalize(vW), normalize(uSun)), 0.0);
  float term = smoothstep(-0.05, 0.25, dot(normalize(vW), normalize(uSun)));
  vec3 lit = col * (0.04 + 1.25*diff);
  // city lights on the night side
  float city = land * (1.0-term) * step(0.72, n3(p*80.0)) * 0.9;
  lit += vec3(1.0,0.7,0.35) * city * (1.0-cl);
  vec3 V = normalize(cameraPosition - vWP);
  float fr = pow(1.0 - max(dot(V, normalize(vW)), 0.0), 3.0);
  lit += vec3(0.25,0.55,1.0) * fr * (0.25 + term*1.2);
  gl_FragColor = vec4(lit, 1.0);
}`;

const atmoFrag = /* glsl */ `
precision highp float;
varying vec3 vW; varying vec3 vWP; varying vec3 vObj;
uniform vec3 uSun; uniform vec3 uColor;
void main(){
  vec3 V = normalize(cameraPosition - vWP);
  float rim = pow(1.0 - abs(dot(V, normalize(vW))), 2.4);
  float sun = 0.35 + 0.65*smoothstep(-0.3, 0.6, dot(normalize(vW), normalize(uSun)));
  gl_FragColor = vec4(uColor * rim * sun, rim * sun);
}`;

function Planet({ position, radius, sun, spin = 0.01 }: { position: [number, number, number]; radius: number; sun: THREE.Vector3; spin?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const u = useMemo(() => ({ uSun: { value: sun.clone() }, uTime: { value: 0 } }), [sun]);
  const ua = useMemo(() => ({ uSun: { value: sun.clone() }, uColor: { value: new THREE.Color("#5a6e94") } }), [sun]); // desaturated navy limb
  useFrame((_, dt) => {
    u.uTime.value += dt;
    if (ref.current) ref.current.rotation.y += dt * spin;
  });
  return (
    <group position={position}>
      <mesh ref={ref} rotation={[0.35, 0, 0.18]}>
        <sphereGeometry args={[radius, 96, 96]} />
        <shaderMaterial vertexShader={planetVert} fragmentShader={planetFrag} uniforms={u} />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial vertexShader={planetVert} fragmentShader={atmoFrag} uniforms={ua} transparent blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function StarDome({ count = 2400 }: { count?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 160;
      const q = Math.sqrt(1 - u * u);
      p.set([r * q * Math.cos(th), Math.abs(r * u) * 0.9 + 4, r * q * Math.sin(th)], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  return (
    <points geometry={geo}>
      <pointsMaterial size={1.3} sizeAttenuation={false} color="#d8d1c7" transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}

/* ───────── habitat ───────── */
const METAL = { color: "#c9d1dc", metalness: 0.55, roughness: 0.38 };

function Module({ length, angle, radius = 0.55 }: { length: number; angle: number; radius?: number }) {
  const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const mid = dir.clone().multiplyScalar(2.1 + length / 2);
  return (
    <group position={[mid.x, radius + 0.08, mid.z]} rotation={[0, -angle, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[radius, radius, length, 28]} /><meshStandardMaterial {...METAL} /></mesh>
      <mesh position={[0, length / 2, 0]}><sphereGeometry args={[radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial {...METAL} /></mesh>
      {[-0.35, 0, 0.35].map((o) => (
        <mesh key={o} position={[radius * 0.98, o * length, 0]}>
          <boxGeometry args={[0.04, length * 0.18, 0.16]} />
          <meshStandardMaterial color="#ffe08a" emissive="#FFD23F" emissiveIntensity={2.2} />
        </mesh>
      ))}
      {[-0.5, 0.5].map((o) => (
        <mesh key={o} position={[0, o * length * 0.95, 0]}><torusGeometry args={[radius * 1.01, 0.03, 8, 32]} /><meshStandardMaterial color="#7d8896" metalness={0.8} roughness={0.3} /></mesh>
      ))}
    </group>
  );
}

function SolarArray({ position, rows = 2, cols = 4, rot = 0 }: { position: [number, number, number]; rows?: number; cols?: number; rot?: number }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.1, 0.03, 0.7)), []);
  return (
    <group position={position} rotation={[0, rot, 0]}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        return (
          <group key={i} position={[c * 1.2, 0.55, r * 1.05]} rotation={[-0.55, 0, 0]}>
            <mesh><boxGeometry args={[1.1, 0.03, 0.7]} /><meshStandardMaterial color="#152033" emissive="#1d2a40" emissiveIntensity={0.35} metalness={0.85} roughness={0.25} /></mesh>
            <lineSegments geometry={edges}><lineBasicMaterial color="#3a4b6e" transparent opacity={0.5} /></lineSegments>
            <mesh position={[0, -0.32, 0.12]} rotation={[0.55, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.6, 6]} /><meshStandardMaterial color="#5c6675" /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function Beacon({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = Math.sin(clock.elapsedTime * 3) > 0.6 ? 6 : 0.4;
  });
  return <mesh position={position}><sphereGeometry args={[0.07, 12, 12]} /><meshStandardMaterial ref={ref} color="#FFD23F" emissive="#FFD23F" emissiveIntensity={4} /></mesh>;
}

function Habitat({ withRover }: { withRover: boolean }) {
  const domeEdges = useMemo(() => {
    const e = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.02, 2));
    const a = e.attributes.position.array as Float32Array;
    const keep: number[] = [];
    for (let i = 0; i < a.length; i += 6) if (a[i + 1] > -0.02 && a[i + 4] > -0.02) keep.push(...a.slice(i, i + 6));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
    return g;
  }, []);
  return (
    <group position={BASE.toArray()}>
      {/* geodesic dome */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#8fa6c4" transparent opacity={0.16} roughness={0.08} metalness={0.2} emissive="#1d2a40" emissiveIntensity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={domeEdges} position={[0, 0.3, 0]}><lineBasicMaterial color="#c2bab0" transparent opacity={0.55} /></lineSegments>
      {/* interior light — the only yellow in the scene */}
      <pointLight position={[0, 0.9, 0]} color="#FFD23F" intensity={14} distance={7} decay={1.6} />
      <mesh position={[0, 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.9, 48]} /><meshStandardMaterial color="#1a2433" emissive="#FFD23F" emissiveIntensity={0.25} /></mesh>
      {/* interior structures seen through the glass */}
      {[[-0.6, 0.3], [0.5, -0.4], [0.2, 0.7]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.65, z]}><boxGeometry args={[0.5, 0.6, 0.4]} /><meshStandardMaterial color="#d9dee6" emissive="#FFD23F" emissiveIntensity={0.22} /></mesh>
      ))}
      {/* ring foundation */}
      <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[2.18, 2.3, 0.34, 64]} /><meshStandardMaterial {...METAL} color="#8d98a8" /></mesh>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a) * 2.31, 0.22, Math.sin(a) * 2.31]}><boxGeometry args={[0.06, 0.06, 0.06]} /><meshStandardMaterial color="#9fb0cc" emissive="#3a4b6e" emissiveIntensity={1.6} /></mesh>;
      })}
      {/* modules */}
      <Module length={2.8} angle={Math.PI} />
      <Module length={2.4} angle={0} radius={0.52} />
      <Module length={1.9} angle={-Math.PI * 0.62} radius={0.48} />
      {/* tower + antenna */}
      <group position={[-3.6, 0, -2.6]}>
        <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.55, 0.62, 2.2, 28]} /><meshStandardMaterial {...METAL} /></mesh>
        <mesh position={[0, 2.25, 0]}><cylinderGeometry args={[0.35, 0.55, 0.3, 28]} /><meshStandardMaterial {...METAL} color="#a8b3c2" /></mesh>
        {[0.5, 1.2, 1.8].map((y) => (
          <mesh key={y} position={[0.52, y, 0.18]}><boxGeometry args={[0.04, 0.14, 0.22]} /><meshStandardMaterial color="#9fb0cc" emissive="#3a4b6e" emissiveIntensity={2} /></mesh>
        ))}
        <mesh position={[0, 4.0, 0]}><cylinderGeometry args={[0.03, 0.05, 3.4, 8]} /><meshStandardMaterial color="#c7cfda" metalness={0.8} roughness={0.3} /></mesh>
        {[3.0, 3.6, 4.2].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation={[0, i, 0]}><boxGeometry args={[0.7 - i * 0.15, 0.025, 0.025]} /><meshStandardMaterial color="#c7cfda" /></mesh>
        ))}
        <mesh position={[0.3, 3.15, 0]} rotation={[0, 0, -0.9]}><coneGeometry args={[0.28, 0.16, 24, 1, true]} /><meshStandardMaterial color="#e3e8ef" side={THREE.DoubleSide} metalness={0.4} /></mesh>
        <Beacon position={[0, 5.75, 0]} />
      </group>
      <SolarArray position={[2.6, 0, 1.8]} rows={2} cols={4} rot={-0.35} />
      <SolarArray position={[-6.4, 0, -2.4]} rows={2} cols={3} rot={0.25} />
      {/* pad path lights */}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[-3.4 - i * 0.55, 0.05, 2.6 + i * 0.42]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color="#c7cfda" emissive="#5a6e94" emissiveIntensity={2.6} /></mesh>
      ))}
      {withRover && (
        <group position={[-5.2, 0, 3.4]} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 0.62, 0]}><boxGeometry args={[2.2, 0.7, 1.2]} /><meshStandardMaterial {...METAL} /></mesh>
          <mesh position={[0.75, 0.92, 0]}><boxGeometry args={[0.7, 0.42, 1.0]} /><meshStandardMaterial color="#1d2a40" emissive="#FFD23F" emissiveIntensity={0.3} metalness={0.6} roughness={0.2} /></mesh>
          {[[-0.75, 0.62], [0.75, 0.62], [-0.75, -0.62], [0.75, -0.62]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.3, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.3, 0.3, 0.22, 20]} /><meshStandardMaterial color="#3b4350" roughness={0.9} /></mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/* ───────── orbital station ───────── */
function Station() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.04; });
  return (
    <group ref={ref} position={[4.2, 3.2, -2]} rotation={[0.25, 0, -0.12]}>
      <mesh><boxGeometry args={[9, 0.16, 0.16]} /><meshStandardMaterial {...METAL} /></mesh>
      {[-1.4, 0, 1.4].map((x, i) => (
        <mesh key={x} position={[x * 0.6, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.32, 0.32, 1.6 - i * 0.2, 24]} /><meshStandardMaterial {...METAL} /></mesh>
      ))}
      <mesh position={[0, 0, 1.6]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.36, 0.36, 2.2, 24]} /><meshStandardMaterial {...METAL} /></mesh>
      {[-4, -2.9, 2.9, 4].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[1, -1].map((s) => (
            <mesh key={s} position={[0, 0, s * 1.8]}><boxGeometry args={[0.9, 0.03, 3.2]} /><meshStandardMaterial color="#152033" emissive="#1d2a40" emissiveIntensity={0.35} metalness={0.9} roughness={0.25} /></mesh>
          ))}
        </group>
      ))}
      <mesh position={[-1, -0.6, 0]}><boxGeometry args={[1.6, 0.02, 0.9]} /><meshStandardMaterial color="#e7ebf0" /></mesh>
    </group>
  );
}

/* ───────── camera rig: slow drift + mouse parallax ───────── */
function Rig({ target, base, still }: { target: THREE.Vector3; base: THREE.Vector3; still: boolean }) {
  const { camera, pointer } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    v.copy(base);
    if (!still) {
      v.x += Math.sin(t * 0.05) * 0.9 + pointer.x * 0.9;
      v.y += Math.sin(t * 0.07) * 0.15 + pointer.y * 0.4;
    }
    camera.position.lerp(v, Math.min(1, dt * 1.6));
    camera.lookAt(target);
  });
  return null;
}

function Scene({ env, withRover, still }: { env: Environment; withRover: boolean; still: boolean }) {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const pull = Math.max(0, 2.2 - aspect);
  const sun = useMemo(() => new THREE.Vector3(-1, 0.35, 0.6).normalize(), []);
  const surface = env === "lunar" || env === "mars";
  const camBase = useMemo(() => new THREE.Vector3(...(surface ? [-0.5 + pull * 2.2, 3.0 + pull * 1.2, 15 + pull * 9] : [0, 1.5, 14 + pull * 8]) as [number, number, number]), [surface, pull]);
  const target = useMemo(() => new THREE.Vector3(...(surface ? [1.6 + pull * 1.6, 2.6 - pull * 0.6, -2] : [2, 0.5, -4]) as [number, number, number]), [surface, pull]);
  const fogColor = env === "mars" ? "#1a1210" : "#0a111d";
  return (
    <>
      <color attach="background" args={[env === "mars" ? "#1a1210" : "#0a111d"]} />
      {surface && <fog attach="fog" args={[fogColor, 26, env === "mars" ? 60 : 85]} />}
      {/* cool taupe-navy ambient + a single warm key light */}
      <ambientLight intensity={env === "mars" ? 0.4 : 0.3} color={env === "mars" ? "#8a7a6e" : "#5a6374"} />
      <hemisphereLight args={[env === "mars" ? "#8a7466" : "#3a4b6e", "#0a111d", 0.25]} />
      <directionalLight position={sun.clone().multiplyScalar(30).toArray()} intensity={env === "mars" ? 2.0 : 3.4} color="#ffe9cf" />
      <StarDome count={env === "mars" ? 900 : 2400} />
      {env === "lunar" && <Planet position={[9.5 + pull * 9, 12.5 + pull * 3, -40]} radius={5.4} sun={sun} />}
      {env === "mars" && (
        <mesh position={[-14, 10, -50]}><sphereGeometry args={[0.9, 24, 24]} /><meshBasicMaterial color="#fff2dc" /></mesh>
      )}
      {surface && <Terrain env={env} />}
      {surface && <Habitat withRover={withRover} />}
      {env === "orbit" && (<><Planet position={[0, -36, -14]} radius={34} sun={sun} spin={0.004} /><Station /></>)}
      {env === "earth" && <Planet position={[4.5, 1.2, -8]} radius={5.2} sun={sun} spin={0.02} />}
      <Rig target={target} base={camBase} still={still} />
    </>
  );
}

export default function MissionScene3D({ env, withRover, active, still }: { env: Environment; withRover: boolean; active: boolean; still: boolean }) {
  return (
    <Canvas camera={{ position: [0.5, 3.4, 14], fov: 40, near: 0.1, far: 400 }} dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }} frameloop={active ? "always" : "never"}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}>
      <Scene env={env} withRover={withRover} still={still} />
    </Canvas>
  );
}
