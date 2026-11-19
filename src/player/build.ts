// Modelo del protagonista: esqueleto + UNA SkinnedMesh orgánica (5 grupos de material).
// El cuerpo sale de campos de distancia por músculo unidos con smooth-min y poligonizados al cargar (surface nets).
// Las únicas juntas entre piezas (cuello, muñecas, cintura, tobillos) quedan ocultas bajo bufanda, vendas, obi y polainas.
// Espacio de modelo = "espacio de pose": de pie, mirando a -Z, derecha = +X, origen en los pies, altura ≈ 1,675.
// El hueso raíz se escala por K en tiempo real → altura final ≈ 1,80 m.
import * as THREE from 'three';
import type { Mats } from '../render/materials';
import { clamp01, ell, polygonize, rbox, rc, smax, smin, type F3 } from './sdf';

export const BONE_NAMES = ['root', 'hips', 'spine', 'chest', 'neck', 'head',
  'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR',
  'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR',
  'eyes', 'lids', 'browL', 'browR', 'mouth'] as const;
export type BoneName = (typeof BONE_NAMES)[number];

const PARENT: Record<BoneName, BoneName | null> = {
  root: null, hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  armL: 'chest', foreL: 'armL', handL: 'foreL', armR: 'chest', foreR: 'armR', handR: 'foreR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', toeL: 'footL', thighR: 'hips', shinR: 'thighR', footR: 'shinR', toeR: 'footR',
  eyes: 'head', lids: 'head', browL: 'head', browR: 'head', mouth: 'head',
};

/** escala espacio de pose → metros */
export const K = 1.075;
export const L_UPPER = 0.27, L_FORE = 0.245, L_THIGH = 0.40, L_SHIN = 0.38;
export const HIP_Y = 0.90, ANKLE_H = 0.08, BALL_Z = 0.11, BALL_H = 0.03, HEEL_Z = 0.055;
const ARM_A = (35 * Math.PI) / 180; // pose A de enlace: axilas abiertas para que el hombro se doble limpio
const SH = [0.205, 1.335, 0.01], AD = [Math.sin(ARM_A), -Math.cos(ARM_A)], AN = [Math.cos(ARM_A), Math.sin(ARM_A)];
const EL = [SH[0] + AD[0] * L_UPPER, SH[1] + AD[1] * L_UPPER, SH[2]];
const WR = [EL[0] + AD[0] * L_FORE, EL[1] + AD[1] * L_FORE, SH[2]];

/** posiciones de reposo en espacio del modelo */
export const BIND: Record<BoneName, readonly [number, number, number]> = {
  root: [0, 0, 0], hips: [0, HIP_Y, 0], spine: [0, 1.02, 0], chest: [0, 1.16, 0], neck: [0, 1.40, 0.005], head: [0, 1.465, 0.005],
  armL: [-SH[0], SH[1], SH[2]], foreL: [-EL[0], EL[1], EL[2]], handL: [-WR[0], WR[1], WR[2]],
  armR: [SH[0], SH[1], SH[2]], foreR: [EL[0], EL[1], EL[2]], handR: [WR[0], WR[1], WR[2]],
  thighL: [-0.09, 0.86, 0], shinL: [-0.09, 0.46, 0], footL: [-0.09, ANKLE_H, 0], toeL: [-0.09, BALL_H, -BALL_Z],
  thighR: [0.09, 0.86, 0], shinR: [0.09, 0.46, 0], footR: [0.09, ANKLE_H, 0], toeR: [0.09, BALL_H, -BALL_Z],
  eyes: [0, 1.554, -0.093], lids: [0, 1.554, -0.093], browL: [-0.034, 1.577, -0.096], browR: [0.034, 1.577, -0.096], mouth: [0, 1.487, -0.1],
};
const ROTZ: Partial<Record<BoneName, number>> = { armL: -ARM_A, foreL: -ARM_A, handL: -ARM_A, armR: ARM_A, foreR: ARM_A, handR: ARM_A };
/** anclajes de la tela (espacio del modelo) */
export const SCARF_A: readonly [number, number, number] = [-0.04, 1.44, 0.075];
export const SCARF_B: readonly [number, number, number] = [0.035, 1.435, 0.078];
export const HEM = { y: 0.925, rx: 0.172, rz: 0.142, cz: 0.012, open: 0.62 };
export const COLORS = { haori: 0x2e4677, cream: 0xe4d9c3, pants: 0x34364a, red: 0xa8321f, skin: 0xd9a07f, hair: 0x231d2b };

