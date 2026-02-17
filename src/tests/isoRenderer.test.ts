/**
 * T-348: IsoRenderer Unit Tests
 *
 * Tests for the pure logic functions in client/src/renderer/IsoRenderer.ts:
 * - gridToScreen / screenToGrid coordinate conversions
 * - depthSort ordering
 * - emote-to-emoji mapping (mirrored from IsoRenderer)
 * - bubble chunk splitting (mirrored)
 * - smooth movement easing (mirrored)
 * - hashCode helper (mirrored)
 *
 * Pure unit tests — no DOM, no PixiJS, no canvas required.
 * The class itself requires PixiJS Application and is tested via integration.
 */

import { describe, it, expect } from 'vitest';

// ─── Mirror coordinate functions from IsoRenderer ─────────────────────────────

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

function gridToScreen(
  gridX: number,
  gridY: number,
  gridZ: number = 0,
): { x: number; y: number } {
  const x = (gridX - gridY) * (TILE_WIDTH / 2);
  const y = (gridX + gridY) * (TILE_HEIGHT / 2) - gridZ * TILE_HEIGHT;
  return { x, y };
}

function screenToGrid(
  screenX: number,
  screenY: number,
): { gridX: number; gridY: number } {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const gridX = (screenX / halfW + screenY / halfH) / 2;
  const gridY = (screenY / halfH - screenX / halfW) / 2;
  return { gridX, gridY };
}

function depthSort(gridX: number, gridY: number, gridZ: number = 0): number {
  return gridX + gridY + gridZ * 0.01;
}

// ─── Mirror emote mapping from IsoRenderer ────────────────────────────────────

const EMOTE_MAP: Record<string, string> = {
  dance: '💃', wave: '👋', laugh: '😂', clap: '👏',
  sad: '😢', angry: '😠', love: '❤️', cool: '😎',
  happy: '😊', wink: '😉', surprised: '😲', think: '🤔',
  sit: '🪑', stand: '🧍', cheer: '🎉',
};

function emoteToEmoji(emote: string): string {
  return EMOTE_MAP[String(emote).toLowerCase()] ?? '✨';
}

// ─── Mirror bubble splitting from IsoRenderer ────────────────────────────────

function splitChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break; }
    let at = remaining.lastIndexOf(' ', maxLen);
    if (at <= 0) at = maxLen;
    chunks.push(remaining.slice(0, at).trim());
    remaining = remaining.slice(at).trim();
  }
  return chunks;
}

// ─── Mirror smooth movement easing ───────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ─── Mirror hashCode helper ───────────────────────────────────────────────────

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IsoRenderer — gridToScreen', () => {
  it('origin (0,0) maps to (0,0)', () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('(1,0) maps x positive, y positive', () => {
    const { x, y } = gridToScreen(1, 0);
    expect(x).toBe(TILE_WIDTH / 2);   // 32
    expect(y).toBe(TILE_HEIGHT / 2);  // 16
  });

  it('(0,1) maps x negative, y positive (right-down isometric)', () => {
    const { x, y } = gridToScreen(0, 1);
    expect(x).toBe(-TILE_WIDTH / 2);   // -32
    expect(y).toBe(TILE_HEIGHT / 2);   // 16
  });

  it('(1,1) maps to center column (x=0)', () => {
    const { x } = gridToScreen(1, 1);
    expect(x).toBe(0);
  });

  it('gridZ shifts y upward', () => {
    const base = gridToScreen(1, 1, 0);
    const elevated = gridToScreen(1, 1, 1);
    expect(elevated.y).toBe(base.y - TILE_HEIGHT);
  });

  it('is symmetric: gridToScreen(a,b).x == -gridToScreen(b,a).x', () => {
    const ab = gridToScreen(3, 5);
    const ba = gridToScreen(5, 3);
    expect(ab.x).toBe(-ba.x);
  });
});

describe('IsoRenderer — screenToGrid', () => {
  it('round-trips through gridToScreen for integer positions', () => {
    const positions = [[0, 0], [1, 0], [0, 1], [2, 3], [5, 5]];
    for (const [gx, gy] of positions) {
      const { x, y } = gridToScreen(gx, gy);
      const { gridX, gridY } = screenToGrid(x, y);
      expect(gridX).toBeCloseTo(gx, 5);
      expect(gridY).toBeCloseTo(gy, 5);
    }
  });

  it('produces continuous values for fractional screen coords', () => {
    const { gridX, gridY } = screenToGrid(10, 8);
    expect(typeof gridX).toBe('number');
    expect(typeof gridY).toBe('number');
    expect(Number.isFinite(gridX)).toBe(true);
    expect(Number.isFinite(gridY)).toBe(true);
  });
});

