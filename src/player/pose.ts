// Poses procedurales por modo. Una pose es un vector de canales que se puede mezclar linealmente.
// Espacio de pose: personaje erguido, origen en los pies, frente = -Z, derecha = +X.
// Luego se aplica un giro de cuerpo entero (bPitch/bYaw/bRoll) alrededor de (0, pivY, 0).
import { ANKLE_H, BALL_H, BALL_Z, BIND, HEEL_Z, K, L_FORE, L_UPPER } from './build';
import { BONG_GRIP, bongToChest, bongXform } from './bong';

export const CH = [
  'bPitch', 'bYaw', 'bRoll', 'pivY', 'stretch', 'rx', 'ry', 'rz',
  'hx', 'hy', 'hz', 'hPitch', 'hYaw', 'hRoll',
  'sPitch', 'sYaw', 'sRoll', 'nPitch', 'nYaw', 'nRoll',
  'fLx', 'fLy', 'fLz', 'fLp', 'fLt', 'fLk', 'fLyaw',
  'fRx', 'fRy', 'fRz', 'fRp', 'fRt', 'fRk', 'fRyaw',
  'aLx', 'aLy', 'aLz', 'aLex', 'aLey', 'aLez', 'aLwr', 'aLabs', 'aLwx', 'aLwy', 'aLwz',
  'aRx', 'aRy', 'aRz', 'aRex', 'aRey', 'aRez', 'aRwr', 'aRabs', 'aRwx', 'aRwy', 'aRwz',
  'brow', 'browTilt', 'mouth', 'mouthW', 'glide',
] as const;
export type Ch = (typeof CH)[number];
export const I = {} as Record<Ch, number>;
CH.forEach((k, i) => { I[k] = i; });
export const NCH = CH.length;
export type Pose = Float32Array;
export const newPose = () => new Float32Array(NCH);

export type Ctx = {
  phase: number; speed: number; vy: number; t: number; time: number; wall: number; impact: number;
  /** desplazamiento lateral −1..1 · ángulo de barra (rad) y su velocidad · dirección de impulso en espacio del grupo */
  side: number; swing: number; swingV: number; ax: number; ay: number; az: number;
};

const PI = Math.PI, TAU = PI * 2;
const sat = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t: number) => t * t * (3 - 2 * t);
const frac = (x: number) => x - Math.floor(x);
const outBack = (t: number) => { t = sat(t) - 1; return 1 + t * t * (2.7 * t + 1.7); };
const FB = [I.fLx, I.fRx], AB = [I.aLx, I.aRx];

export function lerpPose(out: Pose, a: Pose, b: Pose, w: number) { for (let i = 0; i < NCH; i++) out[i] = a[i] + (b[i] - a[i]) * w; }

const FLIP: number[] = (['bYaw', 'bRoll', 'rx', 'hx', 'hYaw', 'hRoll', 'sYaw', 'sRoll', 'nYaw', 'nRoll'] as Ch[]).map((k) => I[k]);
export function mirrorPose(p: Pose) {
  for (const i of FLIP) p[i] = -p[i];
  for (let i = 0; i < 7; i++) { const a = p[FB[0] + i]; p[FB[0] + i] = p[FB[1] + i]; p[FB[1] + i] = a; }
  for (let i = 0; i < 11; i++) { const a = p[AB[0] + i]; p[AB[0] + i] = p[AB[1] + i]; p[AB[1] + i] = a; }
  for (const b of FB) { p[b] = -p[b]; p[b + 6] = -p[b + 6]; }
  for (const b of AB) { p[b] = -p[b]; p[b + 3] = -p[b + 3]; p[b + 8] = -p[b + 8]; }
}

function foot(p: Pose, s: number, x: number, y: number, z: number, pitch = 0, toe = 0, kout = 0.06, yaw = 0) {
  const b = FB[s]; p[b] = x; p[b + 1] = y; p[b + 2] = z; p[b + 3] = pitch; p[b + 4] = toe; p[b + 5] = kout; p[b + 6] = yaw;
}
/** mano relativa al hombro en espacio del pecho; e = dirección del codo */
function hand(p: Pose, s: number, x: number, y: number, z: number, ex = s ? 0.35 : -0.35, ey = -0.15, ez = 1, wr = 0) {
  const b = AB[s]; p[b] = x; p[b + 1] = y; p[b + 2] = z; p[b + 3] = ex; p[b + 4] = ey; p[b + 5] = ez; p[b + 6] = wr;
}
function handAbs(p: Pose, s: number, w: number, x: number, y: number, z: number) { const b = AB[s]; p[b + 7] = w; p[b + 8] = x; p[b + 9] = y; p[b + 10] = z; }

export function rest(p: Pose) {
  p.fill(0);
  p[I.pivY] = 0.9; p[I.stretch] = 1; p[I.hy] = 0.9;
  foot(p, 0, -0.09, ANKLE_H, 0); foot(p, 1, 0.09, ANKLE_H, 0);
  hand(p, 0, -0.1, -0.48, -0.02); hand(p, 1, 0.1, -0.48, -0.02);
}

