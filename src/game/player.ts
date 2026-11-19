// Controlador del protagonista con control libre: correr en cualquier dirección, salto con tiempo de
// gracia, doble salto, planeo, agarre de bordes (colgarse, desplazarse, subir), barras de balanceo,
// sombrillas elásticas e impulso aéreo apuntado con el ratón. Física a paso fijo.
import * as THREE from 'three';
import type { Physics, WBox, WBar } from './physics';
import { topAt } from './physics';

export type Input = { x: number; z: number; jump: boolean; jumpPressed: boolean; down: boolean };
export type Upgrades = { dashPower: number; jumps: number; dashCd: number; dashCharges: number; speed: number; jumpMul: number; glide: boolean; stormRes: number };
export type PMode = 'idle' | 'run' | 'jump' | 'fall' | 'glide' | 'land' | 'roll' | 'hang' | 'climb' | 'swing' | 'dash' | 'bounce';

export const BASE_UP: Upgrades = { dashPower: 1, jumps: 1, dashCd: 0.5, dashCharges: 1, speed: 7.2, jumpMul: 1, glide: false, stormRes: 0 };

const G = 26, JUMP = 9.2, R = 0.34, H = 1.75, STEP = 0.5;
const ACC_G = 48, ACC_A = 16, COYOTE = 0.13, BUFFER = 0.16;
export type Rig = { hangDrop: number; hangWall: number; swingHand: number; climbOffset?: (t: number, out?: { y: number; z: number }) => { y: number; z: number } };

export type Env = { baseGround(x: number): number; clampX(x: number): number; wallX: number; wallTop: number };

