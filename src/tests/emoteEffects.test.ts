/**
 * T-338: Emote Visual Effects — Unit Tests
 * Tests for:
 * - Emote emoji mapping
 * - Fallback to ✨ for unknown emotes
 * - Animation lifecycle (no PixiJS needed — mocked)
 * - Edge cases: null agent, missing sprite, empty emote
 *
 * Pure unit tests — no database or PixiJS required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mirror of EMOTE_EMOJI_MAP from spectate.js ───────────────────────────────
const EMOTE_EMOJI_MAP: Record<string, string> = {
  dance: '💃', wave: '👋', laugh: '😂', clap: '👏',
  sad: '😢', angry: '😠', love: '❤️', cool: '😎',
  happy: '😊', wink: '😉', surprised: '😲', think: '🤔',
};

function getEmoteEmoji(emote: string | undefined | null): string {
  if (!emote) return '✨';
  const lower = String(emote).toLowerCase();
  return EMOTE_EMOJI_MAP[lower] || '✨';
}

// ─── Mirror of showEmoteEffect guard logic ────────────────────────────────────
interface MockAgent {
  sprite: object | null;
  name: string;
}

function canShowEffect(PIXI: unknown, contentContainer: unknown, agent: MockAgent | null): boolean {
  return !!(PIXI && contentContainer && agent && agent.sprite);
}

// ─── Animation state tracker ─────────────────────────────────────────────────
interface AnimState {
  startAlpha: number;
  startY: number;
  duration: number;
  rise: number;
}

function buildAnimState(startY: number): AnimState {
  return { startAlpha: 1, startY, duration: 1800, rise: 45 };
}

function stepAnim(state: AnimState, elapsedMs: number): { y: number; alpha: number; done: boolean } {
  const t = Math.min(elapsedMs / state.duration, 1);
  return {
    y: state.startY - state.rise * t,
    alpha: 1 - t,
    done: t >= 1,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Emote Emoji Map', () => {
  it.each([
    ['dance',     '💃'],
    ['wave',      '👋'],
    ['laugh',     '😂'],
    ['clap',      '👏'],
    ['sad',       '😢'],
    ['angry',     '😠'],
    ['love',      '❤️'],
    ['cool',      '😎'],
    ['happy',     '😊'],
    ['wink',      '😉'],
    ['surprised', '😲'],
    ['think',     '🤔'],
  ] as const)('maps %s → %s', (emote, expected) => {
    expect(getEmoteEmoji(emote)).toBe(expected);
  });

  it('returns ✨ for unknown emote string', () => {
    expect(getEmoteEmoji('moonwalk')).toBe('✨');
    expect(getEmoteEmoji('shrug')).toBe('✨');
    expect(getEmoteEmoji('facepalm')).toBe('✨');
  });

  it('returns ✨ for empty string', () => {
    expect(getEmoteEmoji('')).toBe('✨');
  });

  it('returns ✨ for null', () => {
    expect(getEmoteEmoji(null)).toBe('✨');
  });

  it('returns ✨ for undefined', () => {
    expect(getEmoteEmoji(undefined)).toBe('✨');
  });

  it('is case-insensitive', () => {
    expect(getEmoteEmoji('DANCE')).toBe('💃');
    expect(getEmoteEmoji('Wave')).toBe('👋');
    expect(getEmoteEmoji('LAUGH')).toBe('😂');
  });

  it('covers all 12 mapped emotes', () => {
    expect(Object.keys(EMOTE_EMOJI_MAP).length).toBe(12);
  });
});

describe('Emote Effect Guard Logic', () => {
  const mockPIXI = {};
  const mockContainer = {};

  it('returns true when all required objects are present', () => {
    const agent: MockAgent = { sprite: {}, name: 'Alice' };
    expect(canShowEffect(mockPIXI, mockContainer, agent)).toBe(true);
  });

  it('returns false when PIXI not loaded', () => {
    const agent: MockAgent = { sprite: {}, name: 'Alice' };
    expect(canShowEffect(null, mockContainer, agent)).toBe(false);
    expect(canShowEffect(undefined, mockContainer, agent)).toBe(false);
  });

  it('returns false when contentContainer not ready', () => {
    const agent: MockAgent = { sprite: {}, name: 'Alice' };
    expect(canShowEffect(mockPIXI, null, agent)).toBe(false);
  });

  it('returns false when agent is null', () => {
    expect(canShowEffect(mockPIXI, mockContainer, null)).toBe(false);
  });

  it('returns false when agent has no sprite (not rendered)', () => {
    const agent: MockAgent = { sprite: null, name: 'Alice' };
    expect(canShowEffect(mockPIXI, mockContainer, agent)).toBe(false);
  });
});

describe('Emote Animation Logic', () => {
  it('starts at alpha 1 and y = startY', () => {
    const state = buildAnimState(100);
    const frame = stepAnim(state, 0);
    expect(frame.alpha).toBe(1);
    expect(frame.y).toBe(100);
    expect(frame.done).toBe(false);
  });

  it('at 50% through: alpha ≈ 0.5, y ≈ startY - rise/2', () => {
    const state = buildAnimState(200);
    const frame = stepAnim(state, 900); // 900ms = 50% of 1800ms
    expect(frame.alpha).toBeCloseTo(0.5, 2);
    expect(frame.y).toBeCloseTo(200 - 22.5, 1); // 200 - 45*0.5
    expect(frame.done).toBe(false);
  });

  it('at 100% (end): alpha = 0, y = startY - rise, done = true', () => {
    const state = buildAnimState(150);
    const frame = stepAnim(state, 1800);
    expect(frame.alpha).toBe(0);
    expect(frame.y).toBe(150 - 45);
    expect(frame.done).toBe(true);
  });

  it('clamps at t=1 even if elapsed > duration', () => {
    const state = buildAnimState(0);
    const frame = stepAnim(state, 9999);
    expect(frame.alpha).toBe(0);
    expect(frame.done).toBe(true);
  });

  it('rise distance is 45px total', () => {
    const state = buildAnimState(0);
    const start = stepAnim(state, 0);
    const end   = stepAnim(state, 1800);
    expect(start.y - end.y).toBe(45);
  });

  it('animation duration is 1800ms', () => {
    const state = buildAnimState(0);
    expect(state.duration).toBe(1800);
  });
});
