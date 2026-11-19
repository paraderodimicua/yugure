// Partida: control libre del protagonista, cámara de persecución, intro con la compuerta, tormenta que
// persigue y quita vida, mejoras permanentes por distancia, potenciadores, impulso apuntado con el ratón
// a cámara lenta, origen flotante y reinicio.
import * as THREE from 'three';
import type { Stage } from '../stage';
import * as Char from '../player/character';
import type { CharState } from '../player/character';
import type { Mats } from '../render/materials';
import type { createStreet, PowerKind } from './street';
import { createFx } from './fx';
import { createTrail } from '../player/trail';
import { createPillars } from './pillars';
import { topAt, type Physics } from './physics';
import { createPlayer, BASE_UP, type Upgrades, type PMode } from './player';
import type { Hud } from './hud';
import type { StormState, Collider } from './contracts';
import { createTunnelMesh, BIOMES, TUNNEL_LEN } from './tunnel';

type Street = ReturnType<typeof createStreet>;
export type Layer = { root?: THREE.Object3D; update(playerZ: number, t: number): void; shift(dz: number): void };
export type StormFx = { root: THREE.Group; gateZ: number; update(t: number, dt: number, s: StormState): void; intro(t01: number): void; strikeIn?: (t: number, dt: number) => void };

const SHIFT_AT = -500;
const UPGRADE_EVERY = 150;
const UPGRADES: { name: string; sub: string; apply(u: Upgrades): void }[] = [
  { name: 'Doble salto', sub: 'pulsa ESPACIO otra vez en el aire', apply: (u) => { u.jumps = 2; } },
  { name: 'Impulso ágil', sub: 'el impulso empuja más fuerte', apply: (u) => { u.dashPower = 1.25; } },
  { name: 'Zancada', sub: '+12 % de velocidad', apply: (u) => { u.speed *= 1.12; } },
  { name: 'Planeo', sub: 'mantén ESPACIO al caer', apply: (u) => { u.glide = true; } },
  { name: 'Salto alto', sub: '+12 % de altura', apply: (u) => { u.jumpMul *= 1.12; } },
  { name: 'Piel de trueno', sub: 'la tormenta te daña menos', apply: (u) => { u.stormRes = Math.min(0.7, u.stormRes + 0.35); } },
  { name: 'Doble impulso', sub: 'dos cargas de impulso', apply: (u) => { u.dashCharges = 2; } },
  { name: 'Viento a favor', sub: '+10 % de velocidad', apply: (u) => { u.speed *= 1.1; } },
];

