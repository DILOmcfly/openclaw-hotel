/**
 * Room Weather System
 *
 * Each room has a dynamic weather state that changes every 5 minutes
 * based on weighted random selection. Rooms can have climate preferences
 * that bias the weather distribution.
 *
 * Weather types: sunny | rainy | snowy | stormy | foggy
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeatherType = 'sunny' | 'rainy' | 'snowy' | 'stormy' | 'foggy';

export type ClimatePreference =
  | 'tropical'   // biases toward sunny/rainy
  | 'arctic'     // biases toward snowy/stormy
  | 'temperate'  // balanced, slight sunny preference
  | 'coastal'    // biases toward foggy/rainy
  | 'desert'     // heavy sunny bias
  | 'none';      // equal weights

export interface WeatherWeights {
  sunny: number;
  rainy: number;
  snowy: number;
  stormy: number;
  foggy: number;
}

export interface WeatherChange {
  from: WeatherType | null;
  to: WeatherType;
  changedAt: number; // ms epoch
}

export interface RoomWeatherState {
  roomId: string;
  current: WeatherType;
  climate: ClimatePreference;
  lastChanged: number; // ms epoch
  history: WeatherChange[];
  nextChangeAt: number; // ms epoch
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const WEATHER_TYPES: WeatherType[] = ['sunny', 'rainy', 'snowy', 'stormy', 'foggy'];

export const CHANGE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum history entries kept per room */
export const MAX_HISTORY = 50;

/**
 * Base weights used when climate is 'none'.
 * All values are equal for uniform distribution.
 */
export const BASE_WEIGHTS: WeatherWeights = {
  sunny: 20,
  rainy: 20,
  snowy: 20,
  stormy: 20,
  foggy: 20,
};

/**
 * Climate-specific weight overrides.
 * Values represent relative probability (not required to sum to 100).
 */
export const CLIMATE_WEIGHTS: Record<ClimatePreference, WeatherWeights> = {
  none: { sunny: 20, rainy: 20, snowy: 20, stormy: 20, foggy: 20 },
  tropical: { sunny: 40, rainy: 35, snowy: 5,  stormy: 15, foggy: 5  },
  arctic:   { sunny: 10, rainy: 5,  snowy: 45, stormy: 30, foggy: 10 },
  temperate:{ sunny: 30, rainy: 25, snowy: 15, stormy: 10, foggy: 20 },
  coastal:  { sunny: 20, rainy: 30, snowy: 10, stormy: 15, foggy: 25 },
  desert:   { sunny: 60, rainy: 10, snowy: 5,  stormy: 15, foggy: 10 },
};

// ─── Pure functions ───────────────────────────────────────────────────────────

/**
 * Select a weather type using weighted random selection.
 * @param weights  The weight table to use.
 * @param rand     Injectable random source (0 ≤ n < 1). Defaults to Math.random.
 */
export function selectWeightedWeather(
  weights: WeatherWeights,
  rand: () => number = Math.random,
): WeatherType {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error('Total weight must be greater than zero');

  let cursor = rand() * total;
  for (const type of WEATHER_TYPES) {
    cursor -= weights[type];
    if (cursor <= 0) return type;
  }
  // Fallback (floating point edge case)
  return WEATHER_TYPES[WEATHER_TYPES.length - 1];
}

/**
 * Get the weights for a given climate preference.
 */
export function getWeightsForClimate(climate: ClimatePreference): WeatherWeights {
  return CLIMATE_WEIGHTS[climate] ?? CLIMATE_WEIGHTS.none;
}

/**
 * Validate that a string is a valid WeatherType.
 */
export function isValidWeatherType(value: string): value is WeatherType {
  return WEATHER_TYPES.includes(value as WeatherType);
}

/**
 * Validate that a string is a valid ClimatePreference.
 */
export function isValidClimatePreference(value: string): value is ClimatePreference {
  return Object.keys(CLIMATE_WEIGHTS).includes(value);
}

/**
 * Compute probability of each weather type for a given climate (0–1).
 */
