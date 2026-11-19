// Reparto humano: anciano, cocinero, niño del molinillo, niña de la máscara, dama de la sombrilla,
// anciana del abanico, monje barrendero y pareja del té. Cada uno ≤ 6 mallas, geometría cacheada por variante.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Part, PAT, FACES, small, lathe, ball, cyl, box, sweep, prof, bendPt, shade, tris, WHITE, type V3 } from './kit';
import { SK, PROF, kimono, jacket, obi, arm, aim, foot, head, hair, sph, qe, eul, inv, orient, toWorld, toLocal, add3, sub3, mix3, len3 } from './body';
import { type Core, built, mesh, place, variant, finish, pace, bump, smooth } from './core';

const PAL = {
  elder: [
    { kim: 0x77705f, hao: 0x2c3247, obi: 0x3a2c22 }, { kim: 0x5f6b58, hao: 0x4a3026, obi: 0x2a2420 },
    { kim: 0x7b7068, hao: 0x23272f, obi: 0x5a3a22 }, { kim: 0x4e5b6e, hao: 0x5b4634, obi: 0x2a2a30 }],
  cook: [
    { top: 0xece8de, apron: 0x253463, pants: 0x2a2c34, band: 0xf2f0ea, hair: 0x1c1616 }, { top: 0x2d3d68, apron: 0x2a2624, pants: 0x24242a, band: 0xd23a2e, hair: 0x241a16 },
    { top: 0xe6dcc8, apron: 0x6a3a24, pants: 0x30302e, band: 0x2a3a6a, hair: 0x2a2220 }],
  boy: [0x34528f, 0x2f7a6a, 0xc0582c, 0x5f7f38, 0x6a4a8a],
  girl: [
    { yuk: 0xf6efe4, obi: 0xd2383a }, { yuk: 0xc4dbf2, obi: 0xf0b030 }, { yuk: 0xf4cdd6, obi: 0x7a4ab0 }, { yuk: 0xe8e2f6, obi: 0xe0507a }],
  lady: [
    { kim: 0x7a2c4c, obi: 0xd9b45a, cord: 0xd83a3a, age: 0xf0a0b0, kasa: 0xc8302a }, { kim: 0x2c4a7c, obi: 0xece0c8, cord: 0x3aa0a0, age: 0xd8e8f0, kasa: 0x2a3a6a },
    { kim: 0x3d6a5c, obi: 0xe8c070, cord: 0xb03a5a, age: 0xf2d0a0, kasa: 0xd89a3a }, { kim: 0xb26a3e, obi: 0x40304a, cord: 0xe8c050, age: 0xe8c8e0, kasa: 0x6a3a7a }],
  oldlady: [{ kim: 0x5e4e62, obi: 0x8a6a4a }, { kim: 0x4d5d4c, obi: 0x6a3a30 }, { kim: 0x6e5444, obi: 0x2e3448 }],
  monk: [{ robe: 0x24232a, kesa: 0x8a6a3a }, { robe: 0x3c3a3c, kesa: 0x5a6a7a }, { robe: 0x2a2624, kesa: 0xa8743a }],
  tea: [{ man: 0x4c4b44, woman: 0x8a5468, wobi: 0xe0c890 }, { man: 0x3a4250, woman: 0x5a7a68, wobi: 0xe8d8c0 }],
};
const SKIN = (f: number) => FACES[f].skin;
const KIMS = [PAT.seigaiha, PAT.flowers, PAT.asanoha];

function rig(name: string, h = 1) {
  const root = new THREE.Group(); root.name = name; root.scale.setScalar(h);
  const mv = new THREE.Group(); mv.rotation.order = 'YXZ'; root.add(mv);
  return { root, mv };
}
const Sv = { z: 0, yaw: 0, moving: 0 };

// ───────────────────────── Anciano ─────────────────────────
export function elder(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, PAL.elder.length, [PAT.asanoha, PAT.seigaiha, PAT.stripes]);
  const sk = SK.man, Y0 = 0.82, K = 0.42, rR: V3 = [-0.5, 0, -0.08], rL: V3 = [-0.15, 0, 0.08];
  const B = built(C, 'elder' + v.key, () => {
    const pal = PAL.elder[v.pi], body = new Part();
    kimono(body, { prof: PROF.man, color: pal.kim, neckY: sk.nk, crossY: 1.05 });
    obi(body, { prof: PROF.man, y0: 0.9, y1: 0.98, color: pal.obi, knot: 'kaku' });
    jacket(body, PROF.man, 0.58, 1.33, { color: pal.hao, cell: v.cell, open: 0.32 });
    const hz = prof(PROF.man)(1.08) * 0.8 + 0.028;
    for (const s of [-1, 1]) body.add(ball(0.013, 5, 4), 0xf0ead8, { p: [s * 0.045, 1.08, hz] });
    body.add(sweep([[-0.045, 1.08, hz], [0, 1.062, hz + 0.01], [0.045, 1.08, hz]], [0.006], 4, { rings: 4 }), 0xf0ead8);
    body.bend(Y0, K);
    const hd = new Part(), r = sk.hr;
    head(hd, 1, r);
    hair(hd, r, 0xe6e1d8, { bald: true, back: 0.6 });
    for (const [x, l] of [[0, 0.15], [-0.014, 0.11], [0.014, 0.11]]) hd.add(sweep([[x, -r * 0.9, r * 0.55], [x * 1.4, -r * 0.9 - l * 0.5, r * 0.64], [x * 1.1, -r * 0.9 - l, r * 0.55]], [0.011, 0.007, 0.0015], 4, { rings: 6 }), 0xf2eee6);
    hd.add(lathe([[0.001, 0.17], [0.05, 0.145], [0.17, 0.07], [0.3, 0.0], [0.31, -0.012]], 16), 0xd8b47a, { cell: PAT.stripes, p: [0, r * 0.72, -0.01], r: [-0.14, 0, 0] });
    hd.add(sweep([[r * 0.92, r * 0.55, 0], [r * 0.72, -r * 0.9, r * 0.4], [0, -r * 1.25, r * 0.5], [-r * 0.72, -r * 0.9, r * 0.4], [-r * 0.92, r * 0.55, 0]], [0.0045], 4, { rings: 16 }), 0x4a3420);
    const shR = bendPt([-sk.shx, sk.sh, 0], Y0, K), shL = bendPt([sk.shx, sk.sh, 0], Y0, K), qR = qe(rR), qL = qe(rL);
    const aR = new Part(), aL = new Part(), skin = SKIN(1);
    const A = arm(aR, { q: qR, elbow: 0.55, up: sk.up, fo: sk.fo, skin, cloth: pal.hao, cell: v.cell, sleeve: 'kimono', width: 0.3, drop: 0.25, thick: 0.09 });
    arm(aL, { q: qL, elbow: 0.35, up: sk.up, fo: sk.fo, skin, cloth: pal.hao, cell: v.cell, sleeve: 'kimono', width: 0.3, drop: 0.25, thick: 0.09 });
    // bastón nudoso: del puño al suelo, con mango curvo
    const Hw = toWorld(shR, qR, A.H), tip: V3 = [Hw[0] - 0.04, 0, Hw[2] + 0.1];
    const pts: V3[] = [[Hw[0], Hw[1] + 0.035, Hw[2] - 0.085], [Hw[0], Hw[1] + 0.095, Hw[2] - 0.035], [Hw[0], Hw[1] + 0.05, Hw[2] + 0.005]];
    for (let i = 1; i <= 6; i++) { const t = i / 6, p = mix3(Hw, tip, t); pts.push([p[0] + (i % 2 ? 0.012 : -0.01) * (1 - t), p[1], p[2] + (i % 3 ? 0.008 : -0.01) * (1 - t)]); }
    aR.add(sweep(pts.map((p) => toLocal(shR, qR, p)), [0.016, 0.021, 0.018, 0.016, 0.022, 0.015, 0.02, 0.016, 0.018, 0.013], 5, { rings: 16 }), 0x5a3a20);
    const fL = new Part(), fR = new Part(), ft = { tabi: 0xeeeae2, sole: 0xc8b08a, strap: 0x3a2a22 };
    foot(fL, 0.085, 0.07, ft); foot(fR, -0.085, 0.07, ft);
    const g = { body: body.geo(), head: hd.geo(), aL: aL.geo(), aR: aR.geo(), fL: fL.geo(), fR: fR.geo() };
    return { g, bodyF: mergeGeometries([g.body, g.fL, g.fR]), hp: bendPt([0, sk.hd, 0.01], Y0, K), hx: K * (sk.hd - Y0) * 0.35, shR, shL };
  });
  const { root, mv } = rig('elder', v.h);
  const L = o.walk ?? 0;
  const body = mesh(C, L > 0 ? B.g.body : B.bodyF, 'body'), hd = place(mesh(C, B.g.head, 'head'), B.hp, [B.hx, 0, 0]);
  const aR = place(mesh(C, B.g.aR, 'armR'), B.shR, rR), aL = place(mesh(C, B.g.aL, 'armL'), B.shL, rL);
  const fL: THREE.Object3D = L > 0 ? mesh(C, B.g.fL, 'footL') : new THREE.Object3D(), fR: THREE.Object3D = L > 0 ? mesh(C, B.g.fR, 'footR') : new THREE.Object3D();
  mv.add(body, hd, aR, aL); if (L > 0) mv.add(fL, fR);
  return finish(C, root, o, (t) => {
    const T = t + v.ph; let amp = 0;
    if (L > 0) { pace(T, L, 0.3, Sv); mv.position.z = Sv.z; mv.rotation.y = Sv.yaw; amp = Sv.moving; }
    const s = T * Math.PI * 2 * 0.8, sn = Math.sin(s), cs = Math.cos(s), br = Math.sin(T * 1.4);
    fL.position.z = 0.075 * sn * amp; fL.position.y = 0.028 * Math.max(0, cs) * amp;
    fR.position.z = -0.075 * sn * amp; fR.position.y = 0.028 * Math.max(0, -cs) * amp;
    mv.position.y = 0.012 * Math.abs(sn) * amp;
    body.rotation.z = 0.025 * sn * amp; body.scale.y = 1 + 0.006 * br;
    aR.rotation.x = rR[0] - 0.16 * sn * amp + 0.015 * br; aL.rotation.x = rL[0] + 0.12 * sn * amp;
    hd.rotation.y = (1 - amp) * 0.4 * Math.sin(T * 0.21) * Math.sin(T * 0.13 + 1);
    hd.rotation.x = B.hx + 0.05 * Math.sin(T * 0.5) + 0.03 * sn * amp;
    hd.position.y = B.hp[1] + 0.006 * br;
  });
}

