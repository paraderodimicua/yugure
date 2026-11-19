// Casas urbanas (machiya) y tiendas, con las piezas compartidas de fachada e interior.
import * as THREE from 'three';
import type { Mats } from '../../render/materials';
import { Builder, KEN, Palette, Rnd, cached, cylGeo, gableRoof, palette, pick, rafters, range, rng, roofSheet } from './core';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------------------------
/** celosía de listones verticales (koshi) con travesaños por detrás */
export function koshi(B: Builder, mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z: number,
  gap = 0.07, bar = 0.028, dep = 0.035, rails = 2, r?: Rnd) {
  const n = Math.max(1, Math.floor((x1 - x0) / gap)), st = (x1 - x0) / n, h = y1 - y0;
  for (let i = 0; i < n; i++) {
    if (r && r() < 0.025) continue; // algún listón perdido
    B.box(mat, bar, h, dep, x0 + (i + 0.5) * st, y0 + h / 2, z);
  }
  for (let k = 0; k < rails; k++)
    B.box(mat, x1 - x0, 0.032, 0.02, (x0 + x1) / 2, y0 + ((k + 1) / (rails + 1)) * h, z - dep / 2 - 0.008);
}

/** hoja de shoji: papel + bastidor + kumiko */
export function shojiLeaf(B: Builder, P: Palette, x0: number, x1: number, y0: number, y1: number, z: number, paper: THREE.Material, base = 0) {
  const w = x1 - x0, h = y1 - y0, xc = (x0 + x1) / 2, yc = (y0 + y1) / 2, f = 0.04;
  B.box(paper, w - f, h - f, 0.008, xc, yc, z - 0.008);
  B.box(P.wood2, f, h, 0.03, x0 + f / 2, yc, z); B.box(P.wood2, f, h, 0.03, x1 - f / 2, yc, z);
  B.box(P.wood2, w, f, 0.03, xc, y1 - f / 2, z); B.box(P.wood2, w, f * 1.5, 0.03, xc, y0 + f * 0.75, z);
  let yb = y0 + f * 1.5;
  if (base > 0) { B.box(P.wood2, w - f, base, 0.012, xc, yb + base / 2, z + 0.004); yb += base; B.box(P.wood2, w, 0.025, 0.028, xc, yb, z); }
  const nc = Math.max(1, Math.round(w / 0.3)), nr = Math.max(2, Math.round((y1 - yb) / 0.27));
  for (let i = 1; i < nc; i++) B.box(P.wood2, 0.012, y1 - yb, 0.014, x0 + (w * i) / nc, (y1 + yb) / 2, z + 0.002);
  for (let j = 1; j < nr; j++) B.box(P.wood2, w - f, 0.012, 0.014, xc, yb + ((y1 - yb) * j) / nr, z + 0.002);
}

const shadowGeo = () => cached('seatShadow', () => {
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.27, 0.3); s.lineTo(0.2, 0.5); s.lineTo(0.07, 0.56);
  s.absarc(0, 0.68, 0.115, -Math.PI / 2 + 0.6, Math.PI * 1.5 - 0.6, false);
  s.lineTo(-0.07, 0.56); s.lineTo(-0.2, 0.5); s.lineTo(-0.27, 0.3); s.closePath();
  return new THREE.ShapeGeometry(s, 5);
});
/** sombra de persona sentada sobre el papel iluminado */
export function paperShadow(B: Builder, P: Palette, x: number, y: number, z: number, s = 1, mirror = false) {
  B.geo(P.shade, shadowGeo(), x, y, z, 0, 0, 0, mirror ? -s : s, s, 1);
  B.noReceive(P.shade);
}

/** persona sentada en seiza, silueta oscura; mira hacia (sin ry, cos ry) */
export function seated(B: Builder, mat: THREE.Material, x: number, y: number, z: number, ry: number) {
  const sx = Math.sin(ry), cz = Math.cos(ry);
  B.box(mat, 0.44, 0.2, 0.52, x + sx * 0.06, y + 0.1, z + cz * 0.06, ry);
  B.cyl(mat, 0.2, 0.46, x, y + 0.42, z, 7, 0.7);
  B.sphere(mat, 0.115, x + sx * 0.02, y + 0.78, z + cz * 0.02, 1.12, 8, 6);
  B.sphere(mat, 0.055, x - sx * 0.09, y + 0.9, z - cz * 0.09, 1, 6, 4);
  for (const s of [-1, 1]) {
    const ox = cz * 0.2 * s, oz = -sx * 0.2 * s;
    B.rod(mat, 0.05, V(x + ox, y + 0.6, z + oz), V(x + ox * 0.8 + sx * 0.24, y + 0.3, z + oz * 0.8 + cz * 0.24), 5);
  }
}
/** persona de pie con kimono, silueta oscura */
export function standing(B: Builder, mat: THREE.Material, x: number, y: number, z: number, ry = 0) {
  B.cyl(mat, 0.21, 1.0, x, y + 0.5, z, 7, 0.72);
  B.cyl(mat, 0.2, 0.42, x, y + 1.2, z, 7, 0.85);
  B.sphere(mat, 0.115, x, y + 1.56, z, 1.12, 8, 6);
  B.sphere(mat, 0.06, x - Math.sin(ry) * 0.08, y + 1.69, z - Math.cos(ry) * 0.08, 1, 6, 4);
  for (const s of [-1, 1]) {
    const ox = Math.cos(ry) * 0.22 * s, oz = -Math.sin(ry) * 0.22 * s;
    B.rod(mat, 0.05, V(x + ox, y + 1.36, z + oz), V(x + ox + Math.sin(ry) * 0.2, y + 0.98, z + oz + Math.cos(ry) * 0.2), 5);
  }
}