// ───────────────────────── carrera ─────────────────────────
export const RP = { T: 0.7, Lc: 0.8, duty: 0.2, k: 0 };
export function runParams(v: number) {
  const k = sat((v - 6) / 9);
  RP.k = k; RP.T = 2 / (2.85 + 1.5 * k); RP.Lc = 0.8 + 0.12 * k;
  RP.duty = RP.Lc / (Math.max(v, 0.5) * RP.T);
  if (RP.duty > 0.42) { RP.duty = 0.42; RP.Lc = 0.42 * Math.max(v, 0.5) * RP.T; }
}
const SF = { y: 0, z: 0, p: 0 };
/** pie en apoyo: u 0..1; el punto de contacto retrocede exactamente a la velocidad del suelo */
function stanceFoot(u: number, k: number) {
  const cz = -0.36 * RP.Lc + RP.Lc * u;
  let p = 0;
  if (u < 0.22) p = 0.3 * (1 - 0.7 * k) * (1 - u / 0.22);
  else if (u > 0.45) { const q = (u - 0.45) / 0.55; p = -1.05 * q * q * (3 - 2 * q); }
  if (p >= 0) { SF.y = ANKLE_H * Math.cos(p) + HEEL_Z * Math.sin(p); SF.z = cz + HEEL_Z + ANKLE_H * Math.sin(p) - HEEL_Z * Math.cos(p); }
  else { const h = ANKLE_H - BALL_H; SF.y = BALL_H + h * Math.cos(p) - BALL_Z * Math.sin(p); SF.z = cz - BALL_Z + h * Math.sin(p) + BALL_Z * Math.cos(p); }
  SF.p = p;
}
function legRun(p: Pose, s: number, ph: number, k: number) {
  const d = RP.duty, x = (s ? 1 : -1) * (0.075 - 0.035 * k);
  if (ph < d) { stanceFoot(ph / d, k); foot(p, s, x, SF.y, SF.z, SF.p, SF.p < 0 ? -SF.p : 0, 0.05); return; }
  const q = (ph - d) / (1 - d);
  stanceFoot(1, k); const y0 = SF.y, z0 = SF.z, p0 = SF.p;
  stanceFoot(0, k); const y1 = SF.y, z1 = SF.z, p1 = SF.p;
  const q2 = q * q, q3 = q2 * q, m0 = 0.35, m1 = 1.0 + 0.5 * k;
  const z = (2 * q3 - 3 * q2 + 1) * z0 + (q3 - 2 * q2 + q) * m0 + (-2 * q3 + 3 * q2) * z1 + (q3 - q2) * m1;
  const bump = Math.pow(Math.sin(PI * Math.pow(q, 0.7)), 1.4);
  const y = y0 + (y1 - y0) * q + (0.3 + 0.2 * k) * bump;
  const pt = p0 + (p1 - p0) * smooth(0.45, 1, q) - 0.45 * Math.sin(PI * q);
  foot(p, s, x, y, z, pt, 0.5 * (1 - smooth(0, 0.25, q)), 0.04);
}
function armSwing(p: Pose, s: number, th: number, be: number, inward: number) {
  const sg = s ? 1 : -1, a2 = th + be;
  hand(p, s, sg * (0.03 - inward), -(L_UPPER * Math.cos(th) + L_FORE * Math.cos(a2)), -(L_UPPER * Math.sin(th) + L_FORE * Math.sin(a2)), sg * 0.45, -0.1, 1, -0.15);
}
export function poseRun(p: Pose, c: Ctx) {
  rest(p);
  runParams(c.speed);
  const k = RP.k, ph = c.phase, d = RP.duty;
  legRun(p, 0, ph, k); legRun(p, 1, frac(ph + 0.5), k);
  const bob = -Math.cos(2 * TAU * (ph - d / 2));
  const sw = Math.cos(TAU * (ph - 0.95)), st = Math.cos(TAU * (ph - d / 2));
  p[I.hy] = 0.845 - 0.06 * k + 0.045 * bob;
  p[I.hYaw] = -(0.1 + 0.07 * k) * sw; p[I.sYaw] = (0.22 + 0.12 * k) * sw;
  p[I.hRoll] = -0.05 * st; p[I.sRoll] = 0.075 * st; p[I.hx] = -0.012 * st;
  p[I.hPitch] = 0.15 + 0.2 * k; p[I.sPitch] = 0.1 + 0.1 * k; p[I.hz] = 0.02 + 0.04 * k;
  p[I.nPitch] = -(0.17 + 0.24 * k) + 0.035 * Math.cos(2 * TAU * (ph - d / 2 - 0.07));
  p[I.nYaw] = -0.85 * (p[I.hYaw] + p[I.sYaw]); p[I.nRoll] = -0.5 * (p[I.hRoll] + p[I.sRoll]);
  const S = 0.62 + 0.3 * k, t0 = -0.12;
  armSwing(p, 0, t0 - S * sw, 1.5 - 0.1 * k - 0.32 * sw, 0.09 * Math.max(0, -sw));
  armSwing(p, 1, t0 + S * sw, 1.5 - 0.1 * k + 0.32 * sw, 0.09 * Math.max(0, sw));
  p[I.stretch] = 1 + 0.015 * bob;
  p[I.browTilt] = 0.35 + 0.3 * k; p[I.mouth] = 0.25 + 0.15 * Math.sin(2 * TAU * ph); p[I.brow] = -0.2;
}

