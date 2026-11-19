// GLSL de la dimensión oscura: piedra con luz de contorno fría, cielo con grietas, abismo, humo,
// ceniza, sombras voladoras, ojos, orbes y partículas. Niebla propia negro-violeta (no usa la del atardecer).
import * as THREE from 'three';
import { NOISE_GLSL } from '../../render/shaders';

export type DimU = { uTime: { value: number }; uFog: { value: number }; uExit: { value: THREE.Vector3 } };

const FOG = /* glsl */ `
uniform float uFog;
vec3 fogCol(vec3 r){
  vec3 lo = vec3(0.032, 0.017, 0.048), mid = vec3(0.013, 0.010, 0.021), hi = vec3(0.003, 0.0025, 0.006);
  return r.y < 0.0 ? mix(mid, lo, smoothstep(0.0, -0.5, r.y)) : mix(mid, hi, smoothstep(0.0, 0.45, r.y));
}
vec3 applyFog(vec3 c, vec3 w){ vec3 d = w - cameraPosition; float l = length(d); return mix(c, fogCol(d / l), 1.0 - exp(-l * uFog)); }
`;

const INST_VS = /* glsl */ `
  mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = m * instanceMatrix;
#endif
`;

/** Piedra / madera / laca: textura por proyección, cenizas encima, venas violetas, contorno frío. */
export function solidMat(u: DimU) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime, uFog: u.uFog, uExit: u.uExit },
    vertexShader: /* glsl */ `
      varying vec3 vW, vN, vC;
      void main(){
        ${INST_VS}
        vec4 w = m * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal);
        vC = vec3(0.26, 0.25, 0.31);
#ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
#endif
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uExit; varying vec3 vW, vN, vC;
      ${NOISE_GLSL}
      ${FOG}
      void main(){
        vec3 n = normalize(vN); vec3 d = vW - cameraPosition; float dist = length(d); vec3 v = -d / dist;
        vec3 an = abs(n);
        vec2 tp = an.y > 0.6 ? vW.xz : (an.x > an.z ? vW.zy : vW.xy);
        float tx = vnoise(tp * 1.7) * 0.55 + vnoise(tp * 5.3) * 0.3 + vnoise(tp * 0.4) * 0.15;
        vec3 alb = vC * (0.55 + 0.9 * tx);
        float top = smoothstep(0.55, 0.9, n.y);
        alb = mix(alb, vec3(0.34, 0.33, 0.38) * (0.65 + 0.6 * tx), top * 0.5);
        vec3 L = normalize(vec3(-0.25, 0.55, -0.8));
        float dif = max(dot(n, L), 0.0);
        vec3 lit = vec3(0.035, 0.033, 0.05) + dif * vec3(0.22, 0.21, 0.32) + max(-n.y, 0.0) * vec3(0.14, 0.05, 0.2) + top * vec3(0.05, 0.055, 0.08);
        vec3 col = alb * lit * 1.6;
        float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col += fr * vec3(0.30, 0.46, 1.0) * 0.5 * (0.35 + 0.65 * smoothstep(-0.3, 0.6, n.y + 0.3));
        float vn = abs(vnoise(tp * 0.9 + 3.1) - 0.5);
        float vein = smoothstep(0.03, 0.0, vn) * (1.0 - top) * smoothstep(0.3, 0.55, vnoise(tp * 0.23 + 7.0));
        col += vein * vec3(0.45, 0.2, 0.85) * (0.7 + 0.5 * sin(uTime * 1.7 + tp.x * 0.3 + tp.y * 0.2));
        vec3 e = uExit - vW; float ed = length(e);
        col += alb * vec3(1.7, 0.95, 0.42) * max(dot(n, e / ed), 0.0) * 40.0 / (ed * ed + 30.0);
        col += fr * vec3(1.4, 0.8, 0.35) * 25.0 / (ed * ed + 60.0);
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }`,
  });
}

