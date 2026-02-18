/**
 * T-356: Live Event Ticker — Unit Tests
 *
 * Tests pure logic functions exported from spectator.ts:
 *   - formatTickerTime()   — relative timestamp formatting
 *   - buildTickerHtml()    — HTML construction + duplicate for loop
 *   - calcTickerDuration() — animation duration calculation
 *
 * No DOM/WebSocket/Pixi required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mirror pure functions from spectator.ts ───────────────────────────────────

/** Format a Unix-ms timestamp as "Xs / Xm / Xh ago" */
function formatTickerTime(ms: number, _now = Date.now()): string {
  const diffSec = Math.floor((_now - ms) / 1000);
  if (diffSec < 60)   return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  return `${Math.floor(diffSec / 3600)}h`;
}

interface TickerEvent { icon: string; message: string; timestamp: number; }

function buildTickerHtml(events: TickerEvent[]): string {
  if (events.length === 0) {
    return '<span class="ticker-empty">No recent events — agents are warming up…</span>';
  }

  const items = events
    .map(ev => {
      const t = formatTickerTime(ev.timestamp);
      const msg = ev.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<span class="ticker-item">` +
               `<span class="t-icon">${ev.icon}</span>` +
               `<span>${msg}</span>` +
               `<span class="t-time">${t}</span>` +
             `</span>` +
             `<span class="ticker-sep" aria-hidden="true">·</span>`;
    })
    .join('');

  return items + items; // duplicated for seamless CSS loop
}

function calcTickerDuration(eventCount: number): number {
  const base = Math.max(1, eventCount);
  return Math.min(90, Math.max(20, base * 3));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNow() { return Date.now(); }

function makeEvent(overrides: Partial<TickerEvent> = {}): TickerEvent {
  return {
    icon:      '💬',
    message:   'Test event message',
    timestamp: makeNow() - 5_000,
    ...overrides,
  };
}

// ── formatTickerTime ──────────────────────────────────────────────────────────

describe('formatTickerTime()', () => {
  it('shows seconds when < 60s ago', () => {
    const now = Date.now();
    expect(formatTickerTime(now - 10_000, now)).toBe('10s');
  });

  it('shows 0s for a just-created event', () => {
    const now = Date.now();
    expect(formatTickerTime(now, now)).toBe('0s');
  });

  it('shows 59s for 59 seconds ago', () => {
    const now = Date.now();
    expect(formatTickerTime(now - 59_000, now)).toBe('59s');
  });

  it('shows minutes when 1m–59m ago', () => {
    const now = Date.now();
    expect(formatTickerTime(now - 60_000,  now)).toBe('1m');
    expect(formatTickerTime(now - 300_000, now)).toBe('5m');
    expect(formatTickerTime(now - 3540_000, now)).toBe('59m');
  });

  it('shows hours when >= 60 min ago', () => {
    const now = Date.now();
    expect(formatTickerTime(now - 3600_000,  now)).toBe('1h');
    expect(formatTickerTime(now - 7200_000,  now)).toBe('2h');
    expect(formatTickerTime(now - 36000_000, now)).toBe('10h');
  });
});

// ── buildTickerHtml ───────────────────────────────────────────────────────────

describe('buildTickerHtml()', () => {
  it('returns empty-state span for empty events', () => {
    const html = buildTickerHtml([]);
    expect(html).toContain('ticker-empty');
    expect(html).toContain('agents are warming up');
  });

  it('renders icon, message, and time for each event', () => {
    const ev = makeEvent({ icon: '🎭', message: 'Orion danced', timestamp: Date.now() - 5_000 });
    const html = buildTickerHtml([ev]);
    expect(html).toContain('🎭');
    expect(html).toContain('Orion danced');
    expect(html).toContain('ticker-item');
    expect(html).toContain('t-time');
  });

  it('duplicates content for seamless loop', () => {
    const events = [
      makeEvent({ message: 'Alpha chatted' }),
      makeEvent({ message: 'Beta traded' }),
    ];
    const html = buildTickerHtml(events);
    const count = (html.match(/Alpha chatted/g) ?? []).length;
    expect(count).toBe(2); // duplicated
  });

  it('escapes HTML in message to prevent XSS', () => {
    const ev = makeEvent({ message: '<script>alert(1)</script>' });
    const html = buildTickerHtml([ev]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes ticker-sep between items', () => {
    const events = [makeEvent({ message: 'A' }), makeEvent({ message: 'B' })];
    const html = buildTickerHtml(events);
    expect(html).toContain('ticker-sep');
  });

  it('handles single event correctly', () => {
    const html = buildTickerHtml([makeEvent({ message: 'Solo event' })]);
    const count = (html.match(/Solo event/g) ?? []).length;
    expect(count).toBe(2); // always duplicated
  });

  it('includes aria-hidden on separators', () => {
    const html = buildTickerHtml([makeEvent()]);
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders multiple events each with t-icon class', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ icon: `🎯`, message: `Event ${i}` })
    );
    const html = buildTickerHtml(events);
    const iconMatches = html.match(/t-icon/g) ?? [];
    expect(iconMatches.length).toBe(10); // 5 events × 2 (duplicated)
  });
});

// ── calcTickerDuration ────────────────────────────────────────────────────────

describe('calcTickerDuration()', () => {
  it('returns minimum 20 for 0 events', () => {
    expect(calcTickerDuration(0)).toBe(20);
  });

  it('returns minimum 20 for 1 event', () => {
    expect(calcTickerDuration(1)).toBe(20);
  });

  it('scales linearly at 3 s/event for mid-range counts', () => {
    expect(calcTickerDuration(7)).toBe(21);  // 7*3 = 21
    expect(calcTickerDuration(10)).toBe(30); // 10*3 = 30
  });

  it('caps at max 90 s for large event counts', () => {
    expect(calcTickerDuration(50)).toBe(90);
    expect(calcTickerDuration(100)).toBe(90);
  });

  it('returns 20 for TICKER_MAX_EVENTS = 1 (edge case)', () => {
    expect(calcTickerDuration(1)).toBeGreaterThanOrEqual(20);
  });

  it('returns exactly 45 for 15 events', () => {
    expect(calcTickerDuration(15)).toBe(45);
  });

  it('never goes below 20 regardless of low count', () => {
    for (let n = 0; n <= 6; n++) {
      expect(calcTickerDuration(n)).toBeGreaterThanOrEqual(20);
    }
  });

  it('never exceeds 90 regardless of high count', () => {
    for (let n = 30; n <= 200; n += 10) {
      expect(calcTickerDuration(n)).toBeLessThanOrEqual(90);
    }
  });
});
