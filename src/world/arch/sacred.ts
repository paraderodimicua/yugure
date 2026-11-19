// Pagoda, santuario pequeño y puertas (torii y puerta con tejadillo).
import * as THREE from 'three';
import type { Mats } from '../../render/materials';
import { Builder, Palette, cached, gableRoof, hipRoof, palette, range, rng, sheetY } from './core';
import { koshi, railing } from './houses';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export type SacredOpts = { seed?: number; lit?: number };

/** farol de piedra (toro) con fuego encendido */
export function stoneLantern(B: Builder, mats: Mats, P: Palette, x: number, y: number, z: number, s = 1) {
  const st = mats.stone;
  B.stone(mats.stoneMoss, 0.52 * s, 0.14 * s, 0.52 * s, x, y + 0.07 * s, z, 0, 0, 0.04);
  B.cyl(st, 0.09 * s, 0.78 * s, x, y + 0.52 * s, z, 6, 0.85);
  B.stone(st, 0.46 * s, 0.1 * s, 0.46 * s, x, y + 0.95 * s, z, 0, 0, 0.03);
  B.box(P.lamp, 0.2 * s, 0.24 * s, 0.2 * s, x, y + 1.12 * s, z);
  for (const a of [-1, 1]) for (const c of [-1, 1]) B.box(st, 0.06 * s, 0.26 * s, 0.06 * s, x + a * 0.13 * s, y + 1.13 * s, z + c * 0.13 * s);
  B.cyl(st, 0.44 * s, 0.22 * s, x, y + 1.37 * s, z, 4, 0.18, Math.PI / 4);
  B.sphere(st, 0.07 * s, x, y + 1.53 * s, z, 1.2, 6, 4);
  B.noReceive(P.lamp);
}

