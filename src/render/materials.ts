// Biblioteca de materiales del juego. CONTRATO PÚBLICO: los nombres de MatName, createMaterials(),
// Mats.tint() y Mats.glow() no pueden cambiar; otros módulos compilan contra ellos.
import * as THREE from 'three';
import { SKY_GLSL } from './shaders';
import { detailTexture, type TexKind } from './textures';
import type { Shared } from '../stage';

// Rampa toon suave de 3 bandas.
export function gradientMap() {
  const n = 64, data = new Uint8Array(n * 4);
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const v = 0.10 + 0.42 * ss(0.40, 0.52, x) + 0.48 * ss(0.68, 0.82, x);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(v * 255); data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Inyecta luz de contorno dorada (solo en siluetas a contraluz) y bruma atmosférica (con el color real del cielo) en un material de three.
// Funciona con MeshToonMaterial, MeshStandardMaterial/Physical y MeshBasicMaterial (este último con rim = 0).
export function stylize<T extends THREE.Material>(mat: T, U: Shared, rim = 1): T {
  mat.onBeforeCompile = (s: any) => {
    s.uniforms.uSunDir = U.sunDir; s.uniforms.uSunView = U.sunView; s.uniforms.uFogDens = U.fogDens;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vec4 wp_ = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp_ = instanceMatrix * wp_;
        #endif
        #ifdef USE_BATCHING
          wp_ = batchingMatrix * wp_;
        #endif
        vWPos = (modelMatrix * wp_).xyz;`);
    const rimCode = rim > 0 ? `
        vec3 V_ = normalize(vViewPosition);
        float fr_ = pow(1.0 - clamp(dot(normal, V_), 0.0, 1.0), 4.0);
        float bk_ = clamp(dot(normal, uSunView) * 0.5 + 0.5, 0.0, 1.0) * smoothstep(0.0, 0.7, -dot(V_, uSunView));
        gl_FragColor.rgb += vec3(1.5, 0.8, 0.32) * fr_ * bk_ * ${rim.toFixed(2)};` : '';
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform vec3 uSunDir; uniform vec3 uSunView; uniform float uFogDens;
        ${SKY_GLSL}`)
      .replace('#include <dithering_fragment>', `${rimCode}
        vec3 d_ = vWPos - cameraPosition; float dist_ = length(d_); d_ /= dist_;
        float fa_ = 1.0 - exp(-dist_ * uFogDens * mix(1.5, 0.45, smoothstep(0.0, 260.0, vWPos.y)));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor(d_, uSunDir), fa_);
        #include <dithering_fragment>`);
  };
  mat.customProgramCacheKey = () => 'yugure' + rim;
  return mat;
}

export type MatName =
  | 'woodDark' | 'woodWarm' | 'woodWeathered' | 'woodRed'
  | 'plaster' | 'plasterAged' | 'plasterDark'
  | 'tileSlate' | 'tileClay'
  | 'stone' | 'stoneMoss' | 'concrete' | 'cobble' | 'earth'
  | 'metalDark' | 'metalRust' | 'metalGold' | 'metalPaint'
  | 'paper' | 'glass' | 'ceramic' | 'lacquerRed' | 'lacquerBlack'
  | 'bamboo' | 'bark' | 'leaf' | 'leafDark' | 'moss'
  | 'fabric' | 'rope' | 'straw' | 'skin' | 'hair' | 'water';

export type Mats = Record<MatName, THREE.Material> & {
  /** variante del material con otro color base (se cachea por nombre+color) */
  tint(name: MatName, color: THREE.ColorRepresentation): THREE.Material;
  /** variante con la veta / hiladas a lo largo del eje LOCAL indicado (por defecto: automático) */
  along(name: MatName, axis: 'x' | 'y' | 'z'): THREE.Material;
  /** material emisivo HDR para farolillos, ventanas, fuego; intensity ~1-4 */
  glow(color: THREE.ColorRepresentation, intensity?: number): THREE.Material;
};