// ───────────────────────── aire: despegue / apogeo / caída ─────────────────────────
const A = newPose(), B = newPose(), C = newPose();
function keyUp(p: Pose) { // estirado: rodilla izquierda arriba, pierna derecha empujando atrás
  rest(p);
  p[I.hy] = 0.93; p[I.hPitch] = 0.2; p[I.sPitch] = -0.14; p[I.nPitch] = -0.16; p[I.stretch] = 1.07; p[I.hYaw] = -0.14; p[I.sYaw] = 0.3; p[I.nYaw] = -0.14;
  foot(p, 0, -0.08, 0.52, -0.2, -0.45, 0, 0.05); foot(p, 1, 0.07, 0.07, 0.3, -1.1, 0.15, 0.03);
  hand(p, 0, -0.1, -0.33, 0.25, -0.5, 0, 1); hand(p, 1, -0.08, 0.2, -0.3, 0.7, -0.5, 0.5);
  p[I.brow] = 0.6; p[I.mouth] = 0.7;
}
function keyApex(p: Pose) { // recogido, brazos abiertos flotando
  rest(p);
  p[I.hy] = 0.92; p[I.hPitch] = 0.32; p[I.sPitch] = 0.14; p[I.nPitch] = -0.12; p[I.sYaw] = 0.1;
  foot(p, 0, -0.1, 0.46, -0.17, -0.5, 0, 0.12); foot(p, 1, 0.1, 0.4, 0.1, -0.8, 0, 0.12);
  hand(p, 0, -0.36, -0.04, -0.06, -0.3, -0.6, 0.7); hand(p, 1, 0.36, 0.06, -0.02, 0.3, -0.6, 0.7);
  p[I.brow] = 0.8; p[I.mouth] = 0.9; p[I.mouthW] = 0.4;
}
function keyDown(p: Pose) { // piernas buscando el suelo, brazos arriba
  rest(p);
  p[I.hy] = 0.87; p[I.hPitch] = -0.04; p[I.sPitch] = 0.06; p[I.nPitch] = 0.2; p[I.stretch] = 1.04;
  foot(p, 0, -0.085, 0.12, -0.2, 0.1, 0, 0.08); foot(p, 1, 0.09, 0.2, 0.12, -0.5, 0, 0.1);
  hand(p, 0, -0.3, 0.3, -0.04, -1, -0.5, 0.2); hand(p, 1, 0.33, 0.24, 0.04, 1, -0.5, 0.2);
  p[I.brow] = 0.3; p[I.mouth] = 0.45; p[I.browTilt] = 0.2;
}
function keyCrouch(p: Pose) { // anticipación del salto
  rest(p);
  p[I.hy] = 0.64; p[I.hPitch] = 0.55; p[I.sPitch] = 0.28; p[I.nPitch] = -0.4; p[I.stretch] = 0.9; p[I.hz] = 0.03;
  foot(p, 0, -0.09, ANKLE_H, -0.1); foot(p, 1, 0.09, 0.13, 0.17, -0.6, 0.6);
  hand(p, 0, -0.1, -0.3, 0.3, -0.4, 0.2, 1); hand(p, 1, 0.1, -0.3, 0.3, 0.4, 0.2, 1);
  p[I.browTilt] = 0.7; p[I.brow] = -0.4;
}
export function poseAir(p: Pose, c: Ctx) {
  const u = Math.max(-1, Math.min(1, c.vy / 6.5));
  keyApex(A);
  if (u > 0) { keyUp(B); lerpPose(p, A, B, ease(u)); } else { keyDown(B); lerpPose(p, A, B, ease(-u)); }
  const f = sat(-u), w1 = Math.sin(c.time * 10), w2 = Math.cos(c.time * 10);
  p[I.aLy] += 0.035 * w1 * f; p[I.aLz] += 0.05 * w2 * f; p[I.aRy] -= 0.035 * w1 * f; p[I.aRz] -= 0.05 * w2 * f;
  p[I.fLz] += 0.02 * w2 * f; p[I.fRz] -= 0.02 * w2 * f;
}
export function poseJump(p: Pose, c: Ctx) {
  poseAir(p, c);
  const t = c.t;
  if (t < 0.22) {
    keyCrouch(C);
    const w = 1 - smooth(0.04, 0.13, t);
    lerpPose(p, p, C, w);
    p[I.ry] -= Math.min(Math.max(c.vy, 0) * t, 0.2) * w;
    const b = sat((t - 0.07) / 0.15);
    p[I.stretch] += 0.1 * Math.sin(PI * b);
  }
}

// ───────────────────────── aterrizaje y rodada ─────────────────────────
export function poseLand(p: Pose, c: Ctx) {
  poseRun(p, c);
  const t = c.t, hard = 0.45 + 0.55 * c.impact;
  const imp = Math.exp(-t * 9) * Math.sin(t * 22) * 1.6 * hard, imp2 = Math.exp(-Math.max(0, t - 0.035) * 9) * Math.sin(Math.max(0, t - 0.035) * 22) * 1.6 * hard;
  p[I.hy] = Math.max(0.52, p[I.hy] - 0.24 * imp);
  p[I.hPitch] += 0.28 * imp; p[I.sPitch] += 0.3 * imp; p[I.nPitch] += 0.3 * imp2;
  for (let s = 0; s < 2; s++) { const b = AB[s], sg = s ? 1 : -1; p[b] += sg * 0.13 * imp; p[b + 1] -= 0.12 * imp; p[b + 2] += 0.07 * imp; }
  p[I.stretch] -= 0.13 * imp;
  p[I.mouth] = 0.1; p[I.browTilt] = 0.8; p[I.brow] = -0.5 * sat(imp);
}
function keyTuck(p: Pose) {
  rest(p);
  p[I.hy] = 0.4; p[I.hz] = 0.13; p[I.hPitch] = 0.95; p[I.sPitch] = 0.95; p[I.nPitch] = 0.6;
  foot(p, 0, -0.085, 0.12, -0.02, -0.3, 0, 0.2); foot(p, 1, 0.085, 0.1, 0.05, -0.3, 0, 0.2);
  hand(p, 0, 0.06, -0.24, -0.26, -0.8, -0.2, 0.3); hand(p, 1, -0.06, -0.24, -0.26, 0.8, -0.2, 0.3);
  p[I.browTilt] = 0.6; p[I.mouth] = 0.1;
}
export const ROLL_T = 0.55;
export function poseRoll(p: Pose, c: Ctx) {
  const q = sat(c.t / ROLL_T);
  poseRun(p, c);
  keyTuck(A);
  const w = smooth(0, 0.16, q) * (1 - smooth(0.72, 1, q));
  p[I.hy] -= 0.12 * (1 - q) * (1 - w);
  lerpPose(p, p, A, w);
  const e = q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q);
  p[I.bPitch] = TAU * (0.25 * q + 0.75 * e);
  p[I.pivY] = 0.36 + 0.5 * (1 - w);
  p[I.ry] = 0.03 * Math.sin(PI * q) * w;
}

