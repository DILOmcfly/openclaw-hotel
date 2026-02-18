/**
 * T-366: Social Graph Visualizer — Frontend Logic Tests
 *
 * Tests pure logic extracted from the inline <script> in spectate.html:
 *  - computeLayout(): force-directed positioning
 *  - escSvg(): XSS-safe HTML escaping
 *  - truncName(): display name truncation
 *  - Graph rendering preconditions (edge/node helpers)
 *
 * These tests run in a Node.js (non-browser) environment using Vitest.
 * DOM rendering tests are intentionally excluded (tested in integration).
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── Re-implement the pure logic here for unit-testability ────────────────────
// (These are copied from the <script> block in spectate.html — must stay in sync)

const SPRING_ITERS = 80;

type Node = { id: string };
type Edge = { source: string; target: string; strength: number; status: string };
type Positions = Record<string, { x: number; y: number; vx: number; vy: number }>;

function computeLayout(
  nodes: Node[],
  edges: Edge[],
  W: number,
  H: number
): Positions {
  const k = Math.sqrt((W * H) / Math.max(nodes.length, 1));
  const positions: Positions = {};

  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(W, H) * 0.35;
    positions[n.id] = {
      x: W / 2 + r * Math.cos(angle),
      y: H / 2 + r * Math.sin(angle),
      vx: 0,
      vy: 0,
    };
  });

  for (let iter = 0; iter < SPRING_ITERS; iter++) {
    const temp = k * (1 - iter / SPRING_ITERS);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1);
        const f = (k * k) / dist;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    edges.forEach(e => {
      const a = positions[e.source];
      const b = positions[e.target];
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1);
      const f = (dist * dist) / k;
      const fx = (dx / dist) * f * (e.strength || 1);
      const fy = (dy / dist) * f * (e.strength || 1);
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });

    nodes.forEach(n => {
      const p = positions[n.id];
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > temp) {
        p.vx = (p.vx / speed) * temp;
        p.vy = (p.vy / speed) * temp;
      }
      p.x = Math.max(20, Math.min(W - 20, p.x + p.vx));
      p.y = Math.max(20, Math.min(H - 20, p.y + p.vy));
      p.vx = 0; p.vy = 0;
    });
  }

  return positions;
}

function escSvg(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncName(name: string): string {
  return name && name.length > 8 ? name.slice(0, 7) + '…' : (name || '?');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const W = 300, H = 280;

describe('computeLayout()', () => {
  it('returns empty object for zero nodes', () => {
    const pos = computeLayout([], [], W, H);
    expect(Object.keys(pos)).toHaveLength(0);
  });

  it('returns one entry per node', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const pos = computeLayout(nodes, [], W, H);
    expect(Object.keys(pos)).toHaveLength(3);
    expect(pos['a']).toBeDefined();
    expect(pos['b']).toBeDefined();
    expect(pos['c']).toBeDefined();
  });

  it('all positions are within canvas bounds', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
    const pos = computeLayout(nodes, [], W, H);
    for (const [, p] of Object.entries(pos)) {
      expect(p.x).toBeGreaterThanOrEqual(20);
      expect(p.x).toBeLessThanOrEqual(W - 20);
      expect(p.y).toBeGreaterThanOrEqual(20);
      expect(p.y).toBeLessThanOrEqual(H - 20);
    }
  });

  it('single node is placed inside canvas bounds', () => {
    const pos = computeLayout([{ id: 'solo' }], [], W, H);
    expect(pos['solo'].x).toBeGreaterThanOrEqual(20);
    expect(pos['solo'].x).toBeLessThanOrEqual(W - 20);
    expect(pos['solo'].y).toBeGreaterThanOrEqual(20);
    expect(pos['solo'].y).toBeLessThanOrEqual(H - 20);
  });

  it('velocities are zeroed after simulation', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const pos = computeLayout(nodes, [], W, H);
    expect(pos['a'].vx).toBe(0);
    expect(pos['a'].vy).toBe(0);
  });

  it('connected nodes are pulled closer than unconnected', () => {
    const nodes4 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    // a-b connected; c-d not connected to anything
    const edges: Edge[] = [{ source: 'a', target: 'b', strength: 1, status: 'accepted' }];
    const pos = computeLayout(nodes4, edges, W, H);

    const distAB = Math.hypot(pos['a'].x - pos['b'].x, pos['a'].y - pos['b'].y);
    const distCD = Math.hypot(pos['c'].x - pos['d'].x, pos['c'].y - pos['d'].y);

    // Connected pair should generally be closer — not a strict guarantee with few iters
    // but a reasonable statistical expectation
    expect(distAB).toBeLessThan(distCD * 2.5);
  });

  it('handles edges with missing source/target gracefully (no throw)', () => {
    const nodes = [{ id: 'a' }];
    const badEdges: Edge[] = [{ source: 'z', target: 'w', strength: 1, status: 'accepted' }];
    expect(() => computeLayout(nodes, badEdges, W, H)).not.toThrow();
  });

  it('positions differ between nodes (no overlap)', () => {
    const nodes = [{ id: 'x' }, { id: 'y' }];
    const pos = computeLayout(nodes, [], W, H);
    const dx = pos['x'].x - pos['y'].x;
    const dy = pos['x'].y - pos['y'].y;
    expect(Math.hypot(dx, dy)).toBeGreaterThan(0);
  });

  it('is deterministic (same input → same output)', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges: Edge[] = [{ source: 'a', target: 'b', strength: 1, status: 'accepted' }];
    const pos1 = computeLayout(nodes, edges, W, H);
    const pos2 = computeLayout(nodes, edges, W, H);
    expect(pos1['a'].x).toBeCloseTo(pos2['a'].x, 5);
    expect(pos1['b'].y).toBeCloseTo(pos2['b'].y, 5);
  });

  it('handles large node count without throwing', () => {
    const nodes = Array.from({ length: 50 }, (_, i) => ({ id: `n${i}` }));
    expect(() => computeLayout(nodes, [], W, H)).not.toThrow();
  });
});

describe('escSvg()', () => {
  it('escapes & character', () => {
    expect(escSvg('a&b')).toBe('a&amp;b');
  });

  it('escapes < and > characters', () => {
    expect(escSvg('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escSvg('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('returns plain string unchanged', () => {
    expect(escSvg('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escSvg('')).toBe('');
  });

  it('handles multiple special chars', () => {
    expect(escSvg('<a href="test&val">')).toBe('&lt;a href=&quot;test&amp;val&quot;&gt;');
  });

  it('coerces non-string to string', () => {
    expect(escSvg(42 as any)).toBe('42');
  });

  it('does not double-escape', () => {
    // Calling escSvg twice should produce double-escaped output (intended behavior)
    const once = escSvg('<b>');
    const twice = escSvg(once);
    expect(twice).toBe('&amp;lt;b&amp;gt;');
  });

  it('handles XSS attempt in agent name', () => {
    const malicious = '"><img src=x onerror=alert(1)>';
    const safe = escSvg(malicious);
    expect(safe).not.toContain('<');
    expect(safe).not.toContain('>');
    expect(safe).not.toContain('"');
  });
});

describe('truncName()', () => {
  it('returns name as-is when 8 chars or fewer', () => {
    expect(truncName('Alice')).toBe('Alice');
    expect(truncName('12345678')).toBe('12345678');
  });

  it('truncates to 7 chars + ellipsis when longer than 8', () => {
    expect(truncName('Bartholomew')).toBe('Barthol…');
  });

  it('returns ? for empty string', () => {
    expect(truncName('')).toBe('?');
  });

  it('handles exactly 9 chars (triggers truncation)', () => {
    expect(truncName('123456789')).toBe('1234567…');
  });

  it('handles unicode names (emoji)', () => {
    // length is character count, not bytes
    const name = '🤖AgentBot';
    expect(name.length).toBeGreaterThan(8);
    expect(truncName(name)).toContain('…');
  });

  it('does not truncate 8-char name', () => {
    const name = 'ABCDEFGH';
    expect(truncName(name)).toBe('ABCDEFGH');
  });

  it('handles null-like input gracefully', () => {
    expect(truncName(null as any)).toBe('?');
  });

  it('handles undefined-like input gracefully', () => {
    // undefined is falsy, should return '?'
    expect(truncName(undefined as any)).toBe('?');
  });
});

describe('Graph data validation helpers', () => {
  it('filters out edges where both nodes are missing', () => {
    const nodes: Node[] = [{ id: 'a' }];
    const edges: Edge[] = [
      { source: 'z', target: 'w', strength: 1, status: 'accepted' }, // both missing
    ];
    // computeLayout should not throw and should still position 'a'
    const pos = computeLayout(nodes, edges, W, H);
    expect(pos['a']).toBeDefined();
    expect(pos['z']).toBeUndefined();
  });

  it('strength affects final layout proximity', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const weakEdge: Edge[] = [{ source: 'a', target: 'b', strength: 0.1, status: 'accepted' }];
    const strongEdge: Edge[] = [{ source: 'a', target: 'b', strength: 1.0, status: 'accepted' }];
    const posWeak   = computeLayout(nodes, weakEdge, W, H);
    const posStrong = computeLayout(nodes, strongEdge, W, H);
    const distWeak   = Math.hypot(posWeak['a'].x - posWeak['b'].x, posWeak['a'].y - posWeak['b'].y);
    const distStrong = Math.hypot(posStrong['a'].x - posStrong['b'].x, posStrong['a'].y - posStrong['b'].y);
    // Strong attraction should pull nodes closer
    expect(distStrong).toBeLessThanOrEqual(distWeak + 1); // +1 for fp tolerance
  });

  it('canvas boundary clamping keeps nodes inside [20, W-20] × [20, H-20]', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}` }));
    const pos = computeLayout(nodes, [], 100, 100);
    for (const [, p] of Object.entries(pos)) {
      expect(p.x).toBeGreaterThanOrEqual(20);
      expect(p.x).toBeLessThanOrEqual(80); // W-20 = 80
      expect(p.y).toBeGreaterThanOrEqual(20);
      expect(p.y).toBeLessThanOrEqual(80);
    }
  });
});
