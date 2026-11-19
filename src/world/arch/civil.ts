// Obra civil: puente arqueado, escaleras y muros de piedra, vallas y terrazas.
import * as THREE from 'three';
import type { Mats } from '../../render/materials';
import { Builder, Rnd, range, rng } from './core';
import { railing } from './houses';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export type CivilOpts = { seed?: number };

/** paño de mampostería ishigaki con talud; mira a +Z, base del frente en z=0, centrado en x */
function ishigaki(S: Builder, mats: Mats, r: Rnd, len: number, h: number, batter = 0.12) {
  let y = 0, row = 0;
  while (y < h - 0.02) {
    const rh = Math.min(h - y, range(r, 0.34, 0.52) * (1 - 0.25 * (y / h)));
    let x = -len / 2 - (row % 2 ? 0 : 0.0);
    while (x < len / 2 - 0.01) {
      let sw = range(r, 0.45, 1.0) * (y < 0.5 ? 1.25 : 1);
      if (len / 2 - x - sw < 0.3) sw = len / 2 - x;
      const mossy = r() < (y < 0.5 || y > h - 0.6 ? 0.4 : 0.15);
      S.stone(mossy ? mats.stoneMoss : mats.stone, sw - 0.012, 0.32, rh - 0.012, x + sw / 2, y + rh / 2, -(y + rh / 2) * batter - 0.14 + range(r, -0.025, 0.02),
        0, Math.PI / 2 - batter, range(r, 0.035, 0.06), r, 0.018);
      x += sw;
    }
    y += rh; row++;
  }
  S.box(mats.stoneMoss, len - 0.04, h - 0.03, 0.2, 0, h / 2 - 0.02, -(h / 2) * batter - 0.27, 0, -batter);
}

export function stoneWall(mats: Mats, len = 8, h = 2.4, o: CivilOpts = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 29 + 2), B = new Builder(), th = 0.7, bz = -h * 0.12;
  ishigaki(B, mats, r, len, h);
  B.box(mats.stone, len - 0.02, h - 0.05, th, 0, h / 2 - 0.03, bz - th / 2 - 0.2);
  for (let x = -len / 2; x < len / 2 - 0.01;) { // albardilla de losas con musgo
    const sw = Math.min(range(r, 0.6, 1.2), len / 2 - x);
    B.stone(r() < 0.4 ? mats.stoneMoss : mats.stone, sw - 0.012, 0.12, th + 0.32, x + sw / 2, h + 0.045, bz - th / 2 - 0.05, 0, 0, 0.03, r, 0.012);
    if (r() < 0.4) B.box(mats.moss, sw * 0.6, 0.03, 0.3, x + sw / 2, h + 0.11, bz - range(r, 0.2, 0.6), r());
    x += sw;
  }
  B.platform(-len / 2, 0, bz - th - 0.2, len / 2, h + 0.1, bz + 0.1);
  return B.finish('stoneWall', { w: len, h: h + 0.1, d: th + 0.3 + h * 0.12 });
}

