// Kit de arquitectura de YŪGURE. Cada constructor devuelve un THREE.Group con origen en el suelo,
// centro de la fachada y fachada mirando a +Z, ya fusionado en una malla por material.
//   userData.size      = { w, h, d }
//   userData.platforms = [{ min:[x,y,z], max:[x,y,z], slope?:{axis,dir} }]  superficies pisables (locales)
//   userData.anchors   = [{ kind:'noren'|'sign'|'signV'|'lantern', pos:[x,y,z], w?, h? }]  huecos para mobiliario
//   userData.tris / userData.draws  = coste
import type * as THREE from 'three';
import type { Shared } from '../stage';
import type { Mats } from '../render/materials';
import { townhouse, type HouseOpts, type ShopOpts } from './arch/houses';
import { teahouse, storehouse, type PieceOpts } from './arch/houses2';
import { pagoda, shrine, gate, type SacredOpts, type GateOpts } from './arch/sacred';
import { bridge, stoneStairs, stoneWall, woodFence, terrace, type CivilOpts } from './arch/civil';

export type { Platform, Anchor, Size } from './arch/core';
export type { HouseOpts, ShopOpts, PieceOpts, SacredOpts, GateOpts, CivilOpts };
export type ArchKit = ReturnType<typeof createArchKit>;

export function createArchKit(U: Shared, mats: Mats) {
  void U;
  return {
    machiya: (o: HouseOpts = {}): THREE.Group => townhouse(mats, o, false),
    shop: (o: ShopOpts = {}): THREE.Group => townhouse(mats, o, true),
    teahouse: (o: PieceOpts = {}) => teahouse(mats, o),
    storehouse: (o: PieceOpts = {}) => storehouse(mats, o),
    pagoda: (levels = 3, o: SacredOpts = {}) => pagoda(mats, levels, o),
    shrine: (o: SacredOpts = {}) => shrine(mats, o),
    gate: (o: GateOpts = {}) => gate(mats, o),
    bridge: (o: CivilOpts & { len?: number; width?: number; rise?: number } = {}) => bridge(mats, o),
    stoneStairs: (steps = 10, width = 2.4, o: CivilOpts = {}) => stoneStairs(mats, steps, width, o),
    stoneWall: (len = 8, h = 2.4, o: CivilOpts = {}) => stoneWall(mats, len, h, o),
    woodFence: (len = 6, h = 1.7, o: CivilOpts & { kind?: 'board' | 'bamboo' } = {}) => woodFence(mats, len, h, o),
    terrace: (w = 8, h = 2.4, d = 7, o: CivilOpts & { rail?: boolean } = {}) => terrace(mats, w, h, d, o),
  };
}
