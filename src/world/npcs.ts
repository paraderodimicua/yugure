// Habitantes de YŪGURE. createNPCs(U, mats).make[clave](opts) → THREE.Group con origen en los pies,
// 1 u = 1 m, mirando a +Z. Opciones comunes: seed (paleta, estampado, altura y fase), static (sin animación).
// Un único material (atlas de canvas + color por vértice); geometrías cacheadas por variante.
import * as THREE from 'three';
import type { Shared } from '../stage';
import type { Mats } from '../render/materials';
import { npcMaterial } from './npcs/kit';
import type { Core } from './npcs/core';
import { PEOPLE } from './npcs/people';
import { ANIMALS } from './npcs/animals';

export function createNPCs(U: Shared, mats: Mats) {
  const C: Core = { mat: npcMaterial(U, mats), anims: [], cache: new Map() };
  const make: Record<string, (opts?: any) => THREE.Group> = {};
  for (const [k, fn] of Object.entries({ ...PEOPLE, ...ANIMALS })) make[k] = (o: any = {}) => (fn as (c: Core, o: any) => THREE.Group)(C, o);
  function update(t: number, dt: number) { for (let i = 0; i < C.anims.length; i++) C.anims[i](t, dt); }
  return { make, update, material: C.mat };
}