// ───────────────────────── Cocinero ─────────────────────────
export function cook(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, PAL.cook.length, [WHITE, PAT.asanoha]);
  const sk = SK.man, rR: V3 = [-0.95, 0.15, -0.1], rL: V3 = [-0.75, -0.1, 0.14], withWok = o.withWok !== false;
  const top = [[0.205, 0.8], [0.212, 0.84], [0.198, 0.98], [0.192, 1.12], [0.192, 1.22], [0.162, 1.29], [0.09, 1.34], [0.046, 1.36]];
  const B = built(C, 'cook' + v.key, () => {
    const pal = PAL.cook[v.pi], body = new Part(), zs = 0.86;
    kimono(body, { prof: top, color: pal.top, cell: v.cell, zs, neckY: sk.nk, crossY: 1.08 });
    for (const s of [-1, 1]) body.add(sweep([[s * 0.095, 0.88, 0], [s * 0.1, 0.48, 0.01], [s * 0.092, 0.1, 0]], [0.105, 0.088, 0.07], 8, { rings: 6 }), pal.pants);
    for (const s of [-1, 1]) foot(body, s * 0.095, 0.05, { tabi: 0x2a2a30, sole: 0x3a3634, strap: 0x2a2a30 });
    // delantal (maekake) con emblema propio
    const ar = (y: number) => prof(top)(Math.max(0.84, y)) + 0.02;
    body.add(lathe([[ar(0.97), 0.975], [0.226, 0.9], [0.226, 0.7], [0.218, 0.5], [0.212, 0.36]], 10, -1.1, 2.2), pal.apron, { s: [1, 1, zs] });
    body.add(lathe([[ar(0.96), 0.95], [ar(0.96) + 0.004, 0.97], [ar(0.98), 0.99]], 16), pal.apron, { s: [1, 1, zs] });
    const az = 0.226 * zs + 0.004;
    body.add(new THREE.CircleGeometry(0.07, 16), 0xf2eee4, { p: [0, 0.68, az] });
    body.add(new THREE.CircleGeometry(0.052, 16), pal.apron, { p: [0, 0.68, az + 0.002] });
    body.add(box(0.06, 0.012, 0.002), 0xf2eee4, { p: [0, 0.68, az + 0.004] });
    body.add(box(0.012, 0.07, 0.002), 0xf2eee4, { p: [0.012, 0.675, az + 0.004], r: [0, 0, 0.3] });
    body.add(box(0.07, 0.05, 0.03), pal.apron, { p: [0.0, 0.97, -0.2] });
    const hd = new Part(), r = sk.hr;
    head(hd, 5, r);
    hair(hd, r, pal.hair, { top: 0.3, back: 0.56, spikes: 9, seed: 3 });
    hd.add(new THREE.TorusGeometry(r * 1.09, 0.017, 5, 18), pal.band, { p: [0, r * 0.36, -0.005], r: [Math.PI / 2 + 0.14, 0, 0] });
    const kp = sph(r, r * 1.12, Math.PI / 2 + 0.55, Math.PI * 0.36);
    hd.add(ball(0.024, 6, 5), pal.band, { p: kp });
    for (const a of [-0.5, 0.35]) hd.add(box(0.028, 0.075, 0.008), pal.band, { p: add3(kp, [0.012 * Math.sign(a), 0.035, 0.01]), r: [0, 0.9, a] });
    const qR = qe(rR), qL = qe(rL), skin = SKIN(5), aR = new Part(), aL = new Part();
    const A = arm(aR, { q: qR, elbow: 0.95, up: sk.up, fo: sk.fo, skin, cloth: pal.top, cell: v.cell, sleeve: 'short', r: 0.045 });
    const AL = arm(aL, { q: qL, elbow: 1.25, up: sk.up, fo: sk.fo, skin, cloth: pal.top, cell: v.cell, sleeve: 'short', r: 0.045 });
    // cucharón (otama) en la izquierda, alineado con el mundo
    const lad = new Part();
    lad.add(sweep([[0, 0.05, -0.04], [0.0, -0.02, 0.1], [0.0, -0.08, 0.26]], [0.008], 5, { rings: 6 }), 0x6a4a2a);
    lad.add(lathe([[0.001, -0.03], [0.03, -0.025], [0.042, 0.0], [0.04, 0.005]], 10), 0x8a8a90, { p: [0, -0.08, 0.28] });
    aL.merge(lad, AL.H, eul(inv(qL)));
    // wok y comida (en el marco del mundo, colgando de la mano)
    const wok = new Part(), food = new Part(), c: V3 = [0.13, -0.02, 0.27];
    const rim = add3(c, [-c[0], 0, -c[2]], 0.19 / Math.hypot(c[0], c[2]));
    wok.add(lathe([[0.001, -0.075], [0.09, -0.065], [0.155, -0.038], [0.19, 0.0], [0.198, 0.006]], 16), 0x2c2a2e, { p: c });
    wok.add(sweep([rim, [0, 0.008, 0], [-0.03, 0.012, -0.07]], [0.012, 0.015, 0.016], 6, { rings: 6 }), 0x2c2a2e);
    wok.add(sweep([[0.0, 0.008, 0.02], [-0.03, 0.013, -0.075]], [0.018], 6, { rings: 2 }), 0x5a3a22);
    const cols = [0x5aa040, 0xe07a30, 0xf0e6c8, 0x8a5a30, 0x6ab048, 0xe8c050];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.03 + (i % 3) * 0.03; food.add(ball(0.022 + (i % 2) * 0.008, 6, 4), cols[i % cols.length], { p: [Math.cos(a) * d, 0, Math.sin(a) * d], s: [1, 0.6, 1.2] }); }
    return { g: { body: body.geo(), head: hd.geo(), aL: aL.geo(), aR: aR.geo(), wok: wok.geo(), food: food.geo() }, H: A.H, qi: inv(qR), c };
  });
  const { root, mv } = rig('cook', v.h);
  const body = mesh(C, B.g.body, 'body'), hd = place(mesh(C, B.g.head, 'head'), [0, sk.hd, 0], [0.28, -0.12, 0]);
  const aR = place(mesh(C, B.g.aR, 'armR'), [-sk.shx - 0.01, sk.sh, 0], rR), aL = place(mesh(C, B.g.aL, 'armL'), [sk.shx + 0.01, sk.sh, 0], rL);
  mv.add(body, hd, aR, aL);
  const handR = new THREE.Object3D(); handR.name = 'handR'; handR.position.set(...B.H); handR.quaternion.copy(B.qi); aR.add(handR);
  root.userData.handR = handR;
  const wp = new THREE.Object3D(); handR.add(wp);
  let food: THREE.Mesh | null = null;
  if (withWok) { wp.add(mesh(C, B.g.wok, 'wok')); food = place(mesh(C, B.g.food, 'food', false), [B.c[0], B.c[1] - 0.04, B.c[2]]); wp.add(food); }
  return finish(C, root, o, (t) => {
    const T = t + v.ph, p = (T / 1.15) % 1;
    const back = bump(p, 0.0, 0.3), flick = bump(p, 0.28, 0.48);
    aR.rotation.x = rR[0] + 0.1 * back - 0.22 * flick; aR.rotation.z = rR[2] - 0.03 * flick;
    wp.rotation.x = 0.06 * back - 0.38 * flick; wp.position.z = -0.03 * back + 0.05 * flick;
    if (food) {
      const air = bump(p, 0.36, 0.86), k = Math.min(1, Math.max(0, (p - 0.36) / 0.5));
      food.position.y = B.c[1] - 0.04 + 0.24 * air; food.position.z = B.c[2] + 0.06 * Math.sin(Math.PI * 2 * k) * 0.5;
      food.rotation.x = -k * Math.PI * 2; food.scale.y = 1 + 0.5 * air - 0.3 * bump(p, 0.86, 0.98);
    }
    const st = T * 3.2;
    aL.rotation.x = rL[0] + 0.07 * Math.sin(st); aL.rotation.z = rL[2] + 0.05 * Math.cos(st);
    body.rotation.x = 0.025 * flick; body.rotation.y = -0.03 * flick;
    hd.rotation.x = 0.28 + 0.06 * flick + 0.03 * Math.sin(T * 0.7); hd.rotation.y = -0.12 + 0.15 * Math.sin(T * 0.31) * Math.sin(T * 0.17);
  });
}