// ───────────────────────── planeo, pared, deslizamiento, impulso ─────────────────────────
export function poseGlide(p: Pose, c: Ctx) {
  rest(p);
  const t = c.time, o = outBack(c.t / 0.3);
  p[I.bPitch] = 1.0 + 0.05 * Math.sin(t * 1.9); p[I.bRoll] = 0.07 * Math.sin(t * 1.3); p[I.ry] = -0.25; p[I.pivY] = 0.9;
  p[I.hy] = 0.9; p[I.sPitch] = -0.3; p[I.nPitch] = -0.62; p[I.hPitch] = -0.05;
  const k = 0.03 * Math.sin(t * 3.1);
  foot(p, 0, -0.11, 0.13 + k, 0.1, -1.15, 0, 0.1); foot(p, 1, 0.1, 0.2 - k, 0.2, -1.15, 0, 0.1);
  const fl = 0.02 * Math.sin(t * 8);
  hand(p, 0, -0.43 * o, -0.12 + fl, 0.08, -0.2, -0.3, 1); hand(p, 1, 0.43 * o, -0.12 - fl, 0.08, 0.2, -0.3, 1);
  p[I.glide] = sat(o); p[I.stretch] = 1 + 0.06 * (1 - smooth(0, 0.35, c.t));
  p[I.brow] = 0.7; p[I.mouth] = 0.6; p[I.mouthW] = 0.5;
}
/** pared a ~0,42 m del origen del grupo, en el lado c.wall (+1 = derecha) */
export function poseWall(p: Pose, c: Ctx) {
  poseRun(p, c);
  const ws = c.wall >= 0 ? 1 : -1, o = outBack(c.t / 0.25), near = ws > 0 ? 1 : 0, far = 1 - near;
  p[I.bRoll] = ws * 0.5 * o; p[I.pivY] = 0.85;
  p[I.hPitch] = 0.12; p[I.sRoll] += -ws * 0.16 * o; p[I.nRoll] += -ws * 0.26 * o; p[I.nYaw] += -ws * 0.12;
  handAbs(p, near, sat(o), ws * 0.4, 1.2 + 0.03 * Math.sin(c.time * 9), 0.2);
  p[AB[near] + 3] = ws * 0.3; p[AB[near] + 4] = -1; p[AB[near] + 5] = 0.6;
  hand(p, far, -ws * 0.36, 0.02 + 0.03 * Math.sin(c.phase * TAU * 2), -0.1, -ws * 0.4, -0.8, 0.5);
  p[I.brow] = 0.3; p[I.mouth] = 0.5;
}
export function poseSlide(p: Pose, c: Ctx) {
  rest(p);
  const t = c.time, e = smooth(0, 0.14, c.t), wob = Math.sin(t * 3.3);
  p[I.hy] = 0.37 - 0.05 * Math.exp(-c.t * 9) * Math.sin(c.t * 20); p[I.hz] = 0.12; p[I.hPitch] = -0.22; p[I.sPitch] = 0.3; p[I.nPitch] = -0.1;
  p[I.bRoll] = 0.05 * wob; p[I.pivY] = 0; p[I.sYaw] = -0.25; p[I.hYaw] = 0.15; p[I.nYaw] = 0.1;
  foot(p, 0, -0.07, 0.1, -0.6, 0.45, 0, 0.1); foot(p, 1, 0.07, 0.1, 0.14, -0.5, 0.5, 0.45);
  hand(p, 0, -0.14, -0.06 + 0.03 * wob, -0.36, -0.6, -0.5, 0.4); hand(p, 1, 0.3, -0.32 - 0.03 * wob, 0.22, 0.7, 0.2, 1);
  p[I.stretch] = 1 - 0.06 * (1 - e); p[I.brow] = 0.4; p[I.mouth] = 0.5; p[I.mouthW] = 0.5;
}
export function poseBoost(p: Pose, c: Ctx) {
  rest(p);
  const t = c.t, o = outBack(t / 0.2), sh = Math.sin(c.time * 31) * 0.008;
  p[I.bPitch] = 0.95 * o; p[I.ry] = -0.2 * sat(o) + sh; p[I.bRoll] = 0.04 * Math.sin(c.time * 2.3);
  p[I.sPitch] = -0.26; p[I.nPitch] = -0.7; p[I.hy] = 0.92; p[I.sYaw] = 0.3; p[I.hYaw] = -0.12; p[I.nYaw] = -0.15;
  foot(p, 0, -0.09, 0.5, -0.12, -0.8, 0, 0.1); foot(p, 1, 0.08, 0.1, 0.16, -1.25, 0, 0.04);
  hand(p, 1, -0.07, 0.42, -0.16, 1, -0.3, 0.3, -0.2); hand(p, 0, -0.11, -0.4, 0.2, -0.5, 0, 1);
  p[I.stretch] = 0.9 + 0.2 * smooth(0.02, 0.12, t) - 0.07 * smooth(0.15, 0.5, t);
  p[I.browTilt] = 0.8; p[I.mouth] = 0.8; p[I.mouthW] = 0.7;
}

