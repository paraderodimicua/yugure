// Visor del protagonista: http://localhost:5183/dev/personaje.html
// Bucle de demostración con física simple que recorre todos los modos.
// Consola:  __demo.set('run', 0, 9, 0.3)  congela una pose (modo, modeTime, velocidad, fase de carrera)
//           __demo.play()  reanuda · __demo.seek('jump', 0.05)  avanza hasta ese instante y pausa
//           __demo.step(n)  avanza n pasos de 1/60 · __demo.cam.set(x,y,z)  cámara relativa al personaje
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';
import { createCharacter, climbOffset, CLIMB_T, HANG_DROP, HANG_WALL, LEDGE_T, ROLL_T, SWING_H, BOUNCE_T, BONG_T, type CharMode, type CharState } from '../player/character';
import { createTrail } from '../player/trail';

const st = createStage({ cam: [3, 1.6, 3], look: [0, 0.9, 0], focus: [0, 0, 0], shadowHalf: 7, dynamicShadows: true });
st.view.sway = false;
const mats = createMaterials(st.U);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mats.cobble);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; st.scene.add(ground);
const posts: THREE.Mesh[] = [];
for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1 + (i % 3) * 0.5, 0.25), mats.woodWarm); m.castShadow = true; st.scene.add(m); posts.push(m); }
const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 14), mats.plasterAged); wall.receiveShadow = true; wall.visible = false; st.scene.add(wall);
const block = new THREE.Mesh(new THREE.BoxGeometry(3, 1.7, 9), mats.stone); block.receiveShadow = block.castShadow = true; block.visible = false; st.scene.add(block);
const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 16), mats.woodDark); rail.visible = false; st.scene.add(rail);

const ch = createCharacter(st.U, mats);
st.scene.add(ch.group);
console.log('[personaje]', ch.info);
const trail = createTrail(st.U); st.scene.add(trail.mesh);
const trailPts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3, 8), mats.woodDark); bar.rotation.z = Math.PI / 2; bar.visible = false; st.scene.add(bar);
const canto = new THREE.Vector3(), co = { y: 0, z: 0 };

