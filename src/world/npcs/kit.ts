// Herramientas comunes de los habitantes: atlas de canvas (estampados + caras), material único
// con color por vértice, y un acumulador de geometría (Part) que fusiona todo en 1 draw call por pieza móvil.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stylize, gradientMap, type Mats } from '../../render/materials';
import type { Shared } from '../../stage';

export type V3 = [number, number, number];
export type Cell = [number, number, number, number]; // u0, v0, u1, v1
export const D = Math.PI / 180;

export function rng(seed: number) {
  let a = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shade(hex: number, f: number) {
  const r = Math.min(255, ((hex >> 16) & 255) * f), g = Math.min(255, ((hex >> 8) & 255) * f), b = Math.min(255, (hex & 255) * f);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
const css = (hex: number) => '#' + hex.toString(16).padStart(6, '0');

// ───────────────────────── Atlas ─────────────────────────
const AW = 2048, AH = 1024;
const cellPx = (x: number, y: number, w: number, h: number, inset = 3): Cell =>
  [(x + inset) / AW, 1 - (y + h - inset) / AH, (x + w - inset) / AW, 1 - (y + inset) / AH];
export const PAT = {
  asanoha: cellPx(0, 0, 512, 512), seigaiha: cellPx(512, 0, 512, 512),
  stripes: cellPx(1024, 0, 512, 512), flowers: cellPx(1536, 0, 512, 512),
};
export const PATS: Cell[] = [PAT.asanoha, PAT.seigaiha, PAT.stripes, PAT.flowers];
/** celda pequeña i (0..15): 0 = blanco liso, 1..11 caras, 12 máscara de zorro, 13 koi, 14 uchiwa, 15 plumas */
export const small = (i: number): Cell => cellPx((i % 8) * 256, 512 + (i >> 3) * 256, 256, 256, 2);
const wc = small(0);
export const WHITE: Cell = [(wc[0] + wc[2]) / 2, (wc[1] + wc[3]) / 2, (wc[0] + wc[2]) / 2, (wc[1] + wc[3]) / 2];

export type FaceSpec = {
  skin: number;
  eye: 'open' | 'wide' | 'happy' | 'calm' | 'half' | 'dot' | 'narrow';
  iris?: string; lash?: boolean;
  brow?: { c: string; w: number; tilt: number; len?: number; dy?: number };
  mouth: 'smile' | 'grin' | 'open' | 'o' | 'flat' | 'lips' | 'shout' | 'cat';
  blush?: number; wrink?: number;
  extra?: (c: CanvasRenderingContext2D) => void;
};

function drawFace(c: CanvasRenderingContext2D, f: FaceSpec) {
  c.fillStyle = css(f.skin); c.fillRect(-4, -4, 264, 264);
  const dark = '#2b1b1a', ex = 50, ey = 120;
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (f.blush) for (const s of [-1, 1]) {
    const g = c.createRadialGradient(128 + s * 74, 156, 2, 128 + s * 74, 156, 30);
    g.addColorStop(0, `rgba(235,95,80,${f.blush})`); g.addColorStop(1, 'rgba(235,95,80,0)');
    c.fillStyle = g; c.fillRect(128 + s * 74 - 32, 124, 64, 64);
  }
  if (f.wrink) {
    c.strokeStyle = `rgba(110,60,40,${0.5 * f.wrink})`; c.lineWidth = 2.5;
    for (const y of [50, 62]) { c.beginPath(); c.moveTo(84, y + 3); c.quadraticCurveTo(128, y - 5, 172, y + 3); c.stroke(); }
    for (const s of [-1, 1]) {
      for (const a of [-0.35, 0, 0.35]) { c.beginPath(); c.moveTo(128 + s * 72, ey + a * 14); c.lineTo(128 + s * 86, ey + a * 34); c.stroke(); }
      c.beginPath(); c.moveTo(128 + s * 22, 156); c.quadraticCurveTo(128 + s * 36, 172, 128 + s * 34, 192); c.stroke();
      c.beginPath(); c.moveTo(128 + s * 34, ey + 20); c.quadraticCurveTo(128 + s * 50, ey + 27, 128 + s * 64, ey + 20); c.stroke();
    }
  }
  for (const s of [-1, 1]) {
    const x = 128 + s * ex;
    c.strokeStyle = dark; c.fillStyle = dark; c.lineWidth = 5;
    if (f.eye === 'open' || f.eye === 'wide') {
      const rx = f.eye === 'wide' ? 15 : 12.5, ry = f.eye === 'wide' ? 19 : 16;
      c.beginPath(); c.ellipse(x, ey, rx, ry, 0, 0, 7); c.fill();
      c.fillStyle = f.iris ?? '#6b3d22'; c.beginPath(); c.ellipse(x, ey + ry * 0.3, rx * 0.72, ry * 0.6, 0, 0, 7); c.fill();
      c.fillStyle = dark; c.beginPath(); c.ellipse(x, ey + 2, rx * 0.4, ry * 0.45, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 5, ey - ry * 0.42, rx * 0.34, 0, 7); c.fill();
      c.beginPath(); c.arc(x + 5, ey + ry * 0.45, rx * 0.16, 0, 7); c.fill();
      c.lineWidth = 5.5; c.beginPath(); c.moveTo(x - rx - 3, ey - ry * 0.55); c.quadraticCurveTo(x, ey - ry - 7, x + rx + 3, ey - ry * 0.55); c.stroke();
      if (f.lash) { c.lineWidth = 3.5; c.beginPath(); c.moveTo(x + s * (rx + 2), ey - ry * 0.6); c.lineTo(x + s * (rx + 10), ey - ry * 0.95); c.stroke(); }
    } else if (f.eye === 'happy') {
      c.beginPath(); c.arc(x, ey + 9, 15, Math.PI * 1.13, Math.PI * 1.87); c.stroke();
    } else if (f.eye === 'calm') {
      c.beginPath(); c.arc(x, ey - 9, 15, Math.PI * 0.14, Math.PI * 0.86); c.stroke();
      if (f.lash) { c.lineWidth = 3; c.beginPath(); c.moveTo(x + s * 13, ey + 1); c.lineTo(x + s * 20, ey + 5); c.stroke(); }
    } else if (f.eye === 'half') {
      c.beginPath(); c.ellipse(x, ey + 1, 13, 10, 0, 0, Math.PI); c.fill();
      c.fillStyle = f.iris ?? '#6b3d22'; c.beginPath(); c.ellipse(x, ey + 3, 7, 6, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 4, ey + 3, 2.4, 0, 7); c.fill();
      c.lineWidth = 5.5; c.beginPath(); c.moveTo(x - 16, ey + 1); c.quadraticCurveTo(x, ey - 5, x + 16, ey + 1); c.stroke();
      if (f.lash) { c.lineWidth = 3.5; c.beginPath(); c.moveTo(x + s * 15, ey); c.lineTo(x + s * 23, ey - 6); c.stroke(); }
    } else if (f.eye === 'dot') {
      c.beginPath(); c.arc(x, ey, 7.5, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 2.5, ey - 2.5, 2.2, 0, 7); c.fill();
    } else {
      c.save(); c.translate(x, ey); c.rotate(s * 0.14);
      c.beginPath(); c.ellipse(0, 2, 14, 8, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-4, 0, 2.6, 0, 7); c.fill();
      c.lineWidth = 5; c.beginPath(); c.moveTo(-17, -4); c.lineTo(17, -5); c.stroke();
      c.restore();
    }
  }
  if (f.brow) for (const s of [-1, 1]) {
    const b = f.brow, len = b.len ?? 17, y = 86 + (b.dy ?? 0), x = 128 + s * ex;
    c.strokeStyle = b.c; c.lineWidth = b.w;
    c.beginPath(); c.moveTo(x - s * len, y + b.tilt * len); c.quadraticCurveTo(x, y - 4 - Math.abs(b.tilt) * 2, x + s * len, y - b.tilt * len); c.stroke();
  }
  const my = 190;
  c.strokeStyle = '#7a2e22'; c.lineWidth = 4;
  if (f.mouth === 'smile') { c.beginPath(); c.arc(128, my - 14, 20, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); }
  else if (f.mouth === 'flat') { c.beginPath(); c.moveTo(116, my); c.quadraticCurveTo(128, my + 3, 140, my); c.stroke(); }
  else if (f.mouth === 'cat') { c.beginPath(); c.arc(120, my - 4, 8, 0.1, Math.PI * 0.95); c.stroke(); c.beginPath(); c.arc(136, my - 4, 8, 0.05, Math.PI * 0.9); c.stroke(); }
  else if (f.mouth === 'o') { c.fillStyle = '#7a2420'; c.beginPath(); c.ellipse(128, my, 7, 9, 0, 0, 7); c.fill(); }
  else if (f.mouth === 'lips') {
    c.fillStyle = '#c0322e'; c.beginPath(); c.moveTo(114, my); c.quadraticCurveTo(121, my - 8, 128, my - 4); c.quadraticCurveTo(135, my - 8, 142, my);
    c.quadraticCurveTo(128, my + 11, 114, my); c.fill();
  } else {
    const w = f.mouth === 'shout' ? 26 : f.mouth === 'grin' ? 27 : 19, h = f.mouth === 'shout' ? 26 : f.mouth === 'grin' ? 17 : 19;
    c.fillStyle = '#6a1c1c'; c.beginPath(); c.moveTo(128 - w, my - 8); c.quadraticCurveTo(128, my - 4, 128 + w, my - 8);
    c.quadraticCurveTo(128 + w * 0.8, my + h, 128, my + h); c.quadraticCurveTo(128 - w * 0.8, my + h, 128 - w, my - 8); c.fill();
    c.save(); c.clip();
    c.fillStyle = '#fff'; c.fillRect(128 - w, my - 10, w * 2, 8);
    c.fillStyle = '#e8705e'; c.beginPath(); c.ellipse(128, my + h, w * 0.6, h * 0.45, 0, 0, 7); c.fill();
    c.restore();
  }
  f.extra?.(c);
}

function drawPatterns(c: CanvasRenderingContext2D) {
  const S = 512;
  const tile = (i: number, fn: () => void) => { c.save(); c.translate(i * S, 0); c.beginPath(); c.rect(0, 0, S, S); c.clip(); fn(); c.restore(); };
  // asanoha (hoja de cáñamo): red triangular + radios al centro de cada triángulo
  tile(0, () => {
    c.fillStyle = '#b4b4b4'; c.fillRect(0, 0, S, S);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2.6; c.lineCap = 'round';
    const a = 64, rh = 51.2;
    const tri = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
      const cx = (x1 + x2 + x3) / 3, cy = (y1 + y2 + y3) / 3;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath();
      c.moveTo(x1, y1); c.lineTo(cx, cy); c.moveTo(x2, y2); c.lineTo(cx, cy); c.moveTo(x3, y3); c.lineTo(cx, cy); c.stroke();
    };
    for (let j = -1; j < 11; j++) for (let i = -1; i < 9; i++) {
      const x0 = i * a + (j & 1) * a / 2, y0 = j * rh;
      tri(x0, y0, x0 + a, y0, x0 + a / 2, y0 + rh); tri(x0 + a, y0, x0 + a * 1.5, y0 + rh, x0 + a / 2, y0 + rh);
    }
  });
  // seigaiha (olas): arcos concéntricos solapados
  tile(1, () => {
    c.fillStyle = '#bcbcbc'; c.fillRect(0, 0, S, S);
    const R = 32;
    for (let j = -2; j < 36; j++) for (let i = -1; i < 9; i++) {
      const x = i * 64 + (j & 1) * 32, y = j * 16 + 16;
      c.fillStyle = '#bcbcbc'; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 3;
      for (const k of [0.94, 0.66, 0.38]) { c.beginPath(); c.arc(x, y, R * k, Math.PI, Math.PI * 2); c.stroke(); }
    }
  });
  // rayas verticales (shima)
  tile(2, () => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 16; i++) {
      const x = i * 32;
      c.fillStyle = '#9a9a9a'; c.fillRect(x, 0, 11, S);
      c.fillStyle = '#c8c8c8'; c.fillRect(x + 17, 0, 3, S); c.fillRect(x + 24, 0, 3, S);
    }
  });
  // flores (ume/sakura) sobre claro
  tile(3, () => {
    c.fillStyle = '#fbf6ee'; c.fillRect(0, 0, S, S);
    const r = rng(7), cols = ['#e2506a', '#f08aa0', '#c9364e', '#f4b23c', '#5a78c8'];
    for (let k = 0; k < 30; k++) {
      const x = r() * S, y = r() * S, rad = 15 + r() * 17, col = cols[(r() * cols.length) | 0], rot = r() * 6;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        c.save(); c.translate(x + ox, y + oy); c.rotate(rot);
        c.fillStyle = col;
        for (let p = 0; p < 5; p++) { c.rotate(Math.PI * 0.4); c.beginPath(); c.ellipse(0, -rad * 0.55, rad * 0.4, rad * 0.5, 0, 0, 7); c.fill(); }
        c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(0, 0, rad * 0.24, 0, 7); c.fill();
        c.restore();
      }
    }
    for (let k = 0; k < 40; k++) { c.fillStyle = '#7fae6a'; c.beginPath(); c.ellipse(r() * S, r() * S, 7, 3.4, r() * 6, 0, 7); c.fill(); }
  });
}

