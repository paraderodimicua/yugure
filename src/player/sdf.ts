// Campos de distancia con uniones suaves + poligonización "surface nets" (rejilla anisótropa).
// Todo se ejecuta una vez al cargar; nada de esto corre por fotograma.

export type F3 = (x: number, y: number, z: number) => number;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export function smin(a: number, b: number, k: number) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a: number, b: number, k: number) { return -smin(-a, -b, k); }

/** elipsoide alineado con los ejes (aproximación de iq, buena cerca de la superficie) */
export function ell(x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = px / rx, qy = py / ry, qz = pz / rz;
  const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
/** cono redondeado lineal entre a (ra) y b (rb) */
export function rc(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, ra: number, rb: number) {
  const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  let t = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
}
export function rbox(x: number, y: number, z: number, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, r: number) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

export type Poly = { pos: Float32Array; nor: Float32Array; idx: Uint32Array; ao: Float32Array; adj: Int32Array[] };

/**
 * Surface nets: un vértice por celda cortada, un quad por arista cortada. Después se proyecta cada vértice
 * sobre la superficie (Newton) y la normal sale del gradiente del campo → superficie lisa sin facetas.
 * keep(cx,cy,cz) descarta triángulos ocultos (bajo ropa) por su centroide.
 */
export function polygonize(f: F3, min: number[], max: number[], h: number[], keep?: (x: number, y: number, z: number) => boolean): Poly {
  const nx = Math.ceil((max[0] - min[0]) / h[0]) + 1, ny = Math.ceil((max[1] - min[1]) / h[1]) + 1, nz = Math.ceil((max[2] - min[2]) / h[2]) + 1;
  const val = new Float32Array(nx * ny * nz);
  const id = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[id(i, j, k)] = f(min[0] + i * h[0], min[1] + j * h[1], min[2] + k * h[2]);
  const cell = new Int32Array(nx * ny * nz).fill(-1);
  const P: number[] = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { const v = val[id(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; cv[c] = v; if (v < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += (a & 1) + (((b & 1) - (a & 1)) * t); sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t); sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t); n++;
    }
    cell[id(i, j, k)] = P.length / 3;
    P.push(min[0] + (i + sx / n) * h[0], min[1] + (j + sy / n) * h[1], min[2] + (k + sz / n) * h[2]);
  }
  const Q: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) Q.push(d, c, b, a); else Q.push(a, b, c, d); };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = val[id(i, j, k)] < 0;
    if (i < nx - 1 && j > 0 && k > 0 && v0 !== (val[id(i + 1, j, k)] < 0))
      quad(cell[id(i, j - 1, k - 1)], cell[id(i, j, k - 1)], cell[id(i, j, k)], cell[id(i, j - 1, k)], !v0);
    if (j < ny - 1 && i > 0 && k > 0 && v0 !== (val[id(i, j + 1, k)] < 0))
      quad(cell[id(i - 1, j, k - 1)], cell[id(i - 1, j, k)], cell[id(i, j, k)], cell[id(i, j, k - 1)], !v0);
    if (k < nz - 1 && i > 0 && j > 0 && v0 !== (val[id(i, j, k + 1)] < 0))
      quad(cell[id(i - 1, j - 1, k)], cell[id(i, j - 1, k)], cell[id(i, j, k)], cell[id(i - 1, j, k)], !v0);
  }
  // proyección sobre la superficie + normales del gradiente
  const nv = P.length / 3, pos = new Float32Array(P), nor = new Float32Array(nv * 3);
  const e = Math.min(h[0], h[1], h[2]) * 0.2;
  const grad = (x: number, y: number, z: number, o: number[]) => {
    o[0] = f(x + e, y, z) - f(x - e, y, z); o[1] = f(x, y + e, z) - f(x, y - e, z); o[2] = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(o[0], o[1], o[2]) || 1; o[0] /= l; o[1] /= l; o[2] /= l;
  };
  const g = [0, 0, 0], lim = Math.max(h[0], h[1], h[2]) * 0.6;
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const x0 = x, y0 = y, z0 = z;
    for (let it = 0; it < 1; it++) { const d = f(x, y, z); grad(x, y, z, g); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d; }
    const dx = x - x0, dy = y - y0, dz = z - z0, dl = Math.hypot(dx, dy, dz);
    if (dl > lim) { x = x0 + (dx * lim) / dl; y = y0 + (dy * lim) / dl; z = z0 + (dz * lim) / dl; }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    grad(x, y, z, g); nor[v * 3] = g[0]; nor[v * 3 + 1] = g[1]; nor[v * 3 + 2] = g[2];
  }
  // oclusión ambiental por campo (marca surcos entre músculos)
  const ao = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], a = nor[v * 3], b = nor[v * 3 + 1], c = nor[v * 3 + 2];
    let occ = 0;
    const D = [0.007, 0.016, 0.034], W = [0.45, 0.35, 0.25];
    for (let s = 0; s < 3; s++) { const d = D[s]; occ += W[s] * Math.max(0, (d - f(x + a * d, y + b * d, z + c * d)) / d); }
    ao[v] = clamp01(1 - occ * 1.25);
  }
  // triángulos (diagonal más corta) + descarte por centroide
  const T: number[] = [];
  const d2 = (a: number, b: number) => { const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2]; return dx * dx + dy * dy + dz * dz; };
  const tri = (a: number, b: number, c: number) => {
    if (keep && !keep((pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3)) return;
    T.push(a, b, c);
  };
  for (let q = 0; q < Q.length; q += 4) {
    const a = Q[q], b = Q[q + 1], c = Q[q + 2], d = Q[q + 3];
    if (d2(a, c) <= d2(b, d)) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
  }
  // compactar
  const remap = new Int32Array(nv).fill(-1);
  let m = 0;
  for (const t of T) if (remap[t] < 0) remap[t] = m++;
  const pos2 = new Float32Array(m * 3), nor2 = new Float32Array(m * 3), ao2 = new Float32Array(m);
  for (let v = 0; v < nv; v++) { const r = remap[v]; if (r < 0) continue; for (let c = 0; c < 3; c++) { pos2[r * 3 + c] = pos[v * 3 + c]; nor2[r * 3 + c] = nor[v * 3 + c]; } ao2[r] = ao[v]; }
  const idx = new Uint32Array(T.length);
  for (let i = 0; i < T.length; i++) idx[i] = remap[T[i]];
  // vecinos (para suavizar pesos)
  const nb: number[][] = Array.from({ length: m }, () => []);
  for (let i = 0; i < idx.length; i += 3) for (let s = 0; s < 3; s++) { const a = idx[i + s], b = idx[i + ((s + 1) % 3)]; if (!nb[a].includes(b)) nb[a].push(b); if (!nb[b].includes(a)) nb[b].push(a); }
  return { pos: pos2, nor: nor2, idx, ao: ao2, adj: nb.map((l) => Int32Array.from(l)) };
}
