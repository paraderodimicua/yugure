// GLSL de la tormenta: nubes falsas (tarjetas con ruido animado), lluvia, sombras de monstruos y cuervos.
import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/shaders';

export type StormUniforms = {
  uTime: { value: number };
  uFlash: { value: number };
  uFlashPos: { value: THREE.Vector3 };
  uDanger: { value: number };
};

export type CloudMode = 'WALL' | 'CEIL' | 'POUR' | 'VOID';

const CLOUD_VERT = /* glsl */ `
attribute float aSeed; attribute float aLayer; attribute float aPhase;
uniform float uTime, uPour;
varying vec2 vUv; varying vec3 vW; varying float vSeed, vLayer, vFade;
void main(){
  vUv = uv; vSeed = aSeed; vLayer = aLayer; vFade = 1.0;
  vec3 p = position;
#ifdef WALL
  p.z += sin(p.x * 0.07 + uTime * 0.55 + aSeed * 10.0) * 2.4 * uv.y + sin(p.y * 0.09 - uTime * 0.4 + aSeed * 4.0) * 1.6;
  p.y += sin(p.x * 0.05 + uTime * 0.3 + aSeed * 7.0) * 2.0 * uv.y;
#endif
#ifdef POUR
  float ph = fract(uTime * 0.12 + aPhase);
  p.xy *= 0.45 + ph * 1.25;
  p.z -= ph * 15.0;
  vFade = smoothstep(0.0, 0.12, ph) * smoothstep(1.0, 0.45, ph) * uPour;
#endif
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const CLOUD_FRAG = /* glsl */ `
uniform float uTime, uFlash, uAlpha, uNear, uDanger;
uniform vec3 uFlashPos, uSunCol;
varying vec2 vUv; varying vec3 vW; varying float vSeed, vLayer, vFade;
${NOISE_GLSL}
float fbmN(vec2 p){ float a = 0.5, s = 0.0; for(int i = 0; i < OCT; i++){ s += a * vnoise(p); p = p * 2.03 + 17.3; a *= 0.5; } return s / (1.0 - pow(0.5, float(OCT))); }
void main(){
  float t = uTime;
#ifdef CEIL
  vec2 p = vW.xz / 17.0 + vSeed * 13.0;
#elif defined(VOID)
  vec2 p = vUv * vec2(4.0, 4.4);
  vec2 cq = p - vec2(2.0, 2.0);
  float ang = 0.35 * t + 1.6 / (0.6 + length(cq));
  p = vec2(2.0) + mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * cq;
#elif defined(POUR)
  vec2 p = vW.xy / 5.0 + vSeed * 13.0 + vec2(0.0, -t * 0.35);
#else
  vec2 p = vW.xy / 11.0 + vSeed * 13.0;
#endif
#ifdef WARP
  vec2 q = vec2(fbmN(p * 0.6 + vec2(0.0, -t * 0.16)), fbmN(p * 0.6 + vec2(5.2, 1.3) + t * 0.11));
  p += (q - 0.5) * 3.0;
#else
  p += vec2(sin(p.y * 1.3 + t * 0.5), cos(p.x * 1.1 - t * 0.4)) * 0.35;
#endif
  float n = fbmN(p + vec2(t * 0.05, -t * 0.2));

  float d; vec3 col; float rim = 0.0;
#ifdef CEIL
  float body = smoothstep(1.0, 0.86, vUv.y + (n - 0.5) * 0.22) * smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
  d = body * smoothstep(0.12, 0.5, n + 0.2);
  col = mix(vec3(0.008, 0.005, 0.018), vec3(0.06, 0.03, 0.1), smoothstep(0.4, 0.9, n));
  rim = smoothstep(0.92, 0.99, vUv.y + (n - 0.5) * 0.22) * smoothstep(0.5, 0.9, n);
#elif defined(VOID)
  d = 1.0;
  col = vec3(0.002, 0.001, 0.005) + vec3(0.09, 0.02, 0.13) * pow(n, 3.0) * 1.6;
#elif defined(POUR)
  float b = smoothstep(0.55, 0.15, length((vUv - vec2(0.5, 0.38)) * vec2(1.0, 1.25)));
  d = b * smoothstep(0.25, 0.62, n + b * 0.3) * vFade;
  col = mix(vec3(0.005, 0.003, 0.01), vec3(0.06, 0.03, 0.09), smoothstep(0.4, 0.9, n));
#else
  float top = 0.7 + 0.26 * vnoise(vec2(vW.x * 0.035 + vSeed * 9.0, t * 0.03));
  float yy = vUv.y + (n - 0.5) * 0.5;
  float body = smoothstep(top, top - 0.3, yy) * smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
  d = body * smoothstep(0.3, 0.62, n + body * 0.28);
  col = mix(vec3(0.008, 0.004, 0.016), vec3(0.075, 0.035, 0.11), smoothstep(0.3, 0.9, n));
#ifdef WARP
  // relieve de los bultos: luz desde arriba-delante comparando el ruido desplazado
  float n2 = fbmN(p + vec2(0.0, -0.35) + vec2(t * 0.05, -t * 0.2));
  col *= 0.55 + 1.3 * clamp((n - n2) * 4.0 + 0.5, 0.0, 1.0);
#else
  col *= 0.6 + 1.0 * smoothstep(0.35, 0.8, n);
#endif
  col *= 0.5 + 0.5 * vUv.y;
  rim = smoothstep(0.55, 0.95, n) * smoothstep(top - 0.4, top - 0.02, yy) * (1.0 - vLayer * 0.75);
#endif
#if defined(WALL) || defined(CEIL)
  // relámpagos internos: bolsas de luz que parpadean dentro de la masa
#ifdef CEIL
  vec2 fp = vW.xz; vec2 cs = vec2(40.0, 40.0);
#else
  vec2 fp = vW.xy; vec2 cs = vec2(26.0, 18.0);
#endif
  vec2 id = floor(fp / cs) + vSeed * 7.0;
  float fl = step(0.955 - uDanger * 0.03, fract(sin(dot(id + floor(t * 7.0 + vSeed * 3.0) * 1.37, vec2(127.1, 311.7))) * 43758.5453));
  vec2 lc = fract(fp / cs) - 0.5;
  col += vec3(0.45, 0.32, 1.0) * fl * smoothstep(0.5, 0.0, length(lc)) * n * n * 2.4 * d;
#endif
  col += uSunCol * rim;
  float fd = length(vW - uFlashPos);
  col += vec3(0.6, 0.65, 1.0) * uFlash * (exp(-fd / 40.0) * 1.4 + 0.06) * (0.15 + n * n * 1.6);
  float a = clamp(d * 1.45, 0.0, 1.0) * uAlpha;
  a *= smoothstep(uNear * 0.35, uNear, distance(cameraPosition, vW));
  gl_FragColor = vec4(col, a);
}`;

export function cloudMat(su: StormUniforms, mode: CloudMode, oct: number, warp: boolean) {
  return new THREE.ShaderMaterial({
    defines: { [mode]: 1, OCT: oct, ...(warp ? { WARP: 1 } : {}) },
    uniforms: {
      uTime: su.uTime, uFlash: su.uFlash, uFlashPos: su.uFlashPos, uDanger: su.uDanger,
      uAlpha: { value: 1 }, uNear: { value: mode === 'VOID' ? 0.01 : 16 }, uPour: { value: 0 },
      uSunCol: { value: mode === 'CEIL' ? new THREE.Color(0.9, 0.3, 0.2) : new THREE.Color(1.0, 0.42, 0.2) },
    },
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
    transparent: mode !== 'VOID', depthWrite: mode === 'VOID', side: THREE.DoubleSide, fog: false,
  });
}

/** añade los atributos que espera el shader de nube a una geometría */
export function cloudAttrs(g: THREE.BufferGeometry, seed: number, layer = 0, phase = 0) {
  const n = g.attributes.position.count;
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Float32Array(n).fill(seed), 1));
  g.setAttribute('aLayer', new THREE.Float32BufferAttribute(new Float32Array(n).fill(layer), 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Float32Array(n).fill(phase), 1));
  return g;
}

// Cortina de lluvia colgando de la base de la nube.
export function curtainMat(su: StormUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: su.uTime, uFlash: su.uFlash, uAlpha: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash, uAlpha; varying vec2 vUv; varying vec3 vW;
      ${NOISE_GLSL}
      void main(){
        float h = hash1(vec2(floor(vW.x * 3.0), 3.0));
        float s = fract(vW.y * 0.08 * (0.6 + h) + uTime * (1.6 + h * 1.2) + h * 10.0);
        float streak = smoothstep(0.0, 0.04, s) * smoothstep(0.3, 0.04, s) * step(0.5, h);
        float sheet = vnoise(vec2(vW.x * 0.09 - uTime * 0.25, vW.y * 0.05 + uTime * 0.9));
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(1.0, 0.75, vUv.y);
        float a = (streak * 0.22 + sheet * sheet * 0.22) * edge * uAlpha;
        a *= smoothstep(4.0, 14.0, distance(cameraPosition, vW));
        gl_FragColor = vec4(vec3(0.1, 0.1, 0.16) * (0.5 + uFlash * 1.2), a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
}

// Lluvia alrededor de la cámara: segmentos que caen y se recolocan en una caja que sigue a la cámara (todo en GPU).
export function rainMat(su: StormUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: su.uTime, uFlash: su.uFlash, uCam: { value: new THREE.Vector3() }, uFront: { value: 0 }, uAmt: { value: 0 }, uWind: { value: new THREE.Vector3(1.5, -24, -9) } },
    vertexShader: /* glsl */ `
      attribute vec3 aRnd; attribute float aEnd;
      uniform vec3 uCam, uWind; uniform float uTime, uFront, uAmt; varying float vA;
      void main(){
        vec3 box = vec3(34.0, 22.0, 34.0);
        vec3 vel = uWind * (0.85 + aRnd.y * 0.3);
        vec3 lo = uCam - box * 0.5;
        vec3 p = mod(aRnd * box + vel * uTime - lo, box) + lo;
        vec3 q = (p - uCam) / (box * 0.5);
        vA = uAmt * (1.0 - smoothstep(0.75, 1.0, max(abs(q.x), max(abs(q.y), abs(q.z))))) * smoothstep(uFront - 10.0, uFront + 2.0, p.z);
        p -= vel * 0.032 * aEnd;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `uniform float uFlash; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.55, 0.6, 0.78) * (0.7 + uFlash * 2.5), vA * 0.42); }`,
    transparent: true, depthWrite: false, fog: false,
  });
}

