// Casa de té (techo de paja, ventana redonda) y almacén kura (yeso blanco, zócalo namako).
import * as THREE from 'three';
import type { Mats } from '../../render/materials';
import { Builder, KEN, cached, gableRoof, hipRoof, palette, range, rng } from './core';
import { hisashi, koshi, room, shojiLeaf } from './houses';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export type PieceOpts = { seed?: number; lit?: number };

export function teahouse(mats: Mats, o: PieceOpts = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 11 + 5), B = new Builder();
  const earth = mats.tint('plasterAged', 0xb39468);
  const P = palette(mats, r, { wood: mats.woodDark, wood2: mats.woodWarm, plaster: earth });
  const w = 2 * KEN, d = 3.3, fl = 0.45, wallTop = 2.85, eaveY = 2.02, rise = 1.9, ov = 1.25, xL = -w / 2;
  const mirror = r() < 0.5 ? -1 : 1; // qué lado lleva la ventana redonda
  // piedras de apoyo y pilares de tronco
  for (const x of [xL, 0, -xL]) for (const z of [0, -d]) {
    B.stone(P.stone, 0.34, 0.16, 0.34, x, 0.08, z - 0.02, r(), 0, 0.05, r, 0.02);
    B.cyl(mats.bark, 0.075, wallTop - 0.14, x, (wallTop + 0.14) / 2, z - 0.02, 7, 0.9);
  }
  B.box(P.wood, w + 0.2, 0.12, 0.12, 0, fl - 0.07, -0.02); B.box(P.wood, w + 0.2, 0.1, 0.1, 0, fl + 1.86, -0.02);
  // muros de tierra
  for (const s of [-1, 1]) B.box(earth, 0.1, wallTop - 0.2, d, s * (w / 2 - 0.02), (wallTop + 0.2) / 2, -d / 2);
  B.box(earth, w, wallTop - 0.2, 0.1, 0, (wallTop + 0.2) / 2, -d + 0.03);
  B.box(earth, w, wallTop - fl - 1.9, 0.08, 0, (wallTop + fl + 1.9) / 2, -0.05);
  // vano con ventana redonda (marumado)
  {
    const xa = mirror < 0 ? xL + 0.07 : 0.07, xb = xa + KEN - 0.14, xc = (xa + xb) / 2, cy = fl + 1.05, R = 0.52;
    const key = `marumado${(xb - xa).toFixed(2)}`;
    const g = cached(key, () => {
      const s = new THREE.Shape();
      const hw = (xb - xa) / 2;
      s.moveTo(-hw, -1.25); s.lineTo(hw, -1.25); s.lineTo(hw, 0.85); s.lineTo(-hw, 0.85); s.closePath();
      const hole = new THREE.Path(); hole.absarc(0, 0, R, 0, Math.PI * 2, true); s.holes.push(hole);
      return new THREE.ShapeGeometry(s, 14);
    });
    B.geo(earth, g, xc, cy, -0.03);
    B.geo(P.wood, cached('marurim', () => new THREE.TorusGeometry(R, 0.035, 5, 28)), xc, cy, -0.02);
    B.geo(P.paperLit, cached('marudisc', () => new THREE.CircleGeometry(R + 0.03, 24)), xc, cy, -0.07);
    for (const ox of [-0.3, -0.1, 0.12, 0.33]) { const hh = Math.sqrt(R * R - ox * ox); B.box(mats.bamboo, 0.022, hh * 2, 0.022, xc + ox, cy, -0.045); }
    for (const oy of [-0.22, 0.02, 0.27]) { const hh = Math.sqrt(R * R - oy * oy); B.box(mats.bamboo, hh * 2, 0.02, 0.02, xc, cy + oy, -0.04); }
    B.box(P.shade, 0.03, 0.5, 0.004, xc + 0.2, cy - 0.2, -0.062, 0, 0, 0.5); B.box(P.shade, 0.02, 0.3, 0.004, xc + 0.02, cy + 0.02, -0.062, 0, 0, -0.7); // rama en sombra
    B.noReceive(P.paperLit, P.shade);
    B.box(P.wood, xb - xa, 0.06, 0.1, xc, fl + 0.02, -0.03);
  }
  // vano con shoji abierto y sala de té
  {
    const xa = mirror < 0 ? 0.07 : xL + 0.07, xb = xa + KEN - 0.14, y0 = fl + 0.03, y1 = fl + 1.8, lw = (xb - xa) / 2;
    shojiLeaf(B, P, xa, xa + lw + 0.02, y0, y1, -0.03, P.paperLit, 0.25);
    shojiLeaf(B, P, xa + lw * 0.2, xa + lw * 1.2, y0, y1, -0.065, P.paperLit, 0.25);
    room(B, P, xa, xb, fl, y1, -0.1, 1.9, r, { figure: 1 });
    B.cyl(P.dark, 0.13, 0.16, xb - 0.35, fl + 0.1, -0.7, 8, 0.8); B.sphere(P.dark, 0.12, xb - 0.35, fl + 0.24, -0.7, 0.8, 8, 5); // brasero y tetera
    B.anchor('noren', (xa + xb) / 2, y1, 0.02, xb - xa - 0.2, 0.4);
  }
  // puerta baja nijiriguchi en el costado
  {
    const sx = -mirror * (w / 2 + 0.035);
    B.box(P.wood2, 0.03, 0.7, 0.72, sx, fl + 0.4, -1.2); B.box(P.wood, 0.05, 0.06, 0.9, sx, fl + 0.78, -1.2); B.box(P.wood, 0.05, 0.06, 0.9, sx, fl + 0.02, -1.2);
    for (const z of [-0.98, -1.2, -1.42]) B.box(P.wood, 0.045, 0.7, 0.03, sx, fl + 0.4, z);
    B.stone(P.stone, 0.5, 0.3, 0.7, sx - mirror * 0.4, 0.15, -1.2, 0, 0, 0.06, r, 0.03);
    koshi(B, mats.bamboo, -0.45, 0.45, fl + 1.1, fl + 1.7, -d - 0.03, 0.1, 0.025, 0.025, 2); // shitajimado trasera
  }
  // engawa
  B.box(P.wood2, w + 0.5, 0.045, 0.95, 0, fl - 0.02, 0.5);
  for (let x = xL - 0.2; x <= -xL + 0.21; x += (w + 0.4) / 4) { B.box(P.wood, 0.08, 0.1, 0.95, x, fl - 0.09, 0.5); B.box(P.wood, 0.09, fl - 0.14, 0.09, x, (fl - 0.14) / 2, 0.88); }
  B.platform(xL - 0.25, fl - 0.1, 0, -xL + 0.25, fl, 0.97);
  B.stone(mats.stoneMoss, 0.95, 0.24, 0.55, mirror * 0.9, 0.12, 1.3, 0.1, 0, 0.06, r, 0.03);
  // pilares del porche
  for (const x of [xL - 0.2, -xL + 0.2]) { B.stone(P.stone, 0.3, 0.12, 0.3, x, 0.06, 1.05, r(), 0, 0.04); B.cyl(mats.bark, 0.055, eaveY + 0.1, x, (eaveY + 0.22) / 2, 1.05, 6, 0.9); }
  B.cyl(mats.bark, 0.05, w + 0.9, 0, eaveY + 0.16, 1.05, 6, 1, 0, 0, Math.PI / 2);
  // techo de paja a cuatro aguas con canto grueso
  const yR = eaveY + rise, W = w + 2 * ov, D = d + 2 * ov, topW = w * 0.5;
  hipRoof(B, mats.straw, P.wood, mats.straw, { y: yR, z: -d / 2, w: W, d: D, topW, topD: 0.3, rise, flat: true, skirt: 0.26, underDrop: 0.27, hips: false });
  hipRoof(B, mats.straw, null, mats.straw, { y: yR + 0.1, z: -d / 2, w: W * 0.55, d: D * 0.5, topW: topW + 0.05, topD: 0.32, rise: rise * 0.42, flat: true, skirt: 0.12, hips: false, platforms: false });
  B.cyl(mats.bark, 0.17, topW + 0.7, 0, yR + 0.16, -d / 2, 8, 1, 0, 0, Math.PI / 2);
  for (let x = -topW / 2 - 0.1; x <= topW / 2 + 0.11; x += (topW + 0.2) / 4)
    for (const s of [-1, 1]) B.box(mats.bamboo, 0.05, 0.05, 0.95, x, yR + 0.02, -d / 2 + s * 0.3, 0, s * 0.85);
  // banco con fieltro rojo, sombrilla y pila de agua
  {
    const bx = -mirror * 0.9, bz = 2.0, red = mats.tint('fabric', 0xb3261e);
    B.box(P.wood2, 1.5, 0.05, 0.5, bx, 0.42, bz); for (const a of [-1, 1]) for (const c of [-1, 1]) B.box(P.wood, 0.06, 0.4, 0.06, bx + a * 0.65, 0.2, bz + c * 0.19);
    B.box(red, 1.2, 0.02, 0.54, bx, 0.455, bz); B.box(red, 1.2, 0.2, 0.012, bx, 0.36, bz + 0.275);
    B.platform(bx - 0.75, 0, bz - 0.25, bx + 0.75, 0.46, bz + 0.25);
    const ux = bx - mirror * 0.95;
    B.rod(mats.bamboo, 0.025, V(ux, 0, bz - 0.1), V(ux, 2.35, bz - 0.1), 5);
    B.geo(red, cached('parasol', () => new THREE.ConeGeometry(1, 1, 14, 1, true)), ux, 2.2, bz - 0.1, 0, 0, 0, 1.15, 0.36, 1.15);
    B.geo(P.wood2, cached('parasolIn', () => new THREE.ConeGeometry(1, 1, 14, 1, true)), ux, 2.18, bz - 0.1, 0, 0, 0, -1.13, 0.36, 1.13);
    const tx = mirror * 2.2, tz = 1.5;
    B.cyl(mats.stoneMoss, 0.3, 0.42, tx, 0.21, tz, 9, 0.85); B.cyl(mats.water, 0.2, 0.02, tx, 0.425, tz, 9);
    B.rod(mats.bamboo, 0.022, V(tx + 0.4, 0, tz - 0.3), V(tx + 0.4, 0.75, tz - 0.3), 5); B.rod(mats.bamboo, 0.018, V(tx + 0.45, 0.68, tz - 0.34), V(tx + 0.1, 0.6, tz - 0.06), 5);
  }
  B.anchor('lantern', xL - 0.2, eaveY - 0.1, 1.1); B.anchor('sign', 0, eaveY - 0.2, 1.1, 0.9, 0.3);
  return B.finish('teahouse', { w: W, h: yR + 0.4, d: D });
}

