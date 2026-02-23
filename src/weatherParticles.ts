/**
 * T-372: Room Weather Visual Effects — Particle Engine (Pure Functions)
 *
 * Provides a pure-function particle system for weather rendering.
 * All state is immutable; the caller holds the particle array.
 * No canvas/DOM dependency — fully unit-testable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeatherType =
  | 'sunny'
  | 'rainy'
  | 'snowy'
  | 'stormy'
  | 'foggy'
  | 'clear'
  | 'aurora'
  | 'rainbow';

export interface Particle {
  /** Current x position (px) */
  x: number;
  /** Current y position (px) */
  y: number;
  /** Velocity x (px/s) */
  vx: number;
  /** Velocity y (px/s) */
  vy: number;
  /** Particle radius or half-width (px) */
  size: number;
  /** Opacity 0–1 */
  opacity: number;
  /** Remaining life (ms); -1 = infinite */
  life: number;
  /** Total life at spawn (ms); -1 = infinite */
  maxLife: number;
}

export interface WeatherConfig {
  /** Label shown in HUD */
  label: string;
  /** Emoji shown in HUD */
  emoji: string;
  /** Max simultaneous particles */
  maxParticles: number;
  /** Particles spawned per second */
  spawnRate: number;
  /** Base velocity x range [min, max] (px/s) */
  vxRange: [number, number];
  /** Base velocity y range [min, max] (px/s) */
  vyRange: [number, number];
  /** Particle size range [min, max] (px) */
  sizeRange: [number, number];
  /** Opacity range [min, max] */
  opacityRange: [number, number];
  /** Life range [min, max] ms; -1 = infinite */
  lifeRange: [number, number];
  /** CSS color for particle fill */
  color: string;
  /** Background tint CSS color (applied to overlay) */
  bgTint: string;
  /** Whether to use glow effect on canvas */
  glow: boolean;
}

// ─── Weather Configs ──────────────────────────────────────────────────────────

export const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  clear: {
    label: 'Clear', emoji: '☀️',
    maxParticles: 0, spawnRate: 0,
    vxRange: [0, 0], vyRange: [0, 0],
    sizeRange: [1, 1], opacityRange: [0, 0], lifeRange: [-1, -1],
    color: 'rgba(255,255,255,0)', bgTint: 'rgba(0,0,0,0)', glow: false,
  },
  sunny: {
    label: 'Sunny', emoji: '☀️',
    maxParticles: 12, spawnRate: 0.5,
    vxRange: [-10, 10], vyRange: [-15, -5],
    sizeRange: [2, 5], opacityRange: [0.2, 0.5], lifeRange: [2000, 4000],
    color: 'rgba(255,235,100,0.6)', bgTint: 'rgba(255,200,50,0.04)', glow: true,
  },
  rainy: {
    label: 'Rainy', emoji: '🌧️',
    maxParticles: 120, spawnRate: 60,
    vxRange: [20, 40], vyRange: [300, 500],
    sizeRange: [1, 2], opacityRange: [0.4, 0.7], lifeRange: [-1, -1],
    color: 'rgba(150,200,255,0.7)', bgTint: 'rgba(30,60,120,0.06)', glow: false,
  },
  snowy: {
    label: 'Snowy', emoji: '❄️',
    maxParticles: 80, spawnRate: 25,
    vxRange: [-20, 20], vyRange: [40, 100],
    sizeRange: [2, 5], opacityRange: [0.6, 0.9], lifeRange: [-1, -1],
    color: 'rgba(220,240,255,0.85)', bgTint: 'rgba(200,220,255,0.04)', glow: false,
  },
  stormy: {
    label: 'Stormy', emoji: '⛈️',
    maxParticles: 200, spawnRate: 100,
    vxRange: [40, 80], vyRange: [400, 700],
    sizeRange: [1, 2], opacityRange: [0.5, 0.8], lifeRange: [-1, -1],
    color: 'rgba(120,160,220,0.65)', bgTint: 'rgba(20,20,60,0.08)', glow: false,
  },
  foggy: {
    label: 'Foggy', emoji: '🌫️',
    maxParticles: 20, spawnRate: 1,
    vxRange: [15, 35], vyRange: [-5, 5],
    sizeRange: [30, 80], opacityRange: [0.04, 0.12], lifeRange: [4000, 8000],
    color: 'rgba(200,210,220,0.3)', bgTint: 'rgba(180,190,210,0.07)', glow: false,
  },
  aurora: {
    label: 'Aurora', emoji: '🌌',
    maxParticles: 8, spawnRate: 0.3,
    vxRange: [-5, 5], vyRange: [-8, -2],
    sizeRange: [20, 60], opacityRange: [0.1, 0.25], lifeRange: [3000, 7000],
    color: 'rgba(80,255,180,0.4)', bgTint: 'rgba(0,30,60,0.05)', glow: true,
  },
  rainbow: {
    label: 'Rainbow', emoji: '🌈',
    maxParticles: 0, spawnRate: 0,
    vxRange: [0, 0], vyRange: [0, 0],
    sizeRange: [1, 1], opacityRange: [0, 0], lifeRange: [-1, -1],
    color: 'rgba(0,0,0,0)', bgTint: 'rgba(0,0,0,0)', glow: false,
  },
};