export function terrace(mats: Mats, w = 8, h = 2.4, d = 7, o: CivilOpts & { rail?: boolean } = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 31 + 4), B = new Builder(), bt = h * 0.12;
  const F = new Builder(); ishigaki(F, mats, r, w, h); B.merge(F, 0, 0, 0, 0);
  for (const s of [-1, 1]) { const S = new Builder(); ishigaki(S, mats, r, d, h); B.merge(S, s * w / 2, 0, -d / 2, s * Math.PI / 2); }
  // esquinas de sillares grandes
  for (const s of [-1, 1]) for (let y = 0; y < h - 0.05;) {
    const rh = Math.min(h - y, range(r, 0.4, 0.6));
    B.stone(mats.stone, 0.5, rh - 0.01, 0.5, s * (w / 2 - 0.2 - (y + rh / 2) * 0.12), y + rh / 2, -0.2 - (y + rh / 2) * 0.12, 0, 0, 0.04, r, 0.015);
    y += rh;
  }
  B.box(mats.cobble, w - 2 * bt - 0.3, 0.2, d - bt - 0.2, 0, h - 0.1, -d / 2 - bt / 2);
  B.box(mats.earth, w - 2 * bt - 0.5, h - 0.2, 0.3, 0, h / 2 - 0.1, -d + 0.15);
  for (let x = -w / 2 + bt; x < w / 2 - bt - 0.01;) { // coronación
    const sw = Math.min(range(r, 0.6, 1.3), w / 2 - bt - x);
    B.stone(r() < 0.35 ? mats.stoneMoss : mats.stone, sw - 0.012, 0.14, 0.5, x + sw / 2, h + 0.03, -bt - 0.22, 0, 0, 0.035, r, 0.012);
    x += sw;
  }
  for (const s of [-1, 1]) for (let z = -bt - 0.5; z > -d + 0.01;) {
    const sw = Math.min(range(r, 0.6, 1.3), z + d);
    B.stone(mats.stone, 0.5, 0.14, sw - 0.012, s * (w / 2 - bt - 0.22), h + 0.03, z - sw / 2, 0, 0, 0.035, r, 0.012);
    z -= sw;
  }
  for (let i = 0; i < 5; i++) B.box(mats.moss, range(r, 0.3, 0.9), 0.025, range(r, 0.2, 0.5), range(r, -0.45, 0.45) * w, h + 0.012, -bt - range(r, 0.5, d - 0.5), r() * 3);
  // desagüe de piedra
  const dx = range(r, -0.3, 0.3) * w;
  B.box(mats.stone, 0.3, 0.2, 0.5, dx, h * 0.55, -h * 0.55 * 0.12 + 0.1); B.box(mats.hair, 0.16, 0.08, 0.02, dx, h * 0.55 + 0.02, -h * 0.55 * 0.12 + 0.352);
  if (o.rail !== false) railing(B, mats.woodWeathered, -w / 2 + bt + 0.1, -bt - 0.1, w / 2 - bt - 0.1, -bt - 0.1, h + 0.1, 0.8, 2);
  B.platform(-w / 2 + bt, 0, -d, w / 2 - bt, h + 0.1, -bt);
  return B.finish('terrace', { w, h: h + 0.1, d });
}

export function stoneStairs(mats: Mats, steps = 10, width = 2.4, o: CivilOpts = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 37 + steps), B = new Builder(), rise = 0.17, run = 0.36;
  for (let i = 0; i < steps; i++) {
    const top = (i + 1) * rise, zc = -(i + 0.5) * run;
    for (let x = -width / 2; x < width / 2 - 0.01;) {
      let sw = range(r, 0.45, 1.1); if (width / 2 - x - sw < 0.3) sw = width / 2 - x;
      const hj = range(r, -0.012, 0.012);
      B.stone(r() < 0.22 ? mats.stoneMoss : mats.stone, sw - 0.014, rise + 0.04, run + 0.05, x + sw / 2, top - rise / 2 - 0.02 + hj, zc - 0.01, range(r, -0.015, 0.015), 0, 0.028, r, 0.012);
      if (r() < 0.3) B.box(mats.moss, 0.07, 0.03, run * 0.7, x + sw, top + 0.005, zc, range(r, -0.2, 0.2)); // musgo en la junta
      x += sw;
    }
    if (r() < 0.5) B.box(mats.moss, range(r, 0.3, 0.8), 0.03, 0.07, range(r, -0.4, 0.4) * width, top + 0.004, zc - run / 2 + 0.05);
    B.platform(-width / 2, top - rise, zc - run / 2, width / 2, top, zc + run / 2);
  }
  // zancas de sillares escalonados a ambos lados
  for (const s of [-1, 1]) for (let i = 0; i < steps; i += 3) {
    const n = Math.min(3, steps - i), top = (i + n) * rise + 0.2, zc = -(i + n / 2) * run;
    B.stone(i % 2 ? mats.stoneMoss : mats.stone, 0.42, top, n * run - 0.012, s * (width / 2 + 0.2), top / 2, zc, 0, 0, 0.05, r, 0.02);
  }
  B.box(mats.stone, width, steps * rise, 0.1, 0, steps * rise / 2, -steps * run + 0.05);
  return B.finish('stoneStairs', { w: width + 0.84, h: steps * rise, d: steps * run });
}