/** Cielo negro con nubes de materia y grietas de luz violeta lejanas. */
export function skyMat(u: DimU) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime, uFog: u.uFog },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vW;
      ${NOISE_GLSL}
      ${FOG}
      void main(){
        vec3 r = normalize(vW - cameraPosition);
        vec3 col = fogCol(r);
        vec2 uv = r.xz / (abs(r.y) + 0.22) * 1.6;
        float cl = fbm(uv * 0.6 + uTime * 0.004);
        col += vec3(0.014, 0.008, 0.024) * cl * smoothstep(-0.1, 0.3, r.y);
        vec2 w = uv * 0.9 + vec2(fbm(uv * 0.5), fbm(uv * 0.5 + 5.0)) * 1.4;
        float c = abs(vnoise(w * 1.5) - 0.5);
        float mask = smoothstep(0.6, 0.82, vnoise(uv * 0.25 + 11.0)) * smoothstep(0.02, 0.15, r.y) * smoothstep(0.9, 0.5, r.y);
        float fl = 0.7 + 0.3 * sin(uTime * 2.3 + uv.x * 3.0) * sin(uTime * 0.7 + uv.y * 2.0);
        col += (smoothstep(0.011, 0.0, c) * vec3(1.1, 0.65, 2.1) + smoothstep(0.09, 0.0, c) * vec3(0.06, 0.025, 0.12)) * mask * fl;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthTest: false, depthWrite: false,
  });
}

/** Abismo: remolino violeta muy tenue allá abajo. */
export function abyssMat(u: DimU) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime },
    vertexShader: `varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vW; varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vW.xz * 0.012; float a = uTime * 0.03; p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
        float n = fbm(p * 2.0 + fbm(p * 3.0 - uTime * 0.02));
        float rad = 1.0 - smoothstep(0.15, 0.5, length(vUv - 0.5));
        vec3 col = vec3(0.06, 0.02, 0.1) * smoothstep(0.35, 0.85, n) * rad;
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

/** Columnas de humo: cilindros abiertos con ruido que sube. */
export function smokeMat(u: DimU) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime, uFog: u.uFog },
    vertexShader: `varying vec2 vUv; varying vec3 vW, vN; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv; varying vec3 vW, vN;
      ${NOISE_GLSL}
      ${FOG}
      void main(){
        float n = fbm(vec2(vUv.x * 7.0, vUv.y * 4.0 - uTime * 0.07) + vec2(0.0, vW.x * 0.01));
        float a = smoothstep(0.3, 0.75, n) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        vec3 v = normalize(cameraPosition - vW);
        a *= pow(abs(dot(normalize(vN), v)), 1.3) * 0.8;
        vec3 col = vec3(0.035, 0.03, 0.05) + vec3(0.06, 0.025, 0.1) * (1.0 - vUv.y) * n;
        gl_FragColor = vec4(applyFog(col, vW) * 1.15, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

/** Ceniza alrededor de la cámara (envuelta en una caja), algunas brasas violetas. */
export function ashMat(u: DimU) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime, uCam: { value: new THREE.Vector3() }, uSize: { value: 90 } },
    vertexShader: /* glsl */ `
      attribute float aR; uniform float uTime, uSize; uniform vec3 uCam; varying float vA, vE;
      void main(){
        vec3 B = vec3(44.0, 26.0, 44.0);
        vec3 p = position + vec3(sin(uTime * 0.3 + aR * 20.0) * 1.5, -uTime * (0.3 + aR * 0.5), uTime * 0.7 + cos(uTime * 0.2 + aR * 9.0));
        p = mod(p - uCam + B * 0.5, B) - B * 0.5 + uCam;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vE = step(0.9, aR);
        gl_PointSize = uSize * (0.35 + aR * 0.6 + vE * 0.4) / -mv.z;
        vA = smoothstep(22.0, 6.0, length(p - uCam)) * smoothstep(0.5, 2.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA, vE; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
      vec3 c = mix(vec3(0.22, 0.21, 0.26), vec3(1.4, 0.6, 2.2), vE); gl_FragColor = vec4(c, vA * smoothstep(0.5, 0.1, r) * mix(0.55, 0.9, vE)); }`,
    transparent: true, depthWrite: false,
  });
}