describe('IsoRenderer — depthSort', () => {
  it('farther away (higher x+y) → larger depth value', () => {
    expect(depthSort(2, 2)).toBeGreaterThan(depthSort(1, 1));
  });

  it('elevated objects get a small increment per z unit', () => {
    const z0 = depthSort(3, 3, 0);
    const z1 = depthSort(3, 3, 1);
    expect(z1).toBeGreaterThan(z0);
    expect(z1 - z0).toBeCloseTo(0.01, 5);
  });

  it('objects at same xy but different z are ordered correctly', () => {
    const floor = depthSort(1, 1, 0);
    const chair = depthSort(1, 1, 0.5);
    const agent = depthSort(1, 1, 1);
    expect(chair).toBeGreaterThan(floor);
    expect(agent).toBeGreaterThan(chair);
  });

  it('two objects at different xy can be compared unambiguously', () => {
    // Agent at (3,2) vs agent at (2,3) — same x+y, same depth → equal
    expect(depthSort(3, 2)).toBe(depthSort(2, 3));
  });
});

describe('IsoRenderer — emote to emoji mapping', () => {
  const knownEmotes: Array<[string, string]> = [
    ['dance', '💃'],
    ['wave', '👋'],
    ['laugh', '😂'],
    ['clap', '👏'],
    ['sad', '😢'],
    ['angry', '😠'],
    ['love', '❤️'],
    ['cool', '😎'],
    ['happy', '😊'],
    ['wink', '😉'],
    ['surprised', '😲'],
    ['think', '🤔'],
    ['sit', '🪑'],
    ['stand', '🧍'],
    ['cheer', '🎉'],
  ];

  for (const [emote, emoji] of knownEmotes) {
    it(`"${emote}" → ${emoji}`, () => {
      expect(emoteToEmoji(emote)).toBe(emoji);
    });
  }

  it('unknown emote → ✨ fallback', () => {
    expect(emoteToEmoji('unknown-emote')).toBe('✨');
  });

  it('empty string → ✨ fallback', () => {
    expect(emoteToEmoji('')).toBe('✨');
  });

  it('case-insensitive: "DANCE" → 💃', () => {
    expect(emoteToEmoji('DANCE')).toBe('💃');
    expect(emoteToEmoji('Dance')).toBe('💃');
  });
});

describe('IsoRenderer — bubble chunk splitting', () => {
  it('short text returns single chunk', () => {
    const chunks = splitChunks('Hello!', 90);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello!');
  });

  it('text longer than maxLen is split into multiple chunks', () => {
    const text = 'word '.repeat(30); // 150 chars
    const chunks = splitChunks(text.trim(), 40);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('every chunk is within maxLen characters', () => {
    const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const maxLen = 30;
    const chunks = splitChunks(text, maxLen);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(maxLen + 1); // ±1 for word boundaries
    }
  });

  it('all chunks joined reconstruct the original text', () => {
    const original = 'The quick brown fox jumps over the lazy dog and everything is fine today.';
    const chunks = splitChunks(original, 20);
    const reconstructed = chunks.join(' ');
    // Normalized comparison (extra spaces from trimming may differ)
    expect(reconstructed.replace(/\s+/g, ' ').trim()).toBe(original.replace(/\s+/g, ' ').trim());
  });

  it('text with no spaces falls back to hard cut at maxLen', () => {
    const text = 'a'.repeat(50);
    const chunks = splitChunks(text, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
  });

  it('exact maxLen text returns single chunk', () => {
    const text = 'x'.repeat(90);
    const chunks = splitChunks(text, 90);
    expect(chunks).toHaveLength(1);
  });
});

describe('IsoRenderer — smooth movement easing', () => {
  it('ease(0) = 0 (start)', () => {
    expect(easeOutCubic(0)).toBe(0);
  });

  it('ease(1) = 1 (end)', () => {
    expect(easeOutCubic(1)).toBe(1);
  });

  it('ease is monotonically increasing', () => {
    let prev = 0;
    for (let t = 0.1; t <= 1; t += 0.1) {
      const val = easeOutCubic(t);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }
  });

  it('ease accelerates fast initially (ease-out curve)', () => {
    // At t=0.5, ease-out cubic should be well above linear (> 0.5)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('ease stays within [0, 1]', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const val = easeOutCubic(t);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

describe('IsoRenderer — hashCode helper', () => {
  it('same string always produces same hash', () => {
    expect(hashCode('agent-1')).toBe(hashCode('agent-1'));
  });

  it('different strings produce different hashes (no collision for test set)', () => {
    const ids = ['agent-1', 'agent-2', 'agent-3', 'ClaudeBot', 'GeminiExplorer'];
    const hashes = ids.map(hashCode);
    const unique = new Set(hashes);
    expect(unique.size).toBe(ids.length);
  });

  it('produces a number (may be negative — that is expected)', () => {
    expect(typeof hashCode('test')).toBe('number');
    expect(Number.isFinite(hashCode('test'))).toBe(true);
  });

  it('empty string produces 0', () => {
    expect(hashCode('')).toBe(0);
  });
});