export function pagoda(mats: Mats, levels = 3, o: SacredOpts = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 17 + levels), B = new Builder();
  const L = Math.max(3, Math.min(5, Math.round(levels))), litP = o.lit ?? 0.6;
  const red = r() < 0.65;
  const P = palette(mats, r, { wood: red ? mats.woodRed : mats.woodDark, wood2: mats.woodDark, plaster: mats.plaster, tile: mats.tileSlate });
  const w0 = 4.6, pod = 0.76, PW = w0 + 2.6;
  // podio de piedra con escalinata
  B.stone(P.stone, PW, pod, PW, 0, pod / 2, 0, 0, 0, 0.07);
  for (const s of [-1, 1]) { B.stone(mats.stoneMoss, PW + 0.1, 0.14, 0.4, 0, pod - 0.05, s * (PW / 2 - 0.2), 0, 0, 0.03); B.stone(P.stone, 0.4, 0.14, PW - 0.7, s * (PW / 2 - 0.2), pod - 0.05, 0, 0, 0, 0.03); }
  B.platform(-PW / 2, 0, -PW / 2, PW / 2, pod, PW / 2);
  for (let i = 0; i < 4; i++) {
    const sh = pod - i * 0.19, z = PW / 2 + 0.17 + i * 0.34;
    B.stone(i % 2 ? mats.stoneMoss : P.stone, 2.2, sh, 0.36, 0, sh / 2, z, 0, 0, 0.03, r, 0.012);
    B.platform(-1.1, 0, z - 0.17, 1.1, sh, z + 0.17);
  }
  for (const s of [-1, 1]) B.stone(P.stone, 0.34, pod + 0.12, 1.4, s * 1.28, (pod + 0.12) / 2, PW / 2 + 0.7, 0, 0, 0.05);
  let y = pod, wi = w0, topY = 0, eaveW = 0;
  for (let i = 0; i < L; i++) {
    const last = i === L - 1, hi = 2.7 - i * 0.16, ov = 1.75 - i * 0.1, half = wi / 2, wn = w0 * (1 - 0.12 * (i + 1));
    const yb = y + hi;
    for (let sd = 0; sd < 4; sd++) {
      const S = new Builder(), bay = wi / 3;
      for (let k = 0; k < 3; k++) {
        const px = -half + k * bay;
        S.cyl(P.wood, 0.12, hi, px, y + hi / 2, half, 8);
        // ménsulas (tokyo) simplificadas: dado, brazo, dado alto, cola
        S.box(P.wood, 0.3, 0.16, 0.3, px, yb + 0.08, half);
        if (k > 0) {
          S.box(P.wood, 0.14, 0.12, 1.0, px, yb + 0.22, half + 0.32);
          S.box(P.wood, 0.9, 0.12, 0.14, px, yb + 0.22, half);
          S.box(P.wood, 0.11, 0.1, 1.45, px, yb + 0.4, half + 0.6, 0, 0.12);
        } else {
          S.box(P.wood, 0.14, 0.12, 1.7, px - 0.32, yb + 0.22, half + 0.32, -Math.PI / 4);
          S.box(P.wood, 0.11, 0.1, 2.3, px - 0.55, yb + 0.42, half + 0.55, -Math.PI / 4, 0.1);
        }
      }
      S.box(P.wood, wi, 0.14, 0.12, 0, y + 0.1, half); S.box(P.wood, wi, 0.14, 0.12, 0, yb - 0.08, half); S.box(P.wood, wi, 0.1, 0.1, 0, y + hi * 0.3, half);
      S.box(P.wood, wi + 1.25, 0.13, 0.13, 0, yb + 0.34, half + 0.62); S.box(P.wood, wi + 2.3, 0.12, 0.12, 0, yb + 0.56, half + 1.14);
      S.box(P.plaster, wi - 0.1, hi, 0.06, 0, y + hi / 2, half - 0.07);
      // vano central: puerta de tablones (planta baja) o ventana renji
      const cw = bay - 0.3, cy0 = y + (i === 0 ? 0.17 : hi * 0.3 + 0.05), cy1 = yb - 0.3, lit = r() < litP;
      S.box(P.wood2, cw + 0.16, cy1 - cy0 + 0.12, 0.05, 0, (cy0 + cy1) / 2, half - 0.02);
      if (i === 0) {
        for (const s of [-1, 1]) {
          S.box(P.wood, cw / 2 - 0.02, (cy1 - cy0) * 0.5, 0.05, s * cw / 4, cy0 + (cy1 - cy0) * 0.25, half + 0.02);
          for (const hy of [0.12, 0.42]) for (const hx of [0.12, 0.34]) S.sphere(mats.metalGold, 0.03, s * hx, cy0 + (cy1 - cy0) * hy, half + 0.05, 1, 5, 3);
        }
        S.box(lit ? P.paperLit : P.dark, cw, (cy1 - cy0) * 0.5, 0.02, 0, cy0 + (cy1 - cy0) * 0.75, half + 0.012);
        koshi(S, P.wood, -cw / 2, cw / 2, cy0 + (cy1 - cy0) * 0.5, cy1, half + 0.04, 0.09, 0.035, 0.035, 1);
      } else {
        S.box(lit ? P.paperLit : P.dark, cw, cy1 - cy0, 0.02, 0, (cy0 + cy1) / 2, half + 0.012);
        koshi(S, P.wood, -cw / 2, cw / 2, cy0, cy1, half + 0.04, 0.1, 0.04, 0.035, 0);
      }
      for (const s of [-1, 1]) { // vanos laterales: ventanas de barrotes en la base, tabla cruzada arriba
        if (i === 0) {
          S.box(P.wood2, bay - 0.5, 0.9, 0.04, s * bay, y + hi * 0.3 + 0.6, half - 0.02);
          S.box(r() < litP ? P.paperLit : P.dark, bay - 0.62, 0.78, 0.02, s * bay, y + hi * 0.3 + 0.6, half);
          koshi(S, P.wood, s * bay - (bay - 0.62) / 2, s * bay + (bay - 0.62) / 2, y + hi * 0.3 + 0.21, y + hi * 0.3 + 0.99, half + 0.03, 0.1, 0.04, 0.03, 0);
        } else S.box(P.wood, 0.08, hi * 0.7 - 0.2, 0.07, s * bay, y + hi * 0.3 + (hi * 0.7 - 0.2) / 2, half - 0.02);
      }
      if (i > 0) { // balcón perimetral con barandilla
        S.box(P.wood2, wi + 1.5, 0.06, 0.78, 0, y + 0.0, half + 0.37);
        S.box(P.wood, wi + 1.56, 0.12, 0.08, 0, y - 0.07, half + 0.74);
        railing(S, P.wood, -half - 0.72, half + 0.72, half + 0.72, half + 0.72, y + 0.02, 0.6, 2);
        S.platform(-half - 0.75, y - 0.1, half, half + 0.75, y + 0.03, half + 0.76);
      }
      S.noReceive(P.paperLit);
      B.merge(S, 0, 0, 0, sd * Math.PI / 2);
    }
    // tejado del nivel
    const W = wi + 2 * ov, topW = last ? 0.3 : wn + 1.4, run = (W - topW) / 2, rise = run * (last ? 0.72 : 0.4);
    const sag = last ? 0.34 : 0.16, up = 0.5 - i * 0.03;
    const t = (half + 1.14 - topW / 2) / run;
    const yR = yb + 0.72 + rise * t + sag * 4 * t * (1 - t);
    hipRoof(B, P.tile, P.wood2, P.tile, { y: yR, w: W, d: W, topW, topD: topW, rise, sag, upturn: up, col: 0.56, row: 0.95 });
    if (!last) B.box(P.wood2, topW + 0.2, 0.16, topW + 0.2, 0, yR + 0.0, 0);
    // campanillas de viento en las esquinas
    for (const a of [-1, 1]) for (const c of [-1, 1]) {
      const cx = a * (W / 2 - 0.12), cz = c * (W / 2 - 0.12), cy = yR - rise + up - 0.22;
      B.box(P.metal, 0.012, 0.22, 0.012, cx, cy, cz); B.cyl(mats.metalGold, 0.05, 0.1, cx, cy - 0.15, cz, 6, 0.5);
    }
    if (i === 0) eaveW = W;
    y = yR + 0.1; wi = wn; topY = yR;
  }
  // sorin: base, cuenco invertido, nueve anillos, llama y joya
  {
    const g = mats.metalGold;
    B.box(g, 0.62, 0.26, 0.62, 0, topY + 0.1, 0); B.box(g, 0.74, 0.06, 0.74, 0, topY + 0.25, 0);
    B.sphere(g, 0.28, 0, topY + 0.28, 0, 0.9, 8, 6);
    B.cyl(g, 0.045, 3.4, 0, topY + 2.0, 0, 6);
    for (let k = 0; k < 7; k++) { const rr = 0.3 - k * 0.022; B.cyl(g, rr, 0.045, 0, topY + 0.85 + k * 0.3, 0, 10, 0.9); B.cyl(g, rr * 0.45, 0.14, 0, topY + 0.95 + k * 0.3, 0, 6); }
    const flame = cached('suien', () => {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.quadraticCurveTo(0.26, 0.08, 0.2, 0.34); s.quadraticCurveTo(0.12, 0.3, 0.1, 0.5); s.quadraticCurveTo(0.02, 0.55, 0, 0.74);
      s.quadraticCurveTo(-0.02, 0.55, -0.1, 0.5); s.quadraticCurveTo(-0.12, 0.3, -0.2, 0.34); s.quadraticCurveTo(-0.26, 0.08, 0, 0);
      const e = new THREE.ExtrudeGeometry(s, { depth: 0.024, bevelEnabled: false, curveSegments: 3 }); e.translate(0, 0, -0.012); return e;
    });
    B.geo(g, flame, 0, topY + 3.0, 0); B.geo(g, flame, 0, topY + 3.0, 0, Math.PI / 2);
    B.sphere(g, 0.09, 0, topY + 3.82, 0, 1.25, 8, 6);
  }
  B.anchor('lantern', -1.5, pod + 2.0, PW / 2 - 0.9); B.anchor('lantern', 1.5, pod + 2.0, PW / 2 - 0.9);
  return B.finish('pagoda', { w: Math.max(PW, eaveW), h: topY + 3.95, d: Math.max(PW, eaveW) });
}

