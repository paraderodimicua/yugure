// Protagonista de YŪGURE: corredor de aldea de montaña, físico atlético muy marcado. Animación 100 % procedural.
//   createCharacter(U, mats) → { group, update(dt, state), feet, anchors, info, phase, lockPhase }
// El juego mueve group.position (origen en los pies, mira a -Z, altura ≈ 1,80 m); aquí se anima todo lo demás.
// Convenciones: wallrun → pared a ~0,42 m del origen en el lado wallSide (+1 = derecha, +X);
// ledge → el origen del grupo en el canto superior del borde (dura LEDGE_T s); lean → rad, + = derecha;
// hang/climb → ver climbOffset() en pose.ts (grupo = canto + climbOffset(modeTime)); swing → barra a SWING_H sobre el origen;
// dash → CharState.aim (dirección mundial); side → −1..1 desplazamiento lateral (pasos cruzados).
import * as THREE from 'three';
import type { Shared } from '../stage';
import type { Mats } from '../render/materials';
import { BIND, HEM, K, L_FORE, L_SHIN, L_THIGH, L_UPPER, SCARF_A, SCARF_B, buildModel, type BoneName } from './build';
import { createCloth, type Ball } from './cloth';
import { bongXform, createBong } from './bong';
import {
  I, RP, applySide, lerpPose, mirrorPose, newPose, poseAir, poseBoost, poseBounce, poseClimb, poseDash, poseGlide, poseHang, poseHurt,
  poseBong, poseIdle, poseJump, poseLand, poseLedge, poseRoll, poseRun, poseSlide, poseSwing, poseWall, runParams, type Ctx,
} from './pose';

export type CharMode = 'idle' | 'run' | 'jump' | 'fall' | 'glide' | 'land' | 'roll' | 'wallrun' | 'ledge' | 'slide' | 'boost'
  | 'hang' | 'climb' | 'swing' | 'dash' | 'bounce' | 'hurt' | 'bong';
export const CHAR_MODES: CharMode[] = ['idle', 'run', 'jump', 'fall', 'glide', 'land', 'roll', 'wallrun', 'ledge', 'slide', 'boost', 'hang', 'climb', 'swing', 'dash', 'bounce', 'hurt', 'bong'];
export type CharState = {
  mode: CharMode;
  speed: number; /* m/s, 6–15 */
  vy: number;
  modeTime: number; /* s desde que entró en el modo */
  wallSide?: 1 | -1;
  lean?: number;
  /** −1..1: desplazamiento lateral (+ = derecha) */
  side?: number;
  /** 'swing': ángulo respecto a la vertical (rad), + = pies hacia delante */
  swing?: number;
  /** 'dash': dirección del impulso en mundo (no hace falta normalizar) */
  aim?: THREE.Vector3;
};
export { LEDGE_T, ROLL_T, CLIMB_T, climbOffset, SWING_H, SWING_HAND_Y, BOUNCE_T, HANG_DROP, HANG_WALL } from './pose';
export { BONG_T } from './bong';

