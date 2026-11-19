// Animales: gato (dormido / sentado con cola), shiba sentado (cola enroscada), grulla, gorriones y koi.
// ≤ 800 triángulos y 2-3 mallas por animal; geometría compartida por variante.
import * as THREE from 'three';
import { Part, PAT, small, lathe, ball, cyl, box, sweep, tris, WHITE, type V3, type Cell } from './kit';
import { type Core, built, mesh, place, variant, finish, smooth } from './core';

const CATS: { c: number; cell: Cell; chest: number }[] = [
  { c: 0xe0903e, cell: PAT.stripes, chest: 0xf6ecdc }, { c: 0x9a9aa4, cell: PAT.stripes, chest: 0xeeeae4 },
  { c: 0x2c2a30, cell: WHITE, chest: 0xf0ece6 }, { c: 0xffffff, cell: small(13), chest: 0xffffff }];

function catHead(P: Part, col: number, cell: Cell, chest: number, sleep: boolean) {
  P.add(ball(0.068, 9, 6), col, { cell, p: [0, 0.04, 0.02], s: [1.1, 0.92, 0.95] });
  for (const s of [-1, 1]) P.add(ball(0.04, 7, 5), chest, { p: [s * 0.028, 0.012, 0.06] });
  P.add(ball(0.009, 4, 3), 0xe88a90, { p: [0, 0.03, 0.098] });
  for (const s of [-1, 1]) {
    P.add(cyl(0, 0.032, 0.055, 4), col, { p: [s * 0.042, 0.1, 0.012], r: [0, 0, -s * 0.38] });
    P.add(cyl(0, 0.018, 0.035, 4), 0xe8a0a0, { p: [s * 0.041, 0.096, 0.02], r: [0, 0, -s * 0.38] });
    if (sleep) P.add(sweep([[s * 0.014, 0.05, 0.08], [s * 0.027, 0.044, 0.084], [s * 0.04, 0.05, 0.078]], [0.0035], 3, { rings: 4 }), 0x1c1414);
    else { P.add(ball(0.013, 6, 5), 0xd8b030, { p: [s * 0.027, 0.05, 0.074] }); P.add(box(0.004, 0.018, 0.004), 0x141010, { p: [s * 0.027, 0.05, 0.087] }); }
    for (const dy of [0.002]) P.add(box(0.05, 0.0015, 0.0015), 0xf4f0e8, { p: [s * 0.06, 0.02 + dy, 0.075], r: [0, s * 0.3, s * dy * 20] });
  }
}
export function cat(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, CATS.length, [WHITE]), sleep = o.pose === 'sleep';
  const B = built(C, 'cat' + v.key + sleep, () => {
    const { c, cell, chest } = CATS[v.pi], body = new Part(), hd = new Part(), tl = new Part();
    if (sleep) {
      body.add(ball(1, 10, 6), c, { cell, p: [0, 0.075, 0], s: [0.15, 0.085, 0.14] });
      for (const s of [-1, 1]) body.add(ball(0.03, 6, 4), chest, { p: [s * 0.04, 0.03, 0.13], s: [1, 0.6, 1.4] });
      tl.add(sweep([[0, 0, 0], [0.08, 0, 0.12], [0.02, 0, 0.2], [-0.1, 0, 0.17]], [0.024, 0.022, 0.018, 0.012], 5, { rings: 8 }), c, { cell });
    } else {
      body.add(ball(1, 9, 6), c, { cell, p: [0, 0.085, -0.03], s: [0.1, 0.085, 0.12] });
      body.add(ball(1, 9, 6), c, { cell, p: [0, 0.16, 0.03], s: [0.075, 0.13, 0.085], r: [-0.25, 0, 0] });
      body.add(ball(1, 8, 6), chest, { p: [0, 0.15, 0.085], s: [0.05, 0.08, 0.035] });
      for (const s of [-1, 1]) {
        body.add(sweep([[s * 0.035, 0.13, 0.07], [s * 0.035, 0.02, 0.085]], [0.022, 0.018], 6, { rings: 2 }), c, { cell });
        body.add(ball(0.022, 6, 4), chest, { p: [s * 0.035, 0.013, 0.1], s: [1, 0.6, 1.2] });
        body.add(ball(1, 6, 4), c, { p: [s * 0.07, 0.018, 0.03], s: [0.03, 0.02, 0.055] });
      }
      tl.add(sweep([[0, 0, 0], [0.04, -0.02, -0.1], [0.13, -0.025, -0.1], [0.19, -0.03, 0.0], [0.17, -0.03, 0.1]], [0.022, 0.02, 0.018, 0.016, 0.011], 5, { rings: 8 }), c, { cell });
    }
    catHead(hd, c, cell, chest, sleep);
    return { body: body.geo(), head: hd.geo(), tail: tl.geo() };
  });
  const root = new THREE.Group(); root.name = 'cat'; root.scale.setScalar(v.h);
  const body = mesh(C, B.body, 'body');
  const hd = sleep ? place(mesh(C, B.head, 'head'), [0.065, 0.075, 0.08], [0.5, -0.7, 0.35]) : place(mesh(C, B.head, 'head'), [0, 0.25, 0.05]);
  const tl = sleep ? place(mesh(C, B.tail, 'tail'), [-0.12, 0.03, -0.06]) : place(mesh(C, B.tail, 'tail'), [0, 0.04, -0.13]);
  root.add(body, hd, tl);
  return finish(C, root, o, (t) => {
    const T = t + v.ph;
    if (sleep) {
      const b = Math.sin(T * 1.6); body.scale.set(1 + 0.015 * b, 1 + 0.03 * b, 1);
      hd.position.y = 0.075 + 0.003 * b; tl.rotation.y = 0.06 * smooth(0.85, 1, Math.sin(T * 0.4)) * Math.sin(T * 9);
      hd.rotation.z = 0.35 + 0.08 * smooth(0.92, 1, Math.sin(T * 0.23));
    } else {
      tl.rotation.y = 0.28 * Math.sin(T * 2.1) * (0.5 + 0.5 * Math.sin(T * 0.37)); tl.rotation.z = 0.1 * Math.max(0, Math.sin(T * 2.1 + 0.6));
      hd.rotation.y = 0.55 * Math.sin(T * 0.29) * Math.sin(T * 0.11 + 2); hd.rotation.x = 0.08 * Math.sin(T * 0.47) - 0.05;
      hd.rotation.z = 0.12 * smooth(0.8, 1, Math.sin(T * 0.31));
      body.scale.y = 1 + 0.01 * Math.sin(T * 2.2);
    }
  });
}

