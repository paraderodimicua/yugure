// Bong de cristal para el modo 'bong'. Vive en el hueso del pecho (unidades de pose); el origen local es la boquilla.
import * as THREE from 'three';
import type { Mats } from '../render/materials';

export const BONG_T = 3.2;
/** puntos de agarre (local del bong) de la muñeca izquierda y derecha */
export const BONG_GRIP = [[-0.05, -0.215, 0.012], [0.048, -0.11, 0.012]] as const;
const BOWL = [0, -0.19, -0.098];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** colocación del bong en el espacio local del pecho según el tiempo del modo */
export function bongXform(t: number, o: { x: number; y: number; z: number; tilt: number; scale: number; hold: number; burn: number }) {
  const l = sm(0, 0.4, t), d = sm(1.9, 2.3, t);
  o.x = -0.01; o.y = 0.322 - 0.3 * (1 - l) - 0.13 * d; o.z = -0.118 - 0.07 * (1 - l) - 0.08 * d;
  o.tilt = 0.22 + 0.35 * (1 - l) + 0.25 * d; o.scale = 1 - sm(2.4, 2.58, t);
  o.hold = 1 - sm(2.45, 2.85, t); o.burn = sm(0.45, 0.75, t) * (1 - sm(1.85, 2.1, t));
  return o;
}
/** punto local del bong → espacio del pecho */
export function bongToChest(o: { x: number; y: number; z: number; tilt: number }, p: readonly number[], out: number[]) {
  const c = Math.cos(o.tilt), s = Math.sin(o.tilt);
  out[0] = o.x + p[0]; out[1] = o.y + p[1] * c - p[2] * s; out[2] = o.z + p[1] * s + p[2] * c;
  return out;
}

export function createBong(mats: Mats) {
  const obj = new THREE.Group(); obj.name = 'bong'; obj.visible = false;
  const glass = new THREE.MeshStandardMaterial({ color: 0xd8ecf2, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 2 });
  const water = new THREE.MeshStandardMaterial({ color: 0x5fa59a, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.6, depthWrite: false });
  const metal = mats.tint('fabric', 0x8a7a66);
  const ember = (mats.glow(0xff7a2a, 3) as THREE.MeshBasicMaterial).clone();
  const emberC = new THREE.Color(0xff7a2a);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.rotation.x = rx; obj.add(me); return me; };
  // tubo + campana en una sola geometría de torno (un draw call para el vidrio)
  const prof: THREE.Vector2[] = [];
  const P: [number, number][] = [[0.0001, -0.318], [0.03, -0.316], [0.048, -0.3], [0.053, -0.275], [0.046, -0.248], [0.024, -0.228], [0.017, -0.21], [0.016, -0.03], [0.019, -0.008], [0.017, 0]];
  for (const [r, y] of P) prof.push(new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(prof, 14), glass, 0, 0, 0);
  const w = new THREE.SphereGeometry(0.044, 12, 6, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  add(w, water, 0, -0.272, 0).scale.set(1, 0.95, 1);
  add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.085, 6), metal, 0, -0.232, -0.06, -0.9);
  add(new THREE.CylinderGeometry(0.015, 0.007, 0.022, 10, 1, true), metal, BOWL[0], BOWL[1], BOWL[2], -0.35);
  add(new THREE.SphereGeometry(0.0105, 8, 5), ember, BOWL[0], BOWL[1] + 0.006, BOWL[2] - 0.002);
  const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(0.004, 5, 4), glass, 6);
  obj.add(bub);
  const bowl = new THREE.Object3D(); bowl.position.set(BOWL[0], BOWL[1] + 0.012, BOWL[2]); obj.add(bowl);
  const m4 = new THREE.Matrix4(), seeds = [0.1, 0.37, 0.52, 0.71, 0.86, 0.95];
  function update(time: number, burn: number) {
    ember.color.copy(emberC).multiplyScalar(0.3 + burn * (2.6 + 0.8 * Math.sin(time * 37) * Math.sin(time * 13)));
    for (let i = 0; i < 6; i++) {
      const f = (time * 2.6 + seeds[i]) % 1, a = seeds[i] * 40;
      const r = 0.026 * (1 - f * 0.5), on = burn > 0.05 ? 1 : 0.001;
      m4.makeScale(on, on, on).setPosition(Math.cos(a) * r, -0.298 + f * 0.034, Math.sin(a) * r);
      bub.setMatrixAt(i, m4);
    }
    bub.instanceMatrix.needsUpdate = true;
  }
  return { obj, bowl, update };
}
