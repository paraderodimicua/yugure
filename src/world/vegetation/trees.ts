// Árboles: sakura, jungla, pino niwaki, arce momiji y platanera. Tronco = 1 llamada (bark), follaje = 1 llamada instanciada.
import * as THREE from 'three';
import { GeoB, V3, inst, qLook, randDir, rng, rr, stats, CARD, archStrip, qFrom, type It, type Rnd } from './common';
import type { Ctx } from './ctx';

export type TreeOpts = { seed?: number; scale?: number; lod?: 'near' | 'far'; shadow?: boolean };

type Tip = { p: THREE.Vector3; d: THREE.Vector3; r: number; depth: number };
type GrowP = {
  depth: number; kids: number[]; spread: number; lenK: number; rK: number;
  up: number; twist: number; segs: number; kidStart: number; radial: number[]; gravity?: number;
};

const UP = V3(0, 1, 0);
/** rama recursiva: tubo cónico + hijos; devuelve las puntas */
function grow(r: Rnd, B: GeoB, tips: Tip[], p0: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, d: number, P: GrowP, far: boolean) {
  const segs = Math.max(2, P.segs - d - (far ? 1 : 0));
  const pts = [p0.clone()], dv = dir.clone(), p = p0.clone(), tmp = V3();
  for (let i = 1; i <= segs; i++) {
    dv.addScaledVector(randDir(r, tmp), P.twist).addScaledVector(UP, P.up - (P.gravity ?? 0) * d).normalize();
    p.addScaledVector(dv, len / segs); pts.push(p.clone());
  }
  const rEnd = Math.max(0.012, rad * P.rK);
  const radial = far ? Math.max(3, (P.radial[d] ?? 4) - 2) : (P.radial[d] ?? 4);
  B.tube(pts, rad, rEnd, radial, segs);
  const maxD = far ? Math.max(1, P.depth - 1) : P.depth;
  tips.push({ p: p.clone(), d: dv.clone(), r: rEnd, depth: d });
  if (d >= maxD) { tips.push({ p: pts[Math.max(1, segs - 1)].clone(), d: dv.clone(), r: rEnd, depth: d }); return; }
  const n = P.kids[d] ?? 2;
  for (let k = 0; k < n; k++) {
    const t = P.kidStart + (1 - P.kidStart) * ((k + rr(r, 0.2, 0.9)) / n);
    const fi = t * segs, i0 = Math.min(segs - 1, Math.floor(fi));
    const bp = pts[i0].clone().lerp(pts[i0 + 1], fi - i0);
    const axis = V3().crossVectors(dv, randDir(r, tmp)).normalize();
    const cd = dv.clone().applyAxisAngle(axis, P.spread * rr(r, 0.6, 1.2) * (k === n - 1 ? 0.5 : 1));
    grow(r, B, tips, bp, cd, len * P.lenK * rr(r, 0.8, 1.15), (rad + (rEnd - rad) * t) * 0.78, d + 1, P, far);
  }
}

/** nube de tarjetas alrededor de las puntas */
function crown(r: Rnd, tips: Tip[], o: {
  per: number; rad: number; size: [number, number]; minDepth: number; flat?: number; upBias?: number;
  cells: number[]; color: (r: Rnd) => THREE.Color; center?: THREE.Vector3; sink?: number;
}) {
  const sel = tips.filter((t) => t.depth >= o.minDepth);
  const c = o.center ?? sel.reduce((a, t) => a.add(t.p), V3()).multiplyScalar(1 / Math.max(1, sel.length));
  const its: It[] = [], tmp = V3();
  for (const t of sel) for (let i = 0; i < o.per; i++) {
    const p = t.p.clone().addScaledVector(randDir(r, tmp), o.rad * Math.cbrt(r()));
    p.y -= (o.sink ?? 0) * o.rad;
    const out = p.clone().sub(c); out.y *= o.flat ?? 1;
    const n = out.normalize().addScaledVector(UP, o.upBias ?? 0.35).normalize();
    const face = n.clone().addScaledVector(randDir(r, tmp), 0.9).normalize();
    const s = rr(r, o.size[0], o.size[1]);
    its.push({ p, q: qLook(face, r() * 6.3), s: V3(s, s, s), n, cell: o.cells[Math.floor(r() * o.cells.length)], c: o.color(r), wp: [r() * 6, 0, 0] });
  }
  return its;
}

