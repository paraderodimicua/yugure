// Visor de piezas jugables (parkour). http://localhost:5183/dev/piezas.html
// __pieces.debug(true) dibuja colisionadores (cajas verdes, barras amarillas, rebote rosa, agarre cian);
// __pieces.stats: triángulos/llamadas por pieza; __pieces.cam('a'|'b'|'c'|'d'|'all').
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';
import { createProps } from '../world/props';
import { createPieces } from '../game/pieces';
import type { Collider, PlayPiece } from '../game/contracts';

const st = createStage({ cam: [0, 6, 22], look: [0, 4, 0], focus: [0, 3, 0], shadowHalf: 30, dynamicShadows: true });
st.view.sway = false;
const mats = createMaterials(st.U);
const props = createProps(st.U, mats);
const P = createPieces(st.U, mats, props), mk = P.make;
st.onTick(P.update); st.onTick(props.update);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.cobble);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
st.scene.add(ground);

const stats: Record<string, { tris: number; draws: number }> = {};
const all: PlayPiece[] = [];
const put = (name: string, g: PlayPiece, x: number, y: number, z: number, ry = 0) => {
  g.position.set(x, y, z); g.rotation.y = ry; st.scene.add(g); all.push(g);
  if (!stats[name]) stats[name] = { tris: g.userData.tris, draws: g.userData.draws };
  return g;
};
const block = (x: number, z: number, w: number, h: number, d: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.plasterAged); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; st.scene.add(m);
  const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.25, d + 0.4), mats.tileClay); r.position.set(x, h + 0.12, z); r.castShadow = true; st.scene.add(r);
};

// fila A: suelo
put('templeFlag', mk.templeFlag({ h: 7 }), -12, 0, 0);
put('column', mk.column({ h: 4 }), -8.5, 0, 0);
put('column_lacquer', mk.column({ h: 4.5, kind: 'lacquer' }), -6.3, 0, 0);
put('column_broken', mk.column({ h: 4, top: 'broken', seed: 2 }), -4, 0, 0.3);
put('column_tilt', mk.column({ h: 4, top: 'tilt', seed: 1 }), -1.4, 0, 0);
put('column_lacq_broken', mk.column({ h: 4, kind: 'lacquer', top: 'broken' }), 0.8, 0, 0);
put('pole', mk.pole({ h: 6.5 }), 3.5, 0, 0);
put('umbrella', mk.umbrella({ r: 2.2, color: '#c0392b' }), 7.5, 0, 0);
put('umbrella_b', mk.umbrella({ r: 1.8, color: '#1f4f8a', h: 2.6 }), 11.8, 0, 0.5);
put('toriiTop', mk.toriiTop({}), 17, 0, 0);
// fila B: voladores
put('lanternFloat', mk.lanternFloat({ seed: 1 }), -10, 3.5, -7);
put('lanternFloat_w', mk.lanternFloat({ seed: 2 }), -6.5, 4.2, -7);
put('kite', mk.kite({ seed: 1, len: 8 }), -2, 0, -9);
put('craneFloat', mk.craneFloat({ seed: 1 }), 5, 4, -9);
put('rockFloat', mk.rockFloat({ seed: 1 }), 12, 3, -8);
put('rockFloat_b', mk.rockFloat({ seed: 2 }), 17, 4.5, -9);
// fila C: entre tejados
block(-9, 16, 3, 4, 3); block(-1, 16, 3, 4, 3); block(7, 16, 3, 4, 3);
put('beam', mk.beam({ len: 5 }), -5, 4.25, 16);
put('ropeBridge', mk.ropeBridge({ len: 5 }), 3, 4.25, 16);
put('lanternString', mk.lanternString({ len: 5 }), 3, 6.4, 15);
put('lanternString_b', mk.lanternString({ len: 8, sag: 1 }), -5, 7.2, 17);

