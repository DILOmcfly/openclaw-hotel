import { describe, it, expect, beforeEach } from 'vitest';
import {
  RoomWeatherSystem,
  selectWeightedWeather,
  getWeightsForClimate,
  isValidWeatherType,
  isValidClimatePreference,
  getWeatherProbabilities,
  WEATHER_TYPES,
  CLIMATE_WEIGHTS,
  CHANGE_INTERVAL_MS,
  MAX_HISTORY,
  BASE_WEIGHTS,
  type WeatherType,
  type WeatherWeights,
  type ClimatePreference,
} from '../roomWeather.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Returns a deterministic random source that cycles through values 0→1 */
function seededRand(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Fixed-value random that always returns `value` */
const fixedRand = (value: number) => () => value;

/** A fixed clock at a given epoch ms */
const fixedClock = (ms: number) => () => ms;

// ─── Pure function tests ──────────────────────────────────────────────────────

describe('WEATHER_TYPES constant', () => {
  it('contains exactly 5 weather types', () => {
    expect(WEATHER_TYPES).toHaveLength(5);
  });

  it('contains all required types', () => {
    expect(WEATHER_TYPES).toContain('sunny');
    expect(WEATHER_TYPES).toContain('rainy');
    expect(WEATHER_TYPES).toContain('snowy');
    expect(WEATHER_TYPES).toContain('stormy');
    expect(WEATHER_TYPES).toContain('foggy');
  });

  it('has no duplicates', () => {
    expect(new Set(WEATHER_TYPES).size).toBe(WEATHER_TYPES.length);
  });
});

describe('CHANGE_INTERVAL_MS', () => {
  it('is exactly 5 minutes in ms', () => {
    expect(CHANGE_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});

describe('isValidWeatherType', () => {
  it('returns true for all valid types', () => {
    for (const t of WEATHER_TYPES) {
      expect(isValidWeatherType(t)).toBe(true);
    }
  });

  it('returns false for invalid strings', () => {
    expect(isValidWeatherType('cloudy')).toBe(false);
    expect(isValidWeatherType('windy')).toBe(false);
    expect(isValidWeatherType('')).toBe(false);
    expect(isValidWeatherType('SUNNY')).toBe(false);
  });
});

describe('isValidClimatePreference', () => {
  it('returns true for all valid preferences', () => {
    const valid: ClimatePreference[] = ['tropical', 'arctic', 'temperate', 'coastal', 'desert', 'none'];
    for (const c of valid) {
      expect(isValidClimatePreference(c)).toBe(true);
    }
  });

  it('returns false for unknown climate strings', () => {
    expect(isValidClimatePreference('monsoon')).toBe(false);
    expect(isValidClimatePreference('')).toBe(false);
    expect(isValidClimatePreference('TROPICAL')).toBe(false);
  });
});

describe('getWeightsForClimate', () => {
  it('returns equal weights for climate "none"', () => {
    const w = getWeightsForClimate('none');
    const vals = Object.values(w);
    expect(vals.every(v => v === vals[0])).toBe(true);
  });

  it('returns higher sunny weight for desert', () => {
    const w = getWeightsForClimate('desert');
    expect(w.sunny).toBeGreaterThan(w.rainy);
    expect(w.sunny).toBeGreaterThan(w.foggy);
  });

  it('returns higher snowy/stormy weight for arctic', () => {
    const w = getWeightsForClimate('arctic');
    expect(w.snowy).toBeGreaterThan(w.sunny);
    expect(w.stormy).toBeGreaterThan(w.rainy);
  });

  it('returns higher foggy/rainy weight for coastal', () => {
    const w = getWeightsForClimate('coastal');
    expect(w.foggy).toBeGreaterThan(w.snowy);
    expect(w.rainy).toBeGreaterThan(w.snowy);
  });

  it('all weight values are positive numbers', () => {
    for (const climate of Object.keys(CLIMATE_WEIGHTS) as ClimatePreference[]) {
      const w = getWeightsForClimate(climate);
      for (const v of Object.values(w)) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('getWeatherProbabilities', () => {
  it('probabilities sum to 1 for each climate', () => {
    for (const climate of Object.keys(CLIMATE_WEIGHTS) as ClimatePreference[]) {
      const probs = getWeatherProbabilities(climate);
      const total = Object.values(probs).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it('desert has highest sunny probability', () => {
    const probs = getWeatherProbabilities('desert');
    const maxEntry = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
    expect(maxEntry[0]).toBe('sunny');
  });

  it('arctic has highest snowy probability', () => {
    const probs = getWeatherProbabilities('arctic');
    const maxEntry = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
    expect(maxEntry[0]).toBe('snowy');
  });
});

describe('selectWeightedWeather', () => {
  it('throws when all weights are zero', () => {
    const zeroWeights: WeatherWeights = { sunny: 0, rainy: 0, snowy: 0, stormy: 0, foggy: 0 };
    expect(() => selectWeightedWeather(zeroWeights)).toThrow('Total weight must be greater than zero');
  });

  it('returns a valid weather type', () => {
    const result = selectWeightedWeather(BASE_WEIGHTS);
    expect(WEATHER_TYPES).toContain(result);
  });

  it('with rand=0 returns the first non-zero weighted type', () => {
    const weights: WeatherWeights = { sunny: 10, rainy: 10, snowy: 10, stormy: 10, foggy: 10 };
    // rand=0 → cursor=0 → first step: cursor -= 10 → -10 ≤ 0 → 'sunny'
    const result = selectWeightedWeather(weights, fixedRand(0));
    expect(result).toBe('sunny');
  });

  it('respects weight distribution over many samples', () => {
    const weights: WeatherWeights = { sunny: 80, rainy: 5, snowy: 5, stormy: 5, foggy: 5 };
    const counts: Record<string, number> = { sunny: 0, rainy: 0, snowy: 0, stormy: 0, foggy: 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      counts[selectWeightedWeather(weights)]++;
    }
    // Sunny should dominate (expect ~80% ± 5%)
    expect(counts.sunny / N).toBeGreaterThan(0.70);
    expect(counts.rainy / N).toBeLessThan(0.15);
  });

  it('a type with weight 0 is never selected', () => {
    const weights: WeatherWeights = { sunny: 0, rainy: 25, snowy: 25, stormy: 25, foggy: 25 };
    for (let i = 0; i < 500; i++) {
      expect(selectWeightedWeather(weights)).not.toBe('sunny');
    }
  });
});

// ─── RoomWeatherSystem tests ──────────────────────────────────────────────────

describe('RoomWeatherSystem — registration', () => {
  let system: RoomWeatherSystem;
  const T0 = 1_700_000_000_000;

  beforeEach(() => {
    system = new RoomWeatherSystem(fixedClock(T0));
  });

  it('registers a room and returns its initial state', () => {
    const state = system.registerRoom('room-1');
    expect(state.roomId).toBe('room-1');
    expect(WEATHER_TYPES).toContain(state.current);
    expect(state.climate).toBe('none');
    expect(state.lastChanged).toBe(T0);
    expect(state.nextChangeAt).toBe(T0 + CHANGE_INTERVAL_MS);
  });

  it('respects provided initialWeather', () => {
    const state = system.registerRoom('room-2', { initialWeather: 'snowy' });
    expect(state.current).toBe('snowy');
  });

  it('respects provided climate', () => {
    const state = system.registerRoom('room-3', { climate: 'tropical' });
    expect(state.climate).toBe('tropical');
  });

  it('throws on duplicate registration', () => {
    system.registerRoom('room-4');
    expect(() => system.registerRoom('room-4')).toThrow('already registered');
  });

  it('throws on empty roomId', () => {
    expect(() => system.registerRoom('')).toThrow();
  });

  it('throws on invalid initialWeather', () => {
    expect(() => system.registerRoom('room-5', { initialWeather: 'windy' as WeatherType })).toThrow('Invalid weather type');
  });

  it('throws on invalid climate', () => {
    expect(() => system.registerRoom('room-6', { climate: 'monsoon' as ClimatePreference })).toThrow('Invalid climate preference');
  });

  it('hasRoom returns true after registration', () => {
    system.registerRoom('room-7');
    expect(system.hasRoom('room-7')).toBe(true);
  });

  it('hasRoom returns false for unknown room', () => {
    expect(system.hasRoom('no-such-room')).toBe(false);
  });

  it('unregisterRoom removes the room', () => {
    system.registerRoom('room-8');
    expect(system.unregisterRoom('room-8')).toBe(true);
    expect(system.hasRoom('room-8')).toBe(false);
  });

  it('unregisterRoom returns false for unknown room', () => {
    expect(system.unregisterRoom('ghost-room')).toBe(false);
  });

  it('listRooms returns all registered room IDs', () => {
    system.registerRoom('a');
    system.registerRoom('b');
    system.registerRoom('c');
    expect(system.listRooms().sort()).toEqual(['a', 'b', 'c']);
  });

  it('roomCount is correct', () => {
    expect(system.roomCount).toBe(0);
    system.registerRoom('x');
    expect(system.roomCount).toBe(1);
    system.registerRoom('y');
    expect(system.roomCount).toBe(2);
    system.unregisterRoom('x');
    expect(system.roomCount).toBe(1);
  });
});

describe('RoomWeatherSystem — getRoomState / getCurrentWeather', () => {
  it('returns null for unregistered room', () => {
    const system = new RoomWeatherSystem();
    expect(system.getRoomState('nope')).toBeNull();
    expect(system.getCurrentWeather('nope')).toBeNull();
  });

  it('returns correct state for registered room', () => {
    const system = new RoomWeatherSystem(fixedClock(1000));
    system.registerRoom('r1', { initialWeather: 'foggy' });
    expect(system.getCurrentWeather('r1')).toBe('foggy');
    const state = system.getRoomState('r1');
    expect(state?.roomId).toBe('r1');
    expect(state?.current).toBe('foggy');
  });
});

describe('RoomWeatherSystem — setClimate', () => {
  it('updates the climate for a registered room', () => {
    const system = new RoomWeatherSystem();
    system.registerRoom('r1');
    system.setClimate('r1', 'arctic');
    expect(system.getRoomState('r1')?.climate).toBe('arctic');
  });

  it('throws when setting climate on unregistered room', () => {
    const system = new RoomWeatherSystem();
    expect(() => system.setClimate('ghost', 'arctic')).toThrow('not registered');
  });

  it('throws for invalid climate string', () => {
    const system = new RoomWeatherSystem();
    system.registerRoom('r1');
    expect(() => system.setClimate('r1', 'volcano' as ClimatePreference)).toThrow('Invalid climate preference');
  });
});

describe('RoomWeatherSystem — forceWeather', () => {
  it('forces a specific weather immediately', () => {
    const system = new RoomWeatherSystem(fixedClock(2000));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    system.forceWeather('r1', 'stormy');
    expect(system.getCurrentWeather('r1')).toBe('stormy');
  });

  it('resets nextChangeAt on force', () => {
    let t = 1000;
    const system = new RoomWeatherSystem(() => t);
    system.registerRoom('r1', { initialWeather: 'sunny' });
    t = 99_000;
    system.forceWeather('r1', 'rainy');
    expect(system.getRoomState('r1')?.nextChangeAt).toBe(99_000 + CHANGE_INTERVAL_MS);
  });

  it('throws for invalid weather type on force', () => {
    const system = new RoomWeatherSystem();
    system.registerRoom('r1');
    expect(() => system.forceWeather('r1', 'sleet' as WeatherType)).toThrow('Invalid weather type');
  });

  it('throws when forcing weather on unregistered room', () => {
    const system = new RoomWeatherSystem();
    expect(() => system.forceWeather('ghost', 'sunny')).toThrow('not registered');
  });
});

describe('RoomWeatherSystem — tickRoom', () => {
  it('changes weather to a different type', () => {
    const system = new RoomWeatherSystem(fixedClock(1000));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    // Run many ticks; weather must always change
    for (let i = 0; i < 20; i++) {
      const before = system.getCurrentWeather('r1')!;
      system.tickRoom('r1');
      const after = system.getCurrentWeather('r1')!;
      expect(after).not.toBe(before);
    }
  });

  it('throws when ticking unregistered room', () => {
    const system = new RoomWeatherSystem();
    expect(() => system.tickRoom('ghost')).toThrow('not registered');
  });

  it('appends a history entry on tick', () => {
    const system = new RoomWeatherSystem(fixedClock(1000));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    const before = system.getRoomState('r1')!.history.length;
    system.tickRoom('r1');
    expect(system.getRoomState('r1')!.history.length).toBe(before + 1);
  });

  it('history entry records from/to correctly', () => {
    const system = new RoomWeatherSystem(fixedClock(5000));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    system.tickRoom('r1');
    const hist = system.getHistory('r1');
    expect(hist[0].from).toBe('sunny');
    expect(hist[0].to).not.toBe('sunny');
    expect(hist[0].changedAt).toBe(5000);
  });
});

describe('RoomWeatherSystem — tickAll', () => {
  it('updates only rooms whose time has elapsed', () => {
    let t = 1000;
    const system = new RoomWeatherSystem(() => t);
    system.registerRoom('r1', { initialWeather: 'sunny' });
    system.registerRoom('r2', { initialWeather: 'rainy' });

    // Advance time past the interval for r1's next tick
    t = 1000 + CHANGE_INTERVAL_MS + 1;
    const updated = system.tickAll();
    expect(updated).toContain('r1');
    expect(updated).toContain('r2');
  });

  it('returns empty array when no rooms are due', () => {
    const system = new RoomWeatherSystem(fixedClock(1000));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    // Don't advance time — no rooms should be due
    const updated = system.tickAll();
    expect(updated).toHaveLength(0);
  });

  it('returns empty array when no rooms registered', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    expect(system.tickAll()).toEqual([]);
  });
});

describe('RoomWeatherSystem — history management', () => {
  it('initial history has one entry (initial weather)', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('r1', { initialWeather: 'foggy' });
    const hist = system.getRoomState('r1')!.history;
    expect(hist).toHaveLength(1);
    expect(hist[0].from).toBeNull();
    expect(hist[0].to).toBe('foggy');
  });

  it('getHistory returns entries in most-recent-first order', () => {
    let t = 0;
    const system = new RoomWeatherSystem(() => t);
    system.registerRoom('r1', { initialWeather: 'sunny' });
    t = 1000; system.forceWeather('r1', 'rainy');
    t = 2000; system.forceWeather('r1', 'snowy');
    const hist = system.getHistory('r1');
    expect(hist[0].changedAt).toBeGreaterThanOrEqual(hist[1].changedAt);
  });

  it('getHistory respects limit parameter', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    for (let i = 0; i < 10; i++) system.tickRoom('r1');
    expect(system.getHistory('r1', 3)).toHaveLength(3);
  });

  it('history is capped at MAX_HISTORY entries', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    for (let i = 0; i < MAX_HISTORY + 10; i++) system.tickRoom('r1');
    expect(system.getRoomState('r1')!.history).toHaveLength(MAX_HISTORY);
  });

  it('clearHistory resets to single entry', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    system.tickRoom('r1');
    system.tickRoom('r1');
    system.clearHistory('r1');
    expect(system.getRoomState('r1')!.history).toHaveLength(1);
  });

  it('clearHistory throws for unregistered room', () => {
    const system = new RoomWeatherSystem();
    expect(() => system.clearHistory('ghost')).toThrow('not registered');
  });
});

describe('RoomWeatherSystem — stats', () => {
  it('getWeatherFrequency counts correctly', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    system.forceWeather('r1', 'rainy');
    system.forceWeather('r1', 'rainy');
    system.forceWeather('r1', 'snowy');
    const freq = system.getWeatherFrequency('r1');
    expect(freq.sunny).toBe(1);
    expect(freq.rainy).toBe(2);
    expect(freq.snowy).toBe(1);
    expect(freq.stormy).toBe(0);
  });

  it('getMostFrequentWeather returns dominant type', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('r1', { initialWeather: 'foggy' });
    system.forceWeather('r1', 'stormy');
    system.forceWeather('r1', 'stormy');
    system.forceWeather('r1', 'stormy');
    expect(system.getMostFrequentWeather('r1')).toBe('stormy');
  });

  it('msUntilNextChange is 0 when already overdue', () => {
    let t = 1000;
    const system = new RoomWeatherSystem(() => t);
    system.registerRoom('r1', { initialWeather: 'sunny' });
    t = 1000 + CHANGE_INTERVAL_MS + 9999;
    expect(system.msUntilNextChange('r1')).toBe(0);
  });

  it('msUntilNextChange returns positive value when not due', () => {
    const system = new RoomWeatherSystem(fixedClock(1000));
    system.registerRoom('r1', { initialWeather: 'sunny' });
    expect(system.msUntilNextChange('r1')).toBeGreaterThan(0);
    expect(system.msUntilNextChange('r1')).toBeLessThanOrEqual(CHANGE_INTERVAL_MS);
  });

  it('msUntilNextChange throws for unregistered room', () => {
    const system = new RoomWeatherSystem();
    expect(() => system.msUntilNextChange('ghost')).toThrow('not registered');
  });
});

describe('RoomWeatherSystem — climate bias integration', () => {
  it('desert rooms produce mostly sunny weather over many ticks', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('desert-room', { initialWeather: 'sunny', climate: 'desert' });
    for (let i = 0; i < 500; i++) system.tickRoom('desert-room');
    const freq = system.getWeatherFrequency('desert-room');
    // Sunny can't repeat back-to-back (tickRoom always picks a different type),
    // so its steady-state is ~32% — but it must be the single most frequent type
    // and well above the uniform baseline of 20%.
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    expect(freq.sunny / total).toBeGreaterThan(0.22); // significantly above uniform 0.20
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe('sunny'); // sunny is the #1 weather
  });

  it('arctic rooms produce mostly snowy/stormy weather over many ticks', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('arctic-room', { initialWeather: 'snowy', climate: 'arctic' });
    for (let i = 0; i < 500; i++) system.tickRoom('arctic-room');
    const freq = system.getWeatherFrequency('arctic-room');
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    const coldRatio = (freq.snowy + freq.stormy) / total;
    expect(coldRatio).toBeGreaterThan(0.50);
  });

  it('changing climate affects subsequent weather distribution', () => {
    const system = new RoomWeatherSystem(fixedClock(0));
    system.registerRoom('r1', { initialWeather: 'sunny', climate: 'none' });
    system.setClimate('r1', 'arctic');
    for (let i = 0; i < 200; i++) system.tickRoom('r1');
    const freq = system.getWeatherFrequency('r1');
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    // After switching to arctic, cold types should dominate
    expect((freq.snowy + freq.stormy) / total).toBeGreaterThan(0.40);
  });
});
