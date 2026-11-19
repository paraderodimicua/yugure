// Ajustes de calidad gráfica. Se guardan en localStorage y se aplican al recargar.
import type { Quality } from './contracts';

export type QualityCfg = {
  /** escala de render máxima y mínima (resolución dinámica entre ambas) */
  maxScale: number; minScale: number;
  shadowSize: number; shadowHalf: number;
  msaa: number; rays: boolean; bloom: boolean;
  /** metros de calle generados por delante y distancia del detalle fino */
  ahead: number; lodFar: number;
  /** multiplicador de densidad de vegetación, vecinos y partículas */
  density: number;
};

export const PRESETS: Record<Quality, QualityCfg> = {
  low:    { maxScale: 1.0, minScale: 0.7, shadowSize: 1024, shadowHalf: 18, msaa: 0, rays: false, bloom: true, ahead: 80, lodFar: 22, density: 0.6 },
  medium: { maxScale: 1.0, minScale: 0.8, shadowSize: 1024, shadowHalf: 24, msaa: 2, rays: true, bloom: true, ahead: 100, lodFar: 32, density: 0.85 },
  high:   { maxScale: 1.5, minScale: 0.75, shadowSize: 2048, shadowHalf: 30, msaa: 4, rays: true, bloom: true, ahead: 130, lodFar: 50, density: 1 },
  ultra:  { maxScale: 2.0, minScale: 1.0, shadowSize: 4096, shadowHalf: 40, msaa: 4, rays: true, bloom: true, ahead: 170, lodFar: 80, density: 1.3 },
};

export const QUALITY_NAMES: Record<Quality, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', ultra: 'Ultra' };

/** Calidad guardada o, la primera vez, una estimación según la gráfica. */
export function loadQuality(): Quality {
  try {
    const q = localStorage.getItem('yugure.quality') as Quality | null;
    if (q && q in PRESETS) return q;
  } catch { /* sin almacenamiento */ }
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '');
    if (/intel|uhd|iris|mali|adreno|powervr|apple gpu/i.test(name)) return 'low';
    if (/rtx|radeon rx [6-9]|rx 7|arc a7/i.test(name)) return 'high';
    return 'medium';
  } catch { return 'low'; }
}
export function saveQuality(q: Quality) { try { localStorage.setItem('yugure.quality', q); } catch { /* */ } }
