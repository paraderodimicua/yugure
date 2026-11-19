// Bambú, helechos y matas, arbustos en flor, lianas, hiedra, musgo, pétalos (GPU) y masas lejanas.
import * as THREE from 'three';
import { SKY_GLSL } from '../../render/shaders';
import { CARD, CARD_TOP, GeoB, V3, archStrip, crossCards, inst, qFrom, qLook, randDir, rng, rr, stats, type It } from './common';
import type { Ctx } from './ctx';

const UP = V3(0, 1, 0);
type Vec = THREE.Vector3 | [number, number, number];
const vec = (v: Vec) => (Array.isArray(v) ? V3(...v) : v.clone());

// ---------------------------------------------------------------------------------------------- bambú
const CANE_GEO: Record<string, THREE.BufferGeometry> = {};
function caneGeo(far: boolean) {
  const key = far ? 'far' : 'near';
  if (CANE_GEO[key]) return CANE_GEO[key];
  const N = far ? 4 : 9, R = far ? 4 : 6;
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  const rings: [number, number, number][] = []; // y, radio relativo, v
  for (let i = 0; i < N; i++) {
    const y0 = Math.pow(i / N, 1.12), y1 = Math.pow((i + 1) / N, 1.12);
    if (far) { rings.push([y0, 1, 0], [y1, 1, 1]); continue; }
    rings.push([y0, 1.09, 0], [y0 + 0.007, 1.0, 0.04], [y1, 1.09, 1]);
  }
  let row = 0;
  for (const [y, rk, v] of rings) {
    const rad = rk * (1 - 0.55 * y);
    for (let j = 0; j <= R; j++) {
      const a = (j / R) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * rad, y, s * rad); nrm.push(c, 0, s); uv.push(j / R, v);
    }
    // une solo anillos del mismo entrenudo (en el nudo hay costura de UV)
    if (row > 0 && !(v === 0)) {
      const b = (row - 1) * (R + 1), c2 = row * (R + 1);
      for (let j = 0; j < R; j++) idx.push(b + j, c2 + j, c2 + j + 1, b + j, c2 + j + 1, b + j + 1);
    }
    row++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return (CANE_GEO[key] = g);
}

export type BambooOpts = { seed?: number; count?: number; w?: number; d?: number; height?: [number, number]; lod?: 'near' | 'far'; shadow?: boolean; leaves?: number };
export function bamboo(C: Ctx, o: BambooOpts = {}) {
  const r = rng((o.seed ?? 1) * 211 + 1), far = o.lod === 'far';
  const n = o.count ?? 60, W = o.w ?? 8, D = o.d ?? 8, [h0, h1] = o.height ?? [8, 13];
  const canes: It[] = [], leaves: It[] = [];
  const clumps: THREE.Vector3[] = [];
  for (let i = 0; i < Math.ceil(n / 5); i++) clumps.push(V3(rr(r, -W / 2, W / 2), 0, rr(r, -D / 2, D / 2)));
  const lp = o.leaves ?? (far ? 4 : 12);
  for (let i = 0; i < n; i++) {
    const c = clumps[i % clumps.length], p = c.clone().add(V3(rr(r, -0.6, 0.6), -0.05, rr(r, -0.6, 0.6)));
    const H = rr(r, h0, h1), rad = rr(r, 0.035, 0.065) * (H / 11);
    const out = V3(p.x / (W / 2 + 0.01), 0, p.z / (D / 2 + 0.01));
    const bend = out.multiplyScalar(rr(r, 0.6, 1.6)).add(randDir(r).setY(0).multiplyScalar(0.5));
    const wp: [number, number, number] = [r() * 6.3, bend.x, bend.z];
    const old = r() < 0.18;
    canes.push({ p, q: qFrom(0, r() * 6.3, 0), s: V3(rad, H, rad), wp, c: old ? new THREE.Color(0xd8c890) : new THREE.Color().setHSL(rr(r, 0.2, 0.26), 0.25, rr(r, 0.78, 0.98)) });
    for (let k = 0; k < lp; k++) {
      const t = 1 - Math.pow(r(), 1.6) * 0.5, y = H * t, yaw = r() * 6.3;
      const radial = V3(Math.cos(yaw), 0, -Math.sin(yaw)), sz = rr(r, 1.0, 1.5) * (0.7 + t * 0.4) * (far ? 1.6 : 1);
      const q = qFrom(0, yaw, 0).multiply(qFrom(rr(r, -0.35, 0.35), 0, rr(r, -0.25, 0.1), 'XYZ'));
      leaves.push({
        p: p.clone().addScaledVector(radial, sz * 0.45).setY(y + 0.1), q, s: V3(sz * 1.1, sz, sz), wp,
        n: radial.clone().addScaledVector(UP, 0.7).normalize(), cell: Math.floor(r() * 4),
        c: new THREE.Color().setHSL(rr(r, 0.2, 0.3), rr(r, 0.2, 0.5), rr(r, 0.66, 0.9)),
      });
    }
  }
  const g = new THREE.Group(); g.name = 'bamboo';
  g.add(inst(caneGeo(far), C.mat('cane'), canes, { pad: 2, cast: o.shadow ?? true }));
  g.add(inst(CARD_TOP, C.mat('bambooLeaf'), leaves, { pad: 2, cast: o.shadow ?? true }));
  return stats(g);
}