const BASE: Record<MatName, number> = {
  woodDark: 0x3a2c28, woodWarm: 0x8a5a38, woodWeathered: 0x6f6a66, woodRed: 0x9c3a2c,
  plaster: 0xd9c7ad, plasterAged: 0xb9a48f, plasterDark: 0x55505a,
  tileSlate: 0x34415f, tileClay: 0x6b4a44,
  stone: 0x7c7a80, stoneMoss: 0x5f6e58, concrete: 0x8a8a90, cobble: 0x6a666c, earth: 0x5a463a,
  metalDark: 0x1b1c26, metalRust: 0x7a4630, metalGold: 0xd8a84a, metalPaint: 0x4a7a8a,
  paper: 0xf2e6cf, glass: 0x232b45, ceramic: 0xe8e4dc, lacquerRed: 0xb0241c, lacquerBlack: 0x16141a,
  bamboo: 0x7c9a4a, bark: 0x4a382e, leaf: 0x3f7a3a, leafDark: 0x23483a, moss: 0x4f6b35,
  fabric: 0xd8d0c4, rope: 0xb89a6a, straw: 0xc9a85a, skin: 0xe8b999, hair: 0x1c1820, water: 0x2a5560,
};

// ------------------------------------------------------------------------------------------------
// Superficie con textura procedural SIN UVs.
// Proyección de un solo eje (el dominante de la normal) en ESPACIO OBJETO multiplicado por la escala
// del objeto: densidad de texel constante por metro y la textura va pegada al objeto (no "nada" al
// moverlo, rotarlo ni al deformarlo con huesos: se usa la posición de reposo). En cilindros la
// proyección es continua en espejo entre caras laterales, así que troncos, postes y bambú no tienen
// costura. Las instancias reciben un desfase fijo derivado de su posición para no ser clónicas
// (por eso NO hay que animar la traslación de instancias con estos materiales; rotar/escalar sí).
// Coste por píxel: 2 lecturas de textura (detalle + variación a gran escala), sin trabajo en CPU.
type Def = {
  tex: TexKind; kind: 't' | 's' | 'p';
  c2: number;                       // color del desgaste / musgo / óxido
  ts?: number;                      // multiplicador del tamaño de baldosa
  tone: number; bump: number; relief: number;
  mask: [number, number, number];   // umbral bajo, alto, intensidad
  macro?: number;                   // variación a gran escala
  rough?: number; metal?: number; rough2?: number; metal2?: number;
  rim?: number; grain?: boolean;    // grain: orientar la veta según el eje más largo del objeto
  env?: number;                     // refuerzo del reflejo del cielo
  coat?: number;                    // barniz (clearcoat)
  trans?: [number, number, number, number]; // translucidez cálida: rgb + parte constante
  water?: boolean;
};

