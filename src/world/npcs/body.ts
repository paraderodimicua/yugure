// Piezas de cuerpo humano estilizado: cabeza anime, pelo, kimono por torno con cuello cruzado
// (izquierda sobre derecha), obi con nudo, brazos con manga que cae según la pose, pies con zori.
import * as THREE from 'three';
import { Part, FACES, small, lathe, ball, cyl, box, sweep, prof, plate, shade, type V3, type Cell } from './kit';

export const SK = {
  man: { sh: 1.3, shx: 0.17, nk: 1.335, hd: 1.52, hr: 0.115, up: 0.27, fo: 0.24 },
  woman: { sh: 1.25, shx: 0.155, nk: 1.285, hd: 1.465, hr: 0.11, up: 0.25, fo: 0.22 },
  kid: { sh: 0.8, shx: 0.12, nk: 0.83, hd: 1.0, hr: 0.128, up: 0.17, fo: 0.15 },
};
export const PROF = {
  man: [[0.19, 0.07], [0.2, 0.11], [0.186, 0.4], [0.17, 0.75], [0.162, 0.95], [0.17, 1.12], [0.174, 1.22], [0.152, 1.29], [0.09, 1.34], [0.045, 1.36]],
  woman: [[0.148, 0.055], [0.156, 0.09], [0.16, 0.45], [0.153, 0.8], [0.145, 0.93], [0.15, 1.1], [0.152, 1.18], [0.134, 1.24], [0.076, 1.29], [0.042, 1.305]],
  kidLong: [[0.15, 0.045], [0.155, 0.08], [0.148, 0.3], [0.138, 0.5], [0.134, 0.6], [0.14, 0.72], [0.142, 0.78], [0.118, 0.83], [0.066, 0.865], [0.04, 0.875]],
};

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
export const qe = (r: V3) => new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2]));
export function eul(q: THREE.Quaternion): V3 { _e.setFromQuaternion(q); return [_e.x, _e.y, _e.z]; }
/** euler que lleva +Y a la dirección d */
export function orient(d: V3): V3 { _v.set(d[0], d[1], d[2]).normalize(); _q.setFromUnitVectors(_w.set(0, 1, 0), _v); return eul(_q); }
export const add3 = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** punto del espacio del brazo (pivote p, giro q) al del padre, y al revés */
export function toWorld(p: V3, q: THREE.Quaternion, v: V3): V3 { _v.set(v[0], v[1], v[2]).applyQuaternion(q); return [_v.x + p[0], _v.y + p[1], _v.z + p[2]]; }
export function toLocal(p: V3, q: THREE.Quaternion, v: V3): V3 { _q.copy(q).invert(); _v.set(v[0] - p[0], v[1] - p[1], v[2] - p[2]).applyQuaternion(_q); return [_v.x, _v.y, _v.z]; }
export const inv = (q: THREE.Quaternion) => q.clone().invert();