export function shrine(mats: Mats, o: SacredOpts = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 19 + 7), B = new Builder();
  const copper = mats.tint('metalPaint', 0x4f8f7a);
  const red = r() < 0.5;
  const P = palette(mats, r, { wood: mats.woodDark, wood2: mats.woodWarm, tile: copper, plaster: mats.plaster });
  const rail = red ? mats.lacquerRed : mats.woodWarm;
  const pod = 0.85, PWd = 4.8, PD = 4.6, pz = -0.5 - PD / 2; // podio: frente en z=-0.5
  // podio de sillares
  for (let row = 0; row < 2; row++) {
    const rh = pod / 2, yy = rh / 2 + row * rh;
    for (let x = -PWd / 2; x < PWd / 2 - 0.01;) {
      const sw = Math.min(range(r, 0.6, 1.2), PWd / 2 - x);
      B.stone(r() < 0.3 ? mats.stoneMoss : P.stone, sw - 0.012, 0.3, rh - 0.01, x + sw / 2, yy, -0.5 - 0.15, 0, Math.PI / 2, 0.035, r, 0.01);
      x += sw;
    }
    for (const s of [-1, 1]) for (let z = -0.5; z > -0.5 - PD + 0.01;) {
      const sw = Math.min(range(r, 0.7, 1.3), z + 0.5 + PD);
      B.stone(P.stone, sw - 0.012, 0.3, rh - 0.01, s * (PWd / 2 - 0.15), yy, z - sw / 2, s * Math.PI / 2, Math.PI / 2, 0.035, r, 0.01);
      z -= sw;
    }
  }
  B.box(mats.cobble, PWd - 0.3, pod, PD - 0.15, 0, pod / 2 - 0.005, pz - 0.08);
  B.platform(-PWd / 2, 0, -0.5 - PD, PWd / 2, pod, -0.5);
  // escalinata
  const ns = 5, sr = pod / ns;
  for (let i = 0; i < ns; i++) {
    const top = pod - i * sr, z = -0.5 + 0.16 + i * 0.32;
    for (let x = -1.0; x < 0.99;) { const sw = Math.min(range(r, 0.55, 1.0), 1.0 - x); B.stone(r() < 0.25 ? mats.stoneMoss : P.stone, sw - 0.01, top, 0.34, x + sw / 2, top / 2, z, 0, 0, 0.03, r, 0.012); x += sw; }
    B.platform(-1.0, 0, z - 0.16, 1.0, top, z + 0.16);
  }
  for (const s of [-1, 1]) B.stone(P.stone, 0.32, pod + 0.1, ns * 0.32 + 0.1, s * 1.17, (pod + 0.1) / 2, -0.5 + ns * 0.16, 0, 0, 0.05);
  stoneLantern(B, mats, P, -1.9, 0, 0.9, 1.1); stoneLantern(B, mats, P, 1.9, 0, 0.7, 1.1);
  // cuerpo elevado sobre pilotes con galería
  const fl = pod + 0.6, bw = 2.0, bd = 1.8, hz = -3.3, bh = 1.95, fz = hz + bd / 2; // fz = frente del cuerpo
  const dw = 3.1, dd = 2.9;
  for (const a of [-1, 1]) for (const c of [-1, 0, 1]) B.cyl(P.wood, 0.09, fl - pod, a * (dw / 2 - 0.2), pod + (fl - pod) / 2, hz + c * (dd / 2 - 0.2), 7);
  B.box(P.wood2, dw, 0.07, dd, 0, fl - 0.035, hz); B.box(P.wood, dw + 0.06, 0.12, dd + 0.06, 0, fl - 0.13, hz);
  B.platform(-dw / 2, fl - 0.2, hz - dd / 2, dw / 2, fl, hz + dd / 2);
  for (let i = 0; i < 3; i++) { // peldaños de madera
    const ty = fl - (i + 1) * (fl - pod) / 4, z = hz + dd / 2 + 0.14 + i * 0.28;
    B.box(P.wood2, 1.3, 0.06, 0.3, 0, ty, z); B.platform(-0.65, ty - 0.06, z - 0.15, 0.65, ty + 0.03, z + 0.15);
  }
  for (const s of [-1, 1]) {
    B.box(P.wood, 0.07, 0.16, 1.1, s * 0.68, pod + (fl - pod) / 2 + 0.03, hz + dd / 2 + 0.42, 0, 0.58);
    railing(B, rail, s * 0.72, hz + dd / 2 - 0.05, s * (dw / 2 - 0.05), hz + dd / 2 - 0.05, fl, 0.6, 2);
    railing(B, rail, s * (dw / 2 - 0.05), hz + dd / 2 - 0.05, s * (dw / 2 - 0.05), hz - dd / 2 + 0.05, fl, 0.6, 2);
    for (const c of [-1, 1]) B.cyl(P.wood, 0.085, bh, s * bw / 2, fl + bh / 2, hz + c * bd / 2, 8);
    B.box(P.wood2, 0.05, bh, bd, s * (bw / 2 - 0.01), fl + bh / 2, hz);
    for (let z = hz - bd / 2 + 0.2; z < hz + bd / 2; z += 0.26) B.box(P.wood, 0.02, bh - 0.3, 0.03, s * (bw / 2 + 0.02), fl + bh / 2, z);
  }
  B.box(P.wood2, bw, bh, 0.05, 0, fl + bh / 2, hz - bd / 2 + 0.01);
  for (const yy of [fl + 0.08, fl + bh - 0.35, fl + bh - 0.07]) { B.box(P.wood, bw + 0.2, 0.12, 0.1, 0, yy, fz); for (const s of [-1, 1]) B.box(P.wood, 0.1, 0.12, bd + 0.2, s * bw / 2, yy, hz); }
  // puertas de celosía con luz dentro
  const lit = r() < (o.lit ?? 0.8);
  B.box(lit ? P.paperLit : P.dark, bw - 0.2, bh - 0.5, 0.02, 0, fl + (bh - 0.35) / 2 + 0.05, fz - 0.04);
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -bw / 2 + 0.1 : 0.015, x1 = s < 0 ? -0.015 : bw / 2 - 0.1;
    B.box(P.wood, x1 - x0, 0.5, 0.03, (x0 + x1) / 2, fl + 0.4, fz - 0.015);
    koshi(B, P.wood, x0, x1, fl + 0.66, fl + bh - 0.42, fz - 0.01, 0.075, 0.025, 0.03, 3);
    B.box(P.wood, 0.05, bh - 0.5, 0.04, s < 0 ? x1 : x0, fl + (bh - 0.35) / 2 + 0.05, fz - 0.01);
  }
  B.box(P.plaster, bw - 0.2, 0.2, 0.03, 0, fl + bh - 0.21, fz - 0.03);
  B.noReceive(P.paperLit);
  // tejado nagare: faldón delantero largo y combado sobre el porche
  const pitch = 0.56, runB = bd / 2 + 0.55, runF = bd / 2 + 2.0, len = bw + 1.7, yR = fl + bh + 0.05 + (bd / 2) * Math.tan(pitch) + 0.1;
  gableRoof(B, P, { len, y: yR, z: hz, runF, runB, pitch, sag: 0.16, col: 0.3, row: 0.8, oni: false });
  for (const s of [-1, 1]) {
    const gx = s * (bw / 2 + 0.03), a = V(gx, fl + bh, fz), b = V(gx, fl + bh, hz - bd / 2), c = V(gx, yR - 0.1, hz);
    if (s > 0) B.tri(P.plaster, a, b, c); else B.tri(P.plaster, b, a, c);
    // chigi: remates cruzados
    for (const q of [-1, 1]) { B.box(P.wood, 0.07, 0.15, 1.7, s * (len / 2 - 0.12), yR + 0.42, hz + q * 0.05, 0, q * 0.82); B.box(mats.metalGold, 0.075, 0.16, 0.12, s * (len / 2 - 0.12), yR + 0.42 + 0.58, hz - q * 0.62, 0, q * 0.82); }
  }
  for (const kx of [-len * 0.25, 0, len * 0.25]) { B.cyl(P.wood, 0.09, 0.62, kx, yR + 0.4, hz, 8, 1, 0, Math.PI / 2); for (const q of [-1, 1]) B.cyl(mats.metalGold, 0.095, 0.05, kx, yR + 0.4, hz + q * 0.3, 8, 1, 0, Math.PI / 2); }
  // pilares del porche, viga y shimenawa
  const pzp = fz + 1.75, eY = yR - runF * Math.tan(pitch), py = eY + (runF - (pzp - hz)) * Math.tan(pitch) - 0.12;
  for (const s of [-1, 1]) { B.box(P.wood, 0.16, py - pod, 0.16, s * 1.1, pod + (py - pod) / 2, pzp); B.stone(P.stone, 0.3, 0.1, 0.3, s * 1.1, pod + 0.05, pzp, 0, 0, 0.03); B.box(P.wood, 0.1, 0.12, 1.75, s * 1.1, py - 0.25, fz + 0.87); }
  B.box(P.wood, len - 0.5, 0.2, 0.14, 0, py - 0.1, pzp); B.box(P.wood, 2.5, 0.12, 0.12, 0, py - 0.42, pzp);
  {
    const N = 8, ry0 = py - 0.62; let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = V(-1.02 + 2.04 * t, ry0 - 0.22 * 4 * t * (1 - t), pzp + 0.02);
      if (prev) B.rod(mats.rope, 0.035 + 0.04 * Math.sin(Math.PI * ((i - 0.5) / N)), prev, p, 6);
      prev = p;
    }
    for (const t of [0.25, 0.5, 0.75]) {
      const x = -1.02 + 2.04 * t, yy = ry0 - 0.22 * 4 * t * (1 - t) - 0.08;
      for (let k = 0; k < 3; k++) B.box(mats.paper, 0.07, 0.1, 0.006, x + (k % 2 ? 0.03 : -0.03), yy - k * 0.1 - 0.05, pzp + 0.05, 0, 0, k % 2 ? 0.3 : -0.3);
    }
    for (const t of [0.12, 0.38, 0.62, 0.88]) { const x = -1.02 + 2.04 * t; B.cyl(mats.straw, 0.035, 0.24, x, ry0 - 0.22 * 4 * t * (1 - t) - 0.17, pzp + 0.02, 5, 0.3); }
  }
  // campana, cuerda y caja de ofrendas
  B.sphere(mats.metalGold, 0.11, 0, py - 0.58, pzp - 0.35, 1, 8, 6); B.rod(P.cloth, 0.03, V(0, py - 0.66, pzp - 0.35), V(0, pod + 0.8, pzp - 0.3), 5);
  B.box(P.wood2, 0.9, 0.42, 0.46, 0, pod + 0.25, pzp - 0.85); B.box(P.wood, 0.96, 0.05, 0.52, 0, pod + 0.03, pzp - 0.85);
  for (let x = -0.36; x < 0.4; x += 0.12) B.box(P.wood, 0.05, 0.03, 0.46, x, pod + 0.47, pzp - 0.85);
  B.anchor('lantern', -1.1, py - 0.6, pzp + 0.2); B.anchor('lantern', 1.1, py - 0.6, pzp + 0.2);
  return B.finish('shrine', { w: PWd, h: yR + 1.1, d: PD + 2.2 });
}

