// Amenaza visible mientras se corre: la cámara mira hacia -Z y el frente está detrás, así que estas piezas
// se colocan respecto al JUGADOR e invaden el encuadre según el peligro. Pura decoración, fuera del carril.
//  · fauces colosales que asoman sobre los tejados (arriba del encuadre) y muerden
//  · tentáculos con garra que salen de las fachadas por las esquinas inferiores
//  · cuervos que adelantan al jugador (peligro > 0,8)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Mats } from '../../render/materials';
import { shadowMat, crowMat, type StormUniforms } from './shaders';
import { crowGeo } from './monsters';
import { rnd } from './gate';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function tg(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'XYZ')), _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  return g;
}
const ss = THREE.MathUtils.smoothstep;

export type ChaseQ = { jaws: number; tentacles: number; tseg: number; chaseCrows: number };

export function createChase(mats: Mats, su: StormUniforms, q: ChaseQ, streetX0 = 2, streetX1 = 9.5) {
  const root = new THREE.Group(); root.name = 'stormChase';
  const r = rnd(4242);
  const cx = (streetX0 + streetX1) / 2;
  const dummy = new THREE.Object3D();
  const A = new THREE.Matrix4(), B = new THREE.Matrix4(), J = new THREE.Matrix4();

  // ── fauces (boca hacia +Z local, bisagra en el origen) ──
  const teethU: THREE.BufferGeometry[] = [], teethL: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI, x = Math.cos(a), z = Math.sin(a), fang = i === 4 || i === 12 ? 1.9 : 1;
    teethU.push(tg(new THREE.ConeGeometry(0.035 * fang, 0.16 * fang, 5), x * 0.52, -0.06 * fang, 0.52 + z * 0.5, Math.PI));
    teethL.push(tg(new THREE.ConeGeometry(0.03 * fang, 0.13 * fang, 5), x * 0.46, 0.05 * fang, 0.5 + z * 0.46));
  }
  const upperG = mergeGeometries([tg(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0.52, 0, 0, 0, 0.56, 0.34, 0.54), ...teethU])!;
  const lowerG = mergeGeometries([tg(new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0, 0, 0.5, 0, 0, 0, 0.5, 0.22, 0.5), ...teethL])!;
  const eyeG = mergeGeometries([-0.3, -0.13, 0.13, 0.3].map((x, i) => tg(new THREE.SphereGeometry(1, 8, 5), x, 0.22 + (i % 3 ? 0.05 : 0), 0.62 + (i % 3 ? 0.08 : 0), 0, 0, -x, 0.055, 0.022, 0.03)))!;
  const jawMat = shadowMat(su, -1000, -999); jawMat.side = THREE.DoubleSide;
  const nj = q.jaws;
  const up = new THREE.InstancedMesh(upperG, jawMat, nj), lo = new THREE.InstancedMesh(lowerG, jawMat, nj);
  const eyes = new THREE.InstancedMesh(eyeG, mats.glow(0xff4a1c, 9), nj);
  for (const m of [up, lo, eyes]) { m.frustumCulled = false; root.add(m); }
  const jaws = Array.from({ length: nj }, (_, i) => ({ side: i % 2 ? 1 : -1, ph: r() * 10, per: 11 + r() * 5 }));

  // ── tentáculos con garra junto a las fachadas ──
  const nt = q.tentacles, S = q.tseg;
  const segG = tg(new THREE.CylinderGeometry(0.85, 1, 1, 7, 1, true), 0, 0.5, 0);
  const tipG = mergeGeometries([
    tg(new THREE.ConeGeometry(0.16, 0.9, 6), 0.12, 0.4, 0, 0, 0, -0.35),
    tg(new THREE.ConeGeometry(0.16, 0.9, 6), -0.12, 0.4, 0, 0, 0, 0.35),
    tg(new THREE.ConeGeometry(0.16, 1.1, 6), 0, 0.5, 0.1, 0.3, 0, 0),
  ])!;
  const tMat = shadowMat(su, -1000, -999);
  const segs = new THREE.InstancedMesh(segG, tMat, Math.max(1, nt * S));
  const tips = new THREE.InstancedMesh(tipG, mats.tint('ceramic', 0x2a2228), Math.max(1, nt));
  segs.frustumCulled = tips.frustumCulled = false; segs.count = nt * S; tips.count = nt;
  root.add(segs, tips);
  const tents = Array.from({ length: nt }, (_, i) => ({ side: i % 2 ? 1 : -1, ph: r(), per: 3.2 + r() * 2.5, y: i % 2 === 0 ? 3.8 + r() * 3 : 0.6 + r() * 2.4, dz: r() * 14, len: 5 + r() * 3, rad: 0.5 + r() * 0.25 }));
  const pts = Array.from({ length: S + 1 }, () => new THREE.Vector3());
  const Y = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();

  // ── cuervos que adelantan ──
  const nc = q.chaseCrows;
  const cg = crowGeo();
  cg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: Math.max(1, nc) }, () => r()), 1));
  const crows = new THREE.InstancedMesh(cg, crowMat(su), Math.max(1, nc));
  crows.frustumCulled = false; crows.count = nc; root.add(crows);
  const birds = Array.from({ length: nc }, () => ({ ph: r(), x: (r() - 0.5) * 9, y: 3.6 + r() * 5, sp: 0.55 + r() * 0.35, sc: 0.6 + r() * 0.5 }));

  const FAR = new THREE.Vector3(0, -9999, 0);
  /** anchorY: altura de la calle suavizada (no sigue los saltos) · cam: posición de la cámara, para no pasarle por delante */
  function update(t: number, player: THREE.Vector3, danger: number, anchorY = player.y, cam: THREE.Vector3 = FAR) {
    const pz = player.z, py = anchorY;
    const nearCam = (p: THREE.Vector3, r: number) => p.distanceToSquared(cam) < r * r;
    // fauces: entran desde atrás y por los lados a partir de 0,5 de peligro
    const kJ = ss(danger, 0.5, 0.92);
    for (let i = 0; i < nj; i++) {
      const j = jaws[i];
      const cyc = (t / j.per + j.ph) % 1, lunge = ss(cyc, 0.55, 0.7) * (1 - ss(cyc, 0.8, 1));
      const k = kJ * (nj === 1 ? 1 : 0.85 + 0.15 * Math.sin(t * 0.3 + i));
      const side = nj === 1 ? (Math.floor(t / 14) % 2 ? 1 : -1) : j.side;
      const sc = 13 + 5 * k;
      dummy.position.set(cx + side * (12.5 - 3 * lunge * k) , py + 11 + 3 * (1 - k) - 2 * lunge, pz + 22 - 50 * k - 6 * lunge);
      dummy.lookAt(player.x, py + 1, pz - 6);
      dummy.scale.setScalar(sc * Math.max(0.001, ss(danger, 0.42, 0.55)));
      dummy.updateMatrix(); J.copy(dummy.matrix);
      const open = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.7 + j.ph)) * (1 - lunge) + 0.9 * lunge * (cyc < 0.68 ? 1 : 0.2);
      up.setMatrixAt(i, A.copy(J).multiply(B.makeRotationX(-open * 0.6)));
      eyes.setMatrixAt(i, A);
      lo.setMatrixAt(i, A.copy(J).multiply(B.makeRotationX(open * 0.45)));
    }
    up.instanceMatrix.needsUpdate = lo.instanceMatrix.needsUpdate = eyes.instanceMatrix.needsUpdate = true;

    // tentáculos: se lanzan hacia el jugador pegados a la fachada y se retiran
    const kT = ss(danger, 0.1, 0.5);
    for (let i = 0; i < nt; i++) {
      const tn = tents[i], cyc = (t / tn.per + tn.ph) % 1;
      const reach = kT * ss(cyc, 0.0, 0.35) * (1 - ss(cyc, 0.6, 0.95));
      // alcance lateral hacia el callejón (sin pasar del centro, donde va la cámara)
      const wx = tn.side < 0 ? streetX0 - 2.2 : streetX1 + 2.2;
      const bz = pz + 3 - tn.dz;  // nace dentro de las casas, por delante de la cámara (que va a ~+6,6)
      for (let s = 0; s <= S; s++) {
        const u = s / S, L = (tn.len + 6) * reach * u;
        const curl = Math.sin(u * Math.PI * 0.9) * 1.6 * reach;
        pts[s].set(
          wx - tn.side * Math.min(5.2, (tn.len + 2) * reach * u + curl * 0.5 + Math.sin(t * 3 + u * 6 + i) * 0.25 * u),
          py + tn.y + Math.sin(t * 2.4 + u * 5 + i * 2) * 0.5 * u + u * u * 1.2 * reach,
          bz - L * 0.45,
        );
      }
      for (let s = 0; s < S; s++) {
        const a = pts[s], b = pts[s + 1];
        dir.subVectors(b, a); const len = Math.max(0.001, dir.length()); dir.divideScalar(len);
        const rad = nearCam(a, 3.5) || nearCam(b, 3.5) ? 0.001 : tn.rad * (1 - s / S * 0.75) * Math.min(1, reach * 4);
        _q.setFromUnitVectors(Y, dir);
        segs.setMatrixAt(i * S + s, A.compose(a, _q, _s.set(Math.max(0.001, rad), len, Math.max(0.001, rad))));
      }
      dir.subVectors(pts[S], pts[S - 1]).normalize();
      _q.setFromUnitVectors(Y, dir);
      tips.setMatrixAt(i, A.compose(pts[S], _q, _s.setScalar(Math.max(0.001, Math.min(1, reach * 3)) * 1.2)));
    }
    segs.instanceMatrix.needsUpdate = tips.instanceMatrix.needsUpdate = true;

    // cuervos que pasan por encima de la cámara hacia delante
    const kC = ss(danger, 0.75, 0.9);
    const bp = new THREE.Vector3();
    for (let i = 0; i < nc; i++) {
      const b = birds[i], ph = (t * b.sp * 0.35 + b.ph) % 1;
      bp.set(cx + b.x + Math.sin(t * 2 + i) * 0.6, py + b.y + Math.sin(t * 3 + i) * 0.4, pz + 12 - ph * 60);
      dummy.position.copy(bp); dummy.lookAt(bp.x, bp.y - 0.3, bp.z - 1); dummy.rotateY(Math.PI);
      dummy.scale.setScalar(nearCam(bp, 5) ? 0.0001 : b.sc * Math.max(0.001, kC));
      dummy.updateMatrix(); crows.setMatrixAt(i, dummy.matrix);
    }
    crows.instanceMatrix.needsUpdate = true;
    root.visible = danger > 0.08;
  }
  return { root, update };
}