function finish(name: string, g: THREE.Group, trunk: THREE.BufferGeometry, bark: THREE.Material, leaves: THREE.InstancedMesh | null, shadow: boolean) {
  const tm = new THREE.Mesh(trunk, bark); tm.castShadow = shadow; tm.receiveShadow = true; g.add(tm);
  if (leaves) { leaves.castShadow = shadow; g.add(leaves); }
  g.name = name;
  return stats(g);
}

// ---------------------------------------------------------------------------------------------- sakura
export function sakura(C: Ctx, o: TreeOpts & { tone?: 'pink' | 'white' | 'deep' } = {}) {
  const r = rng((o.seed ?? 1) * 101 + 7), far = o.lod === 'far', sc = o.scale ?? 1;
  const B = new GeoB(), tips: Tip[] = [];
  const P: GrowP = { depth: 3, kids: [3, 3, 3], spread: 0.75, lenK: 0.68, rK: 0.62, up: 0.1, twist: 0.38, segs: 6, kidStart: 0.45, radial: [8, 6, 5, 4], gravity: 0.06 };
  const lean = randDir(rng((o.seed ?? 1) * 3)).setY(0).multiplyScalar(0.35).add(UP).normalize();
  grow(r, B, tips, V3(0, -0.1, 0), lean, 3.0, 0.24, 0, P, far);
  const hue = o.tone === 'white' ? [345, 25, 1.05] : o.tone === 'deep' ? [340, 75, 0.9] : [342, 50, 1];
  const its = crown(r, tips, {
    per: far ? 3 : 6, rad: far ? 0.9 : 0.75, size: far ? [1.8, 2.4] : [1.1, 1.6], minDepth: far ? 1 : 2, flat: 1.4, upBias: 0.3,
    cells: [0, 1, 2, 3], sink: 0.15,
    color: (r) => new THREE.Color().setHSL(hue[0] / 360, hue[1] / 100 * rr(r, 0.6, 1), 0.86 * hue[2] + rr(r, -0.05, 0.05)),
  });
  const g = new THREE.Group();
  const leaves = inst(CARD, C.mat('sakura'), its, { pad: 1, receive: false });
  g.scale.setScalar(sc);
  return finish('sakura', g, B.build(), C.mats.tint('bark', 0x3b2a2c), leaves, o.shadow ?? true);
}

// ---------------------------------------------------------------------------------------------- arce momiji
export function maple(C: Ctx, o: TreeOpts & { tone?: 'red' | 'orange' | 'green' } = {}) {
  const r = rng((o.seed ?? 1) * 131 + 3), far = o.lod === 'far', sc = o.scale ?? 1;
  const B = new GeoB(), tips: Tip[] = [];
  const P: GrowP = { depth: 3, kids: [4, 3, 3], spread: 0.95, lenK: 0.62, rK: 0.6, up: 0.02, twist: 0.22, segs: 5, kidStart: 0.35, radial: [7, 5, 4, 3], gravity: 0.03 };
  grow(r, B, tips, V3(0, -0.1, 0), V3(0.1, 1, 0).normalize(), 2.6, 0.17, 0, P, far);
  const cells = o.tone === 'orange' ? [2, 3, 2] : o.tone === 'green' ? [3] : [0, 1, 0, 2];
  const its = crown(r, tips, {
    per: far ? 3 : 6, rad: 0.7, size: far ? [1.6, 2.2] : [0.9, 1.3], minDepth: far ? 1 : 2, flat: 2.2, upBias: 0.6,
    cells, color: (r) => new THREE.Color().setHSL(0, 0, rr(r, 0.82, 1.05)).lerp(new THREE.Color(o.tone === 'green' ? 0x7fbf5a : 0xffd0b0), rr(r, 0, 0.25)),
  });
  // en verde: la celda 3 (dorada) se tiñe de verde por instancia
  if (o.tone === 'green') for (const it of its) it.c = new THREE.Color().setHSL(rr(r, 0.2, 0.28), 0.6, rr(r, 0.5, 0.65));
  const g = new THREE.Group(); g.scale.setScalar(sc);
  return finish('maple', g, B.build(), C.mats.tint('bark', 0x4a4040), inst(CARD, C.mat('maple'), its, { pad: 1 }), o.shadow ?? true);
}

