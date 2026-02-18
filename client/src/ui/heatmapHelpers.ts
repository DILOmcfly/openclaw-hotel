/**
 * heatmapHelpers.ts
 * T-364 — Room Activity Heatmap Overlay — Pure helpers (no PixiJS dep)
 *
 * Exported from both HeatmapOverlay and directly for server-side tests.
 */

/**
 * Normalize a raw count to a 0–1 intensity value.
 * Returns 0 if max is 0 (no activity).
 */
export function normalizeIntensity(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0;
  return Math.min(count / max, 1);
}

/**
 * Map intensity (0–1) → rgba string. green → yellow → red gradient.
 * Alpha ranges from 0.15 (min) to 0.75 (max).
 */
export function activityToColor(intensity: number): string {
  const t = Math.max(0, Math.min(1, intensity));
  let r: number, g: number, b: number;

  if (t <= 0.5) {
    const s = t / 0.5;
    r = Math.round(s * 255);
    g = 200;
    b = 0;
  } else {
    const s = (t - 0.5) / 0.5;
    r = 255;
    g = Math.round((1 - s) * 200);
    b = 0;
  }

  const alpha = (0.15 + t * 0.6).toFixed(2);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Parse an rgba/rgb string back to a [hexColor, alpha] tuple.
 * Returns fallback [0x00ff00, 0.3] for invalid input.
 */
export function parseRgba(rgba: string): [number, number] {
  const m = rgba.match(/rgba?\((\d+),(\d+),(\d+),?([\d.]+)?\)/);
  if (!m) return [0x00ff00, 0.3];
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  return [(r << 16) | (g << 8) | b, a];
}
