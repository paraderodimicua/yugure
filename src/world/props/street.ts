// Mobiliario de calle: luces, telas, carteles, máquinas, piezas de culto, jardín y objetos de vecino.
import * as THREE from 'three';
import { Builder, V, SZ, G, VC, stat, planeUV, catenary, polyline, vtext, htext, grain, vignette, MINCHO, GOTHIC, rng, type Kit } from './kit';

type Make = (o?: any) => THREE.Group;

export function norenTex(K: Kit, text: string, bg: string, fg: string, panels: number, sub: string) {
  return K.tex(`noren|${text}|${bg}|${fg}|${panels}|${sub}`, 256, 128, (g, w, h, r) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${0.05 * r()})`; g.fillRect(r() * w, 0, 2 + r() * 8, h); } // tinte irregular
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 0, w, h * 0.13);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
    for (let i = 0; i < panels; i++) { const x = (i + 0.5) * w / panels; g.strokeRect(x - 10, 2, 20, h * 0.1); }
    grain(g, w, h, r, 0.6, false);
    g.fillStyle = fg;
    const n = [...text].length, size = Math.min(h * 0.62, (w * 0.86) / n);
    htext(g, text, w / 2, h * 0.56, size, 1.1, MINCHO, '900');
    if (sub) { g.font = `700 13px ${MINCHO}`; vtext(g, sub, w - 12, h * 0.68, 12, 1, MINCHO, '700'); }
    // mon (emblema) circular arriba a la izquierda
    g.strokeStyle = fg; g.lineWidth = 2.5; g.beginPath(); g.arc(22, h * 0.32, 10, 0, 6.29); g.stroke();
    g.beginPath(); g.moveTo(14, h * 0.32 + 3); g.quadraticCurveTo(22, h * 0.32 - 8, 30, h * 0.32 + 3); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 4, w, 4);
  });
}

export function streetProps(K: Kit): Record<string, Make> {
  const M = K.mats;
  const vc2 = K.once('vc2', () => { const m = (K.vc as THREE.MeshToonMaterial).clone(); m.side = THREE.DoubleSide; m.onBeforeCompile = K.vc.onBeforeCompile; m.customProgramCacheKey = K.vc.customProgramCacheKey; return m; });
  const chrome = M.tint('metalPaint', '#c3c7cd');
  const pivotOf = (B: Builder, name: string) => B.finish(name, SZ);
  const ph = () => Math.random() * 6.28;

  // ---------------- farolillos ----------------
  const chochin: Make = (o = {}) => {
    const B = new Builder();
    const yb = K.lantern(B, 0, 0, 0, { text: o.text ?? '祭', color: o.color ?? 'red', shape: o.shape ?? 'round', s: o.s ?? 1, glow: o.glow, hi: true });
    const g = new THREE.Group(), piv = pivotOf(B, 'chochin'), p = ph();
    g.add(piv); g.name = 'chochin';
    K.anims.push((t) => { piv.rotation.z = Math.sin(t * 0.9 + p) * 0.035; piv.rotation.x = Math.sin(t * 0.7 + p * 1.3) * 0.025; });
    return stat(g, { w: 0.45, h: -yb, d: 0.45 });
  };

  const festival: Make = (o = {}) => {
    const span = o.span ?? 8, n = o.n ?? 7, sag = o.sag ?? 0.7, dy = o.dy ?? 0, s = o.s ?? 0.62;
    const B = new Builder();
    const pts = catenary(V(0, 0, 0), V(span, dy, 0), sag, 18);
    polyline(B, M.rope, 0.006, pts, 3);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, y = dy * t - sag * 4 * t * (1 - t);
      K.lantern(B, t * span, y, 0, { text: o.text ?? '祭', color: (o.alt ?? true) && i % 2 ? 'white' : 'red', s, hi: false });
    }
    return stat(B.finish('festival', SZ), { w: span, h: sag + 0.6, d: 0.3 });
  };

  // ---------------- telas ----------------
  function koriTex() {
    return K.tex('kori', 128, 128, (g, w, h, r) => {
      g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c8261f'; g.fillRect(0, 0, w, 10);
      g.fillStyle = '#2a5fb0';
      for (let k = 0; k < 3; k++) { // olas seigaiha simplificadas
        for (let x = -8; x < w + 16; x += 22) { g.beginPath(); g.arc(x + (k % 2) * 11, h - 4 - k * 9, 12, Math.PI, 0); g.fill(); g.strokeStyle = '#f6f3ec'; g.lineWidth = 2; g.beginPath(); g.arc(x + (k % 2) * 11, h - 4 - k * 9, 7, Math.PI, 0); g.stroke(); }
      }
      g.fillStyle = '#d0231b'; htext(g, '氷', w / 2, h * 0.42, 74, 1, MINCHO, '900');
      grain(g, w, h, r, 0.5, false);
    });
  }
  const noren: Make = (o = {}) => {
    const kori = o.style === 'kori';
    const w = o.w ?? (kori ? 0.5 : 1.6), h = o.h ?? (kori ? 0.52 : 0.85);
    const panels = kori ? 1 : o.panels ?? Math.max(2, Math.round(w / 0.42));
    const t = kori ? koriTex() : norenTex(K, o.text ?? 'そば', o.bg ?? '#1f2c52', o.fg ?? '#f3eee2', panels, o.sub ?? '');
    const top = -0.035, len = h - 0.035;
    const mat = K.cloth(t, 0, o.amp ?? 0.035, top, len);
    const B = new Builder(); B.noShadow(mat);
    const gap = 0.014, pw = (w - gap * (panels - 1)) / panels;
    for (let i = 0; i < panels; i++) {
      const x0 = -w / 2 + i * (pw + gap);
      B.geo(mat, planeUV(pw, len, 2, 5, (x0 + w / 2) / w, 0, (x0 + pw + w / 2) / w, 1), x0 + pw / 2, top - len / 2, 0);
    }
    B.cyl(M.bamboo, 0.016, w + 0.24, 0, 0, 0, 7, 1, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) { B.rod(M.metalDark, 0.005, V(sx * (w / 2 + 0.08), 0, 0), V(sx * (w / 2 + 0.08), 0.06, -0.06), 3); B.box(M.metalDark, 0.03, 0.05, 0.01, sx * (w / 2 + 0.08), 0.06, -0.065); }
    return stat(B.finish('noren', SZ), { w, h, d: 0.1 });
  };

  function noboriTex(text: string, bg: string, fg: string, sub: string, sx: number) {
    return K.tex(`nobori|${text}|${bg}|${fg}|${sub}`, 128, 256, (g, w, h, r) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, 11, h); g.fillRect(0, 0, w, 9); // funda del mástil (chichi)
      g.fillStyle = bg; for (let y = 22; y < h; y += 26) g.fillRect(3, y, 6, 8);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(11, h - 14, w, 14);
      grain(g, w, h, r, 0.5, false);
      g.fillStyle = fg;
      const n = [...text].length, size = Math.min((h - 40) / (n * 1.04), 58);
      vtext(g, text, w * 0.52, h * 0.47, size, sx, MINCHO, '900');
      if (sub) { g.fillStyle = fg; vtext(g, sub, w - 12, h * 0.8, 11, sx * 0.9, GOTHIC, '700'); }
    });
  }
  const nobori: Make = (o = {}) => {
    const H = o.h ?? 2.4, bw = 0.45, bh = H - 0.55, ya = H - 0.07;
    const t = noboriTex(o.text ?? 'ラーメン', o.bg ?? '#c42a22', o.fg ?? '#fbf4ea', o.sub ?? '営業中', (128 / bw) / (256 / bh) * 0.92);
    const mat = K.cloth(t, 1, o.amp ?? 0.07);
    const pole = M.tint('metalPaint', '#e6e4de');
    const B = new Builder(); B.noShadow(mat);
    B.geo(mat, planeUV(bw, bh, 4, 10), 0.022 + bw / 2, ya - 0.01 - bh / 2, 0);
    B.cyl(pole, 0.014, H - 0.1, 0, 0.1 + (H - 0.1) / 2, 0, 8);
    B.rod(pole, 0.009, V(0, ya, 0), V(bw + 0.05, ya, 0), 6);
    B.sphere(pole, 0.014, bw + 0.05, ya, 0, 1, 6, 4);
    B.cyl(M.metalDark, 0.2, 0.11, 0, 0.055, 0, 12, 0.8); // base de agua
    B.cyl(M.metalDark, 0.04, 0.1, 0, 0.14, 0, 8, 0.8);
    return stat(B.finish('nobori', SZ), { w: 0.5, h: H, d: 0.4 });
  };

  // ---------------- carteles ----------------
  const kanban: Make = (o = {}) => {
    const w = o.w ?? 0.42, h = o.h ?? 1.5, stand = o.stand ?? true, y0 = stand ? 0.12 : 0;
    const fw = w - 0.04, fh = h - 0.04, sx = (128 / fw) / (256 / fh);
    const t = K.tex(`kanban|${o.text ?? '茶'}|${o.sub ?? '御休処'}`, 128, 256, (g, W, Hh, r) => {
      g.fillStyle = '#a77d52'; g.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 26; i++) { // veta de cedro
        g.strokeStyle = `rgba(${60 + r() * 30},${35 + r() * 20},15,${0.15 + 0.2 * r()})`; g.lineWidth = 0.8 + r() * 1.6;
        const x = r() * W; g.beginPath(); g.moveTo(x, 0);
        for (let y = 0; y <= Hh; y += 16) g.lineTo(x + Math.sin(y * 0.03 + i) * 4, y);
        g.stroke();
      }
      grain(g, W, Hh, r, 0.8); vignette(g, W, Hh, 0.5);
      g.fillStyle = '#16100c';
      const txt = o.text ?? '茶', n = [...txt].length;
      vtext(g, txt, W * 0.46, Hh * 0.44, Math.min(118, (Hh * 0.7) / n), sx * 0.85, MINCHO, '900');
      vtext(g, o.sub ?? '御休処', W - 16, Hh * 0.8, 15, sx * 0.85, MINCHO, '700');
      g.fillStyle = '#b8261c'; g.fillRect(W * 0.12, Hh * 0.86, 22 / sx, 22); g.fillStyle = '#f2e4cc';
      htext(g, '印', W * 0.12 + 11 / sx, Hh * 0.86 + 11, 16, 1, MINCHO, '900');
    });
    const B = new Builder(), wd = M.woodDark;
    B.box(M.woodWarm, w, h, 0.035, 0, y0 + h / 2, 0);
    B.geo(K.print(t), planeUV(fw, fh, 1, 1), 0, y0 + h / 2, 0.0185);
    B.box(wd, w + 0.02, 0.025, 0.045, 0, y0 + h, 0); B.box(wd, w + 0.02, 0.025, 0.045, 0, y0, 0);
    for (const s of [-1, 1]) {
      B.box(wd, 0.02, h, 0.045, s * (w / 2), y0 + h / 2, 0);
      B.box(wd, w / 2 + 0.08, 0.012, 0.1, s * (w / 4 + 0.02), y0 + h + 0.045, s * 0, 0, 0, -s * 0.42); // tejadillo
      if (stand) { B.box(wd, 0.045, h + y0 + 0.06, 0.045, s * (w / 2 + 0.035), (h + y0 + 0.06) / 2, 0); B.box(wd, 0.06, 0.05, 0.42, s * (w / 2 + 0.035), 0.025, 0); }
    }
    B.box(wd, 0.03, 0.03, 0.11, 0, y0 + h + 0.1, 0);
    return stat(B.finish('kanban', SZ), { w: w + 0.1, h: h + y0 + 0.12, d: 0.42 });
  };

  const lightbox: Make = (o = {}) => {
    const w = o.w ?? 0.3, h = o.h ?? 1.1, d = o.d ?? 0.12, out = o.out ?? 0.42;
    const fw = w - 0.03, fh = h - 0.03, sx = (128 / fw) / (256 / fh);
    const text = o.text ?? 'スナック', bg = o.bg ?? '#f4ecd8', fg = o.fg ?? '#b5231d';
    const t = K.tex(`andon|${text}|${o.sub ?? '夕暮'}|${bg}|${fg}`, 128, 256, (g, W, Hh, r) => {
      const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, bg); gr.addColorStop(0.5, '#fffaf0'); gr.addColorStop(1, bg);
      g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
      g.fillStyle = fg; g.fillRect(0, 0, W, 34); g.fillRect(0, Hh - 10, W, 10);
      g.fillStyle = bg; htext(g, o.sub ?? '夕暮', W / 2, 18, 22, 1 / sx * 1.6, MINCHO, '900');
      g.fillStyle = fg; const n = [...text].length;
      vtext(g, text, W / 2, Hh * 0.56, Math.min(64, (Hh - 70) / (n * 1.04)), sx * 0.9, GOTHIC, '900');
      grain(g, W, Hh, r, 0.4, false);
    });
    const glow = K.lit(t, o.glow ?? 1.6), frame = M.tint('metalPaint', '#2b2a30');
    const B = new Builder(); B.noShadow(glow);
    const zc = out;
    for (const s of [-1, 1]) {
      B.geo(glow, planeUV(fw, fh, 1, 1), s * (d / 2 + 0.002), 0, zc, s * Math.PI / 2);
      B.box(frame, d + 0.012, 0.018, w + 0.012, 0, s * (h / 2), zc); // tapas
      B.box(frame, d + 0.012, h, 0.016, 0, 0, zc + s * (w / 2));
      B.rod(M.metalDark, 0.012, V(0, s * h * 0.32, 0), V(0, s * h * 0.32, zc - w / 2), 6);
      B.box(M.metalDark, 0.08, 0.1, 0.01, 0, s * h * 0.32, 0.005);
    }
    B.box(frame, d - 0.01, h - 0.01, w - 0.01, 0, 0, zc);
    B.rod(M.metalDark, 0.006, V(0, -h * 0.32, 0.01), V(0, -h / 2 - 0.25, 0.01), 3); // cable
    return stat(B.finish('lightbox', SZ), { w: d, h, d: out + w / 2 });
  };

  // ---------------- máquina expendedora ----------------
  const vendTex = () => K.tex('vending', 256, 256, (g, w, h, r) => {
    g.fillStyle = '#163a7c'; g.fillRect(0, 0, w, 26);
    g.fillStyle = '#fff'; g.font = `800 15px ${GOTHIC}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('つめたい', 8, 13); g.fillStyle = '#ff5a4a'; g.fillText('あったか〜い', 150, 13);
    const pal = ['#d8342a', '#2e7f3c', '#f2c23a', '#1f4f9e', '#f4f1ea', '#6b3a22', '#e87a2a', '#85c8e8', '#222', '#9c2a6a'];
    for (let row = 0; row < 3; row++) {
      const y0 = 30 + row * 75, hot = row === 2;
      const gr = g.createLinearGradient(0, y0, 0, y0 + 75); gr.addColorStop(0, '#fffdf4'); gr.addColorStop(1, '#d9dce0');
      g.fillStyle = gr; g.fillRect(0, y0, w, 72);
      for (let i = 0; i < 8; i++) {
        const cx = 16 + i * 31, c = pal[Math.floor(r() * pal.length)], c2 = pal[Math.floor(r() * pal.length)];
        const pet = r() < 0.4, bw = pet ? 14 : 19, bh = pet ? 44 : 36, by = y0 + 50 - bh;
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - bw / 2 + 2, by + 3, bw, bh);
        if (pet) { g.fillStyle = 'rgba(200,230,240,0.9)'; g.fillRect(cx - bw / 2, by, bw, bh); g.fillStyle = c; g.fillRect(cx - bw / 2, by + 14, bw, 18); g.fillStyle = c2; g.fillRect(cx - 4, by - 6, 8, 7); }
        else {
          g.fillStyle = c; g.fillRect(cx - bw / 2, by, bw, bh); g.fillStyle = c2; g.fillRect(cx - bw / 2, by + bh * 0.35, bw, bh * 0.28);
          g.fillStyle = '#c9ccd0'; g.fillRect(cx - bw / 2, by - 3, bw, 3);
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx - bw / 2 + 2, by + 2, 3, bh - 4);
        }
        g.fillStyle = '#111'; g.fillRect(cx - 13, y0 + 53, 26, 9);
        g.fillStyle = '#9dff7a'; g.font = `700 8px ${GOTHIC}`; g.textAlign = 'center'; g.fillText(String([110, 130, 150, 160, 180][Math.floor(r() * 5)]), cx, y0 + 58);
        g.fillStyle = hot ? '#e2382c' : '#2d6fd4'; g.fillRect(cx - 9, y0 + 64, 18, 5);
      }
    }
    grain(g, w, h, r, 0.3, false);
  });
  const vending: Make = (o = {}) => {
    const col = ({ white: '#e8e6df', red: '#b52a24', blue: '#2b5aa6' } as Record<string, string>)[o.color ?? 'white'] ?? o.color;
    const body = M.tint('metalPaint', col), dk = M.metalDark, W = 1.0, H = 1.83, D = 0.72, zf = D / 2;
    const glow = K.lit(vendTex(), o.glow ?? 1.35);
    const B = new Builder(); B.noShadow(glow);
    B.box(body, W, H - 0.06, D, 0, 0.06 + (H - 0.06) / 2, 0);
    B.box(body, W + 0.02, 0.05, D + 0.03, 0, H + 0.02, 0.005);
    B.box(dk, W - 0.04, 0.06, D - 0.06, 0, 0.03, 0);
    B.geo(glow, planeUV(0.88, 0.9, 1, 1), 0, 1.3, zf + 0.004);
    B.box(dk, 0.92, 0.02, 0.03, 0, 1.76, zf + 0.01); B.box(dk, 0.92, 0.02, 0.03, 0, 0.84, zf + 0.01);
    for (const s of [-1, 1]) B.box(dk, 0.02, 0.94, 0.03, s * 0.45, 1.3, zf + 0.01);
    B.box(dk, 0.22, 0.3, 0.02, 0.32, 0.64, zf + 0.008); // panel de monedas
    B.box(body, 0.05, 0.012, 0.02, 0.3, 0.72, zf + 0.02); B.box(body, 0.1, 0.012, 0.02, 0.32, 0.62, zf + 0.02);
    B.cyl(body, 0.018, 0.02, 0.38, 0.72, zf + 0.02, 8, 1, 0, Math.PI / 2);
    B.box(body, 0.06, 0.05, 0.03, 0.36, 0.52, zf + 0.02);
    B.box(dk, 0.5, 0.14, 0.012, -0.15, 0.66, zf + 0.004);
    B.box(dk, 0.72, 0.22, 0.04, -0.06, 0.25, zf + 0.0); // boca de salida
    B.box(dk, 0.66, 0.17, 0.01, -0.06, 0.26, zf + 0.022, 0, -0.12);
    B.box(body, 0.74, 0.03, 0.06, -0.06, 0.375, zf + 0.02);
    for (let i = 0; i < 4; i++) B.box(dk, 0.18, 0.01, 0.01, 0.32, 0.14 + i * 0.03, zf + 0.004);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) B.box(dk, 0.01, 0.012, 0.3, s * (W / 2 + 0.001), 0.15 + i * 0.03, 0);
    const g = B.finish('vending', SZ);
    if (o.bin ?? true) { // papelera de reciclaje
      const v = new VC(), bx = W / 2 + 0.24, bz = 0.12;
      v.add(G.box(), '#d4d8dd', bx, 0.33, bz, [0.34, 0.66, 0.32]);
      v.add(G.box(), '#2f62b0', bx, 0.68, bz, [0.36, 0.05, 0.34]);
      v.add(G.cyl(10), '#16181c', bx, 0.705, bz + 0.03, [0.07, 0.01, 0.07]);
      v.add(G.box(), '#2f62b0', bx, 0.5, bz + 0.161, [0.26, 0.06, 0.005]);
      v.add(G.box(), '#f2f2f2', bx, 0.5, bz + 0.165, [0.18, 0.025, 0.004]);
      g.add(v.mesh(K.vc));
    }
    return stat(g, { w: W + 0.5, h: H + 0.05, d: D });
  };

  // ---------------- buzón, tōrō, jizō ----------------
  const mailbox: Make = () => {
    const prof = [[0.235, 0], [0.235, 0.05], [0.2, 0.075], [0.19, 0.1], [0.19, 0.98], [0.212, 0.99], [0.212, 1.035], [0.18, 1.05], [0.15, 1.1], [0.1, 1.145], [0.04, 1.168], [0, 1.172]];
    const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18, -Math.PI, Math.PI * 2);
    const t = K.tex('post', 128, 128, (g, w, h, r) => {
      g.fillStyle = '#f3f0e8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c61f1a'; htext(g, '〒', w / 2, 44, 64, 1, GOTHIC, '900');
      g.fillStyle = '#1a1a1a'; htext(g, '郵便', w / 2, 88, 22, 1, GOTHIC, '800'); htext(g, 'POST', w / 2, 112, 15, 1, GOTHIC, '700');
      grain(g, w, h, r, 0.4, false);
    });
    const B = new Builder(), red = M.lacquerRed, dk = M.metalDark;
    B.geo(red, lg);
    B.box(red, 0.26, 0.03, 0.08, 0, 0.9, 0.2, 0, 0.25);
    B.box(dk, 0.2, 0.022, 0.02, 0, 0.872, 0.185);
    B.geo(K.print(t), planeUV(0.13, 0.13, 1, 1), 0, 0.7, 0.197);
    for (const [w, h, x, y] of [[0.2, 0.012, 0, 0.56], [0.2, 0.012, 0, 0.24], [0.012, 0.32, -0.1, 0.4], [0.012, 0.32, 0.1, 0.4]] as const) B.box(dk, w, h, 0.012, x, y, 0.188);
    B.cyl(dk, 0.014, 0.02, 0.07, 0.42, 0.195, 8, 1, 0, Math.PI / 2);
    B.box(dk, 0.32, 0.04, 0.32, 0, 0.02, 0);
    return stat(B.finish('mailbox', SZ), { w: 0.47, h: 1.17, d: 0.47 });
  };

  const toro: Make = (o = {}) => {
    const s = o.s ?? 1, st = M.stone, ms = M.stoneMoss, hex = Math.PI / 6;
    const t = K.tex('toro', 128, 64, (g, w, h, r) => {
      g.fillStyle = '#ffd890'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#ffe9b8'; g.fillRect(14, 8, 36, 48);
      g.fillStyle = '#5a4030'; for (let i = 0; i < 4; i++) { g.fillRect(14 + i * 12 - 1, 4, 3, 56); g.fillRect(10, 8 + i * 16, 44, 3); }
      g.fillStyle = '#4a4640'; g.fillRect(64, 0, 64, 64); grain(g, w, h, r, 1, false);
      g.fillStyle = '#ffd080'; g.beginPath(); g.arc(96, 32, 18, 0, 6.29); g.fill();
      g.fillStyle = '#4a4640'; g.beginPath(); g.arc(104, 28, 16, 0, 6.29); g.fill(); // creciente
    });
    const glow = K.lit(t, 1.5);
    const B = new Builder(); B.noShadow(glow);
    B.cyl(ms, 0.3 * s, 0.1 * s, 0, 0.05 * s, 0, 6, 1, hex);
    B.cyl(st, 0.26 * s, 0.08 * s, 0, 0.14 * s, 0, 6, 0.62, hex);
    B.cyl(st, 0.085 * s, 0.6 * s, 0, 0.48 * s, 0, 10);
    for (const y of [0.32, 0.62]) B.cyl(st, 0.098 * s, 0.03 * s, 0, y * s, 0, 10);
    B.cyl(st, 0.12 * s, 0.1 * s, 0, 0.82 * s, 0, 6, 2.2, hex);
    B.cyl(st, 0.27 * s, 0.04 * s, 0, 0.89 * s, 0, 6, 1, hex);
    const hy = 1.05 * s;
    B.cyl(st, 0.17 * s, 0.28 * s, 0, hy, 0, 6, 1, hex);
    for (const a of [0, Math.PI]) B.geo(glow, planeUV(0.12 * s, 0.17 * s, 1, 1, 0, 0, 0.5, 1), Math.sin(a) * 0.148 * s, hy, Math.cos(a) * 0.148 * s, a);
    for (const a of [Math.PI / 3, -Math.PI / 3, Math.PI * 2 / 3, -Math.PI * 2 / 3]) B.geo(glow, planeUV(0.09 * s, 0.09 * s, 1, 1, 0.5, 0, 1, 1), Math.sin(a) * 0.149 * s, hy, Math.cos(a) * 0.149 * s, a);
    B.cyl(st, 0.2 * s, 0.03 * s, 0, 0.9 * s, 0, 6, 1, hex);
    B.cyl(ms, 0.42 * s, 0.06 * s, 0, 1.22 * s, 0, 6, 0.95, hex);
    B.cyl(ms, 0.4 * s, 0.16 * s, 0, 1.33 * s, 0, 6, 0.28, hex);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; B.sphere(ms, 0.035 * s, Math.sin(a) * 0.42 * s, 1.27 * s, Math.cos(a) * 0.42 * s, 1.3, 6, 4); }
    B.cyl(st, 0.06 * s, 0.05 * s, 0, 1.43 * s, 0, 8, 1.4);
    B.sphere(st, 0.07 * s, 0, 1.51 * s, 0, 1.15, 8, 6);
    B.cyl(st, 0.03 * s, 0.06 * s, 0, 1.6 * s, 0, 6, 0);
    return stat(B.finish('toro', SZ), { w: 0.84 * s, h: 1.63 * s, d: 0.84 * s });
  };

  const kazaguruma: Make = (o = {}) => {
    const n = Math.min(o.n ?? 1, 3), s = o.s ?? 1;
    const g = new THREE.Group(); g.name = 'kazaguruma';
    const B = new Builder();
    const sets = [['#e23b2e', '#f7d046'], ['#2f6fd0', '#f4f1ea'], ['#3aa14a', '#f08bb0'], ['#f08b2a', '#7a3fb0']];
    for (let k = 0; k < n; k++) {
      const a = (k - (n - 1) / 2) * 0.32, top = V(Math.sin(a) * 0.55 * s, Math.cos(a) * 0.55 * s, 0);
      B.rod(M.bamboo, 0.006 * s, V(0, 0, 0), top, 4);
      const v = new VC(), cs = o.colors ?? sets[(k + (o.seed ?? 0)) % sets.length];
      for (let i = 0; i < 4; i++) {
        const b = i * Math.PI / 2, R = 0.085 * s, c = i % 2 ? cs[0] : cs[1];
        const p0 = [0, 0, 0], p1 = [Math.cos(b) * R, Math.sin(b) * R, 0], p2 = [Math.cos(b + 0.85) * R * 0.55, Math.sin(b + 0.85) * R * 0.55, 0.028 * s], p3 = [Math.cos(b - 0.5) * R * 0.75, Math.sin(b - 0.5) * R * 0.75, 0];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p0, ...p3, ...p1], 3));
        geo.computeVertexNormals();
        v.add(geo, c); v.add(geo, cs[i % 2], 0, 0, -0.002);
      }
      v.add(G.ico0(), '#f4e070', 0, 0, 0.01, 0.012 * s);
      const rot = v.mesh(vc2); rot.position.set(top.x, top.y, 0.012);
      g.add(rot);
      const p = ph(), spd = 5 + Math.random() * 3;
      K.anims.push((t, dt) => { rot.rotation.z -= dt * spd * (0.6 + 0.5 * Math.sin(t * 0.4 + p)); });
    }
    g.add(B.finish('sticks', SZ));
    return stat(g, { w: 0.2, h: 0.65 * s, d: 0.1 });
  };

  const jizo: Make = (o = {}) => {
    const s = o.s ?? 1, st = M.stone, red = M.tint('fabric', '#b8251d');
    const prof = [[0.13, 0], [0.15, 0.05], [0.152, 0.2], [0.135, 0.3], [0.105, 0.355], [0.06, 0.385], [0, 0.395]];
    const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 12);
    const B = new Builder();
    B.box(st, 0.44 * s, 0.12 * s, 0.36 * s, 0, 0.06 * s, 0);
    B.cyl(st, 0.16 * s, 0.07 * s, 0, 0.155 * s, 0, 10, 1.15);
    B.geo(st, lg, 0, 0.19 * s, 0);
    B.sphere(st, 0.088 * s, 0, 0.64 * s, 0, 1.06, 10, 8);
    for (const sx of [-1, 1]) B.sphere(st, 0.02 * s, sx * 0.085 * s, 0.63 * s, 0, 2.2, 5, 4);
    B.sphere(st, 0.036 * s, 0, 0.43 * s, 0.135 * s, 1, 6, 5);
    B.geo(red, new THREE.CylinderGeometry(0.105 * s, 0.17 * s, 0.2 * s, 10, 1, true, -1.35, 2.7), 0, 0.47 * s, 0.005 * s);
    B.sphere(red, 0.093 * s, 0, 0.67 * s, 0, 0.62, 10, 5);
    B.cyl(red, 0.095 * s, 0.025 * s, 0, 0.655 * s, 0, 12);
    B.sphere(red, 0.025 * s, 0, 0.735 * s, 0, 1, 6, 4);
    const g = B.finish('jizo', SZ);
    const v = new VC();
    v.add(G.cyl(10), '#ece6da', -0.11 * s, 0.135 * s, 0.13 * s, [0.026 * s, 0.03 * s, 0.026 * s]);
    v.add(G.cyl(10), '#3a4a6a', 0.13 * s, 0.165 * s, 0.11 * s, [0.028 * s, 0.09 * s, 0.028 * s]);
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, x = 0.13 * s + Math.cos(a) * 0.035 * s, z = 0.11 * s + Math.sin(a) * 0.03 * s, y = (0.24 + (i % 3) * 0.03) * s;
      v.add(G.cyl(4), '#3c6a2a', (x + 0.13 * s) / 2, (y + 0.2 * s) / 2, (z + 0.11 * s) / 2, [0.004 * s, y - 0.2 * s, 0.004 * s]);
      v.add(G.ico0(), i % 2 ? '#f2d23c' : '#f4f0e6', x, y, z, 0.02 * s);
    }
    g.add(v.mesh(K.vc));
    if (o.pinwheel ?? true) { const k = kazaguruma({ s: 0.65 * s, seed: 2 }); k.position.set(-0.17 * s, 0.12 * s, 0.1 * s); k.rotation.z = 0.15; g.add(k); }
    return stat(g, { w: 0.44 * s, h: 0.75 * s, d: 0.36 * s });
  };

  const furin: Make = (o = {}) => {
    const bell = K.tex('furin', 128, 64, (g, w, h, r) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f2fbfb'); gr.addColorStop(1, '#b9dfe6');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (const cx of [32, 96]) { // kingyo
        g.fillStyle = '#e0301e'; g.beginPath(); g.ellipse(cx, 34, 11, 7, 0.2, 0, 6.29); g.fill();
        g.beginPath(); g.moveTo(cx - 9, 34); g.lineTo(cx - 22, 24); g.lineTo(cx - 19, 44); g.fill();
        g.fillStyle = '#111'; g.fillRect(cx + 6, 31, 2, 2);
      }
      g.strokeStyle = '#2f8a45'; g.lineWidth = 2;
      for (const x of [64, 6, 120]) { g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + 8, h * 0.5, x - 2, 10); g.stroke(); }
      g.fillStyle = '#3b6fb8'; g.fillRect(0, h - 5, w, 5);
    });
    const strip = K.tex(`tanzaku|${o.text ?? '涼風'}`, 64, 192, (g, w, h, r) => {
      g.fillStyle = ['#cfe6f4', '#f6d3dc', '#f4ecc0'][Math.floor(r() * 3)]; g.fillRect(0, 0, w, h); grain(g, w, h, r, 1);
      g.fillStyle = '#1b1a2a'; vtext(g, o.text ?? '涼風', w / 2, h * 0.45, Math.min(40, (h * 0.75) / [...(o.text ?? '涼風')].length), 1, MINCHO, '700');
    });
    const prof = [[0.047, 0], [0.044, 0.02], [0.036, 0.045], [0.02, 0.058], [0.002, 0.062]];
    const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14, -Math.PI, Math.PI * 2);
    const B = new Builder(), Bs = new Builder();
    B.rod(M.rope, 0.0015, V(0, 0, 0), V(0, -0.06, 0), 3);
    B.geo(K.print(bell, true), lg, 0, -0.122, 0);
    B.rod(M.rope, 0.001, V(0, -0.07, 0), V(0, -0.17, 0), 3);
    B.cyl(M.rope, 0.008, 0.012, 0, -0.118, 0, 6);
    Bs.geo(K.print(strip, true), planeUV(0.05, 0.15, 1, 2), 0, -0.077, 0);
    const g = new THREE.Group(), piv = pivotOf(B, 'furin'), sp = pivotOf(Bs, 'tanzaku'), p = ph();
    sp.position.y = -0.17; piv.add(sp); g.add(piv);
    K.anims.push((t) => {
      piv.rotation.z = Math.sin(t * 1.9 + p) * 0.09 + Math.sin(t * 3.3 + p) * 0.04; piv.rotation.x = Math.sin(t * 1.4 + p) * 0.06;
      sp.rotation.x = Math.sin(t * 2.7 + p) * 0.45; sp.rotation.y = Math.sin(t * 1.1 + p) * 0.6;
    });
    return stat(g, { w: 0.1, h: 0.33, d: 0.1 });
  };

  // ---------------- cables, aire acondicionado, bici, ropa, escoba ----------------
  const cables: Make = (o = {}) => {
    const to = V(...((o.to ?? [8, 0, 0]) as [number, number, number])), n = o.n ?? 3, r = rng(o.seed ?? 1);
    const B = new Builder();
    for (let i = 0; i < n; i++) {
      const dy = (r() - 0.5) * 0.25, dz = (i - (n - 1) / 2) * (o.spread ?? 0.1);
      polyline(B, M.metalDark, o.r ?? 0.007, catenary(V(0, dy, dz), V(to.x, to.y + dy * 0.7, to.z + dz * 1.4), (o.sag ?? 0.6) * (0.75 + r() * 0.5), 16), 3);
    }
    return stat(B.finish('cables', SZ), { w: to.length(), h: 1, d: 0.3 });
  };

  const aircon: Make = (o = {}) => {
    const wall = o.wall ?? false, y0 = o.y ?? (wall ? 1.9 : 0.12), W = 0.78, H = 0.55, D = 0.27, zc = D / 2 + 0.04, zf = zc + D / 2;
    const body = M.tint('metalPaint', '#d9d6cc'), dk = M.metalDark, pipe = M.tint('plaster', '#e8e2d2');
    const B = new Builder(), cx = -0.12, cy = y0 + H / 2;
    B.box(body, W, H, D, 0, cy, zc);
    B.box(body, W + 0.01, 0.015, D + 0.01, 0, y0 + H, zc);
    B.geo(dk, G.disc(18), cx, cy, zf + 0.001, 0, Math.PI / 2, 0, 0.215, 1, 0.215);
    for (const rr of [0.21, 0.16, 0.11, 0.06]) B.geo(dk, G.torus(3, 22, 0.035), cx, cy, zf + 0.012, 0, 0, 0, rr, rr, rr * 0.4);
    B.box(dk, 0.43, 0.01, 0.01, cx, cy, zf + 0.014); B.box(dk, 0.01, 0.43, 0.01, cx, cy, zf + 0.014);
    for (let i = 0; i < 7; i++) B.box(dk, 0.15, 0.008, 0.006, 0.27, y0 + 0.1 + i * 0.05, zf + 0.002);
    B.box(dk, 0.08, 0.02, 0.004, 0.27, y0 + H - 0.05, zf + 0.002);
    for (let i = 0; i < 8; i++) B.box(dk, 0.004, H - 0.08, 0.008, -W / 2 - 0.001, cy, zc - D / 2 + 0.03 + i * 0.03);
    B.box(body, 0.05, 0.16, 0.14, W / 2 + 0.025, y0 + 0.14, zc + 0.03);
    if (wall) for (const s of [-1, 1]) {
      B.box(dk, 0.04, 0.04, D + 0.12, s * 0.28, y0 - 0.02, zc - 0.02);
      B.rod(dk, 0.012, V(s * 0.28, y0 - 0.02, zf), V(s * 0.28, y0 - 0.32, 0.01), 4);
      B.box(dk, 0.06, 0.4, 0.01, s * 0.28, y0 - 0.15, 0.005);
    }
    else for (const s of [-1, 1]) B.box(body, 0.12, y0, D + 0.06, s * 0.28, y0 / 2, zc);
    const px = W / 2 + 0.11, ytop = y0 + H + 0.55;
    B.rod(pipe, 0.026, V(W / 2 + 0.05, y0 + 0.14, zc + 0.03), V(px, y0 + 0.14, zc + 0.03), 8);
    B.sphere(pipe, 0.027, px, y0 + 0.14, zc + 0.03, 1, 8, 6);
    B.rod(pipe, 0.026, V(px, y0 + 0.14, zc + 0.03), V(px, y0 + 0.3, 0.05), 8);
    B.box(pipe, 0.09, ytop - (y0 + 0.3), 0.075, px, (ytop + y0 + 0.3) / 2, 0.04);
    B.box(pipe, 0.12, 0.1, 0.09, px, ytop, 0.045);
    polyline(B, dk, 0.008, wall ? [V(-0.3, y0, zc), V(-0.32, y0 - 0.5, zc + 0.02), V(-0.3, 0.6, 0.06), V(-0.25, 0.02, 0.12), V(-0.1, 0.01, 0.2)] : [V(-0.3, y0, zc), V(-0.33, 0.02, zc + 0.1), V(-0.2, 0.01, zc + 0.22)], 4);
    const g = B.finish('aircon', SZ);
    const F = new Builder(), fm = M.tint('metalPaint', '#7d8187');
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; F.box(fm, 0.17, 0.08, 0.006, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, 0, 0.45, a); }
    F.cyl(fm, 0.035, 0.05, 0, 0, 0, 10, 1, 0, Math.PI / 2);
    const fan = pivotOf(F, 'fan'); fan.position.set(cx, cy, zf - 0.04); g.add(fan);
    K.anims.push((t, dt) => { fan.rotation.z -= dt * 9; });
    return stat(g, { w: W + 0.3, h: ytop + 0.05, d: D + 0.1 });
  };

  const bicycle: Make = (o = {}) => {
    const paint = M.tint('metalPaint', o.color ?? '#c9d6c0'), ch = chrome, dk = M.metalDark;
    const B = new Builder(), R = 0.33, ay = 0.35, fx = 0.56, rx = -0.56;
    for (const wx of [fx, rx]) {
      B.geo(dk, G.torus(4, 16, 0.067), wx, ay, 0, 0, 0, 0, R, R, R);
      B.geo(ch, G.torus(3, 16, 0.04), wx, ay, 0, 0, 0, 0, 0.305, 0.305, 0.305);
      B.cyl(ch, 0.025, 0.09, wx, ay, 0, 8, 1, 0, Math.PI / 2);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; B.rod(ch, 0.0016, V(wx, ay, (i % 2 ? 0.03 : -0.03)), V(wx + Math.cos(a) * 0.3, ay + Math.sin(a) * 0.3, 0), 3); }
      B.geo(ch, new THREE.TorusGeometry(R + 0.03, 0.035, 2, 10, wx > 0 ? 1.9 : 2.5), wx, ay, 0, 0, 0, wx > 0 ? Math.PI / 2 - 0.6 : Math.PI / 2 - 0.4, 1, 1, 1.4);
    }
    const BB = V(-0.08, 0.3, 0), HT = V(0.4, 0.9, 0), HB = V(0.45, 0.72, 0), ST = V(-0.24, 0.8, 0);
    polyline(B, paint, 0.022, [HB, V(0.3, 0.5, 0), V(0.12, 0.33, 0), BB], 8);
    B.rod(paint, 0.026, HB, HT, 8);
    B.rod(paint, 0.021, BB, ST, 8);
    for (const z of [-0.045, 0.045]) {
      B.rod(paint, 0.011, V(BB.x, BB.y, z * 0.6), V(rx, ay, z), 6);
      B.rod(paint, 0.011, V(-0.22, 0.74, z * 0.4), V(rx, ay, z), 6);
      B.rod(paint, 0.013, V(HB.x, HB.y, z * 0.5), V(fx, ay, z), 6);
    }
    B.box(paint, 0.52, 0.11, 0.02, (BB.x + rx) / 2, (BB.y + ay) / 2 + 0.02, 0.07, 0, 0, Math.atan2(ay - BB.y, rx - BB.x) + Math.PI);
    B.cyl(paint, 0.11, 0.025, BB.x, BB.y, 0.07, 14, 1, 0, Math.PI / 2);
    B.rod(dk, 0.01, V(BB.x, BB.y, 0.09), V(BB.x + 0.08, BB.y - 0.14, 0.1), 4); B.box(dk, 0.1, 0.02, 0.06, BB.x + 0.08, BB.y - 0.15, 0.13);
    B.rod(dk, 0.01, V(BB.x, BB.y, -0.09), V(BB.x - 0.08, BB.y + 0.14, -0.1), 4); B.box(dk, 0.1, 0.02, 0.06, BB.x - 0.08, BB.y + 0.15, -0.13);
    B.rod(ch, 0.013, ST, V(-0.26, 0.92, 0), 6);
    B.geo(dk, G.sph(10, 6), -0.28, 0.955, 0, 0, 0, 0, 0.13, 0.045, 0.1);
    for (const z of [-0.04, 0.04]) B.geo(ch, G.torus(3, 8, 0.25), -0.34, 0.92, z, Math.PI / 2, 0, 0, 0.018, 0.018, 0.018);
    B.rod(ch, 0.012, HT, V(0.38, 1.0, 0), 6);
    for (const z of [-1, 1]) {
      polyline(B, ch, 0.011, [V(0.38, 1.0, 0), V(0.36, 1.02, z * 0.2), V(0.23, 1.0, z * 0.27)], 6);
      B.rod(dk, 0.016, V(0.23, 1.0, z * 0.27), V(0.12, 0.99, z * 0.29), 6);
    }
    B.sphere(ch, 0.02, 0.33, 1.03, 0.16, 0.7, 6, 4);
    B.cyl(ch, 0.032, 0.07, 0.5, 0.66, 0, 10, 0.8, 0, 0, Math.PI / 2);
    if (o.basket ?? true) {
      const bx = 0.62, by = 0.86, w = 0.17, d = 0.16, hh = 0.22;
      const c = [V(bx - w, by, -d), V(bx + w, by, -d), V(bx + w, by, d), V(bx - w, by, d)];
      for (let i = 0; i < 4; i++) { const a = c[i], b2 = c[(i + 1) % 4]; B.rod(ch, 0.004, a, b2, 3); B.rod(ch, 0.004, V(a.x, a.y + hh, a.z), V(b2.x, b2.y + hh, b2.z), 3); B.rod(ch, 0.004, a, V(a.x, a.y + hh, a.z), 3); }
      for (let i = 1; i < 6; i++) { const x = bx - w + i * w / 3; for (const z of [-d, d]) B.rod(ch, 0.0025, V(x, by, z), V(x, by + hh, z), 3); }
      for (let i = 1; i < 4; i++) { const z = -d + i * d / 2; for (const x of [bx - w, bx + w]) B.rod(ch, 0.0025, V(x, by, z), V(x, by + hh, z), 3); }
      for (let i = 1; i < 4; i++) B.rod(ch, 0.0025, V(bx - w, by, -d + i * d / 2), V(bx + w, by, -d + i * d / 2), 3);
      B.rod(ch, 0.006, V(bx - w, by, 0), V(0.47, 0.7, 0), 3);
    }
    for (const z of [-0.07, 0, 0.07]) B.rod(ch, 0.006, V(-0.24, 0.73, z), V(-0.75, 0.73, z), 3);
    for (const x of [-0.3, -0.72]) B.rod(ch, 0.006, V(x, 0.73, -0.07), V(x, 0.73, 0.07), 3);
    for (const z of [-0.07, 0.07]) { B.rod(ch, 0.006, V(-0.72, 0.73, z), V(rx, ay, z * 0.7), 3); B.rod(dk, 0.008, V(rx, ay, z * 0.8), V(rx - 0.05, 0.0, z * 1.8), 4); }
    B.box(dk, 0.05, 0.08, 0.04, -0.42, 0.5, 0.05);
    const g = B.finish('bicycle', SZ);
    return stat(g, { w: 1.6, h: 1.1, d: 0.6 });
  };

  const clothesTex = () => K.tex('laundry', 256, 256, (g, w, h, r) => {
    g.clearRect(0, 0, w, h);
    const cell = (i: number, fn: (x: number, y: number) => void) => { g.save(); g.translate((i % 4) * 64, Math.floor(i / 4) * 128); fn(0, 0); g.restore(); };
    const shirt = (c: string, stripe?: string) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(20, 4); g.lineTo(0, 22); g.lineTo(8, 40); g.lineTo(14, 34); g.lineTo(14, 124); g.lineTo(50, 124); g.lineTo(50, 34); g.lineTo(56, 40); g.lineTo(64, 22); g.lineTo(44, 4); g.quadraticCurveTo(32, 14, 20, 4); g.fill();
      if (stripe) { g.fillStyle = stripe; for (let x = 16; x < 50; x += 7) g.fillRect(x, 20, 2, 104); }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(14, 60, 36, 2); grain(g, 64, 128, r, 0.15, false);
    };
    cell(0, () => shirt('#f2f0ea'));
    cell(1, () => shirt('#bcd4ec', '#7fa3d0'));
    cell(2, () => { g.fillStyle = '#f6f4ee'; g.fillRect(8, 0, 48, 128); g.fillStyle = '#2f5aa0'; g.fillRect(8, 96, 48, 10); g.fillStyle = '#2f5aa0'; htext(g, '湯', 32, 60, 30, 1, MINCHO, '900'); });
    cell(3, () => { g.fillStyle = '#26386a'; g.fillRect(14, 0, 36, 128); g.fillStyle = '#e8eef6'; for (let y = 6; y < 128; y += 12) for (let x = 18 + (y % 24 ? 6 : 0); x < 50; x += 12) { g.beginPath(); g.arc(x, y, 3, 0, 6.29); g.fill(); } });
    cell(4, () => { g.fillStyle = '#2a3348'; g.beginPath(); g.moveTo(6, 0); g.lineTo(58, 0); g.lineTo(60, 124); g.lineTo(36, 124); g.lineTo(32, 40); g.lineTo(28, 124); g.lineTo(4, 124); g.fill(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(6, 4, 52, 4); });
    cell(5, () => { shirt('#3d4f7c'); g.strokeStyle = '#e6e9f0'; g.lineWidth = 1.5; for (let y = 30; y < 124; y += 14) { g.beginPath(); g.moveTo(14, y); g.lineTo(50, y + 6); g.stroke(); } });
    cell(6, () => { g.fillStyle = '#8f9296'; for (const x of [10, 36]) { g.fillRect(x, 0, 16, 70); g.beginPath(); g.ellipse(x + 13, 72, 13, 9, 0, 0, 6.29); g.fill(); } g.fillStyle = '#5a5d62'; g.fillRect(10, 0, 42, 6); });
    cell(7, () => { g.fillStyle = '#1d2b50'; g.fillRect(4, 10, 56, 116); g.fillStyle = '#c9a24a'; g.fillRect(4, 2, 56, 8); g.fillStyle = '#f2efe6'; vtext(g, '酒', 32, 66, 40, 1, MINCHO, '900'); });
  });
  const laundry: Make = (o = {}) => {
    const w = o.w ?? 2.4, n = o.n ?? 7, h = o.h ?? 1.75, stands = o.stands ?? true, r = rng(o.seed ?? 3);
    const mat = K.cloth(clothesTex(), 0, 0.055, h, 0.9, true);
    const B = new Builder();
    const sizes = [[0.6, 0.62], [0.55, 0.7], [0.36, 0.8], [0.28, 0.85], [0.45, 0.82], [0.55, 0.62], [0.24, 0.34], [0.46, 0.58]];
    const order = Array.from({ length: 8 }, (_, i) => i).sort(() => r() - 0.5);
    let x = 0.15;
    for (let i = 0; i < n && x < w - 0.2; i++) {
      const k = order[i % 8], [gw, gh] = sizes[k];
      const u0 = (k % 4) / 4, v1 = 1 - Math.floor(k / 4) / 2;
      B.geo(mat, planeUV(gw, gh, 3, 4, u0, v1 - 0.5, u0 + 0.25, v1), x + gw / 2, h - 0.012 - gh / 2, 0);
      for (const px of [x + 0.04, x + gw - 0.04]) B.box(chrome, 0.012, 0.05, 0.02, px, h - 0.01, 0.015);
      x += gw + 0.05 + r() * 0.08;
    }
    B.cyl(M.bamboo, 0.018, w + 0.3, w / 2, h + 0.01, 0, 8, 1, 0, 0, Math.PI / 2);
    if (stands) for (const sx of [0, w]) {
      B.cyl(chrome, 0.02, h + 0.08, sx, (h + 0.08) / 2, -0.03, 8);
      B.cyl(chrome, 0.17, 0.07, sx, 0.035, -0.03, 10, 0.85);
      for (const s of [-1, 1]) B.rod(chrome, 0.009, V(sx, h - 0.08, -0.03), V(sx, h + 0.06, -0.03 + s * 0.09), 4);
    }
    return stat(B.finish('laundry', SZ), { w, h: h + 0.1, d: 0.4 });
  };

  const broom: Make = (o = {}) => {
    const B = new Builder(), r = rng(o.seed ?? 5), tw = M.tint('straw', '#8a7650');
    const T = V(0, 1.55, 0.03), Bn = V(0, 0.42, 0.36), d = Bn.clone().sub(T).normalize();
    B.rod(M.bamboo, 0.015, T, Bn.clone().addScaledVector(d, 0.05), 7);
    B.rod(M.rope, 0.03, Bn.clone().addScaledVector(d, -0.04), Bn.clone().addScaledVector(d, 0.03), 8);
    B.rod(M.rope, 0.027, Bn.clone().addScaledVector(d, 0.1), Bn.clone().addScaledVector(d, 0.14), 8);
    for (let i = 0; i < 20; i++) {
      const sx = (i / 19 - 0.5) * 0.4 + (r() - 0.5) * 0.03, end = V(sx, 0.005, 0.47 + (r() - 0.5) * 0.08 + Math.abs(sx) * -0.08);
      const mid = Bn.clone().lerp(end, 0.5).add(V(sx * 0.15, 0.03, (r() - 0.5) * 0.04));
      const a = Bn.clone().add(V(sx * 0.12, 0, 0));
      B.rod(tw, 0.0045, a, mid, 3); B.rod(tw, 0.003, mid, end, 3);
    }
    if (o.bucket ?? true) {
      const bk = M.tint('metalPaint', '#9ea4a7'), bx = 0.45, bz = 0.3;
      const out = [[0.115, 0], [0.15, 0.27], [0.156, 0.28]].map(([a, b]) => new THREE.Vector2(a, b));
      B.geo(bk, new THREE.LatheGeometry(out, 14), bx, 0, bz);
      B.geo(bk, new THREE.LatheGeometry(out.map((p) => new THREE.Vector2(p.x - 0.006, p.y)).reverse(), 14), bx, 0, bz);
      B.geo(bk, G.disc(14), bx, 0.02, bz, 0, 0, 0, 0.11, 1, 0.11);
      B.geo(bk, G.torus(3, 16, 0.04), bx, 0.275, bz, 0, Math.PI / 2, 0, 0.155, 0.155, 0.155);
      for (const s of [-1, 1]) B.box(bk, 0.02, 0.03, 0.02, bx + s * 0.152, 0.25, bz);
      const arc: THREE.Vector3[] = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; arc.push(V(bx + Math.cos(a) * 0.152, 0.25 + Math.sin(a) * 0.05, bz - Math.sin(a) * 0.13)); }
      polyline(B, bk, 0.003, arc, 3);
      B.cyl(M.bamboo, 0.035, 0.06, bx + 0.05, 0.2, bz + 0.02, 10);
      B.rod(M.bamboo, 0.006, V(bx + 0.05, 0.2, bz + 0.02), V(bx - 0.08, 0.48, bz + 0.22), 4);
    }
    return stat(B.finish('broom', SZ), { w: 0.7, h: 1.6, d: 0.6 });
  };

  // ---------------- macetas ----------------
  const potKinds = ['fern', 'pine', 'flowers', 'asagao', 'azalea'] as const;
  const glazes = ['#2b3d66', '#6f9a8a', '#6b3f2a', '#2a2a30', '#8a9cb0'];
  function plantInto(B: Builder, v: VC, x: number, z: number, kind: string, pot: string, s: number, r: () => number) {
    let top: number;
    if (pot === 'foam') { B.box(M.tint('plaster', '#ecebe4'), 0.5 * s, 0.18 * s, 0.32 * s, x, 0.09 * s, z); top = 0.17 * s; v.add(G.box(), '#3a2a20', x, top, z, [0.46 * s, 0.01, 0.28 * s]); }
    else {
      const pts = pot === 'glaze' ? [[0.09, 0], [0.12, 0.02], [0.14, 0.18], [0.156, 0.2], [0.15, 0.215]] : [[0.08, 0], [0.13, 0.2], [0.146, 0.2], [0.146, 0.235], [0.13, 0.235]];
      const gi = Math.floor(r() * glazes.length), m = pot === 'glaze' ? M.tint('ceramic', glazes[glazeFix >= 0 ? glazeFix : gi]) : M.tint('earth', '#a4583a');
      B.geo(m, cached2(pot), x, 0, z, r() * 6, 0, 0, s, s, s);
      top = (pot === 'glaze' ? 0.2 : 0.225) * s;
      v.add(G.disc(10), '#3a2a20', x, top - 0.005, z, [(pot === 'glaze' ? 0.15 : 0.135) * s, 1, (pot === 'glaze' ? 0.15 : 0.135) * s]);
    }
    const lf = M.leaf, ld = M.leafDark;
    if (kind === 'fern') for (let i = 0; i < 11; i++) {
      const a = i * 2.4 + r(), tl = 0.25 + r() * 0.5, L = (0.22 + r() * 0.14) * s;
      const dir = V(Math.sin(a) * Math.sin(tl), Math.cos(tl), Math.cos(a) * Math.sin(tl));
      B.geo(i % 3 ? lf : ld, G.oct(), x + dir.x * L, top + dir.y * L, z + dir.z * L, a, tl, 0, 0.035 * s, L, 0.008 * s);
    }
    else if (kind === 'pine') {
      const pts = [V(x, top, z), V(x + 0.05 * s, top + 0.12 * s, z), V(x - 0.04 * s, top + 0.24 * s, z + 0.02 * s), V(x + 0.02 * s, top + 0.34 * s, z)];
      polyline(B, M.bark, 0.022 * s, pts, 6);
      const pads = [[0.14, 0.2, 0.02], [-0.13, 0.28, -0.02], [0.05, 0.38, 0.03], [-0.02, 0.16, 0.08]];
      for (const [px, py, pz] of pads) { B.rod(M.bark, 0.01 * s, pts[2], V(x + px * s * 0.8, top + py * s, z + pz * s), 4); B.geo(ld, G.ico1(), x + px * s, top + py * s + 0.02 * s, z + pz * s, r() * 3, 0, 0, 0.12 * s, 0.05 * s, 0.1 * s); }
    }
    else if (kind === 'flowers' || kind === 'azalea') {
      const az = kind === 'azalea', R = (az ? 0.2 : 0.14) * s;
      B.geo(az ? ld : lf, G.ico1(), x, top + R * 0.5, z, r() * 3, 0, 0, R, R * (az ? 0.8 : 0.55), R);
      const cols = az ? ['#f06aa0', '#e8548c', '#f59ac0'] : ['#f4f0e6', '#f2c43c', '#d64a8a', '#8a5ad0'];
      for (let i = 0; i < (az ? 22 : 14); i++) {
        const a = r() * 6.28, e = r() * 1.2;
        v.add(G.ico0(), cols[Math.floor(r() * cols.length)], x + Math.cos(a) * Math.cos(e) * R * 0.95, top + R * 0.5 + Math.sin(e) * R * (az ? 0.8 : 0.55), z + Math.sin(a) * Math.cos(e) * R * 0.95, 0.022 * s);
      }
    }
    else if (kind === 'asagao') {
      const H = 0.75 * s;
      for (let i = 0; i < 3; i++) { const a = i * 2.09; B.rod(M.bamboo, 0.006 * s, V(x + Math.cos(a) * 0.08 * s, top, z + Math.sin(a) * 0.08 * s), V(x + Math.cos(a) * 0.11 * s, top + H, z + Math.sin(a) * 0.11 * s), 4); }
      B.geo(M.bamboo, G.torus(3, 12, 0.06), x, top + H, z, 0, Math.PI / 2, 0, 0.11 * s, 0.11 * s, 0.11 * s);
      const fc = ['#3a5ad8', '#7a3ac0', '#e05a9a', '#4a8ae8'];
      for (let i = 0; i < 18; i++) {
        const a = i * 1.1, yy = top + 0.05 * s + (i / 18) * H, rr = 0.1 * s;
        const lx = x + Math.cos(a) * rr, lz = z + Math.sin(a) * rr;
        B.geo(lf, G.ico0(), lx, yy, lz, a, 0, 0, 0.045 * s, 0.04 * s, 0.012 * s);
        if (i % 3 === 1) v.add(G.cone(8), '#f4f4f4', lx + Math.cos(a) * 0.03 * s, yy, lz + Math.sin(a) * 0.03 * s, [0.03 * s, 0.035 * s, 0.03 * s], [0, -a + Math.PI / 2, Math.PI / 2], fc[i % 4]);
      }
    }
  }
  let glazeFix = -1;
  const potGeo = new Map<string, THREE.BufferGeometry>();
  function cached2(pot: string) {
    let g = potGeo.get(pot);
    if (!g) {
      const pts = pot === 'glaze' ? [[0.09, 0], [0.12, 0.02], [0.14, 0.18], [0.156, 0.2], [0.15, 0.215]] : [[0.08, 0], [0.13, 0.2], [0.146, 0.2], [0.146, 0.235], [0.13, 0.235]];
      g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 12); potGeo.set(pot, g);
    }
    return g;
  }
  const maceta: Make = (o = {}) => {
    const r = rng(o.seed ?? 1), B = new Builder(), v = new VC();
    plantInto(B, v, 0, 0, o.kind ?? 'fern', o.pot ?? 'glaze', o.s ?? 1, r);
    const g = B.finish('maceta', SZ); g.add(v.mesh(K.vc));
    return stat(g, { w: 0.4, h: 0.6, d: 0.4 });
  };
  const jardinera: Make = (o = {}) => {
    const w = o.w ?? 1.6, r = rng(o.seed ?? 7), B = new Builder(), v = new VC(), wd = M.woodWeathered;
    glazeFix = (o.seed ?? 7) % glazes.length;
    for (const [y, z] of [[0.3, 0.05], [0.55, -0.18]]) {
      for (let i = 0; i < 3; i++) B.box(wd, w, 0.02, 0.07, 0, y, z - 0.08 + i * 0.08);
      for (const sx of [-1, 1]) B.box(wd, 0.04, y, 0.04, sx * (w / 2 - 0.05), y / 2, z);
    }
    B.box(wd, 0.03, 0.03, 0.32, -w / 2 + 0.05, 0.28, -0.06, 0, 0.6);
    let x = -w / 2 + 0.17;
    while (x < w / 2 - 0.12) {
      const kind = potKinds[Math.floor(r() * potKinds.length)], s = 0.7 + r() * 0.35;
      const tier = r() < 0.5;
      B.merge(tmpPlant(kind, r() < 0.55 ? 'glaze' : 'terra', s, r, v, x, tier ? 0.31 : 0.56, tier ? 0.05 : -0.18), 0, 0, 0);
      x += 0.24 * s + 0.06;
    }
    for (let i = 0; i < 2; i++) B.merge(tmpPlant(potKinds[Math.floor(r() * 5)], i ? 'foam' : 'terra', 0.9, r, v, -w / 2 + 0.3 + i * (w - 0.6), 0, 0.35), 0, 0, 0);
    glazeFix = -1;
    const g = B.finish('jardinera', SZ); g.add(v.mesh(K.vc));
    return stat(g, { w, h: 1.3, d: 0.7 });
  };
  function tmpPlant(kind: string, pot: string, s: number, r: () => number, v: VC, x: number, y: number, z: number) {
    const b = new Builder(), v2 = new VC();
    plantInto(b, v2, x, z, kind, pot, s, r);
    // desplaza la parte de color por vértice a la altura del estante
    for (let i = 1; i < v2.pos.length; i += 3) v2.pos[i] += y;
    v.pos.push(...v2.pos); v.nor.push(...v2.nor); v.col.push(...v2.col);
    const out = new Builder(); out.merge(b, 0, y, 0); return out;
  }

  return { chochin, festival, noren, nobori, kanban, lightbox, vending, mailbox, toro, jizo, furin, kazaguruma, cables, aircon, bicycle, laundry, broom, maceta, jardinera };
}
