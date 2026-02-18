/**
 * T-370: Live Trade Announcement Banner — Unit Tests
 *
 * 25+ tests covering:
 *   - TradeBannerController: show(), hide(), isVisible(), getAgents()
 *   - Text sanitization (XSS prevention)
 *   - Auto-hide timer logic
 *   - Reset / re-trigger behaviour
 *   - Edge cases (empty names, special chars, rapid fire)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Pure TradeBannerController (no DOM dependency) ────────────────────────────

interface TradeBannerState {
  visible: boolean;
  agentA: string;
  agentB: string;
  shownAt: number | null;
}

class TradeBannerController {
  private _state: TradeBannerState = {
    visible: false,
    agentA: '',
    agentB: '',
    shownAt: null,
  };

  private _hideTimer: ReturnType<typeof setTimeout> | null = null;
  private _displayMs: number;

  constructor(displayMs = 3200) {
    this._displayMs = displayMs;
  }

  /** Show banner for a trade between agentA and agentB. */
  show(agentA: string, agentB: string): void {
    const safeA = this._sanitize(agentA);
    const safeB = this._sanitize(agentB);

    // Cancel any running timer first
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    this._state = { visible: true, agentA: safeA, agentB: safeB, shownAt: Date.now() };

    this._hideTimer = setTimeout(() => {
      this._state.visible = false;
      this._hideTimer = null;
    }, this._displayMs);
  }

  /** Force-hide the banner immediately. */
  hide(): void {
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this._state.visible = false;
  }

  /** Returns true if the banner is currently shown. */
  isVisible(): boolean {
    return this._state.visible;
  }

  /** Returns the current agent names. */
  getAgents(): { agentA: string; agentB: string } {
    return { agentA: this._state.agentA, agentB: this._state.agentB };
  }

  /** Returns timestamp of last show() call (null if never shown or after hide). */
  getShownAt(): number | null {
    return this._state.visible ? this._state.shownAt : null;
  }

  /** Returns the formatted display string. */
  getDisplayText(): string {
    if (!this._state.visible) return '';
    return `${this._state.agentA} ↔ ${this._state.agentB}`;
  }

  /** Sanitize a string to prevent XSS (strip HTML tags). */
  private _sanitize(name: string): string {
    if (!name || typeof name !== 'string') return 'Unknown';
    return name
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim()
      .slice(0, 40); // max 40 chars
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TradeBannerController — show()', () => {
  let ctrl: TradeBannerController;

  beforeEach(() => {
    vi.useFakeTimers();
    ctrl = new TradeBannerController(3200);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be invisible on init', () => {
    expect(ctrl.isVisible()).toBe(false);
  });

  it('should become visible after show()', () => {
    ctrl.show('AlphaBot', 'BetaBot');
    expect(ctrl.isVisible()).toBe(true);
  });

  it('should store agent names correctly', () => {
    ctrl.show('AlphaBot', 'BetaBot');
    expect(ctrl.getAgents()).toEqual({ agentA: 'AlphaBot', agentB: 'BetaBot' });
  });

  it('should return correct display text', () => {
    ctrl.show('Trader99', 'Seller42');
    expect(ctrl.getDisplayText()).toBe('Trader99 ↔ Seller42');
  });

  it('should auto-hide after displayMs', () => {
    ctrl.show('A', 'B');
    expect(ctrl.isVisible()).toBe(true);
    vi.advanceTimersByTime(3200);
    expect(ctrl.isVisible()).toBe(false);
  });

  it('should still be visible just before auto-hide', () => {
    ctrl.show('A', 'B');
    vi.advanceTimersByTime(3199);
    expect(ctrl.isVisible()).toBe(true);
  });

  it('should reset timer on re-trigger', () => {
    ctrl.show('A', 'B');
    vi.advanceTimersByTime(2000);
    ctrl.show('C', 'D'); // re-trigger
    vi.advanceTimersByTime(2000); // 2s after re-trigger (4s total)
    expect(ctrl.isVisible()).toBe(true); // should still be visible
  });

  it('should update agents on re-trigger', () => {
    ctrl.show('A', 'B');
    ctrl.show('C', 'D');
    expect(ctrl.getAgents()).toEqual({ agentA: 'C', agentB: 'D' });
  });

  it('should auto-hide after the new timer when re-triggered', () => {
    ctrl.show('A', 'B');
    vi.advanceTimersByTime(2000);
    ctrl.show('C', 'D');
    vi.advanceTimersByTime(3200); // full timer after re-trigger
    expect(ctrl.isVisible()).toBe(false);
  });

  it('should record shownAt timestamp when visible', () => {
    ctrl.show('A', 'B');
    expect(ctrl.getShownAt()).not.toBeNull();
    expect(typeof ctrl.getShownAt()).toBe('number');
  });

  it('should return null shownAt when not visible', () => {
    expect(ctrl.getShownAt()).toBeNull();
  });

  it('getDisplayText should return empty string when not visible', () => {
    expect(ctrl.getDisplayText()).toBe('');
  });
});