// ---------------------------------------------------------------------------------------------- helechos, hierba y matas
let FROND: THREE.BufferGeometry | null = null;
const frondGeo = () => (FROND ??= archStrip(6, 0.28, 0.75, 0.1, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.03 + t)), 0.6)));
function fernFronds(r: () => number, at: THREE.Vector3, size: number, n: number, out: It[]) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rr(r, -0.3, 0.3), L = size * rr(r, 0.7, 1.15);
    const q = qFrom(0, a, 0).multiply(qFrom(rr(r, -0.95, -0.35), 0, rr(r, -0.2, 0.2), 'XYZ'));
    out.push({ p: at.clone(), q, s: V3(L * 0.5, L, L), cell: Math.floor(r() * 2), c: new THREE.Color().setHSL(rr(r, 0.22, 0.3), rr(r, 0.3, 0.6), rr(r, 0.62, 0.9)) });
  }
}
export function fern(C: Ctx, o: { seed?: number; size?: number; fronds?: number } = {}) {
  const r = rng((o.seed ?? 1) * 223 + 5), its: It[] = [];
  fernFronds(r, V3(), o.size ?? 1.1, o.fronds ?? 11, its);
  const g = new THREE.Group(); g.name = 'fern';
  g.add(inst(frondGeo(), C.mat('fern'), its, { pad: 0.3 }));
  return stats(g);
}
let CROSS2: THREE.BufferGeometry | null = null, CROSS3: THREE.BufferGeometry | null = null;
export function grass(C: Ctx, o: { seed?: number; w?: number; d?: number; count?: number; size?: number } = {}) {
  const r = rng((o.seed ?? 1) * 227 + 9), its: It[] = [], W = o.w ?? 2, D = o.d ?? 2;
  CROSS2 ??= crossCards(2);
  for (let i = 0; i < (o.count ?? Math.ceil(W * D * 3)); i++) {
    const s = (o.size ?? 0.6) * rr(r, 0.6, 1.3), mata = r() < 0.3;
    its.push({ p: V3(rr(r, -W / 2, W / 2), -0.02, rr(r, -D / 2, D / 2)), q: qFrom(0, r() * 6.3, 0), s: V3(s * (mata ? 1.3 : 1.1), s * (mata ? 0.8 : 1), s), cell: mata ? 3 : 2, c: new THREE.Color().setHSL(rr(r, 0.22, 0.33), rr(r, 0.25, 0.5), rr(r, 0.45, 0.7)) });
  }
  const g = new THREE.Group(); g.name = 'grass';
  g.add(inst(CROSS2, C.mat('grass'), its, { pad: 0.3, cast: false }));
  return stats(g);
}
/** sotobosque: helechos + hierba + matas en un rectángulo (2 llamadas) */
export function undergrowth(C: Ctx, o: { seed?: number; w?: number; d?: number; density?: number; heightAt?: (x: number, z: number) => number } = {}) {
  const r = rng((o.seed ?? 1) * 229 + 3), W = o.w ?? 8, D = o.d ?? 6, k = o.density ?? 1, hy = o.heightAt ?? (() => 0);
  const fr: It[] = [], gr: It[] = [];
  for (let i = 0; i < Math.ceil(W * D * 0.18 * k); i++) {
    const x = rr(r, -W / 2, W / 2), z = rr(r, -D / 2, D / 2);
    fernFronds(r, V3(x, hy(x, z), z), rr(r, 0.7, 1.3), 7 + Math.floor(r() * 5), fr);
  }
  CROSS2 ??= crossCards(2);
  for (let i = 0; i < Math.ceil(W * D * 1.2 * k); i++) {
    const x = rr(r, -W / 2, W / 2), z = rr(r, -D / 2, D / 2), s = rr(r, 0.35, 0.8), mata = r() < 0.15;
    gr.push({ p: V3(x, hy(x, z) - 0.02, z), q: qFrom(0, r() * 6.3, 0), s: V3(s * 1.2, s * (mata ? 0.6 : 1), s), cell: mata ? 3 : 2, c: new THREE.Color().setHSL(rr(r, 0.22, 0.33), rr(r, 0.25, 0.5), rr(r, 0.45, 0.7)) });
  }
  const g = new THREE.Group(); g.name = 'undergrowth';
  g.add(inst(frondGeo(), C.mat('fern'), fr, { pad: 0.5 }));
  g.add(inst(CROSS2, C.mat('grass'), gr, { pad: 0.5, cast: false }));
  return stats(g);
}

