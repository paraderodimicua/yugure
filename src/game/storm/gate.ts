// Compuerta gigante de madera (≈19 m) que sella la tormenta. Mira hacia -Z (lado del jugador).
// Las piezas se fusionan por material para pocas llamadas de dibujo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Mats } from '../../render/materials';
import type { ArchKit } from '../../world/arch';
import { cloudMat, cloudAttrs, dustMat, type StormUniforms } from './shaders';

export const rnd = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** cubo de geometrías por material; al final un Mesh por material */
export class Bag {
  parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    g = g.index ? g : g; g.applyMatrix4(_m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    let l = this.parts.get(mat); if (!l) this.parts.set(mat, l = []); l.push(g);
  }
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) { this.add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
  build(into: THREE.Object3D, shadows = true) {
    for (const [mat, l] of this.parts) {
      const m = new THREE.Mesh(mergeGeometries(l), mat);
      m.castShadow = shadows; m.receiveShadow = true; into.add(m);
      for (const g of l) g.dispose();
    }
    this.parts.clear();
  }
}

type Q = { dust: number; splinters: number; pour: number; oct: number; warp: boolean };

export function buildGate(mats: Mats, kit: ArchKit, su: StormUniforms, q: Q) {
  const r = rnd(77);
  const root = new THREE.Group(); root.name = 'stormGate';
  const OW = 7, H = 15, POST = 1.6, PX = OW + POST / 2;
  const wood = mats.along('woodDark', 'y'), woodH = mats.along('woodDark', 'x'), plank = mats.along('woodWeathered', 'y');
  const iron = mats.metalDark, paper = mats.paper, red = mats.lacquerRed;

  // ── marco fijo ──
  const F = new Bag();
  for (const s of [-1, 1]) {
    F.box(wood, POST, 17.4, POST, s * PX, 8.7, 0);
    F.box(mats.stone, 2.4, 1.1, 2.4, s * PX, 0.55, 0);
    F.box(iron, POST + 0.12, 0.5, POST + 0.12, s * PX, 1.4, 0);
    F.box(iron, POST + 0.12, 0.4, POST + 0.12, s * PX, 14.2, 0);
    for (let k = 0; k < 4; k++) F.box(paper, 0.5, 1.5, 0.03, s * PX + (r() - 0.5) * 0.5, 4 + k * 2.4 + r(), -POST / 2 - 0.03, 0, 0, (r() - 0.5) * 0.3);
  }
  F.box(woodH, 2 * OW + 0.2, 0.7, 1.2, 0, H + 0.45, 0);           // dintel de las hojas
  F.box(woodH, 2 * PX + 4, 0.9, 1.1, 0, 15.9, 0);                  // nuki
  F.box(woodH, 2 * PX + 7, 1.2, 1.7, 0, 17.4, 0);                  // kasagi
  F.box(mats.lacquerBlack, 3.2, 1.6, 0.25, 0, 16.6, -0.7);         // placa
  F.box(mats.metalGold, 3.4, 0.12, 0.28, 0, 17.42 - 0.02, -0.68);
  F.box(mats.metalGold, 3.4, 0.12, 0.28, 0, 15.8, -0.68);
  for (let x = -PX - 3; x <= PX + 3.01; x += 1.25) F.box(wood, 0.55, 0.5, 2.2, x, 18.25, 0);  // ménsulas
  // tejado de teja: dos faldones, cumbrera con remates y esquinas que se levantan
  const RL = 2 * PX + 12, slope = 0.5;
  F.add(wood, new THREE.CylinderGeometry(3.1, 3.1, RL - 1, 3), 0, 19.6, 0, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    F.box(mats.tileSlate, RL, 0.45, 6.4, 0, 19.95, s * 2.75, -s * slope);
    for (let x = -RL / 2 + 0.3; x < RL / 2; x += 0.62) F.add(mats.tileSlate, new THREE.CylinderGeometry(0.16, 0.16, 6.3, 5), x, 20.2, s * 2.82, Math.PI / 2 - s * slope);
    F.box(wood, RL - 0.4, 0.35, 0.5, 0, 18.4, s * 5.45);
    for (let x = -RL / 2 + 0.4; x < RL / 2; x += 0.9) F.box(wood, 0.22, 0.26, 1.6, x, 18.65, s * 4.9, -s * slope);
    for (const sx of [-1, 1]) F.box(mats.tileSlate, 3.2, 0.5, 3.6, sx * (RL / 2 - 1.1), 18.75, s * 4.8, -s * slope, 0, sx * 0.28);
    F.add(mats.tileSlate, new THREE.ConeGeometry(0.5, 2.4, 6), s * (RL / 2 + 0.2), 23.4, 0, 0, 0, -s * 0.6);   // shachi
    F.box(mats.tileSlate, 1.6, 2.0, 1.4, s * (RL / 2 - 0.6), 22.2, 0);
  }
  F.box(mats.tileSlate, RL + 0.6, 1.0, 1.1, 0, 21.6, 0);
  // muros laterales con zócalo de piedra (kit) y albardilla de teja
  const WL = 13.4, wallX = PX + POST / 2 + WL / 2;
  for (const s of [-1, 1]) {
    const sw = kit.stoneWall(WL, 2.6, { seed: s > 0 ? 5 : 6 });
    sw.position.set(s * wallX, 0, 0.9); sw.rotation.y = Math.PI; root.add(sw);
    F.box(mats.plasterAged, WL, 7.6, 1.2, s * wallX, 6.4, 0);
    for (let k = 0; k <= 4; k++) F.box(wood, 0.5, 7.6, 1.35, s * (PX + POST / 2 + 0.25 + k * (WL - 0.5) / 4), 6.4, 0);
    F.box(woodH, WL, 0.5, 1.4, s * wallX, 10.2, 0);
    F.box(mats.tileClay, WL + 0.4, 0.4, 2.6, s * wallX, 10.75, -0.6, 0.35);
    F.box(mats.tileClay, WL + 0.4, 0.4, 2.6, s * wallX, 10.75, 0.6, -0.35);
    for (let k = 0; k < 3; k++) F.box(paper, 0.55, 1.6, 0.03, s * (wallX + (k - 1) * 3.5), 6 + r() * 2, -0.64, 0, 0, (r() - 0.5) * 0.4);
  }
  F.build(root);

  // ── hojas del portón (bisagra en el poste, la hoja se extiende hacia +X local) ──
  const leaves: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const B = new Bag(), lr = rnd(s > 0 ? 3 : 4);
    const n = 15, pw = OW / n;
    for (let i = 0; i < n; i++) B.box(plank, pw - 0.03, H - lr() * 0.12, 0.42 + lr() * 0.1, pw * (i + 0.5), H / 2 + 0.1, 0.02 * (lr() - 0.5));
    for (const y of [1.6, 5.2, 9.0, 12.8]) {
      B.box(woodH, OW - 0.1, 0.7, 0.3, OW / 2, y, -0.32);
      B.box(iron, OW - 0.05, 0.28, 0.06, OW / 2, y + 0.42, -0.5);
      for (let x = 0.3; x < OW; x += 0.55) B.add(iron, new THREE.SphereGeometry(0.085, 6, 4), x, y + 0.42, -0.54);
    }
    for (const y of [1.0, H - 1.0]) B.box(iron, 2.2, 0.5, 0.08, 1.1, y, -0.42);   // bisagras
    B.box(iron, 0.35, 1.0, 0.4, OW - 0.9, 7.1, -0.42);                             // soporte de la tranca
    B.add(iron, new THREE.TorusGeometry(0.42, 0.07, 6, 16), OW - 1.5, 6.2, -0.5);  // aldaba
    B.add(iron, new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8), OW - 1.5, 6.62, -0.45, Math.PI / 2);
    // sellos de papel ofuda con sello rojo (los que cruzan la junta quedan partidos en dos)
    for (let k = 0; k < 9; k++) {
      const x = k < 3 ? OW - 0.26 : 0.6 + lr() * (OW - 1.4), y = k < 3 ? 3.2 + k * 3.6 : 1.5 + lr() * 12, rz = (lr() - 0.5) * 0.35;
      B.box(paper, k < 3 ? 0.52 : 0.55, 1.7, 0.02, x, y, -0.47, 0, 0, rz);
      B.box(red, 0.26, 0.26, 0.02, x, y + 0.45, -0.49, 0, 0, rz);
    }
    const pivot = new THREE.Group(), inner = new THREE.Group();
    pivot.position.set(s * OW, 0, 0);
    inner.scale.x = -s;   // izquierda: hacia +X; derecha: espejo
    B.build(inner); pivot.add(inner); root.add(pivot); leaves.push(pivot);
  }

  // ── tranca que se parte en dos ──
  const bar: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(), B = new Bag();
    B.box(mats.along('woodWarm', 'x'), OW + 1.5, 0.85, 0.75, s * (OW + 1.5) / 2, 0, 0);
    B.box(iron, 0.4, 0.95, 0.85, s * 2.5, 0, 0);
    B.build(g); g.position.set(0, 7.1, -1.05); root.add(g); bar.push(g);
  }

  // ── shimenawa: soga trenzada en dos mitades que cuelgan de los postes y se rompen ──
  const rope: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(), B = new Bag();
    for (const ph of [0, Math.PI]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, x = -s * u * OW;                       // de poste (0) al centro
        const sag = -1.9 * (1 - (1 - u) * (1 - u));
        const a = u * 22 + ph, rr = 0.24 * (1.2 - 0.5 * u);
        pts.push(new THREE.Vector3(x, sag + Math.cos(a) * rr, Math.sin(a) * rr));
      }
      B.add(mats.rope, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.3, 6));
    }
    B.add(mats.rope, new THREE.SphereGeometry(0.7, 8, 6), 0, 0, 0);
    for (let k = 1; k <= 3; k++) {                       // shide en zigzag
      const x = -s * k * OW / 4, y0 = -1.9 * (1 - (1 - k / 4) ** 2) - 0.35;
      for (let j = 0; j < 4; j++) B.box(paper, 0.34, 0.5, 0.02, x + (j % 2 ? 0.14 : -0.14), y0 - j * 0.46, -0.3, 0, 0, (j % 2 ? 0.2 : -0.2));
    }
    B.add(mats.straw, new THREE.ConeGeometry(0.34, 1.8, 8), -s * OW * 0.55, -2.5, 0, Math.PI);
    B.build(g); g.position.set(s * OW, 14.3, -1.35); root.add(g); rope.push(g);
  }

  // ── oscuridad: vacío detrás de las hojas, ojos al fondo, humo negro que sale a borbotones ──
  const voidMat = cloudMat(su, 'VOID', Math.min(q.oct, 4), false);
  const voidMesh = new THREE.Mesh(cloudAttrs(new THREE.PlaneGeometry(2 * OW, H + 0.5), 1), voidMat);
  voidMesh.position.set(0, H / 2, 0.9); voidMesh.rotation.y = Math.PI; root.add(voidMesh);
  const eyeMat = mats.glow(0xff3b1a, 6);
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6), eyeMat); e.scale.set(1.6, 0.7, 0.5); e.position.set(s * 1.7, 0, 0); eyes.add(e); }
  eyes.position.set(0.5, 9.5, 0.5); eyes.visible = false; root.add(eyes);
  const pourMat = cloudMat(su, 'POUR', Math.min(q.oct, 4), false);
  const pg: THREE.BufferGeometry[] = [];
  for (let i = 0; i < q.pour; i++) {
    const g = new THREE.PlaneGeometry(15, 13); g.translate((r() - 0.5) * 5, 6.5, -i * 0.3);
    pg.push(cloudAttrs(g, r() * 10, 0, i / q.pour));
  }
  const pour = new THREE.Mesh(mergeGeometries(pg), pourMat); pour.frustumCulled = false; pour.position.z = -0.5; pour.visible = false; root.add(pour);

  // ── polvo y astillas del golpe ──
  const dn = q.dust, dPos = new Float32Array(dn * 3), dVel = new Float32Array(dn * 3), dSize = new Float32Array(dn);
  for (let i = 0; i < dn; i++) {
    const seam = r() < 0.5;
    dPos.set([seam ? (r() - 0.5) * 1.2 : (r() - 0.5) * 2 * OW, seam ? r() * H : r() * 1.2, -0.6], i * 3);
    dVel.set([(r() - 0.5) * 9, r() * 3 + (seam ? 0 : 1), -2 - r() * 9], i * 3);
    dSize[i] = 0.6 + r() * 1.6;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dPos, 3)); dg.setAttribute('aVel', new THREE.BufferAttribute(dVel, 3)); dg.setAttribute('aSize', new THREE.BufferAttribute(dSize, 1));
  const dmat = dustMat();
  const dust = new THREE.Points(dg, dmat); dust.frustumCulled = false; root.add(dust);

  const sn = q.splinters;
  const spl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 1), mats.woodWarm, sn);
  spl.frustumCulled = false; root.add(spl);
  const sp = Array.from({ length: sn }, () => ({
    p: new THREE.Vector3((r() - 0.5) * 1.5, 2 + r() * (H - 3), -0.7),
    v: new THREE.Vector3((r() - 0.5) * 14, 2 + r() * 8, -4 - r() * 12),
    w: new THREE.Vector3(r() * 12, r() * 12, r() * 12), l: 0.3 + r() * 1.4,
  }));
  const dummy = new THREE.Object3D();

  // ── animación de apertura ──
  const TB = 0.28, DUR = 3.2;
  let open = 0;
  function intro(t01: number) {
    const t = THREE.MathUtils.clamp(t01, 0, 1);
    let th: number;
    if (t < TB) { const k = t / TB; th = k * k * 0.035 * (0.6 + 0.4 * Math.sin(t * 160)); }
    else { const u = (t - TB) / (1 - TB); th = 1.62 * (1 - Math.exp(-7 * u) * Math.cos(11 * u)); }
    leaves[0].rotation.y = th; leaves[1].rotation.y = -th;
    const tau = (t - TB) * DUR;   // segundos desde el golpe
    open = THREE.MathUtils.smoothstep(t, TB, TB + 0.35);
    // tranca: vibra y luego sale despedida
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, b = bar[i];
      if (tau < 0) { b.position.set(0, 7.1 + Math.sin(t * 200 + i) * 0.03 * t / TB, -1.05); b.rotation.set(0, 0, 0); }
      else {
        const tt = Math.min(tau, 1.6);
        b.position.set(s * tt * 6, Math.max(0.5, 7.1 + tt * 5 - 4.9 * tt * tt), -1.05 - tt * 7);
        b.rotation.set(-tt * 2.4, s * tt * 1.4, s * tt * 3.2);
      }
    }
    // la soga se rompe y cuelga con un vaivén amortiguado
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, a = tau < 0 ? 0 : 1.35 * (1 - Math.exp(-3 * tau) * Math.cos(6 * tau));
      rope[i].rotation.z = s * a;
    }
    dmat.uniforms.uTau.value = tau;
    for (let i = 0; i < sn; i++) {
      const o = sp[i], tt = THREE.MathUtils.clamp(tau, 0, 2.2);
      if (tau < 0 || tau > 4) { dummy.scale.setScalar(0); }
      else {
        dummy.position.copy(o.p).addScaledVector(o.v, tt); dummy.position.y = Math.max(0.05, dummy.position.y - 4.9 * tt * tt);
        dummy.rotation.set(o.w.x * tt, o.w.y * tt, o.w.z * tt); dummy.scale.set(1, 1, o.l);
      }
      dummy.updateMatrix(); spl.setMatrixAt(i, dummy.matrix);
    }
    spl.instanceMatrix.needsUpdate = true;
    voidMesh.visible = eyes.visible = pour.visible = t > TB * 0.9;
  }
  function update(t: number) {
    pourMat.uniforms.uPour.value = open;
    const blink = Math.min(1, Math.abs(Math.sin(t * 0.7)) * 6);
    eyes.scale.set(1, Math.max(0.05, blink) * open, 1);
    eyes.position.x = 0.5 + Math.sin(t * 0.4) * 1.2;
  }
  intro(0);
  return { root, intro, update, get open() { return open; } };
}
