// Monstruos decorativos de la tormenta: colosos, garras sobre los tejados, máscaras oni y cuervos.
// Todo instanciado: unas pocas llamadas de dibujo en total sea cual sea el número.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Mats } from '../../render/materials';
import { shadowMat, crowMat, type StormUniforms } from './shaders';
import { rnd } from './gate';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function tg(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, "XYZ")), _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  return g;
}
const M = (...a: Parameters<typeof _m.compose>) => new THREE.Matrix4().compose(...a);

export function crowGeo() {
  const cv = new Float32Array([
    0, 0, -0.45, 0.1, 0, 0, 0, 0.08, 0,   0, 0, -0.45, 0, 0.08, 0, -0.1, 0, 0,
    0.1, 0, 0, 0, 0, 0.5, 0, 0.08, 0,     0, 0.08, 0, 0, 0, 0.5, -0.1, 0, 0,
    0, 0, 0.45, 0.2, 0, 0.62, -0.2, 0, 0.62,
    -0.08, 0, -0.12, -0.55, 0, -0.1, -0.08, 0, 0.16,   -0.55, 0, -0.1, -0.95, 0, 0.12, -0.08, 0, 0.16,
    0.08, 0, -0.12, 0.08, 0, 0.16, 0.55, 0, -0.1,      0.55, 0, -0.1, 0.08, 0, 0.16, 0.95, 0, 0.12,
  ]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(cv, 3));
  return g;
}

export type MonsterQ = { colossi: number; hands: number; masks: number; crows: number };