// ---------------------------------------------------------------------------------------------- arbustos (verde, hortensia, azalea)
export type BushKind = 'green' | 'hydrangea' | 'hydrangeaPink' | 'azalea';
export function bush(C: Ctx, o: { seed?: number; kind?: BushKind; size?: number; cards?: number } = {}) {
  const r = rng((o.seed ?? 1) * 233 + 7), S = o.size ?? 1.3, kind = o.kind ?? 'green';
  const flowers = kind === 'hydrangea' ? [1] : kind === 'hydrangeaPink' ? [2] : kind === 'azalea' ? [3, 3, 0] : [0];
  const its: It[] = [], n = o.cards ?? Math.round(40 * S * S + 20), c = V3(0, S * 0.15, 0);
  for (let i = 0; i < n; i++) {
    const d = randDir(r); d.y = Math.abs(d.y) * 0.9 + 0.05;
    const shell = rr(r, 0.55, 1), p = d.clone().multiply(V3(S * 0.75, S * 0.6, S * 0.75)).multiplyScalar(shell).add(c);
    const nn = p.clone().sub(c).normalize().addScaledVector(UP, 0.3).normalize();
    const flower = kind !== 'green' && shell > 0.75 && r() < 0.6;
    const s = rr(r, 0.45, 0.7) * S * (flower ? 0.8 : 1);
    its.push({ p, q: qLook(nn.clone().addScaledVector(randDir(r), 0.7).normalize(), r() * 6.3), s: V3(s, s, s), n: nn, cell: flower ? flowers[Math.floor(r() * flowers.length)] : 0, c: new THREE.Color().setHSL(rr(r, 0.0, 0.1), 0.1, rr(r, 0.78, 1.0)) });
  }
  const g = new THREE.Group(); g.name = 'bush_' + kind;
  g.add(inst(CARD, C.mat('bush'), its, { pad: 0.3 }));
  return stats(g);
}

