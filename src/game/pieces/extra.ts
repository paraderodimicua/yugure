// Segunda tanda de piezas jugables: apoyos a distintas alturas que no son edificios
// (cajas, barriles, carro, andamio, depósito, campanario, tōrō, cartel, bambúes, plataforma colgante, andon).
// Mismo contrato que game/pieces.ts: origen en el suelo (salvo hangingPlatform: origen en el punto de cuelgue),
// colisionadores locales, ≤ 4 materiales y ≤ 2.500 triángulos por pieza, plantillas compartidas.
import * as THREE from 'three';
import type { Mats } from '../../render/materials';
import type { Collider, PlayPiece, V3 } from '../contracts';
import { Builder, cached, rng, V, planeUV, vtext, htext, grain, G, MINCHO, GOTHIC, type Kit } from '../../world/props/kit';

type Size = { w: number; h: number; d: number };
type Motion = (t: number, p: THREE.Vector3, r: THREE.Euler) => void;
export type PieceCtx = {
  K: Kit; M: Mats;
  inst: (key: string, build: () => PlayPiece) => PlayPiece;
  finish: (B: Builder, name: string, colliders: Collider[], size: Size) => PlayPiece;
  moving: (g: PlayPiece, fn: Motion) => PlayPiece;
  seedOf: (k: string, o: any) => number;
  shide: (B: Builder, x: number, y: number, z: number, ry?: number, s?: number) => void;
};

const q = (v: number, s: number) => Math.round(v / s) * s;
const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const box = (min: V3, max: V3, grab = true): Collider => ({ kind: 'box', min, max, ...(grab ? {} : { grab: false }) });
const TAU = Math.PI * 2;