const G = 28;
const s: CharState = { mode: 'idle', speed: 0, vy: 0, modeTime: 0, wallSide: 1, side: 0, swing: 0, aim: new THREE.Vector3(0, 0.2, -1) };
let y = 0, floor = 0, seg = 0, segT = 0, frozen = false, paused = false;
const go = (m: CharMode) => { s.mode = m; s.modeTime = 0; };
// guion: cada tramo devuelve true cuando termina
const script: (() => boolean)[] = [
  () => { if (segT === 0) { go('idle'); s.speed = 0; } return segT > 2.5; },
  () => { if (segT === 0) go('run'); s.speed = Math.min(9, 6 + segT * 1.5); return segT > 2.6; },
  () => air(9.5, false),
  () => { if (segT === 0) go('run'); return segT > 1.2; },
  () => air(13, true),
  () => { if (segT === 0) go('run'); s.speed = Math.min(12, s.speed + 0.03); return segT > 1.4; },
  () => { // pared
    if (segT === 0) { go('wallrun'); s.wallSide = 1; wall.visible = true; wall.position.set(ch.group.position.x + 0.42 + 0.19, 1.6, ch.group.position.z - 5.5); }
    y = 0.9 + 0.5 * Math.sin(Math.min(1, segT / 1.1) * Math.PI);
    if (segT > 1.1) { s.vy = 3; return true; } return false;
  },
  () => fallTo(),
  () => { if (segT === 0) go('run'); return segT > 1.0; },
  () => { if (segT === 0) { go('slide'); rail.visible = true; rail.position.set(ch.group.position.x, -0.02, ch.group.position.z - 6); } if (segT > 1.3) { rail.visible = false; return true; } return false; },
  () => { if (segT === 0) go('run'); return segT > 0.9; },
  () => { if (segT === 0) { go('boost'); s.speed = 15; } y += (2.2 - y) * 0.08; s.vy = 0; if (segT > 0.9) { s.vy = 1; return true; } return false; },
  () => fallTo(),
  () => { if (segT === 0) go('run'); s.speed = Math.max(9, s.speed - 0.05); return segT > 1.2; },
  () => { // salto hacia un bloque y agarre del borde
    if (segT === 0) { go('jump'); s.vy = 8.5; block.visible = true; block.position.set(ch.group.position.x, 0.85, ch.group.position.z - 0.5 * s.speed - 4.5 - 0.02); }
    s.vy -= G * dtCur; y += s.vy * dtCur; if (s.vy < 0 && s.mode === 'jump') go('fall');
    if (ch.group.position.z < block.position.z + 4.5 + 0.25) { go('ledge'); ch.group.position.z = block.position.z + 4.5; y = 1.7; floor = 1.7; s.vy = 0; return true; }
    return false;
  },
  () => { spd = s.speed * Math.min(1, Math.max(0.05, (segT - 0.3) / 0.3)); return segT > LEDGE_T; },
  () => { if (segT === 0) go('run'); if (ch.group.position.z < block.position.z - 4.5) { floor = 0; go('fall'); s.vy = 0; return true; } return false; },
  () => fallTo(),
  () => { if (segT === 0) go('run'); s.side = Math.sin(segT * 2.2); return segT > 2.8; },
  () => { s.side = 0; if (segT === 0) { go('jump'); s.vy = 6; } s.vy -= G * dtCur; y += s.vy * dtCur; if (segT > 0.25) { go('dash'); s.aim!.set(0, 0.25, -1); s.vy = 0; return true; } return false; },
  () => { y += 1.5 * dtCur; spd = 22; return segT > 0.6; },
  () => fallTo(),
  () => { if (segT === 0) go('run'); return segT > 0.8; },
  () => { if (segT === 0) { go('bounce'); s.vy = 11; } s.vy -= G * dtCur; y += s.vy * dtCur; return segT > BOUNCE_T; },
  () => fallTo(),
  () => { if (segT === 0) { go('hang'); placeCanto(); } spd = 0; return segT > 1.6; },
  () => { if (segT === 0) go('climb'); spd = 0; return segT > CLIMB_T; },
  () => { if (segT === 0) { go('idle'); block.visible = false; } y = 0; floor = 0; spd = 0; return segT > 0.6; },
  () => { if (segT === 0) { go('swing'); bar.visible = true; bar.position.set(ch.group.position.x, SWING_H, ch.group.position.z); y = 0; } spd = 0; s.swing = 0.9 * Math.sin(segT * 2.6) * Math.min(1, segT); return segT > 4; },
  () => { if (segT === 0) { go('hurt'); bar.visible = false; s.swing = 0; s.speed = 4; } return segT > 2.5; },
  () => { if (segT === 0) { go('bong'); s.speed = 0; } spd = 0; return segT > BONG_T + 0.5; },
  () => { if (segT === 0) { go('run'); s.speed = 9; } return segT > 1.5; },
];
/** coloca un bloque cuyo canto queda delante de las manos del colgado */
function placeCanto() {
  canto.set(ch.group.position.x, Math.max(y, 0) + HANG_DROP, ch.group.position.z - HANG_WALL);
  block.visible = true; block.position.set(canto.x, canto.y - 0.85, canto.z - 4.5);
}
let dtCur = 0, spd = -1, airPhase = 0, wantRoll = false;
function fallTo() {
  if (s.mode !== 'land' && s.mode !== 'roll') {
    if (s.mode !== 'fall' && s.mode !== 'jump') go('fall');
    if (s.vy < 0 && s.mode === 'jump') go('fall');
    s.vy -= G * dtCur; y += s.vy * dtCur;
    if (y <= floor) { y = floor; const hard = s.vy < -13 || wantRoll; wantRoll = false; s.vy = 0; go(hard ? 'roll' : 'land'); }
    return false;
  }
  return s.modeTime > (s.mode === 'roll' ? ROLL_T : 0.3);
}
function air(v0: number, glide: boolean) {
  if (segT === 0) { go('jump'); s.vy = v0; airPhase = 0; }
  if (glide && airPhase === 0 && s.vy < 1) { go('glide'); airPhase = 1; }
  if (airPhase === 1) { s.vy += (-1.6 - s.vy) * 0.1; y += s.vy * dtCur; if (s.modeTime > 1.6) { airPhase = 2; wantRoll = true; go('fall'); } return false; }
  return fallTo();
}

