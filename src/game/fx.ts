// Partículas ligeras del juego: polvo de aterrizaje, estallidos de potenciadores, viento de rescate,
// vapor de fideos. Un único Points con búfer circular; sin reservas por fotograma.
import * as THREE from 'three';

export type Burst = {
  pos: THREE.Vector3;
  count: number;
  color: THREE.ColorRepresentation;
  speed?: number;
  up?: number;
  size?: number;
  life?: number;
  glow?: boolean;
  spread?: number;
  gravity?: number;
  vel?: THREE.Vector3;
};

export function createFx() {
  const N = 900;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const life = new Float32Array(N), max = new Float32Array(N), size = new Float32Array(N), grav = new Float32Array(N), glow = new Float32Array(N);
  const alpha = new Float32Array(N);
  const g = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aCol = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  const aSize = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const aAlpha = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  const aGlow = new THREE.BufferAttribute(glow, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aPos); g.setAttribute('aCol', aCol); g.setAttribute('aSize', aSize);
  g.setAttribute('aAlpha', aAlpha); g.setAttribute('aGlow', aGlow);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 aCol; attribute float aSize, aAlpha, aGlow;
      varying vec3 vCol; varying float vA, vG;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * 700.0 / max(-mv.z, 0.5);
        vCol = aCol; vA = aAlpha; vG = aGlow;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA, vG;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float m = smoothstep(1.0, mix(0.35, 0.0, vG), d);
        if (m * vA < 0.01) discard;
        gl_FragColor = vec4(vCol * mix(1.0, 3.0, vG), m * vA);
      }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;

  let head = 0;
  const c = new THREE.Color();
  function emit(b: Burst) {
    c.set(b.color);
    const sp = b.speed ?? 2, up = b.up ?? 1, spread = b.spread ?? 0.3;
    for (let k = 0; k < b.count; k++) {
      const i = head; head = (head + 1) % N;
      pos[i * 3] = b.pos.x + (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = b.pos.y + (Math.random() - 0.5) * spread * 0.5;
      pos[i * 3 + 2] = b.pos.z + (Math.random() - 0.5) * spread;
      const a = Math.random() * Math.PI * 2, r = Math.random();
      vel[i * 3] = Math.cos(a) * sp * r + (b.vel?.x ?? 0);
      vel[i * 3 + 1] = up * (0.4 + Math.random() * 0.8) + (b.vel?.y ?? 0);
      vel[i * 3 + 2] = Math.sin(a) * sp * r + (b.vel?.z ?? 0);
      const tint = 0.85 + Math.random() * 0.3;
      col[i * 3] = c.r * tint; col[i * 3 + 1] = c.g * tint; col[i * 3 + 2] = c.b * tint;
      max[i] = life[i] = (b.life ?? 0.8) * (0.6 + Math.random() * 0.8);
      size[i] = (b.size ?? 0.12) * (0.6 + Math.random() * 0.8);
      grav[i] = b.gravity ?? 2;
      glow[i] = b.glow ? 1 : 0;
    }
  }
  function update(dt: number) {
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const k = i * 3;
      vel[k + 1] -= grav[i] * dt;
      const drag = 1 - 1.6 * dt;
      vel[k] *= drag; vel[k + 1] *= drag; vel[k + 2] *= drag;
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
      const t = life[i] / max[i];
      alpha[i] = Math.min(1, t * 3) * Math.min(1, (1 - t) * 8) * (glow[i] ? 0.9 : 0.55);
    }
    aPos.needsUpdate = aCol.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = aGlow.needsUpdate = true;
  }
  function shift(dz: number) { for (let i = 0; i < N; i++) pos[i * 3 + 2] += dz; }
  return { points, emit, update, shift };
}
