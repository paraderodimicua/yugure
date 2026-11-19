// Contexto compartido: un material por especie (perezoso) y sus texturas de canvas.
import * as THREE from 'three';
import type { Mats } from '../../render/materials';
import type { Shared } from '../../stage';
import { folMat, type FolOpts } from './common';
import * as T from './textures';

export type Species = 'sakura' | 'maple' | 'broad' | 'pine' | 'banana' | 'cane' | 'bambooLeaf'
  | 'fern' | 'grass' | 'bush' | 'ivy' | 'vine' | 'vineLeaf' | 'moss' | 'canopy';

export type Ctx = { U: Shared; mats: Mats; mat(s: Species): THREE.Material };

export function createCtx(U: Shared, mats: Mats): Ctx {
  const tex = new Map<string, THREE.Texture>();
  const tx = (k: string, f: () => THREE.Texture) => { let t = tex.get(k); if (!t) { t = f(); tex.set(k, t); } return t; };
  const card: FolOpts = { atlas: true, nrm: 'inst', keepN: true };
  const defs: Record<Species, () => FolOpts> = {
    sakura: () => ({ ...card, map: tx('sakura', T.texSakura), amp: 0.05, height: 7, flutter: 0.03, trans: 1.0 }),
    maple: () => ({ ...card, map: tx('maple', T.texMaple), amp: 0.05, height: 6, flutter: 0.03, trans: 1.3 }),
    broad: () => ({ ...card, map: tx('broad', T.texBroad), amp: 0.14, base: 6, height: 14, flutter: 0.04, trans: 1.0 }),
    pine: () => ({ ...card, map: tx('pine', T.texPine), amp: 0.03, height: 5, flutter: 0.01, trans: 0.45, nrmBlend: 0.9 }),
    banana: () => ({ map: tx('banana', T.texBanana), amp: 0.1, base: 1.2, height: 2.5, flutter: 0.05, trans: 1.1 }),
    cane: () => ({ map: tx('cane', T.texCane), awp: true, amp: 0.22, height: 12, flutter: 0, trans: 0.15, side: THREE.FrontSide, rim: 0.7 }),
    bambooLeaf: () => ({ ...card, awp: true, map: tx('bamboo', T.texBambooLeaves), amp: 0.22, height: 12, flutter: 0.05, trans: 0.85, nrmBlend: 0.7 }),
    fern: () => ({ atlas: true, map: tx('fern', T.texFern), amp: 0.05, height: 1.2, flutter: 0.025, trans: 0.9 }),
    grass: () => ({ atlas: true, map: tx('fern', T.texFern), nrm: 'local', nrmCenter: [0, -0.6, 0], nrmBlend: 0.75, keepN: true, amp: 0.07, height: 1, flutter: 0.01, trans: 0.45 }),
    bush: () => ({ ...card, map: tx('bush', T.texBush), amp: 0.03, height: 2, flutter: 0.015, trans: 0.7 }),
    ivy: () => ({ ...card, aw: true, map: tx('ivy', T.texIvy), amp: 0.02, flutter: 0.012, trans: 0.7, nrmBlend: 0.6 }),
    vine: () => ({ color: 0x4f4a30, aw: true, amp: 0.28, flutter: 0, trans: 0.1, side: THREE.FrontSide, rim: 0.6 }),
    vineLeaf: () => ({ ...card, aw: true, map: tx('ivy', T.texIvy), amp: 0.28, flutter: 0.02, trans: 1.0, nrmBlend: 0.6 }),
    moss: () => ({ ...card, map: tx('moss', T.texMoss), amp: 0, flutter: 0, trans: 0.3, nrmBlend: 0.85, rim: 0.2 }),
    canopy: () => ({ atlas: true, map: tx('canopy', T.texCanopy), basic: true, amp: 0.15, height: 14, flutter: 0 }),
  };
  const cache = new Map<Species, THREE.Material>();
  return {
    U, mats,
    mat(s) { let m = cache.get(s); if (!m) { m = folMat(U, defs[s]()); m.name = 'veg_' + s; cache.set(s, m); } return m; },
  };
}
