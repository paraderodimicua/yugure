// Piezas JUGABLES de YŪGURE: apoyos y obstáculos de parkour (mástiles, columnas, sombrillas, voladores…).
// createPieces(U, mats, props).make[clave](opts) → PlayPiece (origen en el suelo / punto más bajo, frente a +Z)
// con userData.colliders en coordenadas locales (ver game/contracts.ts). Cada variante se construye UNA vez
// (geometría fusionada por material, ≤ 4 llamadas) y se clona: las piscinas comparten geometría y materiales.
// Las piezas móviles (userData.moving) se animan en update(t) alrededor de la posición/giro en que el juego
// las colocó (si el juego las recoloca, se toma la nueva posición como base). Movimiento determinista por seed.
import * as THREE from 'three';
import type { Shared } from '../stage';
import type { Mats } from '../render/materials';
import type { Collider, PlayPiece, V3 } from './contracts';
import type { createProps } from '../world/props';
import { extraPieces } from './pieces/extra';
import { Builder, cached, rng, stat, V, planeUV, catenary, polyline, vtext, grain, MINCHO, GOTHIC } from '../world/props/kit';

type Props = ReturnType<typeof createProps>;
type Size = { w: number; h: number; d: number };
type Motion = (t: number, p: THREE.Vector3, r: THREE.Euler) => void;

const q = (v: number, s: number) => Math.round(v / s) * s;
const box = (min: V3, max: V3, grab = true): Collider => ({ kind: 'box', min, max, ...(grab ? {} : { grab: false }) });
const TAU = Math.PI * 2;