export function extraPieces(C: PieceCtx): Record<string, (o?: any) => PlayPiece> {
  const { K, M, inst, finish, moving, seedOf, shide } = C;
  void shide;

  // ---------- texturas ----------
  const crateTex = (v: number) => K.tex(`pc_crate|${v}`, 128, 80, (g, w, h, r) => {
    g.fillStyle = '#c9a26a'; g.fillRect(0, 0, w, h); grain(g, w, h, r, 0.8);
    g.strokeStyle = v ? '#1f3f7a' : '#b8261c'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = v ? '#1f3f7a' : '#b8261c'; htext(g, v ? '青果' : 'みかん', w / 2, h * 0.45, v ? 40 : 30, 1, GOTHIC, '900');
    g.fillStyle = '#1a1410'; htext(g, v ? '産地直送' : '愛媛産', w / 2, h * 0.8, 13, 1, GOTHIC, '700');
  });
  const KOMO = [['祝', '銘酒'], ['福', '清酒'], ['寿', '御神酒']];
  const komoTex = (v: number) => K.tex(`pc_komo|${v}`, 256, 128, (g, w, h, r) => {
    g.fillStyle = '#d6bd85'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(110,80,30,${0.08 + r() * 0.18})`; g.fillRect(x, 0, 1.5, h); }
    for (const y of [10, h - 14]) { g.fillStyle = 'rgba(80,55,20,0.55)'; g.fillRect(0, y, w, 4); }
    const cx = w / 2;
    g.beginPath(); g.arc(cx, h * 0.42, 30, 0, TAU); g.fillStyle = '#b8261c'; g.fill();
    g.fillStyle = '#f6ecd6'; htext(g, KOMO[v][0], cx, h * 0.42, 38, 1, MINCHO, '900');
    g.fillStyle = '#1a1410'; vtext(g, KOMO[v][1], cx - 52, h * 0.5, 22, 1, MINCHO, '900'); vtext(g, KOMO[v][1], cx + 52, h * 0.5, 22, 1, MINCHO, '900');
    grain(g, w, h, r, 0.6);
  });
  const awningTex = (v: number) => K.tex(`pc_awn|${v}`, 256, 128, (g, w, h, r) => {
    const a = v ? '#1f3f7a' : '#c8372a';
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2e6cf' : a; g.fillRect((i / 8) * w, 0, w / 8 + 1, h); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
    grain(g, w, h, r, 0.5, false);
  });
  const tankTex = () => K.tex('pc_tank', 96, 160, (g, w, h, r) => {
    g.fillStyle = '#f1e8d6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8261c'; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#b8261c'; vtext(g, '防火用水', w / 2, h / 2, 32, 1, MINCHO, '900'); grain(g, w, h, r, 0.6);
  });
  const SIGNS = [['名物 団子', '茶屋'], ['御宿 夕暮', '旅籠'], ['甘味処', '氷'], ['骨董 古道具', '買取']];
  const signTex = (v: number) => K.tex(`pc_sign|${v}`, 384, 256, (g, w, h, r) => {
    g.fillStyle = '#e8d6ae'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(90,60,25,${0.08 + r() * 0.15})`; g.lineWidth = 1 + r() * 2; const y = r() * h; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 24) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4); g.stroke(); }
    grain(g, w, h, r, 0.8);
    g.fillStyle = '#16100c'; htext(g, SIGNS[v][0], w / 2, h * 0.47, Math.min(110, (w * 0.86) / [...SIGNS[v][0]].length), 1, MINCHO, '900');
    g.fillStyle = '#b8261c'; g.fillRect(w - 64, h - 62, 44, 44); g.fillStyle = '#f2e4cc'; htext(g, SIGNS[v][1][0], w - 42, h - 40, 30, 1, MINCHO, '900');
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });
  const ANDON = ['祭', '灯', '龍', '月'];
  const andonTex = (v: number) => K.tex(`pc_andon|${v}`, 256, 360, (g, w, h, r) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.7);
    gr.addColorStop(0, '#fff4da'); gr.addColorStop(1, '#e0b878'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 2;
    for (let x = w / 4; x < w; x += w / 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = h / 6; y < h; y += h / 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    grain(g, w, h, r, 0.8);
    g.fillStyle = '#c8372a'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
    g.lineWidth = 10; g.strokeStyle = '#fff4da'; g.fillStyle = '#16100c';
    g.font = `900 190px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText(ANDON[v], w / 2, h * 0.5); g.fillText(ANDON[v], w / 2, h * 0.5);
  });

  // =====================================================================
  // crates: pila escalonada de cajas de fruta (columna i tiene i+1 cajas; sube hacia +X)
  // =====================================================================
  const crates = (o: any = {}) => {
    const rows = cl(Math.round(o.rows ?? 3), 2, 4), seed = (o.seed ?? 1) % 4;
    return inst(`crates|${rows}|${seed}`, () => {
      const B = new Builder(), r = rng(seed * 19 + rows), wl = M.woodWarm, wd = M.woodDark, fruit = M.tint('ceramic', '#e8822a');
      const lab = K.print(crateTex(seed % 2)), s = 0.8, cols: Collider[] = [], openCol = seed % rows;
      for (let i = 0; i < rows; i++) {
        const x = (i - (rows - 1) / 2) * s;
        for (let k = 0; k <= i; k++) {
          const cx = x + (r() - 0.5) * 0.04, cz = (r() - 0.5) * 0.05, y0 = k * s, open = k === i && i === openCol;
          B.box(wl, s - 0.06, open ? s - 0.16 : s - 0.04, s - 0.06, cx, y0 + (open ? (s - 0.16) / 2 : s / 2 - 0.02), cz);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(wd, 0.07, s - 0.01, 0.07, cx + sx * (s / 2 - 0.035), y0 + s / 2, cz + sz * (s / 2 - 0.035));
          B.box(wd, s - 0.02, 0.06, s - 0.02, cx, y0 + 0.04, cz);
          B.box(wd, s - 0.02, 0.06, s - 0.02, cx, y0 + s - 0.04, cz);
          if (r() < 0.6) B.geo(lab, planeUV(0.5, 0.31, 1, 1), cx, y0 + s * 0.48, cz + s / 2 - 0.025);
          if (open) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++)
            B.sphere(fruit, 0.11, cx + (a - 1) * 0.22 + (r() - 0.5) * 0.03, y0 + s - 0.1, cz + (b - 1) * 0.22 + (r() - 0.5) * 0.03, 0.9, 6, 4);
        }
        cols.push(box([x - s / 2, 0, -s / 2], [x + s / 2, (i + 1) * s, s / 2]));
      }
      return finish(B, 'crates', cols, { w: rows * s, h: rows * s, d: s });
    });
  };

  // =====================================================================
  // barrels: pirámide 3-2-1 de barriles de sake (komodaru) atados sobre un palé
  // =====================================================================
  const barrels = (o: any = {}) => {
    const seed = (o.seed ?? 1) % 3;
    return inst(`barrels|${seed}`, () => {
      const B = new Builder(), komo = K.print(komoTex(seed)), lid = M.woodWarm, rope = M.rope, wd = M.woodDark, r = rng(seed * 7 + 3);
      const R = 0.36, H = 0.72, yb = 0.12;
      for (let k = 0; k < 4; k++) B.box(wd, 2.3, 0.06, 0.16, 0, 0.03 + 0.06 * (k % 2), -0.36 + k * 0.24, 0, 0, 0);
      const put = (x: number, y: number) => {
        const ry = (r() - 0.5) * 1.2;
        B.geo(komo, G.wrap(14), x, y + H / 2, 0, ry, 0, 0, R, H, R);
        B.cyl(lid, R * 0.97, 0.03, x, y + H - 0.01, 0, 14);
        B.cyl(rope, R + 0.014, 0.04, x, y + H - 0.03, 0, 14);
        B.cyl(rope, R + 0.014, 0.05, x, y + 0.14, 0, 14);
        B.cyl(rope, R + 0.014, 0.05, x, y + H - 0.16, 0, 14);
      };
      for (const x of [-0.74, 0, 0.74]) put(x, yb);
      for (const x of [-0.37, 0.37]) put(x, yb + H);
      put(0, yb + 2 * H);
      for (const s of [-1, 1]) B.rod(rope, 0.016, V(0, yb + 3 * H - 0.05, R + 0.01), V(s * 1.1, yb + 0.2, R + 0.01), 3);
      const t = yb + 3 * H;
      return finish(B, 'barrels', [
        box([-1.15, 0, -0.38], [1.15, yb + H, 0.38]),
        box([-0.75, yb + H, -0.38], [0.75, yb + 2 * H, 0.38]),
        box([-0.38, yb + 2 * H, -0.38], [0.38, t, 0.38]),
      ], { w: 2.3, h: t, d: 0.8 });
    });
  };

  // =====================================================================
  // cart: carro de madera de mercado con toldo a rayas (rebote suave, power 0.7)
  // =====================================================================
  const awnGeo = () => cached('pc_awning', () => {
    const g = new THREE.PlaneGeometry(2.5, 1.5, 8, 4).rotateX(-Math.PI / 2), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const z = P.getZ(i) / 0.75; P.setY(i, 0.2 * (1 - z * z)); }
    g.computeVertexNormals(); return g;
  });
  const wheelGeo = () => cached('pc_wheel', () => new THREE.TorusGeometry(0.48, 0.05, 4, 16));
  const cart = (o: any = {}) => {
    const seed = (o.seed ?? 1) % 2;
    return inst(`cart|${seed}`, () => {
      const B = new Builder(), wl = M.woodWarm, wd = M.woodDark, sack = M.tint('fabric', '#cdbb94'), awn = K.print(awningTex(seed), true);
      const yBed = 0.86, yA = 2.2;
      B.box(wl, 2.2, 0.1, 1.0, 0, yBed, 0);
      for (const s of [-1, 1]) { B.box(wl, 2.2, 0.24, 0.05, 0, yBed + 0.17, s * 0.48); B.box(wl, 0.05, 0.24, 1.0, s * 1.08, yBed + 0.17, 0); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(wl, 0.07, yA - yBed, 0.07, sx * 1.02, (yA + yBed) / 2, sz * 0.44);
      B.geo(awn, awnGeo(), 0, yA, 0);
      for (const s of [-1, 1]) B.rod(wd, 0.03, V(-1.2, yA + 0.02, s * 0.74), V(1.2, yA + 0.02, s * 0.74), 6);
      // ruedas de radios
      for (const s of [-1, 1]) {
        const z = s * 0.58, cx = -0.25, cy = 0.5;
        B.geo(wd, wheelGeo(), cx, cy, z);
        for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; B.rod(wd, 0.022, V(cx, cy, z), V(cx + Math.cos(a) * 0.46, cy + Math.sin(a) * 0.46, z), 4); }
        B.cyl(wd, 0.08, 0.14, cx, cy, z, 8, 1, 0, Math.PI / 2, 0);
        B.rod(wd, 0.035, V(1.05, yBed - 0.05, s * 0.4), V(2.1, yBed - 0.2, s * 0.4), 6); // varas
      }
      B.rod(wd, 0.03, V(2.05, yBed - 0.19, -0.42), V(2.05, yBed - 0.19, 0.42), 6);
      B.rod(wd, 0.035, V(-0.25, 0.5, -0.6), V(-0.25, 0.5, 0.6), 6);
      B.box(wd, 0.08, yBed - 0.05, 0.08, 0.95, (yBed - 0.05) / 2, 0); // pata de apoyo
      // carga: sacos de arroz
      for (const [x, z] of [[-0.6, -0.2], [-0.15, 0.15], [0.45, -0.15]]) B.sphere(sack, 0.32, x, yBed + 0.25, z, 0.55, 8, 5);
      return finish(B, 'cart', [
        box([-1.12, 0.3, -0.52], [1.12, yBed + 0.3, 0.52]),
        { kind: 'bounce', center: [0, yA + 0.17, 0], r: 0.72, power: o.power ?? 0.7 },
      ], { w: 3.3, h: yA + 0.2, d: 1.5 });
    });
  };

  // =====================================================================
  // scaffold: andamio de bambú atado con plataformas alternas y travesaños 'bar'
  // =====================================================================
  const scaffold = (o: any = {}) => {
    const H = cl(q(o.h ?? 6, 0.5), 3, 12), seed = (o.seed ?? 1) % 2;
    return inst(`scaf|${H}|${seed}`, () => {
      const B = new Builder(), bam = M.bamboo, pl = M.woodWeathered, rope = M.rope, flag = M.tint('fabric', '#c8372a');
      const n = H >= 5 ? 3 : 2, cols: Collider[] = [], X = 1.0, Z = 0.6;
      for (const x of [-X, 0, X]) for (const z of [-Z, Z]) B.cyl(bam, 0.05, H + 0.6, x, (H + 0.6) / 2, z, 6);
      const lv = Array.from({ length: n }, (_, i) => q(H * (i + 1) / n, 0.05));
      lv.forEach((y, i) => {
        const left = (i + seed) % 2 === 0, x0 = left ? -X - 0.05 : -0.1, x1 = left ? 0.1 : X + 0.05;
        for (const z of [-Z, Z]) B.rod(bam, 0.04, V(-X - 0.2, y - 0.08, z), V(X + 0.2, y - 0.08, z), 6);
        for (const x of [-X, 0, X]) B.rod(bam, 0.04, V(x, y - 0.12, -Z - 0.15), V(x, y - 0.12, Z + 0.15), 6);
        for (let k = 0; k < 3; k++) B.box(pl, x1 - x0, 0.05, 0.36, (x0 + x1) / 2, y - 0.025, -0.4 + k * 0.4, 0, 0, 0);
        for (const x of [-X, 0, X]) for (const z of [-Z, Z]) B.cyl(rope, 0.07, 0.09, x, y - 0.1, z, 6);
        cols.push(box([x0, y - 0.12, -Z - 0.05], [x1, y, Z + 0.05]));
        const yb = y - (H / n) * 0.5;
        B.rod(bam, 0.045, V(-X - 0.25, yb, Z + 0.07), V(X + 0.25, yb, Z + 0.07), 6);
        for (const x of [-X, X]) B.cyl(rope, 0.075, 0.1, x, yb, Z + 0.04, 6);
        cols.push({ kind: 'bar', a: [-X - 0.2, yb, Z + 0.07], b: [X + 0.2, yb, Z + 0.07], r: 0.045 });
      });
      for (let i = 0; i < n; i++) { const y0 = i ? lv[i - 1] : 0, y1 = lv[i]; B.rod(bam, 0.035, V(i % 2 ? X : -X, y0, -Z - 0.05), V(i % 2 ? -X : X, y1, -Z - 0.05), 6); }
      const pq = cached('pc_quad', () => new THREE.PlaneGeometry(1, 1));
      B.geo(flag, pq, X + 0.3, H + 0.38, Z, 0, 0, 0, 0.5, 0.32, 1); B.geo(flag, pq, X + 0.3, H + 0.38, Z, Math.PI, 0, 0, 0.5, 0.32, 1);
      return finish(B, 'scaffold', cols, { w: 2.4, h: H + 0.6, d: 1.4 });
    });
  };

  // =====================================================================
  // waterTank: depósito de madera con aros sobre patas; tapa pisable, escalerilla 'grab'
  // =====================================================================
  const waterTank = (o: any = {}) => {
    const H = cl(q(o.h ?? 7, 0.5), 4, 10);
    return inst(`tank|${H}`, () => {
      const B = new Builder(), ww = M.woodWeathered, wd = M.woodDark, mt = M.metalDark, R = 1.1, yb = H - 1.72;
      B.cyl(ww, R, 1.62, 0, yb + 0.81, 0, 20, 1.02);
      for (const y of [0.25, 0.8, 1.35]) B.cyl(mt, R + 0.025 + y * 0.01, 0.06, 0, yb + y, 0, 20, 1, 0, 0, 0);
      B.cyl(wd, R + 0.06, 0.1, 0, H - 0.05, 0, 20);
      B.box(wd, 0.6, 0.06, 0.5, 0.2, H + 0.02, -0.2);
      for (const s of [-1, 1]) { B.box(wd, 2.5, 0.16, 0.18, 0, yb - 0.08, s * 0.7); B.box(wd, 0.18, 0.16, 2.5, s * 0.7, yb - 0.24, 0); }
      const lg = yb - 0.32;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(ww, 0.18, lg, 0.18, sx * 0.8, lg / 2, sz * 0.8);
      for (const [a, b] of [[[-0.8, -0.8], [0.8, -0.8]], [[0.8, -0.8], [0.8, 0.8]], [[0.8, 0.8], [-0.8, 0.8]], [[-0.8, 0.8], [-0.8, -0.8]]] as [number, number][][]) {
        B.rod(mt, 0.02, V(a[0], 0.4, a[1]), V(b[0], lg * 0.55, b[1]), 4); B.rod(mt, 0.02, V(b[0], 0.4, b[1]), V(a[0], lg * 0.55, a[1]), 4);
        B.box(ww, Math.abs(b[0] - a[0]) + 0.1, 0.1, Math.abs(b[1] - a[1]) + 0.1, (a[0] + b[0]) / 2, lg * 0.58, (a[1] + b[1]) / 2);
      }
      // escalerilla en +Z
      const zl = 1.28;
      for (const s of [-1, 1]) B.rod(mt, 0.025, V(s * 0.22, 0, zl), V(s * 0.22, H + 0.5, zl), 5);
      for (let y = 0.35; y < H + 0.1; y += 0.35) B.rod(mt, 0.016, V(-0.22, y, zl), V(0.22, y, zl), 4);
      B.geo(K.print(tankTex()), planeUV(0.5, 0.82, 1, 1), 0.62, yb + 0.85, R * 0.88, 0.62);
      return finish(B, 'waterTank', [
        box([-0.8, yb - 0.3, -0.8], [0.8, H, 0.8]),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 0.8 - 0.1, 0, sz * 0.8 - 0.1], [sx * 0.8 + 0.1, yb - 0.3, sz * 0.8 + 0.1], false))),
        { kind: 'grab', a: [0, 0.4, zl], b: [0, H + 0.4, zl] },
      ], { w: 2.5, h: H + 0.5, d: 2.7 });
    });
  };

  // =====================================================================
  // bell: campanario (shōrō) pequeño: tejadillo pisable, aleros agarrables, campana 'grab'
  // =====================================================================
  const bellGeo = () => cached('pc_bell', () => new THREE.LatheGeometry(
    [[0.43, 0], [0.4, 0.06], [0.36, 0.3], [0.34, 0.62], [0.32, 0.82], [0.22, 0.92], [0.0, 0.95]].map(([x, y]) => new THREE.Vector2(x, y)), 14));
  const bell = (o: any = {}) => {
    const H = cl(q(o.h ?? 3, 0.25), 2.4, 6);
    return inst(`bell|${H}`, () => {
      const B = new Builder(), wd = M.woodDark, tile = M.tileSlate, st = M.stone, br = M.tint('metalGold', '#7a6038');
      B.stone(st, 2.5, 0.42, 2.5, 0, 0.21, 0, 0, 0, 0.08);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.cyl(wd, 0.1, H - 0.42, sx * 0.85, (H + 0.42) / 2, sz * 0.85, 8); B.stone(st, 0.3, 0.12, 0.3, sx * 0.85, 0.48, sz * 0.85, 0, 0, 0.03); }
      for (const s of [-1, 1]) { B.box(wd, 2.0, 0.16, 0.14, 0, H - 0.08, s * 0.85); B.box(wd, 0.14, 0.16, 2.0, s * 0.85, H - 0.08, 0); B.box(wd, 1.9, 0.1, 0.1, 0, H - 0.75, s * 0.85); }
      B.box(wd, 1.9, 0.18, 0.16, 0, H - 0.26, 0);
      // campana y mazo (shumoku)
      const yt = H - 0.4;
      B.geo(br, cached('pc_bellhook', () => new THREE.TorusGeometry(0.07, 0.025, 5, 10)), 0, yt + 0.02, 0);
      B.geo(br, bellGeo(), 0, yt - 0.95, 0);
      for (let k = 0; k < 4; k++) B.cyl(br, 0.345 - k * 0.002, 0.03, 0, yt - 0.95 + 0.25 + k * 0.17, 0, 14);
      B.cyl(wd, 0.09, 1.3, 0, yt - 0.7, 0.95, 8, 1, 0, 0, Math.PI / 2);
      for (const x of [-0.4, 0.4]) B.rod(M.tint('metalGold', '#7a6038'), 0.01, V(x, yt - 0.7, 0.95), V(x, H - 0.1, 0.85), 3);
      // tejadillo a cuatro aguas con coronación plana
      const E = H + 0.12, Cy = H + 0.72, e = 1.42, c = 0.62;
      B.box(wd, 2 * e, 0.1, 2 * e, 0, H + 0.05, 0);
      const ring = (y: number, h: number) => [V(-h, y, -h), V(h, y, -h), V(h, y, h), V(-h, y, h)];
      const er = ring(E, e), cr = ring(Cy, c);
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; B.quad(tile, er[k], er[k2], cr[k2], cr[k]); B.quad(tile, cr[k], cr[k2], er[k2], er[k]); }
      B.box(tile, 2 * c + 0.06, 0.14, 2 * c + 0.06, 0, Cy + 0.07, 0);
      B.box(wd, 2 * c - 0.1, 0.05, 2 * c - 0.1, 0, Cy + 0.165, 0);
      return finish(B, 'bell', [
        box([-1.25, 0, -1.25], [1.25, 0.42, 1.25]),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box([sx * 0.85 - 0.1, 0.42, sz * 0.85 - 0.1], [sx * 0.85 + 0.1, H, sz * 0.85 + 0.1], false))),
        box([-e, H, -e], [e, E + 0.1, e]),
        box([-c - 0.03, E + 0.1, -c - 0.03], [c + 0.03, Cy + 0.19, c + 0.03]),
        { kind: 'grab', a: [0, yt - 0.1, 0], b: [0, yt - 0.85, 0] },
      ], { w: 2 * e, h: Cy + 0.19, d: 2 * e });
    });
  };

  // =====================================================================
  // stoneLantern: tōrō de piedra con hogar encendido y remate pisable
  // =====================================================================
  const stoneLantern = (o: any = {}) => {
    const H = cl(q(o.h ?? 2.6, 0.1), 2, 3.5);
    return inst(`toro|${H}`, () => {
      const B = new Builder(), st = M.stone, ms = M.moss, fire = M.glow('#ffb35a', 3), r = rng(Math.round(H * 10));
      const sh = H - 1.33, y1 = 0.25 + sh, y2 = y1 + 0.18, y3 = y2 + 0.5, y4 = y3 + 0.18;
      B.stone(st, 0.95, 0.25, 0.95, 0, 0.125, 0, 0, 0, 0.05, r, 0.02);
      B.cyl(st, 0.17, sh, 0, 0.25 + sh / 2, 0, 8, 0.9);
      for (const y of [0.3, y1 - 0.05]) B.cyl(st, 0.22, 0.08, 0, y, 0, 8);
      B.stone(st, 0.78, 0.18, 0.78, 0, y1 + 0.09, 0, 0, 0, 0.05, r, 0.02);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(st, 0.1, 0.5, 0.1, sx * 0.25, y2 + 0.25, sz * 0.25);
      B.box(st, 0.5, 0.5, 0.06, 0, y2 + 0.25, -0.24); B.box(st, 0.06, 0.5, 0.5, -0.24, y2 + 0.25, 0);
      B.box(fire, 0.38, 0.36, 0.38, 0, y2 + 0.26, 0);
      B.stone(st, 1.3, 0.18, 1.3, 0, y3 + 0.09, 0, 0, 0, 0.08, r, 0.02);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(st, 0.16, 0.1, 0.16, sx * 0.6, y4 + 0.01, sz * 0.6, Math.PI / 4, 0, 0);
      B.cyl(st, 0.62, 0.22, 0, y4 + 0.11, 0, 4, 0.55, Math.PI / 4);
      for (let k = 0; k < 5; k++) { const a = r() * TAU, d = 0.25 + r() * 0.35; B.sphere(ms, 0.14 + r() * 0.1, Math.cos(a) * d, y4 + 0.02, Math.sin(a) * d, 0.35, 6, 4); }
      B.sphere(ms, 0.2, 0.3, 0.27, 0.3, 0.4, 6, 4);
      return finish(B, 'stoneLantern', [
        box([-0.48, 0, -0.48], [0.48, 0.25, 0.48]),
        box([-0.2, 0.25, -0.2], [0.2, y1, 0.2], false),
        box([-0.39, y1, -0.39], [0.39, y3, 0.39]),
        box([-0.65, y3, -0.65], [0.65, y4, 0.65]),
        box([-0.27, y4, -0.27], [0.27, H, 0.27]),
      ], { w: 1.3, h: H, d: 1.3 });
    });
  };

  // =====================================================================
  // signBoard: gran cartel de madera entre dos postes; albardilla superior pisable
  // =====================================================================
  const signBoard = (o: any = {}) => {
    const w = cl(q(o.w ?? 2.4, 0.2), 1.4, 5), H = cl(q(o.h ?? 4, 0.25), 2.2, 8), v = (o.seed ?? 1) % 4;
    return inst(`sign|${w}|${H}|${v}`, () => {
      const B = new Builder(), wd = M.woodDark, wl = M.woodWarm, mt = M.metalDark, pr = K.print(signTex(v));
      const bh = w / 1.5, yc = H - 0.12 - bh / 2;
      for (const s of [-1, 1]) {
        B.box(wd, 0.16, H + 0.35, 0.16, s * (w / 2 + 0.14), (H + 0.35) / 2, 0);
        B.cyl(mt, 0.11, 0.08, s * (w / 2 + 0.14), H + 0.39, 0, 4, 0.4, Math.PI / 4);
        for (const y of [yc - bh / 4, yc + bh / 4]) B.box(mt, 0.14, 0.05, 0.12, s * (w / 2 + 0.03), y, 0);
      }
      B.box(wl, w, bh, 0.08, 0, yc, 0);
      B.geo(pr, planeUV(w - 0.08, bh - 0.08, 1, 1), 0, yc, 0.041);
      B.geo(pr, planeUV(w - 0.08, bh - 0.08, 1, 1), 0, yc, -0.041, Math.PI);
      B.box(wd, w + 0.02, 0.06, 0.12, 0, yc - bh / 2, 0);
      B.box(wd, w + 0.62, 0.1, 0.34, 0, H - 0.05, 0);
      B.box(wd, w + 0.4, 0.06, 0.26, 0, H - 0.13, 0);
      return finish(B, 'signBoard', [
        box([-w / 2 - 0.3, yc - bh / 2, -0.17], [w / 2 + 0.3, H, 0.17]),
        box([-w / 2 - 0.22, 0, -0.08], [-w / 2 - 0.06, yc - bh / 2, 0.08], false),
        box([w / 2 + 0.06, 0, -0.08], [w / 2 + 0.22, yc - bh / 2, 0.08], false),
      ], { w: w + 0.6, h: H + 0.4, d: 0.34 });
    });
  };

  // =====================================================================
  // bambooPoles: postes de bambú de altura creciente con platillo pisable (escalera de saltos)
  // =====================================================================
  const bambooPoles = (o: any = {}) => {
    const n = cl(Math.round(o.n ?? 5), 2, 8), seed = (o.seed ?? 1) % 3, step = o.step ?? 0.7, gap = o.gap ?? 1.5;
    return inst(`bpoles|${n}|${seed}|${step}|${gap}`, () => {
      const B = new Builder(), bam = M.bamboo, cap = M.woodWarm, rope = M.rope, red = M.tint('fabric', '#c8372a'), r = rng(seed * 13 + n);
      const cols: Collider[] = [];
      for (let i = 0; i < n; i++) {
        const x = i * gap, z = (r() - 0.5) * 0.6, h = q(1.0 + i * step + (r() - 0.5) * 0.12, 0.02);
        B.cyl(bam, 0.12, h, x, h / 2, z, 8, 0.95);
        for (let y = 0.35 + r() * 0.1; y < h - 0.2; y += 0.42) B.cyl(bam, 0.128, 0.035, x, y, z, 8);
        B.cyl(rope, 0.135, 0.1, x, h - 0.14, z, 8);
        B.cyl(cap, 0.28, 0.07, x, h - 0.035, z, 10);
        B.cyl(cap, 0.24, 0.03, x, h - 0.08, z, 10);
        if (i === n - 1) { const pq = cached('pc_quad', () => new THREE.PlaneGeometry(1, 1)); B.geo(red, pq, x + 0.1, h - 0.4, z + 0.13, 0.3, 0, 0.15, 0.1, 0.5, 1); B.geo(red, pq, x + 0.1, h - 0.4, z + 0.13, 0.3 + Math.PI, 0, -0.15, 0.1, 0.5, 1); }
        cols.push(box([x - 0.13, 0, z - 0.13], [x + 0.13, h - 0.07, z + 0.13], false));
        cols.push(box([x - 0.25, h - 0.1, z - 0.25], [x + 0.25, h, z + 0.25]));
      }
      return finish(B, 'bambooPoles', cols, { w: (n - 1) * gap + 0.6, h: 1 + (n - 1) * step, d: 1 });
    });
  };

  // =====================================================================
  // hangingPlatform: plataforma colgada de cuerdas (ORIGEN = punto de cuelgue; tablero a y = -len) que oscila
  // =====================================================================
  const hangingPlatform = (o: any = {}) => {
    const seed = seedOf('hang', o), L = cl(q(o.len ?? 3, 0.5), 1.5, 8);
    const g = inst(`hang|${L}`, () => {
      const B = new Builder(), pl = M.woodWeathered, rope = M.rope, mt = M.metalDark;
      for (let k = 0; k < 5; k++) B.box(pl, 1.6, 0.06, 0.19, 0, -L - 0.03, -0.4 + k * 0.2);
      for (const s of [-1, 1]) B.box(pl, 0.1, 0.08, 1.05, s * 0.7, -L - 0.1, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.rod(rope, 0.02, V(sx * 0.72, -L - 0.08, sz * 0.46), V(0, -0.12, 0), 4); B.cyl(rope, 0.04, 0.12, sx * 0.72, -L + 0.02, sz * 0.46, 6); }
      B.geo(mt, cached('pc_hook', () => new THREE.TorusGeometry(0.1, 0.022, 5, 12)), 0, 0, 0);
      B.cyl(mt, 0.05, 0.08, 0, -0.12, 0, 8);
      K.lantern(B, 0, -L - 0.14, 0, { text: '灯', color: 'red', s: 0.8, hi: false, frame: mt });
      return finish(B, 'hangingPlatform', [box([-0.8, -L - 0.14, -0.52], [0.8, -L, 0.52])], { w: 1.6, h: L + 0.7, d: 1.05 });
    });
    const r = rng(seed * 23 + 9), w = Math.sqrt(9.8 / (L + 0.5)), A = 0.16 + r() * 0.1, ph = r() * TAU, ph2 = r() * TAU;
    return moving(g, (t, _p, e) => { e.set(Math.sin(t * w * 0.83 + ph2) * A * 0.35, Math.sin(t * 0.13 + ph) * 0.2, Math.sin(t * w + ph) * A); });
  };

  // =====================================================================
  // paperLanternGiant: andon gigante de papel que sube y baja despacio; tapa lacada pisable
  // =====================================================================
  const paperLanternGiant = (o: any = {}) => {
    const seed = seedOf('andon', o), v = seed % 4;
    const g = inst(`andon|${v}`, () => {
      const B = new Builder(), paper = K.lit(andonTex(v), 1.9), blk = M.lacquerBlack, red = M.lacquerRed, gold = M.metalGold;
      B.noShadow(paper);
      const W = 1.7, y0 = 0.3, Hb = 2.4, top = y0 + Hb + 0.12, hw = W / 2;
      for (let k = 0; k < 4; k++) B.geo(paper, planeUV(W - 0.04, Hb, 1, 1), Math.sin(k * Math.PI / 2) * (hw - 0.01), y0 + Hb / 2, Math.cos(k * Math.PI / 2) * (hw - 0.01), k * Math.PI / 2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.box(blk, 0.09, Hb + y0, 0.09, sx * hw, (Hb + y0) / 2, sz * hw); B.box(gold, 0.11, 0.06, 0.11, sx * hw, y0 + 0.04, sz * hw); }
      for (const y of [y0, y0 + Hb * 0.5, y0 + Hb]) for (const s of [-1, 1]) { B.box(blk, W, 0.07, 0.07, 0, y, s * hw); B.box(blk, 0.07, 0.07, W, s * hw, y, 0); }
      B.box(blk, W + 0.24, 0.06, W + 0.24, 0, top - 0.09, 0);
      B.box(red, W + 0.3, 0.08, W + 0.3, 0, top - 0.04, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.box(gold, 0.16, 0.04, 0.16, sx * (hw + 0.07), top + 0.01, sz * (hw + 0.07));
        B.rod(gold, 0.012, V(sx * (hw + 0.1), top - 0.12, sz * (hw + 0.1)), V(sx * (hw + 0.1), top - 0.5, sz * (hw + 0.1)), 3);
        B.cyl(red, 0.06, 0.3, sx * (hw + 0.1), top - 0.65, sz * (hw + 0.1), 6, 0.3);
      }
      return finish(B, 'paperLanternGiant', [
        box([-hw - 0.15, top - 0.12, -hw - 0.15], [hw + 0.15, top, hw + 0.15]),
        box([-hw, 0, -hw], [hw, top - 0.12, hw]),
      ], { w: W + 0.3, h: top, d: W + 0.3 });
    });
    const r = rng(seed * 59 + 1), P = 11 + r() * 4, ph = r() * TAU, A = 1.0 + r() * 0.5;
    return moving(g, (t, p, e) => { p.set(0, Math.sin((t / P) * TAU + ph) * A, 0); e.set(0, Math.sin((t / P) * TAU * 0.5 + ph) * 0.12, Math.sin(t * 0.7 + ph) * 0.015); });
  };

  return { crates, barrels, cart, scaffold, waterTank, bell, stoneLantern, signBoard, bambooPoles, hangingPlatform, paperLanternGiant };
}