export function woodFence(mats: Mats, len = 6, h = 1.7, o: CivilOpts & { kind?: 'board' | 'bamboo' } = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 41 + 6), B = new Builder(), kind = o.kind ?? (r() < 0.6 ? 'board' : 'bamboo');
  const np = Math.max(1, Math.round(len / 1.82));
  for (let x = -len / 2; x < len / 2 - 0.01;) { const sw = Math.min(range(r, 0.5, 0.9), len / 2 - x); B.stone(r() < 0.3 ? mats.stoneMoss : mats.stone, sw - 0.01, 0.2, 0.28, x + sw / 2, 0.1, 0, 0, 0, 0.03, r, 0.012); x += sw; }
  if (kind === 'board') {
    const wood = r() < 0.5 ? mats.woodDark : mats.woodWeathered;
    for (let i = 0; i <= np; i++) B.box(mats.woodDark, 0.11, h, 0.11, -len / 2 + (len * i) / np, 0.2 + h / 2, -0.02);
    B.box(mats.woodDark, len, 0.07, 0.06, 0, 0.3, 0.0); B.box(mats.woodDark, len, 0.07, 0.06, 0, h - 0.1, 0.0);
    for (let x = -len / 2 + 0.08; x < len / 2 - 0.05; x += 0.155) {
      if (r() < 0.03) continue; // tabla caída
      const bh = h - 0.2 + range(r, -0.02, 0.02);
      B.box(r() < 0.12 ? mats.woodWarm : wood, 0.145, bh, 0.018, x, 0.22 + bh / 2, 0.04, 0, 0, r() < 0.06 ? range(r, -0.04, 0.04) : 0);
    }
    // albardilla de tablas a dos aguas
    for (const s of [-1, 1]) B.box(mats.woodDark, len + 0.2, 0.025, 0.22, 0, h + 0.2, s * 0.085, 0, s * 0.45);
    B.box(mats.woodDark, len + 0.2, 0.05, 0.05, 0, h + 0.26, 0);
  } else {
    for (let i = 0; i <= np; i++) B.cyl(mats.bark, 0.055, h + 0.1, -len / 2 + (len * i) / np, 0.2 + h / 2, -0.03, 6, 0.9);
    for (let x = -len / 2 + 0.05; x < len / 2; x += 0.062) { const bh = h - 0.1 + range(r, -0.03, 0.02); B.box(r() < 0.2 ? mats.straw : mats.bamboo, 0.055, bh, 0.016, x, 0.2 + bh / 2, 0.02); }
    for (const yy of [0.42, h * 0.55, h - 0.12]) {
      B.cyl(mats.bamboo, 0.028, len, 0, yy + 0.2, 0.05, 5, 1, 0, 0, Math.PI / 2);
      for (let x = -len / 2 + 0.3; x < len / 2; x += 0.45) B.box(mats.hair, 0.03, 0.07, 0.07, x, yy + 0.2, 0.05);
    }
    B.cyl(mats.bamboo, 0.04, len + 0.1, 0, h + 0.14, 0.02, 6, 1, 0, 0, Math.PI / 2);
  }
  B.platform(-len / 2, 0, -0.1, len / 2, h + 0.25, 0.1);
  return B.finish('woodFence', { w: len, h: h + 0.3, d: 0.3 });
}