const SKIN = { fair: 0xf2c9a8, warm: 0xe9b890, tan: 0xd9a078, child: 0xf6cfb0 };
export const FACES: FaceSpec[] = [
  /* 0 (blanco) */ { skin: 0xffffff, eye: 'dot', mouth: 'flat' },
  /* 1 anciano */ {
    skin: SKIN.tan, eye: 'happy', mouth: 'smile', wrink: 1, blush: 0.25, brow: { c: '#f4f1ea', w: 9, tilt: -0.28, len: 21, dy: 4 },
    extra: (c) => { c.strokeStyle = '#f4f1ea'; c.lineWidth = 8; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(128 + s * 3, 172); c.quadraticCurveTo(128 + s * 20, 168, 128 + s * 34, 186); c.stroke(); } },
  },
  /* 2 anciana */ { skin: SKIN.warm, eye: 'calm', mouth: 'smile', wrink: 0.8, blush: 0.5, brow: { c: '#9a948e', w: 4, tilt: -0.12, len: 15 } },
  /* 3 niño */ {
    skin: SKIN.child, eye: 'wide', iris: '#4a3018', mouth: 'grin', blush: 0.55, brow: { c: '#2b1b1a', w: 7, tilt: 0.1, len: 13, dy: -8 },
    extra: (c) => { c.fillStyle = 'rgba(150,80,50,0.6)'; for (const [x, y] of [[62, 150], [72, 157], [56, 160], [194, 150], [184, 157], [200, 160]]) { c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill(); } },
  },
  /* 4 niña */ { skin: SKIN.child, eye: 'wide', iris: '#7a4a2a', lash: true, mouth: 'cat', blush: 0.75, brow: { c: '#3a2420', w: 4, tilt: -0.05, len: 12, dy: -8 } },
  /* 5 cocinero */ {
    skin: SKIN.warm, eye: 'narrow', mouth: 'grin', brow: { c: '#221615', w: 10, tilt: 0.3, len: 19, dy: 6 }, blush: 0.2,
    extra: (c) => { c.fillStyle = 'rgba(60,40,36,0.45)'; const r = rng(3); for (let i = 0; i < 70; i++) { const a = Math.PI * (0.1 + 0.8 * r()), d = 34 + r() * 22; c.beginPath(); c.arc(128 + Math.cos(a) * d * 1.2, 180 + Math.sin(a) * d * 0.75, 1.5, 0, 7); c.fill(); } },
  },
  /* 6 dama */ {
    skin: SKIN.fair, eye: 'half', iris: '#5a3020', lash: true, mouth: 'lips', blush: 0.3, brow: { c: '#3a2622', w: 3.5, tilt: -0.1, len: 16, dy: -6 },
    extra: (c) => { c.fillStyle = '#3a2622'; c.beginPath(); c.arc(168, 176, 2.6, 0, 7); c.fill(); },
  },
  /* 7 monje */ { skin: SKIN.warm, eye: 'calm', mouth: 'flat', blush: 0.15, brow: { c: '#3a2a26', w: 5, tilt: -0.18, len: 16 } },
  /* 8 pescadero */ {
    skin: SKIN.tan, eye: 'open', iris: '#3a2416', mouth: 'shout', blush: 0.5, brow: { c: '#1c1412', w: 11, tilt: -0.12, len: 19, dy: -4 },
    extra: (c) => { c.strokeStyle = '#1c1412'; c.lineWidth = 8; c.beginPath(); c.moveTo(100, 176); c.quadraticCurveTo(128, 164, 156, 176); c.stroke(); },
  },
  /* 9 repartidor */ { skin: SKIN.fair, eye: 'dot', mouth: 'o', blush: 0.35, brow: { c: '#2b1b1a', w: 5, tilt: -0.2, len: 12, dy: -6 } },
  /* 10 señor del té */ {
    skin: SKIN.warm, eye: 'happy', mouth: 'smile', wrink: 0.35, brow: { c: '#3b3230', w: 6, tilt: -0.1, len: 15, dy: -6 },
    extra: (c) => { c.strokeStyle = '#2a2422'; c.lineWidth = 3.5; for (const s of [-1, 1]) { c.beginPath(); c.arc(128 + s * 50, 121, 25, 0, 7); c.stroke(); } c.beginPath(); c.moveTo(103, 118); c.quadraticCurveTo(128, 110, 153, 118); c.stroke(); },
  },
  /* 11 señora del té */ { skin: SKIN.fair, eye: 'open', iris: '#6b3d22', lash: true, mouth: 'smile', blush: 0.5, brow: { c: '#3a2622', w: 4, tilt: -0.14, len: 14, dy: -4 } },
];