// ---------------------------------------------------------------------------------------------- jungla: tronco alto, raíces tabulares, copa en paraguas
export function jungleTree(C: Ctx, o: TreeOpts & { height?: number; lianas?: number } = {}) {
  const r = rng((o.seed ?? 1) * 151 + 11), far = o.lod === 'far', sc = o.scale ?? 1;
  const H = o.height ?? rr(r, 13, 17);
  const B = new GeoB(), tips: Tip[] = [];
  // tronco principal
  const pts: THREE.Vector3[] = []; const bend = randDir(r).setY(0).multiplyScalar(0.8);
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(V3(bend.x * Math.sin(t * 2.4), t * H, bend.z * Math.sin(t * 2.4))); }
  B.tube(pts, 0.55, 0.3, far ? 6 : 9, far ? 4 : 8);
  // raíces tabulares
  if (!far) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rr(r, -0.3, 0.3), d = V3(Math.cos(a), 0, Math.sin(a)), L = rr(r, 1.6, 2.6);
    B.tube([V3(0, 2.2, 0).addScaledVector(d, 0.2), V3(0, 0.9, 0).addScaledVector(d, L * 0.45), V3(0, -0.15, 0).addScaledVector(d, L)], 0.32, 0.06, 4, 4);
  }
  // copa: ramas principales que se abren desde lo alto del tronco
  const P: GrowP = { depth: 2, kids: [3, 3], spread: 0.7, lenK: 0.62, rK: 0.55, up: 0.05, twist: 0.2, segs: 4, kidStart: 0.4, radial: [6, 4, 3] };
  const top = pts[6], nb = far ? 4 : 6;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + rr(r, -0.3, 0.3), t = rr(r, 0.72, 0.95);
    const bp = pts[Math.floor(t * 6)].clone().lerp(top, (t * 6) % 1);
    grow(r, B, tips, bp, V3(Math.cos(a), rr(r, 0.45, 0.8), Math.sin(a)).normalize(), rr(r, 3.4, 4.8), 0.24, 0, P, far);
  }
  grow(r, B, tips, top, UP.clone(), 2.5, 0.25, 1, P, far);
  // lianas colgando de la copa (en la misma malla de corteza: estáticas)
  if (!far) for (let i = 0; i < (o.lianas ?? 4); i++) {
    const t = tips[Math.floor(r() * tips.length)], L = rr(r, 3, Math.min(9, t.p.y - 1));
    const lp: THREE.Vector3[] = [];
    for (let k = 0; k <= 4; k++) lp.push(t.p.clone().add(V3(Math.sin(k * 1.7) * 0.15, -L * (k / 4), Math.cos(k * 1.3) * 0.15)));
    B.tube(lp, 0.035, 0.02, 3, 4);
  }
  const cen = tips.reduce((a, t) => a.add(t.p), V3()).multiplyScalar(1 / tips.length).add(V3(0, -1.2, 0));
  const its = crown(r, tips, {
    per: far ? 4 : 4, rad: 1.6, size: far ? [3.6, 4.6] : [2.8, 3.8], minDepth: far ? 1 : 2, flat: 2.0, upBias: 0.45, cells: [0, 1, 2, 3, 0, 1], center: cen, sink: 0.1,
    color: (r) => new THREE.Color().setHSL(rr(r, 0.22, 0.3), rr(r, 0.2, 0.45), rr(r, 0.62, 0.85)),
  });
  const g = new THREE.Group(); g.scale.setScalar(sc);
  return finish('jungleTree', g, B.build(), C.mats.tint('bark', 0x5e5a4c), inst(CARD, C.mat('broad'), its, { pad: 2 }), o.shadow ?? true);
}

