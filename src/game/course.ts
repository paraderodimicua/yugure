// Recorrido jugable: coloca piezas de parkour (createPieces) a lo largo de la calle y registra sus
// colisionadores. En los huecos entre tejados: vigas, columnas, mástiles con barra, cuerdas de farolillos.
// En el callejón: sombrillas elásticas. Encima: objetos flotantes difíciles de agarrar.
import * as THREE from 'three';
import type { Physics } from './physics';
import type { Seg } from './street';
import type { Collider, PlayPiece } from './contracts';

type Pieces = { make: Record<string, (o?: any) => PlayPiece>; update(t: number, dt: number): void };
type Item = { g: PlayPiece; kind: string; used: boolean; z: number };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createCourse(pieces: Pieces, physics: Physics, segs: Seg[], L: { oppX: number; runFacadeX: number; backX: number; backY: number }, density = 1, seed = 17) {
  const root = new THREE.Group();
  const r = rng(seed);
  const pools = new Map<string, Item[]>();
  const N = (n: number) => Math.max(2, Math.round(n * density));
  const make = (kind: string, n: number, opts: (i: number) => any = () => ({}), key = kind) => {
    const fn = pieces.make[kind]; if (!fn) return;
    const list: Item[] = [];
    for (let i = 0; i < n; i++) { const g = fn({ seed: 30 + i, ...opts(i) }); g.visible = false; root.add(g); list.push({ g, kind, used: false, z: 0 }); }
    pools.set(key, list);
  };
  make('beam', N(5), () => ({ len: 5 }));
  make('column', N(6), (i) => ({ h: 5 + (i % 3) }));
  make('templeFlag', N(5), (i) => ({ h: 9 + (i % 2) * 2 }));
  make('lanternString', N(4), () => ({ len: 6, n: 5 }));
  make('umbrella', N(7), (i) => ({ r: 1.6 + (i % 3) * 0.3, color: ['#c0392b', '#e0a030', '#2c5a8a', '#b04080'][i % 4] }));
  make('pole', N(4), (i) => ({ h: 6 + (i % 2) }));
  make('lanternFloat', N(4));
  make('kite', N(3));
  make('craneFloat', N(3));
  make('rockFloat', N(3));
  make('toriiTop', N(2));
  make('ropeBridge', N(3), () => ({ len: 6 }));
  make('crates', N(5), (i) => ({ rows: 2 + (i % 3) }));
  make('barrels', N(4));
  make('cart', N(3));
  make('scaffold', N(4), (i) => ({ h: 5 + (i % 3) }));
  make('stoneLantern', N(4), (i) => ({ h: 2.4 + (i % 2) * 0.5 }));
  make('waterTank', N(3), (i) => ({ h: 6 + (i % 2) * 1.5 }));
  make('bell', N(2));
  make('signBoard', N(3), (i) => ({ h: 3.6 + (i % 2) }));
  make('bambooPoles', N(3), (i) => ({ n: 5 + (i % 2) }));
  make('hangingPlatform', N(3));
  make('paperLanternGiant', N(3));
  // enlaces que cruzan el callejón de tejado a tejado
  make('beam', N(5), () => ({ len: 9.2 }), 'crossBeam');
  make('ropeBridge', N(4), () => ({ len: 8.6 }), 'crossBridge');
  make('lanternString', N(4), () => ({ len: 8.4, n: 6 }), 'crossString');

  const placed: Item[] = [];
  function put(kind: string, x: number, y: number, z: number, ry = 0) {
    const list = pools.get(kind); if (!list) return null;
    const it = list.find((i) => !i.used); if (!it) return null;
    it.used = true; it.z = z; it.g.visible = true;
    it.g.position.set(x, y, z); it.g.rotation.set(0, ry, 0); it.g.updateMatrixWorld(true);
    const cols = (it.g.userData.colliders ?? []) as Collider[];
    if (it.g.userData.moving) physics.addMoving(it.g, cols); else physics.add(it.g, cols, it.g.matrixWorld);
    placed.push(it);
    return it;
  }

  let segIdx = 0, alleyCursor = -13, airCursor = -26, crossCursor = -16;
  const done = new WeakSet<Seg>();
  function update(playerZ: number, t: number, dt = 1 / 60) {
    // huecos entre tejados de la fila de carrera
    for (let i = 0; i < segs.length - 1; i++) {
      const a = segs[i], b = segs[i + 1];
      if (done.has(b)) continue;
      done.add(b);
      const gap = a.zB - b.zA, mid = (a.zB + b.zA) / 2, low = Math.min(a.y, b.y);
      const roll = r();
      if (gap > 3.2 && roll < 0.35) put('beam', 0, low - 0.1, mid, Math.PI / 2);
      else if (gap > 2.5 && roll < 0.6) put('column', -0.2, 0, mid);
      else if (roll < 0.8) put('templeFlag', -2.2, 0, mid);
      else put('lanternString', -1.2, low + 1.6, mid, Math.PI / 2);
    }
    void segIdx;
    // callejón: sombrillas para subir rebotando y postes
    // callejón: una cadena de apoyos a distintas alturas que sube hacia los tejados
    const ground = ['crates', 'barrels', 'cart', 'stoneLantern', 'scaffold', 'bambooPoles', 'signBoard', 'umbrella', 'umbrella', 'paperLanternGiant', 'pole', 'waterTank', 'bell'];
    while (alleyCursor > playerZ - 90) {
      const kind = ground[Math.floor(r() * ground.length)];
      const side = r() < 0.5;
      const x = kind === 'umbrella' || kind === 'paperLanternGiant' ? L.runFacadeX + 2 + r() * (L.oppX - L.runFacadeX - 4)
        : side ? L.runFacadeX + 1.1 : L.oppX - 1.1;
      put(kind, x, 0, alleyCursor, kind === 'bambooPoles' ? (side ? 0 : Math.PI) : side ? Math.PI / 2 : -Math.PI / 2);
      if (r() < 0.25) put('hangingPlatform', L.runFacadeX + 2.5 + r() * 3, 7.6, alleyCursor - 3);
      if (r() < 0.18) put('ropeBridge', L.runFacadeX + 0.4, 5.6, alleyCursor - 4, 0);
      alleyCursor -= 4.5 + r() * 4.5;
      // de lado a lado: viga, puente de cuerda o cuerda de farolillos para colgarse
      if (alleyCursor < crossCursor) {
        const cx = (L.runFacadeX + L.oppX) / 2, y = 4.4 + r() * 2;
        const k = r();
        if (k < 0.45) put('crossBeam', cx, y, alleyCursor);
        else if (k < 0.75) put('crossBridge', cx, y, alleyCursor);
        else put('crossString', cx, y + 1.2, alleyCursor);
        crossCursor = alleyCursor - 8 - r() * 4;
      }
    }
    // aire: objetos flotantes difíciles de agarrar, y torii en la terraza alta
    while (airCursor > playerZ - 110) {
      const kinds = ['lanternFloat', 'kite', 'craneFloat', 'rockFloat'];
      const kd = kinds[Math.floor(r() * kinds.length)];
      if (kd === 'kite') put('kite', L.oppX - 1.2, 0, airCursor, Math.PI);
      else put(kd, 2 + r() * 6, 7.5 + r() * 4, airCursor);
      if (r() < 0.3) put('toriiTop', L.backX - 3, L.backY, airCursor - 6, Math.PI / 2);
      airCursor -= 18 + r() * 14;
    }
    pieces.update(t, dt);
    for (let i = placed.length - 1; i >= 0; i--) {
      const it = placed[i];
      if (it.z > playerZ + 26) { it.used = false; it.g.visible = false; physics.remove(it.g); placed.splice(i, 1); }
    }
  }
  function shift(dz: number) {
    for (const it of placed) { it.z += dz; it.g.position.z += dz; it.g.updateMatrixWorld(true); }
    alleyCursor += dz; airCursor += dz; crossCursor += dz;
  }
  return { root, update, shift };
}