/** lámpara andon de pie */
export function andon(B: Builder, P: Palette, x: number, y: number, z: number, s = 1) {
  B.box(P.lamp, 0.2 * s, 0.34 * s, 0.2 * s, x, y + 0.3 * s, z);
  for (const a of [-1, 1]) for (const c of [-1, 1]) B.box(P.wood, 0.02, 0.5 * s, 0.02, x + a * 0.105 * s, y + 0.25 * s, z + c * 0.105 * s);
  B.box(P.wood, 0.24 * s, 0.02, 0.24 * s, x, y + 0.49 * s, z); B.box(P.wood, 0.24 * s, 0.03, 0.24 * s, x, y + 0.1 * s, z);
  B.noReceive(P.lamp);
}

/**
 * Habitación poco profunda detrás de una abertura: paredes bañadas por la lámpara, tatami,
 * mesa baja, cojines, lámpara, estantes o rollo colgado y, a veces, alguien sentado.
 */
export function room(B: Builder, P: Palette, x0: number, x1: number, y0: number, y1: number, zf: number, depth: number, r: Rnd,
  o: { figure?: number; bare?: boolean } = {}) {
  const zb = zf - depth, w = x1 - x0, xc = (x0 + x1) / 2;
  B.quad(P.wallLit, V(x0, y0, zb), V(x1, y0, zb), V(x1, y1, zb), V(x0, y1, zb));
  B.quad(P.wallLit, V(x0, y0, zf), V(x0, y0, zb), V(x0, y1, zb), V(x0, y1, zf));
  B.quad(P.wallLit, V(x1, y0, zb), V(x1, y0, zf), V(x1, y1, zf), V(x1, y1, zb));
  B.quad(P.floorLit, V(x0, y0, zf), V(x1, y0, zf), V(x1, y0, zb), V(x0, y0, zb));
  B.quad(P.wood, V(x0, y1, zb), V(x1, y1, zb), V(x1, y1, zf), V(x0, y1, zf));
  B.noReceive(P.wallLit, P.floorLit);
  // juntas del tatami y estructura vista del fondo
  B.box(P.dark, 0.035, 0.006, depth, xc + range(r, -0.25, 0.25) * w, y0 + 0.004, zf - depth / 2);
  B.box(P.dark, w, 0.006, 0.035, xc, y0 + 0.004, zf - depth * 0.55);
  B.box(P.wood, w, 0.07, 0.03, xc, Math.min(y1 - 0.25, y0 + 1.8), zb + 0.015);
  const px = xc + range(r, -0.3, 0.3) * w;
  B.box(P.wood, 0.09, y1 - y0, 0.05, px, (y0 + y1) / 2, zb + 0.025);
  if (o.bare) return;
  // fondo: rollo colgado (tokonoma) o estantes escalonados
  const side = px > xc ? -1 : 1, bx = px + side * Math.min(0.55, w * 0.28);
  if (r() < 0.5) {
    B.box(P.paper, 0.3, 0.9, 0.01, bx, y0 + 1.18, zb + 0.02);
    B.box(P.dark, 0.06, 0.34, 0.004, bx + 0.02, y0 + 1.25, zb + 0.028, 0, 0, 0.15);
    B.box(P.dark, 0.14, 0.03, 0.004, bx - 0.02, y0 + 1.02, zb + 0.028, 0, 0, -0.2);
    B.box(P.wood, 0.36, 0.03, 0.03, bx, y0 + 0.72, zb + 0.03); B.box(P.wood, 0.34, 0.02, 0.02, bx, y0 + 1.64, zb + 0.03);
    B.cyl(P.dark, 0.05, 0.16, bx - 0.3 * side, y0 + 0.08, zb + 0.2, 6, 0.6); // jarrón
  } else {
    for (let k = 0; k < 3; k++) {
      const sy = y0 + 0.55 + k * 0.38, sw = Math.min(0.9, w * 0.4) - k * 0.1;
      B.box(P.wood2, sw, 0.03, 0.24, bx + (k % 2 ? 0.1 : -0.1), sy, zb + 0.13);
      for (let q = 0; q < 3; q++) {
        const ox = bx + (q - 1) * sw * 0.3 + (k % 2 ? 0.1 : -0.1), kind = r();
        if (kind < 0.35) B.cyl(P.dark, 0.045, 0.14, ox, sy + 0.085, zb + 0.12, 6, 0.55);
        else if (kind < 0.7) B.box(P.cloth, 0.14, 0.1 + r() * 0.1, 0.14, ox, sy + 0.07, zb + 0.12, r());
        else B.box(P.paper, 0.05, 0.2, 0.15, ox, sy + 0.115, zb + 0.12, 0, 0, 0.08);
      }
    }
  }
  // mesa baja con tetera y cuencos
  const tx = xc + range(r, -0.12, 0.12) * w, tz = zf - depth * 0.52, ty = y0 + 0.32;
  B.box(P.wood2, 0.86, 0.035, 0.56, tx, ty, tz);
  for (const a of [-1, 1]) for (const c of [-1, 1]) B.box(P.wood2, 0.05, 0.3, 0.05, tx + a * 0.36, y0 + 0.15, tz + c * 0.22);
  B.sphere(P.dark, 0.075, tx + 0.12, ty + 0.08, tz, 0.8, 6, 4);
  B.cyl(P.paper, 0.03, 0.04, tx - 0.18, ty + 0.04, tz + 0.1, 6); B.cyl(P.paper, 0.03, 0.04, tx - 0.05, ty + 0.04, tz - 0.14, 6);
  // cojines zabuton
  B.box(P.cloth, 0.46, 0.06, 0.46, tx - 0.74, y0 + 0.035, tz + 0.05, r() * 0.3);
  B.box(P.cloth, 0.46, 0.06, 0.46, tx + 0.74, y0 + 0.035, tz - 0.02, -r() * 0.3);
  // lámpara: andon en el suelo o farol colgado
  if (r() < 0.5) andon(B, P, bx - side * 0.05 + (r() - 0.5) * 0.2, y0, zb + 0.34);
  else {
    B.cyl(P.lamp, 0.15, 0.2, tx, y1 - 0.5, tz, 8, 0.6); B.box(P.dark, 0.012, 0.4, 0.012, tx, y1 - 0.2, tz);
    B.noReceive(P.lamp);
  }
  if (r() < (o.figure ?? 0.6)) { const s = r() < 0.5 ? -1 : 1; seated(B, P.dark, tx + s * 0.74, y0 + 0.05, tz, -s * Math.PI / 2 + 0.3); }
}