function drawSmall(c: CanvasRenderingContext2D) {
  const at = (i: number, fn: () => void) => {
    c.save(); c.translate((i % 8) * 256, 512 + (i >> 3) * 256); c.beginPath(); c.rect(0, 0, 256, 256); c.clip(); fn(); c.restore();
  };
  FACES.forEach((f, i) => at(i, () => drawFace(c, f)));
  // 12: máscara de zorro (kitsune)
  at(12, () => {
    c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, 256, 256);
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.strokeStyle = '#1a1414'; c.lineWidth = 7; c.beginPath(); c.moveTo(128 + s * 26, 112); c.quadraticCurveTo(128 + s * 52, 86, 128 + s * 84, 84); c.stroke();
      c.strokeStyle = '#d8a030'; c.lineWidth = 3; c.beginPath(); c.moveTo(128 + s * 34, 108); c.quadraticCurveTo(128 + s * 54, 93, 128 + s * 74, 90); c.stroke();
      c.strokeStyle = '#c8281e'; c.lineWidth = 6;
      for (const k of [0, 1, 2]) { c.beginPath(); c.moveTo(128 + s * 60, 150 + k * 16); c.lineTo(128 + s * 104, 138 + k * 20); c.stroke(); }
      c.beginPath(); c.moveTo(128 + s * 30, 40); c.quadraticCurveTo(128 + s * 44, 18, 128 + s * 66, 30); c.stroke();
    }
    c.fillStyle = '#c8281e'; c.beginPath(); c.arc(128, 52, 11, 0, 7); c.fill();
    c.fillStyle = '#1a1414'; c.beginPath(); c.ellipse(128, 176, 11, 8, 0, 0, 7); c.fill();
    c.strokeStyle = '#1a1414'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(128, 184); c.lineTo(128, 200); c.moveTo(96, 204); c.quadraticCurveTo(128, 224, 160, 204); c.stroke();
  });
  // 13: manchas de koi
  at(13, () => {
    c.fillStyle = '#fbf8f2'; c.fillRect(0, 0, 256, 256);
    const r = rng(11);
    for (let k = 0; k < 9; k++) { c.fillStyle = k % 4 === 3 ? '#26222a' : '#ee5a1e'; c.beginPath(); c.ellipse(r() * 256, r() * 256, 22 + r() * 34, 16 + r() * 22, r() * 3, 0, 7); c.fill(); }
  });
  // 14: uchiwa con campanilla (asagao)
  at(14, () => {
    c.fillStyle = '#f6efdf'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(160,130,90,0.5)'; c.lineWidth = 1.5;
    for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(128, 256); c.lineTo(128 + i * 22, 0); c.stroke(); }
    for (const [x, y, rad, col] of [[96, 110, 44, '#4a5fc0'], [168, 150, 34, '#b0509a'], [150, 70, 24, '#4a5fc0']] as [number, number, number, string][]) {
      c.fillStyle = col; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
      c.fillStyle = '#fbf8f2'; c.beginPath(); for (let p = 0; p < 5; p++) { const a = p * Math.PI * 0.4; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); c.lineTo(x + Math.cos(a + 0.16) * rad, y + Math.sin(a + 0.16) * rad); } c.fill();
      c.fillStyle = '#f8e080'; c.beginPath(); c.arc(x, y, rad * 0.2, 0, 7); c.fill();
    }
    c.fillStyle = '#5c9a50'; for (const [x, y] of [[60, 180], [200, 96], [120, 196]]) { c.beginPath(); c.ellipse(x, y, 20, 12, 0.6, 0, 7); c.fill(); }
  });
  // 15: plumaje rayado (gorriones, gato atigrado)
  at(15, () => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#8a8a8a'; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(i * 32 + (j & 1) * 16 + 8, j * 32 + 16, 9, 12, 0, 0, 7); c.fill(); }
  });
}

