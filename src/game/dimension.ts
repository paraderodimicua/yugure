// DIMENSIÓN OSCURA: recorrido de ~260 m hacia -Z sobre islas de piedra rota, torii partidos, pilares y
// puentes quebrados flotando en un vacío negro-violeta. Ojos de sombra a los lados disparan orbes.
// Todo instanciado: ~25 llamadas de dibujo. Determinista (semilla fija). Coordenadas locales del grupo:
// origen en el punto de entrada, avance hacia -Z, plataformas entre y = 0 y 3.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage } from '../stage';
import type { Mats } from '../render/materials';
import type { Physics } from './physics';
import type { Collider, Quality } from './contracts';
import { rnd } from './storm/gate';
import * as S from './dimension/shaders';
import { exitPortal, entryPortal } from './dimension/portal';

type QD = { ash: number; parts: number; spect: number; fish: number; crows: number; hands: number; smoke: number; far: number; motes: number; suck: number };
const QT: Record<Quality, QD> = {
  low: { ash: 220, parts: 360, spect: 5, fish: 6, crows: 10, hands: 2, smoke: 6, far: 16, motes: 60, suck: 120 },
  medium: { ash: 450, parts: 520, spect: 8, fish: 10, crows: 16, hands: 3, smoke: 9, far: 26, motes: 100, suck: 220 },
  high: { ash: 800, parts: 700, spect: 12, fish: 16, crows: 26, hands: 5, smoke: 12, far: 34, motes: 140, suck: 320 },
  ultra: { ash: 1300, parts: 900, spect: 16, fish: 22, crows: 36, hands: 6, smoke: 14, far: 40, motes: 180, suck: 420 },
};

const LEN = 260;
const EXIT = new THREE.Vector3(0, 6.6, -256);
const col3 = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);
const STONE = col3(0.28, 0.27, 0.33), STONE2 = col3(0.21, 0.21, 0.26), LACQ = col3(0.34, 0.05, 0.05), BLACK = col3(0.07, 0.06, 0.08), WOOD = col3(0.25, 0.19, 0.16);

// ── geometrías unitarias (cara superior en y = 0) con bordes desconchados deterministas ──
const hash = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function chip(g: THREE.BufferGeometry, amt: number, keepTop: boolean, taper = 1) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (keepTop && y > -0.01) continue;
    const k = 1 - (1 - taper) * Math.min(1, -y);
    p.setXYZ(i, x * k + (hash(x, y, z) - 0.5) * amt, y + (hash(z, x, y) - 0.5) * amt * 0.6, z * k + (hash(y, z, x) - 0.5) * amt);
  }
  g.computeVertexNormals();
  return g;
}
const slabGeo = () => chip(new THREE.BoxGeometry(1, 1, 1, 3, 2, 3).translate(0, -0.5, 0), 0.14, true, 0.8);
const underGeo = () => chip(new THREE.ConeGeometry(0.5, 1, 7, 3).rotateX(Math.PI).translate(0, -0.5, 0), 0.22, true);
const cylGeo = () => chip(new THREE.CylinderGeometry(0.5, 0.5, 1, 9, 6).translate(0, -0.5, 0), 0.06, true);
const boxGeo = () => new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0);

type Mover = { g: THREE.Object3D; kind: 'x' | 'y' | 'fall'; bx: number; by: number; bz: number; w: number; d: number; h: number; amp: number; per: number; ph: number; st: number; tt: number; vy: number; cols: Collider[] };
type Eye = { x: number; y: number; z: number; ph: number; next: number; charge: number; iv: number; p: THREE.Vector3 };
type Orb = { on: boolean; p: THREE.Vector3; v: THREE.Vector3; age: number; from: THREE.Vector3 };

