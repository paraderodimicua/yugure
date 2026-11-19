// Núcleo del kit de arquitectura: acumulador de geometría por material (una malla por material
// y edificio), primitivas con UV en metros (U a lo largo de la veta) y generadores de tejado.
import * as THREE from 'three';
import type { Mats } from '../../render/materials';

export const KEN = 1.82; // módulo tradicional entre pilares

export type Platform = {
  min: [number, number, number];
  max: [number, number, number];
  /** superficie inclinada: baja desde max.y hasta min.y avanzando en `dir` por el eje `axis` */
  slope?: { axis: 'x' | 'z'; dir: 1 | -1 };
};
export type Anchor = {
  /** hueco para mobiliario: cortina noren, cartel horizontal, cartel vertical o farolillo */
  kind: 'noren' | 'sign' | 'signV' | 'lantern';
  pos: [number, number, number];
  w?: number;
  h?: number;
};
export type Size = { w: number; h: number; d: number };

export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rnd = () => number;
export const pick = <T>(r: Rnd, a: readonly T[]): T => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
export const range = (r: Rnd, a: number, b: number) => a + (b - a) * r();

class Buf {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; idx: number[] = [];
  cast = true; receive = true;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _v = new THREE.Vector3(), _n = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _nm = new THREE.Matrix3();

// [eje normal, signo, eje u, eje v]
const FACES: [number, number, number, number][] = [
  [0, 1, 2, 1], [0, -1, 2, 1], [1, 1, 0, 2], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 0, 1],
];
const CORN: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

const geoCache = new Map<string, THREE.BufferGeometry>();
export function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
/** cilindro unidad (radio 1, alto 1) con `seg` lados; rt = radio superior relativo */
export const cylGeo = (seg = 8, rt = 1, open = false) =>
  cached(`cyl${seg}_${rt}_${open}`, () => new THREE.CylinderGeometry(rt, 1, 1, seg, 1, open));
export const sphGeo = (ws = 8, hs = 6) => cached(`sph${ws}_${hs}`, () => new THREE.SphereGeometry(1, ws, hs));

export class Builder {
  private bufs = new Map<THREE.Material, Buf>();
  platforms: Platform[] = [];
  anchors: Anchor[] = [];

  private buf(mat: THREE.Material) {
    let b = this.bufs.get(mat);
    if (!b) { b = new Buf(); this.bufs.set(mat, b); }
    return b;
  }
  /** el material no proyecta sombra (interiores, papel, luces) */
  noShadow(...mats: THREE.Material[]) { for (const m of mats) this.buf(m).cast = false; return this; }
  noReceive(...mats: THREE.Material[]) { for (const m of mats) { const b = this.buf(m); b.cast = false; b.receive = false; } return this; }

  private setM(x: number, y: number, z: number, ry: number, rx: number, rz: number, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  }

  /** caja centrada en (x,y,z); UV en metros con U sobre el lado largo de cada cara */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    const b = this.buf(mat), hs = [w / 2, h / 2, d / 2];
    const rot = ry !== 0 || rx !== 0 || rz !== 0;
    if (rot) this.setM(x, y, z, ry, rx, rz);
    const c = [0, 0, 0];
    for (const [ax, sg, ua, va] of FACES) {
      const base = b.pos.length / 3;
      const hu = hs[ua], hv = hs[va];
      // u × v debe apuntar hacia fuera
      const crossSign = ((ua + 1) % 3 === va ? 1 : -1) * sg; // u×v = ±eje normal
      const swap = hv > hu;
      for (let k = 0; k < 4; k++) {
        const [cu, cv] = CORN[crossSign > 0 ? k : 3 - k];
        c[ax] = sg * hs[ax]; c[ua] = cu * hu; c[va] = cv * hv;
        if (rot) { _v.set(c[0], c[1], c[2]).applyMatrix4(_m); b.pos.push(_v.x, _v.y, _v.z); }
        else b.pos.push(c[0] + x, c[1] + y, c[2] + z);
        const uu = (cu + 1) * hu, vv = (cv + 1) * hv;
        if (swap) b.uv.push(vv, uu); else b.uv.push(uu, vv);
      }
      c[0] = c[1] = c[2] = 0; c[ax] = sg;
      if (rot) _n.set(c[0], c[1], c[2]).transformDirection(_m); else _n.set(c[0], c[1], c[2]);
      for (let k = 0; k < 4; k++) b.nor.push(_n.x, _n.y, _n.z);
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }

