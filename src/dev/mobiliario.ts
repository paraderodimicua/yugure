// Visor del kit de mobiliario: todas las piezas en filas + una esquina de callejón compuesta.
// http://localhost:5183/dev/mobiliario.html  ·  __props.stats: triángulos/llamadas por pieza; __props.cam('wok')
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';
import { createArchKit } from '../world/arch';
import { createProps } from '../world/props';

const st = createStage({ cam: [0, 2.2, 9], look: [0, 1.2, 0], focus: [6, 1, 0], shadowHalf: 30, dynamicShadows: true });
st.view.sway = false;
const mats = createMaterials(st.U);
const P = createProps(st.U, mats), mk = P.make;
st.onTick(P.update);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.cobble);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
st.scene.add(ground);

const stats: Record<string, { tris: number; draws: number }> = {};
const put = (name: string, g: THREE.Group, x: number, y: number, z: number, ry = 0) => {
  g.position.set(x, y, z); g.rotation.y = ry; st.scene.add(g);
  if (!stats[name]) stats[name] = { tris: g.userData.tris, draws: g.userData.draws };
  return g;
};
const beam = (x0: number, x1: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, 0.1), mats.woodDark); m.position.set((x0 + x1) / 2, y + 0.05, z); m.castShadow = true; st.scene.add(m);
  for (const x of [x0, x1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, y, 0.1), mats.woodDark); p.position.set(x, y / 2, z); p.castShadow = true; st.scene.add(p); }
};
const wall = (x: number, z: number, w: number, h: number, ry = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), mats.plasterAged); m.position.set(x, h / 2, z - 0.1); m.rotation.y = ry; m.receiveShadow = m.castShadow = true; st.scene.add(m);
};

// Fila 1 (z=0): luces, telas y carteles colgados de una viga
beam(-8, 8, 2.6, 0);
put('chochin', mk.chochin({ text: '祭' }), -7, 2.6, 0);
put('chochin_long', mk.chochin({ text: 'ラーメン', color: 'white', shape: 'long' }), -6.2, 2.6, 0);
put('noren', mk.noren({ text: 'そば', sub: '手打' }), -4.7, 2.6, 0);
put('noren_kori', mk.noren({ style: 'kori' }), -3.3, 2.6, 0);
put('furin', mk.furin({}), -2.6, 2.6, 0);
put('fuda', mk.fuda({}), -2.0, 2.6, 0);
put('festival', mk.festival({ span: 6, n: 7, text: '祭' }), 1.5, 2.55, 0);
put('nobori', mk.nobori({ text: 'ラーメン' }), -1.2, 0, 0.6);
put('nobori_cha', mk.nobori({ text: '茶', bg: '#2f5a3a', sub: '抹茶' }), -0.4, 0, 0.6);
wall(10.5, 0, 5, 3);
put('lightbox', mk.lightbox({ text: 'スナック', sub: '夕暮' }), 9, 2.2, 0);
put('lightbox_yu', mk.lightbox({ text: '湯', sub: 'ゆ', bg: '#f6eee0', fg: '#2a4f9a' }), 10.2, 2.3, 0);
put('aircon_wall', mk.aircon({ wall: true }), 11.6, 0, 0);
put('cables', mk.cables({ to: [-5, -0.3, 0], n: 3 }), 13, 2.9, 0.1);

// Fila 2 (z=4): calle
put('kanban', mk.kanban({ text: '茶', sub: '御休処' }), -7, 0, 4);
put('vending', mk.vending({ color: 'white' }), -5.6, 0, 4);
put('vending_red', mk.vending({ color: 'red', bin: false }), -4.4, 0, 4);
put('mailbox', mk.mailbox(), -3.2, 0, 4);
put('toro', mk.toro(), -2.0, 0, 4);
put('jizo', mk.jizo(), -1.0, 0, 4);
put('kazaguruma', mk.kazaguruma({ n: 3 }), -0.3, 0, 4.2);
put('bicycle', mk.bicycle({}), 1.0, 0, 4.2);
put('bicycle_b', mk.bicycle({ color: '#d8c2a2' }), 1.2, 0, 4.9, 0.15);
put('aircon', mk.aircon({}), 3.0, 0, 3.8);
put('broom', mk.broom({}), 4.2, 0, 3.8);
put('maceta_fern', mk.maceta({ kind: 'fern' }), 5.2, 0, 4.2);
put('maceta_pine', mk.maceta({ kind: 'pine', pot: 'terra' }), 5.7, 0, 4.2);
put('maceta_asagao', mk.maceta({ kind: 'asagao' }), 6.2, 0, 4.2);
put('maceta_azalea', mk.maceta({ kind: 'azalea', pot: 'terra' }), 6.8, 0, 4.2);
put('jardinera', mk.jardinera({}), 8.3, 0, 4);
put('laundry', mk.laundry({}), 9.8, 0, 4);