const SHIBA = [{ c: 0xd2843a, k: 0xf4e6cc }, { c: 0x2e2826, k: 0xe8d2b0 }, { c: 0xb08458, k: 0xf2e4cc }, { c: 0xeedcc0, k: 0xfaf2e4 }];
export function shiba(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, SHIBA.length, [WHITE]);
  const B = built(C, 'shiba' + v.key, () => {
    const { c, k } = SHIBA[v.pi], body = new Part(), hd = new Part(), tl = new Part();
    body.add(ball(1, 9, 6), c, { p: [0, 0.11, -0.06], s: [0.13, 0.11, 0.16] });
    body.add(ball(1, 9, 6), c, { p: [0, 0.24, 0.04], s: [0.1, 0.15, 0.11], r: [-0.3, 0, 0] });
    body.add(ball(1, 8, 6), k, { p: [0, 0.22, 0.11], s: [0.07, 0.11, 0.05] });
    for (const s of [-1, 1]) {
      body.add(sweep([[s * 0.05, 0.2, 0.08], [s * 0.05, 0.03, 0.1]], [0.03, 0.025], 6, { rings: 2 }), c);
      body.add(ball(0.028, 6, 4), k, { p: [s * 0.05, 0.018, 0.12], s: [1, 0.65, 1.3] });
      body.add(ball(1, 6, 4), k, { p: [s * 0.1, 0.022, 0.04], s: [0.035, 0.024, 0.065] });
    }
    hd.add(ball(0.085, 9, 6), c, { p: [0, 0.04, 0], s: [1.1, 0.95, 1] });
    for (const s of [-1, 1]) {
      hd.add(ball(0.045, 7, 5), k, { p: [s * 0.04, 0.0, 0.05] });
      hd.add(ball(0.012, 5, 4), 0x161212, { p: [s * 0.035, 0.05, 0.075] });
      hd.add(ball(0.01, 4, 3), k, { p: [s * 0.03, 0.072, 0.07] });
      hd.add(cyl(0, 0.036, 0.07, 4), c, { p: [s * 0.045, 0.12, -0.005], r: [-0.12, 0, -s * 0.25] });
      hd.add(cyl(0, 0.02, 0.045, 4), k, { p: [s * 0.044, 0.113, 0.006], r: [-0.12, 0, -s * 0.25] });
    }
    hd.add(ball(1, 8, 6), k, { p: [0, 0.0, 0.085], s: [0.042, 0.036, 0.058] });
    hd.add(ball(0.014, 5, 4), 0x141010, { p: [0, 0.02, 0.142] });
    hd.add(ball(1, 5, 4), 0xe0707a, { p: [0, -0.024, 0.11], s: [0.016, 0.006, 0.022] });
    tl.add(sweep([[0, 0, 0], [0, 0.08, -0.05], [0.02, 0.15, -0.01], [0.045, 0.13, 0.07], [0.03, 0.08, 0.06]], [0.035, 0.045, 0.042, 0.032, 0.016], 6, { rings: 8 }), c);
    tl.add(ball(0.02, 5, 4), k, { p: [0.03, 0.08, 0.06] });
    return { body: body.geo(), head: hd.geo(), tail: tl.geo() };
  });
  const root = new THREE.Group(); root.name = 'shiba'; root.scale.setScalar(v.h);
  const body = mesh(C, B.body, 'body'), hd = place(mesh(C, B.head, 'head'), [0, 0.38, 0.08]), tl = place(mesh(C, B.tail, 'tail'), [0, 0.19, -0.2]);
  root.add(body, hd, tl);
  return finish(C, root, o, (t) => {
    const T = t + v.ph, pant = Math.sin(T * 11);
    hd.position.y = 0.38 + 0.003 * pant; body.scale.y = 1 + 0.008 * pant;
    hd.rotation.y = 0.5 * Math.sin(T * 0.27) * Math.sin(T * 0.13 + 1); hd.rotation.z = 0.18 * smooth(0.75, 1, Math.sin(T * 0.21));
    hd.rotation.x = -0.05 + 0.05 * Math.sin(T * 0.4);
    tl.rotation.z = 0.12 * Math.sin(T * 3.4);
  });
}