// ───────────────────────── campos de distancia por pieza ─────────────────────────
/** torso + brazos (simétrico; brazo en pose A expresado en su propio marco u/v/w) */
const torsoF: F3 = (x, y, z) => {
  const ax = Math.abs(x);
  let d = ell(ax, y, z, 0, 1.235, 0.005, 0.145, 0.165, 0.115); // caja torácica
  d = smin(d, ell(ax, y, z, 0.075, 1.27, 0.058, 0.09, 0.1, 0.07), 0.04); // espalda alta / romboides
  d = smin(d, rc(ax, y, z, 0.168, 1.3, 0.042, 0.078, 1.04, 0.05, 0.06, 0.034), 0.05); // dorsales anchos (la V)
  d = smin(d, ell(ax, y, z, 0.098, 1.0, -0.005, 0.054, 0.095, 0.084), 0.05); // oblicuos
  d = smin(d, ell(ax, y, z, 0, 1.06, -0.02, 0.112, 0.13, 0.085), 0.03); // abdomen
  d = smin(d, ell(ax, y, z, 0, 0.93, 0.01, 0.142, 0.08, 0.105), 0.05); // pelvis
  d = smin(d, ell(ax, y, z, 0.073, 1.272, -0.066, 0.09, 0.063, 0.054), 0.018); // pectorales
  d = smin(d, ell(ax, y, z, 0.034, 1.158, -0.08, 0.031, 0.03, 0.024), 0.012); // abdominales
  d = smin(d, ell(ax, y, z, 0.034, 1.092, -0.084, 0.031, 0.029, 0.023), 0.012);
  d = smin(d, ell(ax, y, z, 0.033, 1.028, -0.082, 0.03, 0.029, 0.022), 0.012);
  d = smin(d, ell(ax, y, z, 0.03, 0.965, -0.072, 0.029, 0.04, 0.02), 0.015);
  d = smin(d, rc(ax, y, z, 0.03, 0.96, 0.07, 0.032, 1.22, 0.082, 0.03, 0.028), 0.02); // erectores
  d = smin(d, rc(ax, y, z, 0.015, 1.445, 0.035, 0.165, 1.368, 0.03, 0.043, 0.034), 0.04); // trapecio
  d = smin(d, rc(ax, y, z, 0, 1.32, 0.012, 0, 1.52, 0.005, 0.064, 0.05), 0.04); // cuello
  d = smin(d, rc(ax, y, z, 0.02, 1.377, -0.056, 0.16, 1.39, -0.02, 0.017, 0.02), 0.03); // clavículas
  const dx = ax - SH[0], dy = y - SH[1], w = z - SH[2];
  const u = dx * AD[0] + dy * AD[1], v = dx * AN[0] + dy * AN[1];
  let a = rc(u, v, w, -0.01, 0, 0, L_UPPER, 0, 0, 0.048, 0.038); // húmero
  a = smin(a, ell(u, v, w, 0.035, 0.014, 0, 0.1, 0.069, 0.075), 0.03); // deltoides
  a = smin(a, ell(u, v, w, 0.145, -0.004, -0.022, 0.085, 0.044, 0.046), 0.02); // bíceps
  a = smin(a, ell(u, v, w, 0.125, 0.006, 0.024, 0.1, 0.046, 0.044), 0.02); // tríceps
  a = smin(a, rc(u, v, w, L_UPPER, 0, 0, L_UPPER + L_FORE + 0.01, 0, 0, 0.046, 0.028), 0.025); // antebrazo
  a = smin(a, ell(u, v, w, L_UPPER + 0.07, 0.014, -0.008, 0.075, 0.042, 0.042), 0.025); // braquiorradial
  return smin(d, a, 0.035);
};
const armU = (x: number, y: number) => (Math.abs(x) - SH[0]) * AD[0] + (y - SH[1]) * AD[1];

const HC = [0, 1.575, 0.012];
const cranium: F3 = (x, y, z) => ell(x, y, z, HC[0], HC[1], HC[2], 0.088, 0.098, 0.1);
const headF: F3 = (x, y, z) => {
  const ax = Math.abs(x);
  let d = cranium(ax, y, z);
  d = smin(d, ell(ax, y, z, 0, 1.515, -0.022, 0.074, 0.075, 0.082), 0.03); // cara
  d = smin(d, rc(ax, y, z, 0.058, 1.5, 0.012, 0.021, 1.462, -0.058, 0.022, 0.016), 0.025); // mandíbula marcada
  d = smin(d, ell(ax, y, z, 0, 1.462, -0.066, 0.026, 0.022, 0.024), 0.02); // mentón
  d = smin(d, ell(ax, y, z, 0.048, 1.538, -0.064, 0.026, 0.018, 0.022), 0.02); // pómulos
  d = smin(d, rc(ax, y, z, 0, 1.556, -0.09, 0, 1.522, -0.103, 0.008, 0.008), 0.012); // nariz
  d = smin(d, rc(ax, y, z, 0.012, 1.571, -0.088, 0.056, 1.576, -0.077, 0.011, 0.008), 0.015); // arco superciliar
  d = smax(d, -ell(ax, y, z, 0.035, 1.553, -0.099, 0.022, 0.012, 0.012), 0.01); // cuencas
  d = smin(d, ell(ax, y, z, 0.088, 1.545, 0.012, 0.012, 0.026, 0.018), 0.01); // orejas
  return smin(d, rc(ax, y, z, 0, 1.415, 0.012, 0, 1.5, 0.02, 0.055, 0.046), 0.03); // cuello
};
const hairline = (y: number, z: number) => 0.85 * (y - 1.6) + 0.53 * (z + 0.075);
const capF: F3 = (x, y, z) => smax(cranium(x, y, z) - 0.013, -hairline(y, z), 0.012);