// fila D: segunda tanda (z = -22)
put('crates', mk.crates({ rows: 4, seed: 1 }), -16, 0, -22);
put('barrels', mk.barrels({ seed: 0 }), -12, 0, -22);
put('cart', mk.cart({ seed: 0 }), -8, 0, -22);
put('scaffold', mk.scaffold({ h: 6 }), -3.5, 0, -22);
put('waterTank', mk.waterTank({ h: 7 }), 1, 0, -22);
put('bell', mk.bell({ h: 3 }), 5.5, 0, -22);
put('stoneLantern', mk.stoneLantern({ h: 2.6 }), 9, 0, -22);
put('signBoard', mk.signBoard({ w: 2.4, h: 4, seed: 1 }), 12.5, 0, -22);
put('bambooPoles', mk.bambooPoles({ n: 5 }), 15, 0, -22);
put('hangingPlatform', mk.hangingPlatform({ seed: 1, len: 3 }), -12, 7, -27);
put('paperLanternGiant', mk.paperLanternGiant({ seed: 1 }), -6, 3, -28);

// ---- dibujo de colisionadores ----
const dbg: THREE.Object3D[] = [];
const lm = (c: number) => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });
const G = lm(0x40ff60), Y = new THREE.MeshBasicMaterial({ color: 0xffe030, depthTest: false, transparent: true, opacity: 0.85 }), PK = lm(0xff50c0), CY = lm(0x40e0ff);
const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
const circle = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.cos(i / 48 * 6.283), 0, Math.sin(i / 48 * 6.283))));
const cylG = new THREE.CylinderGeometry(1, 1, 1, 6);
function overlay(c: Collider) {
  if (c.kind === 'box') {
    const l = new THREE.LineSegments(boxEdges, G);
    l.position.set((c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2);
    l.scale.set(c.max[0] - c.min[0], c.max[1] - c.min[1], c.max[2] - c.min[2]); return l;
  }
  if (c.kind === 'bar') {
    const a = new THREE.Vector3(...c.a), b = new THREE.Vector3(...c.b), m = new THREE.Mesh(cylG, Y);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(0.03, a.distanceTo(b), 0.03);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m;
  }
  if (c.kind === 'bounce') {
    const l = new THREE.Line(circle, PK); l.position.set(...c.center); l.scale.setScalar(c.r);
    const l2 = l.clone(); l2.scale.setScalar(c.r * 0.5); l.add(l2); l2.position.set(0, 0, 0); l2.scale.setScalar(0.5); return l;
  }
  const g = new THREE.Group();
  const a = new THREE.Vector3(...c.a), b = c.b ? new THREE.Vector3(...c.b) : a.clone();
  g.add(new THREE.LineSegments(boxEdges, CY)); g.children[0].position.copy(a); g.children[0].scale.setScalar(0.12);
  if (c.b) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), CY));
  return g;
}
function debug(on = true) {
  for (const o of dbg) o.removeFromParent(); dbg.length = 0;
  if (!on) return;
  for (const g of all) for (const c of g.userData.colliders) { const o = overlay(c); o.renderOrder = 10; o.traverse((x) => (x.renderOrder = 10)); g.add(o); dbg.push(o); }
}

const views: Record<string, [number[], number[]]> = {
  all: [[2, 10, 34], [2, 3, 2]],
  a: [[-6, 3.6, 9.5], [-6, 3, 0]],
  b: [[8, 4, 10], [9, 3, 0]],
  c: [[0, 6, 5], [2, 4.5, -8]],
  d: [[-1, 7.5, 24], [-1, 4.8, 16]],
  e: [[12, 6, 2], [13, 5, -8]],
  f: [[-9, 4.5, -12], [-9, 2.5, -24]],
  g: [[6, 5, -11], [7, 3, -23]],
};
const cam = (k: string) => { const [p, l] = views[k]; st.view.pos.set(p[0], p[1], p[2]); st.view.look.set(l[0], l[1], l[2]); };
(window as any).__pieces = { make: mk, stats, cam, views, debug, all };
st.start();