export function crane(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, 1, [WHITE]);
  const B = built(C, 'crane', () => {
    const body = new Part(), nk = new Part(), W = 0xf6f4ee, K = 0x1c1a1e, L = 0x3a3a3e;
    body.add(ball(1, 10, 6), W, { p: [0, 0.95, 0], s: [0.16, 0.15, 0.3], r: [-0.12, 0, 0] });
    for (const s of [-1, 1]) body.add(ball(1, 7, 5), W, { p: [s * 0.1, 0.98, -0.02], s: [0.05, 0.12, 0.27], r: [-0.15, 0, s * 0.1] });
    body.add(ball(1, 7, 5), K, { p: [0, 0.93, -0.27], s: [0.13, 0.1, 0.17], r: [0.35, 0, 0] });
    for (const s of [-1, 0, 1]) body.add(tris([[s * 0.06, 0.96, -0.25], [s * 0.1 - 0.02, 0.86, -0.5], [s * 0.1 + 0.03, 0.9, -0.45]]), K);
    for (const s of [-1, 1]) {
      body.add(sweep([[s * 0.06, 0.88, 0.02], [s * 0.06, 0.46, -0.03], [s * 0.06, 0.03, 0.02]], [0.016, 0.01, 0.009], 5, { rings: 4 }), L);
      for (const a of [-0.5, 0, 0.5, Math.PI]) body.add(box(0.008, 0.006, 0.08), L, { p: [s * 0.06 + Math.sin(a) * 0.035, 0.004, 0.02 + Math.cos(a) * 0.035], r: [0, a, 0] });
    }
    nk.add(sweep([[0, 0, 0], [0, 0.15, 0.06], [0, 0.32, 0.03], [0, 0.44, 0.1]], [0.055, 0.036, 0.03, 0.028], 6, { rings: 8 }), K);
    nk.add(sweep([[0, 0.2, 0.02], [0, 0.34, 0.0], [0, 0.44, 0.07]], [0.018, 0.024, 0.02], 6, { rings: 6 }), W);
    nk.add(ball(0.04, 9, 7), K, { p: [0, 0.465, 0.13], s: [1, 0.95, 1.2] });
    nk.add(ball(0.026, 7, 5), 0xd8282a, { p: [0, 0.5, 0.125] });
    nk.add(ball(0.03, 7, 5), W, { p: [0, 0.48, 0.095] });
    nk.add(cyl(0.003, 0.013, 0.13, 6), 0x8a8a6a, { p: [0, 0.455, 0.22], r: [Math.PI / 2 + 0.15, 0, 0] });
    for (const s of [-1, 1]) nk.add(ball(0.006, 4, 3), 0x8a6a2a, { p: [s * 0.03, 0.47, 0.15] });
    return { body: body.geo(), neck: nk.geo() };
  });
  const root = new THREE.Group(); root.name = 'crane'; root.scale.setScalar(v.h);
  const body = mesh(C, B.body, 'body'), nk = place(mesh(C, B.neck, 'neck'), [0, 1.0, 0.24]);
  root.add(body, nk);
  return finish(C, root, o, (t) => {
    const T = t + v.ph, u = T % 8, peck = smooth(0, 1.2, u) * (1 - smooth(2.6, 3.4, u));
    nk.rotation.x = 0.08 * Math.sin(T * 0.8) + 1.25 * peck + 0.1 * peck * Math.sin(T * 14);
    nk.rotation.y = 0.3 * Math.sin(T * 0.33) * (1 - peck);
    body.rotation.x = 0.1 * peck; body.position.y = -0.02 * peck;
  });
}

