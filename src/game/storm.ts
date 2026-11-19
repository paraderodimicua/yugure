// Tormenta que persigue al jugador desde +Z, y la compuerta gigante de la que sale.
// Todo decorativo (sin colisiones de daño): muro de nubes que hierve, techo de nubes, cortina y lluvia,
// rayos que iluminan la escena, viento con escombros y monstruos en la oscuridad.
//
//   const storm = createStorm(st, mats, kit, quality); scene.add(storm.root);
//   storm.intro(t01)            // 0 cerrada → 1 abierta (el juego la anima al empezar)
//   storm.update(t, dt, state)  // cada fotograma con el StormState del juego
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage } from '../stage';
import type { Mats } from '../render/materials';
import type { ArchKit } from '../world/arch';
import type { Quality, StormState } from './contracts';
import { cloudMat, cloudAttrs, curtainMat, rainMat, type StormUniforms } from './storm/shaders';
import { buildGate, rnd } from './storm/gate';
import { createMonsters } from './storm/monsters';
import { createChase } from './storm/chase';

const QT = {
  low:    { jaws: 1, tentacles: 6, tseg: 7, chaseCrows: 6, cards: 3,  oct: 3, warp: false, rain: 350,  debris: [10, 6, 4],    crows: 10, colossi: 1, hands: 2, masks: 2, curtain: 1, dust: 60,  splinters: 16, pour: 3 },
  medium: { jaws: 1, tentacles: 8, tseg: 9, chaseCrows: 12, cards: 5,  oct: 4, warp: false, rain: 1000, debris: [24, 12, 8],   crows: 22, colossi: 2, hands: 3, masks: 3, curtain: 2, dust: 140, splinters: 30, pour: 5 },
  high:   { jaws: 2, tentacles: 10, tseg: 12, chaseCrows: 20, cards: 8,  oct: 4, warp: true,  rain: 2400, debris: [50, 22, 16],  crows: 40, colossi: 3, hands: 5, masks: 5, curtain: 3, dust: 260, splinters: 50, pour: 7 },
  ultra:  { jaws: 2, tentacles: 14, tseg: 14, chaseCrows: 32, cards: 12, oct: 5, warp: true,  rain: 5000, debris: [100, 40, 30], crows: 70, colossi: 4, hands: 6, masks: 8, curtain: 4, dust: 420, splinters: 80, pour: 10 },
} as const;

/** centro X de la calle / compuerta y su Z por defecto */
const CX = 5.75, GATE_Z = 12;