  /** cuadrilátero plano (orden antihorario visto desde fuera), normal plana */
  quad(mat: THREE.Material, p0: THREE.Vector3Like, p1: THREE.Vector3Like, p2: THREE.Vector3Like, p3: THREE.Vector3Like) {
    const b = this.buf(mat), base = b.pos.length / 3;
    _a.subVectors(p1 as THREE.Vector3, p0 as THREE.Vector3); _b.subVectors(p3 as THREE.Vector3, p0 as THREE.Vector3);
    const lu = _a.length(), lv = _b.length();
    _n.crossVectors(_a, _b).normalize();
    for (const p of [p0, p1, p2, p3]) { b.pos.push(p.x, p.y, p.z); b.nor.push(_n.x, _n.y, _n.z); }
    b.uv.push(0, 0, lu, 0, lu, lv, 0, lv);
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }
  tri(mat: THREE.Material, p0: THREE.Vector3Like, p1: THREE.Vector3Like, p2: THREE.Vector3Like) {
    const b = this.buf(mat), base = b.pos.length / 3;
    _a.subVectors(p1 as THREE.Vector3, p0 as THREE.Vector3); _b.subVectors(p2 as THREE.Vector3, p0 as THREE.Vector3);
    _n.crossVectors(_a, _b).normalize();
    for (const p of [p0, p1, p2]) { b.pos.push(p.x, p.y, p.z); b.nor.push(_n.x, _n.y, _n.z); b.uv.push(p.x + p.z, p.y); }
    b.idx.push(base, base + 1, base + 2);
    return this;
  }

