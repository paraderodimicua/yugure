// Núcleo del kit de mobiliario: texturas de canvas cacheadas (textos japoneses reales), materiales
// especiales (impreso, luminoso, tela con viento en GPU, color por vértice, llama), acumulador de
// color por vértice y piezas compartidas (farolillo chochin, catenarias).
import * as THREE from 'three';
import { stylize, gradientMap, type Mats } from '../../render/materials';
import type { Shared } from '../../stage';
import { Builder, cached, rng, type Rnd } from '../arch/core';

export { Builder, cached, rng };
export type { Rnd };

export const MINCHO = '"Yu Mincho","YuMincho","Hiragino Mincho ProN","MS PMincho","Noto Serif JP",serif';
export const GOTHIC = '"Yu Gothic","YuGothic","Hiragino Sans","Meiryo","Noto Sans JP",sans-serif';
export const SZ = { w: 0, h: 0, d: 0 };
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export type Anim = (t: number, dt: number) => void;
type Draw = (g: CanvasRenderingContext2D, w: number, h: number, r: Rnd) => void;

// ---------- texto ----------
/** texto vertical (tategaki); la ー se dibuja como trazo vertical */
export function vtext(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, sx = 1, font = MINCHO, weight = '900', step = 1.02) {
  const ch = [...text], n = ch.length;
  g.save(); g.translate(cx, cy); g.scale(sx, 1);
  g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  ch.forEach((c, i) => {
    const y = (i - (n - 1) / 2) * size * step;
    if (c === 'ー' || c === '〜') g.fillRect(-size * 0.055, y - size * 0.38, size * 0.11, size * 0.76);
    else g.fillText(c, 0, y + size * 0.04);
  });
  g.restore();
}
export function htext(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, sy = 1, font = MINCHO, weight = '900') {
  g.save(); g.translate(cx, cy); g.scale(1, sy);
  g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 0, size * 0.04);
  g.restore();
}
/** grano de papel / tela: motas y fibras de bajo contraste */
export function grain(g: CanvasRenderingContext2D, w: number, h: number, r: Rnd, k = 1, fibers = true) {
  for (let i = 0; i < w * h * 0.02 * k; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.06 * r()})` : `rgba(255,255,255,${0.07 * r()})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  if (fibers) for (let i = 0; i < 40 * k; i++) {
    g.strokeStyle = `rgba(60,40,20,${0.05 + 0.06 * r()})`; g.lineWidth = 0.6;
    const x = r() * w, y = r() * h, a = r() * 6.3, l = 4 + r() * 14;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}