const BLEND: Record<CharMode, number> = {
  idle: 0.3, run: 0.18, jump: 0.05, fall: 0.2, glide: 0.22, land: 0.06, roll: 0.08, wallrun: 0.15, ledge: 0.09, slide: 0.14, boost: 0.08,
  hang: 0.1, climb: 0.06, swing: 0.12, dash: 0.05, bounce: 0.05, hurt: 0.15, bong: 0.25,
};
const GROUNDED: Record<CharMode, boolean> = {
  idle: true, run: true, jump: false, fall: false, glide: false, land: true, roll: true, wallrun: false, ledge: false, slide: true, boost: false,
  hang: false, climb: false, swing: false, dash: false, bounce: false, hurt: true, bong: true,
};

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const sat = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function createCharacter(_U: Shared, mats: Mats) {
  const group = new THREE.Group();
  const model = buildModel(mats), bn = model.bones;
  group.add(bn.root, model.mesh);
  const cloth = createCloth(model.mats.red, model.mats.haori);
  group.add(cloth.mesh);

  const off = (a: BoneName, b: BoneName) => new THREE.Vector3(BIND[a][0] - BIND[b][0], BIND[a][1] - BIND[b][1], BIND[a][2] - BIND[b][2]);
  const loc = (p: readonly number[], b: BoneName) => new THREE.Vector3(p[0] - BIND[b][0], p[1] - BIND[b][1], p[2] - BIND[b][2]);
  const O = {
    spine: off('spine', 'hips'), chest: off('chest', 'spine'),
    arm: [off('armL', 'chest'), off('armR', 'chest')], thigh: [off('thighL', 'hips'), off('thighR', 'hips')],
  };
  const armB = [[bn.armL, bn.foreL, bn.handL], [bn.armR, bn.foreR, bn.handR]];
  const legB = [[bn.thighL, bn.shinL, bn.footL, bn.toeL], [bn.thighR, bn.shinR, bn.footR, bn.toeR]];
  const browY = bn.browL.position.y;

  // anclajes para estelas / efectos
  const mkAnchor = (parent: THREE.Object3D, x: number, y: number, z: number) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const anchors = {
    handL: mkAnchor(bn.handL, 0, -0.075, 0), handR: mkAnchor(bn.handR, 0, -0.075, 0),
    chest: mkAnchor(bn.chest, 0, 0.12, -0.02), scarfTip: mkAnchor(group, 0, 1.4, 0.6),
    mouth: mkAnchor(bn.head, 0, BIND.mouth[1] - BIND.head[1], BIND.mouth[2] - BIND.head[2] - 0.012), bowl: null as unknown as THREE.Object3D,
  };
  const bong = createBong(mats); bn.chest.add(bong.obj); anchors.bowl = bong.bowl;
  const BX = { x: 0, y: 0, z: 0, tilt: 0, scale: 1, hold: 1, burn: 0 };

  // ── temporales (sin reservas por fotograma) ──
  const cur = newPose(), from = newPose(), tgt = newPose();
  const eul = new THREE.Euler(0, 0, 0, 'YXZ'), mt = new THREE.Matrix4(), mi = new THREE.Matrix4();
  const qB = Q(), qBi = Q(), qH = Q(), qS = Q(), qC = Q(), qT = Q(), q1 = Q(), q2 = Q(), qF = Q(), qP = Q(), qG = Q();
  const hipsP = V(), chestP = V(), sh = V(), tg = V(), tA = V(), pole = V(), rootP = V(), tmp = V();
  const d = V(), pp = V(), d1 = V(), d2 = V(), ax = V(), ay = V(), az = V(), knee = V();
  const ctx: Ctx = { phase: 0, speed: 0, vy: 0, t: 0, time: 0, wall: 1, impact: 0, side: 0, swing: 0, swingV: 0, ax: 0, ay: 0, az: -1 };

  /** IK analítico de dos huesos; el hueso apunta a -Y local; fwd = +1 si el codo/rodilla va hacia -Z local */
  function ik(root: THREE.Vector3, target: THREE.Vector3, pl: THREE.Vector3, l1: number, l2: number, fwd: number, o1: THREE.Quaternion, o2: THREE.Quaternion) {
    d.subVectors(target, root);
    let L = d.length(); if (L < 1e-5) { d.set(0, -1, 0); L = 1e-5; }
    d.multiplyScalar(1 / L);
    L = Math.min(Math.max(L, Math.abs(l1 - l2) + 0.03), (l1 + l2) * 0.999);
    const cA = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), sA = Math.sqrt(Math.max(0, 1 - cA * cA));
    pp.copy(pl).addScaledVector(d, -pl.dot(d));
    if (pp.lengthSq() < 1e-6) pp.set(0.3, 0.2, 1).addScaledVector(d, -d.dot(pp));
    pp.normalize();
    d1.copy(d).multiplyScalar(cA).addScaledVector(pp, sA);
    knee.copy(root).addScaledVector(d1, l1);
    d2.copy(root).addScaledVector(d, L).sub(knee).normalize();
    for (let i = 0; i < 2; i++) {
      const dir = i ? d2 : d1;
      ay.copy(dir).negate();
      az.copy(pp).addScaledVector(ay, -pp.dot(ay));
      if (az.lengthSq() < 1e-6) az.copy(d).multiplyScalar(i ? 1 : -1);
      az.normalize().multiplyScalar(-fwd);
      ax.crossVectors(ay, az);
      mt.makeBasis(ax, ay, az);
      (i ? o2 : o1).setFromRotationMatrix(mt);
    }
  }

  let leanS = 0;
  function applyPose(p: Float32Array) {
    // cuerpo entero: giro alrededor del pivote + aplastar/estirar (todo en espacio de pose, ×K al grupo)
    qB.setFromEuler(eul.set(-p[I.bPitch], p[I.bYaw], p[I.bRoll] - leanS));
    qBi.copy(qB).invert();
    const st = Math.max(0.6, p[I.stretch]), sx = 1 / Math.sqrt(st);
    tmp.set(0, p[I.pivY], 0).applyQuaternion(qB);
    rootP.set(p[I.rx] - tmp.x, p[I.ry] + p[I.pivY] - tmp.y, p[I.rz] - tmp.z);
    bn.root.position.copy(rootP).multiplyScalar(K); bn.root.quaternion.copy(qB); bn.root.scale.set(sx * K, st * K, sx * K);
    // columna
    hipsP.set(p[I.hx], p[I.hy], p[I.hz]);
    qH.setFromEuler(eul.set(-p[I.hPitch], p[I.hYaw], p[I.hRoll]));
    bn.hips.position.copy(hipsP); bn.hips.quaternion.copy(qH);
    qS.setFromEuler(eul.set(-p[I.sPitch] * 0.5, p[I.sYaw] * 0.5, p[I.sRoll] * 0.5));
    bn.spine.quaternion.copy(qS); bn.chest.quaternion.copy(qS);
    qT.multiplyQuaternions(qH, qS);
    chestP.copy(O.spine).applyQuaternion(qH).add(hipsP).add(tmp.copy(O.chest).applyQuaternion(qT));
    qC.multiplyQuaternions(qT, qS);
    bn.neck.quaternion.setFromEuler(eul.set(-p[I.nPitch] * 0.4, p[I.nYaw] * 0.4, p[I.nRoll] * 0.4));
    bn.head.quaternion.setFromEuler(eul.set(-p[I.nPitch] * 0.6, p[I.nYaw] * 0.6, p[I.nRoll] * 0.6));
    // brazos (las manos se apartan de los dorsales: el físico no deja pegar los brazos al cuerpo)
    for (let s = 0; s < 2; s++) {
      const b = s ? I.aRx : I.aLx, B = armB[s], sg = s ? 1 : -1;
      sh.copy(O.arm[s]).applyQuaternion(qC).add(chestP);
      tg.set(p[b], p[b + 1], p[b + 2]);
      const need = 0.1 * sat(-tg.y / 0.25) * sat(1 - Math.abs(tg.z) / 0.32), a = sg * tg.x;
      if (a < need) tg.x = sg * (need - (need - a) * 0.3);
      tg.applyQuaternion(qC).add(sh);
      if (p[b + 7] > 0.001) {
        tA.set(p[b + 8], p[b + 9], p[b + 10]).sub(rootP).applyQuaternion(qBi); tA.x /= sx; tA.y /= st; tA.z /= sx;
        tg.lerp(tA, sat(p[b + 7]));
      }
      pole.set(p[b + 3] + sg * 0.45, p[b + 4], p[b + 5]).applyQuaternion(qC);
      ik(sh, tg, pole, L_UPPER, L_FORE, -1, q1, q2);
      B[0].quaternion.copy(qP.copy(qC).invert()).multiply(q1);
      B[1].quaternion.copy(qP.copy(q1).invert()).multiply(q2);
      B[2].quaternion.setFromEuler(eul.set(-p[b + 6], 0, (s ? -1 : 1) * 0.12));
    }
    // piernas
    for (let s = 0; s < 2; s++) {
      const b = s ? I.fRx : I.fLx, B = legB[s], sg = s ? 1 : -1;
      sh.copy(O.thigh[s]).applyQuaternion(qH).add(hipsP);
      tg.set(p[b], p[b + 1], p[b + 2]);
      pole.set(sg * p[b + 5], 0.12, -1);
      ik(sh, tg, pole, L_THIGH, L_SHIN, 1, q1, q2);
      B[0].quaternion.copy(qP.copy(qH).invert()).multiply(q1);
      B[1].quaternion.copy(qP.copy(q1).invert()).multiply(q2);
      qF.setFromEuler(eul.set(p[b + 3], p[b + 6] + p[I.hYaw] * 0.5, 0));
      B[2].quaternion.copy(qP.copy(q2).invert()).multiply(qF);
      B[3].quaternion.setFromEuler(eul.set(p[b + 4], 0, 0));
    }
  }

  // ── colisiones y anclajes de tela ──
  const bHead: Ball = { c: V(), r: 0.12 }, bChest: Ball = { c: V(), r: 0.17 }, bHips: Ball = { c: V(), r: 0.18 };
  const bPel: Ball = { c: V(), r: 0.19 }, bTh: Ball[] = [0, 1, 2, 3].map(() => ({ c: V(), r: 0.13 }));
  const scarfBalls = [bHead, bChest, bHips], legBalls = [bPel, ...bTh];
  const pinsL: { b: THREE.Bone; v: THREE.Vector3 }[] = [{ b: bn.neck, v: loc(SCARF_A, 'neck') }, { b: bn.neck, v: loc(SCARF_B, 'neck') }];
  for (let i = 0; i < cloth.TW; i++) {
    const a = HEM.open + ((Math.PI * 2 - 2 * HEM.open) * i) / (cloth.TW - 1);
    pinsL.push({ b: bn.hips, v: loc([HEM.rx * Math.sin(a), HEM.y + 0.004, HEM.cz - HEM.rz * Math.cos(a)], 'hips') });
  }
  const pinsW = pinsL.map(() => V());
  const armsW = [0, 1].map(() => [V(), V(), V(), V(), V()]);
  const armpit = [new THREE.Vector3(-0.19, 0.12, 0.04), new THREE.Vector3(0.19, 0.12, 0.04)], waist = [new THREE.Vector3(-0.16, 0.0, 0.06), new THREE.Vector3(0.16, 0.0, 0.06)];
  const lastPos = V(), nowPos = V(), moved = V();

  // ── estado ──
  let mode: CharMode | null = null, blendT = 0, blendDur = 0, phase = 0, time = 0, mirror = false, impact = 0, lastVy = 0, phaseLock = false;
  let blinkT = 2, blink = 0, vSm = 0, lastY = 0, nod = 0, first = true, sideS = 0, lastSwing = 0, swingV = 0;

  function update(dt: number, s: CharState) {
    time += dt;
    runParams(s.speed);
    if (s.mode !== mode) {
      const prev = mode;
      from.set(cur);
      from[I.bPitch] -= Math.round(from[I.bPitch] / (Math.PI * 2)) * Math.PI * 2;
      blendT = 0; blendDur = prev === null ? 0 : BLEND[s.mode];
      if (s.mode === 'run' && (prev === 'land' || prev === 'roll' || prev === 'ledge' || prev === 'wallrun' || prev === 'climb')) blendDur = 0.12;
      if ((s.mode === 'fall' && (prev === 'jump' || prev === 'bounce' || prev === 'dash')) || (s.mode === 'jump' && prev === 'fall')) blendDur = 0.1;
      if (s.mode === 'climb' && prev === 'hang') blendDur = 0.04;
      if ((s.mode === 'jump' || s.mode === 'fall' || s.mode === 'boost') && prev !== null && GROUNDED[prev]) mirror = phase < 0.25 || phase > 0.75;
      if ((s.mode === 'land' || s.mode === 'roll') && prev !== null && !GROUNDED[prev] && !phaseLock) { phase = mirror ? 0.5 : 0; impact = sat(-lastVy / 16); }
      if (s.mode === 'swing') { lastSwing = s.swing ?? 0; swingV = 0; }
      mode = s.mode;
    }
    if (!phaseLock) { phase += (dt / RP.T) * (mode === 'wallrun' ? 1.12 : mode === 'hurt' ? 0.8 + 0.25 * Math.sin(time * 3.7) : 1); phase -= Math.floor(phase); }
    lastVy = s.vy;
    // velocidad de la barra y dirección del dash en espacio del grupo
    const sw = s.swing ?? 0;
    if (dt > 0) swingV += ((sw - lastSwing) / dt - swingV) * (1 - Math.exp(-dt / 0.06));
    lastSwing = sw;
    group.updateWorldMatrix(true, false);
    if (s.aim) {
      mt.extractRotation(group.matrixWorld); qG.setFromRotationMatrix(mt).invert();
      tmp.copy(s.aim).applyQuaternion(qG); if (tmp.lengthSq() < 1e-8) tmp.set(0, 0, -1); tmp.normalize();
      ctx.ax = tmp.x; ctx.ay = tmp.y; ctx.az = tmp.z;
    } else { ctx.ax = 0; ctx.ay = 0.15; ctx.az = -1; }
    ctx.phase = phase; ctx.speed = s.speed; ctx.vy = s.vy; ctx.t = s.modeTime; ctx.time = time; ctx.wall = s.wallSide ?? 1; ctx.impact = impact;
    ctx.swing = sw; ctx.swingV = swingV;
    switch (mode) {
      case 'idle': poseIdle(tgt, ctx); break;
      case 'run': poseRun(tgt, ctx); break;
      case 'jump': poseJump(tgt, ctx); break;
      case 'fall': poseAir(tgt, ctx); break;
      case 'glide': poseGlide(tgt, ctx); break;
      case 'land': poseLand(tgt, ctx); break;
      case 'roll': poseRoll(tgt, ctx); break;
      case 'wallrun': poseWall(tgt, ctx); break;
      case 'ledge': poseLedge(tgt, ctx); break;
      case 'slide': poseSlide(tgt, ctx); break;
      case 'boost': poseBoost(tgt, ctx); break;
      case 'hang': poseHang(tgt, ctx); break;
      case 'climb': poseClimb(tgt, ctx); break;
      case 'swing': poseSwing(tgt, ctx); break;
      case 'dash': poseDash(tgt, ctx); break;
      case 'bounce': poseBounce(tgt, ctx); break;
      case 'hurt': poseHurt(tgt, ctx); break;
      case 'bong': poseBong(tgt, ctx); break;
    }
    if (mirror && (mode === 'jump' || mode === 'fall' || mode === 'boost')) mirrorPose(tgt);
    sideS += ((s.side ?? 0) - sideS) * (1 - Math.exp(-dt / 0.15));
    if (mode === 'run' || mode === 'hurt' || mode === 'land') applySide(tgt, sideS * sat(s.speed / 4), phase);
    blendT += dt;
    let w = blendDur > 0 ? sat(blendT / blendDur) : 1; w = w * w * (3 - 2 * w);
    lerpPose(cur, from, tgt, w);

    // seguimiento: la cabeza cabecea con retraso según la aceleración vertical
    nowPos.setFromMatrixPosition(group.matrixWorld);
    const y = nowPos.y + (cur[I.hy] + cur[I.ry]) * K;
    if (first || dt <= 0) { lastY = y; lastPos.copy(nowPos); }
    const vyW = dt > 0 ? Math.max(-20, Math.min(20, (y - lastY) / dt)) : 0; lastY = y;
    vSm += (vyW - vSm) * (1 - Math.exp(-dt / 0.07));
    nod += (Math.max(-0.22, Math.min(0.22, (vyW - vSm) * 0.035)) - nod) * (1 - Math.exp(-dt / 0.04));
    leanS += ((s.lean ?? 0) - leanS) * (1 - Math.exp(-dt / 0.12));
    cur[I.nPitch] += nod; cur[I.sPitch] += nod * 0.3;
    applyPose(cur);
    cur[I.nPitch] -= nod; cur[I.sPitch] -= nod * 0.3;

    // cara: parpadeo y expresión
    blinkT -= dt;
    if (blinkT < 0) { blinkT = 1.8 + Math.random() * 3.5; blink = 0.14; }
    blink = Math.max(0, blink - dt);
    const bl = blink > 0 ? Math.sin((Math.PI * blink) / 0.14) : 0, sq = sat(-cur[I.brow]) * 0.3;
    bn.eyes.scale.y = Math.max(0.1, 1 - 0.9 * bl - sq);
    bn.browL.position.y = bn.browR.position.y = browY + cur[I.brow] * 0.006 - bl * 0.003;
    bn.browL.rotation.z = -cur[I.browTilt] * 0.3; bn.browR.rotation.z = cur[I.browTilt] * 0.3;
    bn.mouth.scale.set(1 - 0.3 * cur[I.mouth] + 0.35 * cur[I.mouthW], 1 + 3.5 * cur[I.mouth], 1);

    // bong
    bong.obj.visible = mode === 'bong' && s.modeTime < 2.6;
    if (bong.obj.visible) {
      bongXform(s.modeTime, BX);
      bong.obj.position.set(BX.x, BX.y, BX.z); bong.obj.rotation.set(BX.tilt, 0, 0); bong.obj.scale.setScalar(Math.max(1e-3, BX.scale));
      bong.update(time, BX.burn);
    }

    // tela (en mundo)
    bn.root.updateMatrixWorld(true);
    moved.subVectors(nowPos, lastPos);
    lastPos.copy(nowPos);
    bHead.c.set(0, 0.1, 0).applyMatrix4(bn.head.matrixWorld);
    bChest.c.set(0, 0.09, 0.03).applyMatrix4(bn.chest.matrixWorld);
    bHips.c.set(0, 0, 0).applyMatrix4(bn.hips.matrixWorld);
    bPel.c.set(0, -0.03, 0.01).applyMatrix4(bn.hips.matrixWorld);
    bTh[0].c.set(0, -0.14, 0).applyMatrix4(bn.thighL.matrixWorld); bTh[1].c.set(0, -0.32, 0).applyMatrix4(bn.thighL.matrixWorld);
    bTh[2].c.set(0, -0.14, 0).applyMatrix4(bn.thighR.matrixWorld); bTh[3].c.set(0, -0.32, 0).applyMatrix4(bn.thighR.matrixWorld);
    for (let i = 0; i < pinsL.length; i++) pinsW[i].copy(pinsL[i].v).applyMatrix4(pinsL[i].b.matrixWorld);
    for (let sI = 0; sI < 2; sI++) {
      const A = armsW[sI], B = armB[sI];
      A[0].setFromMatrixPosition(B[0].matrixWorld); A[1].setFromMatrixPosition(B[1].matrixWorld); A[2].setFromMatrixPosition(B[2].matrixWorld);
      A[3].copy(armpit[sI]).applyMatrix4(bn.chest.matrixWorld); A[4].copy(waist[sI]).applyMatrix4(bn.spine.matrixWorld);
    }
    cloth.update(dt, time, group, pinsW, armsW, scarfBalls, legBalls, mode && GROUNDED[mode] ? nowPos.y + 0.025 : -1e9, cur[I.glide]);
    mi.copy(group.matrixWorld).invert();
    anchors.scarfTip.position.copy(cloth.tip(tmp)).applyMatrix4(mi);
    anchors.scarfTip.updateMatrixWorld();
    first = false;
  }

  return {
    group, update,
    feet: { left: bn.footL as THREE.Object3D, right: bn.footR as THREE.Object3D },
    /** puntos de enganche (Object3D, leer con getWorldPosition) para estelas y efectos */
    anchors,
    /** bong de cristal (solo visible en el modo 'bong') */
    bong: bong.obj as THREE.Object3D,
    /** extras de depuración */
    info: { tris: model.tris + cloth.tris, drawCalls: 7, buildMs: model.ms },
    get phase() { return phase; },
    set phase(v: number) { phase = v - Math.floor(v); },
    lockPhase(on: boolean) { phaseLock = on; },
  };
}