/** Sombras vivas (espectros, peces, manos, cuervos, cuerpo de los ojos): onda en el vértice y borde violeta. */
export function wispMat(u: DimU, wave: number, flap: number, freq: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime, uFog: u.uFog, uWave: { value: wave }, uFlap: { value: flap }, uFreq: { value: freq } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uWave, uFlap, uFreq; varying vec3 vW, vN;
      void main(){
        vec3 p = position;
        float s = aSeed;
        p.x += sin(uTime * uFreq + p.z * 1.6 + s * 30.0) * uWave * max(p.z, 0.0);
        p.y += sin(uTime * uFreq * 2.0 + s * 40.0) * uFlap * pow(abs(p.x), 1.15);
        ${INST_VS}
        vec4 w = m * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vW, vN;
      ${NOISE_GLSL}
      ${FOG}
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(normalize(vN), v)), 2.0);
        float n = vnoise(vW.xy * 0.4 + vec2(vW.z * 0.2, uTime * 0.6)) * 0.6 + vnoise(vW.zy * 1.3 - uTime) * 0.4;
        vec3 col = vec3(0.004, 0.003, 0.008) + vec3(0.14, 0.06, 0.26) * fres * (0.4 + n);
        float a = 1.0 - smoothstep(0.5, 1.0, fres) * smoothstep(0.3, 0.7, n);
        gl_FragColor = vec4(mix(col, fogCol(-v), (1.0 - exp(-length(vW - cameraPosition) * uFog)) * 0.8), a);
      }`,
    transparent: true, side: THREE.DoubleSide,
  });
}

/** Iris de los ojos-torreta: rendija oscura, brillo según aCharge (0..1). */
export function irisMat(u: DimU) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime },
    vertexShader: /* glsl */ `
      attribute float aCharge; varying float vC; varying vec3 vL;
      void main(){ vC = aCharge; vL = position; ${INST_VS} gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying float vC; varying vec3 vL;
      void main(){
        float idle = 0.35 + 0.15 * sin(uTime * 2.0 + vL.y * 3.0);
        float k = max(idle * 0.3, vC);
        vec3 col = mix(vec3(0.35, 0.12, 0.5), vec3(2.8, 1.7, 3.6), k) * (vC > 0.0 ? 1.0 + 0.4 * sin(uTime * 40.0) : 1.0);
        float slit = smoothstep(0.09 + 0.12 * vC, 0.03, abs(vL.x)) * step(vL.z, 0.0);
        col *= 1.0 - slit * (0.92 - vC * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Orbe de oscuridad: núcleo negro, borde violeta brillante. */
export function orbMat(u: DimU) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime },
    vertexShader: /* glsl */ `varying vec3 vW, vN; void main(){ ${INST_VS} vec4 w = m * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vW, vN;
      void main(){
        float fr = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW)));
        float fl = 0.8 + 0.2 * sin(uTime * 30.0 + vW.y * 9.0);
        gl_FragColor = vec4(vec3(0.01, 0.0, 0.02) + vec3(1.6, 0.6, 2.8) * pow(fr, 2.2) * fl, 1.0);
      }`,
  });
}

