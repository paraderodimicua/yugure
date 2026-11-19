// Visor de vegetación: todas las especies en fila + rincón selvático con muro, escalera, hiedra y lianas.
// http://localhost:5183/dev/vegetacion.html  ·  __veg.stats lista triángulos/llamadas por pieza.
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';
import { createArchKit } from '../world/arch';
import { createVegetation } from '../world/vegetation';

const st = createStage({ cam: [4, 4.5, 24], look: [6, 4, -20], focus: [10, 3, -6], shadowHalf: 46 });
st.view.sway = false;
const mats = createMaterials(st.U);
const kit = createArchKit(st.U, mats);
const veg = createVegetation(st.U, mats);
const M = veg.make;

// suelo con ladera al fondo (para la masa forestal lejana)
const H = (x: number, z: number) => Math.max(0, (-z - 45) * 0.32) + Math.max(0, -z - 45) * 0.04 * Math.sin(x * 0.03);
{
  const g = new THREE.PlaneGeometry(700, 700, 140, 140).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, mats.earth); ground.receiveShadow = true;
  st.scene.add(ground);
}

const stats: Record<string, { tris: number; draws: number }> = {};
const put = (name: string, o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
  o.position.set(x, y, z); o.rotation.y = ry; st.scene.add(o);
  stats[name] = { tris: o.userData.tris, draws: o.userData.draws };
  return o;
};

// fila de especies
put('bamboo60', M.bamboo({ seed: 1, count: 60, w: 7, d: 6 }), -24, 0, -8);
put('sakura', M.sakura({ seed: 2 }), -12, 0, -6);
put('jungleTree', M.jungleTree({ seed: 3 }), 0, 0, -12);
put('pine', M.pine({ seed: 4 }), 9, 0, -5);
put('maple', M.maple({ seed: 5 }), 16, 0, -7);
put('banana', M.banana({ seed: 6 }), 23, 0, -5);
put('sakura_far', M.sakura({ seed: 7, lod: 'far' }), -6, 0, -22);
put('maple_far', M.maple({ seed: 8, lod: 'far', tone: 'orange' }), 12, 0, -22);
put('jungle_far', M.jungleTree({ seed: 9, lod: 'far' }), 26, 0, -24);
// primera fila: matas
put('fern', M.fern({ seed: 1 }), -7, 0, 2);
put('hydrangea', M.hydrangea({ seed: 2 }), -3.5, 0, 2);
put('azalea', M.azalea({ seed: 3 }), 0, 0, 2);
put('hydrangeaPink', M.bush({ seed: 4, kind: 'hydrangeaPink' }), 3.5, 0, 2);
put('bush', M.bush({ seed: 5, size: 1.0 }), 7, 0, 2);
put('grass', M.grass({ seed: 6, w: 3, d: 2 }), 11, 0, 2);
put('moss', M.moss({ seed: 7, w: 2.5, d: 2 }), 15, 0, 2);
put('maple_green', M.maple({ seed: 11, tone: 'green', scale: 0.7 }), -16, 0, 3);

// rincón selvático: muro de piedra con hiedra, escalera con musgo, lianas, plataneras y bambú detrás
const cx = 42;
put('stoneWall', kit.stoneWall(9, 2.4, { seed: 3 }), cx, 0, -4);
const iv = put('ivy', M.ivy({ w: 7.5, h: 2.4, seed: 2, cover: 1 }), cx + 0.3, 0, -3.92); iv.rotation.x = -0.12;
put('stoneStairs', kit.stoneStairs(14, 2.4, { seed: 2 }), cx - 6, 0, -3.6);
put('moss_stairs', M.moss({ seed: 9, w: 0.5, d: 4.5, density: 1.6 }), cx - 7.4, 1.2, -6);
put('moss_base', M.moss({ seed: 10, w: 9, d: 1.2 }), cx, 0, -3.2);
put('undergrowth', M.undergrowth({ seed: 3, w: 12, d: 4 }), cx + 1, 0, -1);
put('vineCurtain', M.vineCurtain({ w: 6, h: 2.2, seed: 4 }), cx + 1, 2.45, -4.15);
put('jungleTree_c', M.jungleTree({ seed: 12, height: 14 }), cx + 2, 0, -11);
put('banana_c', M.banana({ seed: 13 }), cx + 6.2, 0, -1.2);
put('banana_c2', M.banana({ seed: 14, scale: 0.8 }), cx - 9, 0, -1);
put('bamboo_c', M.bamboo({ seed: 5, count: 40, w: 6, d: 4 }), cx - 6, 0, -14);
put('vine_span', veg.vine([cx - 6, 7, -12], [cx + 3, 8.5, -10], { seed: 3, sag: 0.25 }), cx - 6, 7, -12);
put('vine_hang', M.vine({ from: [0, 0, 0], len: 6, seed: 7 }), cx + 4, 9.5, -9);
put('azalea_c', M.azalea({ seed: 15, size: 1.0 }), cx - 3.6, 0, -2.4);
put('hydrangea_c', M.hydrangea({ seed: 16, size: 0.9 }), cx + 4.6, 0, -2.9);

// pétalos y lejanía
put('petals', M.petals({ area: { center: [-6, 5, -4], size: [26, 10, 18] }, count: 700, kind: 'sakura' }), 0, 0, 0);
put('petals_momiji', M.petals({ area: { center: [16, 4, -6], size: [12, 8, 12] }, count: 250, kind: 'momiji' }), 0, 0, 0);
put('forestMass', M.forestMass({ seed: 1, w: 260, d: 110, count: 650, scale: 1.3, heightAt: (x: number, z: number) => H(x, z - 115) }), 0, 0, -115);
put('treeLine', M.treeLine({ seed: 2, len: 520, count: 160, depth: 10, heightAt: (x: number, z: number) => H(x, z - 190) }), 0, 0, -190);

st.onTick(veg.update);
(window as any).__veg = { veg, stats, mats };
st.renderer.shadowMap.needsUpdate = true;
st.start();
