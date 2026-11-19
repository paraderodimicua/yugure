// Viste cada edificio de la piscina con mobiliario en sus huecos (anchors) y objetos de calle delante
// de la fachada. Se hace una vez al crear la piscina: el mobiliario viaja dentro del grupo de la casa.
import * as THREE from 'three';
import type { createProps } from '../world/props';
import type { Anchor } from '../world/arch';

type Props = ReturnType<typeof createProps>;

const NOREN = [['そば', '手打'], ['ゆ', ''], ['茶', '甘味'], ['酒', '地酒'], ['ラーメン', ''], ['氷', ''], ['うどん', '']];
const SIGN = [['茶屋', '抹茶'], ['酒', '純米'], ['そば処', ''], ['甘味処', 'あんみつ'], ['団子', ''], ['金物', ''], ['米', '']];
const LANT = ['祭', '酒', '茶', '御神燈', 'らーめん', '夕'];
const GROUND = ['maceta', 'maceta', 'bicycle', 'vending', 'barrels', 'produce', 'jardinera', 'broom', 'toro', 'jizo', 'mailbox', 'aircon', 'wok', 'yatai', 'terrace'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createDresser(props: Props, seed = 11) {
  const r = rng(seed);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];

  /** front: true si la fachada mira al callejón (se ve desde la cámara) */
  function dress(g: THREE.Group, front: boolean) {
    const anchors = ((g.userData.anchors ?? []) as Anchor[]).slice();
    const w = (g.userData.size?.w ?? 6) as number;
    let n = 0;
    const add = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; o.userData.dress = true; g.add(o); n++; };
    // huecos del kit: noren en puertas, carteles y farolillos
    for (const a of anchors) {
      if (n >= (front ? 4 : 2)) break;
      if (a.kind === 'noren' && r() < 0.85) { const [t, s] = pick(NOREN); add(props.make.noren({ text: t, sub: s, w: a.w, h: a.h, bg: pick(['#1f3a5a', '#7a1f1f', '#2a2a2a', '#efe6d2']) }), ...a.pos); }
      else if (a.kind === 'sign' && r() < 0.8) { const [t, s] = pick(SIGN); add(props.make.kanban({ text: t, sub: s }), ...a.pos); }
      else if (a.kind === 'signV' && r() < 0.7) { const [t, s] = pick(SIGN); add(props.make.lightbox({ text: t, sub: s }), ...a.pos); }
      else if (a.kind === 'lantern' && r() < 0.6) add(props.make.chochin({ text: pick(LANT), color: r() < 0.7 ? 'red' : 'white', shape: r() < 0.5 ? 'round' : 'long' }), ...a.pos);
    }
    if (!front) return;
    // objetos de calle delante de la fachada (+Z local), repartidos por el ancho
    const k = 1 + Math.floor(r() * 2.2);
    for (let i = 0; i < k; i++) {
      const kind = pick(GROUND);
      const x = (r() - 0.5) * (w - 1.6);
      const opts: any = kind === 'maceta' ? { kind: pick(['fern', 'pine', 'flowers', 'asagao', 'azalea']) }
        : kind === 'vending' ? { color: pick(['white', 'red', 'blue']) }
        : kind === 'bicycle' ? { color: pick(['#c9d3c8', '#8a2a2a', '#2a4a6a']), basket: r() < 0.7 }
        : kind === 'aircon' ? { wall: true, y: 2.2 } : {};
      const o = props.make[kind]?.(opts);
      if (!o) continue;
      const big = kind === 'yatai' || kind === 'wok' || kind === 'terrace';
      add(o, big ? 0 : x, 0, big ? 2.4 : 0.55 + r() * 0.3, big ? 0 : (r() - 0.5) * 0.6);
    }
    // de vez en cuando, campanilla o molinillo colgando del alero
    if (r() < 0.35) add(props.make.furin({}), (r() - 0.5) * w * 0.6, 2.6, 0.5);
  }

  return { dress };
}

/** Guirnaldas de festival cruzando el callejón, recicladas al avanzar. */
export function createGarlands(props: Props, L: { x0: number; x1: number }, seed = 13) {
  const root = new THREE.Group();
  const r = rng(seed);
  const pool: { o: THREE.Object3D; used: boolean; z: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const o = props.make.festival({ span: L.x1 - L.x0, n: 7, sag: 0.7, text: '祭' });
    o.visible = false; root.add(o); pool.push({ o, used: false, z: 0 });
  }
  let cursor = -10;
  function update(playerZ: number) {
    let g = 0;
    while (cursor > playerZ - 90 && g++ < 10) {
      const it = pool.find((p) => !p.used);
      if (it) {
        it.used = true; it.o.visible = true; it.z = cursor;
        it.o.position.set(L.x0, 4.6 + r() * 0.8, cursor);
        it.o.rotation.y = 0;
        it.o.updateMatrixWorld(true);
      }
      cursor -= 18 + r() * 14;
    }
    for (const p of pool) if (p.used && p.z > playerZ + 16) { p.used = false; p.o.visible = false; }
  }
  function shift(dz: number) { for (const p of pool) if (p.used) { p.z += dz; p.o.position.z += dz; p.o.updateMatrixWorld(true); } cursor += dz; }
  return { root, update, shift };
}
