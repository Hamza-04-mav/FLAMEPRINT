"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Procedural diffusion flame. uG ∈ [0,1] morphs a buoyant, sooty teardrop (1 g) into a dim, blue,
// spherical diffusion flame (0 g). ILLUSTRATIVE ONLY: a teaching visual, not a combustion model.
const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uG, uO2, uFlow, uAspect;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }

void main(){
  vec2 p = vUv*2.0 - 1.0;
  p.x *= uAspect;
  p *= 1.25;
  float g = clamp(uG, 0.0, 1.0);
  float gs = sqrt(g);                         // buoyant velocity ~ sqrt(g)
  float o2 = clamp((uO2 - 15.0) / 45.0, 0.0, 1.5);

  float drift = uFlow * 0.012;
  p.x -= drift * (p.y + 0.6) * (0.3 + 0.7*(1.0-gs));

  float t = uTime;
  float flick = (fbm(vec2(p.x*3.0, p.y*2.0 - t*2.6)) - 0.5) * 0.35 * gs;
  p.x += flick * smoothstep(-0.3, 0.9, p.y);

  float stretch = 1.0 + 1.9*gs;
  vec2 q = p - vec2(0.0, -0.25 + 0.42*gs);
  float taper = 1.0 + gs * 1.4 * smoothstep(-0.2, 1.2, q.y);
  vec2 s = vec2(q.x * taper * (1.0 + 0.35*gs), q.y / stretch);
  float r = length(s);

  float R = 0.36 + 0.10*o2;
  float wob = (fbm(vec2(atan(s.y, s.x)*2.0, t*0.4)) - 0.5) * 0.04 * (1.0 - gs);
  float shell = exp(-pow((r - R - wob) / (0.045 + 0.03*o2), 2.0));
  float body  = smoothstep(R, R*0.15, r);
  float flame = mix(shell * 0.8 + body * 0.08, body, gs);

  vec3 blue   = vec3(0.16, 0.45, 1.0);
  vec3 cyan   = vec3(0.30, 0.75, 1.0);
  vec3 amber  = vec3(1.0, 0.76, 0.36);
  vec3 orange = vec3(1.0, 0.55, 0.20);
  vec3 ember  = vec3(0.89, 0.33, 0.17);
  float inner = smoothstep(R, 0.0, r);
  vec3 sooty = mix(mix(ember, orange, smoothstep(0.0, 0.5, inner)), amber, smoothstep(0.45, 1.0, inner));
  vec3 col = mix(mix(blue, cyan, 0.35), sooty, smoothstep(0.05, 0.85, gs));
  col = mix(col, blue, gs * smoothstep(0.05, -0.35, q.y) * 0.85);

  float lum = flame * (0.6 + 0.6*gs + 0.35*o2);
  float halo = exp(-r*r*4.0) * (0.10 + 0.16*o2) * (0.6 + 0.4*gs);
  vec3 c = col * lum + mix(blue, orange, gs) * halo;

  // fuel source: droplet / wick at the centre
  float fuel = smoothstep(0.042, 0.03, length(p - vec2(0.0, -0.25)));
  c = mix(c, c * 0.35, fuel);
  c = 1.0 - exp(-c * 1.7);
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}
`;

const pVert = /* glsl */ `
attribute float aSeed; attribute vec2 aDir;
uniform float uTime, uG, uScale, uDpr;
varying float vA; varying float vG;
void main(){
  float gs = sqrt(clamp(uG, 0.0, 1.0));
  float speed = 0.10 + 0.42*gs;
  float t = fract(uTime*speed + aSeed);
  vec2 dir = normalize(mix(aDir, vec2(aDir.x*0.22, 1.0), gs));
  float dist = t * (0.30 + 0.85*gs);
  vec2 p = dir * dist * uScale;
  p.x += sin(uTime*2.3 + aSeed*31.0) * 0.035 * uScale * gs;
  p.y += 0.28 * gs * uScale;
  vA = (1.0 - t) * smoothstep(0.0, 0.12, t);
  vG = gs;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.05, 1.0);
  gl_PointSize = (1.6 + 2.6*(1.0 - t)) * uDpr;
}`;
const pFrag = /* glsl */ `
precision highp float;
varying float vA; varying float vG;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  vec3 c = mix(vec3(0.45, 0.7, 1.0), vec3(1.0, 0.6, 0.25), vG);
  vec3 o = c * vA * (1.0 - d*2.0) * 1.4;
  gl_FragColor = vec4(o, max(o.r, max(o.g, o.b)));
}`;

export interface FlameSpec { g: number; o2: number; flow: number }

function Flame({ spec, x, w, h }: { spec: FlameSpec; x: number; w: number; h: number }) {
  const { gl } = useThree();
  const u = useMemo(() => ({
    uTime: { value: Math.random() * 10 }, uG: { value: spec.g }, uO2: { value: spec.o2 }, uFlow: { value: spec.flow }, uAspect: { value: w / h },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const pu = useMemo(() => ({ uTime: { value: 0 }, uG: { value: spec.g }, uScale: { value: h * 0.5 }, uDpr: { value: 1 } }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const pgeo = useMemo(() => {
    const n = 90;
    const g = new THREE.BufferGeometry();
    const seed = new Float32Array(n), dir = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      seed[i] = Math.random();
      const a = Math.random() * Math.PI * 2;
      dir.set([Math.cos(a), Math.sin(a)], i * 2);
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aDir", new THREE.BufferAttribute(dir, 2));
    return g;
  }, []);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 4);
    u.uTime.value += dt;
    u.uG.value += (spec.g - u.uG.value) * k;
    u.uO2.value += (spec.o2 - u.uO2.value) * k;
    u.uFlow.value += (spec.flow - u.uFlow.value) * k;
    u.uAspect.value = w / h;
    pu.uTime.value += dt;
    pu.uG.value = u.uG.value;
    pu.uScale.value = h * 0.5;
    pu.uDpr.value = gl.getPixelRatio();
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={u} transparent blending={THREE.CustomBlending} blendSrc={THREE.OneFactor} blendDst={THREE.OneFactor} blendSrcAlpha={THREE.OneFactor} blendDstAlpha={THREE.OneFactor} depthWrite={false} />
      </mesh>
      <points geometry={pgeo} position={[0, -h * 0.125, 0]} frustumCulled={false}>
        <shaderMaterial vertexShader={pVert} fragmentShader={pFrag} uniforms={pu} transparent blending={THREE.CustomBlending} blendSrc={THREE.OneFactor} blendDst={THREE.OneFactor} blendSrcAlpha={THREE.OneFactor} blendDstAlpha={THREE.OneFactor} depthWrite={false} />
      </points>
    </group>
  );
}

function Stage({ flames }: { flames: FlameSpec[] }) {
  const { viewport } = useThree();
  const n = flames.length;
  const col = viewport.width / n;
  const h = Math.min(viewport.height, col * 1.7);
  const w = Math.min(col, h * 0.7);
  return (
    <>
      {flames.map((f, i) => (
        <Flame key={i} spec={f} x={-viewport.width / 2 + col * (i + 0.5)} w={w} h={h} />
      ))}
    </>
  );
}

/** One canvas, N flames side by side (one WebGL context regardless of how many flames). */
export default function FlameMorph({ flames, active = true }: { flames: FlameSpec[]; active?: boolean }) {
  return (
    <Canvas orthographic camera={{ zoom: 100, position: [0, 0, 5] }} gl={{ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      dpr={[1, 1.75]} style={{ width: "100%", height: "100%" }} frameloop={active ? "always" : "never"}>
      <Stage flames={flames} />
    </Canvas>
  );
}
