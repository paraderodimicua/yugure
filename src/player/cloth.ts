// Tela simulada (Verlet en espacio de mundo): bufanda larga de dos colas, faldones del haori
// y membranas de planeo. Una sola malla dinámica con 2 grupos de material.
import * as THREE from 'three';

export type Ball = { c: THREE.Vector3; r: number };

/** cadena Verlet anclada por el primer punto */
export class Chain {
  pos: Float32Array; prev: Float32Array; n: number; seg: number;
  constructor(n: number, seg: number) { this.n = n; this.seg = seg; this.pos = new Float32Array(n * 3); this.prev = new Float32Array(n * 3); }
  reset(x: number, y: number, z: number, dx: number, dy: number, dz: number) {
    for (let i = 0; i < this.n; i++) { const o = i * 3, d = i * this.seg; this.pos[o] = this.prev[o] = x + dx * d; this.pos[o + 1] = this.prev[o + 1] = y + dy * d; this.pos[o + 2] = this.prev[o + 2] = z + dz * d; }
  }
  shift(dx: number, dy: number, dz: number) { for (let i = 0; i < this.n * 3; i += 3) { this.pos[i] += dx; this.prev[i] += dx; this.pos[i + 1] += dy; this.prev[i + 1] += dy; this.pos[i + 2] += dz; this.prev[i + 2] += dz; } }
  step(h: number, ax: number, ay: number, az: number, g: number, drag: number, flutter: number, time: number, balls: Ball[] | null, floorY: number) {
    const P = this.pos, Q = this.prev, damp = Math.exp(-drag * h), h2 = h * h;
    P[0] = ax; P[1] = ay; P[2] = az;
    for (let i = 1; i < this.n; i++) {
      const o = i * 3;
      let vx = (P[o] - Q[o]) * damp, vy = (P[o + 1] - Q[o + 1]) * damp, vz = (P[o + 2] - Q[o + 2]) * damp;
      const sp = Math.min(Math.hypot(vx, vy, vz) / h, 14), fl = flutter * sp * (i / this.n);
      vy += (-g / (1 + 0.1 * sp) + fl * Math.sin(time * 13 - i * 0.9)) * h2;
      vx += fl * 0.8 * Math.sin(time * 9.7 - i * 0.7 + 1.3) * h2;
      Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2];
      P[o] += vx; P[o + 1] += vy; P[o + 2] += vz;
    }
    for (let it = 0; it < 2; it++) for (let i = 1; i < this.n; i++) {
      const o = i * 3, q = o - 3;
      let dx = P[o] - P[q], dy = P[o + 1] - P[q + 1], dz = P[o + 2] - P[q + 2];
      const l = Math.hypot(dx, dy, dz) || 1e-6, k = (l - this.seg) / l, wa = i === 1 || it === 1 ? 0 : 0.5, wb = 1 - wa;
      dx *= k; dy *= k; dz *= k;
      P[q] += dx * wa; P[q + 1] += dy * wa; P[q + 2] += dz * wa; P[o] -= dx * wb; P[o + 1] -= dy * wb; P[o + 2] -= dz * wb;
    }
    for (let i = 1; i < this.n; i++) {
      const o = i * 3;
      if (balls) for (const b of balls) {
        const dx = P[o] - b.c.x, dy = P[o + 1] - b.c.y, dz = P[o + 2] - b.c.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < b.r * b.r) { const d = Math.sqrt(d2) || 1e-6, k = b.r / d; P[o] = b.c.x + dx * k; P[o + 1] = b.c.y + dy * k; P[o + 2] = b.c.z + dz * k; }
      }
      if (P[o + 1] < floorY) { P[o + 1] = floorY; Q[o] += (P[o] - Q[o]) * 0.3; Q[o + 2] += (P[o + 2] - Q[o + 2]) * 0.3; }
    }
  }
}

type Surf = { w: number; h: number; pts: Float32Array; base: number };
const TW = 9, TH = 5, TSEG = 0.085, NA = 14, NB = 8, MW = 3, MH = 4;