/** Partículas de CPU (estelas, estallidos, chispas, halos): color y tamaño por partícula, aditivas. */
export function partMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 } },
    vertexShader: /* glsl */ `
      attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC;
      void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vC; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vC.rgb * vC.a * smoothstep(0.5, 0.0, r), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/** Anillo de energía: vetas que fluyen por el toro (cálido o violeta). */
export function ringMat(t: { value: number }, a: THREE.Color, b: THREE.Color, dark: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: t, uA: { value: a }, uB: { value: b }, uDark: { value: dark } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uDark; uniform vec3 uA, uB; varying vec2 vUv; varying vec3 vN, vW;
      ${NOISE_GLSL}
      void main(){
        float s = vnoise(vec2(vUv.x * 40.0 - uTime * 2.5, vUv.y * 3.0)) * 0.6 + vnoise(vec2(vUv.x * 90.0 + uTime * 4.0, vUv.y * 6.0)) * 0.4;
        float fr = 1.0 - abs(dot(vN, normalize(cameraPosition - vW)));
        vec3 col = mix(uA, uB, smoothstep(0.45, 0.8, s)) * (1.0 - uDark * (1.0 - fr));
        col += uB * pow(smoothstep(0.62, 0.9, s), 2.0) * 1.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Disco interior de portal: remolino polar con ondas (distorsión falsa). warm=1 salida dorada, 0 entrada oscura. */
export function vortexMat(t: { value: number }, warm: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: t, uWarm: { value: warm } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uWarm; varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
        float dir = uWarm > 0.5 ? -1.0 : 1.0;
        float sw = a + dir * (uTime * 0.9) + log(r + 0.05) * 2.4;
        float arms = fbm(vec2(cos(sw) * 2.0 + r * 3.0, sin(sw) * 2.0 - uTime * 0.6 * dir));
        float rip = 0.5 + 0.5 * sin(r * 22.0 - uTime * 5.0 * dir + arms * 4.0);
        vec3 col;
        if (uWarm > 0.5) {
          col = mix(vec3(1.4, 0.55, 0.15), vec3(3.2, 2.2, 1.1), smoothstep(0.9, 0.0, r) * (0.6 + 0.4 * arms));
          col *= 0.75 + 0.35 * rip; col += vec3(3.0, 2.4, 1.6) * smoothstep(0.35, 0.0, r);
        } else {
          col = mix(vec3(0.0), vec3(0.75, 0.25, 1.4), smoothstep(0.4, 0.75, arms) * smoothstep(0.05, 0.7, r));
          col += vec3(0.25, 0.08, 0.45) * rip * smoothstep(0.2, 0.9, r) * 0.6;
        }
        gl_FragColor = vec4(col, smoothstep(1.0, 0.86, r));
      }`,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
}

/** Halo plano con caída radial (aditivo). */
export function haloMat(color: THREE.Color, power: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: color }, uP: { value: power } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uC; uniform float uP; varying vec2 vUv; void main(){ float r = length(vUv * 2.0 - 1.0); gl_FragColor = vec4(uC * pow(max(0.0, 1.0 - r), uP), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/** Motas en espiral por GPU: dir=-1 succión hacia el centro, 1 expulsión. */
export function spiralMat(t: { value: number }, dir: number, a: THREE.Color, b: THREE.Color, size: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: t, uDir: { value: dir }, uA: { value: a }, uB: { value: b }, uSize: { value: size } },
    vertexShader: /* glsl */ `
      attribute vec3 aP; uniform float uTime, uDir, uSize; varying float vA, vK;
      void main(){
        float k = fract(uTime * (0.18 + aP.z * 0.2) + aP.y);
        float kk = uDir < 0.0 ? 1.0 - k : k;
        float r = mix(0.3, 2.6 + aP.z * 4.5, pow(kk, 0.8));
        float ang = aP.x * 6.2832 + uDir * k * 5.0;
        vec3 p = vec3(cos(ang) * r, sin(ang) * r, sin(aP.x * 40.0) * kk * 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = smoothstep(0.0, 0.15, k) * smoothstep(1.0, 0.8, k); vK = aP.z;
        gl_PointSize = uSize * (0.5 + aP.z) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uA, uB; varying float vA, vK; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(mix(uA, uB, step(0.85, vK)) * vA * smoothstep(0.5, 0.0, r), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