const DEFS: Record<MatName, Def> = {
  woodDark:      { tex: 'wood', kind: 't', c2: 0x6f6259, tone: 1.0, bump: 1.0, relief: 1.3, mask: [0.55, 0.82, 0.5], grain: true },
  woodWarm:      { tex: 'wood', kind: 't', c2: 0x7d7064, tone: 0.9, bump: 1.0, relief: 1.2, mask: [0.58, 0.84, 0.45], grain: true },
  woodWeathered: { tex: 'wood', kind: 't', c2: 0xa39d92, tone: 1.1, bump: 1.6, relief: 1.5, mask: [0.4, 0.75, 0.7], grain: true },
  woodRed:       { tex: 'wood', kind: 't', c2: 0x4a342c, tone: 0.75, bump: 1.0, relief: 1.2, mask: [0.6, 0.68, 0.9], grain: true },
  plaster:       { tex: 'plaster', kind: 't', c2: 0x8f8468, tone: 0.8, bump: 1.0, relief: 1.6, mask: [0.52, 0.75, 0.55] },
  plasterAged:   { tex: 'plaster', kind: 't', c2: 0x6f6a55, tone: 1.0, bump: 1.3, relief: 1.8, mask: [0.42, 0.68, 0.72] },
  plasterDark:   { tex: 'plaster', kind: 't', c2: 0x343440, tone: 0.9, bump: 1.2, relief: 1.8, mask: [0.5, 0.75, 0.55] },
  tileSlate:     { tex: 'kawara', kind: 's', c2: 0x565c44, tone: 0.8, bump: 1.0, relief: 0.25, mask: [0.5, 0.75, 0.6], rough: 0.3, metal: 0.35, rough2: 0.95, metal2: 0, env: 1.8, macro: 0.3 },
  tileClay:      { tex: 'kawara', kind: 't', c2: 0x4c4a38, tone: 0.9, bump: 1.0, relief: 0.8, mask: [0.45, 0.72, 0.65] },
  stone:         { tex: 'stone', kind: 't', c2: 0x55603c, tone: 0.9, bump: 1.0, relief: 1.2, mask: [0.6, 0.8, 0.6] },
  stoneMoss:     { tex: 'stone', kind: 't', c2: 0x4f6b35, tone: 0.9, bump: 1.0, relief: 1.2, mask: [0.4, 0.6, 0.92] },
  concrete:      { tex: 'concrete', kind: 't', c2: 0x4e4a4a, tone: 0.8, bump: 1.0, relief: 1.6, mask: [0.48, 0.75, 0.6] },
  cobble:        { tex: 'cobble', kind: 't', c2: 0x4a4c34, tone: 0.9, bump: 1.0, relief: 1.0, mask: [0.5, 0.72, 0.7] },
  earth:         { tex: 'earth', kind: 't', c2: 0x56603a, tone: 0.9, bump: 1.0, relief: 1.1, mask: [0.6, 0.78, 0.6] },
  metalDark:     { tex: 'metal', kind: 's', c2: 0x5e3826, tone: 0.6, bump: 1.0, relief: 0.2, mask: [0.6, 0.65, 0.85], rough: 0.36, metal: 0.85, rough2: 0.9, metal2: 0.1, env: 1.8 },
  metalRust:     { tex: 'metal', kind: 's', c2: 0x2c2124, tone: 1.2, bump: 1.6, relief: 0.5, mask: [0.5, 0.6, 0.75], rough: 0.85, metal: 0.25, rough2: 0.6, metal2: 0.5 },
  metalGold:     { tex: 'metal', kind: 's', c2: 0x5e4420, tone: 0.35, bump: 0.6, relief: 0.1, mask: [0.62, 0.7, 0.6], rough: 0.22, metal: 1, rough2: 0.6, metal2: 0.6, env: 2.0 },
  metalPaint:    { tex: 'metal', kind: 's', c2: 0x7a4630, tone: 0.7, bump: 1.3, relief: 0.4, mask: [0.55, 0.59, 1], rough: 0.42, metal: 0.1, rough2: 0.9, metal2: 0.3, env: 1.6 },
  paper:         { tex: 'washi', kind: 't', c2: 0xb89a6a, tone: 0.8, bump: 1.0, relief: 1.0, mask: [0.62, 0.85, 0.4], trans: [0.75, 0.5, 0.24, 0.35], macro: 0.15 },
  glass:         { tex: 'ripple', kind: 's', c2: 0x4a4a52, ts: 0.4, tone: 0, bump: 0.25, relief: 0, mask: [0.6, 0.9, 0.35], rough: 0.04, metal: 0.9, rough2: 0.5, metal2: 0.2, env: 2.6, macro: 0.1 },
  ceramic:       { tex: 'plaster', kind: 'p', c2: 0xa89a80, ts: 0.2, tone: 0.3, bump: 0.12, relief: 0, mask: [0.62, 0.85, 0.3], rough: 0.4, metal: 0, coat: 1, env: 2.2, macro: 0.12 },
  lacquerRed:    { tex: 'wood', kind: 'p', c2: 0x2a1a18, tone: 0.3, bump: 0.15, relief: 0.1, mask: [0.72, 0.78, 0.85], rough: 0.45, metal: 0, rough2: 0.8, coat: 1, env: 2.2, macro: 0.15, grain: true },
  lacquerBlack:  { tex: 'wood', kind: 'p', c2: 0x6a2a1e, tone: 0.3, bump: 0.15, relief: 0.1, mask: [0.72, 0.78, 0.85], rough: 0.4, metal: 0, rough2: 0.8, coat: 1, env: 2.4, macro: 0.1, grain: true },
  bamboo:        { tex: 'bamboo', kind: 't', c2: 0xb8a860, tone: 0.9, bump: 1.0, relief: 0.8, mask: [0.55, 0.8, 0.4], grain: true },
  bark:          { tex: 'bark', kind: 't', c2: 0x4f6b35, tone: 1.0, bump: 1.0, relief: 1.0, mask: [0.58, 0.76, 0.7], grain: true },
  leaf:          { tex: 'leaves', kind: 't', c2: 0x8aa83a, tone: 1.2, bump: 1.0, relief: 1.0, mask: [0.5, 0.8, 0.6], trans: [0.35, 0.5, 0.08, 0.0], rim: 0.5 },
  leafDark:      { tex: 'leaves', kind: 't', c2: 0x3f7a3a, tone: 1.2, bump: 1.0, relief: 1.0, mask: [0.5, 0.8, 0.6], trans: [0.2, 0.35, 0.06, 0.0], rim: 0.5 },
  moss:          { tex: 'moss', kind: 't', c2: 0x8a8a3a, tone: 1.0, bump: 1.0, relief: 1.0, mask: [0.55, 0.8, 0.5] },
  fabric:        { tex: 'weave', kind: 't', c2: 0x8a7a68, tone: 0.9, bump: 1.0, relief: 1.2, mask: [0.55, 0.8, 0.35], macro: 0.35, rim: 0.5 },
  rope:          { tex: 'rope', kind: 't', c2: 0x6a5a40, tone: 1.0, bump: 1.0, relief: 1.2, mask: [0.55, 0.8, 0.4], grain: true },
  straw:         { tex: 'thatch', kind: 't', c2: 0x6a5a3a, tone: 1.0, bump: 1.0, relief: 0.9, mask: [0.55, 0.8, 0.55] },
  skin:          { tex: 'macro', kind: 't', c2: 0xd88a7a, ts: 0.07, tone: 0.1, bump: 0, relief: 0, mask: [0.55, 0.85, 0.3], macro: 0, rim: 0.6 },
  hair:          { tex: 'thatch', kind: 't', c2: 0x4a3c54, ts: 0.4, tone: 0.9, bump: 0.5, relief: 1.2, mask: [0.6, 0.85, 0.4], macro: 0.1, rim: 0.6 },
  water:         { tex: 'ripple', kind: 's', c2: 0x2a5560, tone: 0, bump: 1.6, relief: 0, mask: [2, 3, 0], rough: 0.05, metal: 0.55, env: 2.6, macro: 0.1, water: true },
};

