// Mundo de colisiones del juego: cajas (pisables, rampas, bordes agarrables), barras, sombrillas
// elásticas y asideros. Los colisionadores se guardan en coordenadas de mundo dentro de celdas de
// 4 m en z para consultar solo lo cercano al jugador.
import * as THREE from 'three';
import type { Collider, V3 } from './contracts';

export type WBox = { kind: 'box'; min: THREE.Vector3; max: THREE.Vector3; slope?: { axis: 'x' | 'z'; dir: 1 | -1 }; grab: boolean; walk: boolean; owner: object };
export type WBar = { kind: 'bar'; a: THREE.Vector3; b: THREE.Vector3; r: number; owner: object };
export type WBounce = { kind: 'bounce'; c: THREE.Vector3; r: number; power: number; owner: object };
export type WCol = WBox | WBar | WBounce;

const CELL = 4;

/** Altura de la cara superior de una caja en (x, z) (rampa si tiene slope). */
export function topAt(b: WBox, x: number, z: number) {
  if (!b.slope) return b.max.y;
  const { axis, dir } = b.slope;
  const lo = axis === 'x' ? b.min.x : b.min.z, hi = axis === 'x' ? b.max.x : b.max.z;
  const v = axis === 'x' ? x : z;
  let t = (v - lo) / Math.max(1e-4, hi - lo);       // 0 en min, 1 en max
  if (dir === 1) t = 1 - t;                          // dir 1: baja hacia +eje → alto en min
  t = THREE.MathUtils.clamp(t, 0, 1);
  return b.min.y + (b.max.y - b.min.y) * t;
}

export function createPhysics() {
  const cells = new Map<number, WCol[]>();
  const byOwner = new Map<object, { col: WCol; keys: number[] }[]>();
  const moving = new Map<object, { group: THREE.Object3D; local: Collider[] }>();

  const keyOf = (z: number) => Math.floor(z / CELL);
  function insert(col: WCol, z0: number, z1: number) {
    const keys: number[] = [];
    for (let k = keyOf(Math.min(z0, z1)); k <= keyOf(Math.max(z0, z1)); k++) {
      let c = cells.get(k); if (!c) { c = []; cells.set(k, c); }
      c.push(col); keys.push(k);
    }
    let list = byOwner.get(col.owner); if (!list) { list = []; byOwner.set(col.owner, list); }
    list.push({ col, keys });
  }

  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  /** Pasa colisionadores locales a mundo con la matriz del grupo (giros en Y arbitrarios). */
  function add(owner: object, local: Collider[], m: THREE.Matrix4) {
    const e = m.elements;
    const yaw = Math.atan2(e[8], e[0]);                 // giro en Y de la matriz
    const quarter = Math.round(yaw / (Math.PI / 2));
    const snapped = Math.abs(yaw - quarter * Math.PI / 2) < 0.02;
    for (const c of local) {
      if (c.kind === 'box') {
        const [x0, y0, z0] = c.min, [x1, y1, z1] = c.max;
        corners[0].set(x0, y0, z0); corners[1].set(x1, y0, z0); corners[2].set(x0, y0, z1); corners[3].set(x1, y0, z1);
        const min = new THREE.Vector3(Infinity, y0, Infinity), max = new THREE.Vector3(-Infinity, y1, -Infinity);
        for (const p of corners) { p.applyMatrix4(m); min.x = Math.min(min.x, p.x); min.z = Math.min(min.z, p.z); max.x = Math.max(max.x, p.x); max.z = Math.max(max.z, p.z); }
        const ty = e[13]; min.y = y0 + ty; max.y = y1 + ty;
        let slope = c.slope;
        if (slope && snapped) {
          // vector de bajada local → mundo
          P.set(slope.axis === 'x' ? slope.dir : 0, 0, slope.axis === 'z' ? slope.dir : 0).transformDirection(m);
          slope = Math.abs(P.x) > Math.abs(P.z) ? { axis: 'x', dir: P.x > 0 ? 1 : -1 } : { axis: 'z', dir: P.z > 0 ? 1 : -1 };
        } else if (slope) slope = undefined;
        insert({ kind: 'box', min, max, slope, grab: c.grab ?? true, walk: c.walk ?? true, owner }, min.z, max.z);
      } else if (c.kind === 'bar' || c.kind === 'grab') {
        const a = new THREE.Vector3(...c.a).applyMatrix4(m);
        const b = new THREE.Vector3(...(c.kind === 'bar' ? c.b : (c.b ?? c.a))).applyMatrix4(m);
        insert({ kind: 'bar', a, b, r: c.kind === 'bar' ? (c.r ?? 0.5) : 0.6, owner }, a.z - 1, b.z + 1);
      } else if (c.kind === 'bounce') {
        const ctr = new THREE.Vector3(...c.center).applyMatrix4(m);
        insert({ kind: 'bounce', c: ctr, r: c.r, power: c.power ?? 1, owner }, ctr.z - c.r, ctr.z + c.r);
      }
    }
  }
  function remove(owner: object) {
    const list = byOwner.get(owner); if (!list) return;
    for (const { col, keys } of list) for (const k of keys) {
      const c = cells.get(k); if (!c) continue;
      const i = c.indexOf(col); if (i >= 0) c.splice(i, 1);
      if (!c.length) cells.delete(k);
    }
    byOwner.delete(owner);
    moving.delete(owner);
  }
  /** Objeto que se mueve: se re-registra cada fotograma desde su matrixWorld. */
  function addMoving(group: THREE.Object3D, local: Collider[]) {
    moving.set(group, { group, local });
    group.updateMatrixWorld(true);
    add(group, local, group.matrixWorld);
  }
  function refreshMoving() {
    for (const { group, local } of moving.values()) {
      const list = byOwner.get(group);
      if (list) for (const { col, keys } of list) for (const k of keys) { const c = cells.get(k); if (c) { const i = c.indexOf(col); if (i >= 0) c.splice(i, 1); } }
      byOwner.delete(group);
      group.updateMatrixWorld(true);
      add(group, local, group.matrixWorld);
      moving.set(group, { group, local });
    }
  }

  const out: WCol[] = [];
  /** Colisionadores en el tramo [z-r, z+r] (sin duplicados). */
  function near(z: number, r = 6) {
    out.length = 0;
    for (let k = keyOf(z - r); k <= keyOf(z + r); k++) {
      const c = cells.get(k); if (!c) continue;
      for (const col of c) if (!out.includes(col)) out.push(col);
    }
    return out;
  }
  function shift(dz: number) {
    const all = new Map<object, { col: WCol; keys: number[] }[]>(byOwner);
    cells.clear(); byOwner.clear();
    for (const [owner, list] of all) for (const { col } of list) {
      if (col.kind === 'box') { col.min.z += dz; col.max.z += dz; insert(col, col.min.z, col.max.z); }
      else if (col.kind === 'bar') { col.a.z += dz; col.b.z += dz; insert(col, col.a.z - 1, col.b.z + 1); }
      else { col.c.z += dz; insert(col, col.c.z - col.r, col.c.z + col.r); }
      void owner;
    }
  }
  void Q;
  return { add, remove, addMoving, refreshMoving, near, shift, cells };
}
export type Physics = ReturnType<typeof createPhysics>;
export type { V3 };