// ---------------------------------------------------------------------------------------------- pino niwaki (podado en nubes)
export function pine(C: Ctx, o: TreeOpts & { pads?: number } = {}) {
  const r = rng((o.seed ?? 1) * 173 + 5), far = o.lod === 'far', sc = o.scale ?? 1;
  const B = new GeoB();
  const H = rr(r, 3.8, 4.8), pts: THREE.Vector3[] = [];
  const ax = rr(r, 0.4, 0.8), ph = r() * 6;
  for (let i = 0; i <= 7; i++) { const t = i / 7; pts.push(V3(Math.sin(t * 4 + ph) * ax * t, t * H, Math.cos(t * 3 + ph) * ax * 0.6 * t)); }
  B.tube(pts, 0.24, 0.07, far ? 5 : 7, far ? 5 : 10);
  const pads: { c: THREE.Vector3; R: number }[] = [{ c: pts[7].clone().add(V3(0, 0.25, 0)), R: rr(r, 0.9, 1.1) }];
  const n = o.pads ?? 7;
  for (let i = 0; i < n; i++) {
    const t = 0.3 + (i / n) * 0.62, j = Math.floor(t * 7), bp = pts[j].clone().lerp(pts[j + 1], t * 7 - j);
    const a = i * 2.4 + rr(r, -0.4, 0.4), L = rr(r, 1.0, 1.9) * (1.15 - t * 0.5);
    const d = V3(Math.cos(a), rr(r, -0.05, 0.25), Math.sin(a)).normalize();
    const mid = bp.clone().addScaledVector(d, L * 0.5).add(V3(0, rr(r, -0.2, 0.15), 0)), end = bp.clone().addScaledVector(d, L).add(V3(0, rr(r, 0, 0.3), 0));
    B.tube([bp, mid, end], 0.09 * (1.2 - t * 0.5), 0.04, far ? 3 : 4, 3);
    pads.push({ c: end.clone().add(V3(0, 0.2, 0)), R: rr(r, 0.9, 1.25) * (1.25 - t * 0.4) });
  }
  const its: It[] = [];
  for (const pd of pads) {
    const m = far ? 7 : 22;
    for (let i = 0; i < m; i++) {
      const a = r() * 6.3, d = Math.sqrt(r()) * pd.R, rim = d / pd.R;
      const p = pd.c.clone().add(V3(Math.cos(a) * d, (1 - rim * rim) * pd.R * 0.42 + rr(r, -0.05, 0.05), Math.sin(a) * d));
      const n = p.clone().sub(pd.c).add(V3(0, -pd.R * 0.5, 0)).normalize();
      // tarjetas casi horizontales arriba, más inclinadas en el borde (dan la silueta lateral)
      const tilt = -Math.PI / 2 + rim * rr(r, 0.4, 1.1) * (r() < 0.5 ? 1 : -1);
      const q = qFrom(0, a, 0).multiply(qFrom(tilt, 0, r() * 6.3, 'XYZ'));
      const s = pd.R * rr(r, 1.1, 1.5) * (far ? 1.5 : 1);
      its.push({ p, q, s: V3(s, s * 0.8, s), n, cell: Math.floor(r() * 4), c: new THREE.Color().setHSL(rr(r, 0.3, 0.38), 0.3, rr(r, 0.62, 0.82)), wp: [r() * 6, 0, 0] });
    }
  }
  const g = new THREE.Group(); g.scale.setScalar(sc);
  return finish('pine', g, B.build(), C.mats.tint('bark', 0x5c3a2e), inst(CARD, C.mat('pine'), its, { pad: 0.5 }), o.shadow ?? true);
}

// ---------------------------------------------------------------------------------------------- platanera
let BANANA_LEAF: THREE.BufferGeometry | null = null;
export function banana(C: Ctx, o: TreeOpts & { leaves?: number } = {}) {
  const r = rng((o.seed ?? 1) * 191 + 13), sc = o.scale ?? 1, far = o.lod === 'far';
  BANANA_LEAF ??= archStrip(9, 0.32, 0.55, 0.14, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + t * 0.98)), 0.55));
  const H = rr(r, 2.2, 3.0), B = new GeoB();
  B.tube([V3(0, -0.1, 0), V3(0.05, H * 0.5, 0.02), V3(0.08, H, 0.04)], 0.17, 0.1, far ? 5 : 8, 3);
  const its: It[] = [], n = o.leaves ?? 9;
  for (let i = 0; i < n; i++) {
    const old = i < 2, a = i * 2.39 + rr(r, -0.2, 0.2);
    const pitch = old ? rr(r, 0.6, 1.1) : rr(r, -0.75, -0.05) + i * 0.02; // >0 cae
    const L = rr(r, 1.9, 2.8) * (old ? 0.85 : 1);
    const q = qFrom(0, a, 0).multiply(qFrom(pitch, 0, rr(r, -0.25, 0.25), 'XYZ'));
    its.push({
      p: V3(0.08, H - rr(r, 0, 0.25), 0.04), q, s: V3(rr(r, 0.5, 0.7) * L * 0.5, L * 0.9, L), n: V3(0, 1, 0), cell: 0, wp: [r() * 6, 0, 0],
      c: old ? new THREE.Color(0xc8b070) : new THREE.Color().setHSL(rr(r, 0.2, 0.26), 0.4, rr(r, 0.75, 0.95)),
    });
  }
  const g = new THREE.Group(); g.scale.setScalar(sc);
  return finish('banana', g, B.build(), C.mats.tint('leaf', 0x6f7a44), inst(BANANA_LEAF, C.mat('banana'), its, { pad: 0.6 }), o.shadow ?? true);
}