export function sparrow(C: Core, o: any = {}) {
  const n = Math.max(1, o.count ?? 1), sp = o.spacing ?? 0.16, v = variant(o.seed ?? 0, 1, [WHITE]);
  const B = built(C, 'sparrow', () => {
    const body = new Part(), hd = new Part(), br = 0x8a6040, dk = 0x5a3a24;
    body.add(ball(1, 7, 5), br, { cell: small(15), p: [0, 0.045, 0], s: [0.038, 0.036, 0.058], r: [0.3, 0, 0] });
    body.add(ball(1, 6, 4), 0xdcd0bc, { p: [0, 0.035, 0.012], s: [0.032, 0.028, 0.042] });
    for (const s of [-1, 1]) body.add(ball(1, 5, 3), dk, { cell: small(15), p: [s * 0.03, 0.05, -0.012], s: [0.012, 0.028, 0.05], r: [0.25, 0, 0] });
    body.add(box(0.03, 0.006, 0.065), dk, { p: [0, 0.042, -0.072], r: [0.45, 0, 0] });
    for (const s of [-1, 1]) { body.add(cyl(0.0025, 0.0025, 0.03, 3, true), 0xa07850, { p: [s * 0.012, 0.015, 0.005] }); body.add(box(0.004, 0.003, 0.02), 0xa07850, { p: [s * 0.012, 0.0015, 0.008] }); }
    hd.add(ball(0.026, 7, 5), 0x7a4024, {});
    for (const s of [-1, 1]) { hd.add(ball(1, 4, 3), 0xf2ece2, { p: [s * 0.014, -0.006, 0.008], s: [0.014, 0.012, 0.014] }); hd.add(ball(0.004, 3, 3), 0x101010, { p: [s * 0.02, -0.004, 0.01] }); }
    hd.add(ball(1, 5, 4), 0x1a1614, { p: [0, -0.019, 0.016], s: [0.012, 0.012, 0.008] });
    hd.add(cyl(0, 0.007, 0.017, 4), 0x3a3030, { p: [0, -0.002, 0.03], r: [Math.PI / 2, 0, 0] });
    return { body: body.geo(), head: hd.geo() };
  });
  const root = new THREE.Group(); root.name = 'sparrows';
  const birds = Array.from({ length: n }, (_, i) => {
    const g = place(new THREE.Group(), [(i - (n - 1) / 2) * sp + Math.sin(i * 7.3) * 0.03, 0, 0], [0, Math.sin(i * 3.1 + v.ph) * 0.6, 0]);
    const b = mesh(C, B.body, 'body', false), h = place(mesh(C, B.head, 'head', false), [0, 0.072, 0.03]);
    g.add(b, h); root.add(g);
    return { g, b, h, ph: v.ph + i * 2.37 };
  });
  return finish(C, root, o, (t) => {
    for (const q of birds) {
      const T = t + q.ph;
      q.h.rotation.y = 0.8 * Math.tanh(4 * Math.sin(T * 0.9)) + 0.3 * Math.tanh(5 * Math.sin(T * 2.3));
      q.h.rotation.x = 0.5 * smooth(0.9, 1, Math.sin(T * 0.7));
      q.b.rotation.x = -0.15 * smooth(0.95, 1, Math.sin(T * 1.3));
      q.g.position.y = 0.015 * Math.max(0, Math.sin(T * 0.5) > 0.985 ? Math.sin((T * 40) % Math.PI) : 0);
    }
  });
}