// ───────────────────────── Niño con molinillo ─────────────────────────
export function boy(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, PAL.boy.length, [PAT.asanoha, PAT.stripes, PAT.seigaiha]);
  const sk = SK.kid, rR: V3 = [-2.05, 0, -0.18], rL: V3 = [0.1, 0, 0.12], hip = 0.46;
  const B = built(C, 'boy' + v.key, () => {
    const col = PAL.boy[v.pi], body = new Part(), skin = SKIN(3);
    const top = [[0.152, 0.4], [0.158, 0.43], [0.145, 0.55], [0.138, 0.66], [0.14, 0.74], [0.116, 0.8], [0.064, 0.832], [0.038, 0.845]];
    kimono(body, { prof: top, color: col, cell: v.cell, zs: 0.85, neckY: 0.83, crossY: 0.6, under: shade(col, 0.6), collar: shade(col, 0.55) });
    for (const s of [-1, 1]) body.add(sweep([[s * 0.06, 0.58, 0.12], [s * 0.085, 0.555, 0.135], [s * 0.08, 0.52, 0.13]], [0.006], 4, { rings: 4 }), shade(col, 0.5));
    body.add(lathe([[0.125, 0.4], [0.14, 0.44], [0.12, 0.48]], 12), col, { cell: v.cell, s: [1, 1, 0.85] });
    const hd = new Part(), r = sk.hr;
    head(hd, 3, r);
    hair(hd, r, 0x2e2420, { top: 0.34, back: 0.58, spikes: 9, seed: 7 });
    body.merge(hd, [0, sk.hd, 0]);
    const legs = [-1, 1].map((s) => {
      const L = new Part();
      L.add(sweep([[0, 0.05, 0], [s * 0.005, -0.15, 0.01]], [0.072, 0.066], 7, { rings: 2 }), col, { cell: v.cell });
      L.add(sweep([[0, -0.12, 0], [0, -0.26, 0.012], [0, -0.42, -0.004]], [0.038, 0.035, 0.028], 6, { rings: 4 }), skin);
      L.add(ball(1, 7, 5), skin, { p: [0, -0.43, 0.035], s: [0.032, 0.026, 0.065] });
      L.add(box(0.07, 0.018, 0.155), 0xb89060, { p: [0, -0.452, 0.035] });
      L.add(sweep([[-0.03, -0.44, 0.03], [0, -0.415, 0.08], [0.03, -0.44, 0.03]], [0.006], 4, { rings: 5 }), 0x2a3a8a);
      return L.geo();
    });
    const qR = qe(rR), qL = qe(rL), aR = new Part(), aL = new Part();
    const A = arm(aR, { q: qR, elbow: 0.35, up: sk.up, fo: sk.fo, skin, cloth: col, cell: v.cell, sleeve: 'short', r: 0.03 });
    arm(aL, { q: qL, elbow: 1.3, up: sk.up, fo: sk.fo, skin, cloth: col, cell: v.cell, sleeve: 'short', r: 0.03 });
    const stick = new Part(); stick.add(cyl(0.005, 0.005, 0.3, 5), 0xd8c088, { p: [0, 0.13, 0] });
    aR.merge(stick, A.H, eul(inv(qR)));
    const bl = new Part(), bc = [0xe83a3a, 0xf6c83a, 0x3a7ae0, 0x48b86a];
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), R = (x: number, y: number, z: number) => [x * ca - y * sa, x * sa + y * ca, z];
      bl.add(tris([R(0, 0, 0), R(0.085, 0, 0), R(0.065, 0.065, 0.03), R(0, 0, 0), R(0.065, 0.065, 0.03), R(0.0, 0.05, 0.008)]), bc[k]);
    }
    bl.add(ball(0.012, 6, 4), 0xf4f0e8);
    return { g: { body: body.geo(), aL: aL.geo(), aR: aR.geo(), lL: legs[1], lR: legs[0], bl: bl.geo() }, top: add3(A.H, toLocal([0, 0, 0], qR, [0, 0.28, 0])), qi: inv(qR) };
  });
  const { root, mv } = rig('boy', v.h);
  const up = new THREE.Group(); mv.add(up);
  const body = mesh(C, B.g.body, 'body'), hd = new THREE.Object3D();
  const aR = place(mesh(C, B.g.aR, 'armR'), [-sk.shx, sk.sh, 0], rR), aL = place(mesh(C, B.g.aL, 'armL'), [sk.shx, sk.sh, 0], rL);
  const lL = place(mesh(C, B.g.lL, 'legL'), [0.062, hip, 0]), lR = place(mesh(C, B.g.lR, 'legR'), [-0.062, hip, 0]);
  const pin = new THREE.Object3D(); pin.position.set(...B.top); pin.quaternion.copy(B.qi); aR.add(pin);
  const bl = place(mesh(C, B.g.bl, 'pinwheel', false), [0, 0, 0.012]); pin.add(bl);
  up.add(body, hd, aR, aL); mv.add(lL, lR);
  const run = o.run !== false, Rr = o.radius ?? 1.5, sp = 1.9;
  return finish(C, root, o, (t, dt) => {
    const T = t + v.ph;
    if (run) {
      const a = T * sp / Rr; mv.position.set(Rr * Math.cos(a), 0, Rr * Math.sin(a)); mv.rotation.y = -a;
      const s = T * Math.PI * 2 * 2.6, sn = Math.sin(s);
      lL.rotation.x = -0.75 * sn; lR.rotation.x = 0.75 * sn;
      aL.rotation.x = rL[0] + 0.7 * sn; aR.rotation.x = rR[0] + 0.1 * Math.sin(2 * s);
      mv.position.y = 0.035 * Math.abs(Math.cos(s)); up.rotation.x = 0.14; up.rotation.z = 0.1; up.position.z = -0.03;
      hd.rotation.x = -0.12; hd.rotation.y = 0.25 + 0.05 * sn;
      bl.rotation.z -= dt * 16;
    } else {
      hd.rotation.y = 0.3 * Math.sin(T * 0.4); hd.rotation.x = -0.1; aR.rotation.x = rR[0] + 0.05 * Math.sin(T * 1.1);
      bl.rotation.z -= dt * (3 + 2 * Math.sin(T * 0.7));
    }
  });
}

