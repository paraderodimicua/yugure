// Portales: salida dorada al final de la dimensión y entrada oscura (para el mundo normal).
// Animados solo con el uniforme de tiempo compartido (no necesitan update). Centro del anillo en (0, 0, 0)
// del grupo para la salida; la entrada lleva el anillo a 3,4 m sobre su origen (apoyada en el suelo).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ringMat, vortexMat, haloMat, spiralMat } from './shaders';
import { rnd } from '../storm/gate';

function motes(n: number, seed: number) {
  const r = rnd(seed), a = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) a[i] = r();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aP', new THREE.BufferAttribute(a, 3));
  return g;
}
const noCull = <T extends THREE.Object3D>(o: T) => { o.frustumCulled = false; return o; };

/** Salida: anillo de luz cálida, disco con remolino/ondas, halo grande y motas que salen. 4 llamadas. */
export function exitPortal(t: { value: number }, nMotes: number) {
  const g = new THREE.Group(); g.name = 'dimExit';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.26, 10, 48), ringMat(t, new THREE.Color(1.6, 0.8, 0.25), new THREE.Color(3.4, 2.4, 1.2), 0));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.05, 40), vortexMat(t, 1));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), haloMat(new THREE.Color(0.9, 0.5, 0.18), 2.2));
  halo.position.z = -0.4;
  const pts = noCull(new THREE.Points(motes(nMotes, 77), spiralMat(t, 1, new THREE.Color(2.2, 1.4, 0.6), new THREE.Color(3, 2.6, 2), 60)));
  disc.renderOrder = 2; halo.renderOrder = 1; pts.renderOrder = 3;
  g.add(halo, disc, ring, pts);
  return g;
}

/** Entrada: anillo oscuro-violeta de ~6 m, remolino, halo violeta, succión de partículas y rocas en órbita. 5 llamadas. */
export function entryPortal(t: { value: number }, nMotes: number) {
  const g = new THREE.Group(); g.name = 'dimEntry';
  const c = new THREE.Group(); c.position.y = 3.4; g.add(c);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.42, 12, 56), ringMat(t, new THREE.Color(0.05, 0.01, 0.09), new THREE.Color(1.3, 0.45, 2.4), 0.85));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.85, 40), vortexMat(t, 0));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), haloMat(new THREE.Color(0.35, 0.1, 0.6), 2.6));
  const pts = noCull(new THREE.Points(motes(nMotes, 91), spiralMat(t, -1, new THREE.Color(1.1, 0.4, 1.9), new THREE.Color(2.4, 1.1, 0.5), 55)));
  // rocas que orbitan el anillo (una malla; giro por fotograma en onBeforeRender)
  const r = rnd(5), rocks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.3, rr = 3.9 + r() * 1.4, s = 0.18 + r() * 0.35;
    const gg = new THREE.DodecahedronGeometry(s, 0); gg.rotateX(r() * 3); gg.rotateY(r() * 3);
    gg.translate(Math.cos(a) * rr, Math.sin(a) * rr, (r() - 0.5) * 1.2); rocks.push(gg);
  }
  const rockMesh = new THREE.Mesh(mergeGeometries(rocks)!, ringMat(t, new THREE.Color(0.03, 0.02, 0.05), new THREE.Color(0.6, 0.2, 1.1), 0.95));
  rockMesh.onBeforeRender = () => { rockMesh.rotation.z = t.value * 0.15; };
  disc.renderOrder = 2; halo.renderOrder = 1; pts.renderOrder = 3;
  c.add(halo, disc, ring, rockMesh, pts);
  return g;
}