/** desgaste del borde (oscurece los márgenes) */
export function vignette(g: CanvasRenderingContext2D, w: number, h: number, a = 0.35) {
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(20,10,5,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

// ---------- color por vértice ----------
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _P = new THREE.Vector3(), _S = new THREE.Vector3();
const _V = new THREE.Vector3(), _N = new THREE.Vector3(), _NM = new THREE.Matrix3(), _C = new THREE.Color(), _C2 = new THREE.Color();
export class VC {
  pos: number[] = []; nor: number[] = []; col: number[] = [];
  /** añade `g` con color (y degradado vertical opcional hacia `top`) escalado, girado [rx,ry,rz] y movido */
  add(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, s: number | [number, number, number] = 1, rot: [number, number, number] = [0, 0, 0], top?: THREE.ColorRepresentation) {
    const sc = typeof s === 'number' ? [s, s, s] : s;
    _E.set(rot[0], rot[1], rot[2], 'YXZ'); _M.compose(_P.set(x, y, z), _Q.setFromEuler(_E), _S.set(sc[0], sc[1], sc[2])); _NM.getNormalMatrix(_M);
    _C.set(color); if (top !== undefined) _C2.set(top);
    const P = g.attributes.position, N = g.attributes.normal, I = g.index, n = I ? I.count : P.count;
    g.computeBoundingBox(); const by0 = g.boundingBox!.min.y, by1 = g.boundingBox!.max.y;
    for (let k = 0; k < n; k++) {
      const i = I ? I.getX(k) : k;
      const ly = P.getY(i);
      _V.fromBufferAttribute(P, i).applyMatrix4(_M); this.pos.push(_V.x, _V.y, _V.z);
      _N.fromBufferAttribute(N, i).applyMatrix3(_NM).normalize(); this.nor.push(_N.x, _N.y, _N.z);
      if (top !== undefined) { const t = (ly - by0) / (by1 - by0 || 1); this.col.push(_C.r + (_C2.r - _C.r) * t, _C.g + (_C2.g - _C.g) * t, _C.b + (_C2.b - _C.b) * t); }
      else this.col.push(_C.r, _C.g, _C.b);
    }
    return this;
  }
  mesh(mat: THREE.Material, cast = true) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true;
    return m;
  }
}

// ---------- geometrías compartidas ----------
export const G = {
  ico0: () => cached('p_ico0', () => new THREE.IcosahedronGeometry(1, 0)),
  ico1: () => cached('p_ico1', () => new THREE.IcosahedronGeometry(1, 1)),
  oct: () => cached('p_oct', () => new THREE.OctahedronGeometry(1, 0)),
  box: () => cached('p_box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (s = 8) => cached('p_cyl' + s, () => new THREE.CylinderGeometry(1, 1, 1, s)),
  cone: (s = 8) => cached('p_cone' + s, () => new THREE.ConeGeometry(1, 1, s)),
  sph: (w = 8, h = 6) => cached(`p_sph${w}_${h}`, () => new THREE.SphereGeometry(1, w, h)),
  /** cilindro abierto con u=0.5 mirando a +Z (para etiquetas) */
  wrap: (s = 12) => cached('p_wrap' + s, () => new THREE.CylinderGeometry(1, 1, 1, s, 1, true, -Math.PI, Math.PI * 2)),
  disc: (s = 12) => cached('p_disc' + s, () => new THREE.CircleGeometry(1, s).rotateX(-Math.PI / 2)),
  torus: (rad = 6, tub = 20, t = 0.08) => cached(`p_tor${rad}_${tub}_${t}`, () => new THREE.TorusGeometry(1, t, rad, tub)),
};
/** plano w×h (segs) con su UV recortada al rectángulo [u0,v0]-[u1,v1] */
export function planeUV(w: number, h: number, sx: number, sy: number, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
  const g = new THREE.PlaneGeometry(w, h, sx, sy), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
  return g;
}

/** puntos de una catenaria aproximada (parábola) entre a y b con flecha `sag` */
export function catenary(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 14) {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n; out.push(new THREE.Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t))); }
  return out;
}
export function polyline(B: Builder, mat: THREE.Material, r: number, pts: THREE.Vector3[], seg = 4) {
  for (let i = 0; i < pts.length - 1; i++) B.rod(mat, r, pts[i], pts[i + 1], seg);
}

/** recuento de triángulos y llamadas de dibujo de un grupo (incluye subgrupos animados) */
export function stat(g: THREE.Group, size?: { w: number; h: number; d: number }) {
  let tris = 0, draws = 0;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!(m as any).isMesh && !(o as any).isPoints) return;
    draws++;
    const geo = m.geometry;
    if ((m as any).isMesh) tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  });
  g.userData.tris = tris; g.userData.draws = draws;
  if (size) g.userData.size = size;
  return g;
}

// ---------- contexto: materiales especiales + farolillo ----------
export type Kit = ReturnType<typeof createKit>;