// ───────────────────────── Niña con máscara de zorro ─────────────────────────
export function girl(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, PAL.girl.length, [PAT.flowers]);
  const sk = SK.kid, rR: V3 = [-0.55, 0, -0.1], rL: V3 = [-0.3, 0, 0.12];
  const B = built(C, 'girl' + v.key, () => {
    const pal = PAL.girl[v.pi], body = new Part(), skin = SKIN(4);
    kimono(body, { prof: PROF.kidLong, color: pal.yuk, cell: PAT.flowers, zs: 0.85, neckY: 0.83, crossY: 0.64, collar: shade(pal.obi, 0.8), under: 0xf6f2ea });
    obi(body, { prof: PROF.kidLong, zs: 0.85, y0: 0.52, y1: 0.62, color: pal.obi, knot: 'heko', knotColor: shade(pal.obi, 1.15) });
    for (const s of [-1, 1]) foot(body, s * 0.06, 0.04, { geta: true, sole: 0xb08858, strap: 0xc82828, bare: skin });
    const hd = new Part(), r = sk.hr;
    head(hd, 4, r);
    hair(hd, r, 0x2a1c1c, { top: 0.34, back: 0.7, bangs: 0.36, bangW: 0.72 });
    hd.add(ball(0.022, 6, 5), 0xf07a98, { p: sph(r, r * 1.08, Math.PI * 0.1, Math.PI * 0.38) });
    hd.add(ball(0.016, 6, 5), 0xf6d0dc, { p: sph(r, r * 1.08, Math.PI * 0.02, Math.PI * 0.42) });
    // máscara de zorro ladeada sobre la sien izquierda
    const M = new Part();
    M.add(new THREE.SphereGeometry(0.085, 9, 7, Math.PI / 2 - 0.75, 1.5, Math.PI * 0.25, Math.PI * 0.55), 0xffffff, { cell: small(12) });
    M.add(ball(1, 7, 5), 0xfbf7ee, { p: [0, -0.005, 0.085], s: [0.026, 0.02, 0.035] });
    M.add(ball(0.008, 4, 3), 0x1a1414, { p: [0, 0.002, 0.118] });
    for (const s of [-1, 1]) { M.add(cyl(0, 0.026, 0.06, 4), 0xfbf7ee, { p: [s * 0.04, 0.075, 0.035], r: [0.2, 0, -s * 0.35] }); M.add(cyl(0, 0.014, 0.04, 4), 0xc8281e, { p: [s * 0.04, 0.07, 0.045], r: [0.2, 0, -s * 0.35] }); }
    const mp = sph(r, r * 1.02, Math.PI - 0.35, Math.PI * 0.34), n = new THREE.Vector3(...mp).normalize();
    const mq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n).multiply(qe([0, 0, 0.55]));
    hd.merge(M, add3(mp, [n.x, n.y, n.z], -0.05), eul(mq));
    hd.add(new THREE.TorusGeometry(r * 1.07, 0.004, 3, 18), 0xc8281e, { p: [0, r * 0.1, 0], r: [Math.PI / 2 - 0.25, 0, 0.3] });
    const qR = qe(rR), qL = qe(rL), aR = new Part(), aL = new Part();
    const sl = { up: sk.up, fo: sk.fo, skin, cloth: pal.yuk, cell: PAT.flowers, sleeve: 'kimono' as const, width: 0.2, drop: 0.2, thick: 0.07, r: 0.03 };
    const A = arm(aR, { q: qR, elbow: 1.0, ...sl });
    arm(aL, { q: qL, elbow: 1.45, ...sl });
    const bal = new Part(), bcol = [0xe8404a, 0x3a78e0, 0xf0c030, 0x40b080][v.pi];
    bal.add(cyl(0.003, 0.003, 0.22, 4), 0xf4f0e0, { p: [0, -0.11, 0] });
    bal.add(ball(0.052, 10, 7), bcol, { cell: PAT.stripes, p: [0, -0.27, 0], s: [1, 0.95, 1] });
    return { g: { body: body.geo(), head: hd.geo(), aL: aL.geo(), aR: aR.geo(), bal: bal.geo() }, H: A.H, qi: inv(qR) };
  });
  const { root, mv } = rig('girl', v.h);
  const body = mesh(C, B.g.body, 'body'), hd = place(mesh(C, B.g.head, 'head'), [0, sk.hd, 0]);
  const aR = place(mesh(C, B.g.aR, 'armR'), [-sk.shx, sk.sh, 0], rR), aL = place(mesh(C, B.g.aL, 'armL'), [sk.shx, sk.sh, 0], rL);
  const bp = new THREE.Object3D(); bp.position.set(...B.H); bp.quaternion.copy(B.qi); aR.add(bp);
  const bal = mesh(C, B.g.bal, 'yoyo'); bp.add(bal);
  mv.add(body, hd, aR, aL);
  return finish(C, root, o, (t) => {
    const T = t + v.ph, w = T * Math.PI * 2 * 1.3, s = Math.sin(w);
    aR.rotation.x = rR[0] + 0.14 * s;
    bal.scale.y = 1 + 0.32 * Math.sin(w - 1.3); bal.rotation.z = 0.06 * Math.sin(w * 0.5); bal.rotation.x = 0.1 * Math.sin(w - 1.3);
    mv.rotation.z = 0.035 * Math.sin(w * 0.25); mv.position.y = 0.012 * Math.max(0, Math.sin(w * 0.5));
    hd.rotation.x = 0.22 + 0.06 * Math.sin(w - 1.2); hd.rotation.z = 0.12 * Math.sin(T * 0.6); hd.rotation.y = -0.2 + 0.15 * Math.sin(T * 0.37);
    aL.rotation.z = rL[2] + 0.04 * Math.sin(w * 0.5);
  });
}

