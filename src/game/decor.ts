// Jungla que invade la calle: laderas de bosque a ambos lados, árboles en el callejón, bambú y árboles
// en la terraza alta, hiedra en el muro, maleza, lianas y pétalos alrededor del jugador.
// Todo en piscinas pregeneradas que se recolocan al avanzar (sin generar geometría en partida).
import * as THREE from 'three';
import type { Vegetation } from '../world/vegetation';

type Item = { o: THREE.Object3D; used: boolean; z: number };

export type DecorLayout = { backX: number; backY: number; oppX: number; wallFaceX: number };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createDecor(veg: Vegetation, L: DecorLayout, seed = 3) {
  const root = new THREE.Group();
  const r = rng(seed);
  const pool = (make: (i: number) => THREE.Object3D, n: number): Item[] => {
    const out: Item[] = [];
    for (let i = 0; i < n; i++) {
      const o = make(i); o.visible = false;
      o.traverse((m) => { (m as THREE.Mesh).castShadow = false; });
      root.add(o); out.push({ o, used: false, z: 0 });
    }
    return out;
  };
  const take = (p: Item[]) => { const f = p.filter((i) => !i.used); if (!f.length) return null; const it = f[Math.floor(r() * f.length)]; it.used = true; it.o.visible = true; return it; };

  // laderas: la izquierda sube detrás de la terraza; la derecha, detrás de la fila de enfrente
  const TILE = 120;
  const leftHill = pool((i) => veg.make.forestMass({ seed: 10 + i, w: 90, d: TILE, count: 520, scale: 1.25, mix: [0.55, 0.15, 0.1, 0.2], heightAt: (x: number) => Math.max(0, 45 - x) * 0.42 }), 3);
  const rightHill = pool((i) => veg.make.forestMass({ seed: 20 + i, w: 90, d: TILE, count: 420, scale: 1.2, mix: [0.6, 0.2, 0.1, 0.1], heightAt: (x: number) => Math.max(0, x + 45) * 0.3 }), 3);
  // árboles del callejón, delante de las fachadas de enfrente
  const kinds = ['sakura', 'maple', 'sakura', 'jungleTree', 'banana', 'pine', 'sakura', 'maple', 'jungleTree'];
  const alleyTrees = pool((i) => veg.make[kinds[i]]({ seed: 40 + i, scale: kinds[i] === 'jungleTree' ? 0.6 : 0.75, shadow: false, tone: i === 2 ? 'white' : undefined }), kinds.length);
  // terraza alta: bambú y árboles grandes que asoman por encima de los tejados
  const backKinds = ['bamboo', 'jungleTree', 'bamboo', 'sakura', 'jungleTree', 'bamboo', 'maple'];
  const backTrees = pool((i) => backKinds[i] === 'bamboo'
    ? veg.make.bamboo({ seed: 60 + i, count: 34, w: 6, d: 5, height: [9, 14] })
    : veg.make[backKinds[i]]({ seed: 60 + i, scale: 1.25, shadow: false }), backKinds.length);
  const ivyPatches = pool((i) => { const g = new THREE.Group(); const iv = veg.make.ivy({ w: 5 + (i % 3), h: 3.2, seed: 80 + i, cover: 0.75 }); iv.rotation.y = Math.PI / 2; g.add(iv); return g; }, 6);
  const brush = pool((i) => veg.make.undergrowth({ seed: 90 + i, w: 9, d: 12, density: 1.1 }), 5);
  const curtains = pool((i) => { const g = new THREE.Group(); const c = veg.make.vineCurtain({ w: 3 + (i % 2) * 1.5, h: 2.2, seed: 100 + i }); c.rotation.y = -Math.PI / 2; g.add(c); return g; }, 5);
  const petals = veg.make.petals({ area: { center: [0, 6, 0], size: [26, 12, 40] }, count: 380, kind: 'mix' });
  root.add(petals);

  const placed: { it: Item; pool: Item[] }[] = [];
  const put = (p: Item[], x: number, y: number, z: number, ry = 0) => {
    const it = take(p); if (!it) return;
    it.o.position.set(x, y, z); it.o.rotation.y = ry; it.z = z; it.o.updateMatrixWorld(true);
    placed.push({ it, pool: p });
  };

  let hillCursor = 60, stepCursor = 4;
  function update(playerZ: number) {
    let guard = 0;
    while (hillCursor > playerZ - 200 && guard++ < 6) {
      const z = hillCursor - TILE / 2;
      put(leftHill, L.backX - 52, L.backY, z);
      put(rightHill, L.oppX + 52, 0, z);
      hillCursor -= TILE;
    }
    while (stepCursor > playerZ - 110 && guard++ < 40) {
      const z = stepCursor;
      if (r() < 0.4) put(alleyTrees, L.oppX - 0.7, 0, z - r() * 6, r() * 6);
      if (r() < 0.6) put(backTrees, L.backX - 4 - r() * 8, L.backY, z - r() * 8, r() * 6);
      if (r() < 0.55) put(ivyPatches, L.wallFaceX + 0.05, 0.1, z - r() * 6);
      if (r() < 0.4) put(brush, L.backX - 6, L.backY, z - 6);
      if (r() < 0.3) put(curtains, L.oppX - 0.15, 3.1 + r() * 0.4, z - r() * 6);
      stepCursor -= 14;
    }
    for (let i = placed.length - 1; i >= 0; i--) {
      const { it } = placed[i];
      const reach = it.o === leftHill[0].o || leftHill.includes(it) || rightHill.includes(it) ? TILE / 2 + 20 : 20;
      if (it.z > playerZ + reach) { it.used = false; it.o.visible = false; placed.splice(i, 1); }
    }
    petals.position.set(0, 0, playerZ - 10);
  }
  function shift(dz: number) {
    for (const { it } of placed) { it.z += dz; it.o.position.z += dz; it.o.updateMatrixWorld(true); }
    hillCursor += dz; stepCursor += dz;
  }
  return { root, update, shift };
}