export function createKit(U: Shared, mats: Mats) {
  const grad = gradientMap();
  const texes = new Map<string, THREE.CanvasTexture>();
  const matC = new Map<string, THREE.Material>();
  const anims: Anim[] = [];

  function tex(key: string, w: number, h: number, draw: Draw) {
    let t = texes.get(key);
    if (t) return t;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    let s = 7; for (const ch of key) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    draw(g, w, h, rng(s % 100003));
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    texes.set(key, t);
    return t;
  }
  const once = <T extends THREE.Material>(key: string, mk: () => T): T => {
    let m = matC.get(key) as T | undefined;
    if (!m) { m = mk(); matC.set(key, m); }
    return m;
  };
  /** superficie impresa/pintada con luz toon */
  const print = (t: THREE.Texture, double = false, alpha = false) => once(`pr${t.uuid}${double}${alpha}`, () =>
    stylize(new THREE.MeshToonMaterial({ map: t, gradientMap: grad, side: double ? THREE.DoubleSide : THREE.FrontSide, alphaTest: alpha ? 0.5 : 0 }), U, 0.15));
  /** superficie retroiluminada (papel de farolillo, caja de luz); k = intensidad HDR */
  const lit = (t: THREE.Texture, k = 2, double = false) => once(`lt${t.uuid}${k}${double}`, () =>
    stylize(new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(k, k, k), side: double ? THREE.DoubleSide : THREE.FrontSide }), U, 0));
  /**
   * tela con viento en el vértice (coste CPU cero).
   * pin 0: cuelga de y = top (local) con caída `len`; pin 1: estandarte sujeto por la izquierda (uv.x=0) y arriba.
   */
  const cloth = (t: THREE.Texture, pin: 0 | 1, amp = 0.05, top = 0, len = 1, alpha = false) => once(`cl${t.uuid}${pin}${amp}${top}${len}${alpha}`, () => {
    const m = stylize(new THREE.MeshToonMaterial({ map: t, gradientMap: grad, side: THREE.DoubleSide, alphaTest: alpha ? 0.5 : 0 }), U, 0.1);
    const base = m.onBeforeCompile;
    m.onBeforeCompile = (s: any, r: any) => {
      base.call(m, s, r);
      s.uniforms.uT = U.time; s.uniforms.uCl = { value: new THREE.Vector3(amp, top, 1 / len) };
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uT; uniform vec3 uCl;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float w_ = ${pin === 0 ? 'pow(clamp((uCl.y - position.y) * uCl.z, 0.0, 1.0), 1.3)' : 'uv.x * (1.0 - uv.y)'};
          vec3 o_ = modelMatrix[3].xyz; float ph_ = o_.x * 0.73 + o_.z * 0.41;
          float s_ = sin(uT * 1.7 + ph_ + position.x * 2.3 + position.y * 1.3) + 0.5 * sin(uT * 3.1 + ph_ * 1.7 + position.x * 5.1 - position.y * 2.0);
          transformed.z += w_ * uCl.x * s_;
          transformed.x += w_ * uCl.x * 0.3 * sin(uT * 1.2 + ph_ + position.y);`);
    };
    m.customProgramCacheKey = () => 'ygcloth' + pin;
    return m;
  });
  const vc = once('vc', () => stylize(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad }), U, 0.2));
  const vcGloss = once('vcg', () => stylize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0 }), U, 0.15));
  const flame = once('flame', () => new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const steamTex = tex('steam', 64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const steamMat = once('steam', () => new THREE.PointsMaterial({ map: steamTex, size: 0.32, transparent: true, depthWrite: false, opacity: 0.16, color: 0xfff1e6 }));

  /** columna de vapor: n puntos que suben desde (x,y,z) en un radio rad; devuelve el objeto (1 llamada) */
  function steam(x: number, y: number, z: number, n = 14, rad = 0.12, rise = 0.9, size = 0.32) {
    const pos = new Float32Array(n * 3), ph = Array.from({ length: n }, (_, i) => i / n + Math.random() * 0.05);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, y + rise / 2, z), rise + rad);
    size *= 1.8; const mat = size === 0.32 ? steamMat : once('steam' + size, () => { const m = steamMat.clone(); m.size = size; return m; });
    const p = new THREE.Points(geo, mat);
    anims.push((t) => {
      if (!p.visible) return;
      for (let i = 0; i < n; i++) {
        const k = (ph[i] + t * 0.32) % 1, a = i * 2.4 + t * 0.5;
        pos[i * 3] = x + Math.cos(a) * rad * (0.4 + k) + Math.sin(t * 0.7 + i) * 0.08 * k;
        pos[i * 3 + 1] = y + k * rise;
        pos[i * 3 + 2] = z + Math.sin(a) * rad * (0.4 + k) * 0.6;
      }
      geo.attributes.position.needsUpdate = true;
    });
    return p;
  }

  // --- farolillo chochin ---
  const LANT = { round: { h: 0.5, r: 0.22 }, long: { h: 0.78, r: 0.17 } } as const;
  type Shape = keyof typeof LANT;
  const lanternGeo = (shape: Shape, hi: boolean) => cached(`chochin${shape}${hi}`, () => {
    const N = hi ? 22 : 10, seg = hi ? 14 : 9, { h, r } = LANT[shape], pts: THREE.Vector2[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let rr = shape === 'round' ? r * Math.pow(Math.sin(Math.PI * (0.1 + 0.8 * t)), 0.6) : r * (0.72 + 0.28 * Math.pow(Math.sin(Math.PI * t), 0.5));
      if (hi && i % 2) rr *= 0.972; // aros de bambú
      pts.push(new THREE.Vector2(rr, -h / 2 + t * h));
    }
    return new THREE.LatheGeometry(pts, seg, -Math.PI, Math.PI * 2);
  });
  const capR = (shape: Shape) => shape === 'round' ? 0.112 : 0.125;
  function lanternTex(text: string, color: 'red' | 'white', shape: Shape) {
    return tex(`chochin|${text}|${color}|${shape}`, 256, 256, (g, w, h, r) => {
      const red = color === 'red';
      const gr = g.createLinearGradient(0, 0, 0, h);
      const end = red ? '#6e140e' : '#a58658', mid = red ? '#e5432a' : '#fbf0d6';
      gr.addColorStop(0, end); gr.addColorStop(0.18, red ? '#c22a1c' : '#efdcb4'); gr.addColorStop(0.5, mid);
      gr.addColorStop(0.82, red ? '#c22a1c' : '#efdcb4'); gr.addColorStop(1, end);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // costura vertical de papel trasera y aros
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
      const N = 22;
      for (let i = 1; i < N; i++) { g.fillStyle = 'rgba(40,10,0,0.2)'; g.fillRect(0, (i / N) * h - 0.8, w, 1.6); }
      grain(g, w, h, r, 1);
      const sx = (LANT[shape].h / (Math.PI * 2 * LANT[shape].r)) * (w / h) * 1.05;
      const n = [...text].length;
      const size = Math.min(h * 0.62 / Math.max(n, 1), 150);
      g.fillStyle = red ? '#17100e' : '#b3221a';
      for (const cx of [w / 2, 0, w]) vtext(g, text, cx, h / 2, size, sx * 1.15, MINCHO, '900');
      // sello y bandas pintadas
      g.fillStyle = red ? 'rgba(20,10,8,0.85)' : 'rgba(25,20,30,0.85)';
      g.fillRect(0, h * 0.06, w, h * 0.025); g.fillRect(0, h * 0.915, w, h * 0.025);
    });
  }
  /** añade un chochin a B colgando de (x,y,z); devuelve la cota inferior */
  function lantern(B: Builder, x: number, y: number, z: number, o: { text?: string; color?: 'red' | 'white'; shape?: Shape; hi?: boolean; s?: number; glow?: number; frame?: THREE.Material } = {}) {
    const shape = o.shape ?? 'round', s = o.s ?? 1, hi = o.hi ?? true, { h } = LANT[shape];
    const color = o.color ?? 'red', frame = o.frame ?? mats.lacquerBlack;
    const paper = lit(lanternTex(o.text ?? '祭', color, shape), o.glow ?? (color === 'red' ? 2.1 : 1.5), true);
    B.noShadow(paper);
    const cr = capR(shape) * s, ch = 0.045 * s;
    B.rod(frame, 0.004, V(x, y, z), V(x, y - 0.05 * s, z), 3);
    B.cyl(frame, 0.012 * s, 0.03 * s, x, y - 0.05 * s, z, 6);
    B.cyl(frame, cr, ch, x, y - 0.05 * s - ch / 2, z, hi ? 12 : 8);
    const yc = y - 0.05 * s - ch * 0.8 - (h / 2) * s;
    B.geo(paper, lanternGeo(shape, hi), x, yc, z, 0, 0, 0, s, s, s);
    B.cyl(frame, cr, ch, x, yc - (h / 2) * s + ch * 0.3, z, hi ? 12 : 8);
    if (hi) B.cyl(frame, cr * 0.2, 0.05 * s, x, yc - (h / 2) * s - 0.02 * s, z, 6);
    return yc - (h / 2) * s;
  }

  return { U, mats, grad, anims, tex, print, lit, cloth, vc, vcGloss, flame, steam, lantern, lanternTex, once };
}
