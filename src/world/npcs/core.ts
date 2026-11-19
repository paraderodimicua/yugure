// Infraestructura de habitantes: caché de geometrías por variante, mallas con el material único,
// variantes por semilla, recuento de coste y trayectorias (ir y volver) sin reservas por fotograma.
import * as THREE from 'three';
import { rng, type Cell, type V3 } from './kit';

export type Anim = (t: number, dt: number) => void;
export type Core = { mat: THREE.Material; anims: Anim[]; cache: Map<string, any> };

export function built<T>(C: Core, key: string, fn: () => T): T {
  let r = C.cache.get(key);
  if (!r) { r = fn(); C.cache.set(key, r); }
  return r as T;
}
export function mesh(C: Core, g: THREE.BufferGeometry, name = '', shadow = true) {
  const m = new THREE.Mesh(g, C.mat);
  m.name = name; m.castShadow = shadow; m.receiveShadow = false;
  return m;
}
export const place = <T extends THREE.Object3D>(o: T, p: V3, r?: V3): T => { o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); return o; };

/** paleta y estampado a partir de la semilla; las combinaciones se cachean (geometría compartida) */
export function variant(seed: number, nPal: number, pats: Cell[]) {
  const s = Math.abs(seed | 0), r = rng(s * 7 + 3);
  const pi = s % nPal, ci = Math.floor(s / nPal) % pats.length;
  return { pi, cell: pats[ci], key: `:${pi}.${ci}`, h: 0.95 + r() * 0.1, ph: r() * 100, r };
}

export function finish(C: Core, root: THREE.Group, o: any, fn: Anim | null) {
  let tris = 0, draws = 0;
  root.traverse((m) => { const g = (m as THREE.Mesh).geometry; if ((m as THREE.Mesh).isMesh && g) { draws++; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  root.userData.tris = Math.round(tris); root.userData.draws = draws;
  if (fn && !o.static) C.anims.push(fn);
  else if (fn) fn(o.t ?? 0.8, 0); // pose fija representativa
  return root;
}

/** ir y volver por el eje Z local entre -L/2 y L/2, girando en los extremos */
export function pace(t: number, L: number, sp: number, out: { z: number; yaw: number; moving: number }) {
  const Tt = L / sp, Tr = 1.8, cyc = 2 * (Tt + Tr), u = ((t % cyc) + cyc) % cyc;
  const ss = (x: number) => x * x * (3 - 2 * x);
  if (u < Tt) { out.z = -L / 2 + sp * u; out.yaw = 0; out.moving = Math.min(1, u / 0.6, (Tt - u) / 0.6); }
  else if (u < Tt + Tr) { out.z = L / 2; out.yaw = Math.PI * ss((u - Tt) / Tr); out.moving = 0.35; }
  else if (u < 2 * Tt + Tr) { const k = u - Tt - Tr; out.z = L / 2 - sp * k; out.yaw = Math.PI; out.moving = Math.min(1, k / 0.6, (Tt - k) / 0.6); }
  else { out.z = -L / 2; out.yaw = Math.PI + Math.PI * ss((u - 2 * Tt - Tr) / Tr); out.moving = 0.35; }
  return out;
}
/** campana 0→1→0 entre a y b (0 fuera) */
export const bump = (p: number, a: number, b: number) => (p <= a || p >= b ? 0 : Math.sin(Math.PI * (p - a) / (b - a)));
export const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