// ───────────────────────── Dama de la sombrilla ─────────────────────────
export function lady(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, PAL.lady.length, KIMS);
  const sk = SK.woman, rR: V3 = [-0.95, 0.2, -0.05], rL: V3 = [-0.45, 0, 0.18];
  const B = built(C, 'lady' + v.key, () => {
    const pal = PAL.lady[v.pi], body = new Part(), skin = SKIN(6);
    kimono(body, { prof: PROF.woman, color: pal.kim, cell: v.cell, zs: 0.78, neckY: sk.nk, crossY: 1.12, collar: shade(pal.kim, 0.7) });
    obi(body, { prof: PROF.woman, zs: 0.78, y0: 0.93, y1: 1.17, color: pal.obi, cell: PAT.seigaiha, cord: pal.cord, age: pal.age, knot: 'taiko' });
    const hd = new Part(), r = sk.hr, hc = 0x1c1416;
    head(hd, 6, r);
    hair(hd, r, hc, { top: 0.36, back: 0.6, bangs: 0.2, bangW: 0.55 });
    hd.add(ball(r * 0.52, 8, 6), hc, { p: [0, r * 0.8, -r * 0.62], s: [1.3, 0.8, 0.95] });
    hd.add(ball(r * 0.36, 7, 5), hc, { p: [0, r * 1.2, -r * 0.35], s: [1.2, 0.75, 1] });
    for (const s of [-1, 1]) hd.add(ball(r * 0.42, 8, 6), hc, { p: [s * r * 0.78, -r * 0.1, -r * 0.55], s: [0.6, 0.9, 1.1] });
    hd.add(sweep([[-r * 0.9, r * 0.95, -r * 0.6], [r * 0.95, r * 1.05, -r * 0.5]], [0.004], 4, { rings: 2 }), 0xd8b050);
    for (let k = 0; k < 5; k++) { const a = k * 1.2566; hd.add(ball(0.011, 5, 4), 0xf07a98, { p: [r * 0.98 + Math.cos(a) * 0.014, r * 1.05 + Math.sin(a) * 0.014, -r * 0.48] }); }
    for (const dz of [0, 0.012]) hd.add(box(0.005, 0.05, 0.005), 0xd8b050, { p: [r * 1.0, r * 0.85, -r * 0.5 + dz] });
    const qR = qe(rR), qL = qe(rL), aR = new Part(), aL = new Part();
    const sl = { up: sk.up, fo: sk.fo, skin, cloth: pal.kim, cell: v.cell, sleeve: 'kimono' as const, width: 0.27, drop: 0.38, thick: 0.08, r: 0.036 };
    const A = arm(aR, { q: qR, elbow: 1.35, ...sl });
    arm(aL, { q: qL, elbow: 1.25, ...sl });
    // wagasa con anillo janome
    const U = new Part(), d: V3 = [-0.12, 1, -0.3], dl = len3(d), dn: V3 = [d[0] / dl, d[1] / dl, d[2] / dl], top = add3([0, 0, 0], dn, 0.82), ro = orient(dn);
    U.add(sweep([add3([0, 0, 0], dn, -0.12), top], [0.007], 5, { rings: 2 }), 0x8a6a40);
    U.add(sweep([add3([0, 0, 0], dn, -0.12), add3([0, 0, 0], dn, 0.05)], [0.011], 6, { rings: 2 }), 0x3a2a22);
    const seg = (a: number[][], c: number) => U.add(lathe(a, 16), c, { cell: PAT.stripes, p: top, r: ro });
    seg([[0.001, 0.025], [0.04, 0.0], [0.16, -0.05], [0.28, -0.1]], pal.kasa);
    seg([[0.28, -0.1], [0.37, -0.15]], 0xf4efe4);
    seg([[0.37, -0.15], [0.5, -0.225], [0.506, -0.24]], pal.kasa);
    U.add(lathe([[0.012, -0.04], [0.07, -0.2], [0.012, -0.22]], 12), 0xb08a50, { p: top, r: ro });
    aR.merge(U, A.H, eul(inv(qR)));
    const fL = new Part(), fR = new Part(), ft = { tabi: 0xf4f2ec, sole: 0xd8c8b0, strap: pal.cord };
    foot(fL, 0.06, 0.05, ft); foot(fR, -0.06, 0.05, ft);
    const g = { body: body.geo(), head: hd.geo(), aL: aL.geo(), aR: aR.geo(), fL: fL.geo(), fR: fR.geo() };
    return { g, bodyF: mergeGeometries([g.body, g.fL, g.fR]) };
  });
  const { root, mv } = rig('lady', v.h);
  const L = o.walk ?? 0;
  const body = mesh(C, L > 0 ? B.g.body : B.bodyF, 'body'), hd = place(mesh(C, B.g.head, 'head'), [0, sk.hd, 0], [0.08, 0, 0.06]);
  const aR = place(mesh(C, B.g.aR, 'armR'), [-sk.shx, sk.sh, 0], rR), aL = place(mesh(C, B.g.aL, 'armL'), [sk.shx, sk.sh, 0], rL);
  const fL: THREE.Object3D = L > 0 ? mesh(C, B.g.fL, 'footL') : new THREE.Object3D(), fR: THREE.Object3D = L > 0 ? mesh(C, B.g.fR, 'footR') : new THREE.Object3D();
  mv.add(body, hd, aR, aL); if (L > 0) mv.add(fL, fR);
  return finish(C, root, o, (t) => {
    const T = t + v.ph; let amp = 0;
    if (L > 0) { pace(T, L, 0.24, Sv); mv.position.z = Sv.z; mv.rotation.y = Sv.yaw; amp = Sv.moving; }
    const s = T * Math.PI * 2 * 1.45, sn = Math.sin(s), cs = Math.cos(s), br = Math.sin(T * 1.2);
    fL.position.z = 0.04 * sn * amp; fL.position.y = 0.012 * Math.max(0, cs) * amp;
    fR.position.z = -0.04 * sn * amp; fR.position.y = 0.012 * Math.max(0, -cs) * amp;
    mv.position.y = 0.006 * Math.abs(sn) * amp;
    body.rotation.y = 0.04 * sn * amp; body.rotation.z = 0.012 * sn * amp + 0.008 * br * (1 - amp);
    aR.rotation.x = rR[0] + 0.03 * Math.sin(T * 0.9) + 0.03 * Math.abs(sn) * amp; aR.rotation.y = rR[1] + 0.06 * Math.sin(T * 0.45);
    aL.rotation.x = rL[0] + 0.04 * sn * amp;
    hd.rotation.y = (1 - amp) * 0.3 * Math.sin(T * 0.27); hd.rotation.z = 0.06 + 0.03 * Math.sin(T * 0.5); hd.rotation.x = 0.08 + 0.02 * br;
  });
}

