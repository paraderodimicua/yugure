// Túnel de torii bermellón (estilo senbon torii) que cruza el callejón. Al salir de él cambia el barrio
// (ambientación) y la tormenta pierde unos metros. Por encima de los dinteles se puede correr.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Mats } from '../render/materials';
import type { Collider } from './contracts';

export const TUNNEL_LEN = 36;

export function createTunnelMesh(mats: Mats, x0: number, x1: number) {
  const g = new THREE.Group();
  const red: THREE.BufferGeometry[] = [], black: THREE.BufferGeometry[] = [], stone: THREE.BufferGeometry[] = [];
  const add = (list: THREE.BufferGeometry[], geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Matrix4().makeRotationX(rx).setPosition(x, y, z); list.push(geo.clone().applyMatrix4(m));
  };
  const H = 5.2, W = x1 - x0, cx = (x0 + x1) / 2;
  const pillar = new THREE.CylinderGeometry(0.2, 0.24, H, 12);
  const base = new THREE.CylinderGeometry(0.3, 0.32, 0.45, 12);
  const kasagi = new THREE.BoxGeometry(W + 1.4, 0.28, 0.42);
  const shimaki = new THREE.BoxGeometry(W + 1.2, 0.22, 0.36);
  const nuki = new THREE.BoxGeometry(W + 0.5, 0.2, 0.18);
  const gakuzuka = new THREE.BoxGeometry(0.16, 0.6, 0.16);
  for (let z = 0; z > -TUNNEL_LEN; z -= 1.3) {
    for (const x of [x0 + 0.5, x1 - 0.5]) { add(red, pillar, x, H / 2, z); add(black, base, x, 0.22, z); }
    add(black, kasagi, cx, H + 0.37, z);
    add(red, shimaki, cx, H + 0.12, z);
    add(red, nuki, cx, H - 0.85, z);
    add(red, gakuzuka, cx, H - 0.45, z);
  }
  // sendero de piedra y linternas a los lados
  const slab = new THREE.BoxGeometry(W - 1.6, 0.08, 1.1);
  for (let z = -0.6; z > -TUNNEL_LEN; z -= 1.2) add(stone, slab, cx, 0.04, z);
  const merged = (list: THREE.BufferGeometry[], m: THREE.Material) => { const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.castShadow = false; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  merged(red, mats.tint('lacquerRed', 0xd8361c));
  merged(black, mats.lacquerBlack);
  merged(stone, mats.stone);
  const glow = mats.glow(0xffb060, 3.2);
  const lamp = new THREE.SphereGeometry(0.22, 10, 8);
  const lamps: THREE.BufferGeometry[] = [];
  for (let z = -2; z > -TUNNEL_LEN; z -= 4.2) for (const x of [x0 + 1.1, x1 - 1.1]) add(lamps, lamp, x, 1.1, z);
  const lm = new THREE.Mesh(mergeGeometries(lamps), glow); g.add(lm);
  const cols: Collider[] = [
    { kind: 'box', min: [x0 - 0.2, H + 0.23, -TUNNEL_LEN], max: [x1 + 0.2, H + 0.51, 0.21] },
  ];
  (g.userData as any).colliders = cols;
  return g;
}

/** Barrios que se suceden al cruzar túneles: gradación de color, giro de tono y nombre. */
export const BIOMES: { name: string; sub: string; tint: [number, number, number]; hue: number; trip: number }[] = [
  { name: 'Barrio del atardecer', sub: '', tint: [1, 1, 1], hue: 0, trip: 0 },
  { name: 'Noche de farolillos', sub: 'el cielo se apaga, los farolillos no', tint: [0.6, 0.66, 1.08], hue: -0.25, trip: 0.1 },
  { name: 'Jardín de neón', sub: 'los colores se derriten', tint: [0.98, 0.86, 1.12], hue: 1.1, trip: 0.3 },
  { name: 'Bosque esmeralda', sub: 'todo respira', tint: [0.84, 1.1, 0.94], hue: -0.7, trip: 0.2 },
  { name: 'Amanecer rosa', sub: 'casi despiertas', tint: [1.12, 0.9, 1.0], hue: 0.4, trip: 0.15 },
];