const pantsF: F3 = (x, y, z) => {
  const ax = Math.abs(x);
  let d = ell(ax, y, z, 0, 0.9, 0.012, 0.163, 0.105, 0.128);
  d = smin(d, ell(ax, y, z, 0.062, 0.85, 0.06, 0.08, 0.085, 0.07), 0.04); // glúteos
  d = smin(d, rc(ax, y, z, 0.1, 0.86, 0.005, 0.105, 0.47, -0.008, 0.102, 0.086), 0.06); // muslo amplio
  d = smin(d, rc(ax, y, z, 0.105, 0.47, -0.008, 0.1, 0.2, 0, 0.086, 0.074), 0.05); // pierna
  d = smin(d, rc(ax, y, z, 0.1, 0.2, 0, 0.1, 0.115, 0.005, 0.072, 0.048), 0.06); // recogido en el tobillo
  d = smin(d, ell(ax, y, z, 0, 0.7, 0, 0.07, 0.13, 0.085), 0.07); // tiro bajo
  const lo = clamp01((0.36 - y) / 0.2), th = clamp01((y - 0.4) / 0.15) * clamp01((0.85 - y) / 0.1);
  const ang = Math.atan2(z, ax - 0.1);
  return d + 0.0045 * lo * Math.sin(y * 58 + Math.sin(ang * 2) * 1.8) + 0.0035 * th * Math.sin(ang * 5 + y * 7);
};
/** pie con tabi, centrado en x = 0 */
const footF: F3 = (x, y, z) => {
  let d = ell(x, y, z, 0, 0.045, 0.025, 0.036, 0.042, 0.048);
  d = smin(d, rbox(x, y, z, 0, 0.033, -0.045, 0.037, 0.027, 0.06, 0.02), 0.03);
  d = smin(d, ell(x, y, z, 0.004, 0.022, -0.118, 0.045, 0.022, 0.042), 0.025);
  d = smin(d, rc(x, y, z, 0, 0.15, 0, 0, 0.06, 0.01, 0.042, 0.036), 0.03);
  return smax(d, -y, 0.01);
};
const legsF: F3 = (x, y, z) => Math.min(pantsF(x, y, z), footF(Math.abs(x) - 0.1, y, z));
/** puño derecho canónico: muñeca en el origen, dedos hacia -Y, palma hacia -X, pulgar hacia -Z */
const fistF: F3 = (x, y, z) => {
  let d = rbox(x, y, z, 0, -0.048, 0, 0.017, 0.042, 0.041, 0.013);
  d = smin(d, rc(x, y, z, 0, 0.03, 0, 0, -0.02, 0, 0.03, 0.028), 0.02);
  for (let i = 0; i < 4; i++) {
    const fz = -0.029 + i * 0.019, sy = i === 3 ? 0.008 : i === 0 ? 0.003 : 0, r = i === 3 ? 0.0095 : 0.011;
    let f = rc(x, y, z, 0.004, -0.088 + sy, fz, -0.006, -0.124 + sy, fz, r + 0.001, r);
    f = Math.min(f, rc(x, y, z, -0.006, -0.124 + sy, fz, -0.038, -0.116 + sy, fz, r, r - 0.001));
    f = Math.min(f, rc(x, y, z, -0.038, -0.116 + sy, fz, -0.041, -0.092 + sy, fz, r - 0.001, r - 0.002));
    d = smin(d, f, 0.006);
  }
  d = smin(d, rc(x, y, z, -0.012, -0.03, -0.034, -0.03, -0.068, -0.046, 0.0135, 0.012), 0.012); // pulgar
  return smin(d, rc(x, y, z, -0.03, -0.068, -0.046, -0.046, -0.098, -0.034, 0.012, 0.0105), 0.006);
};

// ───────────────────────── ensamblado ─────────────────────────
type G = 0 | 1 | 2 | 3 | 4; // piel, pelo, tela oscura, crema, rojo
const NB = BONE_NAMES.length;
const BI = {} as Record<BoneName, number>;
BONE_NAMES.forEach((n, i) => { BI[n] = i; });
const sideOf = (n: BoneName) => (n.endsWith('L') && n !== 'hips' ? -1 : n.endsWith('R') ? 1 : 0);
/** segmentos de hueso para el reparto de pesos: [a, b, radio] */
const SEG = {} as Record<BoneName, [number[], number[], number]>;
{
  const B = BIND;
  SEG.root = [[0, 0, 0], [0, 0, 0], 0];
  SEG.hips = [[0, 0.86, 0.01], [0, 1.0, 0.01], 0.11]; SEG.spine = [[0, 1.02, 0], [0, 1.14, 0], 0.12]; SEG.chest = [[0, 1.18, 0], [0, 1.37, 0.01], 0.13];
  SEG.neck = [[0, 1.4, 0.005], [0, 1.46, 0.005], 0.045]; SEG.head = [[0, 1.49, 0], [0, 1.63, 0], 0.08];
  for (const s of ['L', 'R'] as const) {
    const g = (n: string) => B[(n + s) as BoneName] as readonly number[], sg = s === 'L' ? -1 : 1;
    SEG[('arm' + s) as BoneName] = [[...g('arm')], [...g('fore')], 0.045];
    SEG[('fore' + s) as BoneName] = [[...g('fore')], [...g('hand')], 0.035];
    SEG[('hand' + s) as BoneName] = [[...g('hand')], [g('hand')[0] + sg * AD[0] * 0.1, g('hand')[1] + AD[1] * 0.1, g('hand')[2]], 0.03];
    SEG[('thigh' + s) as BoneName] = [[sg * 0.09, 0.86, 0], [sg * 0.09, 0.46, 0], 0.07];
    SEG[('shin' + s) as BoneName] = [[sg * 0.09, 0.46, 0], [sg * 0.09, 0.09, 0], 0.05];
    SEG[('foot' + s) as BoneName] = [[sg * 0.09, 0.08, 0], [sg * 0.09, 0.035, -0.1], 0.025];
    SEG[('toe' + s) as BoneName] = [[sg * 0.09, 0.03, -0.11], [sg * 0.09, 0.02, -0.16], 0.018];
  }
  for (const n of ['eyes', 'lids', 'browL', 'browR', 'mouth'] as BoneName[]) SEG[n] = [[0, 0, 0], [0, 0, 0], 0];
}
function segDist(n: BoneName, x: number, y: number, z: number) {
  const [a, b, r] = SEG[n];
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
  const L = bx * bx + by * by + bz * bz;
  const t = L > 0 ? clamp01((px * bx + py * by + pz * bz) / L) : 0;
  return Math.max(0, Math.hypot(px - bx * t, py - by * t, pz - bz * t) - r);
}