/** barandilla entre dos puntos en planta; style 0 balaustres, 1 tablero calado, 2 solo travesaños */
export function railing(B: Builder, mat: THREE.Material, ax: number, az: number, bx: number, bz: number, y: number, h = 0.82, style = 0, panel?: THREE.Material) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
  const at = (t: number): [number, number] => [ax + dx * t, az + dz * t];
  const np = Math.max(1, Math.round(len / 0.95));
  for (let i = 0; i <= np; i++) { const [x, z] = at(i / np); B.box(mat, 0.07, h + 0.06, 0.07, x, y + h / 2 + 0.03, z, ry); }
  const [mx, mz] = at(0.5);
  B.box(mat, len + 0.16, 0.06, 0.09, mx, y + h, mz, ry);
  B.box(mat, len, 0.045, 0.05, mx, y + 0.14, mz, ry);
  B.box(mat, len, 0.04, 0.05, mx, y + h * 0.62, mz, ry);
  if (style === 0) {
    const n = Math.round(len / 0.13);
    for (let i = 1; i < n; i++) { const [x, z] = at(i / n); B.box(mat, 0.026, h * 0.62 - 0.14, 0.026, x, y + (h * 0.62 + 0.14) / 2, z, ry); }
  } else if (style === 1) {
    B.box(panel ?? mat, len - 0.04, h * 0.62 - 0.2, 0.016, mx, y + (h * 0.62 + 0.14) / 2, mz, ry);
  }
}

/** alero inferior de teja (hisashi) adosado a una pared en zWall, que vuela hacia +Z */
export function hisashi(B: Builder, P: Palette, x0: number, x1: number, yWall: number, zWall: number, out = 0.95, pitch = 0.29, posts: number[] = []) {
  const len = x1 - x0 + 0.3, xc = (x0 + x1) / 2, tan = Math.tan(pitch);
  const so = { wTop: len, wBot: len, run: out, rise: out * tan, row: 0.5, skirt: 0.06 };
  B.geo(P.tile, roofSheet(so), xc, yWall, zWall);
  B.geo(P.wood, roofSheet({ ...so, flat: true, flip: true, skirt: 0 }), xc, yWall - 0.075, zWall);
  rafters(B, P.wood, x0 - 0.1, x1 + 0.1, yWall - 0.11, zWall, out - 0.04, pitch, 1, 0.3, 0.05);
  const sl = out / Math.cos(pitch);
  for (const s of [-1, 1]) {
    B.box(P.wood, 0.04, 0.17, sl, xc + s * len / 2, yWall - (out * tan) / 2 - 0.05, zWall + out / 2, 0, pitch);
    B.box(P.tile, 0.14, 0.09, sl, xc + s * (len / 2 - 0.06), yWall - (out * tan) / 2 + 0.06, zWall + out / 2, 0, pitch);
  }
  B.box(P.wood, len, 0.045, 0.09, xc, yWall - out * tan - 0.045, zWall + out - 0.04, 0, pitch);
  const bz = zWall + out - 0.24, by = yWall - (out - 0.24) * tan - 0.2;
  B.box(P.wood, len - 0.1, 0.1, 0.09, xc, by, bz);
  B.box(P.tile, len, 0.11, 0.13, xc, yWall + 0.04, zWall + 0.06);
  for (const px of posts) {
    B.box(P.wood, 0.08, 0.1, out - 0.2, px, by - 0.1, zWall + (out - 0.2) / 2);
    B.box(P.wood, 0.06, 0.07, 0.62, px, by - 0.36, zWall + 0.2, 0, -0.85);
  }
  B.platform(x0 - 0.15, yWall - out * tan, zWall, x1 + 0.15, yWall + 0.05, zWall + out, { axis: 'z', dir: 1 });
}

/** canalón de cobre bajo el alero y bajante */
export function gutter(B: Builder, mat: THREE.Material, x0: number, x1: number, y: number, z: number, downX: number, zWall: number, yGround: number) {
  B.geo(mat, cylGeo(6), (x0 + x1) / 2, y, z, 0, 0, Math.PI / 2, 0.055, x1 - x0, 0.055);
  for (let x = x0 + 0.4; x < x1; x += 0.9) B.box(mat, 0.02, 0.1, 0.14, x, y + 0.03, z - 0.04);
  B.rod(mat, 0.035, V(downX, y - 0.02, z), V(downX, y - 0.5, zWall + 0.07), 5);
  B.rod(mat, 0.035, V(downX, y - 0.5, zWall + 0.07), V(downX, yGround + 0.1, zWall + 0.07), 5);
  for (let yy = y - 1; yy > yGround + 0.3; yy -= 1.4) B.box(mat, 0.1, 0.03, 0.1, downX, yy, zWall + 0.06);
}

// ---------------------------------------------------------------------------------------------
// Machiya y tienda
// ---------------------------------------------------------------------------------------------
export type HouseOpts = {
  seed?: number;
  /** plantas (1-3) */
  floors?: number;
  /** anchura en módulos ken (1,82 m) */
  bays?: number;
  depth?: number;
  /** probabilidad de ventana iluminada 0..1 */
  lit?: number;
};
export type ShopOpts = HouseOpts & { kind?: 'izakaya' | 'store' };