/** juntas namako: rejilla diagonal de yeso en relieve sobre teja oscura, recortada al paño */
function namako(B: Builder, white: THREE.Material, dark: THREE.Material, len: number, h: number, x: number, y: number, z: number, ry: number) {
  const S = new Builder(), sp = 0.44;
  S.box(dark, len, h, 0.04, 0, h / 2, 0.02);
  for (const fam of [1, -1]) for (let c = -h + sp / 2; c < len; c += sp) {
    const u0 = Math.max(c, 0), u1 = Math.min(len, c + h);
    if (u1 - u0 < 0.05) continue;
    const v0 = u0 - c, v1 = u1 - c, L = (u1 - u0) * Math.SQRT2;
    const uc = (u0 + u1) / 2 - len / 2;
    S.box(white, L, 0.075, 0.035, fam * uc, (v0 + v1) / 2, 0.05, 0, 0, fam * Math.PI / 4);
  }
  S.box(white, len, 0.09, 0.06, 0, h + 0.03, 0.04);
  B.merge(S, x, y, z, ry);
}

export function storehouse(mats: Mats, o: PieceOpts = {}): THREE.Group {
  const r = rng((o.seed ?? 1) * 13 + 3), B = new Builder();
  const white = mats.tint('plaster', r() < 0.5 ? 0xebe5d8 : 0xdcd6ca);
  const P = palette(mats, r, { wood: mats.woodDark, wood2: mats.woodWeathered, plaster: white, tile: mats.tileSlate });
  const w = range(r, 4.4, 5.2), d = range(r, 5.0, 6.0), pl = 0.35, H = range(r, 4.8, 5.6), nh = 1.25;
  const lit = r() < (o.lit ?? 0.7);
  for (let x = -w / 2 - 0.12; x < w / 2 + 0.1;) { const sw = Math.min(range(r, 0.6, 1.1), w / 2 + 0.12 - x); B.stone(P.stone, sw - 0.012, pl, 0.4, x + sw / 2, pl / 2, 0.0, 0, 0, 0.04, r, 0.012); x += sw; }
  B.box(P.stone, w + 0.24, pl, d + 0.1, 0, pl / 2 - 0.01, -d / 2 - 0.1);
  B.box(white, w, H - pl, d, 0, (H + pl) / 2, -d / 2);
  // banda hachimaki escalonada bajo el alero
  B.box(white, w + 0.14, 0.55, d + 0.14, 0, H - 0.3, -d / 2); B.box(white, w + 0.3, 0.22, d + 0.3, 0, H - 0.1, -d / 2);
  // zócalo namako en frente y costados (el frente se interrumpe en la puerta)
  const dw = 1.25, dh = 2.0, seg = (w - dw - 0.5) / 2;
  for (const s of [-1, 1]) {
    namako(B, white, mats.plasterDark, seg, nh, s * (dw / 2 + 0.25 + seg / 2), pl, 0, 0);
    namako(B, white, mats.plasterDark, d, nh, s * w / 2, pl, -d / 2, s * Math.PI / 2);
  }
  // puerta: marco escalonado, hojas gruesas abiertas y reja interior con luz
  for (let k = 0; k < 3; k++) {
    const e = 0.1 * (k + 1), zz = 0.13 - k * 0.04;
    for (const s of [-1, 1]) B.box(white, 0.12, dh + e, zz, s * (dw / 2 + e - 0.03), pl + (dh + e) / 2, zz / 2);
    B.box(white, dw + 2 * e + 0.06, 0.12, zz, 0, pl + dh + e - 0.03, zz / 2);
  }
  B.box(lit ? P.paperLit : P.dark, dw, dh, 0.02, 0, pl + dh / 2, -0.05);
  koshi(B, P.wood, -dw / 2, dw / 2, pl + 0.6, pl + dh, -0.02, 0.09, 0.035, 0.04, 2);
  B.box(P.wood, dw, 0.6, 0.04, 0, pl + 0.3, -0.02); B.box(P.wood, 0.07, dh, 0.05, 0, pl + dh / 2, -0.015);
  B.noReceive(P.paperLit);
  for (const s of [-1, 1]) {
    const a = range(r, 1.75, 2.2), hx = s * (dw / 2 + 0.05), dxn = Math.cos(a) * -s, dzn = Math.sin(a), lw = dw / 2;
    const ry = Math.atan2(-dzn, dxn);
    B.box(white, lw, dh, 0.14, hx + dxn * lw / 2, pl + dh / 2, 0.16 + dzn * lw / 2, ry);
    B.box(mats.plasterDark, lw - 0.14, dh - 0.14, 0.2, hx + dxn * lw / 2, pl + dh / 2, 0.16 + dzn * lw / 2, ry);
    B.box(P.metal, 0.05, 0.08, 0.2, hx, pl + 0.4, 0.12); B.box(P.metal, 0.05, 0.08, 0.2, hx, pl + dh - 0.4, 0.12);
  }
  B.stone(P.stone, dw + 0.5, 0.16, 0.6, 0, 0.08, 0.42, 0, 0, 0.04, r, 0.015);
  hisashi(B, P, -dw / 2 - 0.55, dw / 2 + 0.55, pl + dh + 0.75, 0.01, 0.75, 0.34, [-dw / 2 - 0.4, dw / 2 + 0.4]);
  // ventanas altas con contraventanas gruesas y barrotes de hierro
  const wy = H - 1.75;
  for (const wx of [-w * 0.27, w * 0.27]) {
    for (let k = 0; k < 2; k++) {
      const e = 0.09 * (k + 1), zz = 0.1 - k * 0.04;
      for (const s of [-1, 1]) B.box(white, 0.1, 0.8 + 2 * e, zz, wx + s * (0.3 + e - 0.02), wy, zz / 2);
      for (const s of [-1, 1]) B.box(white, 0.6 + 2 * e + 0.06, 0.1, zz, wx, wy + s * (0.4 + e - 0.02), zz / 2);
    }
    B.box(P.dark, 0.6, 0.8, 0.02, wx, wy, 0.012);
    for (const bx of [-0.15, 0, 0.15]) B.box(P.metal, 0.025, 0.8, 0.025, wx + bx, wy, 0.04);
    for (const s of [-1, 1]) {
      const a = range(r, 1.9, 2.5), dxn = Math.cos(a) * -s, dzn = Math.sin(a), hx = wx + s * 0.36;
      B.box(white, 0.3, 0.8, 0.09, hx + dxn * 0.15, wy, 0.12 + dzn * 0.15, Math.atan2(-dzn, dxn));
    }
  }
  // ganchos de hierro (orikugi) sobre rosetas de yeso
  for (const hy of [pl + nh + 0.55, H - 0.85]) for (let x = -w / 2 + 0.35; x < w / 2 - 0.2; x += 0.85) {
    if (Math.abs(x) < dw / 2 + 0.5 && hy < pl + dh + 1.3) continue;
    B.cyl(white, 0.06, 0.03, x, hy, 0.012, 7, 0.7, 0, Math.PI / 2); B.box(P.metal, 0.025, 0.025, 0.14, x, hy, 0.07); B.box(P.metal, 0.025, 0.07, 0.025, x, hy + 0.03, 0.13);
  }
  // tejado y hastiales con emblema
  const pitch = Math.atan(0.5), yR = H + 0.02 + (d / 2) * 0.5, len = w + 0.9;
  gableRoof(B, P, { len, y: yR, z: -d / 2, runF: d / 2 + 0.5, runB: d / 2 + 0.5, pitch });
  for (const s of [-1, 1]) {
    const gx = s * (w / 2 + 0.151), a = V(gx, H - 0.02, 0.15), b = V(gx, H - 0.02, -d - 0.15), c = V(gx, yR - 0.1, -d / 2);
    if (s > 0) B.tri(white, a, b, c); else B.tri(white, b, a, c);
    B.cyl(mats.plasterDark, 0.3, 0.05, gx, H + (yR - H) * 0.36, -d / 2, 14, 1, 0, 0, Math.PI / 2);
    B.cyl(white, 0.2, 0.07, gx, H + (yR - H) * 0.36, -d / 2, 14, 1, 0, 0, Math.PI / 2);
  }
  if (r() < 0.6) { // escalera de mano apoyada
    const lx = (r() < 0.5 ? -1 : 1) * (w * 0.27 + 0.85);
    for (const s of [-0.2, 0.2]) B.rod(P.wood2, 0.03, V(lx + s, 0, 1.15), V(lx + s, wy - 0.3, 0.14), 5);
    for (let t = 0.1; t < 0.97; t += 0.1) B.box(P.wood2, 0.44, 0.03, 0.04, lx, t * (wy - 0.3), 1.15 - t * 1.01);
  }
  B.anchor('lantern', -dw / 2 - 0.45, pl + dh + 0.2, 0.6); B.anchor('sign', 0, pl + dh + 1.3, 0.1, 1.2, 0.5);
  return B.finish('storehouse', { w, h: yR + 0.3, d });
}
