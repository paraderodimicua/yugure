// Escenario común: render, cielo, nubes, luz, reflejos del cielo y postprocesado.
// Lo usan el juego (main.ts) y los visores de desarrollo (dev/*.html).
import * as THREE from 'three';
import { createSky, createClouds } from './render/sky';
import { createPost } from './render/post';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export type Shared = {
  sunDir: { value: THREE.Vector3 };
  sunView: { value: THREE.Vector3 };
  time: { value: number };
  fogDens: { value: number };
};

export type StageOpts = {
  cam?: [number, number, number];
  look?: [number, number, number];
  /** centro de la zona con sombras */
  focus?: [number, number, number];
  /** medio lado de la zona con sombras, en metros */
  shadowHalf?: number;
  /** recalcular sombras cada fotograma (objetos en movimiento) */
  dynamicShadows?: boolean;
  fov?: number;
  /** calidad: escalas de resolución, sombras, MSAA y efectos */
  q?: { maxScale: number; minScale: number; shadowSize: number; msaa: number; rays: boolean; bloom: boolean };
};

export type Stage = ReturnType<typeof createStage>;

export function createStage(o: StageOpts = {}) {
  const U: Shared = {
    sunDir: { value: new THREE.Vector3(0.36, 0.135, -1).normalize() },
    sunView: { value: new THREE.Vector3() },
    time: { value: 0 },
    fogDens: { value: 0.00085 },
  };

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = !!o.dynamicShadows;
  renderer.shadowMap.needsUpdate = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov ?? 46, window.innerWidth / window.innerHeight, 0.3, 14000);
  const view = {
    pos: new THREE.Vector3(...(o.cam ?? [-1.6, 12.9, 19.5])),
    look: new THREE.Vector3(...(o.look ?? [7, 13.2, -40])),
    sway: true,
  };

  const sky = createSky(U);
  scene.add(sky);
  const clouds = createClouds(U);
  scene.add(clouds.group);

  // Sol bajo y cálido + cielo violeta rellenando las sombras (nunca negras).
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.55, 0.26), 4.2);
  sun.castShadow = true;
  const ss = o.q?.shadowSize ?? (o.dynamicShadows ? 1024 : 2048);
  sun.shadow.mapSize.set(ss, ss);
  const sc = sun.shadow.camera, half = o.shadowHalf ?? 48;
  sc.left = -half; sc.right = half; sc.top = half * 0.85; sc.bottom = -half * 0.65; sc.near = 1; sc.far = 420;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
  sun.target.position.set(...(o.focus ?? [0, 6, -20]));
  sun.position.copy(sun.target.position).addScaledVector(U.sunDir.value, 200);
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(new THREE.Color(0.26, 0.32, 0.95), new THREE.Color(0.5, 0.28, 0.42), 0.8);
  scene.add(hemi);

  // Reflejos: el cielo real del juego como mapa de entorno para materiales brillantes.
  {
    const envScene = new THREE.Scene();
    envScene.add(createSky(U));
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0, 1, 20000).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
  }

  const post = createPost(renderer, scene, camera);
  let fxaa: ShaderPass | null = null;
  if (o.q) {
    for (const rt of [post.composer.renderTarget1, post.composer.renderTarget2]) { rt.samples = o.q.msaa; rt.dispose(); }
    post.rays.enabled = o.q.rays;
    // FXAA probado: con el render en media precisión de este pipeline produce franjas; se deja fuera.
    void FXAAShader; void ShaderPass;
    post.bloom.enabled = o.q.bloom;
  }

  // Resolución dinámica: escala de render entre 0,55 y el máximo del dispositivo según el tiempo de fotograma.
  const maxScale = Math.min(window.devicePixelRatio, o.q?.maxScale ?? 1.5);
  const minScale = Math.min(maxScale, o.q?.minScale ?? 0.55);
  let scale = maxScale, ft = 1 / 60, lastAdjust = 0;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(scale);
    post.composer.setPixelRatio(renderer.getPixelRatio());
    renderer.setSize(w, h);
    post.composer.setSize(w, h);
    if (fxaa) (fxaa.uniforms.resolution.value as THREE.Vector2).set(1 / (w * scale), 1 / (h * scale));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const tickers: ((t: number, dt: number) => void)[] = [];
  const onTick = (fn: (t: number, dt: number) => void) => { tickers.push(fn); };

  const clock = new THREE.Clock();
  let last = 0;
  function tick(t: number) {
    const dt = Math.min(Math.max(t - last, 0), 0.05); last = t;
    U.time.value = t;
    for (const fn of tickers) fn(t, dt);
    const s = view.sway ? 1 : 0;
    camera.position.set(view.pos.x + Math.sin(t * 0.11) * 0.25 * s, view.pos.y + Math.sin(t * 0.17) * 0.08 * s, view.pos.z);
    camera.lookAt(view.look);
    camera.updateMatrixWorld();
    U.sunView.value.copy(U.sunDir.value).transformDirection(camera.matrixWorldInverse);
    sky.position.copy(camera.position);
    clouds.update(camera, t);
    post.render(U.sunDir.value, t);
  }
  function start() {
    let prev = performance.now();
    const frame = () => {
      const now = performance.now(), d = (now - prev) / 1000; prev = now;
      if (!document.hidden && d < 0.25) ft += (d - ft) * 0.05;
      if (now - lastAdjust > 1500 && !document.hidden) {
        const next = ft > 1 / 38 ? Math.max(minScale, scale - 0.05) : ft < 1 / 50 ? Math.min(maxScale, scale + 0.05) : scale;
        if (Math.abs(next - scale) > 0.01) { scale = next; resize(); }
        lastAdjust = now;
      }
      tick(clock.getElapsedTime()); requestAnimationFrame(frame);
    };
    frame();
  }

  // Captura a resolución fija (base del futuro modo Foto). En desarrollo se guarda en shots/.
  async function shot(name = 'shot.jpg', w = 1600, h = 900) {
    renderer.setPixelRatio(1); post.composer.setPixelRatio(1);
    renderer.setSize(w, h, false); post.composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
    tick(clock.getElapsedTime());
    const data = renderer.domElement.toDataURL('image/jpeg', 0.93);
    resize();
    if (import.meta.env.DEV) await fetch('/__shot', { method: 'POST', body: JSON.stringify({ name, data }) });
    return name;
  }

  const stage = { get scale() { return scale; }, U, renderer, scene, camera, view, sun, hemi, sky, clouds, post, onTick, start, shot, tick };
  (window as any).__y = stage;
  return stage;
}