export function createDimension(st: Stage, mats: Mats, physics: Physics, quality: Quality) {
  void mats;
  const q = QT[quality] ?? QT.medium;
  const r = rnd(0xd1e5);
  const root = new THREE.Group(); root.name = 'darkDimension'; root.visible = false;
  const U: S.DimU = { uTime: st.U.time, uFog: { value: 0.021 }, uExit: { value: new THREE.Vector3() } };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  // ── recopilación de instancias y colisionadores ──
  type I = { m: THREE.Matrix4; c: THREE.Color };
  const L: Record<'slab' | 'under' | 'cyl' | 'box', I[]> = { slab: [], under: [], cyl: [], box: [] };
  const put = (k: keyof typeof L, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: THREE.Color, rx = 0, ry = 0, rz = 0) =>
    L[k].push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)), c: c.clone().multiplyScalar(0.85 + r() * 0.3) });
  const cols: Collider[] = [];
  const route: THREE.Vector3[] = [];             // puntos de la ruta principal (visor / cámara)
  const way = (x: number, y: number, z: number) => route.push(new THREE.Vector3(x, y, z));

  function slab(x: number, top: number, z: number, w: number, d: number, h = 1.3, c = STONE, collide = true) {
    put('slab', x, top, z, w, h, d, c);
    put('under', x, top - h + 0.05, z, w * 0.9, 2.5 + r() * 5 * Math.min(1, (w + d) / 8), d * 0.9, STONE2, 0, r() * 6);
    if (collide) cols.push({ kind: 'box', min: [x - w / 2, top - h, z - d / 2], max: [x + w / 2, top, z + d / 2] });
  }
  function pillar(x: number, top: number, z: number, rad = 1.1, c = STONE, len = 26) {
    put('cyl', x, top, z, rad * 2, len, rad * 2, c, 0, r() * 6);
    const s = rad * 0.8;
    cols.push({ kind: 'box', min: [x - s, top - len, z - s], max: [x + s, top, z + s] });
  }
  /** tramo de puente de tablones entre z0 (cerca) y z1 (lejos, más negativo) */
  function bridge(x: number, top: number, z0: number, z1: number, w = 2.2) {
    for (let z = z0 - 0.3; z > z1 + 0.2; z -= 0.55) put('box', x + (r() - 0.5) * 0.08, top - (r() < 0.15 ? 0.06 : 0), z, w * (0.9 + r() * 0.15), 0.18, 0.46, WOOD, 0, (r() - 0.5) * 0.06);
    for (const sx of [-1, 1]) put('box', x + sx * (w / 2 - 0.12), top - 0.18, (z0 + z1) / 2, 0.24, 0.32, z0 - z1, WOOD);
    cols.push({ kind: 'box', min: [x - w / 2, top - 0.5, z1], max: [x + w / 2, top, z0] });
  }
  /** torii: 0 entero (kasagi pisable + barra en el nuki), 1 partido (viga caída), 2 solo muñones */
  function torii(x: number, base: number, z: number, kind: 0 | 1 | 2, s = 1, collide = true) {
    const H = 6.4 * s, hw = 2.6 * s, pr = 0.34 * s, deep = 18 * s;
    const pl = (px: number, top: number) => { put('cyl', px, top, z, pr * 2, top - base + deep, pr * 2, LACQ); if (collide) cols.push({ kind: 'box', min: [px - pr, base - deep, z - pr], max: [px + pr, top, z + pr], grab: false }); };
    if (kind === 0) {
      pl(x - hw, base + H); pl(x + hw, base + H);
      put('box', x, base + H + 0.55 * s, z, 7.8 * s, 0.5 * s, 0.85 * s, BLACK);
      put('box', x, base + H + 0.05 * s, z, 7 * s, 0.3 * s, 0.6 * s, LACQ);
      put('box', x, base + H - 1.25 * s, z, 6.4 * s, 0.32 * s, 0.36 * s, LACQ);
      if (collide) {
        cols.push({ kind: 'box', min: [x - 3.9 * s, base + H - 0.25 * s, z - 0.42 * s], max: [x + 3.9 * s, base + H + 0.55 * s, z + 0.42 * s] });
        cols.push({ kind: 'bar', a: [x - 2.2 * s, base + H - 1.4 * s, z], b: [x + 2.2 * s, base + H - 1.4 * s, z], r: 0.3 });
      }
    } else if (kind === 1) {
      pl(x - hw, base + H); pl(x + hw, base + 2.6 * s);
      put('box', x - 0.4 * s, base + H - 1.0 * s, z, 7.8 * s, 0.5 * s, 0.85 * s, BLACK, 0.05, 0.1, -0.42);
      put('box', x - 1.6 * s, base + H - 1.2 * s, z + 0.1, 3.4 * s, 0.32 * s, 0.36 * s, LACQ, 0, 0.2, -0.15);
    } else {
      pl(x - hw, base + 3.4 * s); pl(x + hw, base + 1.7 * s);
    }
  }

  // ── movibles (cada uno es un Object3D hijo del grupo, registrado con addMoving) ──
  const movers: Mover[] = [];
  function mover(kind: Mover['kind'], x: number, top: number, z: number, w: number, d: number, amp = 0, per = 5, ph = 0) {
    const g = new THREE.Object3D(); g.position.set(x, top, z); root.add(g);
    const h = 1.0;
    movers.push({ g, kind, bx: x, by: top, bz: z, w, d, h, amp, per, ph, st: 0, tt: 0, vy: 0, cols: [{ kind: 'box', min: [-w / 2, -h, -d / 2], max: [w / 2, 0, d / 2] }] });
  }

  // ════════════════ RECORRIDO ════════════════
  // S0 isla de llegada (z 6 → -10) con torii partido
  slab(0, 0, -2, 10, 16, 2.2); torii(0, 0, -8, 1, 1, false); way(0, 0, 2); way(0, 0, -8);
  // S1 losas escalonadas en zigzag (huecos 2,1-2,7 m)
  const s1: [number, number, number, number][] = [[1.5, 0.3, -14, 3.2], [-1.5, 0.8, -19.2, 3], [1.0, 0.4, -24.4, 2.8], [-0.5, 1.2, -29.8, 2.6]];
  for (const [x, t, z, w] of s1) { slab(x, t, z, w, w); way(x, t, z); }
  slab(0.5, 1.0, -36, 4, 5); way(0.5, 1, -36);
  // S2 puente quebrado con torii partido encima
  bridge(0, 1.0, -41.5, -48); way(0, 1, -45);
  bridge(0, 0.6, -51.5, -56); way(0, 0.6, -54);
  bridge(0.6, 0.6, -59, -64.5); way(0.6, 0.6, -62); torii(0.3, 0.6, -61, 1);
  bridge(0, 0.0, -68.5, -72); way(0, 0, -70.5);
  // S3 dos rutas: pilares bajos a la izquierda, ascensor + viga caída a la derecha
  const s3: [number, number, number][] = [[-2.5, 0.4, -76], [-3.2, 0.9, -80.5], [-2.2, 1.5, -85], [-3, 1.2, -89.5], [-2.4, 1.8, -94]];
  for (const [x, t, z] of s3) { pillar(x, t, z); way(x, t, z); }
  mover('y', 3.6, 1.5, -78.5, 2.8, 2.8, 1.5, 6);
  put('box', 3.6, 3.0, -87, 0.8, 0.6, 10, BLACK, 0, 0.02, 0); cols.push({ kind: 'box', min: [3.2, 2.4, -92], max: [4.0, 3.0, -82] });
  pillar(3.6, 2.4, -94.5, 0.9, STONE2, 3.5);
  slab(0, 1.8, -101, 8, 8, 2); way(0, 1.8, -101); torii(0, 1.8, -103, 2);
  // S4 plataformas móviles
  mover('x', 0, 1.8, -110, 3, 3, 3.2, 6, 0); way(0, 1.8, -110);
  mover('x', 0, 2.2, -116, 3, 3, 3.2, 6, Math.PI); way(0, 2.2, -116);
  pillar(0, 2.6, -121, 1.0); way(0, 2.6, -121);
  mover('y', 0, 1.6, -126.5, 3, 3, 1.4, 4.5); way(0, 2.4, -126.5);
  slab(0, 2.5, -135, 9, 8, 2.2); way(0, 2.5, -134); torii(0, 2.5, -137, 0);
  // S5 bifurcación: izquierda losas que caen; derecha camino alto con barra de torii y viga
  const s5: [number, number, number][] = [[-3.5, 2.3, -143.5], [-4.5, 2.0, -148.5], [-3.5, 1.8, -153.5], [-4.5, 1.6, -158.5], [-3.5, 1.4, -163.5], [-4, 1.2, -168.5], [-4, 1.0, -173.5]];
  for (const [x, t, z] of s5) { mover('fall', x, t, z, 2.6, 2.6); way(x, t, z); }
  slab(-3, 1.0, -179, 3.5, 4); way(-3, 1, -179);
  slab(4.5, 3.4, -144, 3, 3);
  torii(4.5, -0.2, -150, 0); pillar(4.5, 2.6, -150.6, 0.8, STONE2);
  pillar(4.5, 3.6, -156, 1.1);
  put('box', 4.5, 3.2, -163, 1.0, 0.6, 8, BLACK); cols.push({ kind: 'box', min: [4.0, 2.6, -167], max: [5.0, 3.2, -159] });
  pillar(4, 2.6, -171, 1.1); slab(3.5, 1.8, -177.5, 3, 3);
  slab(0, 1.0, -186, 12, 8, 2.4); way(0, 1, -186); torii(-3.5, 1.0, -188.5, 2);
  // S6 tramo final: el más difícil (salto largo que pide impulso)
  slab(1.5, 1.4, -194.5, 2.4, 2.4); way(1.5, 1.4, -194.5);
  mover('fall', -1.5, 1.8, -199.5, 2.4, 2.4); way(-1.5, 1.8, -199.5);
  mover('x', 0, 2.0, -205, 3, 2.6, 4, 5, 1); way(0, 2, -205);
  pillar(2, 2.6, -210.5, 1.0); way(2, 2.6, -210.5);
  slab(1, 1.0, -219.5, 3.5, 3.5); way(1, 1, -219.5);
  mover('fall', -1.5, 1.4, -225, 2.4, 2.4); way(-1.5, 1.4, -225);
  mover('y', 1, 1.5, -230.5, 2.6, 2.6, 1.2, 4); way(1, 2, -230.5);
  pillar(-0.5, 2.8, -236, 1.0); way(-0.5, 2.8, -236);
  slab(0, 2.6, -241.5, 3, 3); way(0, 2.6, -241.5);
  slab(0, 3.0, -253.25, 14, 17.5, 3); way(0, 3, -250); way(0, 3, -255);
  torii(-5, 3, -258, 2); torii(5.5, 3, -247, 2);

  // ── decorado lejano: islas gigantes flotando y torii colosales (sin colisión) ──
  for (let i = 0; i < q.far; i++) {
    const side = i % 2 ? 1 : -1, x = side * (38 + r() * 90), z = 30 - r() * 330, y = -25 + r() * 45, w = 8 + r() * 22;
    slab(x, y, z, w, w * (0.6 + r() * 0.8), 3 + r() * 5, r() < 0.5 ? STONE : STONE2, false);
  }
  torii(-55, -10, -150, 0, 4, false); torii(70, -18, -40, 1, 5, false); torii(48, -6, -230, 2, 3.5, false);

  const solid = S.solidMat(U);
  function inst(geo: THREE.BufferGeometry, list: I[]) {
    const m = new THREE.InstancedMesh(geo, solid, Math.max(1, list.length));
    list.forEach((it, i) => { m.setMatrixAt(i, it.m); m.setColorAt(i, it.c); });
    m.count = list.length; m.computeBoundingSphere(); root.add(m);
    return m;
  }
  inst(slabGeo(), L.slab); inst(underGeo(), L.under); inst(cylGeo(), L.cyl); inst(boxGeo(), L.box);
  const movSlab = new THREE.InstancedMesh(slabGeo(), solid, movers.length), movUnder = new THREE.InstancedMesh(underGeo(), solid, movers.length);
  movSlab.frustumCulled = movUnder.frustumCulled = false;
  movers.forEach((mv, i) => { movSlab.setColorAt(i, mv.kind === 'fall' ? STONE2.clone().multiplyScalar(1.15) : STONE); movUnder.setColorAt(i, STONE2); });
  root.add(movSlab, movUnder);
  const moverDepth = movers.map(() => 1.8 + r() * 2);
  const moverRy = movers.map(() => r() * 6);

  // ── cielo, abismo, humo y ceniza ──
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), S.skyMat(U)); sky.renderOrder = -9; sky.frustumCulled = false;
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), S.abyssMat(U)); abyss.rotation.x = -Math.PI / 2; abyss.position.y = -90; abyss.frustumCulled = false;
  const smokeG: THREE.BufferGeometry[] = [];
  for (let i = 0; i < q.smoke; i++) {
    const side = i % 2 ? 1 : -1, rad = 2 + r() * 3.5, g = new THREE.CylinderGeometry(rad, rad * 1.6, 80, 10, 1, true);
    g.translate(side * (16 + r() * 34), -22 + r() * 8, 10 - (i / q.smoke) * 280 - r() * 20); smokeG.push(g);
  }
  const smoke = new THREE.Mesh(mergeGeometries(smokeG)!, S.smokeMat(U)); smoke.renderOrder = 4; smoke.frustumCulled = false;
  const ashG = new THREE.BufferGeometry(), ashP = new Float32Array(q.ash * 3), ashR = new Float32Array(q.ash);
  for (let i = 0; i < q.ash; i++) { ashP[i * 3] = r() * 44; ashP[i * 3 + 1] = r() * 26; ashP[i * 3 + 2] = r() * 44; ashR[i] = r(); }
  ashG.setAttribute('position', new THREE.BufferAttribute(ashP, 3)); ashG.setAttribute('aR', new THREE.BufferAttribute(ashR, 1));
  const ashM = S.ashMat(U);
  const ash = new THREE.Points(ashG, ashM); ash.frustumCulled = false; ash.renderOrder = 5;
  root.add(sky, abyss, smoke, ash);

  // ── sombras voladoras decorativas ──
  const T = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    return g;
  };
  const spectG = mergeGeometries([
    T(new THREE.SphereGeometry(0.5, 10, 8), 0, 0, -0.3, 0, 0, 0, 1, 1.15, 1),
    T(new THREE.ConeGeometry(0.7, 4.5, 10, 6, true), 0, 0, 2.2, Math.PI / 2, 0, 0),
    T(new THREE.ConeGeometry(0.12, 2, 5, 4), -0.75, -0.3, 0.7, Math.PI / 2 - 0.3, 0, 0.5),
    T(new THREE.ConeGeometry(0.12, 2, 5, 4), 0.75, -0.3, 0.7, Math.PI / 2 - 0.3, 0, -0.5),
  ])!;
  const fishG = mergeGeometries([
    T(new THREE.SphereGeometry(1, 12, 8), 0, 0, 0, 0, 0, 0, 0.55, 0.75, 2.2),
    T(new THREE.ConeGeometry(0.8, 1.6, 6, 3), 0, 0, 2.7, -Math.PI / 2, 0, 0, 0.15, 1, 1.4),
    T(new THREE.ConeGeometry(0.4, 1.2, 5), 0, 0.8, 0.4, -0.6, 0, 0, 0.2, 1, 1),
  ])!;
  const crowG = mergeGeometries([
    T(new THREE.SphereGeometry(0.22, 8, 6), 0, 0, 0, 0, 0, 0, 1, 1, 2.2),
    T(new THREE.PlaneGeometry(1.4, 0.5, 4, 1), -0.75, 0, 0.1, -Math.PI / 2),
    T(new THREE.PlaneGeometry(1.4, 0.5, 4, 1), 0.75, 0, 0.1, -Math.PI / 2),
  ])!;
  const handParts = [T(new THREE.SphereGeometry(1, 10, 8), 0, 0, 0, 0, 0, 0, 1.0, 1.2, 0.4), T(new THREE.CylinderGeometry(0.55, 0.9, 16, 8), 0, -8.5, 0)];
  for (let f = 0; f < 5; f++) {
    const a = -0.7 + f * 0.35, th = f === 4;
    handParts.push(T(new THREE.CylinderGeometry(0.12, 0.2, th ? 1.4 : 2.2, 6), th ? 1.0 : Math.sin(a) * 1.0, th ? 0.4 : 1.1 + Math.cos(a) * 1.0, 0.1, 0.25, 0, th ? -1.0 : -a * 0.8));
  }
  const handG = mergeGeometries(handParts)!;
  type Fly = { mesh: THREE.InstancedMesh; n: number; seeds: Float32Array };
  function flock(geo: THREE.BufferGeometry, n: number, wave: number, flap: number, freq: number): Fly {
    const seeds = new Float32Array(Math.max(1, n)); for (let i = 0; i < n; i++) seeds[i] = r();
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    const mesh = new THREE.InstancedMesh(geo, S.wispMat(U, wave, flap, freq), Math.max(1, n));
    mesh.count = n; mesh.frustumCulled = false; root.add(mesh);
    return { mesh, n, seeds };
  }
  const spect = flock(spectG, q.spect, 0.22, 0, 2.2), fish = flock(fishG, q.fish, 0.18, 0, 3), crows = flock(crowG, q.crows, 0, 0.7, 6), hands = flock(handG, q.hands, 0, 0, 1);
  const setFly = (f: Fly, i: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, sc: number) => {
    _p.set(x, y, z); _v.set(x + dx, y + dy, z + dz);
    _m.lookAt(_p, _v, UP); _q.setFromRotationMatrix(_m);
    f.mesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(sc)));
  };

  // ── ojos-torreta ──
  const eyes: Eye[] = [];
  const ez = [-20, -33, -48, -62, -78, -92, -108, -120, -142, -156, -168, -181, -196, -207, -218, -229, -240];
  ez.forEach((z, i) => { const side = i % 2 ? 1 : -1; eyes.push({ x: side * (9 + r() * 4), y: 3 + r() * 6, z, ph: r() * 6, next: 0, charge: -1, iv: 0, p: new THREE.Vector3() }); });
  const eyeBodyG = mergeGeometries([
    T(new THREE.SphereGeometry(1, 14, 10), 0, 0, 0, 0, 0, 0, 1.15, 1, 1),
    ...[0, 1, 2, 3, 4].map(k => T(new THREE.ConeGeometry(0.22, 3.5, 5, 4), Math.cos(k * 1.26) * 0.6, -2.2, Math.sin(k * 1.26) * 0.6 + 0.2, 0, 0, Math.PI + (k - 2) * 0.12)),
  ])!;
  const eyeBody = flock(eyeBodyG, eyes.length, 0, 0, 1);
  const irisG = new THREE.SphereGeometry(1, 16, 10); irisG.scale(0.55, 0.5, 0.3); irisG.translate(0, 0, -0.92);
  const chargeA = new THREE.InstancedBufferAttribute(new Float32Array(eyes.length), 1); chargeA.setUsage(THREE.DynamicDrawUsage);
  irisG.setAttribute('aCharge', chargeA);
  const iris = new THREE.InstancedMesh(irisG, S.irisMat(U), eyes.length); iris.frustumCulled = false; root.add(iris);

  // ── orbes y partículas (piscinas fijas) ──
  const NORB = 32;
  const orbs: Orb[] = Array.from({ length: NORB }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, from: new THREE.Vector3() }));
  const orbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 14, 10), S.orbMat(U), NORB); orbMesh.frustumCulled = false; orbMesh.count = 0; root.add(orbMesh);
  const NP = q.parts;
  const pp = new Float32Array(NP * 3), pv = new Float32Array(NP * 3), pc = new Float32Array(NP * 4), ps = new Float32Array(NP), plife = new Float32Array(NP), page = new Float32Array(NP), ps0 = new Float32Array(NP), pdrag = new Float32Array(NP);
  const pG = new THREE.BufferGeometry();
  const pPos = new THREE.BufferAttribute(pp, 3).setUsage(THREE.DynamicDrawUsage), pCol = new THREE.BufferAttribute(pc, 4).setUsage(THREE.DynamicDrawUsage), pSize = new THREE.BufferAttribute(ps, 1).setUsage(THREE.DynamicDrawUsage);
  pG.setAttribute('position', pPos); pG.setAttribute('aCol', pCol); pG.setAttribute('aSize', pSize);
  const parts = new THREE.Points(pG, S.partMat()); parts.frustumCulled = false; parts.renderOrder = 6; root.add(parts);
  let pHead = 0;
  function emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, cr: number, cg: number, cb: number, drag = 1) {
    const i = pHead; pHead = (pHead + 1) % NP;
    pp[i * 3] = x; pp[i * 3 + 1] = y; pp[i * 3 + 2] = z; pv[i * 3] = vx; pv[i * 3 + 1] = vy; pv[i * 3 + 2] = vz;
    pc[i * 4] = cr; pc[i * 4 + 1] = cg; pc[i * 4 + 2] = cb; plife[i] = life; page[i] = 0; ps0[i] = size; pdrag[i] = drag;
  }
  plife.fill(0); page.fill(1);

  // ── portal de salida ──
  const exit = exitPortal(U.uTime, q.motes); exit.position.copy(EXIT); root.add(exit);
  U.uExit.value.copy(EXIT);

  // ════════════════ API ════════════════
  const owner = {};
  let active = false;
  const saved = { sky: true, clouds: true, sun: 0, hemi: 0, rays: false, sunCol: new THREE.Color(), hemiCol: new THREE.Color(), hemiGround: new THREE.Color() };
  st.scene.add(root);

  function reset() {
    for (const o of orbs) o.on = false;
    plife.fill(0); page.fill(1);
    eyes.forEach((e, i) => { e.next = 1.5 + i * 0.13; e.charge = -1; });
    for (const mv of movers) { mv.st = 0; mv.tt = 0; mv.vy = 0; mv.g.position.set(mv.bx, mv.by, mv.bz); }
  }

  function start(originX: number, originZ: number) {
    root.position.set(originX, 0, originZ); root.visible = true; root.updateMatrixWorld(true);
    if (active) { physics.remove(owner); for (const mv of movers) physics.remove(mv.g); }
    reset();
    physics.add(owner, cols, root.matrixWorld);
    for (const mv of movers) physics.addMoving(mv.g, mv.cols);
    if (!active) {
      saved.sky = st.sky.visible; saved.clouds = st.clouds.group.visible; saved.sun = st.sun.intensity; saved.hemi = st.hemi.intensity; saved.rays = st.post.rays.enabled;
      saved.sunCol.copy(st.sun.color); saved.hemiCol.copy(st.hemi.color); saved.hemiGround.copy(st.hemi.groundColor);
    }
    st.sky.visible = false; st.clouds.group.visible = false; st.post.rays.enabled = false;
    st.sun.intensity = 0.9; st.sun.color.setRGB(0.55, 0.6, 1.0); st.hemi.intensity = 0.55; st.hemi.color.setRGB(0.3, 0.25, 0.6); st.hemi.groundColor.setRGB(0.35, 0.12, 0.45);
    active = true;
    return { x: originX, y: 0.05, z: originZ };
  }
  function stop() {
    if (!active) return;
    physics.remove(owner); for (const mv of movers) physics.remove(mv.g);
    root.visible = false; active = false;
    st.sky.visible = saved.sky; st.clouds.group.visible = saved.clouds; st.post.rays.enabled = saved.rays;
    st.sun.intensity = saved.sun; st.hemi.intensity = saved.hemi; st.sun.color.copy(saved.sunCol); st.hemi.color.copy(saved.hemiCol); st.hemi.groundColor.copy(saved.hemiGround);
  }
  const exitW = new THREE.Vector3();
  function exitAt() { return exitW.copy(EXIT).add(root.position); }

  const lp = new THREE.Vector3(), chest = new THREE.Vector3(), tgt = new THREE.Vector3(), hitFrom = new THREE.Vector3();
  function update(t: number, dt: number, player: { pos: THREE.Vector3; vel: THREE.Vector3 }, hit: (damage: number, from: THREE.Vector3) => void) {
    if (!active) return;
    dt = Math.min(dt, 0.05);
    const o = root.position;
    lp.copy(player.pos).sub(o);
    // cielo, abismo y ceniza siguen a la cámara
    _v.copy(st.camera.position).sub(o);
    sky.position.copy(_v); abyss.position.x = _v.x; abyss.position.z = _v.z; ashM.uniforms.uCam.value.copy(_v);
    const prog = THREE.MathUtils.clamp(-lp.z / LEN, 0, 1);

    // ── movibles: posición, arrastre del jugador, caída ──
    for (let i = 0; i < movers.length; i++) {
      const mv = movers[i], g = mv.g, ox = g.position.x, oy = g.position.y;
      const on = Math.abs(lp.x - ox) < mv.w / 2 + 0.15 && Math.abs(lp.z - g.position.z) < mv.d / 2 + 0.15 && lp.y - oy > -0.3 && lp.y - oy < 0.25 && player.vel.y < 0.5;
      let jx = 0, jz = 0;
      if (mv.kind === 'x') g.position.x = mv.bx + Math.sin(t * Math.PI * 2 / mv.per + mv.ph) * mv.amp;
      else if (mv.kind === 'y') g.position.y = mv.by + (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / mv.per + mv.ph)) * mv.amp * 2 - mv.amp;
      else {
        mv.tt += dt;
        if (mv.st === 0 && on) { mv.st = 1; mv.tt = 0; }
        else if (mv.st === 1) { jx = (Math.random() - 0.5) * 0.08; jz = (Math.random() - 0.5) * 0.08; if (mv.tt > 0.55) { mv.st = 2; mv.tt = 0; mv.vy = 0; for (let k = 0; k < 6; k++) emit(ox + (Math.random() - 0.5) * mv.w, oy - 0.3, g.position.z + (Math.random() - 0.5) * mv.d, 0, -1.5, 0, 0.9, 0.5, 0.25, 0.1, 0.4); } }
        else if (mv.st === 2) { mv.vy -= 20 * dt; g.position.y += mv.vy * dt; if (g.position.y < mv.by - 45) { mv.st = 3; mv.tt = 0; } }
        else if (mv.st === 3 && mv.tt > 3) { mv.st = 0; g.position.set(mv.bx, mv.by, mv.bz); }
      }
      if (on && mv.kind !== 'fall') { player.pos.x += g.position.x - ox; if (g.position.y > oy) player.pos.y += g.position.y - oy; }
      _p.set(g.position.x + jx, g.position.y, g.position.z + jz);
      movSlab.setMatrixAt(i, _m.compose(_p, _q.identity(), _s.set(mv.w, mv.h, mv.d)));
      _p.y -= mv.h - 0.05;
      movUnder.setMatrixAt(i, _m.compose(_p, _q.setFromAxisAngle(UP, moverRy[i]), _s.set(mv.w * 0.85, moverDepth[i], mv.d * 0.85)));
    }
    movSlab.instanceMatrix.needsUpdate = movUnder.instanceMatrix.needsUpdate = true;

    // ── ojos: miran al jugador, cargan 0,6 s y disparan ──
    chest.copy(lp).y += 1.0;
    for (let i = 0; i < eyes.length; i++) {
      const e = eyes[i];
      e.p.set(e.x, e.y + Math.sin(t * 0.8 + e.ph) * 0.6, e.z);
      const ahead = lp.z - e.z;                                     // > 0: el jugador aún no lo ha pasado
      const on = ahead < 42 && ahead > -10 && e.p.distanceTo(chest) < 48;
      if (on && e.charge < 0 && t >= e.next) e.charge = 0;
      if (e.charge >= 0) {
        e.charge += dt;
        const k = Math.min(1, e.charge / 0.6);
        emit(e.p.x, e.p.y, e.p.z, 0, 0, 0, dt * 1.6, 1.2 + k * 3.5, 0.6 + k, 0.25 + k * 0.5, 1.1 + k);
        if (Math.random() < 0.6) { _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(2.2); emit(e.p.x + _v.x, e.p.y + _v.y, e.p.z + _v.z, -_v.x * 3.5, -_v.y * 3.5, -_v.z * 3.5, 0.3, 0.3, 1.2, 0.6, 2, 0); }
        if (e.charge >= 0.6) {
          e.charge = -1;
          e.next = t + Math.max(1.1, 3.4 - 2.1 * prog) + Math.random() * 0.7;
          if (on) {
            let orb: Orb | undefined; for (const b of orbs) if (!b.on) { orb = b; break; }
            if (orb) {
              const speed = 10 + 6 * prog;
              const lead = Math.min(1.2, e.p.distanceTo(chest) / speed) * 0.65;
              tgt.copy(chest).addScaledVector(player.vel, lead); tgt.y = chest.y + THREE.MathUtils.clamp(player.vel.y * lead, -1.5, 1.5);
              orb.v.copy(tgt).sub(e.p).normalize();
              orb.p.copy(e.p).addScaledVector(orb.v, 1.2); orb.v.multiplyScalar(speed);
              orb.from.copy(e.p).add(o); orb.age = 0; orb.on = true;
              for (let k = 0; k < 8; k++) emit(orb.p.x, orb.p.y, orb.p.z, orb.v.x * 0.2 + (Math.random() - 0.5) * 4, orb.v.y * 0.2 + (Math.random() - 0.5) * 4, orb.v.z * 0.2 + (Math.random() - 0.5) * 4, 0.35, 0.5, 1.6, 0.7, 2.6, 3);
            }
          }
        }
      }
      chargeA.setX(i, e.charge >= 0 ? Math.min(1, e.charge / 0.6) : 0);
      _m.lookAt(e.p, chest, UP); _q.setFromRotationMatrix(_m);
      _m.compose(e.p, _q, _s.setScalar(1));
      iris.setMatrixAt(i, _m); eyeBody.mesh.setMatrixAt(i, _m);
    }
    chargeA.needsUpdate = true; iris.instanceMatrix.needsUpdate = eyeBody.mesh.instanceMatrix.needsUpdate = true;

    // ── orbes ──
    let n = 0;
    for (const b of orbs) {
      if (!b.on) continue;
      b.age += dt; b.p.addScaledVector(b.v, dt);
      let boom = b.age > 5 || b.p.y < -30;
      if (b.p.distanceTo(chest) < 0.6 + 0.3) { boom = true; hitFrom.copy(b.from); hit(0.25, hitFrom); }
      if (boom) {
        b.on = false;
        for (let k = 0; k < 22; k++) { _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 5); emit(b.p.x, b.p.y, b.p.z, _v.x, _v.y, _v.z, 0.5 + Math.random() * 0.4, 0.35 + Math.random() * 0.4, 1.4, 0.55, 2.4, 2.5); }
        emit(b.p.x, b.p.y, b.p.z, 0, 0, 0, 0.25, 5, 1.2, 0.5, 2.2);
        continue;
      }
      emit(b.p.x + (Math.random() - 0.5) * 0.2, b.p.y + (Math.random() - 0.5) * 0.2, b.p.z + (Math.random() - 0.5) * 0.2, 0, 0.3, 0, 0.45, 0.65, 0.5, 0.18, 0.9);
      orbMesh.setMatrixAt(n++, _m.makeTranslation(b.p.x, b.p.y, b.p.z));
    }
    orbMesh.count = n; orbMesh.instanceMatrix.needsUpdate = true;

    // ── partículas ──
    for (let i = 0; i < NP; i++) {
      if (page[i] >= plife[i]) { pc[i * 4 + 3] = 0; ps[i] = 0; continue; }
      page[i] += dt;
      const k = page[i] / plife[i], dr = Math.exp(-pdrag[i] * dt);
      pv[i * 3] *= dr; pv[i * 3 + 1] *= dr; pv[i * 3 + 2] *= dr;
      pp[i * 3] += pv[i * 3] * dt; pp[i * 3 + 1] += pv[i * 3 + 1] * dt; pp[i * 3 + 2] += pv[i * 3 + 2] * dt;
      pc[i * 4 + 3] = Math.max(0, 1 - k); ps[i] = ps0[i] * (1 - k * 0.5);
    }
    pPos.needsUpdate = pCol.needsUpdate = pSize.needsUpdate = true;

    // ── sombras decorativas ──
    const cz = lp.z;
    for (let i = 0; i < spect.n; i++) {
      const s = spect.seeds[i], side = i % 2 ? 1 : -1;
      const z = cz + 30 - ((t * (3 + s * 3) + s * 90) % 90), x = side * (12 + s * 22) + Math.sin(t * 0.4 + s * 9) * 3, y = 1 + s * 12 + Math.sin(t * 0.7 + s * 5) * 2;
      setFly(spect, i, x, y, z, Math.cos(t * 0.4 + s * 9) * 0.3 * side, Math.cos(t * 0.7 + s * 5) * 0.3, -1, 1 + s * 0.8);
    }
    for (let i = 0; i < fish.n; i++) {
      const s = fish.seeds[i], side = i % 2 ? 1 : -1, a = t * (0.15 + s * 0.12) * (i % 3 ? 1 : -1) + s * 20, R = 9 + s * 10;
      const cx = side * (10 + s * 14), czz = cz - 20 - s * 40, y = -7 - s * 14 + Math.sin(t * 0.5 + s * 7) * 2;
      setFly(fish, i, cx + Math.cos(a) * R, y, czz + Math.sin(a) * R, -Math.sin(a) * (i % 3 ? 1 : -1), 0, Math.cos(a) * (i % 3 ? 1 : -1), 0.8 + s * 1.4);
    }
    for (let i = 0; i < crows.n; i++) {
      const s = crows.seeds[i], a = t * (0.35 + s * 0.2) + s * 30, R = 14 + s * 20, fl = Math.floor(i / 6);
      setFly(crows, i, (fl % 2 ? 1 : -1) * 20 + Math.cos(a) * R, 14 + s * 16 + fl * 3, cz - 30 - fl * 15 + Math.sin(a) * R * 0.6, -Math.sin(a), 0, Math.cos(a) * 0.6, 1.2 + s * 0.6);
    }
    for (let i = 0; i < hands.n; i++) {
      const s = hands.seeds[i], side = i % 2 ? 1 : -1, k = 0.5 - 0.5 * Math.cos(t * 0.35 + s * 6);
      _p.set(side * (16 + s * 12), -32 + k * 26, cz - 18 - i * 22);
      _q.setFromEuler(_e.set(0.2 - k * 0.3, side * -0.6, side * (0.25 - k * 0.2)));
      hands.mesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(2.2 + s)));
    }
    spect.mesh.instanceMatrix.needsUpdate = fish.mesh.instanceMatrix.needsUpdate = crows.mesh.instanceMatrix.needsUpdate = hands.mesh.instanceMatrix.needsUpdate = true;
  }

  const entryCache: THREE.Group[] = [];
  function portalMesh() { const g = entryPortal(U.uTime, q.suck); entryCache.push(g); return g; }

  return { root, length: LEN, start, update, exitAt, stop, portalMesh, route, movers, eyes };
}
export type Dimension = ReturnType<typeof createDimension>;