export type GateOpts = SacredOpts & { kind?: 'torii' | 'roofed'; width?: number };
export function gate(mats: Mats, o: GateOpts = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 23 + 1), B = new Builder();
  const kind = o.kind ?? (r() < 0.5 ? 'torii' : 'roofed');
  if (kind === 'torii') {
    const cw = o.width ?? range(r, 2.8, 3.6), h = cw * 1.28, red = mats.lacquerRed, blk = mats.lacquerBlack, half = cw / 2 + 0.2;
    for (const s of [-1, 1]) {
      B.cyl(mats.stone, 0.4, 0.2, s * half, 0.1, 0, 10, 0.85);
      B.rod(red, 0.2, V(s * half, 0.2, 0), V(s * (half - 0.14), h, 0), 10, 0.85);
      B.cyl(blk, 0.235, 0.55, s * (half - 0.01), 0.47, 0, 10, 0.94);
      B.cyl(blk, 0.2, 0.1, s * (half - 0.14), h - 0.03, 0, 10); // daiwa
    }
    const ny = h * 0.76;
    B.box(red, cw + 1.5, 0.26, 0.17, 0, ny, 0);
    for (const s of [-1, 1]) for (const q of [-1, 1]) B.box(red, 0.07, 0.12, 0.3, s * (half - 0.1) + q * 0.24, ny + 0.02, 0, 0, 0, q * 0.25); // cuñas
    B.box(red, 0.2, h - ny - 0.2, 0.14, 0, (h + ny) / 2, 0);
    B.box(mats.metalGold, 0.5, 0.74, 0.05, 0, (h + ny) / 2 + 0.02, 0.09); B.box(mats.woodDark, 0.4, 0.64, 0.06, 0, (h + ny) / 2 + 0.02, 0.095);
    // shimaki y kasagi curvos, con chapa negra encima
    const span = cw + 2.3, N = 12, curve = (x: number) => 0.34 * Math.pow(Math.abs(x) / (span / 2), 2.4);
    for (let i = 0; i < N; i++) {
      const xa = -span / 2 + (span * i) / N, xb = xa + span / N, xm = (xa + xb) / 2, ya = curve(xa), yb2 = curve(xb), ym = (ya + yb2) / 2;
      const ang = Math.atan2(yb2 - ya, xb - xa), sl = Math.hypot(xb - xa, yb2 - ya) + 0.02;
      if (Math.abs(xm) < span / 2 - 0.25) B.box(red, sl, 0.2, 0.22, xm, h + 0.1 + ym, 0, 0, 0, ang);
      B.box(red, sl, 0.24, 0.36, xm, h + 0.32 + ym, 0, 0, 0, ang);
      B.box(blk, sl, 0.07, 0.46, xm, h + 0.475 + ym, 0, 0, 0, ang);
      B.platform(xa, h + ym, -0.23, xb, h + 0.51 + ym, 0.23);
    }
    B.anchor('lantern', -half + 0.5, ny - 0.2, 0); B.anchor('lantern', half - 0.5, ny - 0.2, 0);
    return B.finish('torii', { w: span, h: h + 0.9, d: 0.8 });
  }
  // puerta con tejadillo (yakuimon) y tapias laterales
  const P = palette(mats, r, { wood: mats.woodDark, wood2: mats.woodWeathered });
  const cw = o.width ?? range(r, 2.6, 3.2), ph = 3.0, half = cw / 2 + 0.14;
  for (const s of [-1, 1]) {
    B.stone(P.stone, 0.5, 0.16, 0.5, s * half, 0.08, 0, 0, 0, 0.04); B.box(P.wood, 0.28, ph, 0.28, s * half, 0.16 + ph / 2, 0);
    B.stone(P.stone, 0.4, 0.14, 0.4, s * half, 0.07, -1.35, 0, 0, 0.04); B.box(P.wood, 0.2, ph - 0.35, 0.2, s * half, 0.14 + (ph - 0.35) / 2, -1.35);
    B.box(P.wood, 0.16, 0.2, 2.6, s * half, ph + 0.02, -0.55); B.box(P.wood, 0.12, 0.14, 1.35, s * half, 1.9, -0.68);
    B.box(mats.metalDark, 0.3, 0.1, 0.3, s * half, 0.4, 0); B.box(mats.metalDark, 0.3, 0.06, 0.3, s * half, ph - 0.2, 0);
    // hoja de tablones entreabierta con travesaños y clavos
    const a = range(r, 0.9, 1.4), lw = cw / 2 - 0.02, dxn = -s * Math.cos(a), dzn = -Math.sin(a), hx = s * (cw / 2), cx = hx + dxn * lw / 2, cz = dzn * lw / 2, ry = Math.atan2(-dzn, dxn);
    B.box(P.wood2, lw, ph - 0.55, 0.07, cx, 0.2 + (ph - 0.55) / 2, cz, ry);
    for (const yy of [0.5, 1.4, 2.3]) {
      B.box(P.wood, lw, 0.12, 0.11, cx, yy, cz, ry);
      for (const t of [0.15, 0.4, 0.65, 0.9]) B.sphere(mats.metalDark, 0.035, hx + dxn * lw * t - dzn * 0.06 * s * -1, yy, dzn * lw * t + dxn * 0.06 * s * -1 + 0, 1, 5, 3);
    }
  }
  B.box(P.wood, cw + 1.3, 0.3, 0.2, 0, ph - 0.05, 0); B.box(P.wood, cw + 0.9, 0.16, 0.16, 0, ph - 0.3, -1.35);
  B.box(P.wood, cw, 0.1, 0.14, 0, ph - 0.5, 0); B.box(P.plaster, cw, 0.3, 0.05, 0, ph - 0.3, 0);
  B.stone(P.stone, cw + 0.3, 0.1, 0.5, 0, 0.05, 0, 0, 0, 0.03, r, 0.01);
  const pitch = 0.48, len = cw + 2.0, yR = ph + 0.2 + 0.55 * Math.tan(pitch) + 0.5;
  gableRoof(B, P, { len, y: yR, z: -0.55, runF: 1.75, runB: 1.75, pitch, sag: 0.06 });
  for (let x = -len / 2 + 0.2; x < len / 2; x += 0.32) B.box(P.wood, 0.06, 0.08, 3.3 / Math.cos(pitch) / 2, x, yR - 0.14 - 0.82 * Math.tan(pitch), 0.27, 0, pitch);
  for (let x = -len / 2 + 0.2; x < len / 2; x += 0.32) B.box(P.wood, 0.06, 0.08, 3.3 / Math.cos(pitch) / 2, x, yR - 0.14 - 0.82 * Math.tan(pitch), -1.37, 0, -pitch);
  for (const s of [-1, 1]) {
    const gx = s * (half + 0.1), a = V(gx, ph + 0.1, 0.6), b = V(gx, ph + 0.1, -1.7), c = V(gx, yR - 0.1, -0.55);
    B.tri(P.plaster, a, b, c); B.tri(P.plaster, b, a, c);
    // tapia con zócalo de piedra y albardilla de teja
    const wl = 1.5, wx = s * (half + 0.14 + wl / 2);
    B.stone(P.stone, wl, 0.45, 0.5, wx, 0.225, 0, 0, 0, 0.05, r, 0.015);
    B.box(P.plaster, wl, 1.5, 0.3, wx, 1.2, 0); B.box(P.wood, wl, 0.1, 0.36, wx, 1.95, 0);
    for (const q of [-0.5, 0.5]) B.box(P.wood, 0.1, 1.5, 0.34, wx + q * (wl - 0.1), 1.2, 0);
    gableRoof(B, P, { len: wl + 0.1, x: wx, y: 2.32, z: 0, runF: 0.42, runB: 0.42, pitch: 0.6, oni: false, platforms: false, row: 0.4 });
    B.platform(wx - wl / 2, 0, -0.42, wx + wl / 2, 2.4, 0.42);
    B.anchor('lantern', s * half, 2.2, 0.3);
  }
  B.anchor('sign', 0, ph - 0.3, 0.14, 1.2, 0.4);
  return B.finish('gate', { w: cw + 3.6, h: yR + 0.4, d: 3.6 });
}
void sheetY;
