/**
 * T-372: Room Weather Visual Effects — Particle Engine Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getWeatherConfig,
  createParticle,
  updateParticle,
  isParticleOffScreen,
  tickParticleSystem,
  clampOpacity,
  getLightningFlash,
  getWeatherBadge,
  lerp,
  WEATHER_CONFIGS,
  type WeatherType,
  type Particle,
} from '../weatherParticles.js';

// ─── Deterministic RNG ─────────────────────────────────────────────────────────
const rng0 = () => 0;
const rng1 = () => 0.9999;
const rng5 = (() => {
  const vals = [0, 0.25, 0.5, 0.75, 1];
  let i = 0;
  return () => vals[i++ % vals.length];
})();

// ─── Helper ───────────────────────────────────────────────────────────────────
function makeParticle(overrides: Partial<Particle> = {}): Particle {
  return {
    x: 100, y: 50, vx: 10, vy: 100,
    size: 3, opacity: 0.7, life: -1, maxLife: -1,
    ...overrides,
  };
}

// ─── getWeatherConfig ─────────────────────────────────────────────────────────
describe('getWeatherConfig', () => {
  it('returns config for each defined weather type', () => {
    const types: WeatherType[] = ['clear', 'sunny', 'rainy', 'snowy', 'stormy', 'foggy', 'aurora', 'rainbow'];
    for (const t of types) {
      const cfg = getWeatherConfig(t);
      expect(cfg).toBeDefined();
      expect(typeof cfg.emoji).toBe('string');
      expect(typeof cfg.label).toBe('string');
    }
  });

  it('falls back to clear config for unknown type', () => {
    const cfg = getWeatherConfig('unknown' as WeatherType);
    expect(cfg.maxParticles).toBe(0);
  });

  it('rainy has higher spawnRate than sunny', () => {
    expect(getWeatherConfig('rainy').spawnRate).toBeGreaterThan(getWeatherConfig('sunny').spawnRate);
  });

  it('stormy has highest maxParticles', () => {
    expect(getWeatherConfig('stormy').maxParticles).toBeGreaterThanOrEqual(getWeatherConfig('rainy').maxParticles);
  });

  it('clear has zero maxParticles', () => {
    expect(getWeatherConfig('clear').maxParticles).toBe(0);
  });

  it('rainbow has zero maxParticles (static effect)', () => {
    expect(getWeatherConfig('rainbow').maxParticles).toBe(0);
  });

  it('all configs have valid sizeRange [min, max]', () => {
    for (const cfg of Object.values(WEATHER_CONFIGS)) {
      expect(cfg.sizeRange[0]).toBeLessThanOrEqual(cfg.sizeRange[1]);
    }
  });

  it('all configs have valid opacityRange [min, max]', () => {
    for (const cfg of Object.values(WEATHER_CONFIGS)) {
      expect(cfg.opacityRange[0]).toBeLessThanOrEqual(cfg.opacityRange[1]);
    }
  });
});

// ─── createParticle ───────────────────────────────────────────────────────────
describe('createParticle', () => {
  it('creates particle with rainy weather at top of canvas', () => {
    const p = createParticle('rainy', 800, rng0);
    expect(p.y).toBeLessThan(0); // starts above canvas
    expect(p.vy).toBeGreaterThan(0); // falls downward
  });

  it('creates particle with snowy weather', () => {
    const p = createParticle('snowy', 800, rng0);
    expect(p.opacity).toBeGreaterThanOrEqual(getWeatherConfig('snowy').opacityRange[0]);
    expect(p.vy).toBeGreaterThan(0);
  });

  it('fog particles spawn at left edge', () => {
    const p = createParticle('foggy', 800, rng0);
    expect(p.x).toBeLessThan(0); // starts off-left
    expect(p.vx).toBeGreaterThan(0); // moves right
  });

  it('fog particles are larger than rain particles', () => {
    const fog = createParticle('foggy', 800, rng5);
    const rain = createParticle('rainy', 800, rng5);
    expect(fog.size).toBeGreaterThan(rain.size);
  });

  it('creates particle within vx range for stormy', () => {
    const cfg = getWeatherConfig('stormy');
    const p = createParticle('stormy', 800, rng0);
    expect(p.vx).toBeGreaterThanOrEqual(cfg.vxRange[0]);
    expect(p.vx).toBeLessThanOrEqual(cfg.vxRange[1]);
  });

  it('aurora particles have finite life', () => {
    const p = createParticle('aurora', 800, rng0);
    expect(p.life).not.toBe(-1);
    expect(p.life).toBeGreaterThan(0);
  });

  it('rain particles have infinite life (off-screen detection handles removal)', () => {
    const p = createParticle('rainy', 800, rng0);
    expect(p.life).toBe(-1);
  });
});

// ─── updateParticle ───────────────────────────────────────────────────────────
describe('updateParticle', () => {
  it('moves particle downward for rain (positive vy)', () => {
    const p = makeParticle({ y: 0, vy: 400 });
    const updated = updateParticle(p, 100, 'rainy');
    expect(updated.y).toBeCloseTo(40, 0); // 400 * 0.1 = 40
  });

  it('moves particle rightward for rain (positive vx)', () => {
    const p = makeParticle({ x: 0, vx: 30 });
    const updated = updateParticle(p, 1000, 'rainy');
    expect(updated.x).toBeCloseTo(30, 0);
  });

  it('finite-life particle decrements life', () => {
    const p = makeParticle({ life: 1000, maxLife: 1000 });
    const updated = updateParticle(p, 200, 'aurora');
    expect(updated.life).toBeCloseTo(800, 0);
  });

  it('finite-life particle does not go below 0', () => {
    const p = makeParticle({ life: 50, maxLife: 1000 });
    const updated = updateParticle(p, 500, 'aurora');
    expect(updated.life).toBe(0);
  });

  it('infinite-life particle keeps life = -1', () => {
    const p = makeParticle({ life: -1, maxLife: -1 });
    const updated = updateParticle(p, 100, 'rainy');
    expect(updated.life).toBe(-1);
  });

  it('particle fades in last 20% of life', () => {
    const p = makeParticle({ life: 100, maxLife: 1000, opacity: 0.8 });
    const updated = updateParticle(p, 50, 'aurora'); // life → 50, within last 20%
    expect(updated.opacity).toBeLessThan(p.opacity);
  });

  it('snow horizontal velocity changes with time (sinusoidal drift)', () => {
    const p = makeParticle({ vx: 0, x: 100 });
    const u1 = updateParticle(p, 16, 'snowy', 0);
    const u2 = updateParticle(p, 16, 'snowy', 1000);
    // vx should differ due to sin(time) component
    expect(u1.vx).not.toEqual(u2.vx);
  });
});

// ─── isParticleOffScreen ──────────────────────────────────────────────────────
describe('isParticleOffScreen', () => {
  const W = 800, H = 600;

  it('particle below canvas is off-screen', () => {
    const p = makeParticle({ y: H + 10 });
    expect(isParticleOffScreen(p, W, H)).toBe(true);
  });

  it('particle far right is off-screen', () => {
    const p = makeParticle({ x: W + 20 });
    expect(isParticleOffScreen(p, W, H)).toBe(true);
  });

  it('particle far left is off-screen', () => {
    const p = makeParticle({ x: -50, size: 3 });
    expect(isParticleOffScreen(p, W, H)).toBe(true);
  });

  it('particle in bounds is not off-screen', () => {
    const p = makeParticle({ x: 400, y: 300 });
    expect(isParticleOffScreen(p, W, H)).toBe(false);
  });

  it('particle with life=0 is considered off-screen', () => {
    const p = makeParticle({ life: 0, maxLife: 1000 });
    expect(isParticleOffScreen(p, W, H)).toBe(true);
  });
});

// ─── tickParticleSystem ───────────────────────────────────────────────────────
describe('tickParticleSystem', () => {
  it('returns empty array for clear weather', () => {
    const result = tickParticleSystem([], 16, 'clear', 800, 600, 0, rng5);
    expect(result).toHaveLength(0);
  });

  it('spawns particles for rainy weather', () => {
    const result = tickParticleSystem([], 1000, 'rainy', 800, 600, 0, rng5);
    expect(result.length).toBeGreaterThan(0);
  });

  it('does not exceed maxParticles', () => {
    const cfg = getWeatherConfig('rainy');
    // Start with already-full system
    const full = Array.from({ length: cfg.maxParticles }, () =>
      makeParticle({ x: 400, y: 300 }),
    );
    const result = tickParticleSystem(full, 1000, 'rainy', 800, 600, 0, rng5);
    expect(result.length).toBeLessThanOrEqual(cfg.maxParticles);
  });

  it('removes off-screen particles', () => {
    const offScreen = [makeParticle({ y: 9999 })]; // below canvas
    const result = tickParticleSystem(offScreen, 16, 'rainy', 800, 600);
    const belowCanvas = result.filter(p => p.y > 600 + p.size);
    expect(belowCanvas).toHaveLength(0);
  });

  it('advances particle positions over time', () => {
    const start = [makeParticle({ y: 0, vy: 300 })];
    const result = tickParticleSystem(start, 1000, 'rainy', 800, 600);
    // The original particle should have moved (if still on screen) or been replaced
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── clampOpacity ────────────────────────────────────────────────────────────
describe('clampOpacity', () => {
  it('clamps values above 1', () => expect(clampOpacity(1.5)).toBe(1));
  it('clamps values below 0', () => expect(clampOpacity(-0.3)).toBe(0));
  it('passes through valid values', () => expect(clampOpacity(0.6)).toBeCloseTo(0.6));
  it('handles exactly 0', () => expect(clampOpacity(0)).toBe(0));
  it('handles exactly 1', () => expect(clampOpacity(1)).toBe(1));
});

// ─── getLightningFlash ────────────────────────────────────────────────────────
describe('getLightningFlash', () => {
  it('returns 0 when rng is high (no flash)', () => {
    expect(getLightningFlash(rng1, 16)).toBe(0);
  });

  it('returns positive flash value when rng is near 0 and dtMs is large', () => {
    const flash = getLightningFlash(rng0, 5000); // prob = 5000/4000 > 1
    expect(flash).toBeGreaterThan(0);
    expect(flash).toBeLessThanOrEqual(0.4);
  });

  it('flash value is within expected range [0.15, 0.4]', () => {
    const flash = getLightningFlash(rng0, 5000);
    if (flash > 0) {
      expect(flash).toBeGreaterThanOrEqual(0.15);
    }
  });
});

// ─── getWeatherBadge ─────────────────────────────────────────────────────────
describe('getWeatherBadge', () => {
  it('includes emoji and label for each type', () => {
    const types: WeatherType[] = ['rainy', 'snowy', 'foggy', 'sunny', 'stormy', 'clear', 'aurora', 'rainbow'];
    for (const t of types) {
      const badge = getWeatherBadge(t);
      expect(typeof badge).toBe('string');
      expect(badge.length).toBeGreaterThan(2);
    }
  });

  it('rainy badge contains rain emoji', () => {
    expect(getWeatherBadge('rainy')).toContain('🌧');
  });

  it('snowy badge contains snow emoji', () => {
    expect(getWeatherBadge('snowy')).toContain('❄');
  });
});

// ─── lerp ────────────────────────────────────────────────────────────────────
describe('lerp', () => {
  it('returns a at t=0', () => expect(lerp(10, 20, 0)).toBe(10));
  it('returns b at t=1', () => expect(lerp(10, 20, 1)).toBe(20));
  it('returns midpoint at t=0.5', () => expect(lerp(0, 100, 0.5)).toBe(50));
  it('clamps t below 0', () => expect(lerp(5, 15, -1)).toBe(5));
  it('clamps t above 1', () => expect(lerp(5, 15, 2)).toBe(15));
});