// ───────────────────────── borde: agarre y subida ─────────────────────────
// El origen del grupo debe estar en el canto superior (donde acabarán los pies); la pared es el plano z = 0.
export const LEDGE_T = 0.62;
function ledgeHands(p: Pose, w: number) { handAbs(p, 0, w, -0.17, 0.01, -0.05); handAbs(p, 1, w, 0.17, 0.01, -0.05); }
export function poseLedge(p: Pose, c: Ctx) {
  const t = c.t;
  rest(A); A[I.hy] = -0.88; A[I.hz] = 0.21; A[I.hPitch] = -0.08; A[I.nPitch] = -0.45; A[I.sPitch] = -0.1;
  foot(A, 0, -0.09, -1.5, 0.07, -0.5, 0, 0.15); foot(A, 1, 0.09, -1.4, 0.08, -0.5, 0, 0.15); ledgeHands(A, 1);
  A[AB[0] + 3] = -1; A[AB[0] + 4] = -0.4; A[AB[0] + 5] = 0.4; A[AB[1] + 3] = 1; A[AB[1] + 4] = -0.4; A[AB[1] + 5] = 0.4;
  rest(B); B[I.hy] = -0.2; B[I.hz] = 0.13; B[I.hPitch] = 0.6; B[I.sPitch] = 0.15; B[I.nPitch] = -0.5; B[I.stretch] = 1.05;
  foot(B, 0, -0.1, -0.78, 0.07, -0.3, 0, 0.3); foot(B, 1, 0.09, -0.95, 0.09, -0.8, 0, 0.1); ledgeHands(B, 1);
  B[AB[0] + 3] = -1; B[AB[0] + 4] = 0.3; B[AB[0] + 5] = 1; B[AB[1] + 3] = 1; B[AB[1] + 4] = 0.3; B[AB[1] + 5] = 1;
  lerpPose(p, A, B, smooth(0.1, 0.34, t));
  rest(A); A[I.hy] = 0.56; A[I.hz] = -0.12; A[I.hPitch] = 0.62; A[I.sPitch] = 0.2; A[I.nPitch] = -0.45;
  foot(A, 0, -0.09, ANKLE_H, -0.3, 0, 0, 0.2); foot(A, 1, 0.09, 0.13, 0.02, -0.7, 0.7, 0.1); ledgeHands(A, 0);
  hand(A, 0, -0.08, -0.42, -0.05); hand(A, 1, 0.08, -0.36, 0.14);
  lerpPose(p, p, A, smooth(0.3, 0.5, t));
  poseRun(A, c);
  lerpPose(p, p, A, smooth(0.47, LEDGE_T, t));
  p[I.bPitch] += -0.1 * (1 - smooth(0, 0.12, t));
  p[I.browTilt] = 0.7; p[I.mouth] = 0.15;
}

// ───────────────────────── reposo ─────────────────────────
export function poseIdle(p: Pose, c: Ctx) {
  rest(p);
  const t = c.time, br = Math.sin(t * 1.7), sh = Math.sin(t * 0.37);
  p[I.hy] = 0.892 + 0.004 * br; p[I.hx] = 0.022 * sh; p[I.hRoll] = -0.035 * sh; p[I.sRoll] = 0.05 * sh; p[I.hYaw] = 0.06;
  p[I.sPitch] = -0.03 - 0.02 * br; p[I.hPitch] = 0.02;
  const look = Math.sin(t * 0.31) + 0.6 * Math.sin(t * 0.53 + 1.3);
  p[I.nYaw] = 0.34 * look; p[I.nPitch] = -0.05 + 0.06 * Math.sin(t * 0.23 + 0.5); p[I.sYaw] = 0.08 * look;
  foot(p, 0, -0.105, ANKLE_H, 0.03, 0, 0, 0.12, 0.2); foot(p, 1, 0.1, ANKLE_H, -0.03, 0, 0, 0.12, -0.16);
  hand(p, 0, -0.11, -0.47 + 0.006 * br, 0.0, -0.5, 0, 1, -0.1); hand(p, 1, 0.12, -0.465 + 0.006 * br, -0.04, 0.5, 0, 1, -0.1);
  p[I.brow] = 0.15; p[I.mouthW] = 0.3;
}