// ───────── Cabeza ─────────
export function headWarp(r: number) {
  return (v: THREE.Vector3) => {
    const k = Math.max(0, -v.y / r);
    v.x *= 1 - 0.2 * k * k; v.z *= 1 - 0.05 * k * k;
    if (v.z > 0) v.z += 0.08 * r * k * k * (v.z / r);
    v.y *= 1.06;
  };
}
/** punto sobre la cabeza (phi=π/2 es el frente; th=0 arriba), con la misma deformación */
export function sph(r: number, rr: number, phi: number, th: number): V3 {
  const v = new THREE.Vector3(-rr * Math.cos(phi) * Math.sin(th), rr * Math.cos(th), rr * Math.sin(phi) * Math.sin(th));
  headWarp(r)(v); return [v.x, v.y, v.z];
}
export function head(P: Part, face: number, r: number, o: { ears?: boolean; nose?: boolean } = {}) {
  const skin = FACES[face].skin, w = headWarp(r);
  P.add(ball(r, 12, 9), skin, { warp: w });
  P.add(new THREE.SphereGeometry(r * 1.012, 8, 6, Math.PI / 2 - 0.78, 1.56, Math.PI * 0.3, Math.PI * 0.48), 0xffffff, { cell: small(face), warp: w });
  if (o.ears !== false) for (const s of [-1, 1]) P.add(ball(r * 0.2, 5, 4), skin, { p: [s * r * 0.95, -r * 0.12, -r * 0.05], s: [0.55, 1, 0.8] });
  if (o.nose !== false) P.add(ball(r * 0.075, 5, 4), shade(skin, 0.96), { p: [0, -r * 0.3, r * 0.97], s: [0.9, 0.8, 0.9] });
  P.add(cyl(r * 0.36, r * 0.42, r * 0.9, 7, true), skin, { p: [0, -r * 1.05, -r * 0.08] }); // cuello
}
export type HairO = { top?: number; back?: number; bangs?: number; bangW?: number; spikes?: number; seed?: number; bald?: boolean };
export function hair(P: Part, r: number, color: number, o: HairO = {}) {
  const w = headWarp(r);
  if (!o.bald) P.add(new THREE.SphereGeometry(r * 1.07, 12, 4, 0, Math.PI * 2, 0, Math.PI * (o.top ?? 0.33)), color, { warp: w });
  P.add(new THREE.SphereGeometry(r * 1.065, 10, 5, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, Math.PI * (o.bald ? 0.38 : 0.02), Math.PI * ((o.back ?? 0.62) - (o.bald ? 0.38 : 0.02))), color, { warp: w });
  if (o.bangs) { const bw = o.bangW ?? 0.62; P.add(new THREE.SphereGeometry(r * 1.085, 9, 3, Math.PI / 2 - bw, bw * 2, Math.PI * 0.08, Math.PI * o.bangs), color, { warp: w }); }
  if (o.spikes) {
    let a = (o.seed ?? 1) * 9.13;
    const rnd = () => { a = (a * 16807 + 0.37) % 1; return a; };
    for (let i = 0; i < o.spikes; i++) {
      const phi = Math.PI / 2 + Math.PI * (i / o.spikes) * 2 + rnd() * 0.4, th = Math.PI * (0.1 + rnd() * 0.32);
      const p = sph(r, r * 1.04, phi, th), d: V3 = [p[0], p[1] + r * 0.4, p[2] - r * 0.25];
      P.add(cyl(0, r * 0.24, r * 0.6, 4, true), color, { p: add3(p, d, 0.25 / len3(d) * r), r: orient(d) });
    }
  }
}