// ───────────────────────── Anciana sentada con uchiwa ─────────────────────────
export function oldLady(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, PAL.oldlady.length, [PAT.asanoha, PAT.stripes, PAT.seigaiha]);
  const rR: V3 = [-0.75, 0, -0.25], rL: V3 = [-0.6, 0, 0.12], Y0 = 0.62, K = 0.3, bench = o.bench !== false;
  const tp = [[0.16, 0.42], [0.175, 0.46], [0.165, 0.58], [0.152, 0.7], [0.155, 0.8], [0.15, 0.88], [0.13, 0.93], [0.075, 0.975], [0.042, 0.99]];
  const B = built(C, 'oldLady' + v.key + bench, () => {
    const pal = PAL.oldlady[v.pi], body = new Part(), skin = SKIN(2), zs = 0.8;
    kimono(body, { prof: tp, color: pal.kim, cell: v.cell, zs, neckY: 0.975, crossY: 0.78, edge: false });
    obi(body, { prof: tp, zs, y0: 0.62, y1: 0.72, color: pal.obi, knot: 'kaku' });
    body.bend(Y0, K);
    for (const s of [-1, 1]) {
      body.add(sweep([[s * 0.075, 0.47, -0.02], [s * 0.08, 0.475, 0.2], [s * 0.08, 0.46, 0.37]], [0.098, 0.088, 0.078], 8, { rings: 6 }), pal.kim, { cell: v.cell });
      body.add(sweep([[s * 0.078, 0.44, 0.38], [s * 0.078, 0.24, 0.4], [s * 0.08, 0.07, 0.41]], [0.075, 0.07, 0.078], 8, { rings: 6 }), pal.kim, { cell: v.cell });
      foot(body, s * 0.08, 0.45, { tabi: 0xeeeae2, sole: 0xb8a080, strap: 0x6a3030 });
    }
    body.add(box(0.3, 0.34, 0.06), pal.kim, { cell: v.cell, p: [0, 0.27, 0.44] });
    if (bench) {
      body.add(box(1.1, 0.05, 0.4), 0x7a4e2e, { p: [0.25, 0.395, -0.02] });
      body.add(box(1.12, 0.012, 0.42), 0xc0302a, { p: [0.25, 0.426, -0.02] });
      for (const x of [-0.25, 0.75]) for (const z of [-0.17, 0.13]) body.add(box(0.05, 0.37, 0.05), 0x6a4226, { p: [x, 0.185, z] });
    }
    const hd = new Part(), r = 0.108;
    head(hd, 2, r);
    hair(hd, r, 0xb8b2ac, { top: 0.36, back: 0.58 });
    hd.add(ball(r * 0.42, 8, 6), 0xb0aaa4, { p: [0, r * 0.65, -r * 0.85], s: [1.2, 0.9, 1] });
    hd.add(sweep([[-r * 0.5, r * 0.9, -r * 0.75], [r * 0.5, r * 0.95, -r * 0.7]], [0.004], 4, { rings: 2 }), 0x3a2a20);
    const shR = bendPt([-0.155, 0.92, 0], Y0, K), shL = bendPt([0.155, 0.92, 0], Y0, K), qR = qe(rR), qL = qe(rL);
    const aR = new Part(), aL = new Part();
    const sl = { up: 0.24, fo: 0.21, skin, cloth: pal.kim, cell: v.cell, sleeve: 'kimono' as const, width: 0.25, drop: 0.24, thick: 0.08, r: 0.034 };
    const A = arm(aR, { q: qR, elbow: 1.75, ...sl });
    arm(aL, { q: qL, elbow: 0.85, ...sl });
    const fan = new Part();
    fan.add(sweep([[0, -0.04, 0], [0, 0.1, 0]], [0.006], 5, { rings: 2 }), 0xc8a870);
    fan.add(new THREE.CircleGeometry(0.115, 16), 0xffffff, { cell: small(14), p: [0, 0.2, 0], r: [0, -0.3, 0] });
    fan.add(new THREE.TorusGeometry(0.115, 0.005, 3, 18), 0xc8a870, { p: [0, 0.2, 0], r: [0, -0.3, 0] });
    return { g: { body: body.geo(), head: hd.geo(), aL: aL.geo(), aR: aR.geo(), fan: fan.geo() }, H: A.H, qi: inv(qR), shR, shL, hp: bendPt([0, 1.165, 0.0], Y0, K) };
  });
  const { root, mv } = rig('oldLady', v.h);
  const body = mesh(C, B.g.body, 'body'), hd = place(mesh(C, B.g.head, 'head'), B.hp, [0.0, 0, 0]);
  const aR = place(mesh(C, B.g.aR, 'armR'), B.shR, rR), aL = place(mesh(C, B.g.aL, 'armL'), B.shL, rL);
  const fp = new THREE.Object3D(); fp.position.set(...B.H); fp.quaternion.copy(B.qi); aR.add(fp);
  const fan = place(mesh(C, B.g.fan, 'uchiwa'), [0, 0, 0], [0, 0.4, 0.15]); fp.add(fan);
  mv.add(body, hd, aR, aL);
  return finish(C, root, o, (t) => {
    const T = t + v.ph, p = T * Math.PI * 2 * 1.3, s = Math.sin(p), br = Math.sin(T * 1.1);
    const nod = smooth(0.7, 1, Math.sin(T * 0.11)) * 0.25;
    fan.rotation.y = 0.4 + 0.55 * s * Math.abs(s); fan.rotation.z = 0.15 + 0.12 * Math.cos(p);
    aR.rotation.z = rR[2] + 0.06 * s; aR.rotation.x = rR[0] + 0.03 * Math.cos(p);
    body.scale.y = 1 + 0.006 * br;
    hd.rotation.x = 0.05 + nod + 0.02 * br; hd.rotation.y = -0.25 + 0.35 * Math.sin(T * 0.17); hd.rotation.z = 0.04 * Math.sin(T * 0.23);
    aL.rotation.x = rL[0] + 0.01 * br;
  });
}

