import * as THREE from 'three';
import { SKY_GLSL, NOISE_GLSL } from './shaders';
import type { Shared } from '../stage';

export function createSky(U: Shared) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: { uSunDir: U.sunDir, uTime: U.time },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform vec3 uSunDir; uniform float uTime;
      ${SKY_GLSL}
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = skyBase(d, uSunDir);
        float sd = dot(d, uSunDir);
        // cirros altos, estirados, encendidos por el sol
        if(d.y > 0.01){
          vec2 p = d.xz / (d.y + 0.08);
          float n = fbm(vec2(p.x * 0.55 + uTime * 0.004, p.y * 1.7));
          float n2 = fbm(p * 3.1 + 7.0);
          float ci = smoothstep(0.46, 0.78, n) * (0.45 + 0.55 * n2);
          ci *= smoothstep(0.02, 0.2, d.y) * (1.0 - 0.6 * smoothstep(0.6, 1.0, d.y));
          float sunward = pow(max(sd, 0.0), 3.0);
          vec3 cc = mix(vec3(0.85, 0.50, 0.66), vec3(2.0, 0.95, 0.42), sunward);
          c = mix(c, cc, ci * 0.36 * (1.0 - 0.5 * smoothstep(0.25, 0.6, d.y)));
        }
        // primeras estrellas en el cenit
        vec2 sp = d.xz / (abs(d.y) + 0.25) * 240.0;
        float st = step(0.9975, hash1(floor(sp))) * smoothstep(0.75, 0.2, length(fract(sp) - 0.5) * 2.0);
        c += st * 0.9 * smoothstep(0.4, 0.9, d.y);
        // disco solar
        c += vec3(22.0, 13.0, 5.5) * smoothstep(0.99988, 0.99994, sd);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10000, 48, 24), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

// Cúmulos pintados: carteles enormes con forma y luz procedurales.
// [azimut relativo al sol (grados), ancho, alto, distancia, semilla]
const CLOUDS: [number, number, number, number, number][] = [
  [-27, 4600, 2900, 6400, 1.3],
  [-52, 3200, 1500, 6800, 2.7],
  [-12, 2200, 900, 7200, 3.9],
  [7, 2700, 620, 7400, 5.1],
  [24, 3400, 1900, 6600, 6.4],
  [44, 2600, 1100, 7000, 7.8],
  [66, 3800, 2300, 6500, 9.2],
  [-78, 3600, 2100, 6600, 10.5],
  [-100, 2600, 1200, 7000, 11.9],
  [92, 2400, 1000, 7100, 13.1],
];

export function createClouds(U: Shared) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  const items: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; az: number; dist: number; w: number; h: number }[] = [];

  for (const [az, w, h, dist, seed] of CLOUDS) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSunDir: U.sunDir, uTime: U.time,
        uSeed: { value: seed }, uAspect: { value: w / h },
        uSun2D: { value: new THREE.Vector2(1, 0) }, uSunNear: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vWPos;
        void main(){
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vWPos;
        uniform vec3 uSunDir; uniform float uTime, uSeed, uAspect, uSunNear; uniform vec2 uSun2D;
        ${SKY_GLSL}
        ${NOISE_GLSL}
        float bumps(vec2 p){
          return (1.0 - cell(p)) * 0.55 + (1.0 - cell(p * 2.1 + 3.7)) * 0.30 + (1.0 - cell(p * 4.3 + 9.1)) * 0.15;
        }
        float env(vec2 p){
          vec2 q = vec2(p.x / uAspect, p.y);
          float e = 1.0 - length(vec2(q.x * 1.08, (q.y - 0.04) * 1.06));
          return e + vnoise(vec2(p.x * 1.4 + uSeed * 13.0, uSeed)) * 0.42 - 0.26;
        }
        vec2 off(){ return uSeed * 31.0 + vec2(uTime * 0.004, 0.0); }
        // silueta: coliflor con detalle fino
        float dens(vec2 p){ return env(p) * 1.1 + (bumps(p * 2.0 + off()) - 0.62) * 0.8; }
        // volumen para la luz: solo los bultos grandes, suave
        float vol(vec2 p){
          vec2 s = p * 2.0 + off();
          return env(p) * 1.1 + ((1.0 - cell(s)) * 0.7 + (1.0 - cell(s * 0.5 + 5.0)) * 0.5 - 0.7) * 0.9;
        }
        void main(){
          vec2 p = vec2((vUv.x * 2.0 - 1.0) * uAspect, vUv.y);
          float d = dens(p);
          float a = smoothstep(0.0, 0.04, d) * smoothstep(0.0, 0.12, vUv.y) * smoothstep(-0.22, -0.08, env(p));
          if(a < 0.004) discard;
          float v0 = vol(p), v1 = vol(p + uSun2D * 0.16);
          float lit = clamp(0.42 + (v0 - v1) * 2.4, 0.0, 1.0);
          // la cara al sol del contorno siempre se enciende
          lit = max(lit, (1.0 - smoothstep(0.0, 0.30, dens(p + uSun2D * 0.10))) * 0.95);
          lit = mix(lit, smoothstep(0.30, 0.70, lit), 0.5);
          lit *= 0.35 + 0.65 * smoothstep(0.0, 0.5, vUv.y);
          lit *= 1.0 - 0.6 * uSunNear;
          float depth = clamp(d * 1.4, 0.0, 1.0);
          vec3 shadow = mix(vec3(0.40, 0.32, 0.60), vec3(0.19, 0.19, 0.43), depth * 0.6 + (1.0 - vUv.y) * 0.3);
          vec3 c = mix(shadow, vec3(1.30, 0.70, 0.38), lit);
          // borde plateado a contraluz
          float edge = 1.0 - smoothstep(0.0, 0.16, d);
          c += vec3(2.6, 1.6, 0.8) * edge * uSunNear * 1.1;
          // perspectiva aérea: la base se disuelve en la bruma
          vec3 dir = normalize(vWPos - cameraPosition);
          c = mix(c, hazeColor(dir, uSunDir), 0.10 + 0.55 * (1.0 - smoothstep(0.0, 0.38, vUv.y)));
          gl_FragColor = vec4(c, a);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(w, h, 1);
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    group.add(mesh);
    items.push({ mesh, mat, az, dist, w, h });
  }

  const tmp = new THREE.Vector3(), right = new THREE.Vector3(), ctr = new THREE.Vector3();
  function update(cam: THREE.Camera, t: number) {
    const sun = U.sunDir.value;
    const sunAz = Math.atan2(sun.x, -sun.z);
    for (const it of items) {
      const a = sunAz + THREE.MathUtils.degToRad(it.az) + t * 0.00025;
      it.mesh.position.set(cam.position.x + Math.sin(a) * it.dist, -140, cam.position.z - Math.cos(a) * it.dist);
      const ry = Math.atan2(cam.position.x - it.mesh.position.x, cam.position.z - it.mesh.position.z);
      it.mesh.rotation.y = ry;
      right.set(Math.cos(ry), 0, -Math.sin(ry));
      ctr.copy(it.mesh.position); ctr.y += it.h * 0.5;
      tmp.copy(sun).multiplyScalar(it.dist).add(cam.position).sub(ctr);
      (it.mat.uniforms.uSun2D.value as THREE.Vector2).set(tmp.dot(right), tmp.y).normalize();
      tmp.copy(ctr).sub(cam.position).normalize();
      it.mat.uniforms.uSunNear.value = Math.pow(Math.max(tmp.dot(sun), 0), 5);
    }
  }
  return { group, update };
}