export function townhouse(mats: Mats, o: ShopOpts, shop: boolean): THREE.Group {
  const seed = o.seed ?? 1, r = rng(seed * 7 + (shop ? 131 : 0));
  const P = palette(mats, r);
  if (r() < 0.18) P.wood = mats.woodRed; // bengara
  const B = new Builder();
  const floors = Math.max(1, Math.min(3, o.floors ?? pick(r, [1, 2, 2, 2, 3])));
  const bays = Math.max(2, Math.min(5, o.bays ?? pick(r, [2, 3, 3, 4])));
  const w = bays * KEN, d = o.depth ?? range(r, 4.6, 6.2), litP = o.lit ?? 0.6;
  const xL = -w / 2, pl = 0.2 + r() * 0.1, kam = pl + 1.95, h1 = 2.8 + pl * 0.5;
  type Up = { y0: number; h: number; type: 'mushiko' | 'shoji' | 'balcony' };
  const ups: Up[] = [];
  let yT = h1;
  for (let f = 2; f <= floors; f++) {
    const type = f === 2 && floors === 2 ? pick(r, ['mushiko', 'shoji', 'shoji', 'balcony'] as const) : pick(r, ['shoji', 'balcony', 'shoji'] as const);
    const h = type === 'mushiko' ? 1.85 : 2.35;
    ups.push({ y0: yT, h, type }); yT += h;
  }
  if (floors === 1) yT = h1 + 0.2;
  const postX = Array.from({ length: bays + 1 }, (_, i) => xL + i * KEN);
  const lit = () => r() < litP;

  // --- zócalo de piedra y estructura ---
  for (let x = xL - 0.1; x < -xL;) {
    const sw = Math.min(range(r, 0.5, 1.0), -xL + 0.1 - x);
    B.stone(r() < 0.25 ? mats.stoneMoss : P.stone, sw - 0.012, pl, 0.34, x + sw / 2, pl / 2, -0.06, 0, 0, 0.03, r, 0.01);
    x += sw;
  }
  B.box(P.stone, w + 0.1, pl, d - 0.3, 0, pl / 2 - 0.01, -d / 2 - 0.1);
  for (const px of postX) B.box(P.wood, 0.13, yT - pl, 0.13, px, (yT + pl) / 2, -0.065);
  B.box(P.wood, w + 0.14, 0.2, 0.15, 0, h1 - 0.1, -0.06);
  B.box(P.wood, w + 0.3, 0.16, 0.16, 0, yT - 0.08, -0.06);
  // muros laterales y trasero: yeso arriba, tabla quemada con tapajuntas abajo
  const boardH = Math.min(yT - pl, range(r, 1.6, 2.6));
  for (const s of [-1, 1]) {
    const wx = s * (w / 2 - 0.03);
    B.box(P.plaster, 0.1, yT - pl, d, wx, (yT + pl) / 2, -d / 2);
    B.box(P.wood, 0.03, boardH, d + 0.02, wx + s * 0.06, pl + boardH / 2, -d / 2);
    for (let z = -0.25; z > -d; z -= 0.42) B.box(P.wood, 0.025, boardH, 0.045, wx + s * 0.085, pl + boardH / 2, z);
    B.box(P.wood, 0.05, 0.07, d + 0.04, wx + s * 0.08, pl + boardH, -d / 2);
    for (const z of [-d / 2, -d + 0.065]) B.box(P.wood, 0.05, yT - pl, 0.13, wx + s * 0.05, (yT + pl) / 2, z);
    for (const up of ups) B.box(P.wood, 0.05, 0.16, d, wx + s * 0.05, up.y0 - 0.08, -d / 2);
  }
  B.box(P.plaster, w, yT - pl, 0.1, 0, (yT + pl) / 2, -d + 0.05);
  B.box(P.wood, w + 0.02, boardH * 0.6, 0.03, 0, pl + boardH * 0.3, -d - 0.01);
  for (let f = 0; f < floors; f++) { // ventanas traseras sencillas
    const by = f === 0 ? pl + 1.0 : ups[f - 1].y0 + 0.7, bx = range(r, -0.3, 0.3) * w;
    B.box(P.wood, 1.3, 1.0, 0.04, bx, by + 0.5, -d - 0.02);
    B.box(lit() ? P.paperLit : P.paper, 1.18, 0.88, 0.02, bx, by + 0.5, -d - 0.04);
    B.box(P.wood, 0.03, 0.9, 0.03, bx, by + 0.5, -d - 0.05); B.box(P.wood, 1.2, 0.03, 0.03, bx, by + 0.5, -d - 0.05);
  }
  B.noShadow(P.paper).noReceive(P.paperLit);

  // --- planta baja ---
  const wainscot = (xa: number, xb: number, y0: number, y1: number, z = -0.09) => {
    B.box(P.wood, xb - xa, y1 - y0, 0.03, (xa + xb) / 2, (y0 + y1) / 2, z);
    for (let x = xa + 0.1; x < xb; x += 0.3) B.box(P.wood, 0.03, y1 - y0, 0.02, x, (y0 + y1) / 2, z + 0.022);
    B.box(P.wood, xb - xa, 0.05, 0.06, (xa + xb) / 2, y1, z + 0.02);
    if (r() < 0.3) B.box(P.wood2, 0.34, 0.26, 0.015, range(r, xa + 0.2, xb - 0.2), y0 + 0.25, z + 0.036, 0, 0, range(r, -0.06, 0.06)); // parche
  };
  const shojiPair = (xa: number, xb: number, y0: number, y1: number, z: number, state: 'lit' | 'dark' | 'open', base = 0) => {
    const lw = (xb - xa) / 2 + 0.02, paper = state === 'dark' ? P.paper : P.paperLit;
    if (state === 'open') {
      const sideL = r() < 0.5, off = lw * range(r, 0.55, 0.9);
      if (sideL) { shojiLeaf(B, P, xb - lw, xb, y0, y1, z, paper, base); shojiLeaf(B, P, xa + off, xa + off + lw - 0.02, y0, y1, z - 0.035, paper, base); }
      else { shojiLeaf(B, P, xa, xa + lw, y0, y1, z, paper, base); shojiLeaf(B, P, xb - off - lw + 0.02, xb - off, y0, y1, z - 0.035, paper, base); }
    } else {
      shojiLeaf(B, P, xa, xa + lw, y0, y1, z, paper, base); shojiLeaf(B, P, xb - lw, xb, y0, y1, z - 0.035, paper, base);
      if (state === 'lit' && r() < 0.4) paperShadow(B, P, range(r, xa + 0.4, xb - 0.4), y0 + 0.08 + base, z - 0.002, range(r, 0.95, 1.15), r() < 0.5);
    }
  };
  const doorLeaf = (x0: number, x1: number, z: number, paper: THREE.Material) => {
    const y0 = pl + 0.02, lw = x1 - x0, xc = (x0 + x1) / 2;
    B.box(P.wood, 0.05, kam - y0, 0.035, x0 + 0.025, (kam + y0) / 2, z); B.box(P.wood, 0.05, kam - y0, 0.035, x1 - 0.025, (kam + y0) / 2, z);
    B.box(P.wood, lw, 0.06, 0.035, xc, kam - 0.03, z); B.box(P.wood, lw, 0.09, 0.035, xc, y0 + 0.045, z); B.box(P.wood, lw, 0.05, 0.035, xc, y0 + 0.7, z);
    B.box(P.wood, lw - 0.1, 0.6, 0.014, xc, y0 + 0.39, z - 0.004);
    koshi(B, P.wood, x0 + 0.05, x1 - 0.05, y0 + 0.725, kam - 0.06, z, 0.065, 0.022, 0.028, 2);
    B.box(paper, lw - 0.1, kam - y0 - 0.8, 0.006, xc, (kam + y0 + 0.7) / 2, z - 0.024);
  };
  const lintel = (xa: number, xb: number) => {
    B.box(P.wood, xb - xa, 0.09, 0.12, (xa + xb) / 2, kam + 0.045, -0.06);
    const th = h1 - 0.2 - kam - 0.09; // banda sobre el dintel
    B.box(P.plaster, xb - xa, th, 0.05, (xa + xb) / 2, kam + 0.09 + th / 2, -0.09);
    if (r() < 0.35) koshi(B, P.wood, xa + 0.2, xb - 0.2, kam + 0.14, kam + 0.05 + th, -0.05, 0.05, 0.018, 0.02, 0);
  };

  const gTypes: string[] = [];
  if (shop) {
    const closed = bays >= 3 && r() < 0.6 ? (r() < 0.5 ? 0 : bays - 1) : -1;
    for (let i = 0; i < bays; i++) gTypes.push(i === closed ? pick(r, ['degoshi', 'wall']) : 'shop');
  } else {
    const di = Math.floor(r() * bays);
    for (let i = 0; i < bays; i++) gTypes.push(i === di ? 'door' : pick(r, ['degoshi', 'degoshi', 'open', 'wall', 'shoji']));
    if (!gTypes.includes('open') && !gTypes.includes('shoji') && bays > 1) gTypes[(di + 1) % bays] = 'open';
  }
  for (let i = 0; i < bays; i++) {
    const xa = postX[i] + 0.065, xb = postX[i + 1] - 0.065, xc = (xa + xb) / 2, bw = xb - xa, t = gTypes[i];
    if (t !== 'shop') lintel(xa, xb);
    if (t === 'door') {
      const open = r() < 0.55, paper = lit() || open ? P.paperLit : P.paper;
      const off = open ? bw * range(r, 0.2, 0.42) : 0;
      doorLeaf(xa, xc + 0.02, -0.05, paper); doorLeaf(xc - 0.02 - off, xb - off, -0.09, paper);
      if (open) room(B, P, xa, xb, pl, kam, -0.14, 1.5, r, { figure: 0.25 });
      B.box(P.wood, bw, 0.05, 0.14, xc, pl + 0.01, -0.06);
      B.stone(P.stone, range(r, 0.9, 1.2), 0.14, 0.5, xc + range(r, -0.1, 0.1), 0.07, 0.3, range(r, -0.08, 0.08), 0, 0.04, r, 0.02);
      B.anchor('noren', xc, kam, 0.03, bw - 0.1, 0.5);
      B.anchor('lantern', xa - 0.065, kam - 0.15, 0.3);
    } else if (t === 'degoshi') {
      // celosía volada (degoshi) con papel detrás
      const y0 = pl + range(r, 0.42, 0.6), zo = 0.15, fine = r() < 0.5;
      wainscot(xa, xb, pl, y0);
      B.box(P.wood, bw + 0.04, 0.07, zo + 0.08, xc, y0, zo / 2); B.box(P.wood, bw + 0.04, 0.06, zo + 0.08, xc, kam - 0.03, zo / 2);
      for (const s of [-1, 1]) { B.box(P.wood, 0.05, kam - y0, 0.05, xc + s * (bw / 2 - 0.01), (kam + y0) / 2, zo); B.box(P.wood, 0.02, kam - y0, zo, xc + s * (bw / 2), (kam + y0) / 2, zo / 2); }
      koshi(B, P.wood, xa + 0.04, xb - 0.04, y0 + 0.035, kam - 0.06, zo, fine ? 0.055 : 0.1, fine ? 0.02 : 0.04, 0.035, fine ? 3 : 2, r);
      B.box(lit() ? P.paperLit : P.paper, bw, kam - y0, 0.01, xc, (kam + y0) / 2, -0.04);
      for (const s of [-0.7, 0.7]) B.box(P.wood, 0.05, 0.14, zo, xc + s * bw / 2, y0 - 0.1, zo / 2, 0, 0.5);
      if (r() < 0.45) { // inuyarai: protector curvo de bambú
        for (let x = xa + 0.05; x < xb; x += 0.085) B.box(P.wood2, 0.035, 0.75, 0.012, x, 0.36, 0.26, 0, -0.5);
        B.box(P.wood2, bw, 0.03, 0.02, xc, 0.4, 0.27); B.box(P.wood2, bw, 0.03, 0.02, xc, 0.12, 0.41);
      }
    } else if (t === 'open' || t === 'shoji') {
      const y0 = pl + 0.5, state = t === 'open' ? 'open' : (lit() ? 'lit' : 'dark');
      wainscot(xa, xb, pl, y0);
      B.box(P.wood, bw, 0.05, 0.13, xc, y0 + 0.02, -0.055);
      shojiPair(xa, xb, y0 + 0.045, kam, -0.04, state);
      if (state === 'open') room(B, P, xa, xb, pl + 0.12, kam, -0.1, 1.7, r);
    } else if (t === 'wall') {
      wainscot(xa, xb, pl, pl + 0.95);
      B.box(P.plaster, bw, kam - pl - 0.95, 0.05, xc, (kam + pl + 0.95) / 2, -0.09);
      if (r() < 0.6) { // ventanuco con barrotes
        B.box(P.wood, 0.7, 0.55, 0.04, xc, pl + 1.5, -0.06); B.box(lit() ? P.paperLit : P.dark, 0.6, 0.45, 0.02, xc, pl + 1.5, -0.055);
        koshi(B, P.wood, xc - 0.3, xc + 0.3, pl + 1.28, pl + 1.72, -0.035, 0.085, 0.03, 0.03, 0);
      }
      if (r() < 0.5) { // banco abatible (battari shogi)
        B.box(P.wood2, bw * 0.75, 0.04, 0.42, xc, 0.44, 0.2); for (const s of [-1, 1]) B.box(P.wood2, 0.05, 0.42, 0.05, xc + s * bw * 0.32, 0.21, 0.36);
        B.platform(xc - bw * 0.37, 0, 0, xc + bw * 0.37, 0.46, 0.41);
      }
    }
  }
  if (shop) shopFront(B, P, mats, r, postX, gTypes, pl, kam, h1, o.kind ?? pick(r, ['izakaya', 'store'] as const));

  // --- alero inferior ---
  if (floors > 1) {
    hisashi(B, P, xL, -xL, h1 + 0.28, 0, range(r, 0.9, 1.1), 0.29, postX);
    B.anchor('sign', 0, h1 + 0.75, 0.7, Math.min(2.2, w * 0.5), 0.6);
  }
  B.anchor('signV', xL - 0.05, h1 - 0.9, 0.45, 0.4, 1.4);
  for (const px of postX) B.anchor('lantern', px, floors > 1 ? h1 - 0.25 : kam + 0.2, 0.6);

  // --- plantas altas ---
  ups.forEach((up, k) => {
    const { y0, h, type } = up, yTop = y0 + h - 0.16;
    if (k > 0) hisashi(B, P, xL, -xL, y0 + 0.2, 0, 0.6, 0.3, postX);
    const base = y0 + (k === 0 ? 0.42 : 0.34); // por encima del alero
    if (type === 'mushiko') {
      B.box(P.plaster, w, h, 0.07, 0, y0 + h / 2, -0.08);
      for (let i = 0; i < bays; i++) {
        const xc = (postX[i] + postX[i + 1]) / 2, mw = KEN - 0.62, my = y0 + 0.82, mh = 0.62;
        B.box(lit() ? P.paperLit : P.dark, mw, mh, 0.02, xc, my + mh / 2, -0.04);
        for (let x = xc - mw / 2 + 0.07; x < xc + mw / 2; x += 0.15) B.box(P.plaster, 0.075, mh, 0.07, x, my + mh / 2, -0.02);
        B.box(P.plaster, mw + 0.12, 0.07, 0.09, xc, my - 0.03, -0.01); B.box(P.plaster, mw + 0.12, 0.07, 0.09, xc, my + mh + 0.03, -0.01);
        for (const s of [-1, 1]) B.box(P.plaster, 0.07, mh + 0.13, 0.09, xc + s * (mw / 2 + 0.03), my + mh / 2, -0.01);
      }
    } else {
      B.box(P.wood, w, 0.1, 0.13, 0, base, -0.06);
      B.box(P.wood, w, 0.09, 0.13, 0, yTop - 0.3, -0.06);
      B.box(P.plaster, w, 0.3, 0.05, 0, yTop - 0.12, -0.09);
      B.box(P.plaster, w, base - y0, 0.05, 0, (base + y0) / 2, -0.09);
      for (let i = 0; i < bays; i++) {
        const xa = postX[i] + 0.065, xb = postX[i + 1] - 0.065;
        const q = r(), state = q < 0.3 ? 'open' : (lit() ? 'lit' : 'dark');
        shojiPair(xa, xb, base + 0.05, yTop - 0.345, -0.04, state, type === 'balcony' ? 0.3 : 0);
        if (state === 'open') room(B, P, xa, xb, base - 0.02, yTop - 0.3, -0.1, 1.7, r);
        if (r() < 0.22) { // estor sudare torcido
          const sh = range(r, 0.6, 1.1);
          B.box(mats.straw, xb - xa - 0.1, sh, 0.015, (xa + xb) / 2, yTop - 0.36 - sh / 2, 0.03, 0, 0.03, range(r, -0.025, 0.025));
          B.box(P.wood2, xb - xa - 0.06, 0.035, 0.03, (xa + xb) / 2, yTop - 0.36 - sh, 0.035);
        }
      }
      if (type === 'balcony') {
        const out = 0.85, by = base + 0.02;
        B.box(P.wood2, w + 0.2, 0.05, out, 0, by, out / 2);
        for (let x = xL; x <= -xL + 0.01; x += KEN / 2) B.box(P.wood, 0.07, 0.1, out, x, by - 0.07, out / 2);
        B.box(P.wood, w + 0.24, 0.1, 0.08, 0, by - 0.07, out - 0.04);
        const st = Math.floor(r() * 3);
        railing(B, P.wood, xL - 0.06, out - 0.05, -xL + 0.06, out - 0.05, by + 0.02, 0.85, st, P.wood2);
        railing(B, P.wood, xL - 0.06, 0.05, xL - 0.06, out - 0.05, by + 0.02, 0.85, 2);
        railing(B, P.wood, -xL + 0.06, 0.05, -xL + 0.06, out - 0.05, by + 0.02, 0.85, 2);
        B.platform(xL - 0.1, by - 0.1, 0, -xL + 0.1, by + 0.03, out);
      } else {
        // pasamanos bajo ante el shoji
        railing(B, P.wood, xL + 0.05, 0.1, -xL - 0.05, 0.1, base + 0.02, 0.62, r() < 0.5 ? 0 : 2);
      }
    }
  });

  // --- tejado principal ---
  const pitch = Math.atan(range(r, 0.4, 0.5)), ovF = range(r, 0.8, 1.0), ovB = 0.45;
  const yR = yT + 0.16 + (d / 2) * Math.tan(pitch), len = w + 0.5;
  gableRoof(B, P, { len, y: yR, z: -d / 2, runF: d / 2 + ovF, runB: d / 2 + ovB, pitch, sag: 0.05 });
  rafters(B, P.wood, xL, -xL, yT + 0.06, 0, ovF - 0.04, pitch, 1, 0.3);
  rafters(B, P.wood, xL, -xL, yT + 0.06, -d, ovB - 0.04, pitch, -1, 0.45);
  for (const s of [-1, 1]) {
    const gx = s * (w / 2 + 0.021), a = V(gx, yT - 0.02, 0.02), b = V(gx, yT - 0.02, -d - 0.02), c = V(gx, yR - 0.12, -d / 2);
    if (s > 0) B.tri(P.plaster, a, b, c); else B.tri(P.plaster, b, a, c);
    B.box(P.wood, 0.04, 0.3, 0.34, gx + s * 0.01, yR - 0.7, -d / 2);             // respiradero
    B.box(P.wood, 0.05, yR - yT - 0.3, 0.1, gx + s * 0.005, (yR + yT) / 2 - 0.2, -d / 2); // pendolón
    B.box(P.wood, 0.05, 0.12, d, gx + s * 0.005, yT - 0.02, -d / 2);
    B.box(P.wood, 0.07, 0.34, 0.2, s * (len / 2 + 0.03), yR - 0.32, -d / 2);      // gegyo
  }
  const eY = yT + 0.16 - ovF * Math.tan(pitch);
  gutter(B, mats.metalRust, -len / 2 + 0.05, len / 2 - 0.05, eY - 0.1, ovF + 0.05, (r() < 0.5 ? -1 : 1) * (w / 2 + 0.12), 0, 0);
  if (r() < 0.35) { // linterna de humos sobre la cumbrera
    const vx = range(r, -0.25, 0.25) * w;
    B.box(P.wood, 1.0, 0.36, 0.7, vx, yR + 0.3, -d / 2);
    koshi(B, P.wood2, vx - 0.45, vx + 0.45, yR + 0.16, yR + 0.46, -d / 2 + 0.36, 0.09, 0.03, 0.02, 0);
    gableRoof(B, P, { len: 1.4, x: vx, y: yR + 0.72, z: -d / 2, runF: 0.6, runB: 0.6, pitch: 0.42, oni: false, platforms: false, row: 0.4 });
  }
  return B.finish(shop ? 'shop' : 'machiya', { w, h: yR + 0.3, d });
}

