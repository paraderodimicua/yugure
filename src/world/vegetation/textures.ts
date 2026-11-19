// Texturas de follaje pintadas en canvas (atlas 2x2 de 256 px por celda). Alfa recortado con alphaTest.
import * as THREE from 'three';
import { rng, rr, type Rnd } from './common';

type G = CanvasRenderingContext2D;
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

function canvas(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
function toTex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** atlas 2x2: draw(g, celda, rnd) dibuja en un cuadro 256x256 con origen en la celda */
function atlas(seed: number, draw: (g: G, cell: number, r: Rnd) => void) {
  const [c, g] = canvas(512, 512);
  for (let k = 0; k < 4; k++) {
    g.save();
    // celda k → uv (k%2, floor(k/2)) · el canvas se invierte en Y al subir (flipY)
    g.translate((k % 2) * 256, (1 - Math.floor(k / 2)) * 256);
    g.beginPath(); g.rect(0, 0, 256, 256); g.clip();
    draw(g, k, rng(seed * 17 + k));
    g.restore();
  }
  return toTex(c);
}

/** hoja lanceolada / ovada con base en (0,0) a lo largo de +X */
function leaf(g: G, x: number, y: number, ang: number, len: number, wid: number, fill: string | CanvasGradient, rib?: string, belly = 0.38) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(len * belly, -wid, len * 0.8, -wid * 0.6, len, 0);
  g.bezierCurveTo(len * 0.8, wid * 0.6, len * belly, wid, 0, 0);
  g.fillStyle = fill; g.fill();
  if (rib) { g.strokeStyle = rib; g.lineWidth = Math.max(1, wid * 0.09); g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.92, 0); g.stroke(); }
  g.restore();
}
function twig(g: G, pts: number[], w: number, col: string) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
/** flor de cinco pétalos */
function blossom(g: G, x: number, y: number, r: number, rot: number, petal: string, center: string, n = 5) {
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = petal;
  for (let i = 0; i < n; i++) {
    g.rotate((Math.PI * 2) / n);
    g.beginPath(); g.ellipse(r * 0.55, 0, r * 0.55, r * 0.36, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = center; g.beginPath(); g.arc(0, 0, r * 0.22, 0, Math.PI * 2); g.fill();
  g.restore();
}
/** punto aleatorio dentro de una mancha lobulada */
function inBlob(r: Rnd, cx: number, cy: number, R: number, lobes: number, ph: number, sy = 1) {
  const a = r() * Math.PI * 2, rad = R * Math.sqrt(r()) * (0.78 + 0.22 * Math.sin(a * lobes + ph));
  return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * sy];
}

// ---------------------------------------------------------------------------------------------- bambú
export function texBambooLeaves() {
  return atlas(3, (g, _k, r) => {
    const x0 = 128 + rr(r, -10, 10);
    const tw = [x0, 4, x0 + rr(r, -25, 25), 70, x0 + rr(r, -40, 40), 140];
    twig(g, tw, 2.2, hsl(70, 30, 30));
    const n = 7 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const t = 0.25 + (i / n) * 0.75, j = Math.min(2, Math.floor(t * 2));
      const bx = tw[j * 2] + (tw[j * 2 + 2] - tw[j * 2]) * (t * 2 - j), by = tw[j * 2 + 1] + (tw[j * 2 + 3] - tw[j * 2 + 1]) * (t * 2 - j);
      const ang = Math.PI / 2 + rr(r, -1.2, 1.2), len = rr(r, 75, 112), l = rr(r, 26, 44);
      leaf(g, bx, by, ang, len, rr(r, 8, 12), hsl(rr(r, 82, 112), rr(r, 38, 55), l), hsl(80, 40, l + 10), 0.3);
    }
  });
}
export function texCane() {
  const [c, g] = canvas(64, 256);
  const r = rng(5);
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, hsl(88, 34, 30)); grd.addColorStop(0.45, hsl(84, 40, 46)); grd.addColorStop(1, hsl(90, 34, 32));
  g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) { g.fillStyle = hsl(rr(r, 70, 100), 30, rr(r, 28, 52), 0.25); g.fillRect(r() * 64, 0, rr(r, 1, 3), 256); }
  // nudo arriba y abajo + anillo blanquecino bajo el nudo
  g.fillStyle = hsl(60, 25, 24); g.fillRect(0, 0, 64, 5); g.fillRect(0, 251, 64, 5);
  g.fillStyle = hsl(70, 30, 58); g.fillRect(0, 7, 64, 3);
  g.fillStyle = hsl(80, 15, 72, 0.6); g.fillRect(0, 10, 64, 9);
  const t = toTex(c); t.wrapS = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------------------------------------- sakura
