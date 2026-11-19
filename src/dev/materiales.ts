// Visor de materiales: http://localhost:5183/dev/materiales.html
// Rejilla con cada material sobre cubo, esfera y cilindro + banco de pruebas (vigas, muro, tejado,
// objeto móvil e instancias). En consola: __m.cell(i) / __m.row(r) / __m.rig() colocan la cámara.
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials, type MatName } from '../render/materials';
import { texStats, warmTextures } from '../render/textures';

const st = createStage({ cam: [-6, 5, -9], look: [8, 0.5, 4], focus: [9, 0, 4], shadowHalf: 26, dynamicShadows: true });
st.view.sway = false;
const mats = createMaterials(st.U);
warmTextures();
console.log(`[materiales] texturas: ${texStats.count} en ${texStats.ms.toFixed(0)} ms`);

const NAMES = Object.keys(mats).filter((k) => !['tint', 'glow', 'along'].includes(k)) as MatName[];
const COLS = 9, DX = 3.7, DZ = 10;

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshToonMaterial({ color: 0x4a4650 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
st.scene.add(ground);

function label(text: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const g = c.getContext('2d')!;
  g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(10,10,20,0.75)'; g.fillRect(0, 0, 256, 48);
  g.fillStyle = '#fff'; g.fillText(text, 128, 25);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(1.9, 0.36, 1);
  return s;
}

const box = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(0.55, 40, 24), cyl = new THREE.CylinderGeometry(0.32, 0.32, 1.3, 32);
const pos = (i: number) => new THREE.Vector3((i % COLS) * DX, 0, Math.floor(i / COLS) * DZ);
NAMES.forEach((name, i) => {
  const p = pos(i), m = mats[name];
  const a = new THREE.Mesh(box, m); a.position.set(p.x - 1.15, 0.5, p.z); a.rotation.y = 0.5;
  const b = new THREE.Mesh(sph, m); b.position.set(p.x, 0.55, p.z);
  const c = new THREE.Mesh(cyl, m); c.position.set(p.x + 1.05, 0.65, p.z);
  for (const o of [a, b, c]) { o.castShadow = o.receiveShadow = true; st.scene.add(o); }
  const l = label(name); l.position.set(p.x, 0.2, p.z - 1.3); st.scene.add(l);
});

// Banco de pruebas a escala real (cajas unitarias escaladas, como en el kit de arquitectura).
const RX = 4, RZ = -9;
const mk = (m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, g: THREE.BufferGeometry = box) => {
  const o = new THREE.Mesh(g, m); o.scale.set(sx, sy, sz); o.position.set(RX + x, y, RZ + z); o.castShadow = o.receiveShadow = true; st.scene.add(o); return o;
};
const ucyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
mk(mats.plaster, 5, 3, 0.2, 0, 1.5, 0);
mk(mats.plasterAged, 0.2, 3, 4, 2.6, 1.5, -2);
mk(mats.woodDark, 5.4, 0.22, 0.22, 0, 3.1, -0.05);
mk(mats.woodDark, 0.22, 3, 0.22, -2.5, 1.5, -0.08);
mk(mats.woodWarm, 0.22, 3, 0.22, 0, 1.5, -0.08);
mk(mats.woodWarm, 5, 0.12, 2.4, 0, 0.06, -1.3);
mk(mats.stone, 6, 0.5, 0.8, 0, 0.25, -3);
mk(mats.paper, 1.6, 2, 0.04, -1.25, 1.4, -0.14);
mk(mats.tileSlate, 6.4, 0.12, 3.2, 0, 3.9, -1.2).rotation.x = -0.5;
mk(mats.tileClay, 3.2, 0.12, 4.6, 5.2, 3.7, -2).rotation.z = -0.5;
mk(mats.cobble, 8, 0.1, 5, 9.5, 0.05, -3);
mk(mats.water, 5, 0.06, 5, -6, 0.03, -3);
mk(mats.lacquerRed, 0.3, 3.2, 0.3, 7, 1.6, -4, ucyl);
mk(mats.bark, 0.5, 4, 0.5, 9, 2, -4, ucyl);
mk(mats.leaf, 2.2, 1.7, 2.2, 9, 4.6, -4, new THREE.IcosahedronGeometry(0.5, 3));
// instancias de bambú (cada una con desfase propio) y un objeto que se mueve (la textura no debe nadar)
const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.04, 4, 12), mats.bamboo, 14);
const M = new THREE.Matrix4();
for (let i = 0; i < 14; i++) {
  M.makeRotationZ(Math.sin(i * 7.1) * 0.06);
  M.setPosition(RX + 11 + (i % 7) * 0.3 + Math.sin(i * 3.3) * 0.1, 2, RZ - 3.5 - Math.floor(i / 7) * 0.35);
  inst.setMatrixAt(i, M);
}
inst.castShadow = true; st.scene.add(inst);
const mover = mk(mats.woodWeathered, 0.8, 0.8, 0.8, 12, 1.2, -1);
st.onTick((t) => { mover.position.x = RX + 12 + Math.sin(t * 0.8) * 1.5; mover.rotation.y = t * 0.6; mover.rotation.x = t * 0.25; });

// medida de coste: fps y ms de gl.finish() por fotograma
let acc = 0, cnt = 0, lastMs = 0, fT = performance.now(), fN = 0, fps = 0;
st.onTick(() => {
  const t0 = performance.now(); st.renderer.getContext().finish(); acc += performance.now() - t0; cnt++;
  fN++; const n = performance.now();
  if (n - fT > 1000) { fps = fN * 1000 / (n - fT); fN = 0; fT = n; lastMs = acc / Math.max(cnt, 1); acc = 0; cnt = 0; }
});

(window as any).__m = {
  names: NAMES, mats, texStats,
  stats: () => ({ fps: +fps.toFixed(1), finishMs: +lastMs.toFixed(2), calls: st.renderer.info.render.calls }),
  /** primer plano de la celda i (o nombre); back = a contraluz */
  cell(i: number | MatName, back = false, d = 3.2) {
    const k = typeof i === 'number' ? i : NAMES.indexOf(i), p = pos(k);
    st.view.pos.set(p.x - (back ? -0.6 : 1.2), 1.7, p.z + (back ? d : -d)); st.view.look.set(p.x, 0.6, p.z);
  },
  /** fila r completa (6 materiales), vista desde el lado iluminado (el sol queda a la espalda) */
  row(r: number, back = false, d = 8) {
    const z = r * DZ, x = (COLS - 1) * DX / 2;
    st.view.pos.set(x - 2, 4.2, z + (back ? d : -d)); st.view.look.set(x, 0.3, z);
  },
  rig(back = false) { st.view.pos.set(RX + (back ? 9 : -3), 3.2, RZ + (back ? 9 : -14)); st.view.look.set(RX + 3, 1.8, RZ - 1.5); },
};
(window as any).__m.row(0);
st.start();