const VERT_PARS = /* glsl */ `
varying vec3 vTP; varying vec3 vTN;
#ifdef Y_GRAIN
  varying vec3 vGr;
#endif
#ifdef USE_INSTANCING
  varying vec2 vOf;
#endif`;
const VERT_MAIN = /* glsl */ `
{
  mat4 M_ = modelMatrix;
  #ifdef USE_BATCHING
    M_ = M_ * batchingMatrix;
  #endif
  #ifdef USE_INSTANCING
    M_ = M_ * instanceMatrix;
    vec3 it_ = floor(instanceMatrix[3].xyz * 4.0 + 0.5);
    vOf = fract(sin(vec2(dot(it_, vec3(12.99, 78.23, 37.72)), dot(it_, vec3(39.35, 11.14, 83.16)))) * 43758.5) * 4.0;
  #endif
  vec3 s_ = vec3(length(M_[0].xyz), length(M_[1].xyz), length(M_[2].xyz));
  vTP = position * s_;
  vTN = normal / s_;
  #ifdef Y_GRAIN
    #if Y_GRAIN == 1
      vGr = (s_.x > s_.y * 1.3 && s_.x >= s_.z) ? vec3(1.0, 0.0, 0.0) : (s_.z > s_.y * 1.3 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0));
    #elif Y_GRAIN == 2
      vGr = vec3(1.0, 0.0, 0.0);
    #elif Y_GRAIN == 3
      vGr = vec3(0.0, 1.0, 0.0);
    #else
      vGr = vec3(0.0, 0.0, 1.0);
    #endif
  #endif
}`;
const FRAG_PARS = /* glsl */ `
uniform sampler2D tDet; uniform sampler2D tMacro;
uniform vec4 uTex; uniform vec4 uMk; uniform vec4 uFx; uniform vec4 uTr; uniform vec3 uC2;
varying vec3 vTP; varying vec3 vTN;
#ifdef Y_GRAIN
  varying vec3 vGr;
#endif
#ifdef USE_INSTANCING
  varying vec2 vOf;
#endif
#ifdef Y_WATER
  uniform float uTime;
#endif`;
const FRAG_MAIN = /* glsl */ `
{
  float nl_ = length(vTN);
  vec3 an_ = abs(vTN) / nl_;
  float flat_ = step(dot(fwidth(vTN), vec3(1.0)), 1e-4 * nl_);
  vec3 sg_ = vec3(vTN.x < 0.0 ? -1.0 : 1.0, vTN.y < 0.0 ? -1.0 : 1.0, vTN.z < 0.0 ? -1.0 : 1.0);
  an_ += (1.0 - flat_) * 0.07 * sin(vTP.yzx * 23.0 + sin(vTP.zxy * 17.0) * 2.0);
  vec3 Ua_; vec3 Va_; vec2 of_ = vec2(0.0);
  if (an_.y >= an_.x && an_.y >= an_.z) { Ua_ = vec3(1.0, 0.0, 0.0); Va_ = vec3(0.0, 0.0, 1.0); of_ = vec2(0.29, 0.57); }
  else if (an_.x > an_.z) { Ua_ = vec3(0.0, 0.0, sg_.x); Va_ = vec3(0.0, 1.0, 0.0); of_ = vec2(0.731, 0.413) * flat_; }
  else { Ua_ = vec3(sg_.z, 0.0, 0.0); Va_ = vec3(0.0, 1.0, 0.0); }
  #ifdef Y_GRAIN
    if (abs(dot(Ua_, vGr)) > 0.5) { vec3 sw_ = Ua_; Ua_ = Va_; Va_ = sw_; }
  #endif
  #ifdef USE_INSTANCING
    of_ += vOf;
  #endif
  vec3 dpx_ = dFdx(vTP); vec3 dpy_ = dFdy(vTP);
  vec2 uvm_ = vec2(dot(vTP, Ua_), dot(vTP, Va_)) + of_;
  vec2 dxm_ = vec2(dot(dpx_, Ua_), dot(dpx_, Va_));
  vec2 dym_ = vec2(dot(dpy_, Ua_), dot(dpy_, Va_));
  vec2 uvd_ = uvm_ * uTex.x;
  #ifdef Y_WATER
    uvd_ += uTime * vec2(0.011, 0.019);
  #endif
  vec4 t_ = textureGrad(tDet, uvd_, dxm_ * uTex.x, dym_ * uTex.x);
  vec4 mc_ = textureGrad(tMacro, uvm_ * uTex.y + 0.37, dxm_ * uTex.y, dym_ * uTex.y);
  vec2 g_ = t_.rg - 0.50196;
  #ifdef Y_WATER
    g_ += textureGrad(tDet, uvm_ * uTex.x * 1.9 - uTime * vec2(0.021, 0.008), dxm_ * uTex.x * 1.9, dym_ * uTex.x * 1.9).rg - 0.50196;
  #endif
  float mk_ = smoothstep(uMk.x, uMk.y, t_.a + (mc_.g - 0.5) * uMk.w) * uMk.z;
  float tn_ = (t_.b - 0.5) * uTex.w + (mc_.b - 0.5) * uFx.y;
  vec3 c_ = diffuseColor.rgb * max(1.0 + tn_, 0.05);
  // luces cálidas y sombras frías, como en un fondo pintado
  c_ *= mix(vec3(0.88, 0.93, 1.12), vec3(1.09, 1.0, 0.88), clamp(0.5 + tn_ * 0.9 + (mc_.r - 0.5) * uFx.y * 2.5, 0.0, 1.0));
  c_ = mix(c_, uC2 * (0.6 + 0.8 * t_.b) * (1.0 + (mc_.b - 0.5) * uFx.y), mk_);
  // relieve: gradiente de superficie (Mikkelsen) con la pendiente leída de la textura
  vec3 n0_ = normal;
  vec2 dh_ = vec2(dot(g_, dxm_), dot(g_, dym_)) * uTex.z;
  vec3 sx_ = -dFdx(vViewPosition); vec3 sy_ = -dFdy(vViewPosition);
  vec3 r1_ = cross(sy_, n0_); vec3 r2_ = cross(n0_, sx_);
  float det_ = dot(sx_, r1_) * faceDirection;
  normal = normalize(abs(det_) * n0_ - sign(det_) * (dh_.x * r1_ + dh_.y * r2_));
  // el toon tiene mesetas planas: se añade sombreado del relieve respecto al sol para que se lea
  c_ *= 1.0 + clamp(dot(normal - n0_, uSunView) * uFx.x, -0.5, 0.7);
  #ifdef STANDARD
    roughnessFactor = clamp(mix(roughnessFactor, uFx.z, mk_) - tn_ * 0.12, 0.03, 1.0);
    metalnessFactor = mix(metalnessFactor, uFx.w, mk_);
  #endif
  #ifdef Y_TRANS
    totalEmissiveRadiance += c_ * uTr.rgb * (uTr.a + smoothstep(-0.3, 0.9, dot(-n0_, uSunView)));
  #endif
  diffuseColor.rgb = c_;
}`;