// ─── Pure Functions ───────────────────────────────────────────────────────────

/**
 * Get configuration for a weather type.
 * Returns `clear` config as fallback for unknown types.
 */
export function getWeatherConfig(weather: WeatherType): WeatherConfig {
  return WEATHER_CONFIGS[weather] ?? WEATHER_CONFIGS.clear;
}

/**
 * Create a new particle at the top of the canvas.
 * Uses a seeded-looking random value so the caller supplies the rng.
 *
 * @param weather  Current weather type
 * @param width    Canvas width (px)
 * @param rng      Random number generator [0, 1)
 */
export function createParticle(
  weather: WeatherType,
  width: number,
  rng: () => number = Math.random,
): Particle {
  const cfg = getWeatherConfig(weather);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const vx = lerp(cfg.vxRange[0], cfg.vxRange[1], rng());
  const vy = lerp(cfg.vyRange[0], cfg.vyRange[1], rng());
  const size = lerp(cfg.sizeRange[0], cfg.sizeRange[1], rng());
  const opacity = lerp(cfg.opacityRange[0], cfg.opacityRange[1], rng());
  const life = cfg.lifeRange[0] === -1 ? -1 : lerp(cfg.lifeRange[0], cfg.lifeRange[1], rng());

  // Spawn above the canvas or at left edge for fog
  const x = weather === 'foggy' ? -size * 2 : rng() * width;
  const y = weather === 'foggy' ? rng() * 200 : -size * 2;

  return { x, y, vx, vy, size, opacity, life, maxLife: life };
}

/**
 * Update a particle by dt milliseconds.
 * Returns new particle (immutable update pattern).
 *
 * For snowy particles: applies sinusoidal horizontal drift.
 * For infinite-life particles: life stays -1.
 */
export function updateParticle(
  p: Particle,
  dtMs: number,
  weather: WeatherType,
  time: number = 0,
): Particle {
  const dtSec = dtMs / 1000;

  let { x, y, vx, vy, size, opacity, life, maxLife } = p;

  // Apply drift for snow
  if (weather === 'snowy') {
    vx = Math.sin(time / 1500 + x * 0.01) * 20;
  }

  x += vx * dtSec;
  y += vy * dtSec;

  if (life !== -1) {
    life = Math.max(0, life - dtMs);
    // Fade out in last 20% of life
    if (life < maxLife * 0.2) {
      opacity = p.opacity * (life / (maxLife * 0.2));
    }
  }

  return { x, y, vx, vy, size, opacity, life, maxLife };
}

/**
 * Returns true when a particle has scrolled off-screen and should be recycled.
 *
 * @param p       Particle to check
 * @param width   Canvas width (px)
 * @param height  Canvas height (px)
 */
export function isParticleOffScreen(
  p: Particle,
  width: number,
  height: number,
): boolean {
  if (p.life === 0) return true;          // life expired
  if (p.y > height + p.size) return true; // fell below bottom
  if (p.x > width + p.size) return true;  // drifted off right
  if (p.x < -p.size * 4) return true;     // drifted off left
  if (p.y < -p.size * 4) return true;     // above canvas (float-up)
  return false;
}

/**
 * Advance the particle system by dtMs milliseconds.
 * - Removes off-screen particles
 * - Spawns new particles up to maxParticles at the configured rate
 *
 * Returns a new array (immutable).
 */
export function tickParticleSystem(
  particles: Particle[],
  dtMs: number,
  weather: WeatherType,
  width: number,
  height: number,
  time: number = 0,
  rng: () => number = Math.random,
): Particle[] {
  const cfg = getWeatherConfig(weather);

  // Update + cull existing particles
  const alive: Particle[] = particles
    .map(p => updateParticle(p, dtMs, weather, time))
    .filter(p => !isParticleOffScreen(p, width, height));

  // Spawn new particles
  const spawnCount = Math.round((cfg.spawnRate * dtMs) / 1000);
  const toSpawn = Math.max(0, Math.min(spawnCount, cfg.maxParticles - alive.length));

  const spawned = Array.from({ length: toSpawn }, () =>
    createParticle(weather, width, rng),
  );

  return [...alive, ...spawned];
}

/**
 * Clamp particle opacity to [0, 1].
 */
export function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

/**
 * Generate a lightning flash value (0–1) for stormy weather.
 * Returns > 0 only occasionally based on rng.
 * Value is used as flash overlay opacity.
 */
export function getLightningFlash(rng: () => number, dtMs: number): number {
  // Roughly one strike per 4 seconds on average
  const prob = dtMs / 4000;
  if (rng() < prob) {
    return 0.15 + rng() * 0.25; // 0.15–0.4 flash opacity
  }
  return 0;
}

/**
 * Get the HUD badge text for a given weather type.
 */
export function getWeatherBadge(weather: WeatherType): string {
  const cfg = getWeatherConfig(weather);
  return `${cfg.emoji} ${cfg.label}`;
}

/**
 * Lerp between two numeric values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