// ───────────────────────── Monje barrendero ─────────────────────────
export function monk(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, PAL.monk.length, [PAT.stripes]);
  const sk = SK.man, P0: V3 = [-0.04, 0.95, 0.26], G: V3 = [-0.4, 0.07, 0.92];
  const shL: V3 = [sk.shx, sk.sh, 0], shR: V3 = [-sk.shx, sk.sh, 0];
  const dd = sub3(G, P0), dl = len3(dd), d: V3 = [dd[0] / dl, dd[1] / dl, dd[2] / dl];
  const gL = add3(P0, d, -0.2), gR = add3(P0, d, 0.08);
  const B = built(C, 'monk' + v.key, () => {
    const pal = PAL.monk[v.pi], body = new Part(), skin = SKIN(7), zs = 0.8, R = prof(PROF.man);
    kimono(body, { prof: PROF.man, color: pal.robe, zs, neckY: sk.nk, crossY: 1.03, collar: shade(pal.robe, 1.6) });
    obi(body, { prof: PROF.man, y0: 0.9, y1: 0.95, color: shade(pal.robe, 0.75), knot: 'none' });
    const rz = R(1.02) * zs + 0.012;
    body.add(box(0.2, 0.17, 0.012), pal.kesa, { cell: PAT.stripes, p: [0.0, 1.02, rz], r: [-0.1, 0, 0] });
    body.add(box(0.21, 0.02, 0.016), shade(pal.kesa, 0.7), { p: [0.0, 1.105, rz - 0.005], r: [-0.1, 0, 0] });
    for (const s of [-1, 1]) body.add(sweep([[s * 0.09, 1.1, rz - 0.004], [s * 0.1, 1.25, 0.12], [s * 0.075, sk.nk + 0.01, -0.02]], [0.008], 4, { rings: 8 }), shade(pal.kesa, 0.7));
    body.add(new THREE.TorusGeometry(0.018, 0.005, 4, 10), 0xe8e0c8, { p: [0.095, 1.17, rz + 0.01] });
    for (const s of [-1, 1]) foot(body, s * 0.085, 0.07, { tabi: 0xf0ece4, sole: 0xc8b08a, strap: 0x2a2620 });
    const hd = new Part(), r = sk.hr;
    head(hd, 7, r);
    hd.add(new THREE.SphereGeometry(r * 1.008, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), shade(skin, 0.86), { warp: (vv) => { vv.y *= 1.06; } });
    const aimL = aim(sub3(gL, shL), sk.up, sk.fo), aimR = aim(sub3(gR, shR), sk.up, sk.fo);
    const aR = new Part(), aL = new Part(), sl = { up: sk.up, fo: sk.fo, skin, cloth: pal.robe, sleeve: 'kimono' as const, width: 0.3, drop: 0.36, thick: 0.1 };
    arm(aR, { q: aimR.q, elbow: aimR.elbow, ...sl }); arm(aL, { q: aimL.q, elbow: aimL.elbow, ...sl });
    const br = new Part(), T0 = add3(P0, d, -0.4), Gb = add3(G, d, -0.16), ro = orient(d);
    br.add(sweep([sub3(T0, P0), sub3(Gb, P0)], [0.015], 6, { rings: 2 }), 0xc8b070);
    for (let k = 1; k < 5; k++) br.add(cyl(0.018, 0.018, 0.012, 6), 0xa89050, { p: sub3(mix3(T0, Gb, k / 5), P0), r: ro });
    br.add(cyl(0.14, 0.025, 0.36, 9, true), 0xa88a50, { p: sub3(add3(G, d, -0.02), P0), r: ro, s: [1, 1, 0.38] });
    br.add(cyl(0.032, 0.03, 0.04, 7), 0x4a3a2a, { p: sub3(add3(G, d, -0.19), P0), r: ro });
    for (let k = -3; k <= 3; k++) { const side: V3 = [Math.cos(0.35) * k * 0.04, 0, Math.sin(0.35) * k * 0.04 - 0.0]; br.add(sweep([sub3(add3(G, d, -0.15), P0), sub3(add3(add3(G, d, 0.06), side, 1), P0)], [0.004, 0.002], 3, { rings: 2 }), 0x8a6a3a); }
    return { g: { body: body.geo(), head: hd.geo(), aL: aL.geo(), aR: aR.geo(), br: br.geo() }, qL: aimL.q, qR: aimR.q, HL: aimL.Hn, HR: aimR.Hn };
  });
  const { root, mv } = rig('monk', v.h);
  const body = mesh(C, B.g.body, 'body'), hd = place(mesh(C, B.g.head, 'head'), [0, sk.hd, 0.02], [0.3, 0, 0]);
  const aR = place(mesh(C, B.g.aR, 'armR'), shR), aL = place(mesh(C, B.g.aL, 'armL'), shL);
  aR.quaternion.copy(B.qR); aL.quaternion.copy(B.qL);
  const brm = place(mesh(C, B.g.br, 'broom'), P0);
  mv.add(body, hd, aR, aL, brm);
  const g = new THREE.Vector3(), sh = new THREE.Vector3(), gl: V3 = sub3(gL, P0), gr: V3 = sub3(gR, P0);
  const track = (a: THREE.Mesh, base: V3, grip: V3, Hn: THREE.Vector3, tw: number) => {
    g.set(grip[0], grip[1], grip[2]).applyQuaternion(brm.quaternion).add(brm.position);
    const c = Math.cos(tw), s = Math.sin(tw);
    sh.set(base[0] * c + base[2] * s, base[1], -base[0] * s + base[2] * c);
    a.position.copy(sh); a.quaternion.setFromUnitVectors(Hn, g.sub(sh).normalize());
  };
  return finish(C, root, o, (t) => {
    const T = t + v.ph, p = T * Math.PI * 2 * 0.55, s = Math.sin(p), c = Math.cos(p);
    brm.rotation.set(-0.06 * Math.max(0, c), 0.45 * s, 0.05 * s);
    brm.position.set(P0[0] + 0.04 * s, P0[1], P0[2]);
    const tw = 0.13 * s;
    body.rotation.y = tw; body.rotation.z = -0.015 * s;
    track(aL, shL, gl, B.HL, tw); track(aR, shR, gr, B.HR, tw);
    hd.rotation.y = tw * 0.4 - 0.08; hd.rotation.x = 0.3 + 0.03 * c;
  });
}

