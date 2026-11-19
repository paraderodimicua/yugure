// Calle infinita: fila de tejados por la que se corre (cumbreras alineadas en x = 0, carrera hacia -Z),
// callejón con la fila de enfrente, una fila alta detrás, hitos (pagodas, santuarios, torii) y
// potenciadores en los huecos. Todo sale de piscinas de edificios pregenerados que se reciclan,
// así nunca se genera geometría durante la partida.
import * as THREE from 'three';
import type { Mats } from '../render/materials';
import type { ArchKit, Platform } from '../world/arch';
import { SKY_GLSL } from '../render/shaders';
import type { Shared } from '../stage';
import { createBatcher, type Refs } from './batcher';
import type { Physics } from './physics';
import type { Collider } from './contracts';

export type PowerKind = 'taiko' | 'cometa' | 'cohete' | 'fideos' | 'pilares';

/** Tramo pisable de la ruta: cumbrera entre zA (atrás, mayor) y zB (delante, menor). */
export type Seg = { zA: number; zB: number; y: number };

type Piece = { cols: Collider[]; g: THREE.Group; refs: Refs; rot: number; pos: THREE.Vector3; used: boolean; ridgeY: number; ridgeX: number; len: number; tag: string; lod: number };
export type Pickup = { kind: PowerKind; g: THREE.Group; pos: THREE.Vector3; taken: boolean; t: number };

const RUN_ROT = Math.PI / 2;     // fachada hacia +X (hacia el callejón y la cámara)
const OPP_ROT = -Math.PI / 2;    // fachada hacia -X
export const OPP_X = 9.5;               // línea de fachadas de enfrente
export const BACK_X = -8.5;             // fila alta de detrás
export const BACK_Y = 3.4;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Cumbrera de un edificio a partir de sus plataformas (la más alta). Coordenadas locales. */
function ridgeOf(plats: Platform[]) {
  let top: Platform | null = null;
  for (const p of plats) if (!top || p.max[1] > top.max[1]) top = p;
  if (!top) return { y: 0, z: 0, x0: 0, x1: 0 };
  let z = (top.min[2] + top.max[2]) / 2;
  if (top.slope?.axis === 'z') z = top.slope.dir === 1 ? top.min[2] : top.max[2];
  return { y: top.max[1], z, x0: top.min[0], x1: top.max[0] };
}

/** Colisionadores de un edificio del kit: tejados (rampas), aleros y un sólido para el cuerpo. */
function houseColliders(g: THREE.Group): Collider[] {
  const plats = (g.userData.platforms ?? []) as Platform[];
  const size = g.userData.size as { w: number; h: number; d: number };
  const out: Collider[] = plats.map((p) => ({ kind: 'box' as const, min: p.min, max: p.max, slope: p.slope }));
  const top = plats.reduce((a, p) => (p.max[1] > a.max[1] ? p : a), plats[0] ?? { min: [0, size.h, 0], max: [0, size.h, 0] } as Platform);
  const body = Math.max(1.5, top.min[1]);
  out.push({ kind: 'box', min: [-size.w / 2 + 0.25, 0, -size.d + 0.4], max: [size.w / 2 - 0.25, body, -0.15] });
  return out;
}