const MACRO_BY_DEFAULT = 0.22;

// Añade a un material la textura procedural de `d` + stylize().
function surface<T extends THREE.Material>(mat: T, U: Shared, d: Def, rim: number, grainAxis = 0): T {
  stylize(mat, U, rim);
  const base = mat.onBeforeCompile;
  const defines = ((mat as any).defines ??= {});
  if (grainAxis > 0) defines.Y_GRAIN = grainAxis + 1; else if (d.grain) defines.Y_GRAIN = 1;
  if (d.trans) defines.Y_TRANS = '';
  if (d.water) defines.Y_WATER = '';
  const env = d.env ?? 1;
  mat.onBeforeCompile = (s: any, r: any) => {
    base.call(mat, s, r);
    const det = detailTexture(d.tex), mac = detailTexture('macro');
    const ts = d.ts ?? 1, tile = det.userData.tile * ts;
    s.uniforms.tDet = { value: det }; s.uniforms.tMacro = { value: mac };
    // la pendiente se codifica en RG como ±1 = userData.slope; (2 * 127.5/127) deshace el empaquetado
    s.uniforms.uTex = { value: new THREE.Vector4(1 / tile, 1 / mac.userData.tile, (det.userData.slope ?? 0) * d.bump * 2.008, d.tone * 2) };
    s.uniforms.uMk = { value: new THREE.Vector4(d.mask[0], d.mask[1], d.mask[2], 0.25) };
    s.uniforms.uFx = { value: new THREE.Vector4(d.relief, (d.macro ?? MACRO_BY_DEFAULT) * 2, d.rough2 ?? d.rough ?? 1, d.metal2 ?? d.metal ?? 0) };
    s.uniforms.uTr = { value: new THREE.Vector4(...(d.trans ?? [0, 0, 0, 0])) };
    s.uniforms.uC2 = { value: new THREE.Color(d.c2) };
    s.uniforms.uTime = U.time;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n' + VERT_MAIN);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_MAIN);
    if (env !== 1) {
      s.fragmentShader = s.fragmentShader.replace('#include <envmap_physical_pars_fragment>',
        THREE.ShaderChunk.envmap_physical_pars_fragment.replace('return envMapColor.rgb * envMapIntensity;', `return envMapColor.rgb * envMapIntensity * ${env.toFixed(2)};`));
    }
  };
  mat.customProgramCacheKey = () => 'ygs' + rim + '|' + env;
  return mat;
}