type Chunk = { pos: Float32Array; nor: Float32Array; idx: ArrayLike<number>; adj?: Int32Array[]; col?: Float32Array };
type Skin = { si: Uint16Array; sw: Float32Array };
function skinRigid(n: number, a: BoneName): Skin {
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) { si[v * 4] = BI[a]; sw[v * 4] = 1; }
  return { si, sw };
}
/** pesos suaves por distancia a los huesos candidatos, difundidos sobre la malla y recortados a 4 */
function skinAuto(c: Chunk, cands: BoneName[], iters = 3, mask?: (b: BoneName, x: number, y: number, z: number) => number): Skin {
  const n = c.pos.length / 3, nc = cands.length;
  let W = new Float32Array(n * nc), W2 = new Float32Array(n * nc);
  for (let v = 0; v < n; v++) {
    const x = c.pos[v * 3], y = c.pos[v * 3 + 1], z = c.pos[v * 3 + 2];
    let s = 0;
    for (let k = 0; k < nc; k++) {
      const b = cands[k], sd = sideOf(b);
      let m = mask ? mask(b, x, y, z) : 1;
      if (sd !== 0 && b !== 'hips' && !mask) m *= clamp01((sd * x + 0.02) / 0.04);
      const d = segDist(b, x, y, z) + 0.012, w = (m / (d * d * d * d));
      W[v * nc + k] = w; s += w;
    }
    for (let k = 0; k < nc; k++) W[v * nc + k] = s > 0 ? W[v * nc + k] / s : k === 0 ? 1 : 0;
  }
  if (c.adj) for (let it = 0; it < iters; it++) {
    for (let v = 0; v < n; v++) {
      const nb = c.adj[v];
      for (let k = 0; k < nc; k++) {
        let a = 0; for (let j = 0; j < nb.length; j++) a += W[nb[j] * nc + k];
        W2[v * nc + k] = nb.length ? 0.5 * W[v * nc + k] + (0.5 * a) / nb.length : W[v * nc + k];
      }
    }
    const t = W; W = W2; W2 = t;
  }
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), top = [0, 0, 0, 0], tw = [0, 0, 0, 0];
  for (let v = 0; v < n; v++) {
    top.fill(-1); tw.fill(0);
    for (let k = 0; k < nc; k++) {
      const w = W[v * nc + k];
      for (let j = 0; j < 4; j++) if (w > tw[j]) { for (let q = 3; q > j; q--) { tw[q] = tw[q - 1]; top[q] = top[q - 1]; } tw[j] = w; top[j] = k; break; }
    }
    const s = tw[0] + tw[1] + tw[2] + tw[3] || 1;
    for (let j = 0; j < 4; j++) { si[v * 4 + j] = top[j] >= 0 ? BI[cands[top[j]]] : 0; sw[v * 4 + j] = tw[j] / s; }
  }
  return { si, sw };
}
function mixSkin(n: number, a: BoneName, b: BoneName, f: (v: number) => number): Skin {
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) { const t = clamp01(f(v)); si[v * 4] = BI[a]; si[v * 4 + 1] = BI[b]; sw[v * 4] = 1 - t; sw[v * 4 + 1] = t; }
  return { si, sw };
}

/** banda (vendas, obi, cuello) que abraza un campo: se mide el radio real en cada dirección */
function band(f: F3, o: number[], ax: number[], e1: number[], e2: number[], u0: number, u1: number, nu: number, ns: number, pad: (u: number, a: number) => number): Chunk {
  const pos = new Float32Array((nu + 1) * ns * 3), nor = new Float32Array((nu + 1) * ns * 3), idx: number[] = [];
  for (let i = 0; i <= nu; i++) {
    const u = u0 + ((u1 - u0) * i) / nu, cx = o[0] + ax[0] * u, cy = o[1] + ax[1] * u, cz = o[2] + ax[2] * u;
    for (let j = 0; j < ns; j++) {
      const a = (j / ns) * Math.PI * 2, dx = e1[0] * Math.cos(a) + e2[0] * Math.sin(a), dy = e1[1] * Math.cos(a) + e2[1] * Math.sin(a), dz = e1[2] * Math.cos(a) + e2[2] * Math.sin(a);
      let r = 0; while (r < 0.35 && f(cx + dx * r, cy + dy * r, cz + dz * r) < 0) r += 0.003;
      r += pad((i / nu), a);
      const k = (i * ns + j) * 3;
      pos[k] = cx + dx * r; pos[k + 1] = cy + dy * r; pos[k + 2] = cz + dz * r; nor[k] = dx; nor[k + 1] = dy; nor[k + 2] = dz;
      if (i < nu) { const A = i * ns + j, B = i * ns + ((j + 1) % ns); idx.push(A, B, A + ns, B, B + ns, A + ns); }
    }
  }
  return { pos, nor, idx };
}