export function createStreet(U: Shared, mats: Mats, kit: ArchKit, seed = 1, dress?: (g: THREE.Group, front: boolean) => void, physics?: Physics) {
  const root = new THREE.Group();
  const r = rng(seed);
  // Los lotes (BatchedMesh) reducen llamadas, pero en gráficas Intel con ANGLE el dibujo múltiple
  // se emula y sale más caro; quedan como opción (?batch) para gráficas dedicadas.
  const batcher = createBatcher(root, /[?&]batch/.test(location.search));
  const mk = (g: THREE.Group, rot: number, o: Partial<Piece>): Piece => {
    g.rotation.y = rot;
    if (dress && o.tag !== 'land') dress(g, o.tag === 'run' || o.tag === 'opp');
    return { cols: houseColliders(g), g, refs: batcher.register(g), rot, pos: new THREE.Vector3(), used: false, ridgeY: 0, ridgeX: 0, len: g.userData.size.w, tag: '', lod: -1, ...o };
  };

  // ---------------------------------------------------------------- piscinas
  const runPool: Piece[] = [], oppPool: Piece[] = [], backPool: Piece[] = [], landPool: Piece[] = [];
  const kinds = ['machiya', 'shop', 'machiya', 'storehouse', 'shop', 'machiya'] as const;
  for (let i = 0; i < 26; i++) {
    const k = kinds[i % kinds.length];
    const floors = [1, 2, 2, 2, 3, 2, 3, 1][i % 8];
    const g = k === 'storehouse' ? kit.storehouse({ seed: 100 + i })
      : k === 'shop' ? kit.shop({ seed: 100 + i, floors, bays: 2 + (i % 3), kind: i % 2 ? 'izakaya' : 'store' } as any)
      : kit.machiya({ seed: 100 + i, floors, bays: 2 + (i % 3) });
    const rd = ridgeOf(g.userData.platforms as Platform[]);
    // rotación +90°: x local → z mundo = -x ; z local → x mundo = z
    runPool.push(mk(g, RUN_ROT, { ridgeY: rd.y, ridgeX: -rd.z, len: rd.x1 - rd.x0, tag: 'run' }));
  }
  for (let i = 0; i < 22; i++) {
    const floors = [2, 1, 2, 3, 2][i % 5];
    const g = i % 4 === 3 ? kit.teahouse({ seed: 300 + i })
      : i % 3 === 1 ? kit.shop({ seed: 300 + i, floors, bays: 2 + (i % 3), kind: i % 2 ? 'store' : 'izakaya' } as any)
      : kit.machiya({ seed: 300 + i, floors, bays: 2 + (i % 3) });
    oppPool.push(mk(g, OPP_ROT, { tag: 'opp' }));
  }
  for (let i = 0; i < 16; i++) {
    const g = i % 5 === 2 ? kit.storehouse({ seed: 500 + i }) : kit.machiya({ seed: 500 + i, floors: 1 + (i % 3), bays: 2 + (i % 2) });
    backPool.push(mk(g, RUN_ROT, { tag: 'back' }));
  }
  const landmarks: (() => THREE.Group)[] = [
    () => kit.pagoda(5, { seed: 1 }), () => kit.pagoda(3, { seed: 2 }), () => kit.shrine({ seed: 3 }),
    () => kit.pagoda(5, { seed: 4 }), () => kit.shrine({ seed: 5 }),
  ];
  for (let i = 0; i < landmarks.length; i++) {
    landPool.push(mk(landmarks[i](), RUN_ROT, { tag: 'land' }));
  }
  const all = [...runPool, ...oppPool, ...backPool, ...landPool];
  batcher.build();

  // ---------------------------------------------------------------- suelo, muros y fondo
  const alley = new THREE.Mesh(new THREE.PlaneGeometry(12, 600), mats.cobble);
  alley.rotation.x = -Math.PI / 2; alley.position.set(5.5, 0, 0); alley.receiveShadow = true; root.add(alley);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 600), mats.earth);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0); root.add(ground);
  // muro de piedra que sostiene la fila alta
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, BACK_Y, 600), mats.stoneMoss);
  wall.position.set(BACK_X + 1.2, BACK_Y / 2, 0); wall.receiveShadow = true; root.add(wall);
  const terraceTop = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 600), mats.earth);
  terraceTop.position.set(BACK_X - 13, BACK_Y, 0); root.add(terraceTop);

  // montañas en capas, siguen a la cámara (están tan lejos que no hace falta paralaje)
  const far = new THREE.Group(); root.add(far);
  function ridge(z: number, base: number, amp: number, color: number, s: number, haze: number) {
    const rr = rng(s), ph = [rr() * 9, rr() * 9, rr() * 9, rr() * 9];
    const n = 320, W = 16000, p: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const x = -W / 2 + (W * i) / n, u = x / 1000;
      const y = base + amp * (0.55 * Math.sin(u * 1.1 + ph[0]) + 0.3 * Math.sin(u * 2.7 + ph[1]) + 0.18 * Math.sin(u * 6.1 + ph[2]) + 0.08 * Math.sin(u * 14 + ph[3]));
      p.push(x, -20, z, x, Math.max(y, 6), z);
    }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { uSunDir: U.sunDir, uCol: { value: new THREE.Color(color) }, uK: { value: haze }, uTop: { value: base + amp } },
      vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: `varying vec3 vW; uniform vec3 uSunDir, uCol; uniform float uK, uTop;
        ${SKY_GLSL}
        void main(){
          vec3 hz = hazeColor(vW - cameraPosition, uSunDir);
          float low = 1.0 - smoothstep(0.0, uTop, vW.y);
          gl_FragColor = vec4(mix(uCol, hz, clamp(uK + low * 0.45, 0.0, 1.0)), 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; far.add(mesh);
  }
  // valle selvático a media distancia (más oscuro y verde), luego cordilleras azuladas
  ridge(-420, 30, 40, 0x1c2a26, 11, 0.10);
  ridge(-900, 70, 70, 0x1d2034, 3, 0.22);
  ridge(-1800, 150, 120, 0x2a2248, 5, 0.45);
  ridge(-3600, 210, 160, 0x3a2a55, 9, 0.68);

  // ---------------------------------------------------------------- potenciadores
  const pickupGeo = {
    drumBody: new THREE.CylinderGeometry(0.62, 0.62, 0.9, 20, 1, true),
    drumSkin: new THREE.CircleGeometry(0.6, 20),
    ring: new THREE.TorusGeometry(0.64, 0.05, 6, 24),
    kite: (() => { const s = new THREE.Shape(); s.moveTo(0, 0.75); s.lineTo(0.45, 0); s.lineTo(0, -0.55); s.lineTo(-0.45, 0); s.closePath(); return new THREE.ShapeGeometry(s); })(),
    lantern: new THREE.SphereGeometry(0.42, 16, 12),
    cap: new THREE.CylinderGeometry(0.22, 0.26, 0.12, 12),
    bowl: new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    noodles: new THREE.TorusKnotGeometry(0.18, 0.05, 48, 6, 2, 5),
    halo: new THREE.SphereGeometry(1, 16, 12),
  };
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending });
  function makePickup(kind: PowerKind) {
    const g = new THREE.Group();
    if (kind === 'pilares') {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.1, 12), mats.tint('stone', 0x4c8a74)); g.add(col);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.14, 12), mats.metalGold); cap.position.y = 0.62; g.add(cap);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 24), mats.glow(0x7affd0, 2.6)); ring.rotation.x = Math.PI / 2; g.add(ring);
      const halo = new THREE.Mesh(pickupGeo.halo, haloMat); halo.scale.setScalar(1.2); g.add(halo);
      root.add(g); return g;
    }
    if (kind === 'taiko') {
      const body = new THREE.Mesh(pickupGeo.drumBody, mats.lacquerRed); g.add(body);
      for (const s of [1, -1]) {
        const skin = new THREE.Mesh(pickupGeo.drumSkin, mats.paper); skin.rotation.x = -s * Math.PI / 2; skin.position.y = s * 0.45; g.add(skin);
        const ring = new THREE.Mesh(pickupGeo.ring, mats.metalGold); ring.rotation.x = Math.PI / 2; ring.position.y = s * 0.43; g.add(ring);
      }
      g.rotation.z = 0.0;
    } else if (kind === 'cometa') {
      const k = new THREE.Mesh(pickupGeo.kite, mats.glow(0xff5a3a, 1.4)); (k.material as THREE.Material).side = THREE.DoubleSide; g.add(k);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), mats.glow(0xffd070, 1.6)); tail.position.y = -1.1; g.add(tail);
    } else if (kind === 'cohete') {
      const l = new THREE.Mesh(pickupGeo.lantern, mats.glow(0xff7a30, 2.2)); l.scale.set(1, 1.3, 1); g.add(l);
      for (const s of [1, -1]) { const c = new THREE.Mesh(pickupGeo.cap, mats.lacquerBlack); c.position.y = s * 0.55; g.add(c); }
    } else {
      const b = new THREE.Mesh(pickupGeo.bowl, mats.ceramic); b.rotation.x = Math.PI; b.position.y = 0.05; g.add(b);
      const n = new THREE.Mesh(pickupGeo.noodles, mats.glow(0xffd28a, 1.2)); n.scale.y = 0.45; n.position.y = 0.12; g.add(n);
    }
    const halo = new THREE.Mesh(pickupGeo.halo, haloMat); halo.scale.setScalar(1.1); g.add(halo);
    root.add(g);
    return g;
  }
  const pickups: Pickup[] = [];
  function addPickup(kind: PowerKind, x: number, y: number, z: number) {
    let p = pickups.find((q) => q.taken && q.kind === kind && !q.g.visible);
    if (!p) { p = { kind, g: makePickup(kind), pos: new THREE.Vector3(), taken: false, t: 0 }; pickups.push(p); }
    p.pos.set(x, y, z); p.taken = false; p.g.visible = true; p.t = r() * 6; p.g.position.copy(p.pos);
  }

  // ---------------------------------------------------------------- generación
  const segs: Seg[] = [];
  const placed: { p: Piece; zMin: number }[] = [];
  let runCursor = 6, oppCursor = 12, backCursor = 10, landCursor = -60, lastY = 0, count = 0;

  function take(pool: Piece[], pred?: (p: Piece) => boolean) {
    const free = pool.filter((p) => !p.used && (!pred || pred(p)));
    const list = free.length ? free : pool.filter((p) => !p.used);
    if (!list.length) return null;
    const p = list[Math.floor(r() * list.length)];
    p.used = true; p.lod = -1;
    return p;
  }

  const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  function put(p: Piece, x: number, y: number, z: number) {
    p.pos.set(x, y, z); p.lod = 1; batcher.place(p.refs, p.pos, p.rot, 1);
    if (physics && p.tag !== 'land') { M4.compose(p.pos, Q4.setFromAxisAngle(UP, p.rot), ONE); physics.add(p, p.cols, M4); }
  }

  function spawnRun() {
    const first = count === 0;
    const gap = first ? 0 : 2.2 + r() * 2.6;
    const p = take(runPool, (q) => first ? q.ridgeY < 7 : q.ridgeY - lastY < 1.15 && lastY - q.ridgeY < 3.2);
    if (!p) { runCursor -= 0.01; return; }
    const zA = runCursor - gap, zB = zA - p.len;
    put(p, p.ridgeX, 0, (zA + zB) / 2);
    if (!first) {
      const zMid = runCursor - gap / 2, up = p.ridgeY - lastY;
      if (up > 0.5) addPickup('taiko', 0, lastY - 0.2, runCursor - 0.6);
      else if (gap > 4 && r() < 0.5) addPickup('cometa', 0, Math.max(lastY, p.ridgeY) + 2.1, zMid);
      else if (r() < 0.07) addPickup('cohete', 0, lastY + 1.3, zMid);
      else if (r() < 0.12) addPickup('fideos', 0, p.ridgeY + 1.0, zB + p.len * 0.5);
      else if (r() < 0.07) addPickup('pilares', 0, p.ridgeY + 1.2, zB + p.len * 0.5);
    }
    segs.push({ zA, zB, y: p.ridgeY });
    placed.push({ p, zMin: zB });
    runCursor = zB; lastY = p.ridgeY; count++;
  }
  function spawnOpp() {
    const p = take(oppPool); if (!p) { oppCursor -= 3; return; }
    const w = p.len;
    const z = oppCursor - w / 2 - 0.3;
    put(p, OPP_X, 0, z);
    placed.push({ p, zMin: z - w / 2 });
    oppCursor = z - w / 2 - 0.3 - (r() < 0.15 ? 3 : 0);
  }
  function spawnBack() {
    const p = take(backPool); if (!p) { backCursor -= 3; return; }
    const w = p.len;
    const z = backCursor - w / 2 - 0.6;
    put(p, BACK_X, BACK_Y, z);
    placed.push({ p, zMin: z - w / 2 });
    backCursor = z - w / 2 - 0.6 - r() * 2;
  }
  function spawnLand() {
    const p = take(landPool); if (!p) { landCursor -= 60; return; }
    const z = landCursor - 30;
    put(p, BACK_X - 14 - r() * 8, BACK_Y, z);
    placed.push({ p, zMin: z - 20 });
    landCursor = z - 90 - r() * 60;
  }

  let AHEAD = Number(new URLSearchParams(location.search).get('ahead')) || 105;
  const BEHIND = 26;
  let lodFar = 30;
  function update(playerZ: number, t: number) {
    let guard = 0;
    while (runCursor > playerZ - AHEAD && guard++ < 40) spawnRun();
    while (oppCursor > playerZ - AHEAD * 0.8 && guard++ < 80) spawnOpp();
    while (backCursor > playerZ - AHEAD * 0.5 && guard++ < 120) spawnBack();
    while (landCursor > playerZ - AHEAD * 2 && guard++ < 130) spawnLand();
    for (let i = placed.length - 1; i >= 0; i--) {
      if (placed[i].zMin > playerZ + BEHIND) { placed[i].p.used = false; batcher.hide(placed[i].p.refs); physics?.remove(placed[i].p); placed.splice(i, 1); }
    }
    while (segs.length && segs[0].zB > playerZ + BEHIND) segs.shift();
    // LOD: 0 = cerca (todo + sombras), 1 = medio (todo), 2 = lejos (sin detalle)
    for (const pl of placed) {
      const d = pl.p.pos.z - playerZ;           // negativo = delante
      const lod = pl.p.tag === 'land' ? 2 : d < 14 && d > -26 && pl.p.tag === 'run' ? 0 : d > -lodFar ? 1 : 2;
      if (lod === pl.p.lod) continue;
      pl.p.lod = lod;
      batcher.setLod(pl.p.refs, lod);
    }
    for (const p of pickups) {
      if (!p.g.visible) continue;
      if (p.pos.z > playerZ + BEHIND) { p.g.visible = false; p.taken = true; continue; }
      p.t += 1 / 60;
      p.g.position.set(p.pos.x, p.pos.y + Math.sin(t * 2 + p.t) * 0.15, p.pos.z);
      p.g.rotation.y = t * (p.kind === 'taiko' ? 0.6 : 1.4) + p.t;
    }
    far.position.z = playerZ;
    // a saltos de 64 m: si siguiera al jugador cada fotograma, la textura del suelo se deslizaría con él
    alley.position.z = ground.position.z = wall.position.z = terraceTop.position.z = Math.round((playerZ - 150) / 64) * 64;
  }

  /** Altura pisable bajo z, o -Infinity si es un hueco. */
  function groundAt(z: number) {
    for (const s of segs) if (z <= s.zA && z >= s.zB) return s.y;
    return -Infinity;
  }
  function segAt(z: number) { return segs.find((s) => z <= s.zA && z >= s.zB) ?? null; }
  function nextSeg(z: number) { return segs.find((s) => s.zA < z) ?? null; }

  /** Desplaza todo el mundo en z (origen flotante para partidas de horas). */
  function shift(dz: number) {
    for (const s of segs) { s.zA += dz; s.zB += dz; }
    for (const pl of placed) { pl.zMin += dz; pl.p.pos.z += dz; batcher.place(pl.p.refs, pl.p.pos, pl.p.rot, pl.p.lod); }
    for (const p of pickups) { p.pos.z += dz; p.g.position.z += dz; }
    runCursor += dz; oppCursor += dz; backCursor += dz; landCursor += dz;
  }

  return { root, far, update, setAhead(v: number) { AHEAD = v; }, setLodFar(v: number) { lodFar = v; for (const p of all) p.lod = -1; }, groundAt, segAt, nextSeg, pickups, shift, segs };
}