export function texSakura() {
  return atlas(7, (g, k, r) => {
    const cx = 128, cy = 128, ph = r() * 6;
    twig(g, [cx - 90, cy + 70, cx - 20, cy + 15, cx + 60, cy - 40], 5, hsl(350, 18, 22));
    twig(g, [cx - 20, cy + 15, cx + 10, cy + 80], 3, hsl(350, 18, 22));
    for (let pass = 0; pass < 3; pass++) {
      const n = [26, 40, 34][pass];
      for (let i = 0; i < n; i++) {
        const [x, y] = inBlob(r, cx, cy, 104 - pass * 10, 3 + (k % 2), ph);
        const L = [74, 84, 92][pass] + rr(r, -4, 3), S = rr(r, 55, 80) + (k === 3 ? -20 : 0);
        blossom(g, x, y, rr(r, 10, 15), r() * 6, hsl(rr(r, 335, 352), S, L), hsl(345, 70, 55));
      }
      if (pass === 0) for (let i = 0; i < 6; i++) { const [x, y] = inBlob(r, cx, cy, 90, 3, ph); leaf(g, x, y, r() * 6, 26, 9, hsl(rr(r, 60, 90), 40, 38)); }
    }
  });
}

// ---------------------------------------------------------------------------------------------- hoja ancha (jungla)
export function texBroad() {
  return atlas(11, (g, k, r) => {
    const cx = 128, cy = 128, n = 11 + Math.floor(r() * 5);
    const hue = k === 3 ? 75 : 105;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr(r, -0.25, 0.25), l = rr(r, 20, 38);
      const len = rr(r, 70, 108), d = rr(r, 6, 18);
      leaf(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, a, len, rr(r, 20, 30), hsl(hue + rr(r, -15, 18), rr(r, 35, 55), l), hsl(hue - 20, 40, l + 14), 0.45);
    }
    for (let i = 0; i < 5; i++) { const a = r() * 6; leaf(g, cx, cy, a, rr(r, 55, 80), 18, hsl(hue, 45, rr(r, 34, 44)), hsl(hue - 20, 40, 52), 0.45); }
  });
}

// ---------------------------------------------------------------------------------------------- arce momiji
function palmate(g: G, x: number, y: number, R: number, rot: number, col: string, vein: string) {
  g.save(); g.translate(x, y); g.rotate(rot);
  const lobes = 7;
  for (let i = 0; i < lobes; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.48, len = R * (1 - Math.abs(i - 3) * 0.17);
    leaf(g, 0, 0, a, len, len * 0.3, col, vein, 0.45);
  }
  g.strokeStyle = vein; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, R * 0.5); g.stroke();
  g.restore();
}
export function texMaple() {
  return atlas(13, (g, k, r) => {
    const base = [[4, 82, 42], [354, 74, 34], [18, 86, 48], [36, 80, 50]][k];
    for (let i = 0; i < 16; i++) {
      const [x, y] = inBlob(r, 128, 128, 86, 4, k);
      const l = base[2] + rr(r, -8, 8);
      palmate(g, x, y, rr(r, 30, 44), rr(r, -0.8, 0.8) + Math.PI * (r() < 0.2 ? 1 : 0), hsl(base[0] + rr(r, -6, 6), base[1], l), hsl(base[0], base[1] - 20, l - 12));
    }
  });
}