export function createCloth(matRed: THREE.Material, matHaori: THREE.Material) {
  const surfs: Surf[] = [];
  let nv = 0;
  const surf = (w: number, h: number): Surf => { const s = { w, h, pts: new Float32Array(w * h * 3), base: nv }; nv += w * h * 2; surfs.push(s); return s; };
  const sA = surf(2, NA), sB = surf(2, NB), sT = surf(TW, TH), sML = surf(MW, MH), sMR = surf(MW, MH);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idxRed: number[] = [], idxHaori: number[] = [];
  // cara "front" = orden (i,j),(i+1,j),(i,j+1); cara "back" = vértices duplicados con normal opuesta
  const tris = (s: Surf, front: number[], back: number[]) => {
    const n = s.w * s.h;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) { const v = s.base + j * s.w + i; uv[v * 2] = uv[(v + n) * 2] = i / (s.w - 1); uv[v * 2 + 1] = uv[(v + n) * 2 + 1] = j / (s.h - 1) * (s.h / 4); }
    for (let j = 0; j < s.h - 1; j++) for (let i = 0; i < s.w - 1; i++) {
      const a = s.base + j * s.w + i, b = a + 1, c = a + s.w, d = c + 1;
      front.push(a, b, c, b, d, c); back.push(a + n, c + n, b + n, b + n, c + n, d + n);
    }
  };
  tris(sA, idxRed, idxRed); tris(sB, idxRed, idxRed);
  tris(sT, idxHaori, idxRed); tris(sML, idxHaori, idxRed); tris(sMR, idxHaori, idxRed);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aNor = new THREE.BufferAttribute(nor, 3);
  aPos.setUsage(THREE.DynamicDrawUsage); aNor.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('normal', aNor); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3).fill(1), 3));
  geo.setIndex([...idxRed, ...idxHaori]);
  geo.addGroup(0, idxRed.length, 0); geo.addGroup(idxRed.length, idxHaori.length, 1);
  const mesh = new THREE.Mesh(geo, [matRed, matHaori]);
  mesh.frustumCulled = false; mesh.castShadow = true;

  const chA = new Chain(NA, 0.095), chB = new Chain(NB, 0.08);
  const cols: Chain[] = [];
  for (let i = 0; i < TW; i++) cols.push(new Chain(TH, TSEG));
  let inited = false, acc = 0;
  const last = new THREE.Vector3(), v = new THREE.Vector3(), inv = new THREE.Matrix4();
  const pinPrev = new Float32Array((TW + 2) * 3), pinNow = new Float32Array((TW + 2) * 3);
  const t = new THREE.Vector3(), n = new THREE.Vector3(), w = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();

  function ribbon(ch: Chain, s: Surf, w0: number, w1: number, time: number, ph: number) {
    const P = ch.pos;
    for (let i = 0; i < ch.n; i++) {
      const o = i * 3, a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, ch.n - 1) * 3;
      c.set(P[o], P[o + 1], P[o + 2]).applyMatrix4(inv);
      t.set(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]).transformDirection(inv);
      n.set(0, 1, 0.4); n.addScaledVector(t, -n.dot(t));
      if (n.lengthSq() < 0.02) n.set(0.3, 0, 1).addScaledVector(t, -t.z); n.normalize();
      w.crossVectors(t, n);
      const u = i / (ch.n - 1), tw = 0.55 * Math.sin(time * 2.6 - i * 0.55 + ph) * u + ph * 0.3;
      w.multiplyScalar(Math.cos(tw)).addScaledVector(n, Math.sin(tw));
      const hw = (w0 + (w1 - w0) * u) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, u * 1.6))) * (u > 0.93 ? 0.55 : 1);
      const k = i * 6;
      s.pts[k] = c.x - w.x * hw; s.pts[k + 1] = c.y - w.y * hw; s.pts[k + 2] = c.z - w.z * hw;
      s.pts[k + 3] = c.x + w.x * hw; s.pts[k + 4] = c.y + w.y * hw; s.pts[k + 5] = c.z + w.z * hw;
    }
  }
  function writeSurf(s: Surf) {
    const nn = s.w * s.h, p = s.pts;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const k = (j * s.w + i) * 3, i0 = (j * s.w + Math.max(i - 1, 0)) * 3, i1 = (j * s.w + Math.min(i + 1, s.w - 1)) * 3, j0 = (Math.max(j - 1, 0) * s.w + i) * 3, j1 = (Math.min(j + 1, s.h - 1) * s.w + i) * 3;
      e1.set(p[i1] - p[i0], p[i1 + 1] - p[i0 + 1], p[i1 + 2] - p[i0 + 2]); e2.set(p[j1] - p[j0], p[j1 + 1] - p[j0 + 1], p[j1 + 2] - p[j0 + 2]);
      n.crossVectors(e1, e2); const l = n.length(); if (l > 1e-9) n.multiplyScalar(1 / l); else n.set(0, 1, 0);
      const a = (s.base + j * s.w + i) * 3, b = a + nn * 3;
      pos[a] = pos[b] = p[k]; pos[a + 1] = pos[b + 1] = p[k + 1]; pos[a + 2] = pos[b + 2] = p[k + 2];
      nor[a] = n.x; nor[a + 1] = n.y; nor[a + 2] = n.z; nor[b] = -n.x; nor[b + 1] = -n.y; nor[b + 2] = -n.z;
    }
  }

  /**
   * pins: [bufandaA, bufandaB, faldón0..faldón8] en mundo. arms: por lado [hombro, codo, muñeca, axila, cintura] en mundo.
   */
  function update(dt: number, time: number, group: THREE.Object3D, pins: THREE.Vector3[], arms: THREE.Vector3[][], balls: Ball[], legBalls: Ball[], floorY: number, glide: number) {
    for (let i = 0; i < TW + 2; i++) { pinNow[i * 3] = pins[i].x; pinNow[i * 3 + 1] = pins[i].y; pinNow[i * 3 + 2] = pins[i].z; }
    v.setFromMatrixPosition(group.matrixWorld);
    if (!inited || v.distanceTo(last) > 4) {
      const dx = inited ? v.x - last.x : 0, dy = inited ? v.y - last.y : 0, dz = inited ? v.z - last.z : 0;
      if (!inited) {
        chA.reset(pins[0].x, pins[0].y, pins[0].z, 0, -0.9, 0.3); chB.reset(pins[1].x, pins[1].y, pins[1].z, 0, -0.9, 0.3);
        for (let i = 0; i < TW; i++) cols[i].reset(pins[i + 2].x, pins[i + 2].y, pins[i + 2].z, 0, -1, 0);
      } else { chA.shift(dx, dy, dz); chB.shift(dx, dy, dz); for (const cc of cols) cc.shift(dx, dy, dz); }
      pinPrev.set(pinNow); inited = true; acc = 0;
    }
    last.copy(v);
    acc = Math.min(acc + dt, 0.06);
    const H = 1 / 90, steps = Math.floor(acc / H);
    for (let sI = 1; sI <= steps; sI++) {
      const f = sI / steps, tt = time - (steps - sI) * H;
      const px = (i: number, k: number) => pinPrev[i * 3 + k] + (pinNow[i * 3 + k] - pinPrev[i * 3 + k]) * f;
      chA.step(H, px(0, 0), px(0, 1), px(0, 2), 7, 3.6, 1.5, tt, balls, floorY);
      chB.step(H, px(1, 0), px(1, 1), px(1, 2), 7, 4.2, 1.6, tt + 1.7, balls, floorY);
      for (let i = 0; i < TW; i++) cols[i].step(H, px(i + 2, 0), px(i + 2, 1), px(i + 2, 2), 11, 5.5, 0.5, tt + i * 0.8, legBalls, -1e9);
      // costuras horizontales de los faldones (se abren hacia abajo)
      for (let j = 1; j < TH; j++) for (let i = 0; i < TW - 1; i++) {
        const A = cols[i].pos, B = cols[i + 1].pos, o = j * 3;
        const base = Math.hypot(pinNow[(i + 2) * 3] - pinNow[(i + 3) * 3], pinNow[(i + 2) * 3 + 1] - pinNow[(i + 3) * 3 + 1], pinNow[(i + 2) * 3 + 2] - pinNow[(i + 3) * 3 + 2]);
        const rest = base * (1 + 0.16 * j);
        let dx = B[o] - A[o], dy = B[o + 1] - A[o + 1], dz = B[o + 2] - A[o + 2];
        const l = Math.hypot(dx, dy, dz) || 1e-6;
        if (l > rest * 1.1 || l < rest * 0.8) {
          const k = ((l - (l > rest ? rest * 1.1 : rest * 0.8)) / l) * 0.5;
          dx *= k; dy *= k; dz *= k; A[o] += dx; A[o + 1] += dy; A[o + 2] += dz; B[o] -= dx; B[o + 1] -= dy; B[o + 2] -= dz;
        }
      }
    }
    if (steps > 0) { acc -= steps * H; pinPrev.set(pinNow); }

    inv.copy(group.matrixWorld).invert();
    ribbon(chA, sA, 0.085, 0.07, time, 0); ribbon(chB, sB, 0.07, 0.055, time, 1.9);
    for (let i = 0; i < TW; i++) for (let j = 0; j < TH; j++) {
      const o = j * 3, k = (j * TW + i) * 3;
      c.set(cols[i].pos[o], cols[i].pos[o + 1], cols[i].pos[o + 2]).applyMatrix4(inv);
      sT.pts[k] = c.x; sT.pts[k + 1] = c.y; sT.pts[k + 2] = c.z;
    }
    // membranas de planeo: del brazo al costado y a la esquina del faldón
    for (let sdI = 0; sdI < 2; sdI++) {
      const s = sdI ? sMR : sML, a = arms[sdI], col = cols[sdI ? 2 : TW - 3].pos, g = Math.min(1, Math.max(0, glide));
      for (let i = 0; i < MW; i++) {
        e1.copy(a[i]).applyMatrix4(inv);
        if (i < 2) e2.copy(a[3 + i]).applyMatrix4(inv); else e2.set(col[(TH - 1) * 3], col[(TH - 1) * 3 + 1], col[(TH - 1) * 3 + 2]).applyMatrix4(inv);
        if (i === 0) { t.copy(e1); n.copy(e2); }
        for (let j = 0; j < MH; j++) {
          const u = j / (MH - 1), k = (j * MW + i) * 3;
          c.lerpVectors(e2, e1, g < 0.02 ? 0 : (1 - u) * g);
          if (g < 0.02) c.copy(n);
          const bil = Math.sin(Math.PI * u) * (0.05 + 0.025 * Math.sin(time * 11 + i * 1.7 + sdI)) * g * (i === 0 ? 0.3 : 1);
          s.pts[k] = c.x; s.pts[k + 1] = c.y; s.pts[k + 2] = c.z + bil;
        }
      }
    }
    for (const s of surfs) writeSurf(s);
    aPos.needsUpdate = true; aNor.needsUpdate = true;
  }
  /** punta de la bufanda larga (mundo) */
  const tip = (out: THREE.Vector3) => out.fromArray(chA.pos, (NA - 1) * 3);
  return { mesh, update, tip, tris: (idxRed.length + idxHaori.length) / 3, TW };
}