/** proyecta un punto de la cara (x, y) sobre la cabeza y lo separa `off` por la normal */
function onFace(x: number, y: number, off: number, P: number[], Nn: number[]) {
  let z = -0.2;
  for (let i = 0; i < 80; i++) { const d = headF(x, y, z); if (d < 0.0002) break; z += Math.max(d, 0.0004); }
  const e = 0.0008, gx = headF(x + e, y, z) - headF(x - e, y, z), gy = headF(x, y + e, z) - headF(x, y - e, z), gz = headF(x, y, z + e) - headF(x, y, z - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  P.push(x + (gx / l) * off, y + (gy / l) * off, z + (gz / l) * off); Nn.push(gx / l, gy / l, gz / l);
}
function fan(outline: number[][], off: number): Chunk {
  const P: number[] = [], N: number[] = [], idx: number[] = [];
  let cx = 0, cy = 0; for (const p of outline) { cx += p[0]; cy += p[1]; } cx /= outline.length; cy /= outline.length;
  onFace(cx, cy, off, P, N);
  for (const p of outline) onFace(p[0], p[1], off, P, N);
  for (let i = 0; i < outline.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % outline.length));
  return { pos: new Float32Array(P), nor: new Float32Array(N), idx };
}
function strip(line: (t: number) => number[], n: number, off: number): Chunk { // line(t) → [x, y, grosor hacia arriba]
  const P: number[] = [], N: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) { const [x, y, w] = line(i / n); onFace(x, y, off, P, N); onFace(x, y + w, off, P, N); if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  return { pos: new Float32Array(P), nor: new Float32Array(N), idx };
}
const ellipse = (cx: number, cy: number, rx: number, ry: number, n: number, clip?: (x: number, y: number) => number) =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, x = cx + rx * Math.cos(a); let y = cy + ry * Math.sin(a); if (clip) y = clip(x, y); return [x, y]; });
const qb = (a: number[], c: number[], b: number[], t: number) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];

/** mechón: cinta de sección rómbica que se afila hasta la punta */
function lock(lon: number, lat: number, L: number, w: number, flow: number[], bend: number, P: number[], N: number[], idx: number[]) {
  const cl = Math.cos(lat), d0 = [Math.sin(lon) * cl, Math.sin(lat), -Math.cos(lon) * cl];
  const root = [HC[0] + d0[0] * 0.088, HC[1] + d0[1] * 0.098, HC[2] + d0[2] * 0.1];
  const fl = Math.hypot(flow[0], flow[1], flow[2]), F = flow.map((v) => v / fl);
  const c = [root[0] + d0[0] * L * 0.35 + F[0] * L * 0.25, root[1] + d0[1] * L * 0.35 + F[1] * L * 0.25, root[2] + d0[2] * L * 0.35 + F[2] * L * 0.25];
  const tip = [root[0] + F[0] * L + d0[0] * L * 0.2, root[1] + F[1] * L + d0[1] * L * 0.2 - bend * L * 0.4, root[2] + F[2] * L + d0[2] * L * 0.2];
  const R = 5, base = P.length / 3, pt = (t: number) => [0, 1, 2].map((k) => (1 - t) * (1 - t) * root[k] + 2 * (1 - t) * t * c[k] + t * t * tip[k]);
  for (let i = 0; i <= R; i++) {
    const t = i / R, p = pt(t), q = pt(Math.min(1, t + 0.02)), p0 = pt(Math.max(0, t - 0.02));
    const T = [q[0] - p0[0], q[1] - p0[1], q[2] - p0[2]], tl = Math.hypot(T[0], T[1], T[2]) || 1; T[0] /= tl; T[1] /= tl; T[2] /= tl;
    // empuja fuera del casco
    for (let it = 0; it < 6; it++) { const d = capF(p[0], p[1], p[2]); if (d > 0.003) break; const e = 0.001, gx = capF(p[0] + e, p[1], p[2]) - capF(p[0] - e, p[1], p[2]), gy = capF(p[0], p[1] + e, p[2]) - capF(p[0], p[1] - e, p[2]), gz = capF(p[0], p[1], p[2] + e) - capF(p[0], p[1], p[2] - e), g = Math.hypot(gx, gy, gz) || 1; const s = (0.0035 - d) / g; p[0] += gx * s; p[1] += gy * s; p[2] += gz * s; }
    if (i === R) { P.push(p[0], p[1], p[2]); N.push(T[0], T[1], T[2]); break; }
    let sx = T[1] * d0[2] - T[2] * d0[1], sy = T[2] * d0[0] - T[0] * d0[2], sz = T[0] * d0[1] - T[1] * d0[0];
    const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    const nx = sy * T[2] - sz * T[1], ny = sz * T[0] - sx * T[2], nz = sx * T[1] - sy * T[0];
    const k = Math.pow(1 - t, 0.85) * (t < 0.15 ? 0.75 + t * 1.7 : 1), rw = w * k, rt = w * 0.42 * k;
    const S = [[sx, sy, sz, rw], [nx, ny, nz, rt], [-sx, -sy, -sz, rw], [-nx, -ny, -nz, rt]];
    for (const [ex, ey, ez, r] of S) { P.push(p[0] + ex * r, p[1] + ey * r, p[2] + ez * r); N.push(ex, ey, ez); }
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < 4; j++) {
    const a = base + i * 4 + j, b = base + i * 4 + ((j + 1) % 4);
    if (i === R - 1) idx.push(a, b, base + R * 4); else idx.push(a, b, a + 4, b, b + 4, a + 4);
  }
}

export type Model = {
  mesh: THREE.SkinnedMesh; bones: Record<BoneName, THREE.Bone>; tris: number; ms: number;
  mats: { red: THREE.Material; haori: THREE.Material };
};

