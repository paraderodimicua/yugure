// Visor del kit de arquitectura: calle de muestra con todas las piezas.
// http://localhost:5183/dev/arquitectura.html  ·  __arch.stats lista triángulos/llamadas por pieza.
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';
import { createArchKit } from '../world/arch';

const st = createStage({ cam: [2, 3.2, 17], look: [0, 3, -4], focus: [0, 3, -6], shadowHalf: 46 });
st.view.sway = false;
const mats = createMaterials(st.U);
const kit = createArchKit(st.U, mats);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mats.cobble);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
st.scene.add(ground);

const stats: Record<string, { tris: number; draws: number }> = {};
const put = (name: string, g: THREE.Group, x: number, y: number, z: number, ry = 0) => {
  g.position.set(x, y, z); g.rotation.y = ry; st.scene.add(g);
  stats[name] = { tris: g.userData.tris, draws: g.userData.draws };
  return g;
};

// Acera norte (fachadas a +Z): casas pegadas como en un callejón de Kioto.
let x = -30;
const row = (name: string, g: THREE.Group, gap = 0.5) => { const w = g.userData.size.w; put(name, g, x + w / 2, 0, 0); x += w + gap; };
row('machiya_1p', kit.machiya({ seed: 3, floors: 1, bays: 3 }));
row('machiya_2p', kit.machiya({ seed: 11, floors: 2, bays: 3 }));
row('shop_izakaya', kit.shop({ seed: 5, floors: 2, bays: 3, kind: 'izakaya' }));
row('machiya_3p', kit.machiya({ seed: 8, floors: 3, bays: 2 }));
row('shop_store', kit.shop({ seed: 9, floors: 2, bays: 4, kind: 'store' }));
row('machiya_2p_b', kit.machiya({ seed: 21, floors: 2, bays: 4 }));
row('storehouse', kit.storehouse({ seed: 2 }), 2.2);
row('teahouse', kit.teahouse({ seed: 4 }), 1.5);

// Segunda línea sobre terraza, con escalera, pagoda y santuario.
put('terrace', kit.terrace(26, 2.6, 12, { seed: 1 }), -14, 0, -9);
put('stoneStairs', kit.stoneStairs(15, 2.6, { seed: 2 }), 1.2, 0, -3.5);
put('machiya_alto', kit.machiya({ seed: 31, floors: 2, bays: 3 }), -21, 2.7, -12.5);
put('shop_alto', kit.shop({ seed: 14, floors: 1, bays: 3 }), -13, 2.7, -12.5);
put('pagoda3', kit.pagoda(3, { seed: 1 }), -4, 2.7, -15);
put('pagoda5', kit.pagoda(5, { seed: 2 }), 12, 0, -20);
put('shrine', kit.shrine({ seed: 1 }), 24, 0, -12);
put('torii', kit.gate({ seed: 1, kind: 'torii' }), 24, 0, -5);
put('stoneWall', kit.stoneWall(9, 2.2, { seed: 3 }), 31, 0, -9, -Math.PI / 2);

// Acera sur (de espaldas a la cámara lejana) y piezas sueltas.
put('gate', kit.gate({ seed: 2, kind: 'roofed' }), -34, 0, 4, Math.PI / 2);
put('bridge', kit.bridge({ seed: 1 }), 31, 0, 6.5);
put('fence_board', kit.woodFence(7, 1.7, { seed: 1, kind: 'board' }), -22, 0, 9, Math.PI);
put('fence_bamboo', kit.woodFence(6, 1.5, { seed: 2, kind: 'bamboo' }), -14, 0, 9, Math.PI);
put('machiya_sur', kit.machiya({ seed: 40, floors: 2, bays: 3 }), 8, 0, 9.5, Math.PI);

(window as any).__arch = { kit, stats, mats };
st.renderer.shadowMap.needsUpdate = true;
st.start();