/** puente arqueado (taiko-bashi); cruza a lo largo de X */
export function bridge(mats: Mats, o: CivilOpts & { len?: number; width?: number; rise?: number } = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 43 + 8), B = new Builder();
  const len = o.len ?? 9, width = o.width ?? 2.2, rise = o.rise ?? 1.3, half = len / 2, red = mats.lacquerRed, deck = mats.woodWeathered;
  const Y = (x: number) => 0.2 + rise * (1 - (x / half) ** 2), A = (x: number) => Math.atan(-2 * rise * x / (half * half));
  const np = Math.round(len / 0.3);
  for (let i = 0; i < np; i++) {
    const x = -half + (i + 0.5) * (len / np);
    if (r() < 0.02) continue;
    B.box(r() < 0.15 ? mats.woodWarm : deck, len / np - 0.012, 0.06, width + range(r, -0.03, 0.03), x, Y(x), 0, 0, 0, A(x));
  }
  const NS = 12;
  for (let i = 0; i < NS; i++) {
    const xa = -half + (len * i) / NS, xb = xa + len / NS, xm = (xa + xb) / 2, ang = Math.atan2(Y(xb) - Y(xa), xb - xa), sl = Math.hypot(xb - xa, Y(xb) - Y(xa)) + 0.03;
    for (const s of [-1, 1]) {
      B.box(mats.woodDark, sl, 0.26, 0.16, xm, (Y(xa) + Y(xb)) / 2 - 0.17, s * (width / 2 - 0.3), 0, 0, ang);
      B.box(red, sl, 0.09, 0.1, xm, (Y(xa) + Y(xb)) / 2 + 0.95, s * (width / 2 - 0.07), 0, 0, ang);
      B.box(red, sl, 0.06, 0.06, xm, (Y(xa) + Y(xb)) / 2 + 0.55, s * (width / 2 - 0.07), 0, 0, ang);
      B.box(red, sl, 0.06, 0.06, xm, (Y(xa) + Y(xb)) / 2 + 0.2, s * (width / 2 - 0.07), 0, 0, ang);
    }
    B.platform(xa, Y(xm) - 0.3, -width / 2, xb, Math.max(Y(xa), Y(xb)) + 0.03, width / 2);
  }
  const posts = Math.round(len / 1.5);
  for (let i = 0; i <= posts; i++) {
    const x = -half + 0.08 + ((len - 0.16) * i) / posts, big = i === 0 || i === posts || i === Math.round(posts / 2);
    for (const s of [-1, 1]) {
      const z = s * (width / 2 - 0.07), ph = big ? 1.2 : 1.02, pw = big ? 0.15 : 0.12;
      B.box(red, pw, ph + 0.3, pw, x, Y(x) + ph / 2 - 0.15, z);
      if (big) { // giboshi de bronce
        B.cyl(mats.metalGold, 0.085, 0.07, x, Y(x) + ph + 0.03, z, 8, 0.8); B.sphere(mats.metalGold, 0.1, x, Y(x) + ph + 0.15, z, 0.85, 8, 6);
        B.cyl(mats.metalGold, 0.05, 0.12, x, Y(x) + ph + 0.27, z, 6, 0.1);
      } else B.box(mats.lacquerBlack, pw + 0.02, 0.05, pw + 0.02, x, Y(x) + ph + 0.02, z);
    }
  }
  // pilas con riostras y estribos de piedra
  for (const px of [-half * 0.42, half * 0.42]) {
    for (const s of [-1, 1]) B.cyl(mats.woodDark, 0.11, Y(px), px, Y(px) / 2 - 0.15, s * (width / 2 - 0.3), 8);
    B.box(mats.woodDark, 0.12, 0.14, width + 0.3, px, Y(px) - 0.36, 0);
    B.box(mats.woodDark, 0.07, 0.1, width * 0.95, px, Y(px) * 0.42, 0, 0, 0.5);
  }
  for (const s of [-1, 1]) {
    B.stone(mats.stone, 1.0, 0.36, width + 0.5, s * (half + 0.3), 0.18, 0, 0, 0, 0.06, r, 0.02);
    B.stone(mats.stoneMoss, 0.6, 0.18, width + 0.2, s * (half + 0.95), 0.09, 0, 0, 0, 0.05, r, 0.02);
    B.platform(s * (half - 0.2), 0, -width / 2, s * (half + 1.25), 0.36, width / 2);
    B.anchor('lantern', s * (half - 0.1), 1.6, width / 2);
  }
  return B.finish('bridge', { w: len + 2.5, h: rise + 1.6, d: width + 0.5 });
}
void V;