// ---------------------------------------------------------------------------------------------- lianas
type Strand = { pts: THREE.Vector3[]; w: (t: number) => number; r0: number; r1: number; leaves: number };
function strands(C: Ctx, list: Strand[], r: () => number, name: string) {
  const B = new GeoB(), its: It[] = [];
  for (const s of list) {
    B.tube(s.pts, s.r0, s.r1, 3, Math.max(4, s.pts.length * 2), s.w);
    const cv = new THREE.CatmullRomCurve3(s.pts);
    for (let i = 0; i < s.leaves; i++) {
      const t = Math.pow(r(), 0.8), p = cv.getPointAt(t), out = randDir(r);
      out.y = Math.abs(out.y) * 0.4;
      const sz = rr(r, 0.22, 0.4);
      its.push({ p: p.addScaledVector(out, 0.06), q: qLook(out.clone().add(V3(0, 0.3, 0)).normalize(), r() * 6.3), s: V3(sz, sz, sz), n: out.clone().add(V3(0, 0.5, 0)).normalize(), cell: r() < 0.6 ? 3 : Math.floor(r() * 3), w: s.w(t), c: new THREE.Color().setHSL(rr(r, 0.2, 0.32), 0.4, rr(r, 0.65, 0.95)) });
    }
  }
  const g = new THREE.Group(); g.name = name;
  const tube = new THREE.Mesh(B.build(true), C.mat('vine')); tube.castShadow = true; tube.receiveShadow = true;
  tube.geometry.boundingSphere!.radius += 0.6;
  g.add(tube);
  if (its.length) g.add(inst(CARD, C.mat('vineLeaf'), its, { pad: 0.6 }));
  return stats(g);
}
/** liana de from a to (con comba) o colgando len metros si no hay to. El grupo se coloca en from. */
export function vine(C: Ctx, from: Vec, to?: Vec | null, o: { seed?: number; sag?: number; len?: number; leaves?: number; thick?: number } = {}) {
  const r = rng((o.seed ?? 1) * 239 + 11), a = vec(from), pts: THREE.Vector3[] = [];
  const th = o.thick ?? 0.03;
  let wf: (t: number) => number, L: number;
  if (to) {
    const d = vec(to).sub(a); L = d.length();
    const sag = (o.sag ?? 0.18) * L;
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(d.clone().multiplyScalar(t).add(V3(Math.sin(t * 9 + r()) * 0.05, -sag * 4 * t * (1 - t), Math.cos(t * 7) * 0.05))); }
    wf = (t) => Math.sin(Math.PI * t);
  } else {
    L = o.len ?? 4;
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V3(Math.sin(t * 5 + r()) * 0.08 * t, -L * t, Math.cos(t * 4) * 0.08 * t)); }
    wf = (t) => Math.pow(t, 1.4);
  }
  const g = strands(C, [{ pts, w: wf, r0: th, r1: th * 0.6, leaves: Math.round(L * 7 * (o.leaves ?? 1)) }], r, 'vine');
  g.position.copy(a);
  return g;
}
/** cortina de lianas colgando de una línea horizontal (x ∈ [-w/2, w/2], y = 0 hacia abajo) */
export function vineCurtain(C: Ctx, w = 4, h = 3, o: { seed?: number; count?: number; leaves?: number } = {}) {
  const r = rng((o.seed ?? 1) * 241 + 13), list: Strand[] = [];
  const n = o.count ?? Math.round(w * 3);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + r()) * (w / n), L = h * rr(r, 0.35, 1), z = rr(r, -0.15, 0.15), pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(V3(x + Math.sin(t * 4 + i) * 0.06 * t, -L * t, z + Math.cos(t * 3 + i) * 0.05 * t)); }
    list.push({ pts, w: (t) => Math.pow(t, 1.3), r0: 0.018, r1: 0.01, leaves: Math.round(L * 6 * (o.leaves ?? 1)) });
  }
  return strands(C, list, r, 'vineCurtain');
}