function genGeo(): GeoData {
  const t0 = performance.now();
  const Pos: number[] = [], Nor: number[] = [], Col: number[] = [], SI: number[] = [], SW: number[] = [];
  const IDX: number[][] = [[], [], [], [], []];
  const STAT: string[] = [];
  const add = (c: Chunk, g: G, sk: Skin, colIn: ((v: number) => number[] | number) | number = 1, mirrorX = false) => {
    const col = typeof colIn === 'number' ? () => colIn : colIn;
    const base = Pos.length / 3, n = c.pos.length / 3;
    for (let v = 0; v < n; v++) {
      Pos.push(mirrorX ? -c.pos[v * 3] : c.pos[v * 3], c.pos[v * 3 + 1], c.pos[v * 3 + 2]);
      Nor.push(mirrorX ? -c.nor[v * 3] : c.nor[v * 3], c.nor[v * 3 + 1], c.nor[v * 3 + 2]);
      const cc = col(v); if (typeof cc === 'number') Col.push(cc, cc, cc); else Col.push(cc[0], cc[1], cc[2]);
      for (let j = 0; j < 4; j++) { SI.push(sk.si[v * 4 + j]); SW.push(sk.sw[v * 4 + j]); }
    }
    STAT.push(c.idx.length / 3 + '@' + Math.round(performance.now() - t0));
    // orientación coherente con las normales
    for (let i = 0; i < c.idx.length; i += 3) {
      let a = c.idx[i], b = c.idx[i + 1], cI = c.idx[i + 2];
      const A = (base + a) * 3, B = (base + b) * 3, C = (base + cI) * 3;
      const ux = Pos[B] - Pos[A], uy = Pos[B + 1] - Pos[A + 1], uz = Pos[B + 2] - Pos[A + 2], vx = Pos[C] - Pos[A], vy = Pos[C + 1] - Pos[A + 1], vz = Pos[C + 2] - Pos[A + 2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      if (gx * (Nor[A] + Nor[B] + Nor[C]) + gy * (Nor[A + 1] + Nor[B + 1] + Nor[C + 1]) + gz * (Nor[A + 2] + Nor[B + 2] + Nor[C + 2]) < 0) { const t = b; b = cI; cI = t; }
      IDX[g].push(base + a, base + b, base + cI);
    }
  };
  const skinCol = (ao: Float32Array) => (v: number) => { const a = Math.pow(ao[v], 1.4); return [0.5 + 0.5 * a, 0.3 + 0.7 * a, 0.3 + 0.7 * a]; };
  const fabCol = (ao: Float32Array, lo = 0.35) => (v: number) => lo + (1 - lo) * ao[v];

  // ── torso y brazos ──
  const torso = polygonize(torsoF, [-0.57, 0.885, -0.165], [0.57, 1.56, 0.175], [0.026, 0.033, 0.026],
    (x, y) => y > 0.925 && armU(x, y) < L_UPPER + 0.085 && y < 1.5);
  add(torso, 0, skinAuto(torso, ['hips', 'spine', 'chest', 'neck', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR'], 4), skinCol(torso.ao));
  // ── cabeza ──
  const head = polygonize(headF, [-0.115, 1.4, -0.13], [0.115, 1.69, 0.13], [0.0118, 0.0118, 0.0118], (x, y, z) => y > 1.44 && capF(x, y, z) > 0.0015);
  add(head, 0, skinAuto(head, ['chest', 'neck', 'head'], 2), skinCol(head.ao));
  // ── puños ──
  const fist = polygonize(fistF, [-0.065, -0.15, -0.075], [0.035, 0.04, 0.055], [0.0135, 0.0135, 0.0135], (_x, y) => y < -0.008);
  {
    const m = new THREE.Matrix4().makeRotationZ(ARM_A).setPosition(WR[0], WR[1], WR[2]), nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
    const P = new Float32Array(fist.pos.length), N = new Float32Array(fist.nor.length);
    for (let i = 0; i < P.length; i += 3) { v.fromArray(fist.pos, i).applyMatrix4(m).toArray(P, i); v.fromArray(fist.nor, i).applyMatrix3(nm).normalize().toArray(N, i); }
    const ch: Chunk = { pos: P, nor: N, idx: fist.idx, adj: fist.adj };
    const sk = skinAuto(ch, ['foreR', 'handR'], 1), skL = { si: sk.si.slice(), sw: sk.sw };
    for (let i = 0; i < skL.si.length; i++) skL.si[i] = skL.si[i] === BI.foreR ? BI.foreL : skL.si[i] === BI.handR ? BI.handL : skL.si[i];
    add(ch, 0, sk, skinCol(fist.ao)); add(ch, 0, skL, skinCol(fist.ao), true);
  }
  // ── pantalón y pies (tabi) ──
  const pants = polygonize(pantsF, [-0.235, 0.06, -0.15], [0.235, 1.03, 0.2], [0.03, 0.045, 0.03], (_x, y) => y > 0.1);
  add(pants, 2, skinAuto(pants, ['hips', 'spine', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'], 4,
    (b, x) => { const sd = sideOf(b); return sd === 0 ? 1 : clamp01((sd * x + 0.035) / 0.07); }), fabCol(pants.ao));
  const foot = polygonize(footF, [-0.065, -0.012, -0.175], [0.065, 0.12, 0.09], [0.018, 0.018, 0.018], (_x, y) => y < 0.1);
  for (const sg of [-1, 1]) {
    const P = foot.pos.slice(); for (let i = 0; i < P.length; i += 3) P[i] += sg * 0.1;
    const ch: Chunk = { pos: P, nor: foot.nor, idx: foot.idx, adj: foot.adj }, s = sg < 0 ? 'L' : 'R';
    add(ch, 2, skinAuto(ch, [('shin' + s) as BoneName, ('foot' + s) as BoneName, ('toe' + s) as BoneName], 2, () => 1), fabCol(foot.ao, 0.5));
  }
  // ── vendas de antebrazo y polainas ──
  for (const sg of [-1, 1]) {
    const s = sg < 0 ? 'L' : 'R';
    const wrap = band(torsoF, [sg * SH[0], SH[1], SH[2]], [sg * AD[0], AD[1], 0], [sg * AN[0], AN[1], 0], [0, 0, 1], L_UPPER + 0.075, L_UPPER + L_FORE + 0.025, 9, 12,
      (u, a) => 0.0035 + 0.0022 * Math.abs(Math.sin(u * 30 + a)) + (u > 0.93 ? 0.004 : 0));
    add(wrap, 3, skinAuto(wrap, [('arm' + s) as BoneName, ('fore' + s) as BoneName, ('hand' + s) as BoneName], 0), (v) => 0.72 + 0.28 * Math.abs(Math.sin((Math.floor(v / 12) / 9) * 30 + ((v % 12) / 12) * 6.283)));
    const leg = band(legsF, [sg * 0.1, 0.05, 0.005], [0, 1, 0], [1, 0, 0], [0, 0, 1], 0, 0.15, 6, 12, (u, a) => 0.004 + 0.002 * Math.abs(Math.sin(u * 14 + a)));
    add(leg, 3, skinAuto(leg, [('shin' + s) as BoneName, ('foot' + s) as BoneName], 0), (v) => 0.75 + 0.25 * Math.abs(Math.sin((Math.floor(v / 12) / 6) * 14 + ((v % 12) / 12) * 6.283)));
  }
  // ── obi y vuelta de bufanda al cuello ──
  const tp: F3 = (x, y, z) => Math.min(torsoF(x, y, z), pantsF(x, y, z));
  const obi = band(tp, [0, 0.885, 0.012], [0, 1, 0], [1, 0, 0], [0, 0, 1], 0, 0.125, 4, 20, (u) => 0.007 + 0.004 * Math.sin(Math.PI * u));
  add(obi, 4, skinAuto(obi, ['hips', 'spine'], 0), (v) => (Math.floor(v / 20) === 2 ? 0.7 : 1));
  const neckF: F3 = (x, y, z) => rc(x, y, z, 0, 1.32, 0.012, 0, 1.52, 0.005, 0.064, 0.05);
  const collar = band(neckF, [0, 1.395, 0.012], [0, 1, 0], [1, 0, 0], [0, 0, 1], 0, 0.085, 4, 16, (u, a) => 0.012 + 0.016 * Math.sin(Math.PI * u) + 0.004 * Math.sin(a * 3 + u * 4));
  add(collar, 4, skinAuto(collar, ['chest', 'neck'], 0), (v) => (Math.floor(v / 16) % 4 === 0 ? 0.8 : 1));
  // ── pelo: casco + mechones ──
  const cap = polygonize(capF, [-0.12, 1.47, -0.125], [0.12, 1.7, 0.135], [0.018, 0.018, 0.018]);
  add(cap, 1, skinRigid(cap.pos.length / 3, 'head'), (v) => 0.55 + 0.45 * cap.ao[v]);
  {
    const P: number[] = [], N: number[] = [], idx: number[] = [], D = Math.PI / 180;
    for (const lon of [-120, -60, 0, 60, 120, 180]) lock(lon * D, 70 * D, 0.135, 0.03, [Math.sin(lon * D) * 0.3, 0.55, 1], 0.25, P, N, idx);
    for (const lon of [-150, -105, -65, 65, 105, 150, 180]) lock(lon * D, 38 * D, 0.125, 0.03, [Math.sin(lon * D) * 0.5, 0.25, 1], 0.45, P, N, idx);
    for (const lon of [-160, -130, -100, 100, 130, 160]) lock(lon * D, 8 * D, 0.1, 0.028, [Math.sin(lon * D) * 0.35, -0.6, 0.8], 0.5, P, N, idx);
    for (const lon of [-170, 180, 170]) lock(lon * D, -22 * D, 0.075, 0.024, [0, -1, 0.3], 0.3, P, N, idx);
    for (const lon of [-82, 82]) lock(lon * D, 18 * D, 0.07, 0.024, [Math.sign(lon) * 0.4, -0.9, 0.15], 0.2, P, N, idx);
    for (const [lon, sw] of [[-38, -0.45], [-14, -0.15], [10, 0.12], [34, 0.42], [0, 0]]) lock(lon * D, (lon === 0 && sw === 0 ? 62 : 48) * D, lon === 0 && sw === 0 ? 0.11 : 0.095, 0.026, [sw, -0.8, -0.55], 0.15, P, N, idx);
    const ch: Chunk = { pos: new Float32Array(P), nor: new Float32Array(N), idx };
    add(ch, 1, skinRigid(P.length / 3, 'head'), (v) => { const r = (v % 21) / 20; return 0.6 + 0.4 * r; });
  }
  // ── cara: ojos afilados, cejas severas, boca ──
  for (const sg of [-1, 1]) {
    const I = [0.0175, 1.5505], O = [0.057, 1.559], CU = [0.03, 1.5675], CL = [0.041, 1.5425];
    const up = (x: number) => { let lo = 0, hi = 1; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (qb(I, CU, O, m)[0] < x) lo = m; else hi = m; } return qb(I, CU, O, lo)[1]; };
    const dn = (x: number) => { let lo = 0, hi = 1; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (qb(I, CL, O, m)[0] < x) lo = m; else hi = m; } return qb(I, CL, O, lo)[1]; };
    const clip = (x: number, y: number) => Math.min(up(x) - 0.0004, Math.max(dn(x) + 0.0004, y));
    const white: number[][] = [];
    for (let i = 0; i <= 7; i++) white.push(qb(I, CU, O, i / 7));
    for (let i = 1; i < 7; i++) white.push(qb(I, CL, O, 1 - i / 7));
    const S = (pts: number[][]) => pts.map((p) => [sg * p[0], p[1]]);
    add(fan(S(white), 0.0012), 3, skinRigid(white.length + 1, 'eyes'));
    const iris = ellipse(0.0355, 1.5535, 0.0074, 0.0088, 12, clip);
    add(fan(S(iris), 0.0022), 4, skinRigid(13, 'eyes'), 1.25);
    const pup = ellipse(0.0355, 1.5535, 0.0026, 0.0056, 8, clip);
    add(fan(S(pup), 0.003), 1, skinRigid(9, 'eyes'), 0.4);
    const hl = ellipse(0.0385, 1.5568, 0.0016, 0.0016, 6);
    add(fan(S(hl), 0.0038), 3, skinRigid(7, 'eyes'), 1.3);
    const lash = strip((t) => { const p = t < 0.86 ? qb(I, CU, O, t / 0.86) : [O[0] + (t - 0.86) / 0.14 * 0.007, O[1] + (t - 0.86) / 0.14 * 0.0025]; return [sg * p[0], p[1] - 0.0006, 0.0016 + 0.0026 * Math.sin(Math.PI * Math.min(1, t * 1.1))]; }, 9, 0.0034);
    add(lash, 1, skinRigid(lash.pos.length / 3, 'eyes'), 0.5);
    const brow = strip((t) => [sg * (0.011 + 0.048 * t), 1.5705 + 0.0105 * t - 0.004 * t * t + 0.002 * Math.sin(Math.PI * t), 0.0056 - 0.0032 * t], 6, 0.003);
    add(brow, 1, skinRigid(brow.pos.length / 3, sg < 0 ? 'browL' : 'browR'), 0.6);
  }
  const mouth = strip((t) => [-0.0145 + 0.029 * t, 1.4865 - 0.0018 * Math.abs(t - 0.5) * 2 + 0.0008, 0.0017], 6, 0.0015);
  add(mouth, 1, skinRigid(mouth.pos.length / 3, 'mouth'), 0.5);

  console.log('[build] tris por pieza', STAT.join(' '));
  const groups = IDX.map((l) => l.length), idx = new Uint32Array(groups.reduce((x, y) => x + y, 0));
  let o = 0; for (const l of IDX) { idx.set(l, o); o += l.length; }
  return { pos: new Float32Array(Pos), nor: new Float32Array(Nor), col: new Float32Array(Col), si: new Uint16Array(SI), sw: new Float32Array(SW), idx, groups };
}

// ── caché de la malla generada (localStorage, versionada) ──
type GeoData = { pos: Float32Array; nor: Float32Array; col: Float32Array; si: Uint16Array; sw: Float32Array; idx: Uint32Array; groups: number[] };
const CACHE_KEY = 'yugure.hero.geo.v4';
const b64 = (a: ArrayBufferView) => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000) as unknown as number[]); return btoa(s); };
const unb64 = (s: string) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
function loadGeo(): GeoData {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return { pos: new Float32Array(unb64(j.pos)), nor: new Float32Array(unb64(j.nor)), col: new Float32Array(unb64(j.col)), si: new Uint16Array(unb64(j.si)), sw: new Float32Array(unb64(j.sw)), idx: new Uint32Array(unb64(j.idx)), groups: j.groups };
    }
  } catch { /* caché corrupta o inaccesible */ }
  const g = genGeo();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('yugure.hero.geo.') && k !== CACHE_KEY) localStorage.removeItem(k); }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ pos: b64(g.pos), nor: b64(g.nor), col: b64(g.col), si: b64(g.si), sw: b64(g.sw), idx: b64(g.idx), groups: g.groups }));
  } catch { /* sin espacio: se regenera la próxima vez */ }
  return g;
}