export function createMaterials(U: Shared): Mats {
  const grad = gradientMap();
  const build = (name: MatName, color: THREE.ColorRepresentation, grainAxis = 0): THREE.Material => {
    const d = DEFS[name];
    let m: THREE.Material;
    if (d.kind === 't') m = new THREE.MeshToonMaterial({ color, gradientMap: grad });
    else if (d.kind === 's') m = new THREE.MeshStandardMaterial({ color, roughness: d.rough ?? 0.5, metalness: d.metal ?? 0 });
    else m = new THREE.MeshPhysicalMaterial({ color, roughness: d.rough ?? 0.5, metalness: d.metal ?? 0, clearcoat: d.coat ?? 0, clearcoatRoughness: 0.05 });
    m.name = name;
    return surface(m, U, d, d.rim ?? (d.kind === 't' ? 0.3 : 0.15), grainAxis);
  };
  const out = {} as Mats;
  for (const k of Object.keys(BASE) as MatName[]) out[k] = build(k, BASE[k]);
  const cache = new Map<string, THREE.Material>();
  out.tint = (name, color) => {
    const key = name + new THREE.Color(color).getHexString();
    let m = cache.get(key);
    if (!m) { m = build(name, color); cache.set(key, m); }
    return m;
  };
  out.along = (name, axis) => {
    const key = name + '>' + axis;
    let m = cache.get(key);
    if (!m) { m = build(name, BASE[name], axis === 'x' ? 1 : axis === 'y' ? 2 : 3); cache.set(key, m); }
    return m;
  };
  out.glow = (color, intensity = 2.5) => {
    const c = new THREE.Color(color).multiplyScalar(intensity);
    const key = 'glow' + c.r.toFixed(2) + c.g.toFixed(2) + c.b.toFixed(2);
    let m = cache.get(key);
    if (!m) { m = stylize(new THREE.MeshBasicMaterial({ color: c }), U, 0); cache.set(key, m); }
    return m;
  };
  return out;
}