/** frente abierto de tienda: sala, mostrador, estantes con género, toldo */
function shopFront(B: Builder, P: Palette, mats: Mats, r: Rnd, postX: number[], gTypes: string[], pl: number, kam: number, h1: number, kind: 'izakaya' | 'store') {
  const idx = gTypes.map((t, i) => (t === 'shop' ? i : -1)).filter((i) => i >= 0);
  const x0 = postX[idx[0]] + 0.065, x1 = postX[idx[idx.length - 1] + 1] - 0.065, xc = (x0 + x1) / 2, ow = x1 - x0, depth = 2.7;
  const top = h1 - 0.2;
  room(B, P, x0, x1, pl - 0.05, top, -0.13, depth, r, { bare: true });
  B.box(P.wood, ow, 0.12, 0.13, xc, kam + 0.3, -0.06); // viga del frente (noren debajo)
  B.box(P.plaster, ow, top - kam - 0.36, 0.05, xc, (top + kam + 0.36) / 2, -0.09);
  B.anchor('noren', xc, kam + 0.24, 0.04, ow - 0.2, 0.6);
  const goods = [mats.ceramic, P.cloth, mats.lacquerRed, P.wood2];
  const zb = -0.13 - depth;
  // estantería del fondo con género
  for (let k = 0; k < 4; k++) {
    const sy = pl + 0.45 + k * 0.42;
    B.box(P.wood2, ow - 0.3, 0.035, 0.3, xc, sy, zb + 0.17);
    for (let x = x0 + 0.3; x < x1 - 0.3; x += range(r, 0.16, 0.3)) {
      const m = pick(r, goods), q = r();
      if (q < 0.4) B.cyl(m, range(r, 0.045, 0.07), range(r, 0.16, 0.3), x, sy + 0.15, zb + 0.16, 6, q < 0.2 ? 0.4 : 0.85);
      else if (q < 0.75) B.box(m, range(r, 0.12, 0.2), range(r, 0.1, 0.22), 0.18, x, sy + 0.1, zb + 0.16, r() * 0.3);
      else B.sphere(m, 0.07, x, sy + 0.08, zb + 0.16, 0.85, 6, 4);
    }
  }
  for (let x = x0 + 0.15; x <= x1; x += (ow - 0.3) / 3) B.box(P.wood, 0.05, 1.9, 0.3, x, pl + 0.95, zb + 0.17);
  // faroles colgados sobre el mostrador
  for (let x = x0 + 0.7; x < x1 - 0.4; x += 1.25) { B.sphere(P.lamp, 0.13, x, top - 0.55, -0.9, 1.25, 8, 6); B.box(P.dark, 0.012, 0.4, 0.012, x, top - 0.2, -0.9); }
  B.noReceive(P.lamp);
  if (kind === 'izakaya') {
    // barra en L con tablero grueso, celosía baja y taburetes fuera
    const cw = ow * 0.7, cx = x0 + cw / 2 + 0.15, cz = -0.35;
    B.box(P.wood2, cw, 0.07, 0.5, cx, pl + 0.98, cz); B.box(P.wood, cw - 0.06, 0.92, 0.05, cx, pl + 0.48, cz + 0.16);
    for (let x = cx - cw / 2 + 0.1; x < cx + cw / 2; x += 0.22) B.box(P.wood2, 0.05, 0.84, 0.02, x, pl + 0.48, cz + 0.195);
    for (let x = cx - cw / 2 + 0.25; x < cx + cw / 2; x += 0.34) {
      const q = r();
      if (q < 0.45) B.cyl(pick(r, goods), 0.04, 0.24, x, pl + 1.135, cz - 0.05, 6, 0.4);
      else if (q < 0.75) B.cyl(mats.ceramic, 0.07, 0.05, x, pl + 1.04, cz + 0.05, 7, 1.3);
    }
    for (let x = cx - cw / 2 + 0.4; x < cx + cw / 2; x += 0.78) {
      const sx = x + range(r, -0.08, 0.08), sz = 0.42 + range(r, -0.08, 0.08);
      B.cyl(P.wood2, 0.17, 0.05, sx, 0.5, sz, 8); for (let a = 0; a < 3; a++) B.rod(P.wood, 0.02, V(sx + Math.cos(a * 2.1) * 0.08, 0.48, sz + Math.sin(a * 2.1) * 0.08), V(sx + Math.cos(a * 2.1) * 0.16, 0, sz + Math.sin(a * 2.1) * 0.16), 4);
    }
    standing(B, P.dark, cx + range(r, -0.5, 0.5), pl - 0.05, cz - 0.6, 0);
    if (r() < 0.6) seated(B, P.dark, cx - cw / 2 + 0.4, 0.5, 0.44, Math.PI);
    B.anchor('lantern', x1 - 0.2, kam + 0.1, 0.5); B.anchor('lantern', x0 + 0.2, kam + 0.1, 0.5);
  } else {
    // expositor inclinado con cajas de género y mostrador al fondo
    const n = Math.max(2, Math.floor(ow / 0.85));
    for (let i = 0; i < n; i++) {
      const bx = x0 + 0.5 + i * ((ow - 1) / Math.max(1, n - 1)), col = pick(r, [mats.tint('fabric', 0xd9772a), mats.tint('fabric', 0x9aa83a), mats.lacquerRed, mats.ceramic]);
      for (const [by, bz] of [[0.48, 0.28], [0.74, -0.2]] as const) {
        B.box(P.wood2, 0.72, 0.035, 0.46, bx, by, bz, 0, 0.22);
        for (const s of [-1, 1]) { B.box(P.wood2, 0.03, 0.12, 0.46, bx + s * 0.36, by + 0.05, bz, 0, 0.22); B.box(P.wood2, 0.72, 0.12, 0.03, bx, by + 0.05 - s * 0.05, bz + s * 0.225, 0, 0.22); }
        for (let a = 0; a < 3; a++) for (let c = 0; c < 2; c++) B.sphere(col, 0.085, bx - 0.22 + a * 0.22 + (r() - 0.5) * 0.04, by + 0.1 - (c - 0.5) * 0.09, bz + (c - 0.5) * 0.22, 0.9, 6, 4);
      }
      B.box(P.wood, 0.05, 0.5, 0.05, bx - 0.3, 0.24, 0.4); B.box(P.wood, 0.05, 0.5, 0.05, bx + 0.3, 0.24, 0.4);
      B.box(P.wood, 0.05, 0.74, 0.05, bx - 0.3, 0.37, -0.36); B.box(P.wood, 0.05, 0.74, 0.05, bx + 0.3, 0.37, -0.36);
    }
    B.box(P.wood2, 1.3, 0.06, 0.5, x1 - 0.9, pl + 0.8, -1.4); B.box(P.wood, 1.24, 0.78, 0.44, x1 - 0.9, pl + 0.39, -1.4);
    standing(B, P.dark, x1 - 0.9, pl - 0.05, -1.95, 0);
    // toldo de tela tensado sobre pértigas
    const ay = kam + 0.5, az = 0.75;
    B.quad(P.cloth, V(x0, ay - 0.42, az + 0.9), V(x1, ay - 0.42, az + 0.9), V(x1, ay, az - 0.2), V(x0, ay, az - 0.2));
    B.quad(P.cloth, V(x1, ay - 0.42, az + 0.9), V(x0, ay - 0.42, az + 0.9), V(x0, ay, az - 0.2), V(x1, ay, az - 0.2));
    B.box(P.cloth, ow, 0.2, 0.012, xc, ay - 0.52, az + 0.9);
    for (const x of [x0 + 0.03, x1 - 0.03]) B.rod(mats.bamboo, 0.025, V(x, 0, az + 0.95), V(x, ay - 0.4, az + 0.9), 5);
    B.rod(mats.bamboo, 0.022, V(x0, ay - 0.42, az + 0.9), V(x1, ay - 0.42, az + 0.9), 5);
  }
}