// Fila 3 (z=-4): puestos
put('wok', mk.wok({}), -6, 0, -4);
put('yatai', mk.yatai({}), -3, 0, -4);
put('produce', mk.produce({}), 0.2, 0, -4);
put('barrels', mk.barrels({ rows: 3 }), 2.6, 0, -4.3);
put('terrace_tea', mk.terrace({ kind: 'teahouse' }), 5.3, 0, -4);
put('terrace_izakaya', mk.terrace({ kind: 'izakaya' }), 8.5, 0, -4);

// Esquina de callejón compuesta (x≈30): dos machiya y mobiliario denso
const arch = createArchKit(st.U, mats);
const A = new THREE.Group(); A.position.set(30, 0, 0); st.scene.add(A);
const h1 = arch.machiya({ seed: 11, floors: 2, bays: 3 }); h1.position.set(-3, 0, -4); A.add(h1);
const h2 = arch.shop({ seed: 5, floors: 2, bays: 3, kind: 'izakaya' }); h2.position.set(3.5, 0, -4); A.add(h2);
const h3 = arch.machiya({ seed: 21, floors: 2, bays: 3 }); h3.position.set(-5.4, 0, 1.5); h3.rotation.y = Math.PI / 2; A.add(h3);
const add = (g: THREE.Group, x: number, y: number, z: number, ry = 0) => { g.position.set(x, y, z); g.rotation.y = ry; A.add(g); return g; };
const fz = -4 + (h1.userData.size?.d ?? 6) / 2;
add(mk.wok({}), 0.6, 0, fz + 1.0);
add(mk.vending({ color: 'blue' }), -1.4, 0, fz + 0.45);
add(mk.nobori({ text: '焼きそば', bg: '#d8a42a', fg: '#1a1410' }), 1.6, 0, fz + 1.4);
add(mk.nobori({ text: '氷', bg: '#f4f1ea', fg: '#c8261f', sub: 'かき氷' }), -0.2, 0, fz + 1.6);
add(mk.barrels({ rows: 2 }), 4.4, 0, fz + 0.4);
add(mk.jardinera({ w: 1.4, seed: 3 }), -3.4, 0, fz + 0.4);
add(mk.bicycle({ color: '#b9c6d6' }), -4.2, 0, fz + 1.6, 0.4);
add(mk.broom({}), 2.7, 0, fz + 0.05);
add(mk.chochin({ text: '酒' }), 3.0, 2.55, fz + 0.5);
add(mk.chochin({ text: '酒' }), 4.6, 2.55, fz + 0.5);
add(mk.festival({ span: 9, n: 9, sag: 0.8, dy: 0.5 }), -4.6, 3.3, fz + 2.5);
add(mk.cables({ to: [10, 0.6, -1], n: 4, sag: 0.9 }), -4.9, 5.4, fz + 3);
add(mk.aircon({ wall: true }), -2.2, 0.8, fz);
add(mk.maceta({ kind: 'azalea', pot: 'terra' }), -0.2, 0, fz + 0.3);
add(mk.toro({ s: 0.8 }), 6.0, 0, fz + 1.2);
add(mk.jizo({}), 6.6, 0, fz + 0.3);

const views: Record<string, [number[], number[]]> = {
  hang: [[-3.5, 1.9, 4.2], [-3.5, 2.1, 0]],
  street: [[1, 1.5, 8.5], [1, 0.9, 4]],
  street2: [[7.5, 1.6, 8.5], [7.5, 0.8, 4]],
  stalls: [[-3, 1.8, 0.5], [-3, 0.9, -4]],
  stalls2: [[5.5, 1.8, 0.5], [5.5, 0.8, -4]],
  wok: [[-5.4, 1.6, -2.3], [-6.2, 1.0, -4]],
  wall: [[10, 1.8, 5], [10.5, 1.8, 0]],
  alley: [[30.5, 1.6, 6], [30, 1.8, -2]],
};
const cam = (k: string) => { const [p, l] = views[k]; st.view.pos.set(p[0], p[1], p[2]); st.view.look.set(l[0], l[1], l[2]); };
(window as any).__props = { make: mk, stats, cam, views };
st.start();