// ───────────────────────── Pareja tomando té en seiza ─────────────────────────
function seizaPerson(woman: boolean, kc: number, cell: any, oc: number) {
  const f = woman ? 0.94 : 1, sh = 0.665 * f + 0.02, hdY = 0.9 * f + 0.03, shx = woman ? 0.15 : 0.17, face = woman ? 11 : 10, skin = SKIN(face);
  const tp = (woman
    ? [[0.185, 0.19], [0.19, 0.24], [0.168, 0.38], [0.155, 0.48], [0.158, 0.57], [0.14, 0.63], [0.08, 0.675], [0.042, 0.688]]
    : [[0.2, 0.2], [0.21, 0.25], [0.185, 0.4], [0.172, 0.5], [0.178, 0.6], [0.155, 0.67], [0.09, 0.72], [0.045, 0.735]]).map((p) => [p[0], p[1] + 0.02]);
  const body = new Part(), zs = 0.8, nk = tp[tp.length - 2][1];
  kimono(body, { prof: tp, color: kc, cell, zs, neckY: nk, crossY: woman ? 0.6 : 0.52, edge: false });
  obi(body, { prof: tp, zs, y0: woman ? 0.42 : 0.43, y1: woman ? 0.6 : 0.5, color: oc, cell: woman ? PAT.seigaiha : undefined, knot: woman ? 'taiko' : 'kaku', cord: woman ? 0xc84a5a : undefined });
  body.add(ball(1, 10, 6), kc, { cell, p: [0, 0.12, 0.1], s: [0.21, 0.13, 0.28] });
  for (const s of [-1, 1]) body.add(ball(1, 7, 5), 0xf2efe8, { p: [s * 0.055, 0.045, -0.17], s: [0.042, 0.032, 0.085] });
  const hd = new Part(), r = woman ? 0.106 : 0.112;
  head(hd, face, r);
  if (woman) {
    hair(hd, r, 0x241a1a, { top: 0.36, back: 0.62, bangs: 0.18, bangW: 0.6 });
    hd.add(ball(r * 0.45, 9, 6), 0x241a1a, { p: [0, r * 0.25, -r * 1.0], s: [1.25, 0.9, 0.9] });
    hd.add(sweep([[-r * 0.6, r * 0.3, -r * 1.05], [r * 0.6, r * 0.32, -r * 1.0]], [0.004], 4, { rings: 2 }), 0x7a3a2a);
  } else hair(hd, r, 0x8e8a86, { top: 0.32, back: 0.58 });
  const shR: V3 = [-shx, sh, 0], shL: V3 = [shx, sh, 0];
  const mouth: V3 = [0, hdY - 0.065, 0.13], lap: V3 = [-0.05, sh - 0.3, 0.27];
  const am = aim(sub3(mouth, shR), 0.25, 0.22), qA = new THREE.Quaternion().setFromUnitVectors(am.Hn, new THREE.Vector3(...sub3(lap, shR)).normalize());
  const aL = aim(sub3([0.03, sh - 0.33, 0.24], shL), 0.25, 0.22);
  const aR = new Part(), aLp = new Part(), sl = { up: 0.25, fo: 0.22, skin, cloth: kc, cell, sleeve: 'kimono' as const, width: 0.26, drop: woman ? 0.32 : 0.26, thick: 0.08, r: 0.036 };
  const A = arm(aR, { q: qA, elbow: am.elbow, ...sl }); arm(aLp, { q: aL.q, elbow: aL.elbow, ...sl });
  const cup = new Part();
  cup.add(lathe([[0.001, 0], [0.028, 0.002], [0.034, 0.05], [0.036, 0.056]], 10), woman ? 0x9ab8a0 : 0xd8cbb4, { p: [0.0, -0.025, 0.03] });
  cup.add(new THREE.CircleGeometry(0.031, 10), 0x6a8a32, { p: [0, 0.02, 0.03], r: [-Math.PI / 2, 0, 0] });
  aR.merge(cup, A.H, eul(inv(qA)));
  return { g: { body: body.geo(), head: hd.geo(), aR: aR.geo(), aL: aLp.geo() }, hp: [0, hdY, 0] as V3, shR, shL, qA, qB: am.q, qL: aL.q };
}
export function teaCouple(C: Core, o: any = {}) {
  const v = variant(o.seed ?? 0, PAL.tea.length, KIMS);
  const B = built(C, 'tea' + v.key, () => {
    const pal = PAL.tea[v.pi], tray = new Part();
    tray.add(box(0.44, 0.03, 0.28), 0x1c1414, { p: [0, 0.015, 0] });
    tray.add(box(0.46, 0.012, 0.3), 0x8a2a22, { p: [0, 0.03, 0] });
    tray.add(ball(0.065, 10, 7), 0x8a4a2a, { p: [-0.07, 0.085, 0], s: [1, 0.78, 1] });
    tray.add(ball(0.03, 7, 4), 0x7a4024, { p: [-0.07, 0.13, 0], s: [1, 0.5, 1] });
    tray.add(cyl(0.008, 0.014, 0.07, 6), 0x8a4a2a, { p: [-0.07, 0.095, 0.075], r: [1.0, 0, 0] });
    tray.add(cyl(0.012, 0.012, 0.09, 6), 0x5a3a22, { p: [-0.14, 0.09, -0.04], r: [0, 0.6, Math.PI / 2] });
    tray.add(lathe([[0.001, 0], [0.026, 0.002], [0.032, 0.046], [0.034, 0.052]], 10), 0xd8cbb4, { p: [0.1, 0.036, 0.02] });
    tray.add(ball(0.03, 7, 5), 0xe8d0a0, { p: [0.11, 0.05, -0.07], s: [1, 0.4, 1] });
    return { m: seizaPerson(false, pal.man, WHITE, 0x2a2420), w: seizaPerson(true, pal.woman, v.cell, pal.wobi), tray: tray.geo() };
  });
  const { root, mv } = rig('teaCouple', v.h);
  const people = [[B.m, -0.4, 0.42], [B.w, 0.4, -0.42]].map(([P, x, ry]: any, i) => {
    const g = place(new THREE.Group(), [x, 0, 0], [0, ry, 0]);
    const body = mesh(C, P.g.body, 'body'), hd = place(mesh(C, P.g.head, 'head'), P.hp);
    const aR = place(mesh(C, P.g.aR, 'armR'), P.shR), aL = place(mesh(C, P.g.aL, 'armL'), P.shL);
    aR.quaternion.copy(P.qA); aL.quaternion.copy(P.qL);
    g.add(body, hd, aR, aL); mv.add(g);
    return { P, hd, aR, body, ph: i * 4.1 };
  });
  mv.add(place(mesh(C, B.tray, 'tray'), [0, 0, 0.42]));
  return finish(C, root, o, (t) => {
    for (const q of people) {
      const T = t + v.ph + q.ph, u = T % 9;
      const w = smooth(0, 1.3, u) * (1 - smooth(2.6, 3.8, u));
      q.aR.quaternion.slerpQuaternions(q.P.qA, q.P.qB, w);
      q.hd.rotation.x = 0.1 - 0.2 * w + 0.03 * Math.sin(T * 0.8);
      q.hd.rotation.y = (q.P === B.m ? 0.35 : -0.35) * (1 - w) * (0.6 + 0.4 * Math.sin(T * 0.3));
      q.hd.rotation.z = 0.04 * Math.sin(T * 0.5);
      q.body.scale.y = 1 + 0.006 * Math.sin(T * 1.3);
    }
  });
}

export const PEOPLE = { elder, cook, boy, girl, lady, oldLady, monk, teaCouple };
