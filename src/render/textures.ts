// Texturas procedurales de detalle (sin archivos externos). Todas son baldosas repetibles y se generan
// una sola vez, de forma perezosa, la primera vez que un material que las usa se compila.
// Formato común (RGBA8 lineal): RG = pendiente del relieve (dh/du, dh/dv), B = tono (0.5 neutro),
// A = máscara continua de desgaste/suciedad (el material la umbraliza a su gusto).
// userData.tile = metros que cubre una repetición; userData.slope = pendiente codificada en RG = ±1.
import * as THREE from 'three';

export type TexKind =
  | 'wood' | 'plaster' | 'kawara' | 'stone' | 'cobble' | 'concrete' | 'earth' | 'metal'
  | 'washi' | 'weave' | 'bamboo' | 'bark' | 'leaves' | 'moss' | 'rope' | 'thatch' | 'ripple' | 'macro';

type Out = { h: number; t: number; m: number };
type N2 = (u: number, v: number) => number;

const sat = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ss = (a: number, b: number, x: number) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fr = (x: number) => x - Math.floor(x);
const wrapd = (d: number) => d - Math.round(d);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const arr = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));

// Ruido de valor periódico (periodo 1 en u y v) con frecuencias independientes por eje.
function noiseFn(fx: number, fy: number, seed: number): N2 {
  const r = rng(seed), g = new Float32Array(fx * fy);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (u, v) => {
    const x = u * fx, y = v * fy;
    let ix = Math.floor(x), iy = Math.floor(y);
    let tx = x - ix, ty = y - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    ix = ((ix % fx) + fx) % fx; iy = ((iy % fy) + fy) % fy;
    const ix1 = ix + 1 === fx ? 0 : ix + 1, iy1 = iy + 1 === fy ? 0 : iy + 1;
    const a = g[iy * fx + ix], b = g[iy * fx + ix1], c = g[iy1 * fx + ix], d = g[iy1 * fx + ix1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
// fbm normalizado y con contraste ampliado para que ocupe bien 0..1 (media 0.5).
function fbmFn(fx: number, fy: number, oct: number, seed: number, gain = 0.5): N2 {
  const fs: N2[] = [], am: number[] = [];
  let a = 1, tot = 0;
  for (let o = 0; o < oct; o++) { fs.push(noiseFn(fx << o, fy << o, seed + o * 101)); am.push(a); tot += a; a *= gain; }
  return (u, v) => {
    let s = 0;
    for (let i = 0; i < oct; i++) s += am[i] * fs[i](u, v);
    return sat((s / tot - 0.5) * 1.9 + 0.5);
  };
}
// Celdas (Worley) periódicas. Distancias en unidades de celda.
function worley(cx: number, cy: number, seed: number, jit = 1) {
  const r = rng(seed), px = new Float32Array(cx * cy), py = new Float32Array(cx * cy), id = new Float32Array(cx * cy);
  for (let i = 0; i < px.length; i++) { px[i] = 0.5 + (r() - 0.5) * jit; py[i] = 0.5 + (r() - 0.5) * jit; id[i] = r(); }
  const o = { f1: 0, f2: 0, id: 0, dx: 0, dy: 0 };
  return (u: number, v: number) => {
    const x = u * cx, y = v * cy, ix = Math.floor(x), iy = Math.floor(y);
    let f1 = 99, f2 = 99;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const k = ((((iy + j) % cy) + cy) % cy) * cx + ((((ix + i) % cx) + cx) % cx);
      const dx = ix + i + px[k] - x, dy = iy + j + py[k] - y, d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; f1 = d; o.id = id[k]; o.dx = dx; o.dy = dy; } else if (d < f2) f2 = d;
    }
    o.f1 = Math.sqrt(f1); o.f2 = Math.sqrt(f2);
    return o;
  };
}

// Versión en campo (rápida) del ruido de valor: rellena n×n de una vez.
function nz(n: number, fx: number, fy: number, seed: number): Float32Array {
  fx = Math.min(fx, n >> 1) || 1; fy = Math.min(fy, n >> 1) || 1;
  const r = rng(seed), g = new Float32Array(fx * fy), out = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const x0 = new Int32Array(n), x1 = new Int32Array(n), tx = new Float32Array(n);
  for (let x = 0; x < n; x++) {
    const p = (x + 0.5) / n * fx, ip = Math.floor(p), t = p - ip;
    x0[x] = ip % fx; x1[x] = (ip + 1) % fx; tx[x] = t * t * (3 - 2 * t);
  }
  for (let y = 0, i = 0; y < n; y++) {
    const p = (y + 0.5) / n * fy, ip = Math.floor(p);
    let ty = p - ip; ty = ty * ty * (3 - 2 * ty);
    const r0 = (ip % fy) * fx, r1 = ((ip + 1) % fy) * fx;
    for (let x = 0; x < n; x++, i++) {
      const a = g[r0 + x0[x]], c = g[r1 + x0[x]], t = tx[x];
      const top = a + (g[r0 + x1[x]] - a) * t, bot = c + (g[r1 + x1[x]] - c) * t;
      out[i] = top + (bot - top) * ty;
    }
  }
  return out;
}
// fbm en campo, normalizado y con contraste ampliado (media 0.5, ocupa bien 0..1).
function fb(n: number, fx: number, fy: number, oct: number, seed: number, gain = 0.5): Float32Array {
  const out = new Float32Array(n * n);
  let a = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const f = nz(n, fx << o, fy << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += f[i] * a;
    tot += a; a *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] = sat((out[i] / tot - 0.5) * 1.9 + 0.5);
  return out;
}

function finish(d: Uint8Array, n: number, tile: number) {
  const tex = new THREE.DataTexture(d as unknown as BufferSource, n, n, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.userData.tile = tile;
  tex.needsUpdate = true;
  return tex;
}

// Evalúa fn por texel (altura en metros, tono, máscara) y empaqueta. cav = oscurecido de cavidades.
function gen(n: number, tile: number, cav: number, fn: (i: number, x: number, y: number, u: number, v: number, o: Out) => void, post?: (h: Float32Array, t: Float32Array, m: Float32Array) => void) {
  const h = new Float32Array(n * n), t = new Float32Array(n * n), m = new Float32Array(n * n);
  const o: Out = { h: 0, t: 0.5, m: 0 };
  for (let y = 0, i = 0; y < n; y++) for (let x = 0; x < n; x++, i++) {
    fn(i, x, y, (x + 0.5) / n, (y + 0.5) / n, o);
    h[i] = o.h; t[i] = o.t; m[i] = o.m;
  }
  if (post) post(h, t, m);
  return pack(n, tile, cav, h, t, m);
}
function pack(n: number, tile: number, cav: number, h: Float32Array, t: Float32Array, m: Float32Array) {
  const d = new Uint8Array(n * n * 4), k = n / tile * 0.5, msk = n - 1;
  const gx = new Float32Array(n * n), gy = new Float32Array(n * n), sample: number[] = [];
  for (let y = 0, i = 0; y < n; y++) {
    const ya = ((y + 1) & msk) * n, yb = ((y - 1) & msk) * n, yc = y * n;
    for (let x = 0; x < n; x++, i++) {
      gx[i] = (h[yc + ((x + 1) & msk)] - h[yc + ((x - 1) & msk)]) * k;
      gy[i] = (h[ya + x] - h[yb + x]) * k;
      if (i % 29 === 0) sample.push(Math.max(Math.abs(gx[i]), Math.abs(gy[i])));
    }
  }
  sample.sort((a, b) => a - b);
  const G = Math.min(Math.max(sample[Math.floor(sample.length * 0.995)], 0.02), 3);
  const cs = cav * k / G * 0.35, ig = 127 / G;
  for (let y = 0, i = 0; y < n; y++) {
    const ya = ((y + 3) & msk) * n, yb = ((y - 3) & msk) * n, yc = y * n;
    for (let x = 0; x < n; x++, i++) {
      let tone = t[i];
      if (cav > 0) {
        const c = ((h[yc + ((x + 3) & msk)] + h[yc + ((x - 3) & msk)] + h[ya + x] + h[yb + x]) * 0.25 - h[i]) * cs;
        tone -= c < -0.6 * cav ? -0.6 * cav : c > cav ? cav : c;
      }
      const a = gx[i] * ig, b = gy[i] * ig, j = i * 4;
      d[j] = 128 + Math.round(a < -127 ? -127 : a > 127 ? 127 : a);
      d[j + 1] = 128 + Math.round(b < -127 ? -127 : b > 127 ? 127 : b);
      d[j + 2] = Math.round(sat(tone) * 255);
      d[j + 3] = Math.round(sat(m[i]) * 255);
    }
  }
  const tex = finish(d, n, tile);
  tex.userData.slope = G;
  return tex;
}

// ---------------------------------------------------------------- patrones

// Tablones a lo largo de V: veta tipo "catedral", vetas finas, nudos, juntas y zonas agrisadas.
function wood() {
  const n = 512, msk = n - 1, T = 1.6, P = 8, r = rng(11);
  const pTone = arr(P, () => (r() - 0.5) * 0.3), oy = arr(P, () => Math.floor(r() * n)), sx = arr(P, () => Math.floor(r() * n));
  const pJoint = arr(P, r), pRing = arr(P, () => 7 + r() * 9), pShift = arr(P, () => r() - 0.5);
  const streak = nz(n, 256, 5, 21), streak2 = nz(n, 96, 3, 22), warp = fb(n, 2, 3, 3, 23), blot = fb(n, 5, 5, 4, 24), fine = nz(n, 256, 48, 25), wear = fb(n, 6, 3, 4, 26);
  const K = new Float32Array(n * n);
  for (let q = 0; q < 9; q++) {
    const ku = r() * n, kv = r() * n, kr = (0.012 + r() * 0.016) / T * n, R = Math.ceil(kr * 6);
    for (let dy = -R; dy <= R; dy++) for (let dx = -Math.ceil(kr * 2.5); dx <= kr * 2.5; dx++) {
      const dv = dy / 2.4;
      K[((Math.floor(kv) + dy) & msk) * n + ((Math.floor(ku) + dx) & msk)] += Math.exp(-(dx * dx + dv * dv) / (kr * kr));
    }
  }
  return gen(n, T, 0.25, (i, x, y, u, v, o) => {
    const pu = u * P, pi = Math.floor(pu), pf = pu - pi;
    const j = ((y + oy[pi]) & msk) * n + x, jw = ((y + oy[pi]) & msk) * n + ((x + sx[pi]) & msk);
    const edge = Math.min(pf, 1 - pf) * (T / P);
    const dj = Math.abs(wrapd(v - pJoint[pi])) * T;
    const me = Math.min(edge, dj), gap = 1 - ss(0.0015, 0.007, me);
    const kn = Math.min(K[i], 1.5);
    const s = streak[j], fi = fine[j];
    const rc = Math.abs(pf - 0.5 - pShift[pi] * 0.7 - (warp[jw] - 0.5) * 1.6) * pRing[pi] + kn * 2.5 + (streak2[jw] - 0.5) * 0.7;
    const f = rc - Math.floor(rc), line = ss(0.45, 0.93, f) * (1 - ss(0.93, 1, f));
    o.h = -gap * 0.004 - line * 0.0007 - (s - 0.5) * 0.0007 + (fi - 0.5) * 0.0003 - kn * 0.0008;
    o.t = 0.5 + pTone[pi] - line * 0.2 + (s - 0.5) * 0.2 + (blot[i] - 0.5) * 0.16 - gap * 0.4 - kn * 0.26 + (fi - 0.5) * 0.06;
    o.m = wear[j] * 0.8 + (s - 0.5) * 0.35 + gap * 0.2 + (1 - ss(0, 0.03, me)) * 0.14 + 0.08;
  });
}

// Yeso/estuco: grano, pasadas de llana, grietas finas, desconchones y manchas de humedad con chorretones.
function plaster() {
  const n = 512, T = 3;
  const grain = fb(n, 110, 110, 2, 31), und = fb(n, 5, 7, 3, 32), cwA = fb(n, 6, 6, 3, 33), cwB = fb(n, 6, 6, 3, 330), wc = worley(5, 5, 34), reg = fb(n, 3, 3, 3, 35);
  const stain = fb(n, 3, 3, 5, 36), stain2 = fb(n, 2, 2, 3, 360), drip = nz(n, 56, 2, 37), chipN = fb(n, 7, 7, 4, 38), brush = nz(n, 20, 150, 39);
  return gen(n, T, 0.2, (i, _x, _y, u, v, o) => {
    const c = wc(u + (cwA[i] - 0.5) * 0.09, v + (cwB[i] - 0.5) * 0.09), e = c.f2 - c.f1;
    const crack = (1 - ss(0.006, 0.024, e)) * ss(0.42, 0.6, reg[i]);
    const g = grain[i], un = und[i], br = brush[i];
    const chip = ss(0.8, 0.84, chipN[i] + 0.06 * g);
    o.h = (g - 0.5) * 0.0014 + (un - 0.5) * 0.005 - crack * 0.004 - chip * 0.004 + chip * (g - 0.5) * 0.002 + (br - 0.5) * 0.001;
    o.t = 0.5 + (un - 0.5) * 0.14 + (g - 0.5) * 0.12 - crack * 0.42 - chip * 0.2 + (br - 0.5) * 0.09;
    o.m = stain[i] * 0.78 + (drip[i] - 0.5) * 0.45 * stain2[i] + crack * 0.3 + chip * 0.45 + 0.1;
  });
}

// Teja japonesa (hon-kawara): canal cóncavo + cobija semicilíndrica, hiladas solapadas a lo largo de V.
function kawara() {
  const n = 512, T = 1, C = 4, R = 4, r = rng(41), PAN = 0.58;
  const tp = arr(C * R, () => (r() - 0.5) * 0.24), tc = arr(C * R, () => (r() - 0.5) * 0.24);
  const lich = nz(n, 44, 44, 42), dirt = fb(n, 6, 6, 4, 43), fine = fb(n, 72, 72, 2, 44), big = fb(n, 3, 3, 3, 45);
  return gen(n, T, 0.3, (i, _x, _y, u, v, o) => {
    const cu = u * C, ci = Math.floor(cu), cf = cu - ci, rv = v * R, ri = Math.floor(rv), rf = rv - ri;
    const id = ri * C + ci, fi = fine[i], di = dirt[i];
    let prof: number, tone: number, valley = 0, crease = 0;
    if (cf < PAN) { const a = (cf / PAN) * 2 - 1; prof = 0.014 * a * a; tone = tp[id]; valley = 1 - a * a; }
    else { const s = ((cf - PAN) / (1 - PAN)) * 2 - 1; const c = Math.sqrt(Math.max(0, 1 - s * s)); prof = 0.014 + 0.042 * c; tone = tc[id] + 0.05; crease = 1 - ss(0, 0.5, c); }
    const sh = 1 - ss(0, 0.11, rf), lip = ss(0.9, 0.98, rf);
    const spot = ss(0.74, 0.84, lich[i]);
    o.h = prof + rf * 0.016 + (fi - 0.5) * 0.0012;
    o.t = 0.5 + tone + lip * 0.12 - sh * 0.32 - crease * 0.2 + (fi - 0.5) * 0.1 + (big[i] - 0.5) * 0.1;
    o.m = valley * di * 0.75 + sh * 0.3 + crease * 0.25 + spot * 0.5 + di * 0.25;
  });
}

// Sillería irregular por hiladas: bloques de ancho variable, cara labrada, juntas hundidas con musgo.
function stone() {
  const n = 512, msk = n - 1, T = 2, R = 6, r = rng(51);
  const rows = arr(R, () => 0).map(() => {
    const k = 3 + Math.floor(r() * 2), w = arr(k, () => 0.6 + r()), sum = w.reduce((a, b) => a + b, 0);
    let c = 0; const cum = [0, ...w.map((x) => (c += x / sum))];
    return { off: r(), cum, tone: arr(k, () => (r() - 0.5) * 0.3), lvl: arr(k, () => r() - 0.5), sh: arr(k, () => Math.floor(r() * n)) };
  });
  const edgeN = fb(n, 14, 14, 3, 52), face = fb(n, 34, 34, 3, 53), low = fb(n, 5, 5, 3, 54), speck = nz(n, 256, 256, 55), mossN = fb(n, 5, 5, 4, 56);
  return gen(n, T, 0.3, (i, x, y, u, v, o) => {
    const rv = v * R, ri = Math.floor(rv), rf = rv - ri, row = rows[ri];
    const uu = fr(u - row.off + 1);
    let b = 0; while (b < row.cum.length - 2 && uu >= row.cum[b + 1]) b++;
    const du = Math.min(uu - row.cum[b], row.cum[b + 1] - uu) * T, dv = Math.min(rf, 1 - rf) * (T / R);
    const d = Math.min(du, dv) + (edgeN[i] - 0.5) * 0.016;
    const joint = 1 - ss(0.003, 0.024, d);
    const fa = face[((y + row.sh[b]) & msk) * n + ((x + row.sh[b] * 3) & msk)], lo = low[i];
    o.h = -joint * 0.016 + (fa - 0.5) * 0.006 + row.lvl[b] * 0.005 + (lo - 0.5) * 0.004;
    o.t = 0.5 + row.tone[b] + (fa - 0.5) * 0.2 + (speck[i] - 0.5) * 0.1 - joint * 0.34 + (lo - 0.5) * 0.1;
    o.m = joint * 0.42 + mossN[i] * 0.62 + (1 - ss(0, 0.1, rf * (T / R))) * 0.14 + (fa - 0.5) * 0.12;
  });
}

// Adoquín redondeado con juntas de tierra.
function cobble() {
  const n = 512, T = 2, w = worley(12, 12, 61, 0.78), r = rng(62);
  const tones = arr(64, () => (r() - 0.5) * 0.34);
  const wa = fb(n, 8, 8, 2, 63), wb = fb(n, 8, 8, 2, 630), fine = fb(n, 64, 64, 3, 64), low = fb(n, 4, 4, 4, 65);
  return gen(n, T, 0.3, (i, _x, _y, u, v, o) => {
    const c = w(u + (wa[i] - 0.5) * 0.02, v + (wb[i] - 0.5) * 0.02);
    const e = c.f2 - c.f1, fi = fine[i];
    const dome = Math.pow(ss(0.0, 0.42, e), 0.6), joint = 1 - ss(0.03, 0.13, e);
    const id = Math.floor(c.id * 64) & 63;
    o.h = dome * 0.022 + (c.dx * (tones[id] * 2) + c.dy * (tones[(id + 7) & 63] * 2)) * 0.006 + (fi - 0.5) * 0.003;
    o.t = 0.5 + tones[id] + (dome - 0.6) * 0.24 + (fi - 0.5) * 0.16 - joint * 0.3;
    o.m = joint * 0.55 + low[i] * 0.5 + (fi - 0.5) * 0.15;
  });
}

// Hormigón: moteado, poros, líneas de encofrado, agujeros de tirante y chorretones.
function concrete() {
  const n = 512, T = 3;
  const mot = fb(n, 5, 5, 5, 71), sand = fb(n, 170, 170, 2, 72), por = nz(n, 120, 120, 73), drip = nz(n, 70, 2, 74), dripM = fb(n, 3, 2, 4, 75), dripM2 = fb(n, 3, 2, 3, 750);
  const r = rng(76), pt = arr(8, () => (r() - 0.5) * 0.1);
  return gen(n, T, 0.2, (i, _x, _y, u, v, o) => {
    const pore = ss(0.8, 0.9, por[i]);
    const lv = v * 4, lu = u * 2;
    const dv = Math.abs(wrapd(lv)) / 4 * T, du = Math.abs(wrapd(lu)) / 2 * T;
    const line = 1 - ss(0.003, 0.011, Math.min(du, dv));
    const hu = Math.abs(wrapd(u * 4 - 0.5)) / 4 * T, hv = Math.abs(wrapd(lv - 0.5)) / 4 * T;
    const hole = 1 - ss(0.011, 0.017, Math.hypot(hu, hv));
    const mo = mot[i], sa = sand[i];
    const panel = pt[(Math.floor(lv) * 2 + Math.floor(lu)) & 7];
    o.h = (sa - 0.5) * 0.001 - pore * 0.0025 - line * 0.003 - hole * 0.007 + (mo - 0.5) * 0.002;
    o.t = 0.5 + (mo - 0.5) * 0.3 + (sa - 0.5) * 0.12 - pore * 0.3 - line * 0.22 - hole * 0.42 + panel;
    o.m = dripM[i] * 0.62 + (drip[i] - 0.3) * 0.5 * dripM2[i] + line * 0.18 + 0.05;
  });
}

// Tierra apisonada con terrones y guijarros.
function earth() {
  const n = 512, T = 2.5;
  const lump = fb(n, 22, 22, 4, 81), low = fb(n, 4, 4, 4, 82), low2 = fb(n, 5, 5, 4, 83), peb = worley(34, 34, 84, 0.9), fine = nz(n, 220, 220, 85);
  return gen(n, T, 0.3, (i, _x, _y, u, v, o) => {
    const p = peb(u, v), has = p.id > 0.68, rad = 0.2 + 0.28 * fr(p.id * 7.13);
    const dome = has ? Math.sqrt(Math.max(0, 1 - (p.f1 / rad) * (p.f1 / rad))) : 0;
    const lu = lump[i], fi = fine[i];
    o.h = (lu - 0.5) * 0.014 + dome * 0.012 + (fi - 0.5) * 0.0012;
    o.t = 0.5 + (lu - 0.5) * 0.34 + (low[i] - 0.5) * 0.26 + (dome > 0 ? 0.1 + (fr(p.id * 3.7) - 0.5) * 0.3 : 0) + (fi - 0.5) * 0.1;
    o.m = low2[i] * 0.85 + (lu - 0.5) * 0.3 + 0.07 - dome * 0.3;
  });
}

// Metal pintado: la máscara marca dónde salta la pintura y aflora el óxido (borde nítido), con picaduras.
function metal() {
  const n = 512, T = 1.5;
  const c = fb(n, 5, 5, 5, 91), hi = fb(n, 56, 56, 3, 92), st = nz(n, 96, 2, 93), mot = fb(n, 7, 7, 3, 94), pit = fb(n, 128, 128, 2, 95);
  return gen(n, T, 0.15, (i, _x, _y, _u, _v, o) => {
    const h1 = hi[i], s = st[i], mo = mot[i], pi = pit[i];
    const a = c[i] * 0.8 + h1 * 0.2 + (s - 0.5) * 0.1;
    const rust = ss(0.52, 0.6, a);
    o.h = (1 - ss(0.565, 0.585, a)) * 0.0005 + rust * (pi - 0.5) * 0.0014 + (mo - 0.5) * 0.0005;
    o.t = 0.5 + (mo - 0.5) * 0.16 + (s - 0.5) * 0.12 + rust * ((pi - 0.5) * 0.5 + (h1 - 0.5) * 0.4) - (ss(0.53, 0.575, a) - ss(0.575, 0.65, a)) * 0.14;
    o.m = a;
  });
}

// Papel washi: nubes de pulpa y fibras largas dispersas.
function washi() {
  const n = 512, T = 0.6, r = rng(101), F = new Float32Array(n * n), msk = n - 1;
  for (let k = 0; k < 1300; k++) {
    let x = r() * n, y = r() * n, ang = r() * Math.PI * 2;
    const len = 18 + r() * 110, curv = (r() - 0.5) * 0.035, amp = (r() < 0.6 ? 1 : -0.7) * (0.35 + r() * 0.65);
    for (let s = 0; s < len; s++) {
      x += Math.cos(ang); y += Math.sin(ang); ang += curv;
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const x0 = ix & msk, x1 = (ix + 1) & msk, y0 = (iy & msk) * n, y1 = ((iy + 1) & msk) * n;
      F[y0 + x0] += amp * (1 - fx) * (1 - fy); F[y0 + x1] += amp * fx * (1 - fy);
      F[y1 + x0] += amp * (1 - fx) * fy; F[y1 + x1] += amp * fx * fy;
    }
  }
  const cloud = fb(n, 6, 6, 4, 102), fine = fb(n, 128, 128, 2, 103), stain = fb(n, 4, 4, 4, 104);
  return gen(n, T, 0, (i, _x, _y, _u, _v, o) => {
    const f = Math.max(-1, Math.min(1, F[i])), cl = cloud[i], fi = fine[i];
    o.h = f * 0.00016 + (fi - 0.5) * 0.00012 + (cl - 0.5) * 0.0004;
    o.t = 0.5 + (cl - 0.5) * 0.26 + f * 0.2 + (fi - 0.5) * 0.08;
    o.m = stain[i] * 0.9 + (cl - 0.5) * 0.2;
  });
}

// Tela: tafetán grueso con hilos irregulares.
function weave() {
  const n = 256, T = 0.24, W = 32;
  const slW = noiseFn(W, 5, 111), slF = noiseFn(5, W, 112), blot = fb(n, 3, 3, 3, 113), fib = nz(n, 128, 128, 114);
  return gen(n, T, 0.1, (i, _x, _y, u, v, o) => {
    const a = u * W, ia = Math.floor(a), af = a - ia, b = v * W, jb = Math.floor(b), bf = b - jb;
    const top = ((ia + jb) & 1) === 0 ? 1 : -1;
    const ca = Math.sqrt(Math.max(0, 1 - (2 * af - 1) ** 2)), cb = Math.sqrt(Math.max(0, 1 - (2 * bf - 1) ** 2));
    const hW = ca * (0.5 + top * 0.5 * Math.sin(Math.PI * bf)), hF = cb * (0.5 - top * 0.5 * Math.sin(Math.PI * af));
    const isW = hW > hF, hh = Math.max(hW, hF);
    const tone = isW ? slW((ia + 0.5) / W, v) : slF(u, (jb + 0.5) / W);
    o.h = hh * 0.0011;
    o.t = 0.5 + (tone - 0.5) * 0.4 + (hh - 0.65) * 0.3 + (fib[i] - 0.5) * 0.1 + (isW ? 0.03 : -0.03);
    o.m = blot[i] * 0.9 + (tone - 0.5) * 0.2;
  });
}

// Bambú: nudos (anillos a lo largo de V), banda cerosa bajo el nudo, fibras verticales y motas.
function bamboo() {
  const n = 512, T = 1.2, nodes = [0.07, 0.4, 0.72];
  const streak = nz(n, 256, 4, 121), blot = fb(n, 9, 4, 4, 122), age = fb(n, 6, 3, 4, 123), sp = nz(n, 110, 60, 124);
  return gen(n, T, 0.1, (i, _x, _y, _u, v, o) => {
    let best = 9, bi = 0;
    for (let k = 0; k < 3; k++) { const d = wrapd(v - nodes[k]); if (Math.abs(d) < Math.abs(best)) { best = d; bi = k; } }
    const dn = best * T;
    const ridge = Math.exp(-((dn / 0.008) ** 2)), line = Math.exp(-((dn / 0.003) ** 2));
    const band = dn < 0 ? ss(-0.06, -0.006, dn) : 0;
    const s = streak[i], spot = ss(0.8, 0.9, sp[i]);
    o.h = ridge * 0.0026 - line * 0.0014 + (s - 0.5) * 0.0004;
    o.t = 0.5 - line * 0.42 + band * 0.18 + (s - 0.5) * 0.16 + (blot[i] - 0.5) * 0.14 + (dn > 0 ? -0.08 * Math.exp(-dn / 0.08) : 0) - spot * 0.2 + (bi - 1) * 0.03;
    o.m = age[i] * 0.85 + ridge * 0.15 + spot * 0.25 + (s - 0.5) * 0.15;
  });
}

// Corteza: placas alargadas separadas por surcos profundos, roturas horizontales, musgo en los surcos.
function bark() {
  const n = 512, msk = n - 1, T = 1;
  const w = fb(n, 4, 4, 3, 131), r1 = nz(n, 14, 3, 132), r2 = nz(n, 30, 6, 133), r3 = nz(n, 66, 14, 134), cr = nz(n, 5, 22, 135), fine = fb(n, 128, 40, 2, 136), mossN = fb(n, 4, 4, 4, 137);
  return gen(n, T, 0.35, (i, x, y, _u, _v, o) => {
    const j = y * n + ((x + Math.round((w[i] - 0.5) * 0.09 * n)) & msk);
    const p0 = ss(0, 0.34, Math.abs(2 * r1[j] - 1)) * 0.6 + ss(0, 0.4, Math.abs(2 * r2[j] - 1)) * 0.3 + Math.abs(2 * r3[j] - 1) * 0.1;
    const p = p0 * (0.72 + 0.28 * ss(0, 0.22, Math.abs(2 * cr[j] - 1)));
    const fi = fine[j];
    o.h = p * 0.014 + (fi - 0.5) * 0.002;
    o.t = 0.5 + (p - 0.62) * 0.55 + (fi - 0.5) * 0.22;
    o.m = mossN[i] * 0.78 + (1 - p) * 0.22 + (fi - 0.5) * 0.12;
  });
}

// Follaje pintado: hojas apuntadas solapadas, con nervio, dos mitades de tono y hojas jóvenes (máscara).
function leaves() {
  const n = 256, T = 0.75, r = rng(141), msk = n - 1;
  const fill = nz(n, 8, 8, 142);
  return gen(n, T, 0.45, (i, _x, _y, _u, _v, o) => { o.h = 0; o.t = 0.1 + fill[i] * 0.1; o.m = 0.15; }, (h, t, m) => {
    const L = 760;
    for (let k = 0; k < L; k++) {
      const cx = Math.floor(r() * n), cy = Math.floor(r() * n), ang = r() * Math.PI * 2, co = Math.cos(ang), si = Math.sin(ang);
      const len = (0.045 + r() * 0.04) / T * n, wid = len * (0.34 + r() * 0.16);
      const lt = 0.36 + r() * 0.3 + (k / L) * 0.1, z = (k / L) * 0.03, tilt = (r() - 0.5) * 0.014;
      const my = r() < 0.2 ? 0.62 + r() * 0.38 : r() * 0.4;
      const R = Math.ceil(len) + 1;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const a = (dx * co + dy * si) / len;
        if (a <= -1 || a >= 1) continue;
        const b0 = -dx * si + dy * co;
        if (b0 > wid || b0 < -wid) continue;
        const bb = b0 / (wid * Math.pow(1 - a * a, 0.7) * (1 - 0.3 * a));
        if (bb <= -1 || bb >= 1) continue;
        const i = ((cy + dy) & msk) * n + ((cx + dx) & msk), ab = Math.abs(bb);
        h[i] = z + ab * 0.0035 + tilt * a + (1 - ab * ab) * 0.001;
        t[i] = lt + (bb > 0 ? 0.055 : -0.055) + (ab < 0.12 ? 0.1 : 0) - (ab > 0.8 ? 0.09 : 0) + a * 0.06;
        m[i] = my + a * 0.1;
      }
    }
  });
}

// Musgo: almohadillas a dos escalas y pelusa.
function moss() {
  const n = 256, T = 0.8, w1 = worley(9, 9, 151, 0.9), w2 = worley(26, 26, 152), fuzz = fb(n, 96, 96, 2, 153), low = fb(n, 4, 4, 4, 154);
  return gen(n, T, 0.4, (i, _x, _y, u, v, o) => {
    const a = w1(u, v), d1 = Math.max(0, 1 - a.f1 * a.f1 * 1.6), id1 = a.id;
    const b = w2(u, v), d2 = Math.max(0, 1 - b.f1 * b.f1 * 1.8), fz = fuzz[i];
    o.h = d1 * 0.012 + d2 * 0.005 + (fz - 0.5) * 0.003;
    o.t = 0.5 + (d1 - 0.5) * 0.3 + (d2 - 0.5) * 0.26 + (fz - 0.5) * 0.3 + (id1 - 0.5) * 0.16;
    o.m = low[i] * 0.8 + (id1 - 0.5) * 0.3 + (fz - 0.5) * 0.15 + 0.05;
  });
}

// Cuerda torcida: cabos en diagonal con fibras a lo largo del cabo.
function rope() {
  const n = 256, T = 0.12, fib = noiseFn(96, 6, 161), low = fb(n, 3, 3, 3, 162);
  return gen(n, T, 0.2, (i, _x, _y, u, v, o) => {
    const f = fr((u + v) * 4), dome = Math.sin(Math.PI * f), fi = fib(u + v, u - v);
    o.h = Math.pow(dome, 0.6) * 0.0022 + (fi - 0.5) * 0.0005;
    o.t = 0.5 + (dome - 0.62) * 0.4 + (fi - 0.5) * 0.3;
    o.m = low[i] * 0.9 + (fi - 0.5) * 0.2;
  });
}

// Paja/brezo: hebras a lo largo de V en capas con borde inferior irregular.
function thatch() {
  const n = 512, msk = n - 1, T = 1, R = 3;
  const st1 = nz(n, 256, 6, 171), st2 = nz(n, 110, 3, 172), st3 = nz(n, 48, 1, 173), edgeN = nz(n, 90, 1, 174), rot = fb(n, 4, 4, 4, 175), slant = nz(n, 8, 4, 176);
  return gen(n, T, 0.3, (i, x, y, _u, v, o) => {
    const xx = (x + Math.round((slant[i] - 0.5) * 0.02 * n)) & msk, j = y * n + xx;
    const rv = v * R + (edgeN[x] - 0.5) * 0.3 + (st3[xx] - 0.5) * 0.22, rf = rv - Math.floor(rv);
    const s = st1[j] * 0.6 + st2[j] * 0.4, ro = rot[i];
    const sh = ss(0.78, 1, rf);
    o.h = (1 - rf) * 0.02 + (s - 0.5) * 0.005;
    o.t = 0.5 + (s - 0.5) * 0.5 - sh * 0.3 + (1 - ss(0, 0.16, rf)) * 0.1 + (ro - 0.5) * 0.16;
    o.m = ro * 0.85 + sh * 0.2 + (s - 0.5) * 0.25;
  });
}

// Ondas suaves para agua y vidrio antiguo (solo relieve).
function ripple() {
  const n = 256, a = fb(n, 5, 5, 3, 181), b = nz(n, 13, 13, 182), c = nz(n, 29, 29, 183), m = fb(n, 4, 4, 3, 184);
  return gen(n, 3, 0, (i, _x, _y, _u, _v, o) => {
    o.h = (a[i] - 0.5) * 0.02 + (b[i] - 0.5) * 0.007 + (c[i] - 0.5) * 0.002;
    o.t = 0.5; o.m = m[i];
  });
}

// Variación a gran escala compartida por todos: R = cálido/frío, G = mugre con chorretones,
// B = tono, A = manchas suaves (sirve también de "detalle" liso para la piel).
function macro() {
  const n = 256, d = new Uint8Array(n * n * 4);
  const wc = fb(n, 3, 3, 4, 191), g1 = fb(n, 4, 4, 4, 192), g2 = nz(n, 44, 2, 193), tn = fb(n, 5, 5, 5, 194), bl = fb(n, 6, 6, 4, 195);
  for (let i = 0; i < n * n; i++) {
    d[i * 4] = Math.round(wc[i] * 255);
    d[i * 4 + 1] = Math.round(sat(g1[i] * 0.65 + g2[i] * 0.35) * 255);
    d[i * 4 + 2] = Math.round(tn[i] * 255);
    d[i * 4 + 3] = Math.round(bl[i] * 255);
  }
  const tex = finish(d, n, 7.3);
  tex.userData.slope = 0;
  return tex;
}

const GEN: Record<TexKind, () => THREE.DataTexture> = {
  wood, plaster, kawara, stone, cobble, concrete, earth, metal, washi, weave, bamboo, bark, leaves, moss, rope, thatch, ripple, macro,
};
const cache = new Map<TexKind, THREE.DataTexture>();
/** ms acumulados generando texturas (para medir el coste de arranque) */
export const texStats = { ms: 0, count: 0, per: {} as Record<string, number> };

/** Textura de detalle compartida (se genera la primera vez que se pide). */
export function detailTexture(kind: TexKind): THREE.DataTexture {
  let t = cache.get(kind);
  if (!t) {
    const t0 = performance.now();
    t = GEN[kind]();
    const dt = performance.now() - t0;
    texStats.ms += dt; texStats.count++; texStats.per[kind] = Math.round(dt);
    cache.set(kind, t);
  }
  return t;
}
/** Genera por adelantado (p. ej. en la pantalla de carga) para evitar tirones al aparecer un material. */
export function warmTextures(kinds: TexKind[] = Object.keys(GEN) as TexKind[]) {
  for (const k of kinds) detailTexture(k);
}