// ───────────────────────── borde: colgado y subida ─────────────────────────
// Convención (metros, espacio del grupo, frente = -Z): el canto es la arista superior de la pared que tiene delante.
// climbOffset(t) = posición del ORIGEN DEL GRUPO relativa al canto (y arriba, z > 0 = lejos de la pared).
// 'hang': el juego coloca el grupo en canto + climbOffset(0) (pies ~1,8 m bajo el canto) y lo deja ahí.
// 'climb': durante CLIMB_T s el juego coloca el grupo en canto + climbOffset(modeTime); al final está de pie sobre el borde.
export const CLIMB_T = 0.95;
/** pies bajo el canto en 'hang' (m); el grupo cuelga a HANG_WALL m de la pared */
export const HANG_DROP = 1.75, HANG_WALL = 0.38;
const CK = [[0, -HANG_DROP, HANG_WALL], [0.12, -HANG_DROP - 0.07, HANG_WALL], [0.42, -0.95, 0.2], [0.64, -0.56, -0.02], [1, 0, -0.32]];
const CT = CK.map((k, i) => { // tangentes Catmull-Rom no uniformes (extremos en reposo)
  if (i === 0 || i === CK.length - 1) return [0, 0, k[0]];
  const a = CK[i - 1], b = CK[i + 1], dt = b[0] - a[0];
  return [(b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
});
/** t en segundos desde que empezó la subida (0..CLIMB_T). `out` opcional para no reservar memoria. */
export function climbOffset(t: number, out: { y: number; z: number } = { y: 0, z: 0 }) {
  const u = sat(t / CLIMB_T);
  let i = 0; while (i < CK.length - 2 && u > CK[i + 1][0]) i++;
  const a = CK[i], b = CK[i + 1], h = b[0] - a[0], s = (u - a[0]) / h, s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  out.y = h00 * a[1] + h10 * h * CT[i][0] + h01 * b[1] + h11 * h * CT[i + 1][0];
  out.z = h00 * a[2] + h10 * h * CT[i][1] + h01 * b[2] + h11 * h * CT[i + 1][1];
  return out;
}
const CO = { y: 0, z: 0 }, D = newPose();
/** top = 0: muñeca bajo el canto, puño por encima (colgado); top = 1: muñeca sobre el canto, puño apoyado arriba (empuje) */
function grip(p: Pose, cy: number, cz: number, w: number, spread = 0.2, top = 0) { const y = cy - 0.02 + 0.09 * top, z = cz + 0.03 - 0.09 * top; handAbs(p, 0, w, -spread, y, z); handAbs(p, 1, w, spread, y, z); }
function hangKey(p: Pose, c: Ctx, cy: number, cz: number, live: number) {
  rest(p);
  const t = c.time, amp = (0.05 + 0.2 * Math.exp(-c.t * 1.6)) * live, sw = Math.sin(c.t * 3.3) * amp, sw2 = Math.sin(c.t * 3.3 - 0.6) * amp;
  const catchB = c.t < 0.28 ? live * Math.sin(PI * sat(c.t / 0.28)) : 0;
  p[I.hy] = 0.9 - 0.05 * catchB; p[I.hz] = 0.05; p[I.hPitch] = -0.05 - 0.5 * sw; p[I.sPitch] = -0.1 + 0.15 * sw2; p[I.nPitch] = -0.42 + 0.1 * catchB;
  p[I.pivY] = cy; p[I.bPitch] = 0.05 * sw; p[I.hRoll] = 0.04 * Math.sin(t * 1.3) * live;
  const br = 0.006 * Math.sin(t * 2.2);
  foot(p, 0, -0.1, 0.14 + 0.06 * Math.max(0, sw), 0.04 - 0.5 * sw, -0.7, 0, 0.2); foot(p, 1, 0.1, 0.17 + 0.06 * Math.max(0, -sw2), 0.07 - 0.45 * sw2, -0.65, 0, 0.2);
  grip(p, cy + br, cz, 1);
  hand(p, 0, 0, 0.3, 0, -1, -0.35, 0.5, 0.7); hand(p, 1, 0, 0.3, 0, 1, -0.35, 0.5, 0.7);
  p[I.browTilt] = 0.7; p[I.brow] = -0.3; p[I.mouth] = 0.15 + 0.2 * catchB; p[I.mouthW] = 0.4;
}
const HANG_CY = HANG_DROP / K, HANG_CZ = -HANG_WALL / K;
export function poseHang(p: Pose, c: Ctx) { hangKey(p, c, HANG_CY, HANG_CZ, 1); }
export function poseClimb(p: Pose, c: Ctx) {
  const t = c.t, u = sat(t / CLIMB_T);
  climbOffset(t, CO);
  const cy = -CO.y / K, cz = -CO.z / K;
  hangKey(p, c, cy, cz, 1 - smooth(0, 0.1, u));
  // B: empuje explosivo, pecho sobre el borde, rodilla derecha subiendo
  rest(B); B[I.hy] = 0.9; B[I.hz] = 0.02; B[I.hPitch] = 0.5; B[I.sPitch] = 0.28; B[I.nPitch] = -0.4; B[I.stretch] = 1.03; B[I.pivY] = 0.9;
  foot(B, 1, 0.1, 0.52, -0.05, -0.5, 0, 0.25); foot(B, 0, -0.1, 0.2, 0.12, -0.8, 0, 0.1);
  grip(B, cy, cz, 1, 0.21, 1); hand(B, 0, 0, 0, 0, -0.5, 0, 1, 0.9); hand(B, 1, 0, 0, 0, 0.5, 0, 1, 0.9);
  B[I.browTilt] = 0.9; B[I.brow] = -0.6; B[I.mouth] = 0.55; B[I.mouthW] = 0.8;
  lerpPose(p, p, B, smooth(0.06, 0.42, u));
  // C: pie derecho apoyado en el borde, cuerpo plegado encima, manos aún empujando
  rest(C); C[I.hy] = 0.9; C[I.hz] = -0.02; C[I.hPitch] = 0.85; C[I.sPitch] = 0.3; C[I.nPitch] = -0.55; C[I.pivY] = 0.9;
  foot(C, 1, 0.1, cy + ANKLE_H, cz - 0.12, 0, 0, 0.2); foot(C, 0, -0.1, Math.max(0.3, cy - 0.12), cz + 0.2, -0.9, 0, 0.1);
  grip(C, cy, cz, 1, 0.23, 1); hand(C, 0, 0, 0, 0, -0.4, 0, 1, 1.1); hand(C, 1, 0, 0, 0, 0.4, 0, 1, 1.1);
  C[I.browTilt] = 0.8; C[I.mouth] = 0.3;
  lerpPose(p, p, C, smooth(0.4, 0.66, u));
  // D: de pie, listo para correr (las manos sueltan con un barrido hacia atrás)
  rest(D); D[I.hy] = 0.86; D[I.hPitch] = 0.2; D[I.sPitch] = 0.08; D[I.nPitch] = -0.15; D[I.pivY] = 0.9;
  foot(D, 0, -0.1, ANKLE_H, 0.05, 0, 0, 0.1); foot(D, 1, 0.1, ANKLE_H, -0.08, 0, 0, 0.1);
  hand(D, 0, -0.14, -0.4, 0.12, -0.5, 0, 1); hand(D, 1, 0.12, -0.36, -0.12, 0.5, 0, 1);
  lerpPose(p, p, D, smooth(0.64, 1, u));
}

// ───────────────────────── barra ─────────────────────────
/** altura de la barra sobre el origen del grupo (m). El cuerpo gira alrededor de la barra: CharState.swing > 0 = pies hacia delante */
export const SWING_H = 2.0;
/** altura de las manos sobre los pies colgado de la barra con los brazos estirados (m) */
export const SWING_HAND_Y = SWING_H;
export function poseSwing(p: Pose, c: Ctx) {
  rest(p);
  const bar = SWING_H / K, th = c.swing, k1 = Math.tanh(c.swingV / 2.5), front = sat(th / 0.9), back = sat(-th / 0.9);
  p[I.pivY] = bar; p[I.bPitch] = -th; p[I.hy] = bar - 0.952;
  handAbs(p, 0, 1, -0.19, bar, 0); handAbs(p, 1, 1, 0.19, bar, 0);
  hand(p, 0, 0, 0.5, 0, -0.7, 0.2, 0.4, 0.3); hand(p, 1, 0, 0.5, 0, 0.7, 0.2, 0.4, 0.3);
  // arco (hueco) al bajar, carpado delante, "látigo" de piernas en el fondo
  const pike = front * (1 - Math.abs(k1) * 0.6), arch = back * 0.6 + sat(-k1) * 0.35;
  p[I.hPitch] = 0.55 * pike - 0.3 * arch; p[I.sPitch] = -0.2 * arch + 0.15 * pike; p[I.nPitch] = -0.35 + 0.2 * pike;
  const fz = 0.06 - 0.32 * pike + 0.18 * arch + 0.08 * k1, fy = 0.12 + 0.28 * pike;
  foot(p, 0, -0.07, fy, fz, -0.95, 0, 0.1); foot(p, 1, 0.07, fy + 0.02, fz + 0.03, -0.95, 0, 0.1);
  p[I.stretch] = 1.03; p[I.browTilt] = 0.6; p[I.mouth] = 0.35; p[I.mouthW] = 0.5;
}

// ───────────────────────── impulso aéreo (dash) ─────────────────────────
function keyCurl(p: Pose) { // anticipación en el aire: todo recogido
  rest(p);
  p[I.hy] = 0.9; p[I.hPitch] = 0.6; p[I.sPitch] = 0.45; p[I.nPitch] = 0.2; p[I.stretch] = 0.92;
  foot(p, 0, -0.09, 0.52, -0.12, -0.5, 0, 0.15); foot(p, 1, 0.09, 0.46, -0.04, -0.6, 0, 0.15);
  hand(p, 0, 0.05, -0.2, -0.22, -0.8, -0.2, 0.5); hand(p, 1, 0.0, -0.15, 0.1, 0.8, -0.2, 1);
  p[I.browTilt] = 0.9; p[I.brow] = -0.5;
}
export function poseDash(p: Pose, c: Ctx) {
  rest(p);
  const t = c.t, hz = Math.hypot(c.ax, c.az), pitch = Math.atan2(hz, c.ay), yaw = hz > 0.05 ? Math.atan2(-c.ax, -c.az) : 0;
  const snap = smooth(0.05, 0.13, t), o = outBack(sat((t - 0.05) / 0.22)), fl = Math.sin(c.time * 23);
  p[I.pivY] = 0.95; p[I.bPitch] = pitch * (0.3 + 0.7 * snap); p[I.bYaw] = yaw * (0.5 + 0.5 * snap); p[I.bRoll] = 0.025 * fl;
  p[I.hy] = 0.92; p[I.hPitch] = -0.08; p[I.sPitch] = -0.12; p[I.sYaw] = 0.18; p[I.hYaw] = -0.06;
  p[I.nPitch] = -0.15 - 0.75 * Math.sin(Math.min(pitch, PI / 2)); p[I.nYaw] = -0.1;
  // puño derecho por delante (eje del cuerpo), izquierdo pegado atrás, piernas juntas y estiradas
  hand(p, 1, -0.03, 0.47 + 0.03 * o, -0.07, 0.8, -0.3, 0.3, -0.1); hand(p, 0, -0.05, -0.46, 0.16, -0.5, 0, 1, 0.3);
  foot(p, 0, -0.055, 0.09 + 0.01 * fl, 0.04, -1.35, 0, 0.04); foot(p, 1, 0.065, 0.26, 0.17, -1.25, 0, 0.05);
  p[I.stretch] = 1 + 0.09 * o - 0.03 * smooth(0.3, 0.8, t);
  p[I.browTilt] = 1; p[I.brow] = -0.6; p[I.mouth] = 0.2 + 0.5 * (1 - snap); p[I.mouthW] = 0.7;
  if (t < 0.13) { keyCurl(A); lerpPose(p, p, A, 1 - snap); }
}

// ───────────────────────── rebote en sombrilla: voltereta ─────────────────────────
export const BOUNCE_T = 0.75;
function keyTuckAir(p: Pose) {
  rest(p);
  p[I.hy] = 0.92; p[I.hPitch] = 0.95; p[I.sPitch] = 0.7; p[I.nPitch] = 0.45; p[I.hz] = 0.02;
  foot(p, 0, -0.09, 0.66, -0.18, -0.35, 0, 0.18); foot(p, 1, 0.09, 0.64, -0.14, -0.35, 0, 0.18);
  hand(p, 0, 0.06, -0.32, -0.3, -0.7, -0.3, 0.3); hand(p, 1, -0.06, -0.32, -0.3, 0.7, -0.3, 0.3);
  p[I.browTilt] = 0.5; p[I.mouth] = 0.5; p[I.mouthW] = 0.6;
}
export function poseBounce(p: Pose, c: Ctx) {
  const t = c.t, q = sat(t / BOUNCE_T);
  keyUp(p);
  keyTuckAir(A);
  lerpPose(p, p, A, smooth(0.08, 0.3, q) * (1 - smooth(0.68, 0.95, q)));
  keyDown(B); lerpPose(p, p, B, smooth(0.78, 1, q));
  const r = sat((q - 0.06) / 0.78);
  p[I.bPitch] = TAU * (r < 0.5 ? 2 * r * r : 1 - 2 * (1 - r) * (1 - r)); p[I.pivY] = 1.0;
  p[I.stretch] += -0.14 * (1 - smooth(0, 0.06, t)) + 0.1 * Math.sin(PI * sat((t - 0.03) / 0.16));
  p[I.ry] = -0.08 * (1 - smooth(0, 0.08, t));
}

// ───────────────────────── tambaleo en la tormenta ─────────────────────────
export function poseHurt(p: Pose, c: Ctx) {
  if (c.speed > 1) poseRun(p, c); else poseIdle(p, c);
  const t = c.time, f = smooth(0, 0.2, c.t), fl = Math.exp(-c.t * 5) * Math.sin(c.t * 16);
  const n1 = Math.sin(t * 2.1) + 0.5 * Math.sin(t * 5.3 + 1), n2 = Math.sin(t * 1.7 + 2) + 0.4 * Math.sin(t * 6.1);
  p[I.bRoll] += 0.09 * n1 * f; p[I.hRoll] += 0.06 * n2 * f; p[I.hx] += 0.03 * n1 * f; p[I.hy] -= 0.05 * f;
  p[I.sPitch] += (0.32 + 0.08 * n2) * f - 0.45 * fl; p[I.hPitch] += 0.12 * f; p[I.nPitch] += 0.3 * f + 0.3 * fl; p[I.sYaw] += 0.15 * n2 * f;
  const b = AB[1], g = 0.8 * f; // antebrazo derecho tapando la cara
  p[b] += (-0.16 - p[b]) * g; p[b + 1] += (0.2 - p[b + 1]) * g; p[b + 2] += (-0.24 - p[b + 2]) * g; p[b + 3] += (1 - p[b + 3]) * g; p[b + 4] += (-0.2 - p[b + 4]) * g; p[b + 5] += (-0.2 - p[b + 5]) * g;
  p[AB[0]] -= 0.16 * f; p[AB[0] + 1] += 0.14 * f + 0.04 * n1 * f;
  p[I.fLx] -= 0.04 * f; p[I.fRx] += 0.04 * f;
  p[I.brow] = -0.7; p[I.browTilt] = 1; p[I.mouth] = 0.35 + 0.15 * Math.abs(n2); p[I.mouthW] = 0.8;
}

/** desplazamiento lateral: cadera gira hacia el lado, el pecho mira al frente, pasos cruzados e inclinación hacia dentro */
export function applySide(p: Pose, side: number, phase: number) {
  if (Math.abs(side) < 1e-3) return;
  const s = side;
  p[I.hx] += 0.03 * s; p[I.hYaw] += -0.25 * s; p[I.sYaw] += 0.18 * s; p[I.nYaw] += 0.07 * s; p[I.bRoll] -= 0.07 * s;
  for (let k = 0; k < 2; k++) { const b = FB[k], ph = frac(phase + k * 0.5); p[b] += s * (0.05 + 0.075 * Math.sin(TAU * ph)); p[b + 6] += -0.3 * s; }
}

// ───────────────────────── bong ─────────────────────────
const BX = { x: 0, y: 0, z: 0, tilt: 0, scale: 1, hold: 1, burn: 0 }, GP = [0, 0, 0];
const SHC = [[BIND.armL[0] - BIND.chest[0], BIND.armL[1] - BIND.chest[1], BIND.armL[2] - BIND.chest[2]], [BIND.armR[0] - BIND.chest[0], BIND.armR[1] - BIND.chest[1], BIND.armR[2] - BIND.chest[2]]];
export function poseBong(p: Pose, c: Ctx) {
  poseIdle(p, c);
  const t = c.t; bongXform(t, BX);
  const inh = smooth(0.4, 0.7, t) * (1 - smooth(1.85, 2.1, t)), back = smooth(1.95, 2.4, t) * (1 - smooth(2.9, 3.2, t)), ex = smooth(2.4, 2.6, t) * (1 - smooth(3.0, 3.2, t));
  p[I.nYaw] *= 0.2; p[I.sYaw] *= 0.3;
  p[I.nPitch] = 0.1 * smooth(0.1, 0.4, t) * (1 - back) + 0.08 * inh - 0.62 * back;
  p[I.sPitch] = -0.03 - 0.1 * inh - 0.12 * back; p[I.stretch] = 1 + 0.012 * inh * smooth(0.4, 1.9, t);
  p[I.hPitch] = 0.02 - 0.05 * back;
  for (let s = 0; s < 2; s++) {
    bongToChest(BX, BONG_GRIP[s], GP);
    const b = AB[s], w = BX.hold, sg = s ? 1 : -1;
    p[b] += (GP[0] - SHC[s][0] - p[b]) * w; p[b + 1] += (GP[1] - SHC[s][1] - p[b + 1]) * w; p[b + 2] += (GP[2] - SHC[s][2] - p[b + 2]) * w;
    p[b + 3] += (sg * 0.9 - p[b + 3]) * w; p[b + 4] += (-0.6 - p[b + 4]) * w; p[b + 5] += (0.3 - p[b + 5]) * w; p[b + 6] += (0.5 - p[b + 6]) * w;
  }
  p[I.brow] = -0.35 * inh + 0.3 * back; p[I.browTilt] = 0.2; p[I.mouth] = 0.12 * inh + 0.55 * ex; p[I.mouthW] = 0.2 - 0.15 * ex;
}