let _atlas: THREE.CanvasTexture | null = null;
function atlas() {
  if (_atlas) return _atlas;
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff'; c.fillRect(0, 0, AW, AH);
  drawPatterns(c); drawSmall(c);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _atlas = t; return t;
}

export function npcMaterial(U: Shared, mats: Mats) {
  const grad = (mats.fabric as any).gradientMap ?? (mats.skin as any).gradientMap ?? gradientMap();
  return stylize(new THREE.MeshToonMaterial({ map: atlas(), vertexColors: true, gradientMap: grad, side: THREE.DoubleSide }), U, 0.35);
}

// ───────────────────────── Geometría ─────────────────────────
export type AddOpts = { p?: V3; r?: V3; s?: V3 | number; cell?: Cell; sub?: Cell; swap?: boolean; warp?: (v: THREE.Vector3) => void };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
const _col = new THREE.Color();
const FULL: Cell = [0, 0, 1, 1];

export function xf(p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 | number = 1) {
  _p.set(p[0], p[1], p[2]); _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Hace coincidir el orden de los vértices con las normales guardadas (necesario con DoubleSide).
function fixWinding(g: THREE.BufferGeometry) {
  const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute;
  const names = Object.keys(g.attributes);
  for (let i = 0; i < pos.count; i += 3) {
    _a.fromBufferAttribute(pos, i); _b.fromBufferAttribute(pos, i + 1); _c.fromBufferAttribute(pos, i + 2);
    _b.sub(_a); _c.sub(_a); _b.cross(_c);
    _n.fromBufferAttribute(nor, i); _a.fromBufferAttribute(nor, i + 1); _n.add(_a); _a.fromBufferAttribute(nor, i + 2); _n.add(_a);
    if (_b.dot(_n) < 0) for (const k of names) {
      const at = g.attributes[k] as THREE.BufferAttribute, arr = at.array as Float32Array, sz = at.itemSize;
      for (let j = 0; j < sz; j++) { const t = arr[(i + 1) * sz + j]; arr[(i + 1) * sz + j] = arr[(i + 2) * sz + j]; arr[(i + 2) * sz + j] = t; }
    }
  }
}

export class Part {
  list: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: number, o: AddOpts = {}) {
    const geo = g.index ? g.toNonIndexed() : g;
    const pos = geo.attributes.position as THREE.BufferAttribute, n = pos.count;
    if (o.warp) { for (let i = 0; i < n; i++) { _a.fromBufferAttribute(pos, i); o.warp(_a); pos.setXYZ(i, _a.x, _a.y, _a.z); } }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    let uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
    if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(n * 2), 2); geo.setAttribute('uv', uv); }
    const cell = o.cell ?? WHITE, sub = o.sub ?? FULL;
    if (cell === WHITE) { for (let i = 0; i < n; i++) uv.setXY(i, WHITE[0], WHITE[1]); }
    else {
      let u0 = 0, u1 = 1, v0 = 0, v1 = 1, lo = 1e9, hi = -1e9, lo2 = 1e9, hi2 = -1e9;
      for (let i = 0; i < n; i++) { const x = uv.getX(i), y = uv.getY(i); lo = Math.min(lo, x); hi = Math.max(hi, x); lo2 = Math.min(lo2, y); hi2 = Math.max(hi2, y); }
      if (lo < -1e-4 || hi > 1.0001 || lo2 < -1e-4 || hi2 > 1.0001) { u0 = lo; u1 = hi; v0 = lo2; v1 = hi2; }
      for (let i = 0; i < n; i++) {
        let x = (uv.getX(i) - u0) / (u1 - u0 || 1), y = (uv.getY(i) - v0) / (v1 - v0 || 1);
        if (o.swap) { const t = x; x = y; y = t; }
        x = sub[0] + x * (sub[2] - sub[0]); y = sub[1] + y * (sub[3] - sub[1]);
        uv.setXY(i, cell[0] + x * (cell[2] - cell[0]), cell[1] + y * (cell[3] - cell[1]));
      }
    }
    _col.setHex(color);
    const ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { ca[i * 3] = _col.r; ca[i * 3 + 1] = _col.g; ca[i * 3 + 2] = _col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') geo.deleteAttribute(k);
    geo.clearGroups();
    if (o.p || o.r || o.s !== undefined) geo.applyMatrix4(xf(o.p, o.r, o.s ?? 1));
    fixWinding(geo);
    this.list.push(geo);
    return this;
  }
  /** incorpora otra pieza ya construida con una transformación */
  merge(other: Part, p?: V3, r?: V3, s?: V3 | number) {
    const m = xf(p, r, s ?? 1);
    for (const g of other.list) { g.applyMatrix4(m); fixWinding(g); this.list.push(g); }
    return this;
  }
  /** curva la pieza hacia delante por encima de y0 (k rad/m): espaldas encorvadas */
  bend(y0: number, k: number) {
    for (const g of this.list) {
      const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i); if (y <= y0) continue;
        const a = k * (y - y0), z = pos.getZ(i), ca = Math.cos(a), sa = Math.sin(a);
        pos.setY(i, y0 + sa / k - z * sa); pos.setZ(i, (1 - ca) / k + z * ca);
        const ny = nor.getY(i), nz = nor.getZ(i);
        nor.setY(i, ny * ca - nz * sa); nor.setZ(i, ny * sa + nz * ca);
      }
    }
    return this;
  }
  tris() { let t = 0; for (const g of this.list) t += g.attributes.position.count / 3; return t; }
  /** geometría fusionada (para cachear y compartir entre instancias) */
  geo() {
    const g = mergeGeometries(this.list, false);
    for (const x of this.list) x.dispose();
    this.list = [];
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat: THREE.Material, name = '') {
    const m = new THREE.Mesh(mergeGeometries(this.list, false), mat);
    m.name = name; m.castShadow = true; m.receiveShadow = false;
    for (const g of this.list) g.dispose();
    return m;
  }
}
/** dónde acaba un punto tras Part.bend */
export function bendPt(p: V3, y0: number, k: number): V3 {
  if (p[1] <= y0) return p;
  const a = k * (p[1] - y0), ca = Math.cos(a), sa = Math.sin(a);
  return [p[0], y0 + sa / k - p[2] * sa, (1 - ca) / k + p[2] * ca];
}

