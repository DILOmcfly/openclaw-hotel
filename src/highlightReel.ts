/**
 * T-371: Spectator "Highlight Reel" Panel
 *
 * Tracks the best moments a spectator has witnessed across categories:
 *   - trade       — biggest/most impressive trade events
 *   - chat        — funniest or most notable messages
 *   - achievement — agents unlocking achievements
 *   - game        — game-related highlights (wins, combos, records)
 *
 * Moments are scored numerically; getTopMoments() returns the highest-scored.
 * Persisted in localStorage under the key 'highlightReel'.
 */

export type MomentCategory = 'trade' | 'chat' | 'achievement' | 'game';

export interface Moment {
  id: string;
  type: MomentCategory;
  data: Record<string, unknown>;
  score: number;
  timestamp: number; // ms since epoch
}

export interface HighlightReelStorage {
  moments: Moment[];
  version: number;
}

const STORAGE_KEY = 'highlightReel';
const STORAGE_VERSION = 1;
const VALID_CATEGORIES: MomentCategory[] = ['trade', 'chat', 'achievement', 'game'];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadFromStorage(storage: Storage): Moment[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: HighlightReelStorage = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.moments)) return [];
    return parsed.moments;
  } catch {
    return [];
  }
}

function saveToStorage(storage: Storage, moments: Moment[]): void {
  const payload: HighlightReelStorage = { moments, version: STORAGE_VERSION };
  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ─── ID generation (no external deps) ────────────────────────────────────────

let _idCounter = 0;
function generateId(): string {
  return `moment_${Date.now()}_${++_idCounter}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export class HighlightReel {
  private moments: Moment[];
  private readonly storage: Storage;
  private readonly now: () => number;

  /**
   * @param storage  Injectable storage (defaults to globalThis.localStorage).
   * @param now      Injectable clock (defaults to Date.now).
   */
  constructor(
    storage: Storage = (globalThis as any).localStorage,
    now: () => number = Date.now,
  ) {
    if (!storage) throw new Error('Storage is not available');
    this.storage = storage;
    this.now = now;
    this.moments = loadFromStorage(storage);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Record a new highlight moment.
   *
   * @param type   One of the four categories.
   * @param data   Arbitrary payload describing the moment.
   * @param score  Numeric quality score (higher = better).
   * @returns      The created Moment.
   * @throws       RangeError if type is invalid, TypeError if score is not finite.
   */
  addMoment(type: MomentCategory, data: Record<string, unknown>, score: number): Moment {
    if (!VALID_CATEGORIES.includes(type)) {
      throw new RangeError(`Invalid category: "${type}". Must be one of ${VALID_CATEGORIES.join(', ')}`);
    }
    if (!Number.isFinite(score)) {
      throw new TypeError(`score must be a finite number, got: ${score}`);
    }

    const moment: Moment = {
      id: generateId(),
      type,
      data: { ...data },
      score,
      timestamp: this.now(),
    };

    this.moments.push(moment);
    saveToStorage(this.storage, this.moments);
    return moment;
  }

  /**
   * Returns the top N moments by score (descending).
   * Ties are broken by most recent timestamp.
   *
   * @param n  Number of moments to return (default 5).
   */
  getTopMoments(n = 5): Moment[] {
    if (n <= 0) return [];
    return [...this.moments]
      .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
      .slice(0, n);
  }

  /**
   * Returns the single best (highest-scoring) moment per category.
   * Categories with no moments are omitted from the result.
   */
  getBestByCategory(): Partial<Record<MomentCategory, Moment>> {
    const best: Partial<Record<MomentCategory, Moment>> = {};
    for (const moment of this.moments) {
      const current = best[moment.type];
      if (!current || moment.score > current.score ||
          (moment.score === current.score && moment.timestamp > current.timestamp)) {
        best[moment.type] = moment;
      }
    }
    return best;
  }

  /**
   * Returns all moments for a specific category, sorted by score descending.
   */
  getByCategory(type: MomentCategory): Moment[] {
    return this.moments
      .filter(m => m.type === type)
      .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
  }

  /**
   * Returns the total number of stored moments.
   */
  count(): number {
    return this.moments.length;
  }

  /**
   * Clears all moments from memory and localStorage.
   */
  reset(): void {
    this.moments = [];
    this.storage.removeItem(STORAGE_KEY);
  }

  // ─── Static helpers ──────────────────────────────────────────────────────────

  static readonly STORAGE_KEY = STORAGE_KEY;
  static readonly VALID_CATEGORIES: readonly MomentCategory[] = VALID_CATEGORIES;
}
