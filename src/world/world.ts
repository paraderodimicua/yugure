import * as THREE from 'three';
import { SKY_GLSL } from '../render/shaders';
import { gradientMap, stylize } from '../render/materials';
import type { Shared } from '../stage';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function createWorld(U: Shared) {
  const root = new THREE.Group();
  const grad = gradientMap();
  const toon = (color: number, rim = 1, extra: THREE.MeshToonMaterialParameters = {}) =>
    stylize(new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra }), U, rim);

  const matGlass = toon(0x232b45, 1.5);
  const matLit = stylize(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.9, 0.8) }), U, 0);
  const matTile = toon(0x34415f, 1.0, { side: THREE.DoubleSide });
  const matTileWarm = toon(0x6b4a44, 1.0, { side: THREE.DoubleSide });
  const matWall = toon(0xd9c7ad, 0.4);
  const matWood = toon(0x3a2c28, 0.6);
  const matDark = toon(0x1b1c26, 0.35);

  // --- Tejado de teja detallado -------------------------------------------------
  const PITCH = THREE.MathUtils.degToRad(27);
  function slope(L: number, len: number, side: 1 | -1, detail: number) {
    const TW = 0.46, TR = 0.58;
    const nu = Math.round((L / TW) * 8 * detail), nv = Math.round((len / TR) * 4 * detail);
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3), idx: number[] = [];
    const c = Math.cos(PITCH), s = Math.sin(PITCH);
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * L, v = (j / nv) * len;
      const hgt = 0.10 * Math.pow(Math.abs(Math.sin((Math.PI * u) / TW)), 0.6) + 0.04 * (1 - ((v / TR) % 1));
      const k = (j * (nu + 1) + i) * 3;
      pos[k] = side * (v * c + s * hgt);
      pos[k + 1] = -v * s + c * hgt;
      pos[k + 2] = -u;
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, d = a + nu + 1, e = d + 1;
      if (side > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function house(x: number, zNear: number, L: number, ridgeY: number, len: number, tile: THREE.Material, detail = 1) {
    const g = new THREE.Group();
    for (const sd of [1, -1] as const) {
      const m = new THREE.Mesh(slope(L, len, sd, detail), tile);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, L + 0.3, 12), matDark);
    ridge.rotation.x = Math.PI / 2; ridge.position.set(0, 0.16, -L / 2); ridge.castShadow = true;
    g.add(ridge);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, L + 0.2), matDark);
    base.position.set(0, 0.02, -L / 2); g.add(base);
    for (const e of [0.1, -L - 0.1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), matDark);
      cap.position.set(0, 0.22, e); g.add(cap);
    }
    const halfW = len * Math.cos(PITCH), eaveY = -len * Math.sin(PITCH);
    const wallH = ridgeY + eaveY;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 1.4, wallH, L - 1.2), matWall);
    wall.position.set(0, eaveY - wallH / 2, -L / 2); wall.castShadow = wall.receiveShadow = true;
    g.add(wall);
    // hastial (triángulo bajo el tejado) y alero de madera
    const tri = new THREE.Shape();
    tri.moveTo(-halfW + 0.7, eaveY); tri.lineTo(halfW - 0.7, eaveY); tri.lineTo(0, -0.25); tri.closePath();
    for (const z of [-0.6, -L + 0.6]) {
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), stylize(new THREE.MeshToonMaterial({ color: 0xd9c7ad, gradientMap: grad, side: THREE.DoubleSide }), U, 0.4));
      gm.position.z = z; g.add(gm);
    }
    for (const sd of [1, -1]) {
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, L), matWood);
      fascia.position.set(sd * (halfW - 0.02), eaveY - 0.06, -L / 2); g.add(fascia);
    }
    // ventanas y franja de madera en los costados
    const hr = rng(Math.round(x * 31 + zNear * 7 + 1000));
    for (const sd of [1, -1]) {
      const wx = sd * (halfW - 0.7 + 0.02);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, L - 1.2), matWood);
      band.position.set(wx, eaveY - wallH * 0.48, -L / 2); g.add(band);
      for (let wz = 2.6; wz < L - 2.6; wz += 3.4) {
        const lit = hr() < 0.3;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 2.0), matWood);
        frame.position.set(wx, eaveY - 1.7, -wz); g.add(frame);
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.75), lit ? matLit : matGlass);
        pane.position.set(wx, eaveY - 1.7, -wz); g.add(pane);
      }
    }
    g.position.set(x, ridgeY, zNear);
    root.add(g);
    return g;
  }

  // Casa protagonista (su cumbrera es la línea que guía el plano) y vecinas.
  house(-4.5, 15, 28, 11, 7.2, matTile, 1);
  house(13, -8, 24, 8.4, 6.2, matTileWarm, 0.8);
  house(-19, -18, 26, 9.4, 6.6, matTile, 0.7);
  house(4, -44, 22, 7.6, 6, matTile, 0.6);
  house(27, -40, 22, 9, 6.4, matTileWarm, 0.6);
  house(-36, -52, 24, 8, 6.2, matTileWarm, 0.5);

  // Antena sobre la cumbrera
  {
    const a = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), matDark); mast.position.y = 1.3; a.add(mast);
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1 - i * 0.12, 5), matDark);
      bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.5 + i * 0.24, 0); a.add(bar);
    }
    a.position.set(-4.5, 11.2, -6); a.rotation.y = 0.5; root.add(a);
  }

  // --- Postes y cables ----------------------------------------------------------
  {
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 15, 10);
    const tops: THREE.Vector3[] = [];
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Vector3(6.8 + i * 1.6, 0, 6 - i * 31);
      const pole = new THREE.Mesh(poleGeo, matDark); pole.position.set(p.x, 7.5, p.z); pole.castShadow = true; root.add(pole);
      for (const [y, w] of [[14.2, 2.4], [13.3, 1.7]]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.12), matDark); arm.position.set(p.x, y, p.z); root.add(arm);
      }
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 10), toon(0x6d7480, 1));
      can.position.set(p.x + 0.45, 12.3, p.z); root.add(can);
      tops.push(new THREE.Vector3(p.x, 14.3, p.z));
    }
    const wire = (a: THREE.Vector3, b: THREE.Vector3, sag: number) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16; const q = a.clone().lerp(b, t); q.y -= sag * 4 * t * (1 - t); pts.push(q); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.022, 4), matDark);
      root.add(m);
    };
    for (let i = 0; i < tops.length - 1; i++) {
      for (const [dx, dy, sag] of [[-1.1, 0, 0.9], [0, 0, 1.0], [1.1, 0, 0.85], [-0.7, -0.9, 1.2], [0.7, -0.9, 1.15]])
        wire(tops[i].clone().add(new THREE.Vector3(dx, dy, 0)), tops[i + 1].clone().add(new THREE.Vector3(dx, dy, 0)), sag);
    }
    // cables que entran al plano desde detrás de la cámara
    for (const [dx, dy, sag] of [[-1.1, 0, 1.2], [1.1, 0, 1.1], [0.7, -0.9, 1.5]])
      wire(new THREE.Vector3(5.5 + dx, 14.6 + dy, 40), tops[0].clone().add(new THREE.Vector3(dx, dy, 0)), sag);
    wire(tops[1].clone().add(new THREE.Vector3(-0.7, -0.9, 0)), new THREE.Vector3(-17, 9.2, -30), 1.4);
  }

  // --- Suelo y pueblo instanciado ----------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), toon(0x23262d, 0));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);

  {
    const r = rng(7);
    const N = 1500;
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon(0xffffff, 0.3), N);
    const sh = new THREE.Shape(); sh.moveTo(-0.58, 0); sh.lineTo(0.58, 0); sh.lineTo(0, 0.42); sh.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(sh, { depth: 1.08, bevelEnabled: false }); roofGeo.translate(0, 0, -0.54);
    const roof = new THREE.InstancedMesh(roofGeo, toon(0xffffff, 0.9), N);
    const winGeo = new THREE.PlaneGeometry(1, 1);
    const win = new THREE.InstancedMesh(winGeo, stylize(new THREE.MeshBasicMaterial({ color: 0xffffff }), U, 0), N * 3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const walls = [0xd8c6ab, 0xc9b79f, 0xe2d6c2, 0xb9a48f, 0xcfc0b2];
    const roofs = [0x45506a, 0x3d465c, 0x6a4840, 0x55607a, 0x5a3f3c];
    let n = 0, nw = 0;
    for (let gz = -70; gz > -1400 && n < N; gz -= 15) for (let gx = -900; gx < 900 && n < N; gx += 15) {
      if (r() < 0.22) continue;
      const x = gx + (r() - 0.5) * 6, z = gz + (r() - 0.5) * 6;
      if (Math.abs(x) < 52 && z > -78) continue;
      // el pueblo baja suavemente hacia la bahía de bruma
      const w = 7 + r() * 5, d = 7 + r() * 5, h = 3.5 + r() * 4.5 + (r() < 0.06 ? 6 : 0);
      const turn = r() < 0.5 ? 0 : Math.PI / 2;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d)); body.setMatrixAt(n, m);
      body.setColorAt(n, col.setHex(walls[Math.floor(r() * walls.length)]));
      m.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(w, w * 0.9, d)); roof.setMatrixAt(n, m);
      roof.setColorAt(n, col.setHex(roofs[Math.floor(r() * roofs.length)]));
      // ventanas encendidas mirando a cámara
      const depthZ = (turn === 0 ? d : w) / 2 + 0.03, span = turn === 0 ? w : d;
      for (let k = 0; k < 3; k++) {
        if (r() > 0.42) continue;
        m.compose(new THREE.Vector3(x + (k - 1) * span * 0.28, 1.4 + r() * (h - 2.4), z + depthZ), new THREE.Quaternion(), new THREE.Vector3(1.1, 1.3, 1));
        win.setMatrixAt(nw, m);
        const warm = r(); win.setColorAt(nw, col.setRGB(3.4, 1.7 + warm * 0.7, 0.6 + warm * 0.5)); nw++;
      }
      n++;
    }
    body.count = roof.count = n; win.count = nw;
    for (const im of [body, roof, win]) { im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; root.add(im); }
  }

  // --- Árboles ------------------------------------------------------------------
  {
    const r = rng(21), N = 500;
    const tree = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), toon(0xffffff, 1.2), N);
    const m = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion();
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * 1600, z = -95 - r() * 1100, s = 2.2 + r() * 3;
      m.compose(new THREE.Vector3(x, s * 0.9 + r() * 2, z), q, new THREE.Vector3(s * (0.9 + r() * 0.5), s, s * (0.9 + r() * 0.5)));
      tree.setMatrixAt(i, m);
      const pink = r() < 0.2;
      tree.setColorAt(i, pink ? col.setRGB(0.95, 0.55 + r() * 0.1, 0.62) : col.setRGB(0.10 + r() * 0.06, 0.22 + r() * 0.1, 0.16));
    }
    tree.frustumCulled = false; root.add(tree);
  }

  // --- Árboles protagonistas (cerezos y copas oscuras) --------------------------
  {
    const r = rng(5);
    const ico = new THREE.IcosahedronGeometry(1, 3);
    const big = (x: number, z: number, s: number, color: number) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 4.5 * s, 8), matWood);
      trunk.position.y = 2.2 * s; trunk.castShadow = true; g.add(trunk);
      const mat = toon(color, 0.6);
      for (let i = 0; i < 34; i++) {
        const b = new THREE.Mesh(ico, mat);
        const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 3.4 * s;
        b.position.set(Math.cos(a) * rad, (4.4 + r() * 3.2 - rad * 0.25 / s) * s, Math.sin(a) * rad);
        b.scale.setScalar((0.6 + r() * 0.75) * s); b.castShadow = true; g.add(b);
      }
      g.position.set(x, 0, z); root.add(g);
    };
    big(27, -20, 1.25, 0xf2a0b4);
    big(36, -8, 1.0, 0xf5b3c0);
    big(-27, 2, 1.1, 0x23483a);
    big(19, -62, 1.2, 0xef9db0);
    big(-12, -66, 1.1, 0x23483a);
    big(44, -30, 1.1, 0x23483a);
  }

  // --- Montañas en capas (perspectiva aérea) -----------------------------------
  function ridge(z: number, base: number, amp: number, color: number, seed: number, haze: number) {
    const r = rng(seed), ph = [r() * 9, r() * 9, r() * 9, r() * 9];
    const n = 320, W = 16000, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const x = -W / 2 + (W * i) / n, u = x / 1000;
      const y = base + amp * (0.55 * Math.sin(u * 1.1 + ph[0]) + 0.3 * Math.sin(u * 2.7 + ph[1]) + 0.18 * Math.sin(u * 6.1 + ph[2]) + 0.08 * Math.sin(u * 14 + ph[3]));
      pos.push(x, -20, z, x, Math.max(y, 6), z);
    }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
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
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false; root.add(mesh);
  }
  ridge(-1700, 80, 85, 0x1d1a36, 3, 0.18);
  ridge(-2600, 150, 110, 0x2a2248, 5, 0.42);
  ridge(-3900, 200, 150, 0x3a2a55, 9, 0.66);

  // --- Motas doradas en el aire -------------------------------------------------
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.time },
    vertexShader: /* glsl */ `
      uniform float uTime; attribute float aSeed; varying float vA;
      void main(){
        vec3 box = vec3(46.0, 16.0, 60.0);
        vec3 p = position + vec3(uTime * 0.35, sin(uTime * 0.3 + aSeed * 40.0) * 0.6, uTime * 0.12);
        p = mod(p, box) - box * 0.5 + vec3(2.0, 13.0, -14.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.05 + aSeed * 0.09) * 900.0 / -mv.z;
        vA = (0.6 + 0.4 * sin(uTime * 0.8 + aSeed * 90.0)) * smoothstep(2.0, 7.0, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(vec3(2.6, 1.6, 0.7) * smoothstep(1.0, 0.0, d) * vA * 0.55, 1.0);
      }`,
  });
  {
    const N = 700, r = rng(99), pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = r() * 46; pos[i * 3 + 1] = r() * 16; pos[i * 3 + 2] = r() * 60; seed[i] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const pts = new THREE.Points(g, dustMat); pts.frustumCulled = false; root.add(pts);
  }

  return root;
}
