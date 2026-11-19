// Kit de mobiliario urbano (fase v2-3). createProps(U, mats).make[clave](opciones) → THREE.Group
// con origen en el suelo (o en el punto de cuelgue), 1 u = 1 m, frente a +Z.
// userData: tris, draws, size. update(t, dt) anima llamas, vapor, furin, molinillos, ventiladores y farolillos
// (las telas ondean en GPU con U.time, sin coste de CPU).
import * as THREE from 'three';
import type { Shared } from '../stage';
import type { Mats } from '../render/materials';
import { createKit } from './props/kit';
import { streetProps } from './props/street';
import { stallProps } from './props/stalls';

export function createProps(U: Shared, mats: Mats) {
  const K = createKit(U, mats);
  const make: Record<string, (opts?: any) => THREE.Group> = { ...streetProps(K), ...stallProps(K) };
  function update(t: number, dt: number) { for (const a of K.anims) a(t, dt); }
  return { make, update, kit: K };
}