export function createStorm(st: Stage, mats: Mats, kit: ArchKit, quality: Quality) {
  const q = QT[quality] ?? QT.medium;
  const r = rnd(1234);
  const root = new THREE.Group(); root.name = 'storm';
  const su: StormUniforms = { uTime: st.U.time, uFlash: { value: 0 }, uFlashPos: { value: new THREE.Vector3(0, 40, 40) }, uDanger: { value: 0 } };

  // ── compuerta ──
  const gate = buildGate(mats, kit, su, q);
  gate.root.position.set(CX, 0, GATE_Z);
  root.add(gate.root);

  // ── frente: muro de tarjetas (una sola malla, de atrás hacia delante), techo y cortina ──
  const front = new THREE.Group(); root.add(front);
  const cards: THREE.BufferGeometry[] = [];
  const seg = quality === 'low' ? 10 : 22;
  for (let i = q.cards - 1; i >= 0; i--) {
    const layer = q.cards > 1 ? i / (q.cards - 1) : 0, H = 44 + layer * 58 + r() * 10;
    const g = new THREE.PlaneGeometry(200, H, seg, 6);
    g.translate(CX + (r() - 0.5) * 24, H / 2 - 3, i * (62 / q.cards) + r() * 2);
    cards.push(cloudAttrs(g, r() * 10, layer));
  }
  const wallMat = cloudMat(su, 'WALL', q.oct, q.warp);
  const wall = new THREE.Mesh(mergeGeometries(cards), wallMat); wall.frustumCulled = false; front.add(wall);
  const ceilMat = cloudMat(su, 'CEIL', Math.min(q.oct, 4), false);
  const ceil = new THREE.Mesh(cloudAttrs(new THREE.PlaneGeometry(700, 900), 3.3), ceilMat);
  ceil.rotation.x = -Math.PI / 2; ceil.position.set(CX, 62, 450 - 26); ceil.frustumCulled = false; front.add(ceil);
  const cg: THREE.BufferGeometry[] = [];
  for (let k = 0; k < q.curtain; k++) { const g = new THREE.PlaneGeometry(220, 56); g.translate(CX + (r() - 0.5) * 20, 25, 1 + k * 5); cg.push(g); }
  const curtainM = curtainMat(su);
  const curtain = new THREE.Mesh(mergeGeometries(cg), curtainM); curtain.frustumCulled = false; front.add(curtain);

  // ── lluvia alrededor de la cámara (segmentos en GPU) ──
  const rp = new Float32Array(q.rain * 6), rr = new Float32Array(q.rain * 6), re = new Float32Array(q.rain * 2);
  for (let i = 0; i < q.rain; i++) { const a = r(), b = r(), c = r(); rr.set([a, b, c, a, b, c], i * 6); re[i * 2 + 1] = 1; }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setAttribute('aRnd', new THREE.BufferAttribute(rr, 3)); rg.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
  const rainM = rainMat(su);
  const rain = new THREE.LineSegments(rg, rainM); rain.frustumCulled = false; root.add(rain);

  // ── rayo ──
  const MAXQ = 64;
  const boltPos = new Float32Array(MAXQ * 18);
  const boltG = new THREE.BufferGeometry(); boltG.setAttribute('position', new THREE.BufferAttribute(boltPos, 3));
  const bolt = new THREE.Mesh(boltG, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.4, 7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  bolt.frustumCulled = false; bolt.visible = false; root.add(bolt);
  let nq = 0;
  const quad = (a: THREE.Vector3, b: THREE.Vector3, w0: number, w1: number) => {
    if (nq >= MAXQ) return;
    const o = nq++ * 18;
    boltPos.set([a.x - w0, a.y, a.z, b.x - w1, b.y, b.z, b.x + w1, b.y, b.z, a.x - w0, a.y, a.z, b.x + w1, b.y, b.z, a.x + w0, a.y, a.z], o);
  };
  function makeBolt(top: THREE.Vector3, bottomY: number) {
    nq = 0;
    const steps = 18, a = top.clone(), b = new THREE.Vector3();
    const branchAt = 4 + Math.floor(r() * 8);
    let br: THREE.Vector3 | null = null;
    for (let i = 0; i < steps; i++) {
      const w = 0.9 * (1 - i / steps) + 0.25;
      b.set(a.x + (r() - 0.5) * 6, a.y - (top.y - bottomY) / steps, a.z + (r() - 0.5) * 2);
      quad(a, b, w, w * 0.92);
      if (i === branchAt) br = b.clone();
      a.copy(b);
    }
    if (br) {
      const dir = r() < 0.5 ? -1 : 1;
      for (let i = 0; i < 7; i++) { b.set(br.x + dir * (2 + r() * 4), br.y - 3 - r() * 3, br.z); quad(br, b, 0.4 - i * 0.04, 0.36 - i * 0.04); br.copy(b); }
    }
    boltG.setDrawRange(0, nq * 6);
    boltG.attributes.position.needsUpdate = true;
  }

  // ── viento: hojas, tejas y tablas arrastradas por delante del frente ──
  const kinds = [
    { geo: new THREE.PlaneGeometry(0.4, 0.28), mat: mats.leaf, n: q.debris[0], g: -1.2, sp: 1 },
    { geo: new THREE.BoxGeometry(0.55, 0.05, 0.38), mat: mats.tileSlate, n: q.debris[1], g: -5, sp: 0.75 },
    { geo: new THREE.BoxGeometry(0.14, 0.07, 1.5), mat: mats.woodWeathered, n: q.debris[2], g: -4, sp: 0.6 },
  ];
  const debris = kinds.map((k) => {
    const im = new THREE.InstancedMesh(k.geo, k.mat, k.n); im.frustumCulled = false; root.add(im);
    const items = Array.from({ length: k.n }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), e: new THREE.Euler(), w: new THREE.Vector3(), life: 0, on: r() }));
    return { ...k, im, items };
  });
  const respawn = (it: typeof debris[0]['items'][0], fz: number, sp: number) => {
    it.p.set(CX + (r() - 0.5) * 34, 1 + r() * 24, fz + (r() - 0.3) * 10);
    it.v.set((r() - 0.5) * 3, r() * 2.5, -(9 + r() * 14) * sp);
    it.w.set((r() - 0.5) * 14, (r() - 0.5) * 14, (r() - 0.5) * 14);
    it.life = 0;
  };
  for (const d of debris) for (const it of d.items) { respawn(it, 0, d.sp); it.p.z -= r() * 40; }

  // ── monstruos ──
  const monsters = createMonsters(mats, su, q);
  root.add(monsters.root);
  const chase = createChase(mats, su, q);
  root.add(chase.root);

  // ── luz base (se restaura en cada fotograma a partir de aquí; nunca deriva) ──
  const base = {
    sunI: st.sun.intensity, sunC: st.sun.color.clone(), hemiI: st.hemi.intensity, hemiS: st.hemi.color.clone(), hemiG: st.hemi.groundColor.clone(),
    fog: st.U.fogDens.value, env: st.scene.environmentIntensity,
  };
  const coolSun = new THREE.Color(0.55, 0.5, 0.75), flashC = new THREE.Color(0.75, 0.82, 1.0), darkG = new THREE.Color(0.12, 0.08, 0.16);
  const fin = st.post.finish.uniforms as Record<string, { value: number }>;

  let strikeT = -99, nextStrike = 2, introV = 0, introSet = false;
  const dummy = new THREE.Object3D();
  const flashEnv = (d: number) => (d < 0 ? 0 : Math.exp(-d * 9) + (d > 0.13 ? 0.7 * Math.exp(-(d - 0.13) * 11) : 0));

  function update(t: number, dt: number, s: StormState) {
    const fz = s.frontZ, danger = THREE.MathUtils.clamp(s.danger, 0, 1), ins = THREE.MathUtils.clamp(s.inside, 0, 1);
    front.position.z = fz;
    su.uDanger.value = danger;
    gate.update(t);

    // relámpagos: más seguidos cuanto más cerca
    if (t > nextStrike) {
      strikeT = t; nextStrike = t + (1.2 + r() * 4.5) * (1.25 - danger * 0.75);
      const top = new THREE.Vector3(CX + (r() - 0.5) * 60, 78, fz + 6 + r() * 30);
      makeBolt(top, r() < 0.4 ? 0 : 18 + r() * 20);
      su.uFlashPos.value.set(top.x, 30 + r() * 20, top.z);
    }
    const ds = t - strikeT, flash = Math.min(1.6, flashEnv(ds)) * (0.5 + 0.5 * Math.max(danger, ins, 0.4));
    su.uFlash.value = flash;
    bolt.visible = ds >= 0 && ds < 0.32 && (ds < 0.08 || ds > 0.13);

    const show = Math.max(gate.open, fz < GATE_Z - 3 ? 1 : 0, introSet ? 0 : 1);
    wallMat.uniforms.uAlpha.value = 0.85 + 0.15 * show;
    wallMat.uniforms.uNear.value = 16 - 9 * ins;
    curtainM.uniforms.uAlpha.value = 0.4 + 0.6 * show;
    monsters.update(t, fz, danger, show);
    chase.update(t, s.player, danger * show);
    // techo de oscuridad: avanza por delante del jugador y baja con el peligro
    const kc = THREE.MathUtils.smoothstep(danger, 0.1, 1);
    const lead = Math.min(fz - 26, s.player.z - 240 * kc);
    ceil.position.set(CX, 62 - 30 * kc, lead + 450 - fz);

    // lluvia
    rainM.uniforms.uCam.value.copy(st.camera.position);
    rainM.uniforms.uFront.value = fz;
    rainM.uniforms.uAmt.value = Math.min(1, ins * 1.2 + danger * 0.45) * show;

    // escombros: más cuanto más cerca está la tormenta
    const wind = 0.35 + 0.65 * Math.max(danger, ins);
    for (const d of debris) {
      for (let i = 0; i < d.items.length; i++) {
        const it = d.items[i];
        it.life += dt;
        it.v.z += (-(10 + 14 * wind) * d.sp - it.v.z) * Math.min(1, dt * 1.5);
        it.v.y += d.g * dt * (d.g < -2 ? 1 : 0.4); it.v.y += Math.sin(t * 3 + i) * dt * 2;
        it.p.addScaledVector(it.v, dt);
        it.e.set(it.e.x + it.w.x * dt, it.e.y + it.w.y * dt, it.e.z + it.w.z * dt);
        if (it.p.y < 0.05 || it.p.z < fz - 45 || it.p.z > fz + 25) respawn(it, fz, d.sp);
        dummy.position.copy(it.p); dummy.rotation.copy(it.e);
        dummy.scale.setScalar(it.on < wind ? 1 : 0.0001);
        dummy.updateMatrix(); d.im.setMatrixAt(i, dummy.matrix);
      }
      d.im.instanceMatrix.needsUpdate = true;
    }

    // luz de la escena: cae el sol cálido, el cielo se apaga, destellos fríos
    const dark = Math.max(danger * 0.6, ins);
    st.sun.intensity = base.sunI * (1 - 0.5 * danger) * (1 - 0.75 * ins) + flash * 0.6;
    st.sun.color.copy(base.sunC).lerp(coolSun, 0.45 * danger + 0.45 * ins);
    st.hemi.intensity = base.hemiI * (1 - 0.3 * danger - 0.35 * ins) + flash * 1.4;
    st.hemi.color.copy(base.hemiS).lerp(flashC, Math.min(1, flash));
    st.hemi.groundColor.copy(base.hemiG).lerp(darkG, dark * 0.6);
    st.U.fogDens.value = base.fog * (1 + 2.2 * danger + 5 * ins);
    st.scene.environmentIntensity = base.env * (1 - 0.5 * dark);

    // pase final
    if (fin.uStorm) {
      fin.uStorm.value = ins;
      fin.uDanger.value = danger;
      fin.uHurt.value = THREE.MathUtils.clamp((1 - s.life) * 1.15, 0, 1);
      fin.uFlash.value = flash * 0.5 * (0.25 + 0.75 * Math.max(danger, ins));
      fin.uRain.value = ins;
      const kb = THREE.MathUtils.smoothstep(danger, 0.78, 1) * show;
      const bt = (t * 1.25) % 1;
      if (fin.uSmoke) fin.uSmoke.value = Math.max(kb, ins * 0.8);
      if (fin.uBeat) fin.uBeat.value = kb * (Math.exp(-bt * 14) + 0.6 * Math.exp(-Math.max(0, bt - 0.2) * 14) * (bt > 0.2 ? 1 : 0));
    }
  }

  function intro(t01: number) {
    introSet = true;
    if (t01 !== introV) st.renderer.shadowMap.needsUpdate = true;
    introV = t01;
    gate.intro(t01);
  }
  introSet = false;

  /** depuración: fuerza el próximo rayo (segundos desde ahora en tiempo de escena) */
  const strikeIn = (t: number, dtS: number) => { nextStrike = t + dtS; strikeT = -99; };
  return { root, gateZ: GATE_Z, update, intro, strikeIn };
}