describe('TradeBannerController — hide()', () => {
  let ctrl: TradeBannerController;

  beforeEach(() => {
    vi.useFakeTimers();
    ctrl = new TradeBannerController(3200);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should hide immediately on hide()', () => {
    ctrl.show('A', 'B');
    ctrl.hide();
    expect(ctrl.isVisible()).toBe(false);
  });

  it('should cancel auto-hide timer on hide()', () => {
    ctrl.show('A', 'B');
    ctrl.hide();
    vi.advanceTimersByTime(4000); // timer would have fired
    expect(ctrl.isVisible()).toBe(false); // already hidden
  });

  it('hide() on already-hidden banner should be a no-op', () => {
    expect(() => ctrl.hide()).not.toThrow();
    expect(ctrl.isVisible()).toBe(false);
  });

  it('should allow show() after hide()', () => {
    ctrl.show('A', 'B');
    ctrl.hide();
    ctrl.show('X', 'Y');
    expect(ctrl.isVisible()).toBe(true);
    expect(ctrl.getAgents()).toEqual({ agentA: 'X', agentB: 'Y' });
  });
});

describe('TradeBannerController — XSS sanitization', () => {
  let ctrl: TradeBannerController;

  beforeEach(() => {
    ctrl = new TradeBannerController(3200);
  });

  it('should escape < and > characters', () => {
    ctrl.show('<script>alert(1)</script>', 'Safe');
    const { agentA } = ctrl.getAgents();
    expect(agentA).not.toContain('<script>');
    expect(agentA).toContain('&lt;');
    expect(agentA).toContain('&gt;');
  });

  it('should escape double quotes', () => {
    ctrl.show('"injection"', 'B');
    expect(ctrl.getAgents().agentA).toContain('&quot;');
  });

  it('should escape single quotes', () => {
    ctrl.show("it's a trap", 'B');
    expect(ctrl.getAgents().agentA).toContain('&#x27;');
  });

  it('should truncate names longer than 40 chars', () => {
    const longName = 'A'.repeat(50);
    ctrl.show(longName, 'B');
    expect(ctrl.getAgents().agentA.length).toBeLessThanOrEqual(40);
  });

  it('should trim whitespace from names', () => {
    ctrl.show('  Alpha  ', '  Beta  ');
    expect(ctrl.getAgents().agentA).toBe('Alpha');
    expect(ctrl.getAgents().agentB).toBe('Beta');
  });

  it('should replace empty/null agentA with "Unknown"', () => {
    ctrl.show('', 'B');
    expect(ctrl.getAgents().agentA).toBe('Unknown');
  });

  it('should handle undefined-like input gracefully', () => {
    ctrl.show(null as unknown as string, 'B');
    expect(ctrl.getAgents().agentA).toBe('Unknown');
  });

  it('should allow normal Unicode names', () => {
    ctrl.show('Ñoño🤖', 'BéBop');
    expect(ctrl.getAgents().agentA).toBe('Ñoño🤖');
    expect(ctrl.getAgents().agentB).toBe('BéBop');
  });
});

describe('TradeBannerController — edge cases', () => {
  let ctrl: TradeBannerController;

  beforeEach(() => {
    vi.useFakeTimers();
    ctrl = new TradeBannerController(3200);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle very rapid successive show() calls', () => {
    for (let i = 0; i < 10; i++) {
      ctrl.show(`AgentA-${i}`, `AgentB-${i}`);
    }
    expect(ctrl.isVisible()).toBe(true);
    const agents = ctrl.getAgents();
    expect(agents.agentA).toBe('AgentA-9'); // last call wins
  });

  it('should work with a custom short displayMs', () => {
    const quick = new TradeBannerController(500);
    quick.show('A', 'B');
    expect(quick.isVisible()).toBe(true);
    vi.advanceTimersByTime(500);
    expect(quick.isVisible()).toBe(false);
  });

  it('should format display text with ↔ separator', () => {
    ctrl.show('A', 'B');
    expect(ctrl.getDisplayText()).toContain('↔');
  });

  it('should not expose state mutation through getAgents()', () => {
    ctrl.show('Alice', 'Bob');
    const agents = ctrl.getAgents();
    agents.agentA = 'MUTATED';
    // Internal state should be unchanged
    expect(ctrl.getAgents().agentA).toBe('Alice');
  });
});
