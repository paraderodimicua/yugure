// Estela: cintas suaves (triangle strip) orientadas a cámara en el shader, una por ancla, todas en un draw call.
//   const tr = createTrail(U); scene.add(tr.mesh);   // en mundo, NO dentro del grupo del personaje
//   tr.update(dt, [anchors.handL.getWorldPosition(a), ...], intensidad 0..1)
// Desvanecido por edad y anchura, bordes suaves, color cálido aditivo. Sin reservas por fotograma.
import * as THREE from 'three';
import type { Shared } from '../stage';

const MAXA = 4, HIST = 22, SUB = 2, LIFE = 0.32;
const NS = (HIST - 1) * SUB + 1; // muestras por cinta tras subdividir

export function createTrail(_U: Shared, o: { width?: number; color?: THREE.ColorRepresentation; life?: number } = {}) {
  const width = o.width ?? 0.075, life = o.life ?? LIFE;
  const nv = MAXA * NS * 2;
  const pos = new Float32Array(nv * 3), tan = new Float32Array(nv * 3), fade = new Float32Array(nv * 2);
  const idx: number[] = [];
  for (let a = 0; a < MAXA; a++) for (let i = 0; i < NS - 1; i++) { const v = (a * NS + i) * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
  const geo = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(pos, 3), aT = new THREE.BufferAttribute(tan, 3), aF = new THREE.BufferAttribute(fade, 2);
  for (const at of [aP, aT, aF]) at.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aP); geo.setAttribute('aTan', aT); geo.setAttribute('aFade', aF);
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(o.color ?? 0xffb070) }, uW: { value: width } },
    vertexShader: /* glsl */ `
      attribute vec3 aTan; attribute vec2 aFade; uniform float uW; varying vec2 vF;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 vd = normalize(cameraPosition - wp.xyz);
        vec3 s = cross(aTan, vd); float l = length(s); s = l > 1e-5 ? s / l : vec3(0.0, 1.0, 0.0);
        float side = aFade.y; // −1 / +1
        wp.xyz += s * side * uW * aFade.x;
        vF = vec2(aFade.x, side);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; varying vec2 vF;
      void main() {
        float e = 1.0 - vF.y * vF.y; e = e * e;           // borde suave
        float a = vF.x * vF.x * e;
        vec3 c = mix(uCol * 0.8, vec3(1.0, 0.93, 0.8), vF.x * e * 0.6);
        gl_FragColor = vec4(c * a * 0.85, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5;

  // historial por ancla (anillo)
  const H = new Float32Array(MAXA * HIST * 4); // x y z t
  const cnt = new Int32Array(MAXA), head = new Int32Array(MAXA);
  let time = 0, inten = 0;
  const P = new Float32Array(NS * 3), A = new Float32Array(NS);
  const sample = (a: number, k: number, c: number) => H[(a * HIST + ((head[a] - k + HIST * 4) % HIST)) * 4 + c]; // k = 0 → más reciente

  function update(dt: number, points: THREE.Vector3[], intensity: number) {
    time += dt;
    inten += (Math.max(0, Math.min(1, intensity)) - inten) * (1 - Math.exp(-dt / 0.08));
    const na = Math.min(MAXA, points.length);
    for (let a = 0; a < MAXA; a++) {
      if (a < na && dt > 0) {
        const p = points[a];
        head[a] = (head[a] + 1) % HIST; cnt[a] = Math.min(HIST, cnt[a] + 1);
        const o4 = (a * HIST + head[a]) * 4; H[o4] = p.x; H[o4 + 1] = p.y; H[o4 + 2] = p.z; H[o4 + 3] = time;
        // un salto grande (teletransporte) reinicia la cinta
        if (cnt[a] > 1) { const dx = p.x - sample(a, 1, 0), dy = p.y - sample(a, 1, 1), dz = p.z - sample(a, 1, 2); if (dx * dx + dy * dy + dz * dz > 9) cnt[a] = 1; }
      }
      if (a >= na) cnt[a] = 0;
      // muestras válidas y subdivisión Catmull-Rom
      let n = 0; while (n < cnt[a] && time - sample(a, n, 3) < life) n++;
      let m = 0;
      if (n >= 2) for (let k = 0; k < n - 1; k++) {
        const k0 = Math.max(0, k - 1), k3 = Math.min(n - 1, k + 2);
        for (let s = 0; s < SUB; s++) {
          const u = s / SUB, u2 = u * u, u3 = u2 * u;
          for (let c = 0; c < 3; c++) {
            const p0 = sample(a, k0, c), p1 = sample(a, k, c), p2 = sample(a, k + 1, c), p3 = sample(a, k3, c);
            P[m * 3 + c] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
          }
          const age = (time - (sample(a, k, 3) * (1 - u) + sample(a, k + 1, 3) * u)) / life;
          A[m] = Math.max(0, 1 - age); m++;
        }
      }
      if (n >= 2) { for (let c = 0; c < 3; c++) P[m * 3 + c] = sample(a, n - 1, c); A[m] = 0; m++; }
      for (let i = 0; i < NS; i++) {
        const v = (a * NS + i) * 2, j = Math.min(i, Math.max(0, m - 1));
        const live = i < m && m >= 2;
        const jn = Math.min(m - 1, j + 1), jp = Math.max(0, j - 1);
        let tx = live ? P[jn * 3] - P[jp * 3] : 0, ty = live ? P[jn * 3 + 1] - P[jp * 3 + 1] : 1, tz = live ? P[jn * 3 + 2] - P[jp * 3 + 2] : 0;
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        // la cabeza nace fina, crece y se afila con la edad
        const head0 = Math.min(1, i / 2.5), f = live ? A[j] * head0 * inten : 0;
        for (let q = 0; q < 2; q++) {
          const w = v + q;
          pos[w * 3] = live ? P[j * 3] : 0; pos[w * 3 + 1] = live ? P[j * 3 + 1] : -1e4; pos[w * 3 + 2] = live ? P[j * 3 + 2] : 0;
          tan[w * 3] = tx; tan[w * 3 + 1] = ty; tan[w * 3 + 2] = tz;
          fade[w * 2] = f; fade[w * 2 + 1] = q ? 1 : -1;
        }
      }
    }
    aP.needsUpdate = aT.needsUpdate = aF.needsUpdate = true;
  }
  return { mesh, update };
}