// ---------------------------------------------------------------------------------------------- hiedra en muro (plano XY local mirando a +Z)
export function ivy(C: Ctx, w = 4, h = 3, o: { seed?: number; density?: number; cover?: number } = {}) {
  const r = rng((o.seed ?? 1) * 251 + 17), B = new GeoB(), its: It[] = [];
  const cover = o.cover ?? 0.85, dens = o.density ?? 1;
  const nStem = Math.max(2, Math.round(w * 0.9));
  const leafAt = (p: THREE.Vector3, k: number) => {
    for (let i = 0; i < k; i++) {
      const sz = rr(r, 0.5, 0.8), q = qFrom(rr(r, -0.6, 0.25), rr(r, -0.45, 0.45), r() * 6.3, 'YXZ');
      its.push({ p: p.clone().add(V3(rr(r, -0.12, 0.12), rr(r, -0.1, 0.12), rr(r, 0.04, 0.16))), q, s: V3(sz, sz, sz), n: V3(rr(r, -0.2, 0.2), 0.45, 1).normalize(), cell: Math.floor(r() * 3), w: 0.15 + r() * 0.2, c: new THREE.Color().setHSL(rr(r, 0.2, 0.32), rr(r, 0.2, 0.5), rr(r, 0.62, 0.95)) });
    }
  };
  const walk = (p0: THREE.Vector3, maxH: number, depth: number) => {
    const pts = [p0.clone()], p = p0.clone(); let dx = rr(r, -0.3, 0.3);
    while (p.y < maxH && pts.length < 40) {
      dx = THREE.MathUtils.clamp(dx + rr(r, -0.35, 0.35), -0.8, 0.8);
      p.add(V3(dx * 0.22, 0.22, 0)); p.x = THREE.MathUtils.clamp(p.x, -w / 2, w / 2); p.z = 0.03;
      pts.push(p.clone());
      if (r() < 0.9 * dens) leafAt(p, 2);
      if (depth < 2 && r() < 0.12) walk(p, maxH * rr(r, 0.8, 1), depth + 1);
    }
    if (pts.length > 1) B.tube(pts, 0.02, 0.008, 3, pts.length - 1);
  };
  for (let i = 0; i < nStem; i++) walk(V3(-w / 2 + (i + r()) * (w / nStem), 0, 0.03), h * cover * rr(r, 0.6, 1.05), 0);
  // flecos colgando por encima del borde si cubre todo
  if (cover >= 1) for (let i = 0; i < w * 3; i++) leafAt(V3(rr(r, -w / 2, w / 2), h - rr(r, 0, 0.3), 0.05), 1);
  const g = new THREE.Group(); g.name = 'ivy';
  const stem = new THREE.Mesh(B.build(true), C.mat('vine')); stem.receiveShadow = true;
  g.add(stem, inst(CARD, C.mat('ivy'), its, { pad: 0.3 }));
  return stats(g);
}

// ---------------------------------------------------------------------------------------------- musgo (cojines en el suelo; wall: en un plano XY mirando a +Z)
export function moss(C: Ctx, o: { seed?: number; w?: number; d?: number; density?: number; wall?: boolean } = {}) {
  const r = rng((o.seed ?? 1) * 257 + 19), W = o.w ?? 2, D = o.d ?? 2, its: It[] = [];
  const n = Math.ceil(W * D * 7 * (o.density ?? 1));
  for (let i = 0; i < n; i++) {
    const s = rr(r, 0.25, 0.7);
    its.push({ p: V3(rr(r, -W / 2, W / 2), rr(r, 0.01, 0.035), rr(r, -D / 2, D / 2)), q: qFrom(-Math.PI / 2 + rr(r, -0.2, 0.2), 0, r() * 6.3, 'XYZ'), s: V3(s, s, s), n: V3(rr(r, -0.3, 0.3), 1, rr(r, -0.3, 0.3)).normalize(), cell: Math.floor(r() * 3), c: new THREE.Color().setHSL(rr(r, 0.18, 0.28), 0.3, rr(r, 0.7, 1)) });
  }
  for (let i = 0; i < n / 3; i++) {
    const s = rr(r, 0.12, 0.25);
    its.push({ p: V3(rr(r, -W / 2, W / 2), 0, rr(r, -D / 2, D / 2)), q: qFrom(0, r() * 6.3, 0), s: V3(s, s, s), n: V3(0, 1, 0), cell: 3, c: new THREE.Color(1, 1, 1) });
  }
  const g = new THREE.Group(); g.name = 'moss';
  // matitas: tarjetas centradas elevadas media altura
  for (const it of its) if (it.cell === 3) it.p.y += it.s.y * 0.5;
  const m = inst(CARD, C.mat('moss'), its, { pad: 0.2, cast: false });
  g.add(m);
  if (o.wall) g.rotation.x = Math.PI / 2;
  return stats(g);
}