// Sombra viva (colosos, garras): casi negra, borde violeta humeante, se deshace por abajo.
export function shadowMat(su: StormUniforms, fadeY0: number, fadeY1: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: su.uTime, uFlash: su.uFlash, uFlashPos: su.uFlashPos, uFade: { value: new THREE.Vector2(fadeY0, fadeY1) } },
    vertexShader: /* glsl */ `
      varying vec3 vN, vW;
      void main(){
        mat4 m = modelMatrix;
#ifdef USE_INSTANCING
        m = m * instanceMatrix;
#endif
        vec4 w = m * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash; uniform vec2 uFade; uniform vec3 uFlashPos; varying vec3 vN, vW;
      ${NOISE_GLSL}
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(normalize(vN), v)), 2.0);
        float n = vnoise(vW.xy * 0.22 + vec2(vW.z * 0.1, uTime * 0.5)) * 0.6 + vnoise(vW.xy * 0.9 - uTime * 0.8) * 0.4;
        vec3 col = vec3(0.008, 0.004, 0.016) + vec3(0.09, 0.025, 0.14) * fres * (0.4 + n);
        col += vec3(0.5, 0.55, 1.0) * uFlash * (0.01 + fres * 0.5) * exp(-length(vW - uFlashPos) / 70.0);
        float a = smoothstep(uFade.x, uFade.y, vW.y + (n - 0.5) * 4.0);
        a *= 1.0 - smoothstep(0.55, 1.0, fres) * smoothstep(0.35, 0.75, n);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: true, fog: false,
  });
}

// Cuervos: aleteo en el vértice según la distancia al eje del cuerpo.
export function crowMat(su: StormUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: su.uTime, uFlash: su.uFlash },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; varying float vL;
      void main(){
        vec3 p = position;
        float ax = abs(p.x);
        p.y += sin(uTime * 13.0 * (0.8 + aSeed * 0.45) + aSeed * 40.0) * pow(ax, 1.15) * 0.95;
        vL = ax;
        mat4 m = modelMatrix;
#ifdef USE_INSTANCING
        m = m * instanceMatrix;
#endif
        gl_Position = projectionMatrix * viewMatrix * m * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `uniform float uFlash; varying float vL; void main(){ gl_FragColor = vec4(vec3(0.012, 0.01, 0.02) + vec3(0.2, 0.22, 0.32) * uFlash * vL, 1.0); }`,
    side: THREE.DoubleSide, fog: false,
  });
}

// Polvo del portón: puntos que salen despedidos en función del tiempo desde el golpe.
export function dustMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTau: { value: -1 }, uScale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute vec3 aVel; attribute float aSize; uniform float uTau, uScale; varying float vA;
      void main(){
        float tt = max(uTau, 0.0);
        float k = (1.0 - exp(-tt * 1.6)) / 1.6;
        vec3 p = position + aVel * k + vec3(0.0, 0.25 * tt, 0.0);
        vA = uTau < 0.0 ? 0.0 : smoothstep(0.0, 0.08, tt) * (1.0 - smoothstep(1.2, 4.5, tt));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * (1.0 + tt * 1.2) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if(r > 0.5) discard; gl_FragColor = vec4(vec3(0.3, 0.22, 0.2), vA * smoothstep(0.5, 0.0, r) * 0.3); }`,
    transparent: true, depthWrite: false, fog: false,
  });
}
