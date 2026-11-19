// Visor de la dimensión oscura: http://localhost:5183/dev/dimension.html?q=low|medium|high|ultra
//   __dim.cam(z)  coloca al «corredor» en la ruta (z local, 0 → -260) con cámara de persecución
//   __dim.cam(x, y, z, lx, ly, lz)  cámara libre (coordenadas locales)  ·  __dim.run(true) recorre solo
//   __dim.info()  llamadas de dibujo y triángulos  ·  __dim.hits  impactos recibidos
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';
import { createPhysics } from '../game/physics';
import { createDimension } from '../game/dimension';
import type { Quality } from '../game/contracts';

const quality = (new URLSearchParams(location.search).get('q') ?? 'high') as Quality;
const st = createStage({ cam: [2000, 4, 8], look: [2000, 2, -20], fov: 55 });
st.view.sway = false;
const mats = createMaterials(st.U);
const physics = createPhysics();
const dim = createDimension(st, mats, physics, quality);
const O = new THREE.Vector3(2000, 0, 0);
dim.start(O.x, O.z);

const entry = dim.portalMesh(); entry.position.set(O.x - 14, -2, O.z - 30); entry.rotation.y = 0.5; st.scene.add(entry);

const runner = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.05, 4, 8), mats.tint('fabric', 0xc8b8a0));
st.scene.add(runner);
const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
const route = dim.route;
const prev = new THREE.Vector3();
let s = 0, auto = false, free = false, hits = 0;
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;left:10px;top:8px;color:#cbb8ff;font:13px monospace;z-index:9';
document.body.appendChild(hud);

function along(k: number, out: THREE.Vector3) {
  const i = Math.max(0, Math.min(route.length - 2, Math.floor(k))), f = Math.min(1, Math.max(0, k - i));
  out.lerpVectors(route[i], route[i + 1], f);
  out.y += Math.sin(f * Math.PI) * 1.2;
  return out.add(O);
}
function idxForZ(z: number) { for (let i = 0; i < route.length - 1; i++) if (route[i + 1].z <= z) return i + (route[i].z - z) / Math.max(0.01, route[i].z - route[i + 1].z); return route.length - 1; }

st.onTick((t, dt) => {
  if (auto) s = Math.min(route.length - 1, s + dt * 1.6);
  prev.copy(player.pos);
  along(s, player.pos);
  if (dt > 0) player.vel.copy(player.pos).sub(prev).divideScalar(dt);
  if (player.vel.length() > 30) player.vel.set(0, 0, 0);
  runner.position.copy(player.pos); runner.position.y += 0.87;
  if (!free) { st.view.pos.set(player.pos.x + 1.5, player.pos.y + 3.2, player.pos.z + 7.5); st.view.look.set(player.pos.x, player.pos.y + 1.4, player.pos.z - 6); }
  physics.refreshMoving();
  dim.update(t, dt, player, () => { hits++; });
  hud.textContent = `q=${quality} · z=${(player.pos.z - O.z).toFixed(1)} · impactos ${hits} · draws ${st.renderer.info.render.calls}`;
});

(window as any).__dim = {
  dim, physics, get hits() { return hits; },
  cam(...a: number[]) {
    if (a.length >= 6) { free = true; st.view.pos.set(a[0] + O.x, a[1], a[2] + O.z); st.view.look.set(a[3] + O.x, a[4], a[5] + O.z); }
    else { free = false; s = idxForZ(a[0] ?? 0); }
  },
  run(on = true) { auto = on; free = false; },
  async info() { const r = st.renderer; r.info.autoReset = false; r.info.reset(); await new Promise(f => requestAnimationFrame(() => f(0))); const o = { ...r.info.render }; r.info.autoReset = true; return o; },
};
st.start();