export function createRun(st: Stage, mats: Mats, street: Street, hud: Hud, physics: Physics, layers: Layer[] = [], storm?: StormFx) {
  const ch = Char.createCharacter(st.U, mats);
  st.scene.add(ch.group);
  const fx = createFx();
  st.scene.add(fx.points);
  const climbT: number = (Char as any).CLIMB_T ?? (Char as any).LEDGE_T ?? 0.62;
  const NATIVE = new Set<string>(['idle', 'run', 'jump', 'fall', 'glide', 'land', 'roll', 'wallrun', 'ledge', 'slide', 'boost', ...(((Char as any).CHAR_MODES as string[]) ?? [])]);

  const BACK_X = -8.5, BACK_Y = 3.4, WALL_X = BACK_X + 1.2 + 2;
  // intro: bongazo → humo oscuro hacia la compuerta → la compuerta revienta → a correr
  const BT: number = (Char as any).BONG_T ?? 3.2;
  const T_SMOKE = BT + 1.2, T_GATE = T_SMOKE + 3.2, T_END = T_GATE + 1.3;
  let bongMesh: THREE.Object3D | null = (ch as any).bong ?? null;
  if (!bongMesh) {
    // bong de reserva mientras el personaje no traiga el suyo
    const g = new THREE.Group();
    const prof = [[0.0, 0], [0.07, 0], [0.075, 0.02], [0.075, 0.1], [0.05, 0.16], [0.028, 0.2], [0.026, 0.42], [0.03, 0.44]].map(([x, y]) => new THREE.Vector2(x, y));
    const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), mats.glass); g.add(glass);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.07, 14), mats.water); water.position.y = 0.045; g.add(water);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), mats.metalDark); stem.position.set(0.05, 0.1, 0); stem.rotation.z = -0.8; g.add(stem);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mats.glow(0xff7a30, 2.5)); bowl.position.set(0.09, 0.14, 0); g.add(bowl);
    g.position.set(0.02, 1.12, -0.3); g.rotation.x = 0.25;
    ch.group.add(g); bongMesh = g;
  }
  const NATIVE_BONG = NATIVE.has('bong');
  const player = createPlayer(physics, {
    baseGround: (x) => (x < WALL_X ? BACK_Y : 0),
    clampX: (x) => THREE.MathUtils.clamp(x, -30, 21),
    wallX: WALL_X, wallTop: BACK_Y,
  }, climbT, {
    hangDrop: (Char as any).HANG_DROP ?? 1.75, hangWall: (Char as any).HANG_WALL ?? 0.38,
    swingHand: (Char as any).SWING_HAND_Y ?? 2.05, climbOffset: (Char as any).climbOffset,
  });
  const trail = createTrail(st.U); st.scene.add(trail.mesh);
  const trailPts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const up: Upgrades = { ...BASE_UP };
  player.setUpgrades(up);
  const gained: string[] = [];

  // ---------------------------------------------------------------- entrada
  const keys = new Set<string>();
  let jumpPressed = false, mouseX = innerWidth / 2, mouseY = innerHeight / 2, aiming = false, aimReal = 0;
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { hud.toggleMenu(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat && e.code === 'Space') jumpPressed = true;
    if (!e.repeat && e.code === 'KeyP') st.shot(`foto_${Date.now()}.jpg`, 1920, 1080).then(() => hud.toast('Foto guardada'));
    keys.add(e.code);
    if (phase === 'dead' && e.code === 'Space') location.reload();
    if (phase === 'intro' && e.code === 'Space' && introT < T_SMOKE) { introT = T_SMOKE; bongDone = true; }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  addEventListener('mousedown', (e) => {
    if (hud.menuOpen || e.button !== 0 || phase !== 'play') return;
    if (!player.st.grounded && player.st.dashCharges > 0 && !player.st.hang && !player.st.climb) { aiming = true; aimReal = 0; }
  });
  addEventListener('mouseup', (e) => { if (e.button === 0 && aiming) releaseDash(); });
  addEventListener('contextmenu', (e) => e.preventDefault());
  const k = (...c: string[]) => c.some((x) => keys.has(x));

  // ---------------------------------------------------------------- impulso apuntado
  const V = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
  function screenOf(p: THREE.Vector3) { V.copy(p).project(st.camera); return [(V.x * 0.5 + 0.5) * innerWidth, (-V.y * 0.5 + 0.5) * innerHeight]; }
  function releaseDash() {
    aiming = false; hud.aim(false);
    const [px, py] = screenOf(V.copy(player.pos).setY(player.pos.y + 1.2));
    let dx = mouseX - px, dy = -(mouseY - py);
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    st.camera.matrixWorld.extractBasis(camRight, camUp, camFwd); camFwd.negate();
    camFwd.y = 0; camFwd.normalize(); camRight.y = 0; camRight.normalize();
    const dir = new THREE.Vector3().addScaledVector(camRight, dx).addScaledVector(camFwd, 0.55 + Math.max(0, -dy) * 0.3);
    dir.y = Math.max(dy, -0.6) * 1.1;
    dir.normalize();
    if (player.dash(dir)) {
      fx.emit({ pos: V.copy(player.pos).setY(player.pos.y + 1), count: 22, color: 0xffe0b0, glow: true, speed: 3, up: 0.3, size: 0.09, life: 0.45, gravity: 0 });
    }
  }

  // ---------------------------------------------------------------- estado de partida
  type Phase = 'intro' | 'play' | 'dead';
  let phase: Phase = 'intro', introT = 0;
  const startZ = player.pos.z;
  let maxDist = 0, best = 0, nextUp = UPGRADE_EVERY, upIndex = 0, offset = 0;
  try { best = Number(localStorage.getItem('yugure.best') || 0) || 0; } catch { /* */ }
  let life = 1, frontZ = (storm?.gateZ ?? 12) + 4, stormT = 0;
  const power: Record<PowerKind, number> = { taiko: 0, cometa: 0, cohete: 0, fideos: 0, pilares: 0 };
  const pillars = createPillars(mats, physics); st.scene.add(pillars.root);
  let score = 0, bank = 0, lastDist = 0;
  const scoreMult = () => 1 + bank + (pillars.active ? pillars.mult : 0);
  let timeScale = 1;
  const stormState: StormState = { player: player.pos, frontZ, danger: 0, inside: 0, life: 1 };

  // flujo: segundos encadenando movimientos sin tocar el suelo de la calle ni tropezar
  let flowT = 0, flowTier = 0, flowArmed = false, pulse = 0, fovKick = 0, slowPulse = 0;
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  // picos y bajadas de la tormenta
  const surge = { next: 32, warn: 0, on: 0 };
  const near = { armed: false, t: 0 };
  // viaje y barrios
  let trip = 0, bongDone = false, biome = 0, nextTunnel = 380, tunnelZ0 = 0, tunnelActive = false;
  const tint = new THREE.Color(1, 1, 1); let hue = 0;
  const tunnel = createTunnelMesh(mats, 1.9, 9.9); tunnel.visible = false; st.scene.add(tunnel);
  const zOf = (d: number) => startZ + offset - d;      // z de mundo de una distancia recorrida

  function breakFlow(why: string) {
    if (flowT > 3) hud.toast('Flujo roto', why, 1100);
    flowT = 0; flowTier = 0; flowArmed = false;
  }

  const s: CharState = { mode: 'idle', speed: 0, vy: 0, modeTime: 0 };
  const charMode = (m: PMode): string => {
    if (NATIVE.has(m)) return m;
    return ({ hang: 'ledge', climb: 'ledge', swing: 'glide', dash: 'boost', bounce: 'jump' } as Record<string, string>)[m] ?? 'fall';
  };

  function stepGame(dt: number) {
    for (const kk in power) power[kk as PowerKind] = Math.max(0, power[kk as PowerKind] - dt);
    const u = { ...up };
    if (power.fideos > 0) u.speed *= 1.3;
    u.speed *= 1 + 0.55 * THREE.MathUtils.smoothstep(flowT, 0, 28);
    if (power.cometa > 0) u.glide = true;
    player.setUpgrades(u);
    const inp = phase === 'play' ? {
      x: (k('ArrowRight', 'KeyD') ? 1 : 0) - (k('ArrowLeft', 'KeyA') ? 1 : 0),
      z: (k('ArrowDown', 'KeyS') ? 1 : 0) - (k('ArrowUp', 'KeyW') ? 1 : 0),
      jump: k('Space'), jumpPressed, down: k('ArrowDown', 'KeyS', 'ShiftLeft'),
    } : { x: 0, z: 0, jump: false, jumpPressed: false, down: false };
    jumpPressed = false;
    if (power.cohete > 0 && !player.st.grounded) { player.vel.z = Math.min(player.vel.z, -16); player.vel.y = Math.max(player.vel.y, 0.5); }
    player.step(dt, inp);

    for (const e of player.st.events) {
      const p = V.copy(player.pos);
      if (e.type === 'land') fx.emit({ pos: p.setY(p.y + 0.05), count: Math.round(8 + e.power * 14), color: 0xd9c2a0, speed: 1.6 + e.power * 2, up: 0.6, size: 0.15, life: 0.7, gravity: 0.6, spread: 0.5 });
      if (e.type === 'jump' || e.type === 'djump') fx.emit({ pos: p.setY(p.y + 0.05), count: e.type === 'djump' ? 16 : 7, color: e.type === 'djump' ? 0xffe6c0 : 0xd9c2a0, glow: e.type === 'djump', speed: 1.4, up: 0.4, size: 0.11, life: 0.5, gravity: 0.4 });
      if (e.type === 'bounce') fx.emit({ pos: p, count: 24, color: 0xffb0c0, glow: true, speed: 3, up: 1.2, size: 0.1, life: 0.7, gravity: 1 });
      if (e.type === 'perfect') { pulse = 0.8; fovKick = 4; flowT += 2; hud.toast('¡Salto perfecto!', '', 900); fx.emit({ pos: V.copy(player.pos).setY(player.pos.y + 1.6), count: 26, color: 0xfff0c0, glow: true, speed: 4, up: 1, size: 0.1, life: 0.6, gravity: 0.5 }); }
      if (e.type === 'vault') { pulse = Math.max(pulse, 0.3); flowT += 0.6; fx.emit({ pos: V.copy(player.pos).setY(player.pos.y + 1.7), count: 10, color: 0xffe0b0, glow: true, speed: 2, up: 0.6, size: 0.08, life: 0.4, gravity: 0.5 }); }
      if (e.type === 'grab') fx.emit({ pos: p.setY(p.y + 1.8), count: 6, color: 0xc9b39a, speed: 0.8, up: 0.2, size: 0.08, life: 0.5, gravity: 1.5 });
    }

    // flujo
    if (phase === 'play') {
      const onBase = player.st.grounded && (player.pos.y < 0.25 || (player.pos.x < WALL_X && player.pos.y < BACK_Y + 0.25));
      if (!onBase && (player.pos.y > 1.2 || !player.st.grounded)) flowArmed = true;
      for (const e of player.st.events) if (e.type === 'land' && player.st.mode === 'roll' && flowArmed) breakFlow('tropiezo');
      if (onBase && flowArmed) breakFlow('tocaste el suelo');
      if (flowArmed) {
        flowT += dt;
        const tier = Math.min(5, Math.floor(flowT / 7));
        if (tier > flowTier) {
          flowTier = tier; pulse = 1; fovKick = 6;
          hud.toast(`FLUJO ${ROMAN[tier]}`, tier >= 5 ? '¡imparable!' : `velocidad x${(1 + 0.55 * THREE.MathUtils.smoothstep(flowT, 0, 28)).toFixed(2)}`, 1300);
          fx.emit({ pos: V.copy(player.pos).setY(player.pos.y + 1), count: 30 + tier * 8, color: 0xfff0c0, glow: true, speed: 5, up: 1, size: 0.1, life: 0.8, gravity: 0 });
        }
      }
    }

    // potenciadores temporales de la ruta
    for (const pk of street.pickups) {
      if (pk.taken || !pk.g.visible) continue;
      if (pk.pos.distanceTo(V.copy(player.pos).setY(player.pos.y + 0.9)) > 1.5) continue;
      pk.taken = true; pk.g.visible = false;
      fx.emit({ pos: pk.pos, count: 34, color: 0xffd6a0, glow: true, speed: 3.5, up: 1.4, size: 0.12, life: 0.8, gravity: 1 });
      if (pk.kind === 'taiko') { player.vel.y = 16; player.st.grounded = false; hud.toast('Taiko', 'rebote'); }
      if (pk.kind === 'cometa') { power.cometa = 4.5; hud.toast('Cometa', 'planeo largo'); }
      if (pk.kind === 'cohete') { power.cohete = 1.4; player.vel.y = Math.max(player.vel.y, 6); player.st.grounded = false; hud.toast('Farol-cohete', 'vuela hacia delante'); }
      if (pk.kind === 'fideos') { power.fideos = 7; hud.toast('Fideos', '¡racha de velocidad!'); }
      if (pk.kind === 'pilares') { pillars.start(player.pos); pulse = 1; hud.toast('Pilares del cielo', 'salta de columna en columna: cada una sube el multiplicador', 2200); }
    }

    // columnas del cielo
    const pe = pillars.update(dt, player.pos, player.st.grounded);
    if (pe === 'land') { pulse = Math.max(pulse, 0.45); hud.toast(`x${scoreMult().toFixed(1)}`, `${pillars.count} columnas`, 700); fx.emit({ pos: V.copy(player.pos).setY(player.pos.y + 0.2), count: 22, color: 0x9affe0, glow: true, speed: 3, up: 0.8, size: 0.1, life: 0.6, gravity: 0.6 }); }
    if (pe === 'end') { bank = +(bank + pillars.mult).toFixed(2); hud.toast('Racha de columnas', `+x${pillars.mult.toFixed(1)} al multiplicador`, 2000); }

    // distancia, puntos y mejoras permanentes
    const dist = startZ - player.pos.z + offset;
    if (dist > maxDist) { score += (dist - Math.max(lastDist, maxDist)) * 10 * scoreMult() * (1 + flowTier * 0.25); maxDist = dist; }
    lastDist = maxDist;
    while (maxDist >= nextUp && upIndex < 40) {
      const ug = UPGRADES[upIndex] ?? { name: 'Brío', sub: '+4 % de velocidad', apply: (x: Upgrades) => { x.speed *= 1.04; } };
      ug.apply(up); gained.push(ug.name); upIndex++; nextUp += UPGRADE_EVERY;
      hud.toast(`Mejora permanente: ${ug.name}`, ug.sub, 2600); hud.ups(gained.slice(-6));
      fx.emit({ pos: V.copy(player.pos).setY(player.pos.y + 1), count: 50, color: 0xffd28a, glow: true, speed: 4, up: 2, size: 0.12, life: 1.2, gravity: 0.5 });
    }

    // tormenta: acelera con el tiempo y la distancia, y aprieta si te alejas mucho; quita vida al alcanzarte
    if (phase === 'play') {
      stormT += dt;
      const gap = frontZ - player.pos.z;
      let sv = Math.min(8.6, 3.8 + stormT * 0.012 + maxDist * 0.0016);
      if (gap > 90) sv += (gap - 90) * 0.08;
      // acelerón anunciado: pico de tensión, y luego se calma
      surge.next -= dt;
      if (surge.next <= 0 && surge.warn <= 0 && surge.on <= 0) { surge.warn = 2.5; hud.toast('¡La tormenta ruge!', 'acelera en 3…', 2400); storm?.strikeIn?.(0, 0); }
      if (surge.warn > 0) { surge.warn -= dt; if (surge.warn <= 0) { surge.on = 6; fovKick = 4; } }
      if (surge.on > 0) { surge.on -= dt; sv += 4.5; if (surge.on <= 0) surge.next = 26 + Math.random() * 22; }
      if (stormT < 4) sv *= stormT / 4;
      frontZ -= sv * dt;
      const g2 = frontZ - player.pos.z;
      stormState.danger = THREE.MathUtils.clamp(1 - g2 / 60, 0, 1);
      stormState.inside = THREE.MathUtils.clamp(-g2 / 14, 0, 1);
      const res = 1 - up.stormRes;
      if (g2 < 0) life -= (0.13 + stormState.inside * 0.22) * res * dt;
      else if (g2 < 6) life -= 0.03 * res * dt;
      else if (g2 > 45) life = Math.min(1, life + 0.035 * dt);
      if (g2 < 3) { near.armed = true; near.t = 0; }
      if (near.armed) {
        near.t += dt;
        if (g2 > 14 && near.t < 6) { near.armed = false; life = Math.min(1, life + 0.08); pulse = 1; slowPulse = 0.45; hud.toast('¡Por los pelos!', '+vida', 1300); }
        else if (near.t > 6) near.armed = false;
      }
      // túneles: cambio de barrio y respiro
      if (!tunnelActive && maxDist + 140 > nextTunnel) {
        tunnelActive = true; tunnelZ0 = zOf(nextTunnel);
        tunnel.position.set(0, 0, tunnelZ0); tunnel.visible = true; tunnel.updateMatrixWorld(true);
        physics.add(tunnel, tunnel.userData.colliders as Collider[], tunnel.matrixWorld);
      }
      if (tunnelActive && maxDist > nextTunnel + TUNNEL_LEN) {
        biome = (biome + 1) % BIOMES.length;
        const b = BIOMES[biome];
        hud.toast(b.name, b.sub || 'la tormenta te pierde la pista unos segundos', 2400);
        frontZ = Math.max(frontZ, player.pos.z + 40); pulse = 1; trip = Math.min(1, trip + 0.35);
        nextTunnel += 450;
      }
      if (tunnelActive && player.pos.z < tunnel.position.z - TUNNEL_LEN - 40) { tunnelActive = false; tunnel.visible = false; physics.remove(tunnel); }
      if (life <= 0) { life = 0; die(dist); }
    }
    stormState.frontZ = frontZ; stormState.life = life;
  }

  function die(dist: number) {
    phase = 'dead';
    best = Math.max(best, dist);
    try { localStorage.setItem('yugure.best', String(Math.round(best))); } catch { /* */ }
    hud.over(dist, best);
  }

  // ---------------------------------------------------------------- cámara que no atraviesa paredes
  const HEAD = new THREE.Vector3(), RAY = new THREE.Vector3();
  /** Si hay una casa, un alero o un tejado entre la cabeza del personaje y la cámara, la acerca. */
  function clipCamera(P: THREE.Vector3) {
    HEAD.set(P.x, P.y + 1.5, P.z);
    RAY.subVectors(camPos, HEAD);
    let best = 1;
    for (const c of physics.near(P.z + 3, 7)) {
      if (c.kind !== 'box') continue;
      let t0 = 0, t1 = 1, ok = true;
      for (const ax of ['x', 'y', 'z'] as const) {
        const o = HEAD[ax], d = RAY[ax], lo = c.min[ax] - 0.25, hi = c.max[ax] + 0.25;
        if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) { ok = false; break; } continue; }
        let a = (lo - o) / d, b = (hi - o) / d; if (a > b) { const k = a; a = b; b = k; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; }
      }
      if (!ok || t0 >= best) continue;
      if (c.slope) {
        // en un tejado inclinado solo cuenta si el rayo pasa por debajo de la superficie
        let under = false;
        for (let k = 0; k <= 4 && !under; k++) {
          const tt = t0 + (t1 - t0) * (k / 4), x = HEAD.x + RAY.x * tt, y = HEAD.y + RAY.y * tt, z = HEAD.z + RAY.z * tt;
          if (y < topAt(c, THREE.MathUtils.clamp(x, c.min.x, c.max.x), THREE.MathUtils.clamp(z, c.min.z, c.max.z)) + 0.2) { under = true; best = Math.min(best, tt); }
        }
        continue;
      }
      best = t0;
    }
    if (best < 1) camPos.copy(HEAD).addScaledVector(RAY, Math.max(0.12, best - 0.06));
  }

  // ---------------------------------------------------------------- cámara y bucle
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), lookTarget = new THREE.Vector3();
  let acc = 0, first = true;
  st.view.sway = false;
  st.onTick((t, rdt) => {
    if (hud.menuOpen) { st.view.pos.copy(camPos); st.view.look.copy(camLook); return; }
    if (aiming) { aimReal += rdt; if (aimReal > 1.5 || player.st.grounded) releaseDash(); }
    slowPulse = Math.max(0, slowPulse - rdt);
    const wantScale = aiming ? 0.2 : phase === 'dead' ? 0.15 : slowPulse > 0 ? 0.35 : 1;
    timeScale += (wantScale - timeScale) * Math.min(1, rdt * 10);
    const dt = rdt * timeScale;

    if (phase === 'intro') {
      introT += rdt;
      const head = V.copy(player.pos).add(new THREE.Vector3(0, 1.62, -0.28));
      const mouth = (ch as any).anchors?.mouth as THREE.Object3D | undefined;
      if (mouth) mouth.getWorldPosition(head);
      if (introT < BT) {
        if (introT > BT * 0.13 && introT < BT * 0.6 && Math.random() < 0.5) {
          const bowl = (ch as any).anchors?.bowl as THREE.Object3D | undefined;
          const bp = bowl ? bowl.getWorldPosition(new THREE.Vector3()) : head.clone().add(new THREE.Vector3(0.09, -0.45, 0));
          fx.emit({ pos: bp, count: 1, color: 0xff8a3a, glow: true, speed: 0.15, up: 0.25, size: 0.035, life: 0.5, gravity: -0.4 });
        }
      } else if (!bongDone) { bongDone = true; trip = 0.65; pulse = 0.6; }
      if (introT > BT * 0.74 && introT < T_SMOKE + 1.5) {
        // humo oscuro: sale de la boca, sube y fluye hacia la compuerta
        for (let i = 0; i < 3; i++) fx.emit({ pos: head, count: 1, color: introT < BT ? 0x9c8aa8 : 0x1c0f26, speed: 0.6, up: 0.5, size: 0.35 + Math.random() * 0.5, life: 2.6, gravity: -0.5, spread: 0.2,
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, 2.5 + (introT - BT) * 2.5) });
      }
      if (bongMesh) bongMesh.visible = introT < BT * 0.88;
      storm?.intro(THREE.MathUtils.clamp((introT - T_SMOKE) / 3.2, 0, 1));
      if (introT > T_END) { phase = 'play'; hud.titleOff(); hud.toast('¡Corre!', 'la oscuridad ha salido de la compuerta', 2200); }
    }

    acc += dt;
    const h = 1 / 120;
    let n = 0;
    while (acc >= h && n++ < 8) { stepGame(h); acc -= h; }
    if (n >= 8) acc = 0;

    // personaje
    const P = player.pos;
    ch.group.position.copy(P);
    let dy = player.st.yaw - ch.group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    ch.group.rotation.y += dy * Math.min(1, dt * (player.st.mode === 'hang' ? 30 : 12));
    const pm = player.st.mode;
    const cm = phase === 'intro' && introT < BT && NATIVE_BONG ? 'bong' : charMode(pm);
    if (s.mode !== cm) s.mode = cm as any;
    s.modeTime = cm === 'bong' ? introT : pm === 'climb' ? player.st.modeTime * player.st.climbRate : player.st.modeTime;
    if (pm === 'hang' && !NATIVE.has('hang')) s.modeTime = 0.05;
    s.speed = Math.hypot(player.vel.x, player.vel.z); s.vy = player.vel.y;
    (s as any).aim = player.st.aim; (s as any).swing = player.st.swing?.a ?? 0;
    (s as any).side = THREE.MathUtils.clamp(player.vel.x / 7, -1, 1);
    s.lean = THREE.MathUtils.clamp(-dy * 2, -0.4, 0.4);
    ch.update(dt, s);
    fx.update(dt);
    // estela: manos y punta de la bufanda, solo con velocidad, impulso o en el aire
    const an = (ch as any).anchors;
    if (an) {
      an.handL?.getWorldPosition(trailPts[0]); an.handR?.getWorldPosition(trailPts[1]); an.scarfTip?.getWorldPosition(trailPts[2]);
      const spd = Math.hypot(player.vel.x, player.vel.z, player.vel.y);
      const ti = pm === 'dash' ? 1 : THREE.MathUtils.clamp((spd - 7) / 6, 0, 1) * (player.st.grounded ? 0.5 : 1) + flowTier * 0.08;
      trail.update(dt, trailPts, Math.min(1, ti));
    }

    street.update(P.z, t);
    for (const l of layers) l.update(P.z, t);
    physics.refreshMoving();
    if (storm) storm.update(t, dt, stormState);

    // cámara: durante la intro mira a la compuerta; luego persecución detrás, algo a la derecha y alta
    const gateZ = storm?.gateZ ?? 12;
    if (phase === 'intro') {
      // 1) primer plano de la calada · 2) el humo viaja a la compuerta · 3) la compuerta revienta · 4) a la espalda
      const face = new THREE.Vector3(P.x + 1.15, P.y + 1.62, P.z - 2.1), faceLook = new THREE.Vector3(P.x, P.y + 1.45, P.z);
      const gate = new THREE.Vector3(5.6, P.y + 5.2, P.z - 8), gateLook = new THREE.Vector3(5.75, 8 + P.y, gateZ);
      const behind = new THREE.Vector3(P.x + 0.9, P.y + 2.9, P.z + 6.8), behindLook = new THREE.Vector3(P.x, P.y + 1.2, P.z - 5);
      const k1 = THREE.MathUtils.smoothstep(introT, BT + 0.3, T_SMOKE + 0.6), k2 = THREE.MathUtils.smoothstep(introT, T_GATE, T_END);
      camPos.copy(face).lerp(gate, k1).lerp(behind, k2);
      camLook.copy(faceLook).lerp(gateLook, k1).lerp(behindLook, k2);
      // pequeño temblor cuando revienta la compuerta
      const shake = THREE.MathUtils.clamp(1 - Math.abs(introT - (T_SMOKE + 0.9)) * 1.5, 0, 1) * 0.12;
      camPos.x += (Math.random() - 0.5) * shake; camPos.y += (Math.random() - 0.5) * shake;
      first = false;
    } else {
      const want = V.set(P.x * 0.75 + 1.4, P.y + 2.7, P.z + 6.6);
      if (first) { camPos.copy(want); first = false; }
      camPos.x += (want.x - camPos.x) * Math.min(1, rdt * 4);
      camPos.y += (want.y - camPos.y) * Math.min(1, rdt * 3);
      camPos.z += (want.z - camPos.z) * Math.min(1, rdt * 6);
      lookTarget.set(P.x * 0.85 + 0.6, P.y + 1.15, P.z - 6);
      camLook.lerp(lookTarget, Math.min(1, rdt * 6));
      clipCamera(P);
    }
    st.view.pos.copy(camPos); st.view.look.copy(camLook);
    // tensión: temblor leve y continuo que crece con la cercanía de la tormenta
    if (phase === 'play') {
      const dg = stormState.danger * stormState.danger;
      st.view.pos.x += (Math.sin(t * 13.1) * 0.6 + Math.sin(t * 23.7) * 0.4) * 0.05 * dg;
      st.view.pos.y += (Math.sin(t * 17.3) * 0.6 + Math.sin(t * 29.1) * 0.4) * 0.04 * dg;
    }
    if (api.cam) { st.view.pos.set(api.cam[0], api.cam[1], P.z + api.cam[2]); st.view.look.set(api.cam[3], api.cam[4], P.z + api.cam[5]); }
    const fov = (aiming ? 44 : 52 + Math.min(6, Math.max(0, Math.hypot(player.vel.x, player.vel.z) - 7) * 0.6)) - 4 * stormState.danger;
    if (Math.abs(st.camera.fov - fov) > 0.05) { st.camera.fov += (fov - st.camera.fov) * Math.min(1, rdt * 5); st.camera.updateProjectionMatrix(); }

    // viaje: intensidad psicodélica, barrio, destellos y velocidad
    const b = BIOMES[biome];
    const inTunnel = tunnelActive && P.z < tunnel.position.z && P.z > tunnel.position.z - TUNNEL_LEN ? 1 : 0;
    const tripTarget = (bongDone ? 0.32 : 0) + b.trip + flowTier * 0.07 + inTunnel * 0.35;
    trip += (tripTarget - trip) * Math.min(1, rdt * 0.6);
    tint.lerp(new THREE.Color(...b.tint), Math.min(1, rdt * 0.8));
    hue += (b.hue - hue) * Math.min(1, rdt * 0.8);
    pulse = Math.max(0, pulse - rdt * 1.6); fovKick = Math.max(0, fovKick - rdt * 6);
    const fu = st.post.finish.uniforms;
    if (fu.uTrip) {
      fu.uTrip.value = trip; fu.uHue.value = hue + Math.sin(t * 0.05) * trip * 0.06; (fu.uTint.value as THREE.Color).copy(tint);
      fu.uPulse.value = pulse; fu.uSpeedFx.value = THREE.MathUtils.clamp((Math.hypot(player.vel.x, player.vel.z) - 8.5) / 7, 0, 0.85);
    }
    if (fovKick > 0) { st.camera.fov += fovKick * 0.15; st.camera.updateProjectionMatrix(); }

    st.sun.target.position.set(P.x, P.y, P.z - 6);
    st.sun.position.copy(st.sun.target.position).addScaledVector(st.U.sunDir.value, 200);

    // interfaz
    hud.life(life);
    hud.storm(frontZ - P.z, stormState.danger);
    hud.dist(Math.max(0, maxDist), best, score, scoreMult());
    const ready = player.st.dashCharges > 0 ? 1 : 1 - Math.max(0, player.st.dashCd) / up.dashCd;
    hud.dashRing(mouseX, mouseY, ready, player.st.dashCharges, phase === 'play');
    if (aiming) { const [px, py] = screenOf(V.copy(P).setY(P.y + 1.2)); hud.aim(true, px, py, mouseX, mouseY); }

    // origen flotante
    if (P.z < SHIFT_AT) {
      const dz = -SHIFT_AT;
      P.z += dz; street.shift(dz); fx.shift(dz); physics.shift(dz); pillars.shift(dz); camPos.z += dz; camLook.z += dz; frontZ += dz; offset += dz;
      for (const l of layers) l.shift(dz);
      ch.group.position.z += dz; tunnel.position.z += dz; tunnel.updateMatrixWorld(true);
    }
  });

  // arranque
  street.update(0, 0);
  for (const l of layers) { l.update(0, 0); if (l.root) st.scene.add(l.root); }
  if (storm) st.scene.add(storm.root);
  st.scene.add(street.root);
  hud.ups([]);

  const api = {
    player, physics, fx, ch, s, up, power, cam: null as null | number[],
    get flow() { return flowT; }, get trip() { return trip; }, set trip(v: number) { trip = v; }, get biome() { return biome; },
    tunnelAt(d: number) { nextTunnel = d; }, pillars, get score() { return score; },
    get life() { return life; }, set life(v: number) { life = v; },
    get frontZ() { return frontZ; }, set frontZ(v: number) { frontZ = v; },
    get phase() { return phase; }, set phase(v: Phase) { phase = v; },
  };
  (window as any).__run = api;
  return api;
}
