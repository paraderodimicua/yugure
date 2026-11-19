// CONTRATOS COMPARTIDOS de YŪGURE v3 (juego de plataformas con control libre).
// Varios módulos compilan contra estos tipos en paralelo: se pueden AÑADIR campos opcionales,
// nunca renombrar ni quitar.
import type * as THREE from 'three';

export type V3 = [number, number, number];

/** Calidad gráfica elegida en el menú (se guarda en localStorage 'yugure.quality'). */
export type Quality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Colisionadores en coordenadas LOCALES del grupo que los lleva (origen en el suelo, frente a +Z).
 * Se publican en `group.userData.colliders: Collider[]`. Si el grupo se mueve cada fotograma
 * (objetos voladores), además `group.userData.moving = true` y el juego relee group.matrixWorld.
 *
 * - box: sólido. Su cara superior es pisable (o una rampa si `slope`). Sus aristas superiores
 *        se pueden agarrar para colgarse y subir si `grab` (por defecto true).
 * - bar: barra horizontal entre a y b para colgarse y balancearse (banderas de templo, pértigas).
 * - bounce: superficie elástica (sombrilla): círculo horizontal de radio r a altura center.y;
 *        rebota más cuanto más rápido llegas, multiplicado por `power` (≈1).
 * - grab: punto o arista de agarre suelto sin sólido (aro, cuerda, gancho de un objeto volador).
 */
export type Collider =
  | { kind: 'box'; min: V3; max: V3; slope?: { axis: 'x' | 'z'; dir: 1 | -1 }; grab?: boolean; walk?: boolean }
  | { kind: 'bar'; a: V3; b: V3; r?: number }
  | { kind: 'bounce'; center: V3; r: number; power?: number }
  | { kind: 'grab'; a: V3; b?: V3 };

/** Pieza de escenario jugable: grupo + colisionadores + animación opcional. */
export type PlayPiece = THREE.Group & { userData: { colliders: Collider[]; moving?: boolean; size?: { w: number; h: number; d: number } } };

/** Estado de la tormenta que el juego pasa cada fotograma al módulo visual de la tormenta. */
export type StormState = {
  /** posición del jugador (mundo) */
  player: THREE.Vector3;
  /** z del frente de la tormenta; el jugador corre hacia -Z, la tormenta le sigue desde +Z */
  frontZ: number;
  /** 0 = lejos y a salvo … 1 = el frente está encima o dentro */
  danger: number;
  /** 0..1 cuánto se ha adentrado el jugador en la tormenta (0 = fuera) */
  inside: number;
  /** vida del jugador 0..1 */
  life: number;
};
