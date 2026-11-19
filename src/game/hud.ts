// Interfaz: vida, tormenta, distancia, mejoras, recarga del impulso junto al cursor, línea de puntería,
// avisos, pantalla de fin y menú de calidad (Esc).
import type { Quality } from './contracts';
import { QUALITY_NAMES, saveQuality } from './settings';

export function createHud(quality: Quality) {
  const css = document.createElement('style');
  css.textContent = `
  .hud { position: fixed; inset: 0; pointer-events: none; font-family: "Shippori Mincho", "Yu Mincho", Georgia, serif; color: #fff4e6; user-select: none; }
  .hud .title { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); text-align: center; letter-spacing: .5em; transition: opacity 2s; text-shadow: 0 2px 24px rgba(20,0,30,.8); }
  .hud .title h1 { margin: 0; font-weight: 400; font-size: clamp(34px, 6vw, 76px); padding-left: .5em; }
  .hud .title p { margin: .5em 0 0; font-size: clamp(12px, 1.3vw, 15px); letter-spacing: .35em; opacity: .9; }
  .hud .life { position: absolute; left: 24px; top: 22px; width: 220px; height: 8px; border-radius: 4px; background: rgba(20,10,30,.45); overflow: hidden; box-shadow: 0 0 0 1px rgba(255,240,220,.25); }
  .hud .life i { position: absolute; inset: 0; width: 100%; background: linear-gradient(90deg, #ff6a4a, #ffd27a); transition: width .15s; }
  .hud .lifeL { position: absolute; left: 24px; top: 36px; font-size: 11px; letter-spacing: .25em; opacity: .7; }
  .hud .storm { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); font-size: 13px; letter-spacing: .3em; text-align: center; transition: color .3s; text-shadow: 0 1px 10px rgba(0,0,0,.7); }
  .hud .storm b { display: block; font-size: 22px; letter-spacing: .1em; font-weight: 400; }
  .hud .dist { position: absolute; right: 24px; top: 20px; font-size: 22px; letter-spacing: .1em; text-align: right; text-shadow: 0 1px 10px rgba(0,0,0,.6); }
  .hud .dist small { display: block; font-size: 11px; letter-spacing: .25em; opacity: .7; }
  .hud .ups { position: absolute; right: 24px; top: 70px; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; font-size: 11px; letter-spacing: .15em; opacity: .85; }
  .hud .ups span { background: rgba(30,15,40,.45); padding: 3px 10px; border-radius: 10px; border: 1px solid rgba(255,220,170,.25); }
  .hud .toast { position: absolute; left: 50%; top: 30%; transform: translate(-50%, 0) scale(.96); font-size: 20px; letter-spacing: .3em; opacity: 0; transition: opacity .4s, transform .4s; text-align: center; text-shadow: 0 2px 18px rgba(30,0,40,.9); }
  .hud .toast small { display: block; font-size: 12px; letter-spacing: .3em; opacity: .8; margin-top: 6px; }
  .hud .toast.on { opacity: 1; transform: translate(-50%, 0) scale(1); }
  .hud .keys { position: absolute; left: 24px; bottom: 18px; font-size: 11px; letter-spacing: .12em; opacity: .55; line-height: 1.7; }
  .hud .ring { position: absolute; width: 34px; height: 34px; margin: -17px 0 0 -17px; }
  .hud canvas.aim { position: absolute; inset: 0; width: 100%; height: 100%; }
  .hud .over { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; background: radial-gradient(ellipse at center, rgba(20,5,25,.55), rgba(0,0,0,.85)); letter-spacing: .3em; text-align: center; }
  .hud .over h2 { font-weight: 400; font-size: clamp(26px, 4vw, 46px); margin: 0 0 .4em; }
  .hud .over p { margin: .3em 0; opacity: .85; }
  .hud .menu { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 14px; background: rgba(10,5,20,.7); pointer-events: auto; letter-spacing: .25em; }
  .hud .menu h3 { font-weight: 400; margin: 0 0 6px; }
  .hud .menu .row { display: flex; gap: 10px; }
  .hud .menu button { font: inherit; letter-spacing: .2em; color: #fff4e6; background: rgba(255,240,220,.08); border: 1px solid rgba(255,230,200,.35); border-radius: 8px; padding: 10px 18px; cursor: pointer; }
  .hud .menu button.on { background: rgba(255,170,90,.35); border-color: #ffc890; }
  .hud .menu small { opacity: .7; letter-spacing: .15em; max-width: 520px; text-align: center; line-height: 1.6; }
  `;
  document.head.appendChild(css);
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <canvas class="aim"></canvas>
    <div class="title"><h1>YŪGURE</h1><p>夕暮れ · la tormenta despierta</p></div>
    <div class="life"><i></i></div><div class="lifeL">VIDA</div>
    <div class="storm"><b>—</b>TORMENTA</div>
    <div class="dist">0 m<small>RÉCORD 0 m</small></div>
    <div class="ups"></div>
    <div class="toast"></div>
    <svg class="ring" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" fill="none" stroke="rgba(255,240,220,.18)" stroke-width="3"/><circle class="arc" cx="17" cy="17" r="13" fill="none" stroke="#ffcf8a" stroke-width="3" stroke-linecap="round" transform="rotate(-90 17 17)" stroke-dasharray="81.7" stroke-dashoffset="0"/><text class="ch" x="17" y="21" text-anchor="middle" font-size="11" fill="#fff4e6"></text></svg>
    <div class="keys">← → ↑ ↓ / WASD moverse · ESPACIO saltar (mantener: más alto) · CLIC en el aire: impulso apuntado · ESC gráficos · P foto</div>
    <div class="over"><h2>La tormenta te alcanzó</h2><p class="od"></p><p class="ob"></p><p style="margin-top:1.6em;opacity:.7">ESPACIO para volver a la compuerta</p></div>
    <div class="menu"><h3>Calidad gráfica</h3><div class="row"></div><small>Bajo: para gráficas integradas (Intel UHD/Iris). Ultra: sombras 4K, MSAA, más distancia y densidad. El cambio recarga el juego.</small><button class="close">Volver</button></div>`;
  document.body.appendChild(el);
  const $ = <T extends Element = HTMLElement>(s: string) => el.querySelector(s) as T;
  const aim = $<HTMLCanvasElement>('canvas.aim'), actx = aim.getContext('2d')!;
  const ring = $<SVGElement>('.ring'), arc = $<SVGCircleElement>('.arc'), ch = $<SVGTextElement>('.ch');
  let toastT = 0;

  const row = $('.menu .row');
  for (const q of ['low', 'medium', 'high', 'ultra'] as Quality[]) {
    const b = document.createElement('button');
    b.textContent = QUALITY_NAMES[q]; if (q === quality) b.className = 'on';
    b.onclick = () => { saveQuality(q); location.reload(); };
    row.appendChild(b);
  }
  let menuOpen = false;
  const menu = $('.menu');
  const setMenu = (on: boolean) => { menuOpen = on; menu.style.display = on ? 'flex' : 'none'; };
  $<HTMLButtonElement>('.menu .close').onclick = () => setMenu(false);

  function resize() { aim.width = innerWidth; aim.height = innerHeight; }
  resize(); addEventListener('resize', resize);

  return {
    get menuOpen() { return menuOpen; },
    toggleMenu() { setMenu(!menuOpen); },
    titleOff() { $('.title').style.opacity = '0'; },
    life(v: number) { ($('.life i') as HTMLElement).style.width = `${Math.max(0, v) * 100}%`; },
    storm(gap: number, danger: number) {
      const s = $('.storm');
      s.querySelector('b')!.textContent = gap > 0 ? `${Math.round(gap)} m` : 'DENTRO';
      s.style.color = danger > 0.75 ? '#ff7a6a' : danger > 0.45 ? '#ffc890' : '#fff4e6';
    },
    dist(m: number, best: number, score = 0, mult = 1) { $('.dist').innerHTML = `${Math.round(score).toLocaleString('es')}<small>PUNTOS · x${mult.toFixed(1)}</small><small>${Math.round(m)} m · RÉCORD ${Math.round(Math.max(best, m))} m</small>`; },
    ups(list: string[]) { $('.ups').innerHTML = list.map((u) => `<span>${u}</span>`).join(''); },
    toast(t: string, sub = '', ms = 1600) {
      const e = $('.toast'); e.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); e.classList.add('on');
      clearTimeout(toastT); toastT = window.setTimeout(() => e.classList.remove('on'), ms);
    },
    /** recarga del impulso junto al cursor: k 0..1 (1 = listo), cargas disponibles */
    dashRing(mx: number, my: number, k: number, charges: number, show: boolean) {
      ring.style.display = show ? 'block' : 'none';
      ring.style.left = `${mx + 26}px`; ring.style.top = `${my + 26}px`;
      arc.setAttribute('stroke-dashoffset', String(81.7 * (1 - k)));
      arc.setAttribute('stroke', charges > 0 ? '#ffcf8a' : 'rgba(255,240,220,.5)');
      ch.textContent = charges > 1 ? String(charges) : '';
    },
    /** línea de puntería desde el personaje (px) hacia el cursor */
    aim(on: boolean, x0 = 0, y0 = 0, x1 = 0, y1 = 0) {
      actx.clearRect(0, 0, aim.width, aim.height);
      if (!on) return;
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const len = Math.min(L, 220);
      const g = actx.createLinearGradient(x0, y0, x0 + ux * len, y0 + uy * len);
      g.addColorStop(0, 'rgba(255,220,160,0)'); g.addColorStop(1, 'rgba(255,220,160,.95)');
      actx.strokeStyle = g; actx.lineWidth = 3; actx.lineCap = 'round';
      actx.beginPath(); actx.moveTo(x0 + ux * 30, y0 + uy * 30); actx.lineTo(x0 + ux * len, y0 + uy * len); actx.stroke();
      actx.fillStyle = 'rgba(255,230,180,.95)';
      actx.beginPath(); const tx = x0 + ux * len, ty = y0 + uy * len;
      actx.moveTo(tx + ux * 12, ty + uy * 12); actx.lineTo(tx - uy * 7, ty + ux * 7); actx.lineTo(tx + uy * 7, ty - ux * 7); actx.fill();
    },
    over(dist: number, best: number) {
      const o = $('.over'); o.style.display = 'flex';
      $('.od').textContent = `${Math.round(dist)} m recorridos`;
      $('.ob').textContent = dist >= best ? '¡Nuevo récord!' : `Récord: ${Math.round(best)} m`;
    },
  };
}
export type Hud = ReturnType<typeof createHud>;