export function createPlayer(phys: Physics, env: Env, climbT: number, rig: Rig = { hangDrop: 1.75, hangWall: 0.38, swingHand: 2.05 }) {
  const HANG_DROP = rig.hangDrop, HW = rig.hangWall;
  const CO = { y: 0, z: 0 };
  const pos = new THREE.Vector3(5.5, 0, -2.5), vel = new THREE.Vector3(), prev = new THREE.Vector3();
  const st = {
    mode: 'idle' as PMode, modeTime: 0, grounded: true, coyote: 0, buffer: 0, jumpsUsed: 0,
    yaw: 0, lastVy: 0, airTime: 0,
    hang: null as null | { box: WBox; cp: THREE.Vector3; n: THREE.Vector3; top: number; speed: number },
    climb: null as null | { t: number; from: THREE.Vector3; to: THREE.Vector3; cp: THREE.Vector3; n: THREE.Vector3; top: number; rate: number; speed: number },
    swing: null as null | { bar: WBar; anchor: THREE.Vector3; d: THREE.Vector3; a: number; w: number },
    dashT: 0, dashCharges: 1, dashCd: 0, grabCd: 0, swingCd: 0,
    aim: new THREE.Vector3(0, 0, -1),
    events: [] as { type: 'land' | 'jump' | 'bounce' | 'grab' | 'climb' | 'dash' | 'swing' | 'release' | 'djump' | 'vault' | 'perfect'; power: number }[],
    climbRate: 1, boostT: 0,
  };
  let up: Upgrades = { ...BASE_UP };
  const go = (m: PMode) => { if (st.mode !== m) { st.mode = m; st.modeTime = 0; } };
  const emit = (type: (typeof st.events)[number]['type'], power = 1) => st.events.push({ type, power });

  const T = new THREE.Vector3(), N = new THREE.Vector3(), C = new THREE.Vector3();

  function groundAt(x: number, z: number, feetY: number) {
    let g = env.baseGround(x);
    for (const c of phys.near(z, 3)) {
      if (c.kind !== 'box' || !c.walk) continue;
      if (x < c.min.x - R * 0.4 || x > c.max.x + R * 0.4 || z < c.min.z - R * 0.4 || z > c.max.z + R * 0.4) continue;
      const t = topAt(c, THREE.MathUtils.clamp(x, c.min.x, c.max.x), THREE.MathUtils.clamp(z, c.min.z, c.max.z));
      if (t <= feetY + STEP && t > g) g = t;
    }
    return g;
  }

  /** Empuja fuera de los sólidos en un eje. Devuelve la caja con la que chocó. */
  function collideAxis(axis: 'x' | 'z'): WBox | null {
    let hit: WBox | null = null;
    for (const c of phys.near(pos.z, 3)) {
      if (c.kind !== 'box') continue;
      if (pos.x + R <= c.min.x || pos.x - R >= c.max.x || pos.z + R <= c.min.z || pos.z - R >= c.max.z) continue;
      const t = topAt(c, THREE.MathUtils.clamp(pos.x, c.min.x, c.max.x), THREE.MathUtils.clamp(pos.z, c.min.z, c.max.z));
      if (pos.y >= t - STEP || pos.y + H <= c.min.y) continue;       // por encima o por debajo
      if (axis === 'x') pos.x = vel.x > 0 || prev.x < c.min.x ? c.min.x - R : c.max.x + R;
      else pos.z = vel.z > 0 || prev.z < c.min.z ? c.min.z - R : c.max.z + R;
      if (axis === 'x') vel.x = 0; else vel.z = 0;
      hit = c;
    }
    // muro de la terraza alta
    if (axis === 'x' && pos.x - R < env.wallX && pos.y < env.wallTop - STEP && prev.x - R >= env.wallX - 0.05) { pos.x = env.wallX + R; vel.x = 0; }
    return hit;
  }

  function tryGrab(): boolean {
    if (st.grabCd > 0 || vel.y > 3) return false;
    for (const c of phys.near(pos.z, 3)) {
      if (c.kind !== 'box' || !c.grab) continue;
      C.set(THREE.MathUtils.clamp(pos.x, c.min.x, c.max.x), 0, THREE.MathUtils.clamp(pos.z, c.min.z, c.max.z));
      const dx = pos.x - C.x, dz = pos.z - C.z, d = Math.hypot(dx, dz);
      if (d < 0.05 || d > R + 0.42) continue;                         // dentro o lejos
      const top = topAt(c, C.x, C.z);
      const reach = top - pos.y;
      if (reach < 1.15 || reach > 2.25) continue;
      // que no haya otra superficie justo encima del canto (techo)
      N.set(dx / d, 0, dz / d);
      const hs = Math.hypot(vel.x, vel.z);
      st.hang = { box: c, cp: C.clone(), n: N.clone(), top, speed: hs };
      pos.set(C.x + N.x * HW, top - HANG_DROP, C.z + N.z * HW);
      vel.set(0, 0, 0);
      st.yaw = Math.atan2(-N.x, -N.z) + Math.PI;
      go('hang'); emit('grab');
      // llegando con velocidad: lo supera de un salto rápido y sigue corriendo
      if (hs > 3.5) startClimb(st.hang, 2.7, hs);
      return true;
    }
    return false;
  }

  function startClimb(h: NonNullable<typeof st.hang>, rate: number, speed: number) {
    const to = new THREE.Vector3(h.cp.x - h.n.x * 0.45, h.top, h.cp.z - h.n.z * 0.45);
    to.y = Math.max(to.y, topAt(h.box, THREE.MathUtils.clamp(to.x, h.box.min.x, h.box.max.x), THREE.MathUtils.clamp(to.z, h.box.min.z, h.box.max.z)));
    st.climb = { t: 0, from: pos.clone(), to, cp: h.cp.clone(), n: h.n.clone(), top: h.top, rate, speed };
    st.climbRate = rate; st.hang = null; go('climb'); emit(speed > 0 ? 'vault' : 'climb');
  }

  function tryBar(): boolean {
    if (st.swingCd > 0) return false;
    T.copy(pos); T.y += rig.swingHand;
    for (const c of phys.near(pos.z, 3)) {
      if (c.kind !== 'bar') continue;
      const ab = N.subVectors(c.b, c.a), len2 = Math.max(1e-4, ab.lengthSq());
      const k = THREE.MathUtils.clamp(C.subVectors(T, c.a).dot(ab) / len2, 0, 1);
      const cp = C.copy(c.a).addScaledVector(ab, k);
      if (cp.distanceTo(T) > c.r + 0.35) continue;
      // plano de balanceo: perpendicular a la barra, orientado según la velocidad
      const axis = ab.clone().normalize();
      const d = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
      if (d.lengthSq() < 0.1) d.set(0, 0, -1);
      if (d.dot(vel) < 0) d.negate();
      const hv = vel.dot(d);
      st.swing = { bar: c, anchor: cp.clone(), d, a: -0.35, w: THREE.MathUtils.clamp(hv / 2.0, 0.5, 3.5) };
      go('swing'); emit('swing');
      return true;
    }
    return false;
  }

  function finishClimb(c: NonNullable<typeof st.climb>) {
    st.climb = null; st.grounded = true; st.jumpsUsed = 0; st.climbRate = 1;
    if (c.speed > 0) {
      const v = Math.max(c.speed, up.speed) * 1.18;
      vel.set(-c.n.x * v, 0, -c.n.z * v); st.boostT = 0.9; go('run');
    } else { vel.set(0, 0, 0); go('idle'); }
  }

  function doJump(power = 1) {
    vel.y = JUMP * up.jumpMul * power; st.grounded = false; st.coyote = 0; st.buffer = 0; go('jump'); emit('jump', power);
  }

  /** dash: dirección mundial normalizada */
  function dash(dir: THREE.Vector3) {
    if (st.dashCharges <= 0 || st.grounded || st.hang || st.climb) return false;
    st.dashCharges--; if (st.dashCd <= 0) st.dashCd = up.dashCd;
    st.aim.copy(dir);
    const keep = vel.clone().multiplyScalar(0.25);
    vel.copy(dir).multiplyScalar(15 * up.dashPower).add(keep);
    if (vel.y < 4 && dir.y > 0.2) vel.y = Math.max(vel.y, 6);
    st.dashT = 0.32; st.swing = null; go('dash'); emit('dash');
    return true;
  }

  function step(dt: number, inp: Input) {
    st.events.length = 0;
    st.modeTime += dt;
    if (inp.jumpPressed) st.buffer = BUFFER; else st.buffer = Math.max(0, st.buffer - dt);
    st.grabCd = Math.max(0, st.grabCd - dt); st.swingCd = Math.max(0, st.swingCd - dt);
    // el impulso solo se recarga al tocar suelo, colgarse, balancearse o rebotar, y tras el enfriamiento
    if (st.dashCd > 0) st.dashCd -= dt;
    if (st.dashCd <= 0 && (st.grounded || st.hang || st.swing) && st.dashCharges < up.dashCharges) st.dashCharges = up.dashCharges;
    prev.copy(pos);

    // ---------------- colgado de un borde
    if (st.hang) {
      const h = st.hang;
      // desplazamiento lateral por el borde
      const tan = T.set(-h.n.z, 0, h.n.x);
      const lat = inp.x * tan.x + inp.z * tan.z;   // proyección de la entrada sobre la tangente (aprox. en pantalla)
      if (Math.abs(inp.x) > 0.2 && Math.abs(lat) > 0.1) {
        const nx = pos.x + tan.x * Math.sign(lat) * 1.6 * dt, nz = pos.z + tan.z * Math.sign(lat) * 1.6 * dt;
        const cx = THREE.MathUtils.clamp(nx - h.n.x * HW, h.box.min.x, h.box.max.x), cz = THREE.MathUtils.clamp(nz - h.n.z * HW, h.box.min.z, h.box.max.z);
        pos.x = cx + h.n.x * HW; pos.z = cz + h.n.z * HW; h.cp.set(cx, 0, cz);
        h.top = topAt(h.box, cx, cz); pos.y = h.top - HANG_DROP;
      }
      const towards = -(inp.x * h.n.x + inp.z * h.n.z);  // empujar hacia la pared
      if (st.buffer > 0 && st.modeTime < 0.25) {
        // salto perfecto: pulsar salto justo al agarrarse impulsa por encima del borde
        st.buffer = 0; st.hang = null;
        pos.y = h.top - HANG_DROP + 0.6;
        vel.set(-h.n.x * 10.5, JUMP * 0.85, -h.n.z * 10.5);
        st.grounded = false; st.boostT = 1.1; st.grabCd = 0.3; go('jump'); emit('perfect');
      } else if (st.buffer > 0 || (towards > 0.5 && st.modeTime > 0.18)) {
        st.buffer = 0;
        startClimb(h, 1.6, 0);
      } else if (inp.down || towards < -0.6) { st.hang = null; st.grabCd = 0.35; go('fall'); }
      return;
    }
    // ---------------- subiendo
    if (st.climb) {
      const c = st.climb; c.t += (dt * c.rate) / climbT;
      const k = Math.min(1, c.t);
      if (rig.climbOffset) {
        // sigue la curva de la animación: las manos se quedan sobre el canto mientras el cuerpo sube
        rig.climbOffset(k * climbT, CO);
        pos.set(c.cp.x + c.n.x * CO.z, c.top + CO.y, c.cp.z + c.n.z * CO.z);
        if (k >= 1) { pos.y = c.to.y; finishClimb(c); }
        return;
      }
      // primero sube (brazos), luego avanza (rodilla y pie)
      const ky = 1 - Math.pow(1 - Math.min(1, k / 0.62), 3);
      const kz = k < 0.45 ? 0 : (k - 0.45) / 0.55;
      const kzs = kz * kz * (3 - 2 * kz);
      pos.y = THREE.MathUtils.lerp(c.from.y, c.to.y, ky);
      pos.x = THREE.MathUtils.lerp(c.from.x, c.to.x, kzs); pos.z = THREE.MathUtils.lerp(c.from.z, c.to.z, kzs);
      if (k >= 1) finishClimb(c);
      return;
    }
    // ---------------- balanceo en barra
    if (st.swing) {
      const s = st.swing, L = rig.swingHand;
      const pump = (inp.x * s.d.x + inp.z * s.d.z);
      s.w += (-(G / L) * Math.sin(s.a) + pump * 2.2 * Math.sign(Math.cos(s.a)) - s.w * 0.08) * dt;
      s.a += s.w * dt;
      s.a = THREE.MathUtils.clamp(s.a, -1.6, 1.6);
      pos.copy(s.anchor).addScaledVector(s.d, Math.sin(s.a) * L); pos.y = s.anchor.y - Math.cos(s.a) * L - 0.05;
      st.yaw = Math.atan2(s.d.x, s.d.z) + Math.PI;
      if (st.buffer > 0) {
        st.buffer = 0;
        const tv = s.w * L;   // velocidad tangencial
        vel.copy(s.d).multiplyScalar(Math.cos(s.a) * tv * 1.15 + 2.5); vel.y = Math.sin(s.a) * tv * 1.15 + 5.5;
        st.swing = null; st.swingCd = 0.45; st.grounded = false; st.jumpsUsed = Math.max(0, up.jumps - 1); go('jump'); emit('release');
      }
      return;
    }

    // ---------------- movimiento libre
    const wish = T.set(inp.x, 0, inp.z);
    const wl = wish.length(); if (wl > 1) wish.multiplyScalar(1 / wl);
    if (st.boostT > 0) st.boostT -= dt;
    wish.multiplyScalar(up.speed * (st.boostT > 0 ? 1.3 : 1));
    if (st.dashT > 0) st.dashT -= dt;
    else if (st.grounded) {
      const dvx = wish.x - vel.x, dvz = wish.z - vel.z, dl = Math.hypot(dvx, dvz), m = Math.min(1, (ACC_G * dt) / Math.max(1e-4, dl));
      vel.x += dvx * m; vel.z += dvz * m;
    } else {
      // en el aire: control suave sin frenar el impulso que ya se lleva
      const hs = Math.hypot(vel.x, vel.z);
      vel.x += (wish.x - vel.x) * Math.min(1, ACC_A * dt / Math.max(1, hs * 0.5));
      vel.z += (wish.z - vel.z) * Math.min(1, ACC_A * dt / Math.max(1, hs * 0.5));
    }

    // salto, doble salto
    const canGround = st.grounded || st.coyote > 0;
    if (st.buffer > 0 && canGround) doJump();
    else if (inp.jumpPressed && !canGround && st.jumpsUsed < up.jumps - 1 && st.dashT <= 0) { st.jumpsUsed++; vel.y = JUMP * up.jumpMul * 0.92; go('jump'); emit('djump'); st.buffer = 0; }

    // gravedad, salto variable y planeo
    let g = G;
    if (st.dashT > 0) g = G * 0.25;
    else if (vel.y > 0 && !inp.jump) g = G * 1.7;                 // soltar pronto = salto corto
    vel.y -= g * dt;
    const gliding = up.glide && inp.jump && vel.y < 0 && st.airTime > 0.3 && !st.grounded;
    if (gliding) vel.y = Math.max(vel.y, -2.6);
    st.lastVy = vel.y;

    // integración por ejes con colisión
    pos.x += vel.x * dt; pos.x = env.clampX(pos.x);
    const hx = collideAxis('x');
    pos.z += vel.z * dt;
    const hz = collideAxis('z');
    pos.y += vel.y * dt;

    // techo
    if (vel.y > 0) for (const c of phys.near(pos.z, 3)) {
      if (c.kind !== 'box') continue;
      if (pos.x < c.min.x || pos.x > c.max.x || pos.z < c.min.z || pos.z > c.max.z) continue;
      if (prev.y + H <= c.min.y + 0.05 && pos.y + H > c.min.y) { pos.y = c.min.y - H; vel.y = 0; }
    }

    // sombrillas
    if (vel.y < 0) for (const c of phys.near(pos.z, 4)) {
      if (c.kind !== 'bounce') continue;
      const d = Math.hypot(pos.x - c.c.x, pos.z - c.c.z);
      if (d > c.r || prev.y < c.c.y - 0.2 || pos.y > c.c.y + 0.05) continue;
      const hs = Math.hypot(vel.x, vel.z);
      const v = THREE.MathUtils.clamp(9.5 + Math.abs(vel.y) * 0.55 + hs * 0.6, 10, 27) * c.power;
      pos.y = c.c.y; vel.y = v; st.grounded = false; st.jumpsUsed = 0;
      go('bounce'); emit('bounce', v / 15);
      break;
    }

    // suelo
    const gy = groundAt(pos.x, pos.z, Math.max(prev.y, pos.y));
    const wasGrounded = st.grounded;
    if (pos.y <= gy && vel.y <= 0) {
      if (!wasGrounded) { emit('land', Math.min(2, -st.lastVy / 12)); go(st.lastVy < -17 ? 'roll' : 'land'); }
      pos.y = gy; vel.y = 0; st.grounded = true; st.jumpsUsed = 0; st.airTime = 0; st.coyote = COYOTE;
    } else if (wasGrounded && vel.y <= 0 && pos.y - gy < 0.45) {
      pos.y = gy; vel.y = 0;                                        // pegado al bajar rampas
    } else {
      if (st.grounded) st.coyote = COYOTE;
      st.grounded = false; st.coyote = Math.max(0, st.coyote - dt); st.airTime += dt;
    }

    // agarres en el aire
    if (!st.grounded && st.dashT <= 0.15) { if (!tryBar()) tryGrab(); }
    void hx; void hz;

    // modo y orientación
    const hs = Math.hypot(vel.x, vel.z);
    if (hs > 0.6 && st.mode !== 'hang') st.yaw = Math.atan2(vel.x, vel.z) + Math.PI;
    if (st.grounded) {
      if ((st.mode === 'land' && st.modeTime < 0.16) || (st.mode === 'roll' && st.modeTime < 0.5)) { /* termina la recepción */ }
      else go(hs > 0.5 ? 'run' : 'idle');
    } else if (st.mode === 'dash' && st.dashT > 0) { /* sigue */ }
    else if (st.mode === 'bounce' && vel.y > 0) { /* voltereta */ }
    else if (gliding) go('glide');
    else if (vel.y < -0.5 && st.mode !== 'jump') go('fall');
    else if (st.mode === 'jump' && vel.y < 0) go('fall');
    else if (st.mode === 'run' || st.mode === 'idle') go('fall');
  }

  function reset(p: THREE.Vector3) { pos.copy(p); vel.set(0, 0, 0); st.hang = null; st.climb = null; st.swing = null; st.grounded = true; go('idle'); }
  function setUpgrades(u: Upgrades) { up = u; st.dashCharges = Math.min(st.dashCharges + 1, u.dashCharges); }
  return { pos, vel, st, step, dash, reset, setUpgrades, get up() { return up; } };
}
export type Player = ReturnType<typeof createPlayer>;