export function buildModel(mats: Mats): Model {
  const t0 = performance.now();
  const G = loadGeo();
  // ── esqueleto ──
  const bones = {} as Record<BoneName, THREE.Bone>;
  const world = {} as Record<BoneName, THREE.Matrix4>;
  const q = new THREE.Quaternion(), inv = new THREE.Matrix4();
  for (const n of BONE_NAMES) {
    const b = new THREE.Bone(); b.name = n; bones[n] = b;
    world[n] = new THREE.Matrix4().compose(new THREE.Vector3(...BIND[n]), q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ROTZ[n] ?? 0), new THREE.Vector3(1, 1, 1));
    const p = PARENT[n];
    const local = p ? inv.copy(world[p]).invert().multiply(world[n]) : world[n].clone();
    local.decompose(b.position, b.quaternion, b.scale);
    if (p) bones[p].add(b);
  }
  bones.root.updateMatrixWorld(true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(G.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(G.nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(G.col, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(G.si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(G.sw, 4));
  geo.setIndex(new THREE.BufferAttribute(G.idx, 1));
  let off = 0; G.groups.forEach((n, g) => { geo.addGroup(off, n, g); off += n; });
  geo.computeBoundingSphere();
  const own = (m: THREE.Material) => { (m as THREE.MeshToonMaterial).vertexColors = true; m.needsUpdate = true; return m; };
  const M = [
    own(mats.tint('skin', COLORS.skin)), own(mats.tint('hair', COLORS.hair)), own(mats.tint('fabric', COLORS.pants)),
    own(mats.tint('fabric', COLORS.cream)), own(mats.tint('fabric', COLORS.red)),
  ];
  const mesh = new THREE.SkinnedMesh(geo, M);
  mesh.castShadow = true; mesh.frustumCulled = false;
  mesh.bind(new THREE.Skeleton(BONE_NAMES.map((n) => bones[n])), new THREE.Matrix4());
  void NB;
  return { mesh, bones, tris: G.idx.length / 3, ms: performance.now() - t0, mats: { red: M[4], haori: own(mats.tint('fabric', COLORS.haori)) } };
}