const KOI: { c: number; cell: Cell; fin: number }[] = [
  { c: 0xffffff, cell: small(13), fin: 0xf6ece0 }, { c: 0xf0b040, cell: WHITE, fin: 0xf4cc70 }, { c: 0xe8642a, cell: WHITE, fin: 0xf09060 }, { c: 0xf4f0ea, cell: WHITE, fin: 0xfaf4ee }];
export function koi(C: Core, o: any = {}) {
  const n = Math.max(1, o.count ?? 3), R0 = o.radius ?? 1.2, v = variant(o.seed ?? 0, KOI.length, [WHITE]);
  const geo = (i: number) => built(C, 'koi' + i, () => {
    const { c, cell, fin } = KOI[i], fr = new Part(), tl = new Part(), rot: V3 = [Math.PI / 2, 0, 0];
    fr.add(lathe([[0.001, 0.0], [0.05, 0.02], [0.06, 0.08], [0.055, 0.15], [0.036, 0.2], [0.012, 0.222], [0.001, 0.226]], 12), c, { cell, r: rot, s: [0.78, 1, 0.9] });
    if (i === 3) fr.add(ball(0.03, 6, 5), 0xd82a1a, { p: [0, 0.04, 0.17], s: [1, 0.5, 1.2] });
    for (const s of [-1, 1]) {
      fr.add(tris([[s * 0.035, -0.025, 0.13], [s * 0.1, -0.04, 0.07], [s * 0.06, -0.03, 0.05]]), fin);
      fr.add(ball(0.007, 4, 3), 0x141010, { p: [s * 0.03, 0.015, 0.19] });
    }
    fr.add(tris([[0, 0.05, 0.1], [0, 0.085, 0.02], [0, 0.055, -0.02]]), fin);
    tl.add(lathe([[0.001, -0.2], [0.016, -0.17], [0.036, -0.1], [0.05, -0.04], [0.056, 0.005]], 12), c, { cell, r: rot, s: [0.78, 1, 0.9] });
    tl.add(tris([[0, 0, -0.17], [0, 0.075, -0.29], [0, 0.01, -0.25], [0, 0, -0.17], [0, -0.01, -0.25], [0, -0.075, -0.29]]), fin);
    tl.add(tris([[0, 0.05, -0.02], [0, 0.07, -0.08], [0, 0.04, -0.12]]), fin);
    return { fr: fr.geo(), tl: tl.geo() };
  });
  const root = new THREE.Group(); root.name = 'koi';
  const fish = Array.from({ length: n }, (_, i) => {
    const G = geo((v.pi + i) % KOI.length), g = new THREE.Group(), f = mesh(C, G.fr, 'koi', false), tl = mesh(C, G.tl, 'koiTail', false);
    const sc = 0.85 + ((i * 0.37 + v.ph) % 1) * 0.6; g.scale.setScalar(sc);
    f.add(tl); g.add(f); root.add(g);
    return { g, f, tl, r: R0 * (0.55 + 0.45 * ((i * 0.61) % 1)), dir: i % 2 ? -1 : 1, ph: i * 2.1 + v.ph, w: 0 };
  });
  for (const q of fish) q.w = (0.22 / q.r) * q.dir;
  return finish(C, root, o, (t) => {
    for (const q of fish) {
      const T = t + q.ph, a = T * q.w + q.ph;
      q.g.position.set(q.r * Math.cos(a), -0.13 + 0.03 * Math.sin(T * 0.4), q.r * Math.sin(a));
      q.g.rotation.y = -a + (q.dir < 0 ? Math.PI : 0);
      const wag = Math.sin(T * 4.5);
      q.tl.rotation.y = 0.38 * wag + 0.2 * q.dir; q.f.rotation.y = -0.08 * wag;
    }
  });
}

export const ANIMALS = { cat, shiba, crane, sparrow, koi };
