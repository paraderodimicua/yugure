// Visor de habitantes: el reparto en fila. http://localhost:5183/dev/habitantes.html
// __npc.stats lista triángulos/llamadas por pieza; __y.view.pos/look mueven la cámara.
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';
import { createNPCs } from '../world/npcs';

const st = createStage({ cam: [0, 1.6, 9], look: [0, 0.9, 0], focus: [0, 1, 0], shadowHalf: 14, dynamicShadows: true });
st.view.sway = false;
const mats = createMaterials(st.U);
const npc = createNPCs(st.U, mats);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.cobble);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
st.scene.add(ground);

const stats: Record<string, { tris: number; draws: number }> = {};
const put = (name: string, g: THREE.Group, x: number, y = 0, z = 0, ry = 0) => {
  g.position.set(x, y, z); g.rotation.y = ry; st.scene.add(g);
  stats[name] = { tris: g.userData.tris, draws: g.userData.draws };
  return g;
};
// fila principal de personas
put('elder', npc.make.elder({ seed: 1 }), -5.2);
put('elder_walk', npc.make.elder({ seed: 6, walk: 2.4 }), -6.6, 0, -3);
put('cook', npc.make.cook({ seed: 0 }), -3.9);
put('boy', npc.make.boy({ seed: 2, radius: 1.1 }), -2.0, 0, -2.6);
put('boy_static', npc.make.boy({ seed: 5, run: false }), -2.6);
put('girl', npc.make.girl({ seed: 1 }), -1.6);
put('lady', npc.make.lady({ seed: 0 }), -0.4);
put('lady_walk', npc.make.lady({ seed: 3, walk: 2.2 }), 0.9, 0, -3);
put('oldLady', npc.make.oldLady({ seed: 0 }), 1.0);
put('monk', npc.make.monk({ seed: 0 }), 2.9, 0, -0.4);
put('teaCouple', npc.make.teaCouple({ seed: 0 }), 4.8);
// animales delante
put('cat_sit', npc.make.cat({ seed: 0 }), -4.4, 0, 1.6);
put('cat_sleep', npc.make.cat({ seed: 3, pose: 'sleep' }), -3.8, 0, 1.7);
put('shiba', npc.make.shiba({ seed: 0 }), -2.9, 0, 1.6);
put('crane', npc.make.crane({ seed: 0 }), 6.6, 0, -1.2, -0.6);
// estanque con koi
const pond = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), mats.water);
pond.rotation.x = -Math.PI / 2; pond.position.set(2.6, 0.02, 2.6); st.scene.add(pond);
const pondBed = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), mats.stoneMoss);
pondBed.rotation.x = -Math.PI / 2; pondBed.position.set(2.6, -0.3, 2.6); st.scene.add(pondBed);
put('koi', npc.make.koi({ seed: 0, count: 5, radius: 1.2 }), 2.6, 0.02, 2.6);
// cable con gorriones
for (const x of [-1.5, 1.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), mats.woodWeathered); p.position.set(x - 0.5, 1.3, 2.2); p.castShadow = true; st.scene.add(p); }
const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3, 4), mats.metalDark); wire.rotation.z = Math.PI / 2; wire.position.set(-0.5, 2.4, 2.2); st.scene.add(wire);
put('sparrows', npc.make.sparrow({ seed: 0, count: 5 }), -0.5, 2.406, 2.2);

st.onTick((t, dt) => npc.update(t, dt));
(window as any).__npc = { npc, stats, mats };
st.start();