const cam = new THREE.Vector3(2.6, 1.3, 1.6), lookOff = new THREE.Vector3(0, 0.9, 0);
function advance(dt: number) {
  dtCur = dt;
  if (!frozen) {
    spd = -1;
    const done = script[seg]();
    segT += dt; s.modeTime += dt;
    if (done) { seg = (seg + 1) % script.length; segT = 0; if (seg === 0) { block.visible = wall.visible = false; } }
  }
  const moving = s.mode !== 'idle' && s.mode !== 'hang' && s.mode !== 'climb' && s.mode !== 'swing' && s.mode !== 'bong';
  ch.group.position.z -= (spd >= 0 ? spd : moving ? s.speed : 0) * dt;
  ch.group.position.y = y;
  if (s.mode === 'hang' || s.mode === 'climb') {
    climbOffset(s.mode === 'climb' ? s.modeTime : 0, co);
    ch.group.position.set(canto.x, canto.y + co.y, canto.z + co.z); y = ch.group.position.y;
  }
  if (ch.group.position.z < -20) { // el mundo se recoloca para no alejarse del origen
    const dz = -ch.group.position.z; ch.group.position.z += dz; wall.position.z += dz; block.position.z += dz; rail.position.z += dz;
    for (const p of posts) p.position.z += dz;
  }
  posts.forEach((p, i) => { if (p.position.z > ch.group.position.z + 12 || p.position.z < ch.group.position.z - 40 || p.position.y === 0) p.position.set((i % 2 ? 1 : -1) * (2.2 + (i % 3)), (p.geometry as THREE.BoxGeometry).parameters.height / 2, ch.group.position.z - 14 - i * 2.1); });
  ch.update(dt, s);
  const A = ch.anchors;
  const inten = s.mode === 'dash' || s.mode === 'bounce' || s.mode === 'boost' || s.mode === 'wallrun' ? 1 : s.mode === 'run' && s.speed > 11 ? 0.5 : 0;
  trail.update(dt, [A.handL.getWorldPosition(trailPts[0]), A.handR.getWorldPosition(trailPts[1]), A.scarfTip.getWorldPosition(trailPts[2])], inten);
}
st.onTick((_t, dt) => {
  if (!paused) advance(dt * demo.rate);
  st.view.pos.copy(ch.group.position).add(cam); st.view.pos.y = cam.y + (demo.followY ? ch.group.position.y : 0);
  st.view.look.copy(ch.group.position).add(lookOff); if (!demo.followY) st.view.look.y = lookOff.y + ch.group.position.y * 0.6;
  st.sun.target.position.copy(ch.group.position); st.sun.position.copy(ch.group.position).addScaledVector(st.U.sunDir.value, 200);
});

const demo = {
  rate: 1, followY: false, cam, lookOff, state: s, ch,
  /** congela una pose; el personaje sigue avanzando para que la tela vuele */
  set(mode: CharMode, modeTime = 0, speed = 9, phase?: number, vy = 0, yy = 0, extra: { swing?: number; aim?: number[]; side?: number } = {}) {
    frozen = true; paused = false; s.mode = mode; s.modeTime = modeTime; s.speed = speed; s.vy = vy; y = yy;
    s.swing = extra.swing ?? 0; s.side = extra.side ?? 0; if (extra.aim) s.aim!.set(extra.aim[0], extra.aim[1], extra.aim[2]);
    block.visible = false; bar.visible = mode === 'swing'; if (bar.visible) bar.position.set(ch.group.position.x, SWING_H + yy, ch.group.position.z);
    if (mode === 'hang' || mode === 'climb') { y = yy; ch.group.position.y = yy; climbOffset(0, co); canto.set(ch.group.position.x, yy + HANG_DROP, ch.group.position.z - HANG_WALL); block.visible = true; block.position.set(canto.x, canto.y - 0.85, canto.z - 4.5); }
    ch.lockPhase(phase !== undefined); if (phase !== undefined) ch.phase = phase;
    wall.visible = mode === 'wallrun'; if (wall.visible) wall.position.set(ch.group.position.x + 0.61, 1.6, ch.group.position.z - 5);
    for (let i = 0; i < 90; i++) { if (wall.visible) wall.position.z = ch.group.position.z; advance(1 / 60); }
    paused = true;
  },
  play() { frozen = false; paused = false; ch.lockPhase(false); seg = 0; segT = 0; y = 0; floor = 0; block.visible = wall.visible = false; },
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) advance(dt); paused = true; },
  /** avanza el guion hasta que el modo sea `mode` con modeTime ≥ t, y pausa */
  seek(mode: CharMode, t = 0, max = 4000) {
    frozen = false; ch.lockPhase(false);
    for (let i = 0; i < max; i++) { advance(1 / 60); if (s.mode === mode && s.modeTime >= t) break; }
    paused = true; return `${s.mode} ${s.modeTime.toFixed(3)} vy=${s.vy.toFixed(1)}`;
  },
  pause(on = true) { paused = on; },
};
(window as any).__demo = demo;
st.start();
