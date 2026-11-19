// Potenciador «Pilares del cielo»: brotan columnas gigantes delante del jugador, sin fin, a alturas
// cambiantes. Cada columna nueva en la que aterrizas sube el multiplicador de puntos. Se acaba al caer
// o al pisar cualquier otra cosa; las columnas se hunden.
import * as THREE from 'three';
import type { Mats } from '../render/materials';
import type { Physics } from './physics';
import type { Collider } from './contracts';

type Col = { g: THREE.Group; shaft: THREE.Mesh; top: number; x: number; z: number; rise: number; used: boolean; landed: boolean; sinking: number };

const R = 1.15;

export function createPillars(mats: Mats, physics: Physics) {
  const root = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(R * 0.92, R, 1, 18, 1); shaftGeo.translate(0, 0.5, 0);
  const capGeo = new THREE.CylinderGeometry(R * 1.18, R * 1.05, 0.42, 18);
  const ringGeo = new THREE.TorusGeometry(R * 1.12, 0.07, 6, 28); ringGeo.rotateX(Math.PI / 2);
  const shaftMat = mats.tint('stone', 0x4c8a74), capMat = mats.metalGold, ringMat = mats.glow(0x7affd0, 2.4);
  const pool: Col[] = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(shaftGeo, shaftMat); shaft.castShadow = shaft.receiveShadow = true; g.add(shaft);
    const cap = new THREE.Mesh(capGeo, capMat); cap.name = 'cap'; g.add(cap);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.name = 'ring'; g.add(ring);
    g.visible = false; root.add(g);
    pool.push({ g, shaft, top: 0, x: 0, z: 0, rise: 0, used: false, landed: false, sinking: 0 });
  }

  let armed = false, active = false, cursorZ = 0, lastTop = 0, lastX = 0, count = 0, mult = 0, offTime = 0;
  const placed: Col[] = [];

  function layout(c: Col, h: number) {
    c.shaft.scale.set(1, h, 1);
    for (const ch of c.g.children) if (ch.name === 'cap') ch.position.y = h + 0.21; else if (ch.name === 'ring') ch.position.y = h - 0.35;
  }
  function spawn() {
    const c = pool.find((p) => !p.used); if (!c) return false;
    const top = THREE.MathUtils.clamp(lastTop + (Math.random() * 2.6 - 1.2), 3, 18);
    const x = THREE.MathUtils.clamp(lastX + (Math.random() - 0.5) * 4.5, -3, 11);
    const z = cursorZ - (5 + Math.random() * 2.2);
    c.used = true; c.landed = false; c.sinking = 0; c.top = top + 0.42; c.x = x; c.z = z; c.rise = 0;
    c.g.position.set(x, -top, z); c.g.visible = true; layout(c, top);
    c.g.updateMatrixWorld(true);
    // el collider se registra ya en su sitio final (la columna termina de subir antes de que llegues)
    const m = new THREE.Matrix4().makeTranslation(x, 0, z);
    const cols: Collider[] = [{ kind: 'box', min: [-R * 0.8, 0, -R * 0.8], max: [R * 0.8, top + 0.42, R * 0.8] }];
    physics.add(c, cols, m);
    placed.push(c); cursorZ = z; lastTop = top; lastX = x;
    return true;
  }

  return {
    root,
    get active() { return active; },
    get mult() { return mult; },
    get count() { return count; },
    get placed() { return placed; },
    start(pos: THREE.Vector3) {
      active = true; armed = false; count = 0; mult = 0; offTime = 0;
      cursorZ = pos.z - 2; lastTop = Math.max(4, pos.y + 1.2); lastX = pos.x;
      for (let i = 0; i < 4; i++) spawn();
    },
    /** devuelve 'land' si acaba de aterrizar en una columna nueva, 'end' si se acabó la racha */
    update(dt: number, p: THREE.Vector3, grounded: boolean): 'land' | 'end' | null {
      let ev: 'land' | 'end' | null = null;
      for (const c of placed) {
        if (c.rise < 1) { c.rise = Math.min(1, c.rise + dt * 2.2); const k = 1 - Math.pow(1 - c.rise, 3); c.g.position.y = -(c.top - 0.42) * (1 - k); }
        if (c.sinking > 0) { c.sinking += dt; c.g.position.y -= dt * (6 + c.sinking * 20); }
        c.g.children[2].rotation.y += dt * 1.5;
      }
      if (active) {
        while (cursorZ > p.z - 30 && spawn()) { /* siempre 4-5 columnas por delante */ }
        let on: Col | null = null;
        if (grounded) for (const c of placed) if (Math.hypot(p.x - c.x, p.z - c.z) < R * 0.95 && Math.abs(p.y - c.top) < 0.3) on = c;
        if (on && !on.landed) { on.landed = true; count++; mult = +(mult + 0.1 + Math.min(0.15, count * 0.01)).toFixed(2); ev = 'land'; }
        if (!grounded) armed = true;                 // la racha empieza al saltar hacia la primera columna
        if (armed && grounded && !on) offTime += dt; else if (on) offTime = 0;
        if (armed && (offTime > 0.15 || p.y < 0.3)) { active = false; ev = 'end'; for (const c of placed) if (c.sinking === 0) c.sinking = 0.001; }
      }
      // retirar columnas que quedaron atrás o se hundieron
      for (let i = placed.length - 1; i >= 0; i--) {
        const c = placed[i];
        if (c.z > p.z + 14 || c.g.position.y < -c.top - 2) { physics.remove(c); c.used = false; c.g.visible = false; placed.splice(i, 1); }
        else if (c.sinking > 0.25) physics.remove(c);
      }
      return ev;
    },
    shift(dz: number) { for (const c of placed) { c.z += dz; c.g.position.z += dz; } cursorZ += dz; },
  };
}