export function createPieces(U: Shared, mats: Mats, props: Props) {
  void U;
  const K = props.kit, M = mats;

  // ---------- plantillas compartidas + clones ----------
  const tpls = new Map<string, PlayPiece>();
  function finish(B: Builder, name: string, colliders: Collider[], size: Size) {
    const g = B.finish(name, size) as PlayPiece;
    g.userData = { colliders, size };
    stat(g, size);
    return g;
  }
  function inst(key: string, build: () => PlayPiece): PlayPiece {
    let t = tpls.get(key);
    if (!t) { t = build(); tpls.set(key, t); }
    return t.clone() as PlayPiece;
  }

  // ---------- piezas móviles ----------
  type Mover = { g: PlayPiece; fn: Motion; home: THREE.Vector3; hr: THREE.Euler; last: THREE.Vector3; lr: THREE.Euler; init: boolean };
  const movers: Mover[] = [];
  function moving(g: PlayPiece, fn: Motion) {
    g.userData.moving = true;
    movers.push({ g, fn, home: new THREE.Vector3(), hr: new THREE.Euler(), last: new THREE.Vector3(), lr: new THREE.Euler(), init: false });
    return g;
  }
  const _p = new THREE.Vector3(), _r = new THREE.Euler();
  const near = (a: THREE.Euler, b: THREE.Euler) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) < 1e-6;
  function update(t: number, _dt: number) {
    for (const m of movers) {
      const g = m.g;
      if (!g.parent) { m.init = false; continue; }
      if (!m.init || g.position.distanceToSquared(m.last) > 1e-10 || !near(g.rotation, m.lr)) {
        m.home.copy(g.position); m.hr.copy(g.rotation); m.init = true;
      }
      _p.set(0, 0, 0); _r.set(0, 0, 0);
      m.fn(t, _p, _r);
      g.position.copy(m.home).add(_p);
      g.rotation.set(m.hr.x + _r.x, m.hr.y + _r.y, m.hr.z + _r.z);
      m.last.copy(g.position); m.lr.copy(g.rotation);
    }
  }
  const seeds: Record<string, number> = {};
  const seedOf = (k: string, o: any) => (o.seed ?? (seeds[k] = (seeds[k] ?? 0) + 1)) | 0;

  // ---------- texturas ----------
  function noboriTex(text: string, bg: string, fg: string, sub: string, sx: number) {
    return K.tex(`pc_nobori|${text}|${bg}|${fg}|${sub}|${sx.toFixed(2)}`, 128, 256, (g, w, h, r) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f4ead6'; g.fillRect(0, 0, 12, h); g.fillRect(0, 0, w, 10);
      g.fillStyle = bg; for (let y = 22; y < h; y += 24) g.fillRect(3, y, 6, 9);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(12, h - 16, w, 16);
      g.fillStyle = '#e8c060'; g.fillRect(12, 14, w, 3); g.fillRect(12, h - 20, w, 3);
      grain(g, w, h, r, 0.5, false);
      g.fillStyle = fg;
      const n = [...text].length, size = Math.min((h - 70) / (n * 1.04), 64);
      vtext(g, text, w * 0.55, h * 0.44, size, sx, MINCHO, '900');
      if (sub) vtext(g, sub, w - 14, h * 0.82, 12, sx * 0.9, GOTHIC, '700');
      // tomoe (emblema) arriba
      g.beginPath(); g.arc(w * 0.55, 34, 11, 0, TAU); g.fillStyle = '#e8c060'; g.fill();
      g.beginPath(); g.arc(w * 0.55, 34, 6, 0, TAU); g.fillStyle = bg; g.fill();
    });
  }
  const plaqueTex = (text: string) => K.tex(`pc_plaque|${text}`, 64, 96, (g, w, h, r) => {
    g.fillStyle = '#14110f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8a84a'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    grain(g, w, h, r, 0.4, false);
    g.fillStyle = '#e8bc5a'; vtext(g, text, w / 2, h / 2, Math.min(34, (h - 24) / [...text].length), 1, MINCHO, '900');
  });
  const wagasaTex = (color: string) => K.tex(`pc_wagasa|${color}`, 256, 256, (g, w, h, r) => {
    const c = w / 2, base = new THREE.Color(color), dark = base.clone().multiplyScalar(0.55);
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, '#3a2a1c'); gr.addColorStop(0.11, '#3a2a1c'); gr.addColorStop(0.12, '#' + base.getHexString());
    gr.addColorStop(0.5, '#' + base.getHexString()); gr.addColorStop(0.92, '#' + dark.getHexString()); gr.addColorStop(0.93, '#1a1414'); gr.addColorStop(1, '#1a1414');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // janome: anillo de papel blanco
    g.beginPath(); g.arc(c, c, c * 0.7, 0, TAU); g.arc(c, c, c * 0.53, 0, TAU, true); g.fillStyle = '#f3ead8'; g.fill('evenodd');
    g.beginPath(); g.arc(c, c, c * 0.2, 0, TAU); g.arc(c, c, c * 0.15, 0, TAU, true); g.fillStyle = '#e8c060'; g.fill('evenodd');
    g.strokeStyle = 'rgba(30,10,5,0.35)'; g.lineWidth = 1.2;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.12, c + Math.sin(a) * c * 0.12); g.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); g.stroke(); }
    grain(g, w, h, r, 0.8);
  });
  const KITE = [
    { ch: '龍', bd: '#b8261c', sun: '#e8742a', ink: '#141018' },
    { ch: '鷹', bd: '#1f3f7a', sun: '#e8a23a', ink: '#141018' },
    { ch: '寿', bd: '#b8261c', sun: '#f0c040', ink: '#b8261c' },
    { ch: '風', bd: '#2a6a3a', sun: '#e8742a', ink: '#141018' },
  ];
  const kiteTex = (v: number) => K.tex(`pc_kite|${v}`, 256, 320, (g, w, h, r) => {
    const P = KITE[v];
    g.fillStyle = '#f1e3c4'; g.fillRect(0, 0, w, h);
    const b = 22; g.fillStyle = P.bd; g.fillRect(0, 0, w, b); g.fillRect(0, h - b, w, b); g.fillRect(0, 0, b, h); g.fillRect(w - b, 0, b, h);
    g.strokeStyle = '#141018'; g.lineWidth = 3; g.strokeRect(b + 4, b + 4, w - 2 * b - 8, h - 2 * b - 8);
    const sg = g.createRadialGradient(w / 2, h * 0.46, 10, w / 2, h * 0.46, w * 0.36);
    sg.addColorStop(0, P.sun); sg.addColorStop(1, 'rgba(232,116,42,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.lineWidth = 10; g.strokeStyle = '#f1e3c4'; g.fillStyle = P.ink;
    g.font = `900 180px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText(P.ch, w / 2, h * 0.47); g.fillText(P.ch, w / 2, h * 0.47);
    g.fillStyle = '#b8261c'; g.fillRect(w - b - 44, h - b - 46, 30, 30);
    g.fillStyle = '#f1e3c4'; g.font = `900 20px ${MINCHO}`; g.fillText('江', w - b - 29, h - b - 30);
    grain(g, w, h, r, 1);
  });

  // ---------- utilidades de forma ----------
  /** shide (papel en zigzag) colgando desde (x,y,z), mirando a ±Z; ry orienta */
  function shide(B: Builder, x: number, y: number, z: number, ry = 0, s = 1) {
    const pm = M.paper, wq = 0.05 * s, hq = 0.1 * s, pl = cached('pc_shideq', () => new THREE.PlaneGeometry(1, 1));
    for (let i = 0; i < 4; i++) {
      const dx = (i % 2 ? 0.022 : -0.022) * s + 0.01 * i * s, yy = y - hq * (i + 0.5) * 0.92;
      const cx = x + Math.cos(ry) * dx, cz = z - Math.sin(ry) * dx;
      B.geo(pm, pl, cx, yy, cz, ry, 0, 0, wq, hq, 1);
      B.geo(pm, pl, cx, yy, cz, ry + Math.PI, 0, 0, wq, hq, 1);
    }
  }
  const torusH = (rad: number, tube: number, seg = 22) => cached(`pc_tor${rad}_${tube}_${seg}`, () =>
    new THREE.TorusGeometry(rad, tube, 5, seg).rotateX(Math.PI / 2));

  // =====================================================================
  // templeFlag: mástil de templo con nobori, barra para colgarse y remate pisable
  // =====================================================================
  const templeFlag = (o: any = {}) => {
    const H = Math.max(4, q(o.h ?? 7, 0.5)), text = o.text ?? '奉納', bg = o.bg ?? '#b8261c';
    return inst(`flag|${H}|${text}|${bg}`, () => {
      const B = new Builder(), blk = M.lacquerBlack, red = M.lacquerRed, st = M.stone;
      const hb = Math.max(2.3, q(H * 0.5, 0.1)), bl = 1.15, ya = H - 0.5, bw = 0.78, bh = ya - 0.04 - (hb + 0.5);
      const cloth = K.cloth(noboriTex(text, bg, o.fg ?? '#f8f0e0', o.sub ?? '八幡宮', (128 / bw) / (256 / bh) * 0.92), 1, 0.12);
      B.noShadow(cloth);
      // basa de piedra en dos escalones
      B.stone(st, 1.15, 0.38, 1.15, 0, 0.19, 0, 0, 0, 0.07);
      B.stone(st, 0.72, 0.3, 0.72, 0, 0.53, 0, Math.PI / 4, 0, 0.06);
      // mástil lacado negro con anillos rojos
      const y0 = 0.62, y1 = H - 0.3;
      B.cyl(blk, 0.09, y1 - y0, 0, (y0 + y1) / 2, 0, 12, 0.78);
      for (const y of [y0 + 0.08, y0 + 0.4, hb - 0.55, ya + 0.12]) B.cyl(red, 0.105, 0.06, 0, y, 0, 12);
      // verga del estandarte + estandarte (tela con viento en GPU)
      B.rod(blk, 0.026, V(0, ya, 0), V(bw + 0.2, ya, 0), 6);
      B.sphere(red, 0.05, bw + 0.22, ya, 0, 1, 8, 6);
      B.geo(cloth, planeUV(bw, bh, 4, 12), 0.1 + bw / 2, ya - 0.04 - bh / 2, 0);
      for (let k = 0; k < 4; k++) B.cyl(blk, 0.11, 0.03, 0, ya - 0.15 - k * (bh / 4), 0, 10); // chichi
      // barra de colgarse (a lo largo de Z), roja con regatones negros y abrazadera
      B.cyl(red, 0.052, 2 * bl, 0, hb, 0, 12, 1, 0, Math.PI / 2, 0);
      for (const s of [-1, 1]) {
        B.cyl(blk, 0.068, 0.12, 0, hb, s * (bl - 0.06), 12, 1, 0, Math.PI / 2, 0);
        B.cyl(blk, 0.062, 0.03, 0, hb, s * 0.45, 12, 1, 0, Math.PI / 2, 0);
      }
      B.box(blk, 0.24, 0.24, 0.24, 0, hb, 0);
      B.rod(blk, 0.02, V(0, hb + 0.55, 0), V(0, hb + 0.03, bl - 0.25), 4); // tirantes
      B.rod(blk, 0.02, V(0, hb + 0.55, 0), V(0, hb + 0.03, -bl + 0.25), 4);
      // remate pisable
      B.cyl(blk, 0.13, 0.22, 0, H - 0.27, 0, 8, 2.2);
      B.box(blk, 0.88, 0.07, 0.88, 0, H - 0.135, 0);
      B.box(red, 0.8, 0.1, 0.8, 0, H - 0.05, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(blk, 0.08, 0.04, 0.08, sx * 0.38, H + 0.02, sz * 0.38);
      return finish(B, 'templeFlag', [
        box([-0.58, 0, -0.58], [0.58, 0.68, 0.58]),
        box([-0.1, 0.68, -0.1], [0.1, H - 0.17, 0.1], false),
        box([-0.44, H - 0.17, -0.44], [0.44, H, 0.44]),
        { kind: 'bar', a: [0, hb, -bl], b: [0, hb, bl], r: 0.052 },
      ], { w: 1.2, h: H, d: 2.3 });
    });
  };

  // =====================================================================
  // column: columna de templo (piedra con shimenawa o madera lacada), capitel pisable
  // =====================================================================
  const column = (o: any = {}) => {
    const H = Math.max(2, q(o.h ?? 4, 0.25)), kind: 'stone' | 'lacquer' = o.kind ?? 'stone';
    const top: 'cap' | 'broken' | 'tilt' = o.broken ? 'broken' : o.tilt ? 'tilt' : (o.top ?? 'cap');
    const seed = (o.seed ?? 1) % 4;
    return inst(`col|${H}|${kind}|${top}|${seed}`, () => {
      const B = new Builder(), r = rng(seed * 97 + 13), cols: Collider[] = [];
      const broken = top === 'broken';
      let yTop = H;            // cota de la superficie pisable superior
      let topHalf = 0.62, shaftR = 0.42;
      if (kind === 'stone') {
        const st = M.stone, ms = M.moss;
        B.stone(st, 1.3, 0.4, 1.3, 0, 0.2, 0, 0, 0, 0.07, r, 0.02);
        B.stone(st, 1.0, 0.22, 1.0, 0, 0.51, 0, 0, 0, 0.05, r, 0.015);
        const y0 = 0.62, yEnd = broken ? H * 0.72 : H - 0.38;
        const n = Math.max(2, Math.round((yEnd - y0) / 0.8)), dh = (yEnd - y0) / n;
        for (let k = 0; k < n; k++) {
          const rr = 0.42 - k * 0.012, yc = y0 + dh * (k + 0.5);
          B.cyl(st, rr, dh - 0.035, (r() - 0.5) * 0.03, yc, (r() - 0.5) * 0.03, 8, 0.99, r() * 0.8);
          B.cyl(st, rr - 0.05, 0.05, 0, y0 + dh * (k + 1), 0, 8);
          if (r() < 0.6) { const a = r() * TAU; B.sphere(ms, 0.2 + r() * 0.1, Math.cos(a) * rr, yc + (r() - 0.5) * dh * 0.5, Math.sin(a) * rr, 1.6, 6, 4); }
        }
        // musgo sobre la basa
        for (let k = 0; k < 4; k++) { const a = r() * TAU; B.sphere(ms, 0.25 + r() * 0.12, Math.cos(a) * 0.55, 0.42, Math.sin(a) * 0.55, 0.35, 6, 4); }
        // shimenawa con shide: señal cálida de "esto se trepa"
        const ys = Math.min(1.9, yEnd - 0.4);
        B.geo(M.rope, torusH(0.46, 0.07), 0, ys, 0);
        B.geo(M.rope, torusH(0.45, 0.05), 0, ys - 0.1, 0);
        for (const a of [0.35, -0.35, Math.PI]) shide(B, Math.sin(a) * 0.5, ys - 0.08, Math.cos(a) * 0.5, a, 1.4);
        if (!broken) {
          B.cyl(st, 0.45, 0.16, 0, H - 0.3, 0, 8, 1.4);
          B.stone(st, 1.34, 0.24, 1.34, 0, H - 0.12, 0, 0, 0, 0.05, r, 0.02);
          B.box(ms, 0.5, 0.05, 0.4, 0.42, H + 0.005, -0.44, 0.2);
          B.sphere(ms, 0.24, -0.6, H - 0.08, 0.5, 0.6, 6, 4);
        } else {
          // muñón roto: lascas irregulares encima y tambor caído al pie
          B.stone(st, 0.5, 0.3, 0.36, -0.1, yEnd + 0.12, 0.08, 0.4, 0, 0.03, r, 0.06);
          B.stone(st, 0.28, 0.2, 0.22, 0.22, yEnd + 0.07, -0.18, 1.1, 0, 0.03, r, 0.05);
          B.sphere(ms, 0.22, 0.15, yEnd - 0.02, 0.2, 0.5, 6, 4);
          B.cyl(st, 0.4, 0.7, 1.25, 0.4, 0.3, 8, 1, 0.6, 0, Math.PI / 2);
          B.sphere(ms, 0.28, 1.2, 0.72, 0.3, 0.45, 6, 4);
          cols.push(box([0.9, 0, -0.15], [1.6, 0.8, 0.75]));
          yTop = yEnd; topHalf = 0.36;
        }
      } else {
        const red = M.lacquerRed, blk = M.lacquerBlack, st = M.stone, gold = broken ? M.woodWarm : M.metalGold;
        shaftR = 0.33;
        B.stone(st, 1.15, 0.3, 1.15, 0, 0.15, 0, 0, 0, 0.06, r, 0.02);
        B.cyl(st, 0.52, 0.14, 0, 0.37, 0, 12, 0.82);
        const y0 = 0.44, yEnd = broken ? H * 0.74 : H - 0.62;
        B.cyl(red, 0.32, yEnd - y0, 0, (y0 + yEnd) / 2, 0, 14, 0.96);
        B.cyl(blk, 0.335, 0.4, 0, y0 + 0.2, 0, 14);
        if (!broken) {
          B.cyl(gold, 0.345, 0.05, 0, y0 + 0.42, 0, 14);
          B.cyl(gold, 0.33, 0.05, 0, yEnd - 0.06, 0, 14);
          // capitel: dado (masu) + brazos cruzados (hijiki) + tablero
          B.box(blk, 0.74, 0.26, 0.74, 0, yEnd + 0.13, 0);
          B.box(blk, 1.45, 0.14, 0.24, 0, yEnd + 0.33, 0); B.box(blk, 0.24, 0.14, 1.45, 0, yEnd + 0.33, 0);
          for (const s of [-1, 1]) { B.box(gold, 0.06, 0.15, 0.26, s * 0.73, yEnd + 0.33, 0); B.box(gold, 0.26, 0.15, 0.06, 0, yEnd + 0.33, s * 0.73); }
          B.box(blk, 0.5, 0.12, 0.5, 0, yEnd + 0.46, 0);
          B.box(red, 1.2, 0.1, 1.2, 0, H - 0.05, 0);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(gold, 0.1, 0.03, 0.1, sx * 0.55, H + 0.01, sz * 0.55);
          topHalf = 0.6;
        } else {
          // astillas de madera viva en el corte
          B.cyl(gold, 0.29, 0.03, 0, yEnd + 0.01, 0, 12);
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * TAU + r() * 0.4, hh = 0.12 + r() * 0.35;
            B.box(k % 2 ? red : gold, 0.09, hh, 0.07, Math.cos(a) * 0.26, yEnd + hh / 2, Math.sin(a) * 0.26, -a, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3);
          }
          yTop = yEnd; topHalf = 0.3;
        }
      }
      const g = finish(B, 'column', cols, { w: 1.3, h: H, d: 1.3 });
      const capB = kind === 'stone' ? 0.42 : 0.62;
      if (top === 'tilt') {
        const a = (seed % 2 ? 1 : -1) * 0.14, c = Math.cos(a), s = Math.sin(a), sink = 0.14;
        const m = new THREE.Matrix4().makeRotationZ(a).premultiply(new THREE.Matrix4().makeTranslation(0, -sink, 0));
        for (const ch of g.children) { const geo = (ch as THREE.Mesh).geometry; geo.applyMatrix4(m); geo.computeBoundingSphere(); geo.computeBoundingBox(); }
        const rp = (x: number, y: number): [number, number] => [x * c - y * s, x * s + y * c - sink];
        // fuste en tres tramos que siguen la inclinación
        for (let k = 0; k < 3; k++) {
          const ya = 0.55 + (H - capB - 0.55) * (k / 3), yb = 0.55 + (H - capB - 0.55) * ((k + 1) / 3);
          const [cx, cy0] = rp(0, ya), [, cy1] = rp(0, yb), hw = shaftR + Math.abs(s) * (yb - ya) / 2;
          cols.push(box([cx - hw, cy0, -shaftR], [cx + hw, cy1, shaftR], false));
        }
        const [tx, ty] = rp(0, H);
        cols.push(box([tx - topHalf, ty - 0.28, -topHalf], [tx + topHalf, ty, topHalf]));
        cols.push(box([-0.6, 0, -0.6], [0.6, 0.55 - sink, 0.6]));
      } else {
        cols.push(box([-0.62, 0, -0.62], [0.62, 0.58, 0.62]));
        cols.push(box([-shaftR, 0.58, -shaftR], [shaftR, yTop - 0.28, shaftR], false));
        cols.push(box([-topHalf, yTop - 0.28, -topHalf], [topHalf, yTop + (broken ? 0.02 : 0), topHalf]));
      }
      g.userData.colliders = cols;
      return g;
    });
  };

  // =====================================================================
  // pole: poste de cables japonés con travesaño agarrable, pates de subida y farolillo
  // =====================================================================
  const pole = (o: any = {}) => {
    const H = Math.max(4, q(o.h ?? 6.5, 0.5));
    return inst(`pole|${H}`, () => {
      const B = new Builder(), wd = M.woodWeathered, mt = M.metalDark, cer = M.ceramic;
      const ya = H - 0.55, al = 0.95;
      B.cyl(wd, 0.15, H, 0, H / 2, 0, 10, 0.72);
      B.cyl(mt, 0.11, 0.05, 0, H + 0.02, 0, 8);
      // travesaño (barra) con aisladores de porcelana y riostras
      B.box(wd, 2 * al, 0.13, 0.13, 0, ya, 0);
      for (const s of [-1, 1]) {
        B.cyl(mt, 0.07, 0.05, s * al, ya, 0, 6, 1, 0, 0, Math.PI / 2);
        B.rod(mt, 0.018, V(s * 0.6, ya - 0.06, 0.08), V(0, ya - 0.75, 0.11), 4);
        for (const x of [0.35, 0.8]) {
          B.cyl(mt, 0.012, 0.08, s * x, ya + 0.1, 0, 4);
          B.cyl(cer, 0.05, 0.11, s * x, ya + 0.18, 0, 8, 0.75);
          B.cyl(cer, 0.065, 0.025, s * x, ya + 0.16, 0, 8);
          B.rod(mt, 0.008, V(s * x, ya + 0.23, 0), V(s * (x + 0.35), ya + 0.12, 0), 3);
        }
      }
      // transformador
      B.cyl(mt, 0.2, 0.55, 0, H - 1.45, -0.36, 10);
      B.cyl(cer, 0.04, 0.12, 0.08, H - 1.1, -0.36, 6, 0.6);
      B.box(mt, 0.08, 0.45, 0.2, 0, H - 1.45, -0.16);
      // pates (ashiba-boruto) alternos
      for (let y = 1.9, k = 0; y < ya - 0.5; y += 0.42, k++) {
        const a = k % 2 ? Math.PI / 2 : -Math.PI / 2;
        B.rod(mt, 0.017, V(0, y, 0), V(Math.sin(a) * 0.36, y, Math.cos(a) * 0.36), 4);
      }
      // brazo con farolillo de festival
      const yl = Math.min(3.2, H * 0.5);
      B.rod(mt, 0.02, V(0, yl, 0.1), V(0, yl, 0.62), 4);
      B.rod(mt, 0.012, V(0, yl + 0.35, 0.1), V(0, yl, 0.55), 3);
      K.lantern(B, 0, yl, 0.6, { text: '御神燈', color: 'white', shape: 'long', s: 1.05, hi: true, frame: mt, glow: 1.8 });
      return finish(B, 'pole', [
        box([-0.16, 0, -0.16], [0.16, H, 0.16], false),
        { kind: 'bar', a: [-al, ya, 0], b: [al, ya, 0], r: 0.07 },
      ], { w: 2 * al, h: H, d: 0.8 });
    });
  };

  // =====================================================================
  // umbrella: wagasa gigante de puesto sobre mástil; la copa rebota
  // =====================================================================
  const canopyGeo = (r: number, rise: number) => cached(`pc_canopy${r}_${rise}`, () => {
    const R = 6, A = 48, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= R; i++) {
      const t = Math.max(0.03, i / R);
      for (let j = 0; j < A; j++) {
        const a = (j / A) * TAU, rib = j % 2 === 0;
        const rr = r * t * (rib ? 1 : 1 - 0.035 * t), y = rise * (1 - Math.pow(t, 1.35)) - (rib ? 0 : 0.04 * r * t);
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        pos.push(x, y, z); uv.push(0.5 + x / (2 * r), 0.5 - z / (2 * r));
      }
    }
    for (let i = 0; i < R; i++) for (let j = 0; j < A; j++) {
      const a = i * A + j, b = i * A + (j + 1) % A, c = (i + 1) * A + j, d = (i + 1) * A + (j + 1) % A;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  });
  const umbrella = (o: any = {}) => {
    const r = Math.max(1, q(o.r ?? 2.2, 0.1)), color = o.color ?? '#c0392b', H = Math.max(1.8, q(o.h ?? 3, 0.25));
    return inst(`umb|${r}|${color}|${H}`, () => {
      const B = new Builder(), bam = M.bamboo, blk = M.lacquerBlack, wd = M.woodDark;
      const rise = 0.3 * r, paper = K.print(wagasaTex(color), true);
      B.geo(paper, canopyGeo(r, rise), 0, H, 0);
      const prof = (t: number) => H + rise * (1 - Math.pow(t, 1.35));
      // mástil, rokuro (cubo) y corredera
      B.cyl(bam, 0.065, H + rise + 0.25, 0, (H + rise + 0.25) / 2, 0, 8);
      for (let y = 0.6; y < H; y += 0.55) B.cyl(bam, 0.075, 0.04, 0, y, 0, 8);
      B.cyl(blk, 0.13, 0.16, 0, H + rise + 0.02, 0, 10, 0.6);
      B.sphere(blk, 0.07, 0, H + rise + 0.3, 0, 1.2, 8, 5);
      const yr = H - 0.25 * r; B.cyl(blk, 0.1, 0.22, 0, yr, 0, 10);
      // varillas (oya-bone) bajo la copa y tirantes (ko-bone)
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        B.rod(bam, 0.014, V(ca * 0.12, prof(0.05) - 0.03, sa * 0.12), V(ca * r, prof(1) - 0.03, sa * r), 3);
        B.rod(bam, 0.011, V(ca * 0.1, yr + 0.08, sa * 0.1), V(ca * r * 0.5, prof(0.5) - 0.04, sa * r * 0.5), 3);
      }
      // base de puesto: cubo de madera con zunchos
      B.cyl(wd, 0.36, 0.45, 0, 0.225, 0, 12, 0.9);
      B.cyl(blk, 0.37, 0.05, 0, 0.1, 0, 12); B.cyl(blk, 0.34, 0.05, 0, 0.38, 0, 12);
      return finish(B, 'umbrella', [
        box([-0.37, 0, -0.37], [0.37, 0.46, 0.37]),
        box([-0.08, 0.46, -0.08], [0.08, H + rise * 0.5, 0.08], false),
        { kind: 'bounce', center: [0, H + rise * 0.55, 0], r: r * 0.88, power: o.power ?? 1 },
      ], { w: 2 * r, h: H + rise + 0.35, d: 2 * r });
    });
  };

  // =====================================================================
  // lanternFloat: chochin gigante a la deriva con tapa pisable y anilla de agarre colgante
  // =====================================================================
  const LTXT = ['祭', '灯', '夢', '願'];
  const lanternFloat = (o: any = {}) => {
    const seed = seedOf('lantern', o), v = seed % 4, s = o.s ?? 3;
    const g = inst(`lant|${v}|${s}`, () => {
      const B = new Builder(), blk = M.lacquerBlack, gold = M.metalGold, cord = M.tint('rope', '#b8261c');
      const yb = 1.15, yTop = yb + 0.586 * s;
      K.lantern(B, 0, yTop, 0, { text: LTXT[v], color: v % 2 ? 'white' : 'red', s, hi: true, glow: 2.2 });
      // tapa redonda pisable
      B.cyl(blk, 0.56, 0.09, 0, yTop + 0.045, 0, 14);
      B.cyl(gold, 0.58, 0.03, 0, yTop + 0.01, 0, 14);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + Math.PI / 4; B.box(gold, 0.1, 0.03, 0.1, Math.cos(a) * 0.42, yTop + 0.1, Math.sin(a) * 0.42, a); }
      // cordón, anilla dorada y borla
      const yR = 0.55;
      B.rod(cord, 0.022, V(0, yb - 0.02, 0), V(0, yR + 0.15, 0), 5);
      B.geo(gold, cached('pc_ring', () => new THREE.TorusGeometry(0.15, 0.028, 6, 18)), 0, yR, 0);
      B.cyl(gold, 0.05, 0.08, 0, yR - 0.18, 0, 8);
      B.cyl(cord, 0.09, 0.36, 0, yR - 0.4, 0, 10, 0.35);
      return finish(B, 'lanternFloat', [
        box([-0.4, yTop - 0.05, -0.4], [0.4, yTop + 0.09, 0.4]),
        box([-0.5, yb + 0.1, -0.5], [0.5, yTop - 0.05, 0.5], false),
        { kind: 'grab', a: [0, yR + 0.15, 0], b: [0, yR - 0.15, 0] },
      ], { w: 1.4, h: yTop + 0.1, d: 1.4 });
    });
    const r = rng(seed * 31 + 7), f1 = TAU / (5 + r() * 3), f2 = TAU / (7 + r() * 4), f3 = TAU / (9 + r() * 5);
    const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU, ay = 0.6 + r() * 0.4, ax = 0.6 + r() * 0.6;
    return moving(g, (t, p, e) => {
      p.set(Math.sin(t * f2 + p2) * ax, Math.sin(t * f1 + p1) * ay + Math.sin(t * f1 * 2.3 + p3) * 0.15, Math.sin(t * f3 + p3) * 0.35);
      e.set(Math.sin(t * f3 * 1.7 + p1) * 0.05, t * 0.08, Math.cos(t * f2 + p2) * 0.07);
    });
  };

  // =====================================================================
  // kite: cometa edo-dako atada (origen = estaca del hilo) que oscila; barra colgante bajo ella
  // =====================================================================
  const kiteGeo = (w: number, h: number) => cached(`pc_kite${w}_${h}`, () => {
    const g = new THREE.PlaneGeometry(w, h, 6, 6), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) / (w / 2); P.setZ(i, -0.28 * x * x); }
    g.computeVertexNormals(); return g;
  });
  const kite = (o: any = {}) => {
    const seed = seedOf('kite', o), v = seed % 4, L = Math.max(4, q(o.len ?? 9, 0.5));
    const g = inst(`kite|${v}|${L}`, () => {
      const B = new Builder(), bam = M.bamboo, rope = M.rope, w = 2.1, h = 2.7, tilt = -0.35;
      const paper = K.print(kiteTex(v), true);
      const ct = Math.cos(tilt), stl = Math.sin(tilt);
      const kp = (x: number, y: number, dz = 0) => { const xx = x / (w / 2), z = -0.28 * xx * xx + dz; return V(x, L + y * ct - z * stl, y * stl + z * ct); };
      B.geo(paper, kiteGeo(w, h), 0, L, 0, 0, tilt);
      // armazón de bambú (detrás del papel)
      const bk = -0.03;
      const fr: [number, number][][] = [[[-w / 2, -h / 2], [w / 2, -h / 2]], [[-w / 2, h / 2], [w / 2, h / 2]], [[-w / 2, -h / 2], [-w / 2, h / 2]], [[w / 2, -h / 2], [w / 2, h / 2]],
        [[0, -h / 2], [0, h / 2]], [[-w / 2, -h / 2], [w / 2, h / 2]], [[w / 2, -h / 2], [-w / 2, h / 2]], [[-w / 2, 0.2], [w / 2, 0.2]]];
      for (const [a, b] of fr) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push(kp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, bk)); }
        polyline(B, bam, 0.022, pts, 4);
      }
      // brida: hilos que convergen delante de la cometa, y el hilo hasta la estaca
      const Q = V(0, L - 0.55, 1.25);
      for (const [x, y] of [[-w / 2, h / 2], [w / 2, h / 2], [-w / 2, -h / 2 + 0.3], [w / 2, -h / 2 + 0.3], [0, 0.2], [0, h / 2 - 0.2]] as [number, number][])
        B.rod(rope, 0.006, kp(x, y, 0.01), Q, 3);
      const tp: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; tp.push(V(0, Q.y * (1 - t), Q.z * (1 - t) + 0.9 * 4 * t * (1 - t))); }
      polyline(B, rope, 0.01, tp, 3);
      B.cyl(bam, 0.05, 0.5, 0, 0.15, 0, 6, 0.4, 0, Math.PI); // estaca
      // colas de papel (franja del borde de la textura)
      const tail = cached('pc_kitetail', () => planeUV(0.11, 0.36, 1, 1, 0.012, 0.3, 0.07, 0.7));
      for (const s of [-1, 1]) {
        const c = kp(s * (w / 2 - 0.1), -h / 2);
        let x = c.x, y = c.y, z = c.z + 0.04;
        for (let k = 0; k < 6; k++) {
          const a = s * (0.25 + 0.06 * k) + (k % 2 ? 0.35 : -0.35) * s;
          const dx = Math.sin(a) * 0.36, dy = -Math.cos(a) * 0.36;
          B.geo(paper, tail, x + dx / 2, y + dy / 2, z, 0, 0, a);
          x += dx; y += dy; z += 0.05;
        }
      }
      // barra de trapecio colgante
      const yb = L - h / 2 * ct - 0.95, zb = -h / 2 * stl + 0.1, bw = 0.7;
      B.cyl(bam, 0.04, 2 * bw + 0.1, 0, yb, zb, 8, 1, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) {
        B.cyl(rope, 0.05, 0.12, s * 0.25, yb, zb, 8, 1, 0, 0, Math.PI / 2);
        B.rod(rope, 0.009, V(s * bw, yb, zb), kp(s * bw, -h / 2, 0.01), 3);
      }
      return finish(B, 'kite', [{ kind: 'bar', a: [-bw, yb, zb], b: [bw, yb, zb], r: 0.04 }], { w, h: L + h / 2, d: 1.5 });
    });
    const r = rng(seed * 53 + 3), f1 = TAU / (6 + r() * 3), f2 = TAU / (9 + r() * 4), p1 = r() * TAU, p2 = r() * TAU;
    return moving(g, (t, _p, e) => {
      e.set(-0.06 + Math.sin(t * f2 + p2) * 0.05, Math.sin(t * f2 * 0.7 + p1) * 0.1,
        Math.sin(t * f1 + p1) * 0.11 + Math.sin(t * f1 * 2.7 + p2) * 0.025);
    });
  };

  // =====================================================================
  // craneFloat: orizuru gigante que planea en círculos; lomo y alas internas pisables
  // =====================================================================
  const craneFloat = (o: any = {}) => {
    const seed = seedOf('crane', o), S = q(o.s ?? 1.3, 0.1), red = !!(o.red ?? seed % 3 === 2);
    const g = inst(`crane|${S}|${red}`, () => {
      const B = new Builder(), wp = red ? M.tint('paper', '#c8372a') : M.paper, rp = red ? M.paper : M.tint('paper', '#c8372a'), gold = M.metalGold;
      const y0 = 0.7;
      const P = (x: number, y: number, z: number) => V(x * S, (y + y0) * S, z * S);
      const dt = (m: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => { B.tri(m, a, b, c); B.tri(m, a, c, b); };
      const N = P(0, 0.45, 0.85), T = P(0, 0.45, -0.85), Bt = P(0, 0.74, 0), D = P(0, 0.05, 0), Lf = P(-0.38, 0.5, 0), Rt = P(0.38, 0.5, 0);
      for (const [a, b, c] of [[N, Lf, Bt], [N, Bt, Rt], [T, Bt, Lf], [T, Rt, Bt], [N, D, Lf], [N, Rt, D], [T, Lf, D], [T, D, Rt]]) dt(wp, a, b, c);
      // cuello y cabeza (corona roja de tancho)
      const n1 = P(-0.1, 0.5, 0.72), n2 = P(0.1, 0.5, 0.72), n3 = P(0, 0.32, 0.85), Hn = P(0, 1.55, 1.48);
      dt(wp, n1, n2, Hn); dt(wp, n2, n3, Hn); dt(wp, n3, n1, Hn);
      const hl = P(-0.07, 1.5, 1.44), hr = P(0.07, 1.5, 1.44), Hd = P(0, 1.33, 1.95), Hu = P(0, 1.63, 1.56);
      dt(rp, hl, hr, Hd); dt(rp, hl, Hd, Hu); dt(rp, hr, Hu, Hd);
      // cola
      const t1 = P(-0.1, 0.5, -0.72), t2 = P(0.1, 0.5, -0.72), t3 = P(0, 0.32, -0.85), Tt = P(0, 1.4, -1.85);
      dt(wp, t1, t2, Tt); dt(wp, t2, t3, Tt); dt(wp, t3, t1, Tt);
      // alas con pliegue y punta roja
      for (const s of [-1, 1]) {
        const Rf = P(s * 0.3, 0.58, 0.42), Rb = P(s * 0.3, 0.58, -0.42), Wf = P(s * 1.25, 0.8, 0.36), Wt = P(s * 2.3, 1.15, -0.45);
        const P1 = Wf.clone().lerp(Wt, 0.62), P2 = Rb.clone().lerp(Wt, 0.62), Wm = Rb.clone().lerp(Wf, 0.5).add(V(0, 0.05 * S, 0));
        dt(wp, Rf, Rb, Wm); dt(wp, Rf, Wm, Wf); dt(wp, Wf, Wm, P2); dt(wp, Wm, Rb, P2); dt(wp, Wf, P2, P1); dt(rp, P1, P2, Wt);
      }
      // cascabel dorado colgando del vientre
      B.rod(gold, 0.012 * S, P(0, 0.06, 0.1), P(0, -0.42, 0.1), 3);
      B.sphere(gold, 0.08 * S, 0, (-0.48 + y0) * S, 0.1 * S, 1, 8, 6);
      B.cyl(rp, 0.05 * S, 0.14 * S, 0, (-0.62 + y0) * S, 0.1 * S, 6, 0.3);
      return finish(B, 'craneFloat', [
        box([-1.25 * S, (0.4 + y0) * S, -0.45 * S], [1.25 * S, (0.76 + y0) * S, 0.45 * S]),
      ], { w: 4.6 * S, h: 2.4 * S, d: 3.8 * S });
    });
    const r = rng(seed * 71 + 11), Rc = 3 + r() * 2, P = 24 + r() * 10, dir = r() < 0.5 ? 1 : -1, ph = r() * TAU, fb = TAU / (6 + r() * 3);
    return moving(g, (t, p, e) => {
      const th = ph + dir * (t / P) * TAU;
      p.set(Math.cos(th) * Rc, Math.sin(t * fb + ph) * 0.3, Math.sin(th) * Rc);
      const vx = -Math.sin(th) * dir, vz = Math.cos(th) * dir;
      e.set(Math.sin(t * fb + ph) * -0.04, Math.atan2(vx, vz), -dir * 0.13);
    });
  };

  // =====================================================================
  // rockFloat: roca flotante con hokora de piedra, torii diminuto, musgo y shimenawa
  // =====================================================================
  const rockFloat = (o: any = {}) => {
    const seed = seedOf('rock', o), v = seed % 3, R = q(o.r ?? 1.5, 0.25);
    const g = inst(`rock|${v}|${R}`, () => {
      const B = new Builder(), r = rng(v * 131 + 5), st = M.stone, ms = M.moss, red = M.lacquerRed;
      const Ht = 2.4, n = 13;
      const rings = [{ y: Ht, k: 1.0, j: 0.02 }, { y: Ht - 0.35, k: 1.08, j: 0.08 }, { y: Ht - 0.9, k: 0.86, j: 0.15 }, { y: Ht - 1.5, k: 0.55, j: 0.15 }, { y: Ht - 2.0, k: 0.24, j: 0.1 }];
      const jit = Array.from({ length: n }, () => 0.86 + r() * 0.26);
      const pts = rings.map((rg) => Array.from({ length: n }, (_, i) => {
        const a = (i / n) * TAU + (r() - 0.5) * 0.12, rr = R * rg.k * jit[i] * (0.94 + r() * 0.12);
        return V(Math.cos(a) * rr, rg.y + (r() - 0.5) * rg.j * 2, Math.sin(a) * rr);
      }));
      for (let k = 0; k < pts.length - 1; k++) for (let i = 0; i < n; i++) {
        const a = pts[k], b = pts[k + 1], i2 = (i + 1) % n;
        B.quad(st, b[i2], b[i], a[i], a[i2]);
      }
      const tip = V((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3), last = pts[pts.length - 1];
      for (let i = 0; i < n; i++) B.tri(st, tip, last[i], last[(i + 1) % n]);
      // manto de musgo sobre la cima, desbordando el borde
      const top = pts[0], mc = V(0, Ht + 0.07, 0), mt = top.map((p) => V(p.x * 1.03, Ht + 0.06, p.z * 1.03));
      for (let i = 0; i < n; i++) B.tri(ms, mc, mt[(i + 1) % n], mt[i]);
      for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n, d1 = 0.15 + r() * 0.3, d2 = 0.15 + r() * 0.3;
        const l1 = V(top[i].x * 1.1, Ht - d1, top[i].z * 1.1), l2 = V(top[i2].x * 1.1, Ht - d2, top[i2].z * 1.1);
        B.quad(ms, l2, l1, mt[i], mt[i2]);
        if (r() < 0.45) { const p = l1.clone().lerp(l2, 0.5), len = 0.4 + r() * 0.8; B.cyl(ms, 0.05, len, p.x * 0.98, p.y - len / 2, p.z * 0.98, 4, 0.15, 0, Math.PI); }
      }
      // shimenawa alrededor de la roca
      const ys = Ht - 0.55;
      B.geo(M.rope, cached(`pc_rockrope${R}`, () => new THREE.TorusGeometry(R * 1.0, 0.07, 5, 26).rotateX(Math.PI / 2)), 0, ys, 0);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.3; B.cyl(M.rope, 0.04, 0.35, Math.cos(a) * R * 1.02, ys - 0.2, Math.sin(a) * R * 1.02, 4, 1.6); }
      // hokora de piedra
      const yS = Ht + 0.06, zS = -R * 0.38;
      B.box(st, 0.62, 0.14, 0.5, 0, yS + 0.07, zS);
      B.box(st, 0.4, 0.42, 0.34, 0, yS + 0.35, zS);
      for (const s of [-1, 1]) B.box(st, 0.62, 0.06, 0.32, 0, yS + 0.66, zS + s * 0.12, 0, s * 0.55);
      B.box(st, 0.66, 0.07, 0.07, 0, yS + 0.75, zS);
      B.box(red, 0.18, 0.1, 0.12, 0, yS + 0.05, zS + 0.36);
      // torii diminuto
      const zT = zS + 0.75;
      for (const s of [-1, 1]) B.cyl(red, 0.028, 0.55, s * 0.2, yS + 0.275, zT, 6);
      B.box(red, 0.56, 0.05, 0.07, 0, yS + 0.57, zT); B.box(red, 0.46, 0.035, 0.05, 0, yS + 0.46, zT);
      const hb = R * 0.62;
      return finish(B, 'rockFloat', [
        box([-hb, Ht - 0.9, -hb], [hb, yS, hb]),
        box([-0.32, yS, zS - 0.26], [0.32, yS + 0.78, zS + 0.26]),
      ], { w: 2.2 * R, h: Ht + 0.9, d: 2.2 * R });
    });
    const r = rng(seed * 17 + 29), f1 = TAU / (7 + r() * 4), f2 = TAU / (11 + r() * 5), p1 = r() * TAU, p2 = r() * TAU;
    return moving(g, (t, p, e) => {
      p.set(Math.sin(t * f2 + p2) * 0.3, Math.sin(t * f1 + p1) * 0.38, Math.cos(t * f2 * 0.8 + p1) * 0.2);
      e.set(Math.sin(t * f1 + p2) * 0.015, Math.sin(t * f2 * 0.5 + p1) * 0.15, Math.cos(t * f1 * 0.9 + p2) * 0.015);
    });
  };

  // =====================================================================
  // beam: viga de madera entre dos tejados (eje X, origen bajo el centro)
  // =====================================================================
  const beam = (o: any = {}) => {
    const len = Math.max(1, q(o.len ?? 4, 0.25));
    return inst(`beam|${len}`, () => {
      const B = new Builder(), wd = M.woodWeathered, mt = M.metalDark, rope = M.rope, cloth = M.tint('fabric', '#b52a20');
      const hh = 0.26, ww = 0.32, L2 = len / 2;
      B.box(wd, len, hh - 0.04, ww, 0, (hh - 0.04) / 2, 0);
      B.box(wd, len - 0.04, 0.04, ww - 0.06, 0, hh - 0.02, 0); // canto achaflanado
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) B.box(rope, 0.05, hh + 0.04, ww + 0.04, s * (L2 - 0.25 - k * 0.07), hh / 2 - 0.01, 0);
        B.box(mt, 0.05, 0.03, ww + 0.02, s * (L2 - 0.6), hh + 0.005, 0);
      }
      for (let x = -L2 + 1.0; x < L2 - 0.9; x += 1.1) { B.box(mt, 0.24, 0.025, 0.04, x, hh + 0.005, 0.07); B.box(mt, 0.025, 0.08, 0.04, x - 0.11, hh - 0.03, 0.07); B.box(mt, 0.025, 0.08, 0.04, x + 0.11, hh - 0.03, 0.07); }
      // tenugui rojo anudado en el centro
      const pl = cached('pc_quad', () => new THREE.PlaneGeometry(1, 1));
      B.box(cloth, 0.12, hh + 0.03, ww + 0.03, 0.3, hh / 2, 0);
      for (const [dz, rz, l] of [[1, 0.12, 0.55], [1, -0.2, 0.42]] as [number, number, number][]) {
        const z = dz * (ww / 2 + 0.02), x = 0.3 + Math.sin(rz) * l / 2;
        B.geo(cloth, pl, x, -l / 2 + 0.05, z, 0, 0, rz, 0.1, l, 1); B.geo(cloth, pl, x, -l / 2 + 0.05, z, Math.PI, 0, -rz, 0.1, l, 1);
      }
      return finish(B, 'beam', [box([-L2, 0, -ww / 2], [L2, hh, ww / 2])], { w: len, h: hh, d: ww });
    });
  };

  // =====================================================================
  // ropeBridge: puente de cuerda (eje X, extremos a y=0 en x=±len/2) que se balancea
  // =====================================================================
  const ropeBridge = (o: any = {}) => {
    const seed = seedOf('bridge', o), len = Math.max(2, q(o.len ?? 6, 0.5)), sag = q(o.sag ?? Math.min(0.8, len * 0.09), 0.05);
    const g = inst(`rb|${len}|${sag}`, () => {
      const B = new Builder(), wd = M.woodWeathered, rope = M.rope, post = M.woodDark, r = rng(Math.round(len * 10) + 3);
      const L2 = len / 2, dy = (x: number) => -sag * 4 * ((x + L2) / len) * (1 - (x + L2) / len), zw = 0.42;
      const n = Math.round(len / 0.3);
      for (let i = 0; i < n; i++) {
        const x = -L2 + (i + 0.5) * (len / n);
        B.box(wd, 0.22, 0.05, 0.84 + (r() - 0.5) * 0.08, x, dy(x) - 0.03, (r() - 0.5) * 0.04, (r() - 0.5) * 0.08);
      }
      const rail = 0.95, rs = sag * 0.6;
      for (const s of [-1, 1]) {
        polyline(B, rope, 0.022, catenary(V(-L2, -0.06, s * zw), V(L2, -0.06, s * zw), sag, 12), 4);
        polyline(B, rope, 0.026, catenary(V(-L2, rail, s * (zw + 0.06)), V(L2, rail, s * (zw + 0.06)), rs, 12), 4);
        for (let i = 1; i < 8; i++) {
          const x = -L2 + (i / 8) * len, t = i / 8;
          B.rod(rope, 0.012, V(x, rail - rs * 4 * t * (1 - t), s * (zw + 0.06)), V(x, dy(x) - 0.05, s * zw), 3);
        }
        for (const e of [-1, 1]) {
          B.box(post, 0.14, rail + 0.4, 0.14, e * (L2 + 0.05), (rail + 0.4) / 2 - 0.3, s * (zw + 0.08));
          B.box(post, 0.18, 0.06, 0.18, e * (L2 + 0.05), rail + 0.12, s * (zw + 0.08));
        }
      }
      for (const e of [-1, 1]) shide(B, e * (L2 - 0.3), rail - 0.02, zw + 0.06, 0, 1.2);
      const nb = Math.max(3, Math.round(len / 1.2)), cols: Collider[] = [];
      for (let k = 0; k < nb; k++) {
        const xa = -L2 + (k / nb) * len, xb = -L2 + ((k + 1) / nb) * len, y = Math.min(dy(xa), dy(xb)) * 0.5 + Math.max(dy(xa), dy(xb)) * 0.5;
        cols.push({ kind: 'box', min: [xa, y - 0.2, -zw], max: [xb, y, zw], walk: true });
      }
      return finish(B, 'ropeBridge', cols, { w: len, h: rail + sag, d: 1 });
    });
    const r = rng(seed * 41 + 2), f = TAU / (3.2 + r() * 1.2), ph = r() * TAU;
    return moving(g, (t, _p, e) => { e.set(Math.sin(t * f + ph) * 0.045 + Math.sin(t * f * 2.3 + ph) * 0.012, 0, 0); });
  };

  // =====================================================================
  // toriiTop: torii con kasagi pisable y nuki para colgarse
  // =====================================================================
  const toriiTop = (o: any = {}) => {
    const w = Math.max(2, q(o.w ?? 3.2, 0.2)), H = Math.max(2.5, q(o.h ?? 4.2, 0.2)), text = o.text ?? '稲荷';
    return inst(`torii|${w}|${H}|${text}`, () => {
      const B = new Builder(), red = M.lacquerRed, blk = M.lacquerBlack, gold = M.metalGold;
      const Lk = w + 1.4, hn = q(H * 0.7, 0.05), yS = H - 0.27;
      for (const s of [-1, 1]) {
        const x = s * w / 2;
        B.cyl(red, 0.17, yS - 0.1, x, (yS - 0.1) / 2, 0, 12, 0.9);
        B.cyl(blk, 0.2, 0.45, x, 0.225, 0, 12); B.cyl(gold, 0.205, 0.04, x, 0.46, 0, 12);
        B.cyl(blk, 0.19, 0.1, x, yS - 0.13, 0, 12);
        B.box(blk, 0.1, 0.14, 0.18, x + s * 0.24, hn, 0); // kusabi
      }
      B.box(red, w + 0.8, 0.2, 0.15, 0, hn, 0);
      B.box(red, w + 1.0, 0.17, 0.26, 0, yS, 0);
      // kasagi negro curvado (sorimashi)
      const nseg = 10, sl = Lk / nseg, lift = (x: number) => 0.2 * Math.pow(Math.abs(x) / (Lk / 2), 2.2);
      for (let i = 0; i < nseg; i++) {
        const x = -Lk / 2 + (i + 0.5) * sl, rz = Math.atan((lift(x + 0.01) - lift(x - 0.01)) / 0.02);
        B.box(blk, sl * 1.03, 0.2, 0.38, x, H - 0.1 + lift(x), 0, 0, 0, rz);
        B.box(blk, sl * 1.03, 0.05, 0.44, x, H + 0.015 + lift(x), 0, 0, 0, rz);
      }
      // gakuzuka con placa
      const yp = (hn + 0.1 + yS - 0.085) / 2, ph = yS - 0.085 - hn - 0.1;
      B.box(blk, 0.5, ph, 0.12, 0, yp, 0);
      B.geo(K.print(plaqueTex(text)), planeUV(0.42, ph - 0.06, 1, 1), 0, yp, 0.062);
      return finish(B, 'toriiTop', [
        box([-w / 2 - 0.19, 0, -0.19], [-w / 2 + 0.19, yS - 0.1, 0.19], false),
        box([w / 2 - 0.19, 0, -0.19], [w / 2 + 0.19, yS - 0.1, 0.19], false),
        box([-Lk / 2, yS - 0.09, -0.2], [Lk / 2, H + 0.04, 0.2]),
        { kind: 'bar', a: [-(w / 2 + 0.4), hn, 0], b: [w / 2 + 0.4, hn, 0], r: 0.1 },
      ], { w: Lk, h: H, d: 0.45 });
    });
  };

  // =====================================================================
  // lanternString: cuerda de festival con chochin rojos y blancos (eje X, extremos a y=0)
  // =====================================================================
  const lanternString = (o: any = {}) => {
    const len = Math.max(2, q(o.len ?? 8, 0.5)), sag = q(o.sag ?? 0.8, 0.05), n = o.n ?? Math.max(2, Math.round(len / 1.2));
    return inst(`ls|${len}|${sag}|${n}`, () => {
      const B = new Builder(), rope = M.tint('rope', '#d8c49a'), blk = M.lacquerBlack, L2 = len / 2;
      const pts = catenary(V(-L2, 0, 0), V(L2, 0, 0), sag, 16);
      polyline(B, rope, 0.032, pts, 4);
      for (const e of [-1, 1]) { B.geo(blk, cached('pc_lsring', () => new THREE.TorusGeometry(0.07, 0.015, 5, 12)), e * (L2 + 0.04), 0.02, 0); }
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = -L2 + t * len, y = -sag * 4 * t * (1 - t);
        K.lantern(B, x, y - 0.02, 0, { text: i % 2 ? '祭' : '灯', color: i % 2 ? 'white' : 'red', s: 0.85, hi: false });
      }
      const cols: Collider[] = [], seg = 4;
      for (let k = 0; k < seg; k++) {
        const a = pts[(k * 16) / seg], b = pts[((k + 1) * 16) / seg];
        cols.push({ kind: 'bar', a: [a.x, a.y, 0], b: [b.x, b.y, 0], r: 0.04 });
      }
      return finish(B, 'lanternString', cols, { w: len, h: sag + 0.6, d: 0.4 });
    });
  };

  const make: Record<string, (o?: any) => PlayPiece> = {
    templeFlag, column, pole, umbrella, lanternFloat, kite, craneFloat, rockFloat, beam, ropeBridge, toriiTop, lanternString,
    ...extraPieces({ K, M, inst, finish, moving, seedOf, shide }),
  };
  return { make, update };
}
export type Pieces = ReturnType<typeof createPieces>;
