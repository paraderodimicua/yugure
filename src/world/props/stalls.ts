// Puestos y género: wok al aire libre, yatai, frutería, barriles de sake, terrazas, tablilla 営業中.
import * as THREE from 'three';
import { Builder, V, SZ, G, VC, stat, planeUV, polyline, vtext, htext, grain, vignette, MINCHO, GOTHIC, rng, cached, type Kit } from './kit';
import { norenTex } from './street';

type Make = (o?: any) => THREE.Group;

const bowlOut = () => cached('bowlOut', () => new THREE.LatheGeometry([[0.035, 0], [0.04, 0.008], [0.07, 0.04], [0.085, 0.07]].map(([a, b]) => new THREE.Vector2(a, b)), 8));
const bowlIn = () => cached('bowlIn', () => new THREE.LatheGeometry([[0.08, 0.07], [0.064, 0.042], [0.03, 0.014], [0.001, 0.012]].map(([a, b]) => new THREE.Vector2(a, b)), 8));
/** cono con caras invertidas (para ver el parasol por debajo) */
const coneIn = () => cached('coneIn', () => {
  const g = new THREE.ConeGeometry(1, 1, 16, 1, true).toNonIndexed();
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i < P.count; i += 3) for (const a of [P, N]) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i); a.setXYZ(i, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); }
  for (let i = 0; i < N.count; i++) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i));
  return g;
});

