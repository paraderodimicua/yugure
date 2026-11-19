// Vida en el callejón: vecinos, niños, el cocinero del wok, animales en los tejados y pájaros.
// Piscina fija de personajes que se recolocan delante del jugador.
import * as THREE from 'three';
import type { createNPCs } from '../world/npcs';

type NPCs = ReturnType<typeof createNPCs>;
type Item = { o: THREE.Object3D; used: boolean; z: number; spot: 'alley' | 'bench' | 'roof' | 'water' };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createFolk(npc: NPCs, L: { oppX: number; runFacadeX: number }, seed = 5) {
  const root = new THREE.Group();
  const r = rng(seed);
  const items: Item[] = [];
  const add = (spot: Item['spot'], o: THREE.Object3D) => { o.visible = false; o.traverse((m) => { (m as THREE.Mesh).castShadow = false; }); root.add(o); items.push({ o, used: false, z: 0, spot }); };

  // reparto: caminantes y figuras de calle en el callejón; sentados junto a las fachadas; gatos arriba
  add('alley', npc.make.elder({ seed: 1, walk: 6 }));
  add('alley', npc.make.lady({ seed: 2, walk: 5 }));
  add('alley', npc.make.lady({ seed: 7, walk: 4 }));
  add('alley', npc.make.boy({ seed: 3, run: true, radius: 1.6 }));
  add('alley', npc.make.girl({ seed: 4 }));
  add('alley', npc.make.monk({ seed: 5 }));
  add('alley', npc.make.cook({ seed: 6, withWok: true }));
  add('alley', npc.make.elder({ seed: 9 }));
  add('alley', npc.make.shiba({ seed: 8 }));
  add('bench', npc.make.oldLady({ seed: 10, bench: true }));
  add('bench', npc.make.teaCouple({ seed: 11 }));
  add('bench', npc.make.cat({ seed: 12, pose: 'sit' }));
  add('roof', npc.make.cat({ seed: 13, pose: 'sleep' }));
  add('roof', npc.make.crane({ seed: 14 }));
  add('alley', npc.make.boy({ seed: 15, run: true, radius: 1.2 }));
  add('alley', npc.make.girl({ seed: 16 }));

  const placed: Item[] = [];
  let cursor = -2;
  function place(it: Item, z: number) {
    it.used = true; it.o.visible = true; it.z = z;
    if (it.spot === 'alley') {
      const side = r() < 0.5;
      it.o.position.set(side ? L.runFacadeX + 1.3 + r() * 1.5 : L.oppX - 1.4 - r() * 1.6, 0, z);
      it.o.rotation.y = side ? Math.PI / 2 + (r() - 0.5) * 1.2 : -Math.PI / 2 + (r() - 0.5) * 1.2;
      if (r() < 0.4) it.o.rotation.y = r() < 0.5 ? 0 : Math.PI; // de cara o de espaldas a la calle
    } else if (it.spot === 'bench') {
      it.o.position.set(L.oppX - 0.9, 0, z); it.o.rotation.y = -Math.PI / 2;
    } else {
      // tejado de enfrente, sobre el alero bajo
      it.o.position.set(L.oppX - 0.6, 3.15, z); it.o.rotation.y = -Math.PI / 2 + (r() - 0.5);
    }
    it.o.updateMatrixWorld(true);
    placed.push(it);
  }
  function update(playerZ: number) {
    let guard = 0;
    while (cursor > playerZ - 85 && guard++ < 20) {
      const free = items.filter((i) => !i.used);
      if (free.length) place(free[Math.floor(r() * free.length)], cursor - r() * 4);
      cursor -= 5 + r() * 6;
    }
    for (let i = placed.length - 1; i >= 0; i--) {
      const it = placed[i];
      if (it.z > playerZ + 16) { it.used = false; it.o.visible = false; placed.splice(i, 1); }
    }
  }
  function shift(dz: number) {
    for (const it of placed) { it.z += dz; it.o.position.z += dz; it.o.updateMatrixWorld(true); }
    cursor += dz;
  }
  return { root, update, shift };
}