  /** añade una geometría cualquiera transformada (indexada o no) */
  geo(mat: THREE.Material, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const b = this.buf(mat), base = b.pos.length / 3;
    this.setM(x, y, z, ry, rx, rz, sx, sy, sz);
    _nm.getNormalMatrix(_m);
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
    const flip = sx * sy * sz < 0;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); b.pos.push(_v.x, _v.y, _v.z);
      if (N) { _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize(); b.nor.push(_n.x, _n.y, _n.z); } else b.nor.push(0, 1, 0);
      if (UV) b.uv.push(UV.getX(i), UV.getY(i)); else b.uv.push(0, 0);
    }
    const I = g.index;
    const n = I ? I.count : P.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = I ? I.getX(i) : i, i1 = I ? I.getX(i + 1) : i + 1, i2 = I ? I.getX(i + 2) : i + 2;
      if (flip) b.idx.push(base + i0, base + i2, base + i1); else b.idx.push(base + i0, base + i1, base + i2);
    }
    return this;
  }

  /** cilindro vertical (o girado) de radio r y alto h */
  cyl(mat: THREE.Material, r: number, h: number, x: number, y: number, z: number, seg = 8, rt = 1, ry = 0, rx = 0, rz = 0) {
    return this.geo(mat, cylGeo(seg, rt), x, y, z, ry, rx, rz, r, h, r);
  }
  /** viga cilíndrica entre dos puntos */
  rod(mat: THREE.Material, r: number, a: THREE.Vector3Like, c: THREE.Vector3Like, seg = 6, rt = 1) {
    const b = this.buf(mat), base = b.pos.length / 3, g = cylGeo(seg, rt);
    _a.set(c.x - a.x, c.y - a.y, c.z - a.z); const len = _a.length(); _a.divideScalar(len || 1);
    _q.setFromUnitVectors(_b.set(0, 1, 0), _a);
    _m.compose(_p.set((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2), _q, _s.set(r, len, r));
    _nm.getNormalMatrix(_m);
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, I = g.index!;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); b.pos.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize(); b.nor.push(_n.x, _n.y, _n.z);
      b.uv.push(UV.getX(i) * r * 6, UV.getY(i) * len);
    }
    for (let i = 0; i < I.count; i++) b.idx.push(base + I.getX(i));
    return this;
  }
  sphere(mat: THREE.Material, r: number, x: number, y: number, z: number, sy = 1, ws = 8, hs = 6) {
    return this.geo(mat, sphGeo(ws, hs), x, y, z, 0, 0, 0, r, r * sy, r);
  }

  /**
   * Piedra labrada: caja con la cara superior biselada (sin base). `rx = PI/2` la orienta con el bisel
   * hacia +Z (sillares de muro). `irr` deforma las esquinas para que ninguna sea igual.
   */
  stone(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0, bevel = 0.04, r?: Rnd, irr = 0) {
    this.setM(x, y, z, ry, rx, 0);
    const m = _m.clone();
    const hw = w / 2, hd = d / 2, bv = Math.min(bevel, hw * 0.6, hd * 0.6, h * 0.6);
    const j = () => (r && irr ? (r() - 0.5) * 2 * irr : 0);
    const ring = (hx: number, hz: number, yy: number, jit: boolean) => CORN.map(([cx, cz]) =>
      new THREE.Vector3(cx * hx + (jit ? j() : 0), yy + (jit ? j() * 0.5 : 0), -cz * hz + (jit ? j() : 0)).applyMatrix4(m));
    // orden CORN con z invertida => antihorario visto desde arriba
    const bot = ring(hw, hd, -h / 2, false), mid = ring(hw, hd, h / 2 - bv, true), top = ring(hw - bv, hd - bv, h / 2, true);
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      this.quad(mat, bot[k], bot[k2], mid[k2], mid[k]);
      this.quad(mat, mid[k], mid[k2], top[k2], top[k]);
    }
    this.quad(mat, top[0], top[1], top[2], top[3]);
    return this;
  }

  platform(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, slope?: Platform['slope']) {
    this.platforms.push({
      min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
      max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
      ...(slope ? { slope } : {}),
    });
    return this;
  }
  anchor(kind: Anchor['kind'], x: number, y: number, z: number, w?: number, h?: number) {
    this.anchors.push({ kind, pos: [x, y, z], w, h });
    return this;
  }

  /** vuelca otro Builder girado `ry` (múltiplos de 90° para que las plataformas sigan siendo cajas) y desplazado */
  merge(o: Builder, x = 0, y = 0, z = 0, ry = 0) {
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const [mat, ob] of o.bufs) {
      const b = this.buf(mat), base = b.pos.length / 3;
      if (!ob.cast) b.cast = false;
      if (!ob.receive) b.receive = false;
      for (let i = 0; i < ob.pos.length; i += 3) {
        const px = ob.pos[i], pz = ob.pos[i + 2], nx = ob.nor[i], nz = ob.nor[i + 2];
        b.pos.push(px * c + pz * s + x, ob.pos[i + 1] + y, -px * s + pz * c + z);
        b.nor.push(nx * c + nz * s, ob.nor[i + 1], -nx * s + nz * c);
      }
      for (const u of ob.uv) b.uv.push(u);
      for (const i of ob.idx) b.idx.push(base + i);
    }
    for (const p of o.platforms) {
      const xs = [p.min[0], p.max[0]], zs = [p.min[2], p.max[2]];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const px of xs) for (const pz of zs) {
        const wx = px * c + pz * s + x, wz = -px * s + pz * c + z;
        x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
      }
      this.platforms.push({ min: [x0, p.min[1] + y, z0], max: [x1, p.max[1] + y, z1] });
    }
    for (const a of o.anchors) this.anchors.push({ ...a, pos: [a.pos[0] * c + a.pos[2] * s + x, a.pos[1] + y, -a.pos[0] * s + a.pos[2] * c + z] });
    return this;
  }

  finish(name: string, size: Size): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    let tris = 0;
    for (const [mat, b] of this.bufs) {
      if (!b.idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setIndex(b.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = b.cast; mesh.receiveShadow = b.receive;
      mesh.matrixAutoUpdate = false;
      g.add(mesh);
      tris += b.idx.length / 3;
    }
    g.userData.size = size;
    g.userData.platforms = this.platforms;
    g.userData.anchors = this.anchors;
    g.userData.tris = tris;
    g.userData.draws = g.children.length;
    return g;
  }
}

