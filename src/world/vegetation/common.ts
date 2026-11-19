// Vegetación: utilidades comunes (azar, material de follaje con viento/translucidez, tubos con conicidad, instanciado).
import * as THREE from 'three';
import { gradientMap, stylize } from '../../render/materials';
import type { Shared } from '../../stage';

export type Rnd = () => number;
export function rng(seed: number): Rnd {
  let a = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rr = (r: Rnd, a: number, b: number) => a + (b - a) * r();
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function randDir(r: Rnd, out = new THREE.Vector3()) {
  const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(a), u, s * Math.sin(a));
}

// ------------------------------------------------------------------------------------------------
// Material de follaje: MeshToon + bruma/contorno del juego (stylize) + viento en vértices con U.time,
// normales "de copa" (cada tarjeta se ilumina como parte de un volumen), atlas 2x2 por instancia y
// translucidez cálida cuando el sol está detrás de la hoja. Recorte con alphaTest (sin ordenación).
export type FolOpts = {
  map?: THREE.Texture; color?: THREE.ColorRepresentation;
  /** amplitud del vaivén (m), frecuencia, altura base y altura de referencia (en espacio de la malla) */
  amp?: number; freq?: number; base?: number; height?: number;
  /** aleteo vertical de hoja (m) */
  flutter?: number;
  /** intensidad de la translucidez a contraluz */
  trans?: number;
  /** 'inst': atributo aNrm por instancia · 'local': normal desde la posición local · 'none' */
  nrm?: 'inst' | 'local' | 'none'; nrmCenter?: [number, number, number]; nrmBlend?: number;
  atlas?: boolean;
  /** atributo aWp (fase, curvatura x, z) por instancia/vértice */
  awp?: boolean;
  /** atributo aW (peso del viento) en lugar del peso por altura */
  aw?: boolean;
  /** no voltear la normal en la cara trasera (tarjetas) */
  keepN?: boolean;
  alphaTest?: number; rim?: number; side?: THREE.Side;
  /** sin iluminación (siluetas lejanas pintadas): solo textura + bruma */
  basic?: boolean;
};

let GRAD: THREE.Texture | null = null;