// ---------------------------------------------------------------------------------------------- pétalos y hojas cayendo (partículas en GPU, 1 llamada)
export type PetalKind = 'sakura' | 'momiji' | 'leaf' | 'mix';
export function petals(C: Ctx, area: THREE.Box3 | { center?: Vec; size?: Vec }, o: { count?: number; kind?: PetalKind; size?: number; speed?: number } = {}) {
  let min: THREE.Vector3, size: THREE.Vector3;
  if (area instanceof THREE.Box3) { min = area.min.clone(); size = area.getSize(V3()); }
  else { size = vec(area.size ?? [20, 8, 20]); min = vec(area.center ?? [0, 4, 0]).addScaledVector(size, -0.5); }
  const n = o.count ?? 600, r = rng(n * 7 + 3);
  const pos = new Float32Array(n * 3), aR = new Float32Array(n * 4);
  const kind = o.kind ?? 'sakura';
  for (let i = 0; i < n; i++) {
    pos.set([r(), r(), r()], i * 3);
    const k = kind === 'sakura' ? 0 : kind === 'momiji' ? (r() < 0.7 ? 1 : 3) : kind === 'leaf' ? (r() < 0.6 ? 2 : 3) : Math.floor(r() * 4);
    aR.set([r() * 6.3, r(), rr(r, 0.06, 0.11) * (o.size ?? 1) * (k === 0 ? 1 : 1.5), k], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(aR, 4));
  g.boundingSphere = new THREE.Sphere(min.clone().addScaledVector(size, 0.5), size.length() * 0.5 + 1);
  const U = C.U;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uSunView: U.sunView, uSunDir: U.sunDir, uFogDens: U.fogDens, uMin: { value: min }, uSize: { value: size }, uScale: { value: 500 }, uSpeed: { value: o.speed ?? 1 } },
    vertexShader: /* glsl */`
      attribute vec4 aR;
      uniform float uTime, uScale, uSpeed; uniform vec3 uMin, uSize, uSunView;
      varying vec3 vCol; varying float vRot, vFlip, vKind, vGlow; varying vec3 vWPos;
      void main() {
        float t = uTime * uSpeed;
        vec3 p = position;
        float fall = mix(0.35, 0.95, aR.y) * (aR.w < 0.5 ? 0.8 : 1.2);
        p.y = fract(p.y - t * fall / uSize.y);
        float sw = t * (0.6 + aR.y * 0.6) + aR.x;
        vec2 drift = vec2(sin(sw) * 0.7 + t * 0.45, cos(sw * 0.8) * 0.45 + t * 0.12);
        p.xz = fract(p.xz + drift / uSize.xz);
        vec4 wp = modelMatrix * vec4(uMin + p * uSize, 1.0);
        vWPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        float edge = smoothstep(0.0, 0.06, p.y) * smoothstep(1.0, 0.94, p.y) * smoothstep(0.0, 0.04, min(min(p.x, 1.0 - p.x), min(p.z, 1.0 - p.z)));
        gl_PointSize = aR.z * uScale / max(0.3, -mv.z) * edge;
        vRot = sw * 1.7 + aR.x * 5.0;
        vFlip = sin(t * (2.0 + aR.y * 3.0) + aR.x * 7.0);
        vKind = aR.w;
        vCol = aR.w < 0.5 ? vec3(1.0, 0.72, 0.8) : aR.w < 1.5 ? vec3(0.85, 0.16, 0.06) : aR.w < 2.5 ? vec3(0.5, 0.58, 0.16) : vec3(0.95, 0.55, 0.12);
        vGlow = pow(clamp(dot(normalize(mv.xyz), uSunView), 0.0, 1.0), 6.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSunDir; uniform float uFogDens;
      varying vec3 vCol; varying float vRot, vFlip, vKind, vGlow; varying vec3 vWPos;
      ${SKY_GLSL}
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float cs = cos(vRot), sn = sin(vRot);
        c = mat2(cs, -sn, sn, cs) * c;
        c.x /= max(0.2, abs(vFlip));
        float d = vKind < 0.5 ? length(c * vec2(2.4, 1.7)) : length(c * vec2(2.0, 1.25));
        if (d > 0.5) discard;
        if (vKind < 0.5 && c.y > 0.16 && abs(c.x) < 0.035) discard;
        float lit = 0.5 + 0.5 * abs(vFlip);
        vec3 col = vCol * (vec3(0.55, 0.45, 0.6) + vec3(1.0, 0.62, 0.36) * lit) + vCol * vec3(1.0, 0.6, 0.3) * vGlow * 2.0;
        vec3 d_ = vWPos - cameraPosition; float dist_ = length(d_); d_ /= dist_;
        float fa_ = 1.0 - exp(-dist_ * uFogDens * 1.2);
        gl_FragColor = vec4(mix(col, hazeColor(d_, uSunDir), fa_), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat);
  const sz = new THREE.Vector2();
  pts.onBeforeRender = (renderer) => { renderer.getDrawingBufferSize(sz); mat.uniforms.uScale.value = sz.y * 0.9; };
  pts.name = 'petals';
  return stats(pts);
}

// ---------------------------------------------------------------------------------------------- masas lejanas (tarjetas cruzadas con silueta pintada)
type MassOpts = { seed?: number; scale?: number; mix?: [number, number, number, number]; heightAt?: (x: number, z: number) => number; tint?: THREE.ColorRepresentation };
function canopyIts(r: () => number, pts: THREE.Vector3[], o: MassOpts) {
  const mix = o.mix ?? [0.55, 0.2, 0.15, 0.1], tint = new THREE.Color(o.tint ?? 0xffffff), its: It[] = [];
  const tot = mix.reduce((a, b) => a + b, 0);
  for (const p of pts) {
    let u = r() * tot, cell = 0; while (cell < 3 && u > mix[cell]) { u -= mix[cell]; cell++; }
    const H = rr(r, 6, 13) * (o.scale ?? 1) * (cell === 1 ? 1.15 : cell === 2 ? 1.1 : 1);
    const Wd = H * (cell === 1 ? 0.55 : cell === 2 ? 0.6 : rr(r, 0.85, 1.1));
    its.push({ p, q: qFrom(0, r() * 3.14, 0), s: V3(Wd, H, Wd), cell, c: new THREE.Color().setHSL(rr(r, 0.18, 0.4), rr(r, 0.1, 0.4), rr(r, 0.7, 1.0)).multiply(tint) });
  }
  return its;
}
export function forestMass(C: Ctx, o: MassOpts & { w?: number; d?: number; count?: number } = {}) {
  const r = rng((o.seed ?? 1) * 263 + 23), W = o.w ?? 80, D = o.d ?? 50, hy = o.heightAt ?? (() => 0);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < (o.count ?? 160); i++) { const x = rr(r, -W / 2, W / 2), z = rr(r, -D / 2, D / 2); pts.push(V3(x, hy(x, z) - 0.3, z)); }
  CROSS3 ??= crossCards(3);
  const g = new THREE.Group(); g.name = 'forestMass';
  g.add(inst(CROSS3, C.mat('canopy'), canopyIts(r, pts, o), { pad: 4, cast: false, receive: false }));
  return stats(g);
}
export function treeLine(C: Ctx, o: MassOpts & { len?: number; count?: number; depth?: number } = {}) {
  const r = rng((o.seed ?? 1) * 269 + 29), L = o.len ?? 200, n = o.count ?? 90, D = o.depth ?? 6, hy = o.heightAt ?? (() => 0);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) { const x = -L / 2 + (i + r()) * (L / n), z = rr(r, -D / 2, D / 2); pts.push(V3(x, hy(x, z) - 0.3, z)); }
  CROSS3 ??= crossCards(3);
  const g = new THREE.Group(); g.name = 'treeLine';
  g.add(inst(CROSS3, C.mat('canopy'), canopyIts(r, pts, { scale: 1.2, ...o }), { pad: 4, cast: false, receive: false }));
  return stats(g);
}

