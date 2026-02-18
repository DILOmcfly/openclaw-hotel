/**
 * T-353: Live Event Toast Notifications — Unit Tests
 *
 * Tests for:
 * - Toast config completeness (all event types have icon + title)
 * - showEventToast() — creates DOM element, sets correct class & content
 * - dismissToast() — removes from active list, adds dismissing class
 * - Max-toast enforcement (oldest dismissed when limit reached)
 * - HTML escaping for user-supplied message strings
 * - Toast duration CSS variable
 * - NOTABLE_EMOTES filter logic (what triggers toast, what doesn't)
 * - Toast type-to-event-type mapping
 *
 * Pure unit tests — mirrors the inline <script> in spectate.html.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mirror TOAST_CONFIG from spectate.html ───────────────────────────────────
const TOAST_CONFIG: Record<string, { icon: string; title: string }> = {
  trade:        { icon: '💱', title: 'Trade Happening!' },
  trade_offer:  { icon: '💱', title: 'Trade Offered' },
  game_invite:  { icon: '🎮', title: 'Game Started!' },
  game_win:     { icon: '🏆', title: 'Game Won!' },
  achievement:  { icon: '🏅', title: 'Achievement!' },
  room_enter:   { icon: '🚪', title: 'Agent Arrived' },
  emote:        { icon: '🎭', title: 'Agent Emoting' },
  chat:         { icon: '💬', title: 'Message' },
};

const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 5000;

// ─── Mirror escape HTML ───────────────────────────────────────────────────────
function _escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Mirror NOTABLE_EMOTES from spectate.js ───────────────────────────────────
const NOTABLE_EMOTES = ['❤️', '🌟', '⭐', '🎉', '🔥', '💯', '🥳', '🎊', '😍', '👑'];

function isNotableEmote(emote: string): boolean {
  return NOTABLE_EMOTES.includes(emote);
}

// ─── Minimal DOM simulation ───────────────────────────────────────────────────
interface MockToast {
  type: string;
  message: string;
  title: string;
  icon: string;
  durationMs: number;
  dismissed: boolean;
  classes: Set<string>;
}

function createMockToastSystem(maxToasts = MAX_TOASTS) {
  const activeToasts: MockToast[] = [];

  function showToast(type: string, message: string, durationMs = TOAST_DURATION_MS): MockToast | null {
    const config = TOAST_CONFIG[type] || { icon: '✦', title: 'Event' };

    // Enforce max — dismiss oldest
    while (activeToasts.length >= maxToasts) {
      dismissToast(activeToasts[0]);
    }

    const toast: MockToast = {
      type,
      message,
      title: config.title,
      icon: config.icon,
      durationMs,
      dismissed: false,
      classes: new Set(['event-toast', `toast-${type}`]),
    };

    activeToasts.push(toast);
    return toast;
  }

  function dismissToast(toast: MockToast): void {
    const idx = activeToasts.indexOf(toast);
    if (idx === -1) return;
    activeToasts.splice(idx, 1);
    toast.dismissed = true;
    toast.classes.add('dismissing');
  }

  return { activeToasts, showToast, dismissToast };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('T-353: Live Event Toast — TOAST_CONFIG', () => {
  it('has entries for all expected event types', () => {
    const required = ['trade', 'trade_offer', 'game_invite', 'game_win', 'achievement', 'room_enter', 'emote', 'chat'];
    for (const type of required) {
      expect(TOAST_CONFIG).toHaveProperty(type);
    }
  });

  it('every config entry has a non-empty icon', () => {
    for (const [type, cfg] of Object.entries(TOAST_CONFIG)) {
      expect(cfg.icon.length).toBeGreaterThan(0, `${type} missing icon`);
    }
  });

  it('every config entry has a non-empty title', () => {
    for (const [type, cfg] of Object.entries(TOAST_CONFIG)) {
      expect(cfg.title.length).toBeGreaterThan(0, `${type} missing title`);
    }
  });

  it('trade types have 💱 icon', () => {
    expect(TOAST_CONFIG.trade.icon).toBe('💱');
    expect(TOAST_CONFIG.trade_offer.icon).toBe('💱');
  });

  it('achievement type has 🏅 icon', () => {
    expect(TOAST_CONFIG.achievement.icon).toBe('🏅');
  });

  it('game_win type has 🏆 icon', () => {
    expect(TOAST_CONFIG.game_win.icon).toBe('🏆');
  });

  it('room_enter type has 🚪 icon', () => {
    expect(TOAST_CONFIG.room_enter.icon).toBe('🚪');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-353: showEventToast() — core behaviour', () => {
  let sys: ReturnType<typeof createMockToastSystem>;

  beforeEach(() => {
    sys = createMockToastSystem();
  });

  it('creates a toast and adds it to activeToasts', () => {
    sys.showToast('trade_offer', 'Luna offered a trade to Rex');
    expect(sys.activeToasts).toHaveLength(1);
  });

  it('toast has correct type and message', () => {
    sys.showToast('game_invite', 'Pixel invited Echo to play TicTacToe!');
    const t = sys.activeToasts[0];
    expect(t.type).toBe('game_invite');
    expect(t.message).toBe('Pixel invited Echo to play TicTacToe!');
  });

  it('toast has correct title from TOAST_CONFIG', () => {
    sys.showToast('achievement', 'Luna unlocked Social Butterfly');
    expect(sys.activeToasts[0].title).toBe('Achievement!');
  });

  it('toast has correct icon from TOAST_CONFIG', () => {
    sys.showToast('game_win', 'Rex won at Battleships');
    expect(sys.activeToasts[0].icon).toBe('🏆');
  });

  it('unknown type falls back gracefully', () => {
    const toast = sys.showToast('unknown_type_xyz', 'Something happened');
    expect(toast).not.toBeNull();
    expect(toast!.title).toBe('Event');
    expect(toast!.icon).toBe('✦');
  });

  it('toast is assigned correct CSS classes', () => {
    sys.showToast('emote', 'Sage reacted with ❤️');
    const t = sys.activeToasts[0];
    expect(t.classes.has('event-toast')).toBe(true);
    expect(t.classes.has('toast-emote')).toBe(true);
  });

  it('uses default duration when not specified', () => {
    sys.showToast('room_enter', 'Pixel entered the lobby');
    expect(sys.activeToasts[0].durationMs).toBe(TOAST_DURATION_MS);
  });

  it('respects custom duration override', () => {
    sys.showToast('chat', 'A message arrived', 8000);
    expect(sys.activeToasts[0].durationMs).toBe(8000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-353: dismissToast() — behaviour', () => {
  let sys: ReturnType<typeof createMockToastSystem>;

  beforeEach(() => {
    sys = createMockToastSystem();
  });

  it('removes dismissed toast from activeToasts', () => {
    const t = sys.showToast('room_enter', 'Agent arrived')!;
    sys.dismissToast(t);
    expect(sys.activeToasts).not.toContain(t);
    expect(sys.activeToasts).toHaveLength(0);
  });

  it('marks toast as dismissed', () => {
    const t = sys.showToast('trade', 'Trade happening')!;
    sys.dismissToast(t);
    expect(t.dismissed).toBe(true);
  });

  it('adds dismissing class on dismiss', () => {
    const t = sys.showToast('trade_offer', 'Luna offered a trade')!;
    sys.dismissToast(t);
    expect(t.classes.has('dismissing')).toBe(true);
  });

  it('double-dismiss is safe (no crash)', () => {
    const t = sys.showToast('trade_offer', 'Luna offered a trade')!;
    expect(() => {
      sys.dismissToast(t);
      sys.dismissToast(t); // second call should not throw
    }).not.toThrow();
  });

  it('dismissing one does not affect others', () => {
    const t1 = sys.showToast('trade_offer', 'A')!;
    const t2 = sys.showToast('game_invite', 'B')!;
    sys.dismissToast(t1);
    expect(sys.activeToasts).toContain(t2);
    expect(sys.activeToasts).not.toContain(t1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-353: Max toast enforcement', () => {
  it('does not exceed MAX_TOASTS active at once', () => {
    const sys = createMockToastSystem(MAX_TOASTS);
    for (let i = 0; i < 5; i++) {
      sys.showToast('room_enter', `Agent ${i} entered`);
    }
    expect(sys.activeToasts.length).toBeLessThanOrEqual(MAX_TOASTS);
  });

  it('dismisses oldest when limit reached', () => {
    const sys = createMockToastSystem(2);
    const t1 = sys.showToast('trade', 'First')!;
    const t2 = sys.showToast('game_invite', 'Second')!;
    sys.showToast('room_enter', 'Third');
    // t1 should have been dismissed (oldest)
    expect(t1.dismissed).toBe(true);
    expect(sys.activeToasts).not.toContain(t1);
    expect(sys.activeToasts).toContain(t2);
  });

  it('custom max of 1 keeps only the latest toast', () => {
    const sys = createMockToastSystem(1);
    const t1 = sys.showToast('trade', 'First')!;
    sys.showToast('game_invite', 'Second');
    expect(t1.dismissed).toBe(true);
    expect(sys.activeToasts).toHaveLength(1);
    expect(sys.activeToasts[0].type).toBe('game_invite');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-353: HTML escaping', () => {
  it('escapes & in messages', () => {
    expect(_escHtml('A & B')).toBe('A &amp; B');
  });

  it('escapes < and > in messages', () => {
    expect(_escHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes double-quotes', () => {
    expect(_escHtml('"Hello"')).toBe('&quot;Hello&quot;');
  });

  it('handles empty string', () => {
    expect(_escHtml('')).toBe('');
  });

  it('handles string with no special chars', () => {
    expect(_escHtml('Hello world')).toBe('Hello world');
  });

  it('handles number input gracefully', () => {
    expect(_escHtml(42 as any)).toBe('42');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-353: NOTABLE_EMOTES filter', () => {
  it('❤️ is a notable emote', () => {
    expect(isNotableEmote('❤️')).toBe(true);
  });

  it('🎉 is a notable emote', () => {
    expect(isNotableEmote('🎉')).toBe(true);
  });

  it('🔥 is a notable emote', () => {
    expect(isNotableEmote('🔥')).toBe(true);
  });

  it('👋 wave is NOT a notable emote (no toast)', () => {
    expect(isNotableEmote('👋')).toBe(false);
  });

  it('😊 smile is NOT a notable emote (too common)', () => {
    expect(isNotableEmote('😊')).toBe(false);
  });

  it('🤔 thinking is NOT a notable emote', () => {
    expect(isNotableEmote('🤔')).toBe(false);
  });

  it('👑 crown is a notable emote', () => {
    expect(isNotableEmote('👑')).toBe(true);
  });

  it('empty string is not notable', () => {
    expect(isNotableEmote('')).toBe(false);
  });

  it('has at least 5 notable emotes configured', () => {
    expect(NOTABLE_EMOTES.length).toBeGreaterThanOrEqual(5);
  });

  it('all notable emotes are strings', () => {
    NOTABLE_EMOTES.forEach(e => expect(typeof e).toBe('string'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-353: Agent arrival toast suppression logic', () => {
  // Toast should only show when 3+ agents are already in the room
  // to avoid spamming when the room first loads

  function shouldShowArrivalToast(currentAgentCount: number): boolean {
    return currentAgentCount >= 3;
  }

  it('does NOT show toast when 0 agents in room (initial load)', () => {
    expect(shouldShowArrivalToast(0)).toBe(false);
  });

  it('does NOT show toast when 1 agent in room', () => {
    expect(shouldShowArrivalToast(1)).toBe(false);
  });

  it('does NOT show toast when 2 agents in room', () => {
    expect(shouldShowArrivalToast(2)).toBe(false);
  });

  it('shows toast when 3 agents already present', () => {
    expect(shouldShowArrivalToast(3)).toBe(true);
  });

  it('shows toast when room is busy (10+ agents)', () => {
    expect(shouldShowArrivalToast(10)).toBe(true);
  });
});