// ---------------------------------------------------------------------------------------------- pino (almohadilla de agujas)
export function texPine() {
  return atlas(17, (g, k, r) => {
    g.lineCap = 'round';
    for (let t = 0; t < 46; t++) {
      const [cx, cy] = inBlob(r, 128, 132, 104, 5, k, 0.62);
      const top = 1 - (cy - 60) / 140, l = 16 + top * 22 + rr(r, -4, 4);
      for (let i = 0; i < 22; i++) {
        const a = rr(r, -Math.PI, 0.2), len = rr(r, 14, 26);
        g.strokeStyle = hsl(rr(r, 118, 150), rr(r, 25, 40), l + rr(r, -5, 5)); g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.8); g.stroke();
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------- helechos y matas
export function texFern() {
  return atlas(19, (g, k, r) => {
    if (k < 2) {
      const curve = rr(r, -14, 14);
      twig(g, [128, 256, 128 + curve * 0.5, 128, 128 + curve, 4], 3, hsl(90, 40, 28));
      for (let y = 246; y > 10; y -= 9) {
        const t = 1 - y / 256, len = 112 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.75) + 6;
        const x = 128 + curve * t, l = rr(r, 28, 40) + k * 4;
        for (const s of [-1, 1]) {
          const a = s < 0 ? Math.PI + 0.35 : -0.35;
          leaf(g, x, y, a, len, 6 + len * 0.05, hsl(rr(r, 92, 112), 45, l), hsl(85, 40, l + 10), 0.5);
        }
      }
    } else if (k === 2) {
      for (let i = 0; i < 30; i++) {
        const bx = 128 + rr(r, -30, 30), a = rr(r, -1.2, 1.2), h = rr(r, 150, 245), l = rr(r, 26, 46);
        g.fillStyle = hsl(rr(r, 70, 105), 42, l); g.beginPath();
        g.moveTo(bx - 4, 256); g.quadraticCurveTo(bx + Math.sin(a) * h * 0.4, 256 - h * 0.6, bx + Math.sin(a) * h * 0.75, 256 - h);
        g.quadraticCurveTo(bx + Math.sin(a) * h * 0.4 + 3, 256 - h * 0.6, bx + 4, 256); g.fill();
      }
    } else {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + rr(r, -1.1, 1.1), l = rr(r, 24, 40);
        leaf(g, 128, 250, a, rr(r, 150, 220), rr(r, 30, 44), hsl(rr(r, 90, 120), 40, l), hsl(80, 30, l + 15), 0.5);
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------- arbustos en flor
export function texBush() {
  return atlas(23, (g, k, r) => {
    const leafy = (n: number) => {
      for (let i = 0; i < n; i++) {
        const [x, y] = inBlob(r, 128, 128, 100, 4, 1);
        const l = rr(r, 20, 36);
        leaf(g, x, y, r() * 6.3, rr(r, 34, 56), rr(r, 11, 17), hsl(rr(r, 100, 130), 40, l), hsl(100, 30, l + 12));
      }
    };
    if (k === 0) leafy(70);
    else if (k === 1 || k === 2) {
      leafy(18);
      const [h0, h1, s] = k === 1 ? [215, 265, 55] : [295, 335, 50];
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 160; i++) {
        const [x, y] = inBlob(r, 128, 124, 92, 5, k);
        blossom(g, x, y, rr(r, 9, 13), r() * 6, hsl(rr(r, h0, h1), s, (pass ? 74 : 60) + rr(r, -6, 6)), hsl(h0, 40, 85), 4);
      }
    } else {
      leafy(40);
      for (let i = 0; i < 22; i++) {
        const [x, y] = inBlob(r, 128, 128, 92, 4, 2);
        blossom(g, x, y, rr(r, 17, 24), r() * 6, hsl(rr(r, 318, 340), 75, rr(r, 58, 70)), hsl(330, 60, 40));
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------- hiedra y hojas de liana
export function texIvy() {
  return atlas(29, (g, k, r) => {
    const n = k === 3 ? 7 : 11;
    for (let i = 0; i < n; i++) {
      const [x, y] = inBlob(r, 128, 128, 90, 3, k);
      const R = k === 3 ? rr(r, 40, 56) : rr(r, 30, 44), rot = r() * 6.3, l = rr(r, 16, 32) + (k === 3 ? 8 : 0);
      const col = hsl(rr(r, 105, 140), rr(r, 30, 45), l), vein = hsl(90, 25, l + 18);
      g.save(); g.translate(x, y); g.rotate(rot);
      if (k === 3) leaf(g, 0, 0, 0, R, R * 0.55, col, vein, 0.3);
      else for (const a of [-0.9, 0, 0.9]) leaf(g, 0, 0, a, R * (a ? 0.75 : 1), R * 0.36, col, vein, 0.4);
      g.restore();
    }
  });
}

// ---------------------------------------------------------------------------------------------- musgo
export function texMoss() {
  return atlas(31, (g, k, r) => {
    if (k < 3) {
      for (let i = 0; i < 900; i++) {
        const [x, y] = inBlob(r, 128, 128, 112, 5 + k, k * 2);
        const d = Math.hypot(x - 128, y - 128) / 112;
        g.fillStyle = hsl(rr(r, 65, 100), rr(r, 35, 55), rr(r, 22, 42) + (1 - d) * 8);
        g.beginPath(); g.arc(x, y, rr(r, 3, 7) * (1.2 - d * 0.5), 0, Math.PI * 2); g.fill();
      }
    } else {
      for (let i = 0; i < 70; i++) {
        const x = rr(r, 20, 236), h = rr(r, 30, 120);
        g.strokeStyle = hsl(rr(r, 55, 95), 45, rr(r, 30, 50)); g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x + rr(r, -8, 8), 256 - h * 0.6, x + rr(r, -14, 14), 256 - h); g.stroke();
        if (r() < 0.3) { g.fillStyle = hsl(30, 50, 45); g.beginPath(); g.arc(x, 256 - h, 2.5, 0, 7); g.fill(); }
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------- siluetas lejanas
export function texCanopy() {
  return atlas(37, (g, k, r) => {
    const grad = (y0: number, y1: number) => {
      const gr = g.createLinearGradient(0, y1, 0, y0);
      gr.addColorStop(0, hsl(205, 30, 11)); gr.addColorStop(0.55, hsl(165, 24, 16)); gr.addColorStop(1, hsl(110, 26, 25));
      return gr;
    };
    const colY = (y: number) => { const t = Math.max(0, Math.min(1, 1 - y / 240)); return t > 0.85 && r() < 0.12 ? hsl(45, 40, 32) : hsl(205 - t * 95, 30 - t * 4, 11 + t * 14); };
    if (k === 0 || k === 2) {
      twig(g, [128, 256, 126, 170], 9, hsl(20, 20, 16));
      const lumps: [number, number, number][] = [];
      for (let i = 0; i < 26; i++) {
        const a = rr(r, Math.PI * 1.05, Math.PI * 1.95), d = rr(r, 0, 1);
        const R = k === 2 ? 70 : 92;
        lumps.push([128 + Math.cos(a) * d * R * (k === 2 ? 0.7 : 1.05), 150 + Math.sin(a) * d * R * 1.2, rr(r, 18, 34)]);
      }
      g.fillStyle = grad(10, 220);
      for (const [x, y, rad] of lumps) { g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
      for (let i = 0; i < 260; i++) {
        const [x, y, rad] = lumps[i % lumps.length], a = r() * 6.3;
        leaf(g, x + Math.cos(a) * rad * 0.8, y + Math.sin(a) * rad * 0.8, a, rr(r, 8, 14), 4, colY(y + Math.sin(a) * rad));
      }
    } else if (k === 1) {
      twig(g, [128, 256, 128, 20], 6, hsl(20, 20, 14));
      g.fillStyle = grad(10, 250);
      for (let i = 0; i < 9; i++) {
        const y = 250 - i * 25, w = 112 * (1 - i / 10);
        g.beginPath(); g.moveTo(128 - w, y); g.quadraticCurveTo(128, y - 18, 128 + w, y);
        g.lineTo(128 + w * 0.3, y - 38); g.lineTo(128 - w * 0.3, y - 38); g.fill();
      }
    } else {
      for (let s = 0; s < 6; s++) {
        const bx = 128 + rr(r, -40, 40), lean = rr(r, -50, 50);
        twig(g, [bx, 256, bx + lean * 0.3, 140, bx + lean, 20], 3, hsl(80, 25, 26));
        for (let i = 0; i < 26; i++) {
          const t = rr(r, 0.35, 1), x = bx + lean * t * t, y = 256 - 236 * t;
          leaf(g, x, y, Math.PI / 2 + rr(r, -1.3, 1.3), rr(r, 22, 40), 5, colY(y));
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------- platanera
export function texBanana() {
  const [c, g] = canvas(256, 512);
  const r = rng(41);
  // v = 0 abajo (peciolo) → v = 1 arriba (punta); el canvas se invierte en Y
  const W = (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + t * 0.98)), 0.55);
  g.beginPath(); g.moveTo(128, 512);
  for (let i = 0; i <= 64; i++) { const t = i / 64; g.lineTo(128 + W(t) * 124, 512 - t * 512); }
  for (let i = 64; i >= 0; i--) { const t = i / 64; g.lineTo(128 - W(t) * 124, 512 - t * 512); }
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, hsl(92, 46, 30)); gr.addColorStop(0.5, hsl(96, 52, 42)); gr.addColorStop(1, hsl(90, 46, 30));
  g.fillStyle = gr; g.fill();
  g.strokeStyle = hsl(88, 40, 52, 0.35); g.lineWidth = 1.2;
  for (let y = 0; y < 512; y += 7) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128, y); g.lineTo(128 + s * 128, y - 60); g.stroke(); }
  g.fillStyle = hsl(70, 45, 62); g.fillRect(122, 0, 12, 512);
  // bordes secos
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 6; i++) { g.fillStyle = hsl(35, 45, 40, 0.5); g.beginPath(); g.arc(r() < 0.5 ? 6 : 250, r() * 512, rr(r, 10, 30), 0, 7); g.fill(); }
  // rasgaduras a lo largo de las venas
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 16; i++) {
    const s = r() < 0.5 ? -1 : 1, y = rr(r, 60, 470), d = rr(r, 40, 118);
    g.lineWidth = rr(r, 2, 4); g.beginPath(); g.moveTo(128 + s * 130, y - 65); g.lineTo(128 + s * (130 - d), y - 65 + d / 2.1); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  return toTex(c);
}
