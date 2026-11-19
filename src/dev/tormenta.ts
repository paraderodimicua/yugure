// Visor de la tormenta y la compuerta: http://localhost:5183/dev/tormenta.html?q=low|medium|high|ultra
//   __storm.set({ frontZ, danger, inside, life })  ·  __storm.intro(0..1)  ·  __storm.play() anima la apertura
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';
import { createArchKit } from '../world/arch';
import { createStorm } from '../game/storm';
import type { Quality, StormState } from '../game/contracts';

const quality = (new URLSearchParams(location.search).get('q') ?? 'high') as Quality;
const st = createStage({ cam: [5.5, 2.2, -6], look: [5.75, 9, 12], focus: [5, 4, 0], shadowHalf: 40 });
st.view.sway = false;
const mats = createMaterials(st.U);
const kit = createArchKit(st.U, mats);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mats.cobble);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
st.scene.add(ground);

// calle mínima: callejón entre x≈2 y x≈9.5, casas a ambos lados mirando a la calle
for (let i = 0; i < 6; i++) {
  const z = 6 - i * 9;
  const L = kit.machiya({ seed: 3 + i, floors: 1 + (i % 2), bays: 3 }); L.position.set(-2, 0, z); L.rotation.y = Math.PI / 2; st.scene.add(L);
  const R = kit.machiya({ seed: 20 + i, floors: 2 - (i % 2), bays: 3 }); R.position.set(13.5, 0, z); R.rotation.y = -Math.PI / 2; st.scene.add(R);
}

const storm = createStorm(st, mats, kit, quality);
st.scene.add(storm.root);
const s: StormState = { player: new THREE.Vector3(5.75, 0, 0), frontZ: storm.gateZ + 8, danger: 0.3, inside: 0, life: 1 };
let playT = -1;
st.onTick((t, dt) => {
  if (playT >= 0) { const k = Math.min(1, (performance.now() - playT) / 3200); storm.intro(k); if (k >= 1) playT = -1; }
  s.player.copy(st.camera.position);
  storm.update(t, dt, s);
});
storm.intro(0);

(window as any).__storm = {
  storm, s,
  set(o: Partial<StormState>) { Object.assign(s, o); },
  intro(x: number) { playT = -1; storm.intro(x); },
  play() { playT = performance.now(); },
  info() { return st.renderer.info.render; },
};
st.renderer.shadowMap.needsUpdate = true;
st.start();
