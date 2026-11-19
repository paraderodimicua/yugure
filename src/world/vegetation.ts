// Vegetación de jungla de montaña: bambú, sakura, jungla, niwaki, momiji, platanera, helechos, arbustos en flor,
// lianas, hiedra, musgo, pétalos en GPU y masas lejanas. Follaje con tarjetas recortadas (alphaTest), viento en el
// shader de vértices (U.time + fase por instancia), translucidez a contraluz y un material por especie.
//
//   const veg = createVegetation(U, mats);
//   scene.add(veg.make.sakura({ seed: 2 }));            // cada pieza: userData.tris / userData.draws
//   stage.onTick(veg.update);
import * as THREE from 'three';
import type { Mats } from '../render/materials';
import type { Shared } from '../stage';
import { createCtx } from './vegetation/ctx';
import { banana, jungleTree, maple, pine, sakura } from './vegetation/trees';
import { bamboo, bush, fern, forestMass, grass, ivy, moss, petals, treeLine, undergrowth, vine, vineCurtain } from './vegetation/small';

export type Vegetation = ReturnType<typeof createVegetation>;

export function createVegetation(U: Shared, mats: Mats) {
  const C = createCtx(U, mats);
  const baseAmp = new Map<string, number>();
  const make: Record<string, (opts?: any) => THREE.Object3D> = {
    /** { seed, count=60, w=8, d=8, height:[8,13], lod, shadow, leaves } bosquecillo de cañas (2 llamadas) */
    bamboo: (o = {}) => bamboo(C, o),
    /** { seed, scale, lod, shadow, tone:'pink'|'white'|'deep' } */
    sakura: (o = {}) => sakura(C, o),
    /** { seed, scale, lod, shadow, height, lianas } */
    jungleTree: (o = {}) => jungleTree(C, o),
    /** { seed, scale, lod, shadow, pads } pino podado en nubes */
    pine: (o = {}) => pine(C, o),
    niwaki: (o = {}) => pine(C, o),
    /** { seed, scale, lod, shadow, tone:'red'|'orange'|'green' } */
    maple: (o = {}) => maple(C, o),
    momiji: (o = {}) => maple(C, o),
    /** { seed, scale, lod, leaves } */
    banana: (o = {}) => banana(C, o),
    /** { seed, size, fronds } */
    fern: (o = {}) => fern(C, o),
    /** { seed, w, d, count, size } hierba y matas */
    grass: (o = {}) => grass(C, o),
    /** { seed, w, d, density, heightAt } helechos + hierba (2 llamadas) */
    undergrowth: (o = {}) => undergrowth(C, o),
    /** { seed, kind:'green'|'hydrangea'|'hydrangeaPink'|'azalea', size, cards } */
    bush: (o = {}) => bush(C, o),
    hydrangea: (o = {}) => bush(C, { kind: 'hydrangea', ...o }),
    azalea: (o = {}) => bush(C, { kind: 'azalea', ...o }),
    /** { from, to?, seed, sag, len, leaves, thick } (el grupo queda en from) */
    vine: (o = {}) => vine(C, o.from ?? [0, 0, 0], o.to, o),
    /** { w=4, h=3, seed, count, leaves } cortina colgando desde y=0 */
    vineCurtain: (o = {}) => vineCurtain(C, o.w, o.h, o),
    /** { w=4, h=3, seed, density, cover } plano XY local mirando a +Z */
    ivy: (o = {}) => ivy(C, o.w, o.h, o),
    /** { seed, w, d, density, wall } */
    moss: (o = {}) => moss(C, o),
    /** { area: Box3 | {center,size}, count, kind:'sakura'|'momiji'|'leaf'|'mix', size, speed } */
    petals: (o = {}) => petals(C, o.area ?? {}, o),
    /** { seed, w, d, count, scale, mix:[ancho,conífera,ciprés,bambú], heightAt, tint } 1 llamada */
    forestMass: (o = {}) => forestMass(C, o),
    /** { seed, len, count, depth, scale, mix, heightAt, tint } 1 llamada */
    treeLine: (o = {}) => treeLine(C, o),
  };
  return {
    make,
    /** atajos tipados */
    vine: (from: THREE.Vector3 | [number, number, number], to?: THREE.Vector3 | [number, number, number] | null, o = {}) => vine(C, from, to, o),
    ivy: (w: number, h: number, o = {}) => ivy(C, w, h, o),
    petals: (area: THREE.Box3 | { center?: [number, number, number]; size?: [number, number, number] }, o = {}) => petals(C, area, o),
    /** materiales por especie (para ajustar viento: mat.userData.fol.uWind.value) */
    material: C.mat,
    // el viento y los pétalos viven en los shaders (U.time); aquí solo un posible racheo global
    update(t: number, _dt: number) {
      const gust = 1 + 0.35 * Math.max(0, Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1));
      for (const s of ['bambooLeaf', 'cane', 'broad', 'vine', 'vineLeaf'] as const) {
        const u = C.mat(s).userData.fol.uWind.value as THREE.Vector4;
        const b = baseAmp.get(s) ?? baseAmp.set(s, u.x).get(s)!;
        u.x = b * gust;
      }
    },
  };
}
