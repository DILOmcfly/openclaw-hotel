/**
 * T-368: Spectator "Witness XP" Gamification System
 *
 * Awards spectators XP for witnessing events in real-time.
 * Persists state in localStorage under key 'witnessXP'.
 */

// ── XP Award amounts per event type ──────────────────────────────────────────

export const XP_AWARDS: Record<string, number> = {
  trade_offer:     5,
  trade_complete:  15,
  achievement:     20,
  game_win:        25,
  chat:            1,
  level_up:        30,
  emote:           3,
};

// ── Level definitions ─────────────────────────────────────────────────────────

export interface LevelDef {
  name: string;
  minXP: number;
}

export const LEVELS: LevelDef[] = [
  { name: 'Newcomer',  minXP: 0     },
  { name: 'Observer',  minXP: 100   },
  { name: 'Watcher',   minXP: 250   },
  { name: 'Witness',   minXP: 500   },
  { name: 'Veteran',   minXP: 1000  },
  { name: 'Sage',      minXP: 2500  },
  { name: 'Legend',    minXP: 5000  },
  { name: 'Mythic',    minXP: 10000 },
];

// ── Persistence shape ─────────────────────────────────────────────────────────

export interface WitnessXPData {
  totalXP: number;
  eventCounts: Record<string, number>;
  lastUpdated: number; // Unix ms
}

export interface LevelProgress {
  currentLevel: LevelDef;
  nextLevel: LevelDef | null;
  /** XP earned within the current level band */
  xpIntoLevel: number;
  /** Total XP needed for current level band (null if max level) */
  xpForLevel: number | null;
  /** 0.0–1.0 progress fraction (1.0 if max level) */
  fraction: number;
}

export interface WitnessStats {
  totalXP: number;
  level: string;
  levelIndex: number;
  eventCounts: Record<string, number>;
  totalEventsWitnessed: number;
  lastUpdated: number;
}

// ── Storage key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'witnessXP';

// ── WitnessXPTracker class ────────────────────────────────────────────────────

export class WitnessXPTracker {
  private data: WitnessXPData;
  private storage: Storage;

  constructor(storage?: Storage) {
    // Allow injecting a custom storage for testing (e.g. mock localStorage)
    this.storage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage());
    this.data = this._load();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _load(): WitnessXPData {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WitnessXPData;
        // Validate shape
        if (
          typeof parsed.totalXP === 'number' &&
          typeof parsed.eventCounts === 'object' &&
          parsed.eventCounts !== null
        ) {
          return {
            totalXP:     Math.max(0, parsed.totalXP),
            eventCounts: parsed.eventCounts,
            lastUpdated: parsed.lastUpdated ?? Date.now(),
          };
        }
      }
    } catch {
      // Corrupt data — start fresh
    }
    return this._defaultData();
  }

  private _defaultData(): WitnessXPData {
    return {
      totalXP:     0,
      eventCounts: {},
      lastUpdated: Date.now(),
    };
  }

  private _save(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable — continue in-memory
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Award XP for a witnessed event.
   * Returns the XP amount awarded (0 if event type is unknown).
   */
  addXP(eventType: string): number {
    const amount = XP_AWARDS[eventType] ?? 0;
    if (amount <= 0) return 0;

    this.data.totalXP += amount;
    this.data.eventCounts[eventType] = (this.data.eventCounts[eventType] ?? 0) + 1;
    this.data.lastUpdated = Date.now();
    this._save();

    return amount;
  }

  /**
   * Returns the current level definition based on total XP.
   */
  getLevel(): LevelDef {
    let current = LEVELS[0];
    for (const level of LEVELS) {
      if (this.data.totalXP >= level.minXP) {
        current = level;
      } else {
        break;
      }
    }
    return current;
  }

  /**
   * Returns level index (0 = Newcomer, 7 = Mythic).
   */
  getLevelIndex(): number {
    let idx = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      if (this.data.totalXP >= LEVELS[i].minXP) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }

  /**
   * Returns detailed progress within the current level band.
   */
  getLevelProgress(): LevelProgress {
    const idx = this.getLevelIndex();
    const current = LEVELS[idx];
    const next = LEVELS[idx + 1] ?? null;

    if (!next) {
      // Max level
      return {
        currentLevel: current,
        nextLevel:    null,
        xpIntoLevel:  this.data.totalXP - current.minXP,
        xpForLevel:   null,
        fraction:     1,
      };
    }

    const xpIntoLevel = this.data.totalXP - current.minXP;
    const xpForLevel  = next.minXP - current.minXP;
    const fraction    = Math.min(1, xpIntoLevel / xpForLevel);

    return {
      currentLevel: current,
      nextLevel:    next,
      xpIntoLevel,
      xpForLevel,
      fraction,
    };
  }

  /**
   * Returns a summary of all stats.
   */
  getStats(): WitnessStats {
    const levelDef  = this.getLevel();
    const levelIndex = this.getLevelIndex();
    const totalEventsWitnessed = Object.values(this.data.eventCounts).reduce((a, b) => a + b, 0);

    return {
      totalXP:              this.data.totalXP,
      level:                levelDef.name,
      levelIndex,
      eventCounts:          { ...this.data.eventCounts },
      totalEventsWitnessed,
      lastUpdated:          this.data.lastUpdated,
    };
  }

  /**
   * Returns current total XP.
   */
  getTotalXP(): number {
    return this.data.totalXP;
  }

  /**
   * Reset all XP and event counts. Returns to Newcomer state.
   */
  reset(): void {
    this.data = this._defaultData();
    this._save();
  }
}

// ── MemoryStorage fallback (for Node.js / test environments) ──────────────────

export class MemoryStorage implements Storage {
  private _store: Map<string, string> = new Map();

  get length(): number {
    return this._store.size;
  }

  key(index: number): string | null {
    return Array.from(this._store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this._store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this._store.set(key, value);
  }

  removeItem(key: string): void {
    this._store.delete(key);
  }

  clear(): void {
    this._store.clear();
  }
}

// ── Default singleton (browser environment) ───────────────────────────────────

let _defaultTracker: WitnessXPTracker | null = null;

/**
 * Get or create the default WitnessXPTracker singleton (uses real localStorage).
 * Safe to call in browser; falls back to in-memory in Node.js.
 */
export function getWitnessXPTracker(): WitnessXPTracker {
  if (!_defaultTracker) {
    _defaultTracker = new WitnessXPTracker();
  }
  return _defaultTracker;
}