export function folMat(U: Shared, o: FolOpts): THREE.MeshToonMaterial | THREE.MeshBasicMaterial {
  GRAD ??= gradientMap();
  const base = {
    color: o.color ?? 0xffffff, map: o.map ?? null,
    alphaTest: o.map && o.alphaTest !== 0 ? (o.alphaTest ?? 0.45) : 0,
    side: o.side ?? THREE.DoubleSide,
  };
  const m = o.basic ? new THREE.MeshBasicMaterial(base) : new THREE.MeshToonMaterial({ ...base, gradientMap: GRAD });
  stylize(m, U, o.basic ? 0 : (o.rim ?? 0.5));
  const defs: string[] = o.basic ? [] : ['FOL_LIT'];
  if (o.atlas) defs.push('FOL_ATLAS');
  if (o.awp) defs.push('FOL_AWP');
  if (o.aw) defs.push('FOL_AW');
  if (o.keepN) defs.push('FOL_KEEPN');
  if (o.nrm === 'inst') defs.push('FOL_NRM_INST');
  if (o.nrm === 'local') defs.push('FOL_NRM_LOCAL');
  m.defines = Object.fromEntries(defs.map((d) => [d, '']));
  const tr = o.trans ?? 0.9;
  const uni = {
    uTime: U.time,
    uWind: { value: new THREE.Vector4(o.amp ?? 0.06, o.freq ?? 1.1, o.base ?? 0, o.height ?? 6) },
    uFlutter: { value: o.flutter ?? 0.02 },
    uNrmC: { value: new THREE.Vector3(...(o.nrmCenter ?? [0, 0, 0])) },
    uNrmB: { value: o.nrmBlend ?? 0.8 },
    uTrans: { value: new THREE.Vector3(1.0 * tr, 0.62 * tr, 0.26 * tr) },
  };
  m.userData.fol = uni;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (s: any, r: any) => {
    prev.call(m, s, r);
    Object.assign(s.uniforms, uni);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec4 uWind; uniform float uFlutter; uniform vec3 uNrmC; uniform float uNrmB;
        #ifdef FOL_AWP
          attribute vec3 aWp;
        #endif
        #ifdef FOL_AW
          attribute float aW;
        #endif
        #ifdef FOL_ATLAS
          attribute float aCell;
        #endif
        #ifdef FOL_NRM_INST
          attribute vec3 aNrm;
        #endif`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #if defined(FOL_ATLAS) && defined(USE_MAP)
          vMapUv = vMapUv * 0.5 + vec2(mod(aCell, 2.0), floor(aCell * 0.5 + 0.01)) * 0.5;
        #endif`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        #ifdef FOL_NRM_INST
          transformedNormal = normalize(mix(transformedNormal, normalMatrix * aNrm, uNrmB));
        #endif
        #ifdef FOL_NRM_LOCAL
        { vec3 ln_ = normalize(position - uNrmC);
          #ifdef USE_INSTANCING
            ln_ = mat3(instanceMatrix) * ln_;
          #endif
          transformedNormal = normalize(mix(transformedNormal, normalMatrix * ln_, uNrmB)); }
        #endif`)
      .replace('#include <project_vertex>', `
        vec4 ip_ = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          ip_ = instanceMatrix * ip_;
        #endif
        {
          float ph_ = dot(modelMatrix[3].xz, vec2(0.13, 0.21));
          #ifdef FOL_AWP
            ph_ += aWp.x;
          #elif defined(USE_INSTANCING)
            ph_ += dot(instanceMatrix[3].xz, vec2(0.37, 0.29));
          #endif
          #ifdef FOL_AW
            float w_ = aW;
          #else
            float w_ = clamp((ip_.y - uWind.z) / uWind.w, 0.0, 1.2); w_ *= w_;
          #endif
          float t_ = uTime * uWind.y + ph_;
          float s_ = sin(t_) + 0.35 * sin(t_ * 2.7 + 1.3) + 0.25 * sin(t_ * 0.41 + 2.0);
          ip_.xz += vec2(0.85, 0.42) * (uWind.x * w_ * s_);
          #ifdef FOL_AWP
            ip_.xz += aWp.yz * w_;
          #endif
          ip_.y += uFlutter * sin(uTime * 4.7 + ph_ * 3.0 + dot(position, vec3(3.1, 2.3, 4.7))) * (0.25 + w_);
        }
        vec4 mvPosition = modelViewMatrix * ip_;
        gl_Position = projectionMatrix * mvPosition;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uTrans;`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        #if defined(FOL_KEEPN) && defined(FOL_LIT)
          normal = normalize(vNormal);
        #endif`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        #ifdef FOL_LIT
        { vec3 vd_ = -normalize(vViewPosition);
          float b_ = pow(clamp(dot(vd_, uSunView), 0.0, 1.0), 5.0);
          float bk_ = clamp(-dot(normal, uSunView), 0.0, 1.0);
          gl_FragColor.rgb += diffuseColor.rgb * uTrans * (b_ * (0.55 + 0.45 * bk_) * 1.6 + bk_ * 0.12); }
        #endif`);
  };
  m.customProgramCacheKey = () => 'yveg|' + defs.join(',') + '|' + (o.basic ? 0 : (o.rim ?? 0.5));
  return m;
}

// ------------------------------------------------------------------------------------------------
// Constructor de geometría: tubos cónicos a lo largo de curvas (troncos, ramas, lianas).
export class GeoB {
  pos: number[] = []; nrm: number[] = []; uv: number[] = []; idx: number[] = []; w: number[] = [];
  get count() { return this.pos.length / 3; }
  /** tubo por puntos de control; radio lineal r0→r1; wf(t) peso de viento opcional */
  tube(pts: THREE.Vector3[], r0: number, r1: number, radial: number, segs = pts.length - 1, wf?: (t: number) => number) {
    if (pts.length < 2) return;
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const fr = c.computeFrenetFrames(segs, false);
    const base = this.count, P = new THREE.Vector3(), N = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs; c.getPointAt(t, P);
      const r = r0 + (r1 - r0) * t, ww = wf ? wf(t) : 0;
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        N.copy(fr.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a));
        this.pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
        this.nrm.push(N.x, N.y, N.z); this.uv.push(j / radial, t); this.w.push(ww);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
      const a = base + i * radial + j, b = base + i * radial + ((j + 1) % radial);
      const c2 = a + radial, d = b + radial;
      this.idx.push(a, b, d, a, d, c2);
    }
  }
  build(withW = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (withW) g.setAttribute('aW', new THREE.Float32BufferAttribute(this.w, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------------------------------------
// Instanciado: una lista de instancias → un InstancedMesh con color, celda de atlas, normal y fase.
export type It = {
  p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3;
  c?: THREE.Color; cell?: number; n?: THREE.Vector3; wp?: [number, number, number]; w?: number;
};
export function inst(geo: THREE.BufferGeometry, mat: THREE.Material, its: It[], o: { cast?: boolean; receive?: boolean; pad?: number } = {}) {
  const g = geo.clone();
  const n = its.length;
  const cell = new Float32Array(n), nr = new Float32Array(n * 3), wp = new Float32Array(n * 3), ww = new Float32Array(n);
  const mesh = new THREE.InstancedMesh(g, mat, n);
  const M = new THREE.Matrix4(), white = new THREE.Color(1, 1, 1);
  its.forEach((it, i) => {
    mesh.setMatrixAt(i, M.compose(it.p, it.q, it.s));
    mesh.setColorAt(i, it.c ?? white);
    cell[i] = it.cell ?? 0;
    const nn = it.n ?? V3(0, 1, 0); nr.set([nn.x, nn.y, nn.z], i * 3);
    wp.set(it.wp ?? [0, 0, 0], i * 3); ww[i] = it.w ?? 0;
  });
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 1));
  g.setAttribute('aNrm', new THREE.InstancedBufferAttribute(nr, 3));
  g.setAttribute('aWp', new THREE.InstancedBufferAttribute(wp, 3));
  g.setAttribute('aW', new THREE.InstancedBufferAttribute(ww, 1));
  mesh.castShadow = o.cast ?? true; mesh.receiveShadow = o.receive ?? true;
  mesh.computeBoundingSphere();
  if (mesh.boundingSphere) mesh.boundingSphere.radius += o.pad ?? 1;
  return mesh;
}

/** tarjeta cuadrada 1x1 centrada (mira a +Z) */
export const CARD = new THREE.PlaneGeometry(1, 1);
/** tarjeta con pivote en el borde superior (cuelga hacia -Y) */
export const CARD_TOP = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
/** tarjeta con pivote en el borde inferior */
export const CARD_BOT = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
/** n planos verticales cruzados con pivote abajo (siluetas, matas) */
export function crossCards(n: number) {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI, c = Math.cos(a) * 0.5, s = Math.sin(a) * 0.5, b = k * 4;
    pos.push(-c, 0, -s, c, 0, s, c, 1, s, -c, 1, -s);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let i = 0; i < 4; i++) nrm.push(-s * 2, 0, c * 2);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/** tira arqueada (hoja de platanera, fronda de helecho): largo a lo largo de +Z, ancho en X, pliegue en V */
export function archStrip(segs: number, lift: number, droop: number, fold: number, widthProfile: (t: number) => number) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = Math.sin(t * Math.PI * 0.85) * lift - t * t * droop, w = widthProfile(t) * 0.5;
    pos.push(-w, y - fold * w, t, 0, y, t, w, y - fold * w, t);
    uv.push(0, t, 0.5, t, 1, t);
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < 2; j++) {
    const a = i * 3 + j, b = a + 1, c = a + 3, d = a + 4;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const qFrom = (x: number, y: number, z: number, order: THREE.EulerOrder = 'YXZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, order));
export const qLook = (dir: THREE.Vector3, roll = 0) => {
  const m = new THREE.Matrix4().lookAt(V3(), dir, Math.abs(dir.y) > 0.98 ? V3(1, 0, 0) : V3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), roll));
};

/** cuenta triángulos y llamadas de dibujo de un objeto */
export function stats(o: THREE.Object3D) {
  let tris = 0, draws = 0;
  o.traverse((c: any) => {
    if (!c.isMesh && !c.isPoints) return;
    draws++;
    if (c.isPoints) return;
    const g = c.geometry as THREE.BufferGeometry;
    const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += t * (c.isInstancedMesh ? c.count : 1);
  });
  o.userData.tris = Math.round(tris); o.userData.draws = draws;
  return o;
}