export function createMonsters(mats: Mats, su: StormUniforms, q: MonsterQ) {
  const root = new THREE.Group(); root.name = 'stormMonsters';
  const r = rnd(911);
  const dummy = new THREE.Object3D();

  // ── colosos: altura unidad, encorvados hacia -Z, cuernos y brazos colgantes ──
  const cg = mergeGeometries([
    tg(new THREE.ConeGeometry(0.5, 0.75, 10, 1, true), 0, 0.37, 0.02),                       // manto
    tg(new THREE.SphereGeometry(1, 12, 8), 0, 0.6, 0, 0.35, 0, 0, 0.34, 0.36, 0.25),           // torso
    tg(new THREE.SphereGeometry(1, 10, 6), -0.26, 0.74, -0.03, 0, 0, 0, 0.17, 0.12, 0.15),
    tg(new THREE.SphereGeometry(1, 10, 6), 0.26, 0.74, -0.03, 0, 0, 0, 0.17, 0.12, 0.15),
    tg(new THREE.SphereGeometry(1, 10, 8), 0, 0.84, -0.14, 0, 0, 0, 0.11, 0.12, 0.12),        // cabeza
    tg(new THREE.ConeGeometry(0.035, 0.26, 6), -0.09, 0.97, -0.12, -0.3, 0, 0.75),
    tg(new THREE.ConeGeometry(0.035, 0.26, 6), 0.09, 0.97, -0.12, -0.3, 0, -0.75),
    tg(new THREE.CylinderGeometry(0.05, 0.08, 0.62, 7), -0.36, 0.46, -0.1, -0.25, 0, -0.12),  // brazos
    tg(new THREE.CylinderGeometry(0.05, 0.08, 0.62, 7), 0.36, 0.46, -0.1, -0.25, 0, 0.12),
    tg(new THREE.ConeGeometry(0.07, 0.2, 6), -0.4, 0.12, -0.18, Math.PI + 0.3, 0, 0),         // zarpas
    tg(new THREE.ConeGeometry(0.07, 0.2, 6), 0.4, 0.12, -0.18, Math.PI + 0.3, 0, 0),
  ])!;
  const eyeG = mergeGeometries([
    tg(new THREE.SphereGeometry(1, 8, 5), -0.042, 0.855, -0.245, 0, 0, 0.3, 0.026, 0.011, 0.01),
    tg(new THREE.SphereGeometry(1, 8, 5), 0.042, 0.855, -0.245, 0, 0, -0.3, 0.026, 0.011, 0.01),
  ])!;
  const colMat = shadowMat(su, 2, 22);
  const col = new THREE.InstancedMesh(cg, colMat, Math.max(1, q.colossi));
  const colEyes = new THREE.InstancedMesh(eyeG, mats.glow(0xff5522, 9), Math.max(1, q.colossi));
  col.frustumCulled = colEyes.frustumCulled = false;
  col.count = colEyes.count = q.colossi;
  root.add(col, colEyes);
  const colos = Array.from({ length: q.colossi }, (_, i) => ({
    x: q.colossi === 1 ? 6 : -30 + 72 * (i / (q.colossi - 1)) + (r() - 0.5) * 8, dz: 34 + (i % 2) * 14 + r() * 6, h: 44 + r() * 22, ph: r() * 10, ry: (r() - 0.5) * 0.5,
  }));
  const eyeC = new THREE.Vector3(0, 0.855, -0.245);

  // ── garras: palma+antebrazo, falanges y uñas instanciadas; las matrices se encadenan a mano ──
  const palmG = mergeGeometries([
    tg(new THREE.SphereGeometry(1, 10, 8), 0, 1.0, 0, 0, 0, 0, 0.95, 1.15, 0.38),
    tg(new THREE.CylinderGeometry(0.55, 0.85, 9, 8), 0, -3.6, 0.1),
  ])!;
  const segG = tg(new THREE.CylinderGeometry(0.17, 0.24, 1, 6), 0, 0.5, 0);
  const clawG = tg(new THREE.ConeGeometry(0.17, 1, 6), 0, 0.5, 0);
  const handMat = shadowMat(su, 5.5, 9.5);
  const nh = q.hands;
  const palms = new THREE.InstancedMesh(palmG, handMat, Math.max(1, nh));
  const segs = new THREE.InstancedMesh(segG, handMat, Math.max(1, nh * 10));
  const claws = new THREE.InstancedMesh(clawG, mats.tint('ceramic', 0x2a2228), Math.max(1, nh * 5));
  palms.frustumCulled = segs.frustumCulled = claws.frustumCulled = false;
  palms.count = nh; segs.count = nh * 10; claws.count = nh * 5;
  root.add(palms, segs, claws);
  // lado: -1 tejado izquierdo, 1 derecho, 0 por encima de la calle desde el frente (siempre alto)
  const hands = Array.from({ length: nh }, (_, i) => {
    const side = i % 3 === 2 ? 0 : (i % 2 ? 1 : -1);
    return { side, x: side < 0 ? -7.5 - r() * 3 : side > 0 ? 17.5 + r() * 3 : 1 + r() * 10, dz: (i % 3 === 2 ? 4 : -2) + r() * 6, sc: 1.5 + r() * 0.9, ph: r(), per: 8 + r() * 5 };
  });
  const fingers = [[-0.62, 1.95, -0.12, 1.5, 1.2], [-0.2, 2.12, -0.04, 1.8, 1.4], [0.22, 2.08, 0.04, 1.7, 1.35], [0.62, 1.92, 0.12, 1.4, 1.1], [0.95, 0.9, 0.9, 1.1, 0.9]];
  const H = new THREE.Matrix4(), A = new THREE.Matrix4(), B = new THREE.Matrix4(), T = new THREE.Matrix4();

  // ── máscaras oni ──
  const faceG = mergeGeometries([
    tg(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), 0, 0, 0, -Math.PI / 2, 0, 0, 1, 0.5, 1.25),
    tg(new THREE.SphereGeometry(1, 10, 6), 0, 0.42, -0.36, 0, 0, 0, 0.8, 0.16, 0.2),    // ceño
    tg(new THREE.SphereGeometry(1, 8, 6), 0, -0.05, -0.5, 0, 0, 0, 0.18, 0.22, 0.14),   // nariz
    tg(new THREE.TorusGeometry(0.45, 0.07, 6, 14, Math.PI), 0, -0.48, -0.36, 0, 0, Math.PI, 1, 0.5, 1),  // boca
  ])!;
  const hornG = mergeGeometries([
    tg(new THREE.ConeGeometry(0.15, 0.9, 7), -0.58, 1.12, -0.05, 0, 0, 0.45),
    tg(new THREE.ConeGeometry(0.15, 0.9, 7), 0.58, 1.12, -0.05, 0, 0, -0.45),
    tg(new THREE.ConeGeometry(0.07, 0.36, 5), -0.3, -0.52, -0.45, 0, 0, 0),
    tg(new THREE.ConeGeometry(0.07, 0.36, 5), 0.3, -0.52, -0.45, 0, 0, 0),
  ])!;
  const mEyeG = mergeGeometries([
    tg(new THREE.SphereGeometry(1, 8, 5), -0.34, 0.2, -0.47, 0, 0, 0.35, 0.17, 0.08, 0.06),
    tg(new THREE.SphereGeometry(1, 8, 5), 0.34, 0.2, -0.47, 0, 0, -0.35, 0.17, 0.08, 0.06),
  ])!;
  const nm = q.masks;
  const faces = new THREE.InstancedMesh(faceG, mats.tint('lacquerRed', 0x6a1812), Math.max(1, nm));
  const horns = new THREE.InstancedMesh(hornG, mats.tint('ceramic', 0xd9cdb0), Math.max(1, nm));
  const mEyes = new THREE.InstancedMesh(mEyeG, mats.glow(0xffc040, 7), Math.max(1, nm));
  faces.frustumCulled = horns.frustumCulled = mEyes.frustumCulled = false;
  faces.count = horns.count = mEyes.count = nm;
  root.add(faces, horns, mEyes);
  const masks = Array.from({ length: nm }, (_, i) => ({ x: (i % 2 ? 12 + r() * 10 : -8 + r() * 9), y: 11 + r() * 13, dz: 1 + r() * 5, sc: 0.9 + r() * 0.8, ph: r(), per: 10 + r() * 6 }));

  // ── cuervos ──
  const crowG = crowGeo();
  const nc = q.crows;
  const crows = new THREE.InstancedMesh(crowG, crowMat(su), Math.max(1, nc));
  crowG.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: Math.max(1, nc) }, () => r()), 1));
  crows.frustumCulled = false; crows.count = nc; root.add(crows);
  const flocks = 1 + Math.min(2, Math.floor(nc / 15));
  const birds = Array.from({ length: nc }, (_, i) => ({ f: i % flocks, a: r() * 6.28, rad: 2 + r() * 7, w: 0.6 + r() * 0.6, yo: (r() - 0.5) * 4, sc: 0.7 + r() * 0.5 }));
  const bp = new THREE.Vector3(), bn = new THREE.Vector3();
  function birdPos(b: typeof birds[0], t: number, front: number, out: THREE.Vector3) {
    const fx = 5 + Math.sin(t * 0.23 + b.f * 2.1) * 9, fy = 15 + b.f * 4 + Math.sin(t * 0.4 + b.f) * 3, fz = front - 9 - b.f * 5 + Math.sin(t * 0.3 + b.f) * 4;
    const a = b.a + t * b.w;
    return out.set(fx + Math.cos(a) * b.rad, fy + b.yo + Math.sin(a * 1.7) * 1.2, fz + Math.sin(a) * b.rad * 0.7 - (t * 4 % 1) * 0);
  }

  function update(t: number, front: number, danger: number, show: number) {
    root.visible = show > 0.01;
    if (!root.visible) return;
    // colosos
    for (let i = 0; i < q.colossi; i++) {
      const c = colos[i], br = 1 + Math.sin(t * 0.5 + c.ph) * 0.02, lean = -(0.1 + 0.08 * Math.sin(t * 0.17 + c.ph) + 0.1 * danger);
      const rise = c.h * (0.75 + 0.25 * show);
      dummy.position.set(c.x + Math.sin(t * 0.07 + c.ph) * 3, -c.h * 0.08 + (rise - c.h) * 0.5, front + c.dz);
      dummy.rotation.set(lean, c.ry + Math.sin(t * 0.11 + c.ph) * 0.15, Math.sin(t * 0.21 + c.ph) * 0.04);
      dummy.scale.set(c.h, c.h * br, c.h);
      dummy.updateMatrix(); col.setMatrixAt(i, dummy.matrix);
      const bl = Math.min(1, Math.abs(Math.sin(t * 0.33 + c.ph * 3)) * 9) * show;
      T.copy(dummy.matrix).multiply(A.makeTranslation(eyeC.x, eyeC.y, eyeC.z)).multiply(B.makeScale(1 + danger * 0.4, Math.max(0.02, bl), 1)).multiply(A.makeTranslation(-eyeC.x, -eyeC.y, -eyeC.z));
      colEyes.setMatrixAt(i, T);
    }
    col.instanceMatrix.needsUpdate = colEyes.instanceMatrix.needsUpdate = true;

    // garras
    for (let i = 0; i < nh; i++) {
      const h = hands[i], ph = (t / h.per + h.ph) % 1;
      const rise = THREE.MathUtils.smoothstep(ph, 0.05, 0.3) * (1 - THREE.MathUtils.smoothstep(ph, 0.72, 0.95)) * show;
      const grip = THREE.MathUtils.smoothstep(ph, 0.25, 0.5);
      const baseY = h.side === 0 ? 8 + rise * 14 : -3 + rise * 9.5;
      const ry = h.side < 0 ? -Math.PI / 2 : h.side > 0 ? Math.PI / 2 : 0;
      H.compose(_p.set(h.x, baseY, front + h.dz), _q.setFromEuler(_e.set(h.side === 0 ? -0.5 : -0.15, ry, Math.sin(t * 0.8 + i) * 0.08, "YXZ")), _s.setScalar(h.sc));
      palms.setMatrixAt(i, H);
      for (let f = 0; f < 5; f++) {
        const [fx, fy, spread, l1, l2] = fingers[f];
        const tw = Math.sin(t * 3.1 + i * 2 + f * 1.3) * 0.12;
        const c0 = -(0.25 + grip * 0.75 + tw), c1 = -(0.3 + grip * 0.9 + tw);
        A.copy(H).multiply(M(_p.set(fx, fy, 0), _q.setFromEuler(_e.set(c0, 0, -spread * 0.35, "XYZ")), _s.set(1, 1, 1)));
        segs.setMatrixAt(i * 10 + f * 2, T.copy(A).multiply(B.makeScale(1, l1, 1)));
        A.multiply(M(_p.set(0, l1, 0), _q.setFromEuler(_e.set(c1, 0, 0, "XYZ")), _s.set(0.85, 1, 0.85)));
        segs.setMatrixAt(i * 10 + f * 2 + 1, T.copy(A).multiply(B.makeScale(1, l2, 1)));
        A.multiply(M(_p.set(0, l2, 0), _q.setFromEuler(_e.set(c1 * 0.8, 0, 0, "XYZ")), _s.set(1, 1, 1)));
        claws.setMatrixAt(i * 5 + f, T.copy(A).multiply(B.makeScale(1, 0.9, 1)));
      }
    }
    palms.instanceMatrix.needsUpdate = segs.instanceMatrix.needsUpdate = claws.instanceMatrix.needsUpdate = true;

    // máscaras
    for (let i = 0; i < nm; i++) {
      const m = masks[i], ph = (t / m.per + m.ph) % 1;
      const k = THREE.MathUtils.smoothstep(ph, 0.0, 0.2) * (1 - THREE.MathUtils.smoothstep(ph, 0.8, 1.0)) * show;
      dummy.position.set(m.x + Math.sin(t * 0.3 + i) * 2, m.y + Math.sin(t * 0.7 + i * 1.7) * 1.2, front + m.dz - k * 2);
      dummy.rotation.set(Math.sin(t * 0.5 + i) * 0.15, Math.sin(t * 0.35 + i * 2) * 0.4, Math.sin(t * 0.6 + i) * 0.2);
      dummy.scale.setScalar(m.sc * Math.max(0.001, k));
      dummy.updateMatrix();
      faces.setMatrixAt(i, dummy.matrix); horns.setMatrixAt(i, dummy.matrix);
      const fl = 0.6 + 0.4 * Math.sin(t * 9 + i * 3);
      mEyes.setMatrixAt(i, T.copy(dummy.matrix).multiply(B.makeScale(1, fl, 1)));
    }
    faces.instanceMatrix.needsUpdate = horns.instanceMatrix.needsUpdate = mEyes.instanceMatrix.needsUpdate = true;

    // cuervos
    for (let i = 0; i < nc; i++) {
      const b = birds[i];
      birdPos(b, t, front, bp); birdPos(b, t + 0.05, front, bn);
      dummy.position.copy(bp); dummy.lookAt(bn); dummy.rotateY(Math.PI);
      dummy.scale.setScalar(b.sc * Math.min(1, show * 1.5));
      dummy.updateMatrix(); crows.setMatrixAt(i, dummy.matrix);
    }
    crows.instanceMatrix.needsUpdate = true;
  }
  return { root, update };
}