export function getWeatherProbabilities(climate: ClimatePreference): Record<WeatherType, number> {
  const weights = getWeightsForClimate(climate);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return {
    sunny:  weights.sunny  / total,
    rainy:  weights.rainy  / total,
    snowy:  weights.snowy  / total,
    stormy: weights.stormy / total,
    foggy:  weights.foggy  / total,
  };
}

// ─── RoomWeatherSystem class ──────────────────────────────────────────────────

export class RoomWeatherSystem {
  private rooms = new Map<string, RoomWeatherState>();
  private readonly now: () => number;
  private readonly rand: () => number;

  /**
   * @param now   Injectable clock. Defaults to Date.now.
   * @param rand  Injectable random source. Defaults to Math.random.
   */
  constructor(
    now: () => number = Date.now,
    rand: () => number = Math.random,
  ) {
    this.now = now;
    this.rand = rand;
  }

  // ─── Room management ────────────────────────────────────────────────────────

  /**
   * Register a new room with an optional initial weather and climate.
   * Throws if the room is already registered.
   */
  registerRoom(
    roomId: string,
    options: {
      initialWeather?: WeatherType;
      climate?: ClimatePreference;
    } = {},
  ): RoomWeatherState {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('roomId must be a non-empty string');
    }
    if (this.rooms.has(roomId)) {
      throw new Error(`Room "${roomId}" is already registered`);
    }

    const climate: ClimatePreference = options.climate ?? 'none';
    if (!isValidClimatePreference(climate)) {
      throw new Error(`Invalid climate preference: "${climate}"`);
    }

    const ts = this.now();
    const initialWeather: WeatherType =
      options.initialWeather ??
      selectWeightedWeather(getWeightsForClimate(climate), this.rand);

    if (options.initialWeather && !isValidWeatherType(options.initialWeather)) {
      throw new Error(`Invalid weather type: "${options.initialWeather}"`);
    }

    const state: RoomWeatherState = {
      roomId,
      current: initialWeather,
      climate,
      lastChanged: ts,
      nextChangeAt: ts + CHANGE_INTERVAL_MS,
      history: [{ from: null, to: initialWeather, changedAt: ts }],
    };