// ───────── Kimono ─────────
export type KimonoO = { prof: number[][]; color: number; cell?: Cell; zs?: number; under?: number; collar?: number; neckY: number; crossY: number; edge?: boolean; seg?: number };
/** torso-falda por torno + cuello cruzado: solapa izquierda (lado +X del que lo lleva) encima */
export function kimono(P: Part, o: KimonoO) {
  const zs = o.zs ?? 0.8, R = prof(o.prof);
  P.add(lathe(o.prof, o.seg ?? 14), o.color, { cell: o.cell, s: [1, 1, zs] });
  const surf = (x: number, y: number, dz: number): number[] => [x, y, zs * Math.sqrt(Math.max(0.0009, R(y) ** 2 - x * x)) + dz];
  const line = (x0: number, x1: number, y0: number, y1: number, dz: number, n = 5) =>
    Array.from({ length: n }, (_, i) => { const s = i / (n - 1); return surf(x0 + (x1 - x0) * s, y0 + (y1 - y0) * s, dz); });
  const cc = o.collar ?? shade(o.color, 0.62), uc = o.under ?? 0xf3efe4, ny = o.neckY, cy = o.crossY;
  P.add(sweep([[0.072, ny, 0.0], [0.05, ny + 0.012, -0.06 * zs - 0.01], [0, ny + 0.018, -0.08 * zs - 0.01], [-0.05, ny + 0.012, -0.06 * zs - 0.01], [-0.072, ny, 0.0]], [0.02], 4, { rings: 6 }), cc);
  // forma de «y»: la solapa derecha y el juban terminan en el cruce; solo la izquierda sigue hacia el costado
  const yc = ny + (cy - ny) * 0.5;
  P.add(sweep(line(-0.05, 0.006, ny, yc + 0.012, 0.003, 4), [0.017, 0.013], 4, { rings: 4 }), uc);
  P.add(sweep(line(0.05, -0.004, ny, yc + 0.006, 0.006, 4), [0.017, 0.013], 4, { rings: 4 }), uc);
  P.add(sweep(line(-0.074, 0.012, ny, yc, 0.009, 4), [0.022, 0.02], 4, { rings: 4 }), cc);
  P.add(sweep(line(0.074, -0.095, ny, cy - 0.02, 0.015), [0.024, 0.021], 4, { rings: 6 }), cc);
  if (o.edge !== false) P.add(sweep(line(-0.09, -0.11, cy - 0.02, o.prof[1][1] + 0.01, 0.004, 6), [0.008], 4, { rings: 6, cap: false }), shade(o.color, 0.55));
}
/** chaqueta abierta por delante (haori / hanten) sobre un perfil base */
export function jacket(P: Part, base: number[][], y0: number, y1: number, o: { color: number; cell?: Cell; zs?: number; open?: number; add?: number; edge?: number }) {
  const R = prof(base), zs = o.zs ?? 0.8, ad = o.add ?? 0.022, op = o.open ?? 0.3;
  const pts: number[][] = [];
  for (let i = 0; i <= 7; i++) { const y = y0 + (y1 - y0) * (i / 7); pts.push([R(y) + ad * (i < 7 ? 1 : 0.6), y]); }
  pts.unshift([pts[0][0] - 0.005, y0 - 0.008]);
  P.add(lathe(pts, 16, op, Math.PI * 2 - op * 2), o.color, { cell: o.cell, s: [1, 1, zs] });
  const ec = o.edge ?? shade(o.color, 0.5);
  for (const s of [-1, 1]) {
    const ed: number[][] = [];
    for (let i = 0; i <= 5; i++) { const y = y0 + (y1 - 0.03 - y0) * (i / 5), rr = R(y) + ad + 0.004; const ph = op * (1 - 0.6 * Math.max(0, (i - 3) / 2)); ed.push([s * rr * Math.sin(ph), y, rr * Math.cos(ph) * zs]); }
    ed.push([s * 0.07, y1 + 0.005, 0.0]);
    P.add(sweep(ed, [0.017], 4, { rings: 8 }), ec);
  }
}
export type ObiO = { prof: number[][]; zs?: number; y0: number; y1: number; color: number; cell?: Cell; cord?: number; knot: 'kaku' | 'taiko' | 'heko' | 'none'; knotColor?: number; age?: number };
export function rrect(w: number, h: number, r: number) {
  const out: number[][] = [];
  for (const [cx, cy, a0] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]])
    for (let k = 0; k <= 3; k++) { const a = (a0 + k * 30) * Math.PI / 180; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
export function obi(P: Part, o: ObiO) {
  const R = prof(o.prof), zs = o.zs ?? 0.8, rm = Math.max(R(o.y0), R(o.y1), R((o.y0 + o.y1) / 2)) + 0.016, ym = (o.y0 + o.y1) / 2;
  P.add(lathe([[rm - 0.012, o.y0], [rm, o.y0 + 0.01], [rm, o.y1 - 0.01], [rm - 0.012, o.y1]], 16), o.color, { cell: o.cell, s: [1, 1, zs] });
  if (o.cord !== undefined) P.add(lathe([[rm, ym - 0.007], [rm + 0.007, ym], [rm, ym + 0.007]], 16), o.cord, { s: [1, 1, zs] });
  if (o.age !== undefined) P.add(lathe([[rm - 0.01, o.y1 - 0.004], [rm - 0.004, o.y1 + 0.012], [rm - 0.02, o.y1 + 0.02]], 16), o.age, { s: [1, 1, zs] });
  const kc = o.knotColor ?? o.color, bz = -rm * zs;
  if (o.knot === 'kaku') {
    P.add(box(0.1, 0.06, 0.035), kc, { p: [0.03, ym, bz - 0.012] });
    P.add(box(0.035, 0.12, 0.02), kc, { p: [0.0, ym - 0.04, bz - 0.03], r: [0, 0, 0.5] });
    P.add(box(0.035, 0.1, 0.02), kc, { p: [0.065, ym - 0.03, bz - 0.03], r: [0, 0, -0.4] });
  } else if (o.knot === 'taiko') {
    const h = (o.y1 - o.y0) + 0.12;
    P.add(plate(rrect(0.3, h, 0.035), 0.07, 0.012), kc, { cell: o.cell, p: [0, o.y1 - h / 2 - 0.08 + 0.06, bz - 0.075] });
    P.add(sweep([[-0.15, o.y1, bz + 0.03], [0, o.y1 + 0.02, bz - 0.05], [0.15, o.y1, bz + 0.03]], [0.025], 6, { rings: 6 }), kc);
  } else if (o.knot === 'heko') {
    for (const s of [-1, 1]) {
      P.add(ball(1, 9, 6), kc, { p: [s * 0.1, ym + 0.02, bz - 0.05], s: [0.1, 0.075, 0.045], r: [0, s * 0.3, s * 0.3] });
      P.add(sweep([[s * 0.02, ym, bz - 0.04], [s * 0.05, ym - 0.12, bz - 0.06], [s * 0.07, ym - 0.24, bz - 0.04]], [0.03, 0.04, 0.035], 5, { rings: 6, fn: 0.35 }), kc);
    }
    P.add(ball(0.035, 7, 5), shade(kc, 0.85), { p: [0, ym, bz - 0.045] });
  }
}

// ───────── Brazos ─────────
/** dirección en el espacio del brazo hacia donde cae la manga (gravedad + algo hacia atrás) */
export function dropFor(q: THREE.Quaternion, axis?: THREE.Vector3) {
  const qi = q.clone().invert();
  const g = new THREE.Vector3(0, -1, 0).applyQuaternion(qi), a = axis ? axis.clone().normalize() : new THREE.Vector3(0, -1, 0);
  const ga = g.dot(a), gp = g.clone().addScaledVector(a, -ga);
  const back = new THREE.Vector3(0, 0, -1).applyQuaternion(qi); back.addScaledVector(a, -back.dot(a)).normalize();
  const k = Math.max(0, 0.9 - gp.length());
  return gp.addScaledVector(back, k * 1.1).addScaledVector(a, 0.45 * Math.max(0, ga)).normalize();
}
function sleeveGeo(ax: THREE.Vector3, w: number, drop: THREE.Vector3, d: number, th: number) {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 5, 4), pos = g.attributes.position as THREE.BufferAttribute;
  ax = ax.clone().normalize(); const side = new THREE.Vector3().crossVectors(ax, drop).normalize(), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), u = pos.getY(i) * -1 + 0.5, v = pos.getZ(i) + 0.5;
    const v2 = v * (1 - 0.3 * u ** 4) * (1 - 0.12 * (1 - u) ** 3);
    const bul = 0.42 + 0.58 * Math.sqrt(Math.sin(Math.PI * Math.min(1, Math.max(0, u)))) * (1 - 0.5 * v2);
    p.set(0, 0.03, 0).addScaledVector(ax, u * w).addScaledVector(drop, v2 * d - 0.04).addScaledVector(side, x * th * bul);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.deleteAttribute('normal'); g.computeVertexNormals();
  return g;
}
export type ArmO = {
  q: THREE.Quaternion; elbow: number; up: number; fo: number; skin: number; cloth: number; cell?: Cell;
  sleeve: 'kimono' | 'short' | 'long' | 'none'; width?: number; drop?: number; thick?: number; r?: number; hand?: number;
};
/** brazo colgando por -Y desde el hombro, antebrazo doblado hacia +Z; devuelve la mano en su espacio */
export function arm(P: Part, o: ArmO) {
  const e = o.elbow, E: V3 = [0, -o.up, 0], dir: V3 = [0, -Math.cos(e), Math.sin(e)];
  const W = add3(E, dir, o.fo), H = add3(W, dir, 0.045), ra = o.r ?? 0.04;
  const kim = o.sleeve === 'kimono';
  if (!kim) P.add(sweep([[0, 0.02, 0], E], [ra, ra * 0.88], 6, { rings: 2 }), o.sleeve === 'none' ? o.skin : o.cloth, { cell: o.sleeve === 'short' ? undefined : o.cell });
  if (!kim) P.add(ball(ra * 0.86, 6, 4), o.sleeve === 'long' ? o.cloth : o.skin, { p: E });
  P.add(sweep([kim ? mix3(E, W, 0.3) : E, W], [ra * 0.84, ra * 0.66], 6, { rings: 2 }), o.sleeve === 'long' ? o.cloth : o.skin);
  P.add(ball(1, 7, 5), o.skin, { p: H, s: [ra * 0.85, ra * 1.15, ra * 0.95], r: orient(dir) });
  P.add(ball(ra * 0.38, 4, 3), o.skin, { p: add3(H, [0, 0.02, 0.0]), s: [1, 1, 1] });
  if (o.sleeve === 'short') P.add(lathe([[0.058, 0.02], [0.066, -0.03], [0.074, -0.1], [0.072, -o.up * 0.62], [0.06, -o.up * 0.64]], 9), o.cloth, { cell: o.cell });
  if (kim) {
    const Q = mix3(E, W, 0.55), ax = new THREE.Vector3(Q[0], Q[1], Q[2]);
    P.add(sleeveGeo(ax, Math.max(o.width ?? 0.32, ax.length() * 1.02), dropFor(o.q, ax), o.drop ?? 0.3, o.thick ?? 0.13), o.cloth, { cell: o.cell });
  }
  return { H, W, dir };
}
/** codo y giro para que la mano llegue a un punto (relativo al hombro, en el espacio del padre) */
export function aim(target: V3, up: number, fo: number) {
  const L = fo + 0.045, d = Math.min(up + L - 0.01, Math.max(0.12, len3(target)));
  const c = Math.min(1, Math.max(-1, (d * d - up * up - L * L) / (2 * up * L)));
  const elbow = Math.acos(c);
  const H = new THREE.Vector3(0, -up - L * Math.cos(elbow), L * Math.sin(elbow)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(H, new THREE.Vector3(target[0], target[1], target[2]).normalize());
  return { q, elbow, Hn: H };
}

// ───────── Pies ─────────
export function foot(P: Part, x: number, z: number, o: { tabi?: number; sole: number; strap: number; geta?: boolean; bare?: number }) {
  const lift = o.geta ? 0.05 : 0.02;
  P.add(ball(1, 6, 5), o.bare ?? o.tabi ?? 0xf2efe8, { p: [x, lift + 0.03, z], s: [0.042, 0.036, 0.1] });
  if (o.geta) {
    P.add(box(0.09, 0.025, 0.21), o.sole, { p: [x, 0.04, z] });
    for (const dz of [-0.06, 0.06]) P.add(box(0.08, 0.03, 0.025), shade(o.sole, 0.8), { p: [x, 0.015, z + dz] });
  } else P.add(box(0.09, 0.02, 0.22), o.sole, { p: [x, 0.01, z] });
  P.add(sweep([[x - 0.035, lift + 0.01, z - 0.01], [x, lift + 0.05, z + 0.05], [x + 0.035, lift + 0.01, z - 0.01]], [0.008], 3, { rings: 4 }), o.strap);
}