export function stallProps(K: Kit): Record<string, Make> {
  const M = K.mats;
  const steel = M.tint('metalPaint', '#b7bbc0');
  (K.flame as THREE.MeshBasicMaterial).color.setScalar(2.6);
  const pivotOf = (B: Builder, name: string) => B.finish(name, SZ);

  const bowl = (v: VC, x: number, y: number, z: number, s = 1, rim = '#2a4f9a') => {
    v.add(bowlOut(), '#f2efe8', x, y, z, s, [0, 0, 0], rim); v.add(bowlIn(), '#f6f4ee', x, y, z, s);
  };
  const bottle = (v: VC, x: number, y: number, z: number, c: string, h = 0.24, r = 0.032, cap = '#c9a43a') => {
    v.add(G.cyl(10), c, x, y + h * 0.36, z, [r, h * 0.72, r]);
    v.add(G.cyl(8), c, x, y + h * 0.8, z, [r * 0.4, h * 0.22, r * 0.4]);
    v.add(G.cyl(6), cap, x, y + h * 0.94, z, [r * 0.42, h * 0.07, r * 0.42]);
    v.add(G.cyl(10), '#efe6cc', x, y + h * 0.4, z, [r * 1.02, h * 0.25, r * 1.02]);
  };

  // ---------------- puesto de wok ----------------
  const menuTex = (items: string[]) => K.tex('menu|' + items.join(','), 256, 64, (g, w, h, r) => {
    g.fillStyle = '#2a1c14'; g.fillRect(0, 0, w, h);
    const n = items.length, cw = w / n;
    items.forEach((it, i) => {
      g.fillStyle = i % 3 === 2 ? '#e9c88a' : '#d8b98a'; g.fillRect(i * cw + 3, 2, cw - 6, h - 4);
      grain(g, w, h, r, 0.05);
      g.fillStyle = '#1a120c'; vtext(g, it, i * cw + cw / 2, h * 0.46, Math.min(16, (h - 12) / [...it].length), 1.3, MINCHO, '800');
      g.fillStyle = '#b02218'; g.font = `700 7px ${GOTHIC}`; g.textAlign = 'center'; g.fillText(String(400 + ((i * 137) % 5) * 100), i * cw + cw / 2, h - 5);
    });
  });
  const wok: Make = (o = {}) => {
    const B = new Builder(), v = new VC(), dk = M.metalDark, bx = -0.38, ty = 0.86;
    B.box(steel, 1.5, 0.04, 0.7, 0, ty, 0);
    B.box(steel, 1.5, 0.08, 0.015, 0, ty + 0.03, -0.345); // peto trasero
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(steel, 0.04, ty, 0.04, sx * 0.71, ty / 2, sz * 0.31);
    B.box(steel, 1.42, 0.02, 0.62, 0, 0.22, 0);
    B.box(steel, 1.46, 0.02, 0.02, 0, ty - 0.17, 0.33);
    const menu = K.print(menuTex(o.menu ?? ['焼きそば', '炒飯', '餃子', 'ラーメン', '酒', '茶'])); B.noShadow(menu);
    B.geo(menu, planeUV(1.4, 0.34, 1, 1), 0, ty - 0.2, 0.352);
    // hornillo de anillo, quemador y manguera hasta la bombona
    B.geo(dk, new THREE.CylinderGeometry(0.19, 0.22, 0.13, 14, 1, true), bx, ty + 0.085, 0);
    B.geo(dk, G.torus(3, 14, 0.08), bx, ty + 0.15, 0, 0, Math.PI / 2, 0, 0.19, 0.19, 0.19);
    for (let i = 0; i < 3; i++) { const a = i * 2.09; B.box(dk, 0.03, 0.05, 0.03, bx + Math.cos(a) * 0.17, ty + 0.17, Math.sin(a) * 0.17); }
    B.cyl(dk, 0.07, 0.04, bx, ty + 0.04, 0, 10);
    B.cyl(dk, 0.02, 0.06, bx + 0.08, ty - 0.03, 0.2, 8, 1, 0, 0, Math.PI / 2);
    const gx = 0.52, gz = -0.12;
    polyline(B, dk, 0.012, [V(bx, ty - 0.01, 0), V(bx + 0.1, 0.5, -0.1), V(0.2, 0.25, -0.3), V(gx - 0.05, 0.62, gz - 0.05)], 6);
    // bombona LP
    v.add(G.cyl(14), '#a2a8ae', gx, 0.3, gz, [0.16, 0.48, 0.16]);
    v.add(G.sph(14, 6), '#a2a8ae', gx, 0.54, gz, [0.16, 0.07, 0.16]);
    v.add(G.cyl(12), '#3a3d42', gx, 0.62, gz, [0.075, 0.1, 0.075]);
    v.add(G.cyl(8), '#c9a43a', gx, 0.62, gz, [0.022, 0.08, 0.022]);
    v.add(G.box(), '#d8b040', gx, 0.36, gz + 0.158, [0.12, 0.08, 0.004]);
    v.add(G.cyl(14), '#2c2f34', gx, 0.04, gz, [0.165, 0.08, 0.165]);
    // tabla de cortar, bandejas de ingredientes, cuencos, botellas
    v.add(G.box(), '#c79a62', 0.12, ty + 0.035, 0.05, [0.4, 0.03, 0.28]);
    for (let i = 0; i < 9; i++) v.add(G.cyl(5), '#4f9a3a', 0.02 + i * 0.012, ty + 0.06, 0.05, [0.006, 0.12, 0.006], [0, 0, Math.PI / 2]);
    v.add(G.box(), '#d8d8d2', 0.18, ty + 0.06, 0.1, [0.1, 0.02, 0.08], [0, 0.3, 0], '#f4efe6');
    for (const [x, c] of [[0.42, '#f1ead2'], [0.58, '#e48a8a'], [0.74, '#7ab84a']] as const) {
      v.add(G.box(), '#9aa0a6', x, ty + 0.045, -0.15, [0.14, 0.05, 0.2]);
      for (let k = 0; k < 7; k++) v.add(G.ico0(), c, x + ((k % 3) - 1) * 0.04, ty + 0.075, -0.15 + (Math.floor(k / 3) - 1) * 0.06, [0.03, 0.012, 0.025], [0, k, 0]);
    }
    for (let i = 0; i < 4; i++) bowl(v, 0.55, ty + 0.02 + i * 0.03, 0.17, 1, '#b8261c');
    for (let i = 0; i < 3; i++) bowl(v, 0.36, ty + 0.02 + i * 0.03, 0.2);
    for (let i = 0; i < 5; i++) bowl(v, -0.3 + (i % 3) * 0.19, 0.23, 0.1 + Math.floor(i / 3) * 0.18, 1, i % 2 ? '#2a4f9a' : '#b8261c');
    bottle(v, -0.06, ty + 0.02, -0.25, '#3a1a10'); bottle(v, 0.02, ty + 0.02, -0.26, '#d8a82a', 0.22, 0.03, '#d23a2a');
    bottle(v, 0.1, ty + 0.02, -0.27, '#2d5a32', 0.4, 0.045, '#d8d0b8');
    v.add(G.box(), '#a07a4a', 0.3, 0.38, -0.05, [0.5, 0.3, 0.4]);
    v.add(G.box(), '#8a6a3e', 0.3, 0.535, -0.05, [0.5, 0.012, 0.4]);
    const g = B.finish('wok', SZ); g.add(v.mesh(K.vcGloss));
    // wok + cucharón + comida (se mueve)
    const W = new Builder(), wf = new VC();
    const prof: THREE.Vector2[] = []; for (let i = 0; i <= 6; i++) { const a = (i / 6) * 1.2; prof.push(new THREE.Vector2(0.235 * Math.sin(a) / Math.sin(1.2) + 0.001, 0.13 * (1 - Math.cos(a)) / (1 - Math.cos(1.2)))); }
    W.geo(dk, new THREE.LatheGeometry(prof, 16));
    W.geo(dk, new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x * 0.97, p.y + 0.004)).reverse(), 16));
    W.geo(dk, G.torus(3, 16, 0.04), 0, 0.132, 0, 0, Math.PI / 2, 0, 0.236, 0.236, 0.236);
    W.rod(dk, 0.012, V(0.22, 0.12, 0), V(0.42, 0.17, 0.02), 6);
    W.rod(dk, 0.018, V(0.42, 0.17, 0.02), V(0.62, 0.21, 0.04), 8);
    W.geo(dk, G.torus(3, 8, 0.3), -0.24, 0.12, 0, Math.PI / 2, 0, 0, 0.03, 0.03, 0.03);
    W.geo(dk, G.sph(8, 4), -0.02, 0.06, 0.05, 0, 0, 0, 0.05, 0.03, 0.05);
    W.rod(dk, 0.008, V(-0.02, 0.07, 0.05), V(-0.12, 0.42, 0.3), 5);
    W.rod(dk, 0.014, V(-0.11, 0.39, 0.28), V(-0.14, 0.46, 0.34), 6);
    wf.add(G.ico1(), '#e2b04a', 0, 0.045, 0, [0.15, 0.03, 0.14], [0, 0, 0], '#f0cc70');
    for (let i = 0; i < 14; i++) { const a = i * 2.3, rr = 0.03 + (i % 5) * 0.022; wf.add(G.ico0(), ['#e8502a', '#3e9a3a', '#f4ecd8', '#c8743a'][i % 4], Math.cos(a) * rr, 0.07, Math.sin(a) * rr, 0.012, [i, i * 2, 0]); }
    const wk = pivotOf(W, 'wokpan'); wk.add(wf.mesh(K.vcGloss));
    wk.position.set(bx, ty + 0.17, 0); g.add(wk);
    // llama con cara de cobalto a naranja
    const fv = new VC();
    for (let i = 0; i < 10; i++) { const a = i * 0.628; fv.add(G.cone(6), '#2a3cff', Math.cos(a) * 0.065, 0.07, Math.sin(a) * 0.065, [0.03, 0.14, 0.03], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], '#ff6a10'); }
    fv.add(G.cone(7), '#ff9a30', 0, 0.09, 0, [0.06, 0.18, 0.06], [0, 0, 0], '#ff3800');
    const fl = fv.mesh(K.flame, false); fl.position.set(bx, ty + 0.04, 0); g.add(fl);
    const st = K.steam(bx, ty + 0.3, 0, 16, 0.12, 1.0, 0.36); g.add(st);
    K.anims.push((t) => {
      const c = (t % 2.4) / 2.4, toss = c > 0.62 && c < 0.86 ? Math.sin((c - 0.62) / 0.24 * Math.PI) : 0;
      wk.rotation.z = Math.sin(t * 7) * 0.03 - toss * 0.32; wk.position.y = ty + 0.17 + toss * 0.06; wk.position.x = bx - toss * 0.05;
      fl.scale.set(1 + Math.sin(t * 23) * 0.08, 0.8 + Math.sin(t * 17) * 0.15 + Math.sin(t * 31) * 0.1 + toss * 1.6, 1 + Math.cos(t * 19) * 0.08);
      fl.rotation.y = t * 2;
    });
    return stat(g, { w: 1.9, h: 1.4, d: 0.8 });
  };

  // ---------------- yatai ----------------
  const yatai: Make = (o = {}) => {
    const W = 1.9, D = 0.75, B = new Builder(), v = new VC(), ww = M.woodWarm, wd = M.woodDark, wr = M.woodWeathered;
    B.box(ww, W, 0.72, D, 0, 0.54, 0);
    for (let i = 0; i < 12; i++) B.box(wd, 0.03, 0.7, 0.012, -W / 2 + 0.08 + i * (W - 0.16) / 11, 0.54, D / 2 + 0.006);
    B.box(wd, W + 0.02, 0.05, D + 0.02, 0, 0.2, 0);
    B.box(ww, W + 0.1, 0.045, 0.32, 0, 0.93, D / 2 + 0.1);
    for (const sx of [-1, 1]) B.box(wd, 0.04, 0.12, 0.25, sx * (W / 2 - 0.1), 0.86, D / 2 + 0.12, 0, 0.6);
    B.box(ww, W, 0.03, D, 0, 0.9, 0);
    // ruedas de madera con radios
    for (const sx of [-1, 1]) {
      const wx = sx * (W / 2 + 0.06);
      B.geo(wd, G.torus(4, 18, 0.12), wx, 0.33, 0, Math.PI / 2, 0, 0, 0.32, 0.32, 0.32);
      for (let i = 0; i < 4; i++) B.box(wd, 0.03, 0.6, 0.025, wx, 0.33, 0, 0, i * Math.PI / 4);
      B.cyl(wd, 0.06, 0.12, wx, 0.33, 0, 10, 1, 0, 0, Math.PI / 2);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(wd, 0.06, 1.2, 0.06, sx * (W / 2 - 0.05), 1.5, sz * (D / 2 - 0.05));
    B.box(wd, W + 0.05, 0.06, 0.07, 0, 2.08, D / 2 - 0.05); B.box(wd, W + 0.05, 0.06, 0.07, 0, 2.08, -D / 2 + 0.05);
    for (const sz of [-1, 1]) B.box(wr, W + 0.45, 0.03, 0.62, 0, 2.21, sz * 0.27, 0, -sz * 0.36);
    B.box(wd, W + 0.47, 0.06, 0.06, 0, 2.33, 0);
    for (const sz of [-1, 1]) B.box(wd, W + 0.47, 0.08, 0.025, 0, 2.08, sz * 0.56);
    // mostrador interior: olla de oden con compartimentos
    const px = 0.3;
    B.box(steel, 0.62, 0.1, 0.36, px, 0.95, -0.05);
    for (let i = 1; i < 4; i++) B.box(steel, 0.008, 0.08, 0.34, px - 0.31 + i * 0.155, 0.97, -0.05);
    B.box(steel, 0.6, 0.008, 0.008, px, 0.97, -0.05);
    v.add(G.box(), '#8a5a2a', px, 0.995, -0.05, [0.6, 0.004, 0.34]);
    const oden = ['#f2e8c8', '#f6f0dc', '#8a8078', '#c88a4a', '#e8d8a8'];
    for (let i = 0; i < 16; i++) {
      const cx = px - 0.23 + (i % 4) * 0.155, cz = -0.12 + Math.floor(i / 4) * 0.045 - 0.02, c = oden[i % 5];
      if (c === '#f6f0dc') v.add(G.sph(8, 6), c, cx, 1.0, cz, [0.025, 0.02, 0.03]);
      else if (c === '#8a8078') v.add(G.cone(3), c, cx, 1.0, cz, [0.04, 0.02, 0.04], [Math.PI / 2, 0, 0]);
      else v.add(G.cyl(10), c, cx, 1.0, cz, [0.035, 0.022, 0.035]);
    }
    for (let i = 0; i < 3; i++) bottle(v, -0.55 + i * 0.1, 0.915, -0.25, ['#2d5a32', '#3a1a10', '#f2f2ee'][i], 0.34, 0.04, '#e8e2cc');
    for (let i = 0; i < 4; i++) bowl(v, -0.15, 0.92 + i * 0.03, -0.18, 0.9, '#2a4f9a');
    for (let i = 0; i < 3; i++) { v.add(G.cyl(8), '#e9e4d6', -0.6 + i * 0.5, 0.995, D / 2 + 0.14, [0.03, 0.08, 0.03]); v.add(G.cyl(8), '#5a8a3a', -0.6 + i * 0.5, 1.03, D / 2 + 0.14, [0.028, 0.004, 0.028]); }
    // taburetes
    for (let i = 0; i < 3; i++) {
      const sx = -0.6 + i * 0.6, sz = D / 2 + 0.58;
      B.cyl(ww, 0.16, 0.05, sx, 0.47, sz, 12);
      for (let k = 0; k < 3; k++) { const a = k * 2.09 + i; B.rod(wd, 0.016, V(sx + Math.cos(a) * 0.1, 0.45, sz + Math.sin(a) * 0.1), V(sx + Math.cos(a) * 0.15, 0, sz + Math.sin(a) * 0.15), 5); }
    }
    // noren bajo el alero
    const nw = W + 0.1, nh = 0.42, panels = 5, top = 2.02, len = nh;
    const cm = K.cloth(norenTex(K, o.text ?? 'おでん', o.bg ?? '#7a1f1a', '#f4ecdc', panels, o.sub ?? '酒'), 0, 0.03, top, len); B.noShadow(cm);
    const gap = 0.012, pw = (nw - gap * (panels - 1)) / panels;
    for (let i = 0; i < panels; i++) { const x0 = -nw / 2 + i * (pw + gap); B.geo(cm, planeUV(pw, len, 2, 4, (x0 + nw / 2) / nw, 0, (x0 + pw + nw / 2) / nw, 1), x0 + pw / 2, top - len / 2, D / 2 + 0.04); }
    B.cyl(wd, 0.014, nw + 0.1, 0, top + 0.01, D / 2 + 0.04, 6, 1, 0, 0, Math.PI / 2);
    K.lantern(B, W / 2 + 0.12, 2.06, D / 2 + 0.06, { text: o.lantern ?? 'おでん', shape: 'long', s: 0.75, frame: wd });
    const g = B.finish('yatai', SZ); g.add(v.mesh(K.vcGloss));
    g.add(K.steam(px, 1.0, -0.05, 14, 0.2, 0.8, 0.3));
    return stat(g, { w: W + 0.5, h: 2.4, d: D + 0.9 });
  };

  // ---------------- frutería / verdulería ----------------
  const cardTex = () => K.tex('pricecards', 128, 128, (g, w, h, r) => {
    const txt = [['100', '円'], ['150', '円'], ['ひと山', '200'], ['朝採れ', '野菜']];
    txt.forEach(([a, b], i) => {
      const x = (i % 2) * 64, y = Math.floor(i / 2) * 64;
      g.fillStyle = i === 3 ? '#f2d24a' : '#f8f4ea'; g.fillRect(x + 2, y + 2, 60, 60);
      g.strokeStyle = '#c8261f'; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, 56, 56);
      g.fillStyle = i === 3 ? '#1a1a1a' : '#c8261f'; htext(g, a, x + 32, y + 24, a.length > 2 ? 15 : 24, 1, GOTHIC, '900');
      g.fillStyle = '#1a1a1a'; htext(g, b, x + 32, y + 46, b.length > 1 ? 15 : 16, 1, GOTHIC, '900');
    });
    grain(g, w, h, r, 0.3, false);
  });
  const produce: Make = (o = {}) => {
    const r = rng(o.seed ?? 4), B = new Builder(), v = new VC(), wd = M.woodWeathered, cm = K.print(cardTex());
    const tilt = 0.32, kinds = o.kinds ?? ['tomato', 'mikan', 'cabbage', 'nasu', 'daikon', 'apple'];
    // caballete escalonado
    for (const sx of [-0.85, 0, 0.85]) { B.box(wd, 0.05, 0.85, 0.05, sx, 0.425, -0.32); B.box(wd, 0.05, 0.5, 0.05, sx, 0.25, 0.3); B.box(wd, 0.04, 0.04, 0.7, sx, 0.47, -0.01, 0, -0.5); }
    const slots = [[-0.55, 0.52, 0.12], [0, 0.52, 0.12], [0.55, 0.52, 0.12], [-0.3, 0.82, -0.22], [0.3, 0.82, -0.22]];
    const e = new THREE.Euler(tilt, 0, 0), q = new THREE.Vector3();
    slots.forEach(([cx, cy, cz], i) => {
      const kind = kinds[i % kinds.length], cw = 0.5, cd = 0.34;
      // caja de listones inclinada hacia el cliente
      B.box(wd, cw, 0.015, cd, cx, cy, cz, 0, tilt);
      for (const s of [-1, 1]) {
        for (const yy of [0.025, 0.075]) { q.set(0, yy, s * cd / 2).applyEuler(e); B.box(wd, cw, 0.035, 0.012, cx + q.x, cy + q.y, cz + q.z, 0, tilt); }
        q.set(s * cw / 2, 0.05, 0).applyEuler(e); B.box(wd, 0.015, 0.1, cd, cx + q.x, cy + q.y, cz + q.z, 0, tilt);
      }
      const put = (lx: number, ly: number, lz: number, geo: THREE.BufferGeometry, c: string, s: [number, number, number], rot: [number, number, number] = [r() * 3, r() * 3, 0], top?: string) => {
        q.set(lx, ly, lz).applyEuler(e); v.add(geo, c, cx + q.x, cy + q.y, cz + q.z, s, rot, top);
      };
      const jit = (c: string, k = 0.08) => '#' + new THREE.Color(c).offsetHSL((r() - 0.5) * k * 0.3, 0, (r() - 0.5) * k).getHexString();
      if (kind === 'tomato' || kind === 'apple' || kind === 'mikan') {
        const rad = kind === 'mikan' ? 0.034 : 0.042, c = kind === 'tomato' ? '#d63a22' : kind === 'apple' ? '#b62630' : '#f08a1e';
        if (kind === 'mikan') for (let tr = 0; tr < 4; tr++) { // 4 cestitas azules "ひと山"
          const tx = -0.12 + (tr % 2) * 0.24, tz = -0.07 + Math.floor(tr / 2) * 0.14;
          put(tx, 0.02, tz, G.cyl(10), '#2f6fc0', [0.09, 0.02, 0.06], [0, 0, 0]);
          for (let k = 0; k < 4; k++) put(tx + (k % 2 - 0.5) * 0.06, 0.05 + (k === 3 ? 0.03 : 0), tz + (k > 1 ? 0.02 : -0.02), G.ico0(), jit(c), [rad, rad * 0.82, rad]);
        }
        else for (let k = 0; k < 15; k++) put(-0.19 + (k % 5) * 0.095, 0.045 + (k % 2) * 0.01, -0.11 + Math.floor(k / 5) * 0.11, G.ico0(), jit(c), [rad, rad * 0.88, rad]);
      } else if (kind === 'cabbage') {
        for (let k = 0; k < 4; k++) put(-0.12 + (k % 2) * 0.24, 0.09, -0.07 + Math.floor(k / 2) * 0.14, G.ico1(), jit('#a8c870'), [0.095, 0.085, 0.095], [r() * 3, r() * 3, 0], '#d8ecb0');
      } else if (kind === 'nasu') {
        for (let k = 0; k < 10; k++) { put(-0.18 + (k % 5) * 0.09, 0.04, -0.07 + Math.floor(k / 5) * 0.14, G.ico0(), jit('#4a1f5a', 0.05), [0.03, 0.03, 0.07], [0, r() * 0.4, 0]); put(-0.18 + (k % 5) * 0.09, 0.045, -0.07 + Math.floor(k / 5) * 0.14 - 0.07, G.cone(5), '#3a5a2a', [0.018, 0.03, 0.018], [-Math.PI / 2, 0, 0]); }
      } else {
        for (let k = 0; k < 4; k++) { // daikon con hojas
          const z = -0.12 + k * 0.08;
          put(0.0, 0.05, z, G.cyl(7), '#f2f0e6', [0.035, 0.38, 0.035], [0, 0, Math.PI / 2 - 0.05], '#e6ecd8');
          for (let l = 0; l < 3; l++) put(-0.24 - l * 0.02, 0.05 + l * 0.02, z + (l - 1) * 0.02, G.oct(), '#4a8a32', [0.12, 0.012, 0.03], [0, (l - 1) * 0.3, 0.2]);
        }
      }
      // tarjeta de precio clavada
      const ci = i % 4, u0 = (ci % 2) * 0.5, v0 = ci < 2 ? 0.5 : 0;
      q.set(0.18, 0.12, cd / 2 + 0.005).applyEuler(e);
      B.geo(cm, planeUV(0.1, 0.1, 1, 1, u0, v0, u0 + 0.5, v0 + 0.5), cx + q.x, cy + q.y + 0.04, cz + q.z, 0, -0.1);
      B.rod(wd, 0.004, V(cx + q.x, cy + q.y - 0.02, cz + q.z - 0.01), V(cx + q.x, cy + q.y - 0.12, cz + q.z - 0.03), 3);
    });
    // cajas de cartón en el suelo
    for (let i = 0; i < 2; i++) { v.add(G.box(), '#b08a58', -0.5 + i * 0.95, 0.15, 0.3, [0.42, 0.3, 0.32], [0, i * 0.2, 0], '#c49c68'); v.add(G.box(), '#2a5ab0', -0.5 + i * 0.95, 0.2, 0.461, [0.2, 0.06, 0.004], [0, i * 0.2, 0]); }
    const g = B.finish('produce', SZ); g.add(v.mesh(K.vcGloss));
    return stat(g, { w: 1.8, h: 1.0, d: 0.8 });
  };

  // ---------------- barriles de sake (kazaridaru) ----------------
  const labelTex = () => K.tex('sakelabels', 256, 256, (g, w, h, r) => {
    const L = [['月桜', '清酒', '#f6f2e8', '#141010', '#c8261f'], ['夕暮', '御神酒', '#c8261f', '#f8f0e0', '#e9c25a'], ['山霧', '純米', '#1c1c22', '#e9c25a', '#e9c25a'], ['鶴舞', '銘酒', '#e8d29a', '#1a1410', '#2a4f9a']];
    L.forEach(([a, b, bg, fg, ac], i) => {
      const x = (i % 2) * 128, y = Math.floor(i / 2) * 128;
      g.fillStyle = bg; g.fillRect(x, y, 128, 128);
      g.strokeStyle = ac; g.lineWidth = 5; g.strokeRect(x + 6, y + 6, 116, 116);
      g.fillStyle = fg; vtext(g, a, x + 58, y + 64, 46, 1, MINCHO, '900');
      g.fillStyle = ac; vtext(g, b, x + 104, y + 60, 15, 1, MINCHO, '800');
      g.fillStyle = '#c8261f'; g.fillRect(x + 16, y + 92, 16, 16);
      grain(g, 256, 256, r, 0.1, false);
    });
  });
  const barrels: Make = (o = {}) => {
    const rows = Math.max(1, Math.min(o.rows ?? 3, 4)), R = 0.27, H = 0.5, sp = 0.57, B = new Builder(), lab = K.print(labelTex()), r = rng(o.seed ?? 2);
    const lg = new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.3, 6, 1, true, -0.62, 1.24);
    B.box(M.woodWarm, rows * sp + 0.1, 0.08, 0.66, 0, 0.04, 0);
    for (let k = 0; k < 3; k++) B.box(M.woodWarm, rows * sp + 0.12, 0.03, 0.08, 0, 0.095, -0.28 + k * 0.28);
    let n = 0;
    for (let row = 0; row < rows; row++) {
      const cnt = rows - row, y0 = 0.11 + row * (H + 0.025);
      for (let i = 0; i < cnt; i++, n++) {
        const x = (i - (cnt - 1) / 2) * sp, yc = y0 + H / 2;
        B.geo(M.straw, G.wrap(12), x, yc, 0, 0, 0, 0, R, H, R);
        const c = Math.floor(r() * 4), u0 = (c % 2) * 0.5, v0 = c < 2 ? 0.5 : 0;
        const g2 = lg.clone(), uv = g2.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v0 + uv.getY(k) * 0.5);
        B.geo(lab, g2, x, yc + 0.01, 0);
        for (const yy of [0.03, H - 0.03]) B.geo(M.rope, G.torus(3, 12, 0.06), x, y0 + yy, 0, 0, Math.PI / 2, 0, R + 0.01, R + 0.01, R + 0.01);
        for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; B.rod(M.rope, 0.008, V(x + Math.sin(a) * (R + 0.008), y0 + 0.03, Math.cos(a) * (R + 0.008)), V(x + Math.sin(a) * (R + 0.008), y0 + H - 0.03, Math.cos(a) * (R + 0.008)), 3); }
        B.cyl(M.woodWarm, R - 0.01, 0.02, x, y0 + H - 0.005, 0, 12);
        B.rod(M.rope, 0.008, V(x - R, y0 + H + 0.01, 0), V(x + R, y0 + H + 0.01, 0), 3);
      }
    }
    return stat(B.finish('barrels', SZ), { w: rows * sp + 0.1, h: 0.11 + rows * (H + 0.025), d: 0.66 });
  };

  // ---------------- terrazas ----------------
  const terrace: Make = (o = {}) => {
    const B = new Builder(), v = new VC(), ww = M.woodWarm;
    if ((o.kind ?? 'teahouse') === 'teahouse') {
      const red = M.tint('fabric', '#b8231c');
      B.box(ww, 1.8, 0.05, 0.6, 0, 0.45, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(ww, 0.06, 0.43, 0.06, sx * 0.8, 0.215, sz * 0.24);
      for (const sx of [-1, 1]) B.box(ww, 0.04, 0.04, 0.5, sx * 0.8, 0.12, 0);
      B.box(ww, 1.6, 0.04, 0.04, 0, 0.12, 0);
      B.box(red, 1.82, 0.012, 0.62, 0, 0.481, 0);
      for (const sz of [-1, 1]) B.box(red, 1.82, 0.12, 0.008, 0, 0.425, sz * 0.31);
      // nodate-gasa
      const px = 0.95, pz = -0.4, ph = 2.3;
      B.cyl(M.bamboo, 0.022, ph, px, ph / 2, pz, 8);
      B.box(ww, 0.4, 0.06, 0.08, px, 0.03, pz); B.box(ww, 0.08, 0.06, 0.4, px, 0.03, pz);
      B.geo(red, G.cone(16), px, ph - 0.2, pz, 0, 0, 0, 1.25, 0.42, 1.25);
      B.geo(red, coneIn(), px, ph - 0.205, pz, 0, 0, 0, 1.24, 0.42, 1.24);
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8, ex = px + Math.cos(a) * 1.2, ez = pz + Math.sin(a) * 1.2;
        B.rod(M.bamboo, 0.006, V(px, ph - 0.01, pz), V(ex, ph - 0.42, ez), 3);
        B.rod(M.bamboo, 0.005, V(px, ph - 0.75, pz), V(px + Math.cos(a) * 0.5, ph - 0.25, pz + Math.sin(a) * 0.5), 3);
      }
      B.cyl(M.bamboo, 0.04, 0.06, px, ph - 0.75, pz, 8);
      // bandeja con té y dango
      v.add(G.box(), '#5a1612', -0.3, 0.5, 0.02, [0.36, 0.02, 0.24]);
      for (const x of [-0.4, -0.2]) { v.add(G.cyl(10), '#6a7a4a', x, 0.535, -0.03, [0.03, 0.05, 0.03]); v.add(G.cyl(10), '#9ab060', x, 0.561, -0.03, [0.026, 0.003, 0.026]); }
      for (let k = 0; k < 2; k++) {
        v.add(G.cyl(4), '#d8c49a', -0.3, 0.53, 0.06 + k * 0.04, [0.003, 0.2, 0.003], [0, 0, Math.PI / 2]);
        ['#f2a0b0', '#f6f2e8', '#8ab060'].forEach((c, j) => v.add(G.sph(8, 6), c, -0.36 + j * 0.045, 0.53, 0.06 + k * 0.04, 0.02));
      }
      v.add(G.cyl(12), '#2a2a30', 0.5, 0.49, 0.05, [0.12, 0.012, 0.12]);
    } else {
      const crate = (x: number, y: number, z: number, ry = 0, c = '#f2c230') => {
        const cs = Math.cos(ry), sn = Math.sin(ry), at = (lx: number, lz: number): [number, number] => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
        const put = (lx: number, ly: number, lz: number, s: [number, number, number], col = c) => { const [px, pz] = at(lx, lz); v.add(G.box(), col, px, y + ly, pz, s, [0, ry, 0]); };
        put(0, 0.01, 0, [0.44, 0.02, 0.34]);
        for (const s of [-1, 1]) { put(0, 0.15, s * 0.165, [0.44, 0.3, 0.012]); put(s * 0.215, 0.15, 0, [0.012, 0.3, 0.32]); put(0, 0.24, s * 0.172, [0.12, 0.04, 0.004], '#3a2a10'); }
        for (let i = 1; i < 4; i++) put(-0.22 + i * 0.11, 0.12, 0, [0.008, 0.24, 0.32]);
        put(0, 0.12, 0, [0.42, 0.24, 0.008]);
      };
      for (const sx of [-1, 1]) { crate(sx * 0.4, 0, 0, 0); crate(sx * 0.4, 0.3, 0, 0, '#e8b820'); }
      B.box(ww, 1.25, 0.03, 0.62, 0, 0.615, 0);
      B.box(M.woodDark, 1.27, 0.035, 0.012, 0, 0.6, 0.31);
      crate(-0.35, 0, 0.75, 0.2, '#d83a2a'); crate(0.45, 0, 0.72, -0.15); crate(1.05, 0, 0.1, 1.4, '#d83a2a');
      for (let i = 0; i < 2; i++) bottle(v, -0.2 + i * 0.12, 0.63, -0.1, '#5a2a10', 0.34, 0.038, '#c9a43a');
      for (const [x, z] of [[0.15, 0.1], [-0.35, 0.12], [0.4, -0.12]]) { v.add(G.cyl(10), '#e8a83a', x, 0.69, z, [0.033, 0.12, 0.033]); v.add(G.cyl(10), '#fbf6ec', x, 0.76, z, [0.034, 0.025, 0.034]); }
      v.add(G.cyl(14), '#f2efe8', 0.0, 0.64, 0.12, [0.1, 0.012, 0.1]);
      for (let i = 0; i < 12; i++) v.add(G.ico0(), '#7ab040', (i % 4 - 1.5) * 0.04, 0.655, 0.12 + (Math.floor(i / 4) - 1) * 0.04, [0.02, 0.008, 0.01], [0, i, 0]);
      v.add(G.cyl(10), '#9aa0a6', 0.48, 0.64, 0.18, [0.05, 0.02, 0.05]);
    }
    const g = B.finish('terrace', SZ); g.add(v.mesh(o.kind === 'izakaya' ? K.vcGloss : K.vc));
    return stat(g, { w: 2.4, h: 2.3, d: 1.4 });
  };

  /** tablilla colgante 営業中 / 準備中 */
  const fuda: Make = (o = {}) => {
    const text = o.text ?? '営業中';
    const t = K.tex('fuda|' + text, 128, 64, (g, w, h, r) => {
      g.fillStyle = '#c9a272'; g.fillRect(0, 0, w, h); grain(g, w, h, r, 1); vignette(g, w, h, 0.4);
      g.fillStyle = '#1a120c'; htext(g, text, w / 2, h / 2, 34, 1.2, MINCHO, '900');
    });
    const B = new Builder();
    B.box(M.woodWarm, 0.3, 0.15, 0.015, 0, -0.17, 0);
    B.geo(K.print(t), planeUV(0.28, 0.13, 1, 1), 0, -0.17, 0.008);
    B.rod(M.rope, 0.003, V(-0.11, -0.1, 0), V(0, 0, 0), 3); B.rod(M.rope, 0.003, V(0.11, -0.1, 0), V(0, 0, 0), 3);
    return stat(B.finish('fuda', SZ), { w: 0.3, h: 0.25, d: 0.02 });
  };

  return { wok, yatai, produce, barrels, terrace, fuda };
}
