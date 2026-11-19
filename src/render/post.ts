import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Rayos crepusculares: desenfoque radial de lo más brillante hacia el sol.
const GodRays = {
  uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uVis: { value: 1 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uVis; varying vec2 vUv;
    void main(){
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec2 delta = (uSun - vUv) / 28.0 * 0.92;
      float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 uv = vUv + delta * j;
      float decay = 1.0; vec3 acc = vec3(0.0);
      for(int i = 0; i < 28; i++){
        uv += delta;
        vec3 s = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
        acc += min(s, vec3(12.0)) * smoothstep(2.1, 6.0, max(max(s.r, s.g), s.b)) * decay;
        decay *= 0.94;
      }
      gl_FragColor = vec4(base + acc / 28.0 * 0.6 * uVis, 1.0);
    }`,
};

// Acabado: destello anamórfico, aberración, mapeo de tonos fílmico, gradación, viñeta y grano.
const Finish = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uExposure: { value: 0.72 }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uVis: { value: 1 },
    // tormenta (src/game/storm.ts): dentro 0..1, peligro 0..1, herida 0..1 (1 - vida), destello de rayo, gotas en pantalla
    uStorm: { value: 0 }, uDanger: { value: 0 }, uHurt: { value: 0 }, uFlash: { value: 0 }, uRain: { value: 0 },
    // viaje (src/game/run.ts): intensidad psicodélica, giro de tono, gradación del bioma, destello de dopamina, velocidad
    uTrip: { value: 0 }, uHue: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uPulse: { value: 0 }, uSpeedFx: { value: 0 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uExposure, uVis; uniform vec2 uSun; varying vec2 vUv;
    uniform float uStorm, uDanger, uHurt, uFlash, uRain, uSmoke, uBeat;
    float h12(vec2 p){ return fract(sin(dot(p, vec2(91.7, 37.3))) * 43758.5453); }
    float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
    uniform float uTrip, uHue, uPulse, uSpeedFx; uniform vec3 uTint;
    vec3 hueRot(vec3 c, float a){
      const mat3 toY = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
      const mat3 toR = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
      vec3 y = toY * c; float h = atan(y.z, y.y) + a; float ch = length(y.yz);
      return toR * vec3(y.x, ch * cos(h), ch * sin(h));
    }
    vec3 rainbow(float t){ return 0.5 + 0.5 * cos(6.2832 * (t + vec3(0.0, 0.33, 0.67))); }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    // gota que resbala por la lente: desplazamiento de uv en una celda
    vec2 lensDrop(vec2 uv, vec2 cells, float t, float seed){
      vec2 g = uv * cells; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
      float h = h12(id + seed);
      if(h < 0.5) return vec2(0.0);
      float ph = fract(t * (0.12 + h * 0.25) + h * 7.0);
      vec2 dp = vec2((h12(id + 3.1) - 0.5) * 0.6 + sin(ph * 9.0 + h * 6.0) * 0.04, 0.45 - ph * 1.1);
      vec2 dv = f - dp;
      float drop = smoothstep(0.16, 0.05, length(dv * vec2(1.0, 0.75)));
      float trail = smoothstep(0.035, 0.0, abs(dv.x)) * step(0.0, dv.y) * smoothstep(0.55, 0.0, dv.y) * 0.5;
      return (dv * drop * 0.9 + vec2(0.0, trail * 0.02)) / cells;
    }
    void main(){
      vec2 suv = 0.5 + (vUv - 0.5) * (1.0 - 0.014 * uBeat);
      if(uRain > 0.001){
        vec2 a = vec2(1.78, 1.0);
        suv += (lensDrop(vUv * a, vec2(7.0, 4.0), uTime, 1.0) + lensDrop(vUv * a, vec2(16.0, 9.0), uTime * 1.3, 7.0) * 0.6) * uRain * 1.6;
      }
      // ondulación del viaje: la imagen respira y se mece
      float tw = uTrip * (0.7 + 0.3 * sin(uTime * 0.7));
      suv += vec2(sin(uTime * 0.55), cos(uTime * 0.41)) * 0.006 * tw + vec2(sin(vUv.y * 5.0 + uTime * 0.9), 0.0) * 0.0015 * tw;
      vec2 cc = vUv - 0.5;
      float r2 = dot(cc, cc);
      suv -= cc * r2 * 0.03 * sin(uTime * 0.7) * tw;
      vec2 ca = cc * r2 * (0.004 + 0.006 * tw + 0.02 * uSpeedFx);
      vec3 c = vec3(texture2D(tDiffuse, suv + ca).r, texture2D(tDiffuse, suv).g, texture2D(tDiffuse, suv - ca).b);
      // destello horizontal
      vec3 streak = vec3(0.0);
      for(int i = -6; i <= 6; i++){
        float f = float(i);
        vec3 s = texture2D(tDiffuse, vUv + vec2(f * 0.024, 0.0)).rgb;
        streak += max(s - 4.0, 0.0) * (1.0 - abs(f) / 7.0);
      }
      c += min(streak / 13.0, vec3(3.0)) * vec3(0.55, 0.7, 1.15) * 0.22;
      if (tw > 0.01) c = mix(c, texture2D(tDiffuse, suv + vec2(0.007 * sin(uTime * 0.37), 0.003 * cos(uTime * 0.29)) * tw).rgb, 0.22 * tw);
      // desenfoque radial de velocidad
      if (uSpeedFx > 0.01) {
        vec3 zb = vec3(0.0);
        for (int i = 1; i <= 5; i++) zb += texture2D(tDiffuse, suv - cc * float(i) * 0.012 * uSpeedFx).rgb;
        c = mix(c, zb / 5.0, clamp(uSpeedFx * smoothstep(0.02, 0.2, r2), 0.0, 0.8));
      }
      // reflejos fantasma de la lente
      vec2 g = uSun + (vec2(0.5) - uSun) * 1.55;
      float gd = length((vUv - g) * vec2(1.78, 1.0));
      c += vec3(0.9, 0.5, 0.25) * smoothstep(0.075, 0.06, gd) * 0.045 * uVis;
      g = uSun + (vec2(0.5) - uSun) * 2.3;
      gd = length((vUv - g) * vec2(1.78, 1.0));
      c += vec3(0.3, 0.6, 0.9) * smoothstep(0.13, 0.115, gd) * 0.025 * uVis;

      c = aces(c * uExposure);
      // gradación: sombras hacia violeta, luces cálidas, contraste suave
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += vec3(0.018, 0.006, 0.05) * (1.0 - l) * (1.0 - l);
      c = mix(vec3(l), c, 1.22);
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.42);
      c *= mix(vec3(1.0), vec3(1.04, 1.0, 0.94), smoothstep(0.4, 1.0, l));
      // bioma y viaje: gradación, tono que gira, saturación y arcoíris en las luces
      c *= uTint;
      c = max(hueRot(c, uHue), 0.0);
      float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l2), c, 1.0 + 0.08 * tw);
      c += c * smoothstep(0.45, 1.0, l2) * vec3(0.16, 0.1, 0.04) * tw;
      c += vec3(1.0, 0.82, 0.55) * uPulse * 0.22 * (1.0 - r2 * 1.5);
      // tormenta: desatura y oscurece, destello frío del rayo, viñeta roja pulsante según la herida
      float ls = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, vec3(ls) * vec3(0.86, 0.9, 1.1), clamp(uStorm * 0.6 + uDanger * 0.2, 0.0, 1.0));
      c *= 1.0 - 0.45 * uStorm - 0.1 * uDanger - uStorm * 0.45 * clamp(r2 * 2.6, 0.0, 1.0);
      c = mix(c, c * c * 1.3, uStorm * 0.35);
      c += vec3(0.75, 0.8, 1.0) * uFlash * 0.16;
      float hp = 0.55 + 0.45 * sin(uTime * (3.0 + 5.0 * uHurt));
      float hv = smoothstep(0.3, 0.85, length(cc * vec2(1.25, 1.0))) * uHurt * (0.45 + 0.55 * hp);
      c = mix(c, c * vec3(1.1, 0.25, 0.25) + vec3(0.2, 0.0, 0.015), clamp(hv * 1.2, 0.0, 0.75));
      if(uSmoke > 0.001){
        vec2 sp = cc * vec2(1.78, 1.0);
        float an = atan(sp.y, sp.x);
        float sn = vn2(vec2(an * 3.0 + uTime * 0.25, length(sp) * 5.0 - uTime * 0.9)) * 0.6 + vn2(sp * 9.0 + vec2(uTime * 0.4, -uTime * 0.7)) * 0.4;
        float ed = length(cc * vec2(1.15, 1.0)) + (sn - 0.5) * 0.22;
        float sm = smoothstep(0.62 - 0.22 * uSmoke - 0.05 * uBeat, 0.76, ed) * uSmoke;
        c = mix(c, vec3(0.012, 0.004, 0.02), clamp(sm, 0.0, 0.95));
      }
      // ansiedad continua al acercarse la tormenta: visión de túnel, color apagado y latido rojizo en los bordes
      float anx = smoothstep(0.3, 1.0, uDanger) * (1.0 - uStorm * 0.5);
      float edg = smoothstep(0.18, 0.78, length(cc * vec2(1.2, 1.0)));
      float la = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, vec3(la) * vec3(0.95, 0.92, 1.0), anx * 0.3);
      c *= 1.0 - anx * 0.38 * edg;
      c += vec3(0.16, 0.0, 0.03) * anx * uBeat * edg;
      c *= 1.0 - 0.42 * pow(length(cc * vec2(1.05, 1.0)) * 1.32, 2.6);
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      float n = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * 0.022;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const rays = new ShaderPass(GodRays);
  composer.addPass(rays);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.20, 0.8, 1.9);
  composer.addPass(bloom);
  const finish = new ShaderPass(Finish);
  composer.addPass(finish);

  const v = new THREE.Vector3();
  function render(sunDir: THREE.Vector3, t: number) {
    v.copy(sunDir).multiplyScalar(1000).add(camera.position).project(camera);
    const front = v.z < 1 ? 1 : 0;
    const off = Math.max(Math.abs(v.x), Math.abs(v.y));
    const vis = front * (1 - THREE.MathUtils.smoothstep(off, 1.0, 1.6));
    for (const p of [rays, finish]) {
      (p.uniforms.uSun.value as THREE.Vector2).set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
      p.uniforms.uVis.value = vis;
    }
    finish.uniforms.uTime.value = t;
    composer.render();
  }
  return { composer, bloom, rays, finish, render };
}