export const lathe = (pts: number[][], seg = 12, phi0 = 0, len = Math.PI * 2) =>
  new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(Math.max(p[0], 0.0005), p[1])), seg, phi0, len);
export const ball = (r: number, ws = 10, hs = 7) => new THREE.SphereGeometry(r, ws, hs);
export const cyl = (rt: number, rb: number, h: number, seg = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

/** perfil de revolución → radio a una altura */
export function prof(pts: number[][]) {
  return (y: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if ((y >= a[1] && y <= b[1]) || (y <= a[1] && y >= b[1])) { const t = (y - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * t; }
    }
    return y < pts[0][1] ? pts[0][0] : pts[pts.length - 1][0];
  };
}

/** tubo de radio variable a lo largo de una curva; `up`+`fn` lo aplanan como cinta */
export function sweep(pts: number[][], radii: number[], seg = 7, o: { rings?: number; cap?: boolean; fn?: number; up?: V3 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const n = o.rings ?? (pts.length === 2 ? Math.max(1, radii.length - 1) : (pts.length - 1) * 4);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3();
  const fn = o.fn ?? 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n; curve.getPoint(t, P); curve.getTangent(t, T);
    if (o.up) up.set(o.up[0], o.up[1], o.up[2]);
    else if (i === 0) { const ax = Math.abs(T.x), ay = Math.abs(T.y), az = Math.abs(T.z); up.set(ax <= ay && ax <= az ? 1 : 0, ay < ax && ay <= az ? 1 : 0, az < ax && az < ay ? 1 : 0); }
    else up.copy(N);
    N.copy(up).addScaledVector(T, -up.dot(T));
    if (N.lengthSq() < 1e-8) N.set(1, 0, 0).addScaledVector(T, -T.x);
    N.normalize(); B.crossVectors(T, N);
    const f = t * (radii.length - 1), k = Math.min(radii.length - 2, Math.floor(f));
    const r = radii.length === 1 ? radii[0] : radii[k] + (radii[k + 1] - radii[k]) * (f - k);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2, c = Math.cos(a) * r * fn, s = Math.sin(a) * r;
      pos.push(P.x + N.x * c + B.x * s, P.y + N.y * c + B.y * s, P.z + N.z * c + B.z * s); uv.push(j / seg, t);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
    idx.push(a, b, c, b, d, c);
  }
  if (o.cap !== false) {
    const c0 = pos.length / 3; curve.getPoint(0, P); pos.push(P.x, P.y, P.z); uv.push(0.5, 0);
    const c1 = c0 + 1; curve.getPoint(1, P); pos.push(P.x, P.y, P.z); uv.push(0.5, 1);
    for (let j = 0; j < seg; j++) { const j2 = (j + 1) % seg; idx.push(c0, j2, j, c1, n * seg + j, n * seg + j2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** lámina plana a partir de un contorno 2D (x,y); con `depth` es un cojín extruido con bisel */
export function plate(outline: number[][], depth = 0, bevel = 0) {
  const sh = new THREE.Shape(outline.map((p) => new THREE.Vector2(p[0], p[1])));
  if (!depth) return new THREE.ShapeGeometry(sh);
  return new THREE.ExtrudeGeometry(sh, { depth, steps: 1, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
}

/** triángulos sueltos con normales planas */
export function tris(v: number[][]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  g.computeVertexNormals();
  return g;
}

export type Ctx = { U: Shared; mats: Mats; mat: THREE.Material };
export const group = (name: string, ...kids: THREE.Object3D[]) => { const g = new THREE.Group(); g.name = name; for (const k of kids) g.add(k); return g; };
export const at = <T extends THREE.Object3D>(o: T, p: V3, r?: V3): T => { o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); return o; };