// ---------------------------------------------------------------------------------------------
// Tejados
// ---------------------------------------------------------------------------------------------
export type SheetOpts = {
  wTop: number; wBot: number; run: number; rise: number;
  /** comba cóncava (sori) en metros */
  sag?: number;
  /** elevación de las esquinas del alero en metros */
  upturn?: number;
  col?: number; row?: number; rib?: number; step?: number;
  /** lámina lisa (tablazón inferior, paja) */
  flat?: boolean;
  /** cara hacia abajo */
  flip?: boolean;
  /** faldón vertical en el alero */
  skirt?: number;
};
export function sheetY(o: SheetOpts, x: number, t: number) {
  const hb = o.wBot / 2;
  return -o.rise * t - (o.sag ?? 0) * 4 * t * (1 - t) + (o.upturn ?? 0) * Math.pow(Math.min(1, Math.abs(x) / hb), 3) * t * t;
}
/**
 * Faldón de tejado. Local: cumbrera sobre el eje X en y=0,z=0; baja hacia +Z hasta z=run, y=-rise.
 * Con teja (por defecto): canales planos y cobijas redondas en columnas, hiladas escalonadas.
 * Si wTop < wBot las columnas se recortan contra la limatesa (tejado a cuatro aguas).
 */
export function roofSheet(o: SheetOpts): THREE.BufferGeometry {
  const xs: number[] = [], hs: number[] = [];
  const curved = (o.sag ?? 0) > 0 || (o.upturn ?? 0) > 0;
  if (o.flat) {
    const n = (o.upturn ?? 0) > 0 ? 8 : (o.wTop !== o.wBot ? 2 : 1);
    for (let i = 0; i <= n; i++) { xs.push(-1 + (2 * i) / n); hs.push(0); } // fracción, no metros
  } else {
    const ncol = Math.max(2, Math.round(o.wBot / (o.col ?? 0.34))), cw = o.wBot / ncol, rib = o.rib ?? 0.07;
    for (let i = 0; i < ncol; i++) {
      const x0 = -o.wBot / 2 + i * cw;
      xs.push(x0, x0 + cw * 0.5, x0 + cw * 0.75); hs.push(0, 0, rib);
    }
    xs.push(o.wBot / 2); hs.push(0);
  }
  const ts: number[] = [], ls: number[] = [];
  if (o.flat) {
    const n = curved ? 5 : 1;
    for (let j = 0; j <= n; j++) { ts.push(j / n); ls.push(0); }
    if (o.skirt) { ts.push(1); ls.push(-o.skirt); }
  } else {
    const slopeLen = Math.hypot(o.run, o.rise);
    const nrow = Math.max(1, Math.round(slopeLen / (o.row ?? 0.56))), st = o.step ?? 0.035;
    for (let j = 0; j < nrow; j++) { ts.push(j / nrow, (j + 1) / nrow - 0.02 / nrow); ls.push(0, st); }
    ts[ts.length - 1] = 1;
    if (o.skirt) { ts.push(1); ls.push(-o.skirt); }
  }
  const nx = xs.length, nt = ts.length;
  const pos = new Float32Array(nx * nt * 3), uv = new Float32Array(nx * nt * 2), idx: number[] = [];
  for (let j = 0; j < nt; j++) {
    const t = ts[j], hw = (o.wTop + (o.wBot - o.wTop) * t) / 2;
    for (let i = 0; i < nx; i++) {
      const x = o.flat ? xs[i] * hw : Math.max(-hw, Math.min(hw, xs[i]));
      const k = j * nx + i;
      pos[k * 3] = x;
      pos[k * 3 + 1] = sheetY(o, x, t) + hs[i] + ls[j];
      pos[k * 3 + 2] = o.run * t;
      uv[k * 2] = x; uv[k * 2 + 1] = t * Math.hypot(o.run, o.rise);
    }
  }
  for (let j = 0; j < nt - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    if (o.flip) idx.push(a, b, d, b, e, d); else idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Remate onigawara: silueta de teja-ogro extruida */
export const onigawaraGeo = () => cached('oni', () => {
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.34, 0.16); s.lineTo(0.22, 0.2); s.lineTo(0.2, 0.36);
  s.lineTo(0.1, 0.42); s.lineTo(0.06, 0.6); s.lineTo(0, 0.5); s.lineTo(-0.06, 0.6); s.lineTo(-0.1, 0.42);
  s.lineTo(-0.2, 0.36); s.lineTo(-0.22, 0.2); s.lineTo(-0.34, 0.16); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  g.translate(0, 0, -0.05);
  return g;
});

export type Palette = {
  wood: THREE.Material; wood2: THREE.Material; plaster: THREE.Material; tile: THREE.Material;
  stone: THREE.Material; metal: THREE.Material; paper: THREE.Material;
  /** papel iluminado desde dentro */
  paperLit: THREE.Material;
  /** paredes interiores bañadas por la lámpara */
  wallLit: THREE.Material;
  /** siluetas y sombras */
  dark: THREE.Material;
  lamp: THREE.Material;
  cloth: THREE.Material;
  /** tatami iluminado */
  floorLit: THREE.Material;
  /** sombra proyectada sobre papel iluminado */
  shade: THREE.Material;
};
export function palette(mats: Mats, r: Rnd, over: Partial<Palette> = {}): Palette {
  return {
    wood: pick(r, [mats.woodDark, mats.woodDark, mats.woodWeathered, mats.woodDark]),
    wood2: pick(r, [mats.woodWarm, mats.woodWeathered, mats.woodWarm]),
    plaster: pick(r, [mats.plaster, mats.plasterAged, mats.plaster]),
    tile: pick(r, [mats.tileSlate, mats.tileSlate, mats.tileClay]),
    stone: mats.stone, metal: mats.metalDark, paper: mats.paper,
    paperLit: mats.glow(0xffb45e, 1.25),
    wallLit: mats.glow(0xd9903f, 0.62),
    dark: mats.hair,
    lamp: mats.glow(0xffc070, 2.6),
    floorLit: mats.glow(0xa8923c, 0.5),
    shade: mats.glow(0x8a4a1e, 0.55),
    cloth: mats.tint('fabric', pick(r, [0x2f4468, 0x7a2f2a, 0x3d5a4a, 0x8a6a2c])),
    ...over,
  };
}

/**
 * Tejado a dos aguas con cumbrera paralela a X. (x, yRidge, zRidge) centro de la cumbrera.
 * Incluye teja, tablazón inferior, cumbrera de varias capas, onigawara, tejas de borde y tablas de hastial.
 */
export function gableRoof(B: Builder, P: Palette, o: {
  len: number; x?: number; y: number; z: number; runF: number; runB: number; pitch: number;
  sag?: number; col?: number; row?: number; ridge?: boolean; oni?: boolean; platforms?: boolean;
}) {
  const x = o.x ?? 0, tan = Math.tan(o.pitch);
  for (const [run, ry] of [[o.runF, 0], [o.runB, Math.PI]] as const) {
    if (run <= 0) continue;
    const so: SheetOpts = { wTop: o.len, wBot: o.len, run, rise: run * tan, sag: o.sag, col: o.col, row: o.row, skirt: 0.07 };
    B.geo(P.tile, roofSheet(so), x, o.y, o.z, ry);
    B.geo(P.wood, roofSheet({ ...so, flat: true, flip: true, skirt: 0 }), x, o.y - 0.085, o.z, ry);
    const dir = ry === 0 ? 1 : -1, ze = o.z + dir * run, ye = o.y - run * tan;
    // tabla de alero (cierra el canto) y tejas de borde del hastial
    B.box(P.wood, o.len, 0.05, 0.1, x, ye - 0.05, ze - dir * 0.04, 0, dir * o.pitch);
    const sl = Math.hypot(run, run * tan);
    for (const sx of [-1, 1]) {
      const ex = x + sx * (o.len / 2 - 0.05);
      B.box(P.tile, 0.16, 0.1, sl, ex, o.y - (run * tan) / 2 + 0.07 - (o.sag ?? 0) * 0.6, o.z + dir * run / 2, 0, dir * o.pitch);
      // tabla de hastial (hafu)
      B.box(P.wood, 0.05, 0.2, sl + 0.05, x + sx * (o.len / 2 + 0.005), o.y - (run * tan) / 2 - 0.1 - (o.sag ?? 0) * 0.6, o.z + dir * run / 2, 0, dir * o.pitch);
    }
    if (o.platforms !== false) B.platform(x - o.len / 2, ye, o.z, x + o.len / 2, o.y + 0.05, ze, { axis: 'z', dir });
  }
  if (o.ridge !== false) {
    // cumbrera: hiladas noshi + cobija redonda
    B.box(P.tile, o.len - 0.1, 0.1, 0.42, x, o.y + 0.07, o.z);
    B.box(P.tile, o.len - 0.16, 0.09, 0.3, x, o.y + 0.16, o.z);
    B.geo(P.tile, cylGeo(8), x, o.y + 0.22, o.z, 0, 0, Math.PI / 2, 0.11, o.len - 0.04, 0.11);
    if (o.oni !== false) for (const sx of [-1, 1]) {
      B.geo(P.tile, onigawaraGeo(), x + sx * (o.len / 2 + 0.02), o.y - 0.02, o.z, sx * Math.PI / 2);
      B.geo(P.tile, cylGeo(8), x + sx * (o.len / 2 - 0.05), o.y + 0.24, o.z, 0, 0, Math.PI / 2, 0.15, 0.16, 0.15);
    }
  }
}

/**
 * Tejado a cuatro aguas / piramidal con comba y esquinas levantadas. (x, y, z) = centro a la altura
 * de la cumbrera. w,d = tamaño en el alero; topW, topD = tamaño de la cumbrera (≈0 para piramidal).
 */
export function hipRoof(B: Builder, tileMat: THREE.Material, underMat: THREE.Material | null, ridgeMat: THREE.Material, o: {
  x?: number; y: number; z?: number; w: number; d: number; topW: number; topD: number; rise: number;
  sag?: number; upturn?: number; col?: number; row?: number; flat?: boolean; hips?: boolean; skirt?: number;
  underDrop?: number; platforms?: boolean;
}) {
  const x = o.x ?? 0, z = o.z ?? 0;
  const sides: [number, number, number, number, number, number][] = [
    // wTop, wBot, run, ry, ox, oz
    [o.topW, o.w, (o.d - o.topD) / 2, 0, 0, o.topD / 2],
    [o.topW, o.w, (o.d - o.topD) / 2, Math.PI, 0, -o.topD / 2],
    [o.topD, o.d, (o.w - o.topW) / 2, Math.PI / 2, o.topW / 2, 0],
    [o.topD, o.d, (o.w - o.topW) / 2, -Math.PI / 2, -o.topW / 2, 0],
  ];
  for (const [wTop, wBot, run, ry, ox, oz] of sides) {
    const so: SheetOpts = { wTop, wBot, run, rise: o.rise, sag: o.sag, upturn: o.upturn, col: o.col, row: o.row, flat: o.flat, skirt: o.skirt ?? 0.07 };
    B.geo(tileMat, roofSheet(so), x + ox, o.y, z + oz, ry);
    if (underMat) B.geo(underMat, roofSheet({ ...so, flat: true, flip: true, skirt: 0 }), x + ox, o.y - (o.underDrop ?? 0.09), z + oz, ry);
  }
  if (o.platforms !== false) {
    const e = o.y - o.rise;
    B.platform(x - o.w / 2, e, z + o.topD / 2, x + o.w / 2, o.y, z + o.d / 2, { axis: 'z', dir: 1 });
    B.platform(x - o.w / 2, e, z - o.d / 2, x + o.w / 2, o.y, z - o.topD / 2, { axis: 'z', dir: -1 });
    B.platform(x + o.topW / 2, e, z - o.d / 2, x + o.w / 2, o.y, z + o.d / 2, { axis: 'x', dir: 1 });
    B.platform(x - o.w / 2, e, z - o.d / 2, x - o.topW / 2, o.y, z + o.d / 2, { axis: 'x', dir: -1 });
  }
  if (o.hips !== false) {
    // limatesas: lomo de teja siguiendo la curva de cada esquina
    const so: SheetOpts = { wTop: o.topW, wBot: o.w, run: (o.d - o.topD) / 2, rise: o.rise, sag: o.sag, upturn: o.upturn };
    const N = (o.sag || o.upturn) ? 5 : 1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= N; i++) {
        const t = i / N, hw = (o.topW + (o.w - o.topW) * t) / 2;
        const p = new THREE.Vector3(x + sx * hw, o.y + sheetY(so, hw, t) + 0.06, z + sz * (o.topD / 2 + so.run * t));
        if (prev) B.rod(ridgeMat, 0.085, prev, p, 6);
        prev = p;
      }
      if (prev) B.sphere(ridgeMat, 0.12, prev.x, prev.y + 0.02, prev.z, 1, 6, 4);
    }
  }
}

/** cabios vistos bajo un alero recto que baja hacia +Z (o -Z con dir=-1) */
export function rafters(B: Builder, mat: THREE.Material, x0: number, x1: number, yWall: number, zWall: number, out: number, pitch: number, dir = 1, gap = 0.32, sec = 0.06) {
  const n = Math.max(2, Math.round((x1 - x0) / gap)), len = out / Math.cos(pitch);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    B.box(mat, sec, sec * 1.3, len, x, yWall - (out / 2) * Math.tan(pitch), zWall + dir * out / 2, 0, dir * pitch);
  }
}