    this.rooms.set(roomId, state);
    return state;
  }

  /**
   * Remove a room from the system.
   * Returns true if the room existed and was removed.
   */
  unregisterRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  /**
   * Check whether a room is registered.
   */
  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  /**
   * Get the current weather state for a room.
   * Returns null if the room is not registered.
   */
  getRoomState(roomId: string): RoomWeatherState | null {
    return this.rooms.get(roomId) ?? null;
  }

  /**
   * Get the current weather type for a room.
   * Returns null if the room is not registered.
   */
  getCurrentWeather(roomId: string): WeatherType | null {
    return this.rooms.get(roomId)?.current ?? null;
  }

  /**
   * List all registered room IDs.
   */
  listRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Count of registered rooms.
   */
  get roomCount(): number {
    return this.rooms.size;
  }

  // ─── Climate management ─────────────────────────────────────────────────────

  /**
   * Set (or update) the climate preference for a room.
   * Throws if the room is not registered or the climate is invalid.
   */
  setClimate(roomId: string, climate: ClimatePreference): RoomWeatherState {
    const state = this.requireRoom(roomId);
    if (!isValidClimatePreference(climate)) {
      throw new Error(`Invalid climate preference: "${climate}"`);
    }
    state.climate = climate;
    return state;
  }

  // ─── Weather mutation ───────────────────────────────────────────────────────

  /**
   * Force a specific weather for a room immediately.
   * Resets the next-change timer.
   */
  forceWeather(roomId: string, weather: WeatherType): RoomWeatherState {
    const state = this.requireRoom(roomId);
    if (!isValidWeatherType(weather)) {
      throw new Error(`Invalid weather type: "${weather}"`);
    }
    return this.applyWeatherChange(state, weather);
  }

  /**
   * Trigger a weather change for a single room based on its climate weights.
   * Guaranteed to pick a different weather than the current one (unless
   * the only valid option is the current weather, which is impossible with 5 types).
   */
  tickRoom(roomId: string): RoomWeatherState {
    const state = this.requireRoom(roomId);
    const weights = getWeightsForClimate(state.climate);
    const newWeather = this.pickDifferentWeather(state.current, weights);
    return this.applyWeatherChange(state, newWeather);
  }

  /**
   * Process all rooms and apply a weather change to those whose
   * `nextChangeAt` has elapsed based on the injected clock.
   * Returns the list of room IDs that were updated.
   */
  tickAll(): string[] {
    const now = this.now();
    const updated: string[] = [];

    for (const state of this.rooms.values()) {
      if (now >= state.nextChangeAt) {
        const weights = getWeightsForClimate(state.climate);
        const newWeather = this.pickDifferentWeather(state.current, weights);
        this.applyWeatherChange(state, newWeather);
        updated.push(state.roomId);
      }
    }

    return updated;
  }

  // ─── History ────────────────────────────────────────────────────────────────

  /**
   * Get the weather change history for a room (most recent first).
   */
  getHistory(roomId: string, limit = MAX_HISTORY): WeatherChange[] {
    const state = this.requireRoom(roomId);
    return [...state.history]
      .reverse()
      .slice(0, Math.max(1, Math.min(limit, MAX_HISTORY)));
  }

  /**
   * Clear the history for a room (keeps only the current state entry).
   */
  clearHistory(roomId: string): void {
    const state = this.requireRoom(roomId);
    const current = state.history[state.history.length - 1];
    state.history = current ? [current] : [];
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  /**
   * Count how many times each weather type has occurred in a room's history.
   */
  getWeatherFrequency(roomId: string): Record<WeatherType, number> {
    const state = this.requireRoom(roomId);
    const freq: Record<WeatherType, number> = {
      sunny: 0, rainy: 0, snowy: 0, stormy: 0, foggy: 0,
    };
    for (const change of state.history) {
      freq[change.to]++;
    }
    return freq;
  }

  /**
   * Return the most frequent weather in a room's history.
   * If tied, returns the one that appears first in WEATHER_TYPES.
   */
  getMostFrequentWeather(roomId: string): WeatherType {
    const freq = this.getWeatherFrequency(roomId);
    return WEATHER_TYPES.reduce((best, w) => (freq[w] > freq[best] ? w : best), WEATHER_TYPES[0]);
  }

  /**
   * Returns how many milliseconds until the next scheduled change.
   * Returns 0 if already due.
   */
  msUntilNextChange(roomId: string): number {
    const state = this.requireRoom(roomId);
    return Math.max(0, state.nextChangeAt - this.now());
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private requireRoom(roomId: string): RoomWeatherState {
    const state = this.rooms.get(roomId);
    if (!state) throw new Error(`Room "${roomId}" is not registered`);
    return state;
  }

  private applyWeatherChange(state: RoomWeatherState, newWeather: WeatherType): RoomWeatherState {
    const ts = this.now();
    const change: WeatherChange = {
      from: state.current,
      to: newWeather,
      changedAt: ts,
    };
    state.history.push(change);
    // Trim history to max
    if (state.history.length > MAX_HISTORY) {
      state.history.splice(0, state.history.length - MAX_HISTORY);
    }
    state.current = newWeather;
    state.lastChanged = ts;
    state.nextChangeAt = ts + CHANGE_INTERVAL_MS;
    return state;
  }

  /**
   * Pick a weather different from `current` using weighted selection.
   * Zeros out the current weather's weight to ensure a change.
   */
  private pickDifferentWeather(
    current: WeatherType,
    weights: WeatherWeights,
  ): WeatherType {
    // Remove current weather's weight so we always transition
    const adjusted: WeatherWeights = { ...weights, [current]: 0 };
    const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
    // If all alternatives are zero (edge case with custom weights), fall back to any
    if (total <= 0) {
      return WEATHER_TYPES.find(w => w !== current) ?? current;
    }
    return selectWeightedWeather(adjusted, this.rand);
  }
}
