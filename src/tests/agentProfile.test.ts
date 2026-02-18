/**
 * agentProfile.test.ts — T-363: Agent Mini-Profile Popover
 *
 * 30 tests covering:
 *   ─ agentProfileService pure helpers
 *       numberToHexColor, truncateMessage, pickRecentMessages, deriveAgentMood
 *       cache management (size, validity, invalidation, clearance)
 *   ─ AgentProfilePopover pure helpers
 *       computePopoverPosition, escapeHtml, formatRelativeTime, buildPopoverHtml
 *   ─ Popover state machine
 *       createPopoverState, showState, hideState, isShowingAgent
 *   ─ Edge cases
 *       no badges, no messages, empty stats, very long names, XSS
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── agentProfileService helpers ───────────────────────────────────────────────
import {
  PROFILE_CACHE_TTL_MS,
  MAX_RECENT_MESSAGES,
  MAX_BADGES,
  DEFAULT_AVATAR_COLOR,
  getProfileCacheSize,
  isProfileCacheValid,
  invalidateProfileCache,
  clearProfileCache,
  setProfileCacheEntry,
  numberToHexColor,
  truncateMessage,
  pickRecentMessages,
  deriveAgentMood,
  type RecentMessage,
  type AgentMiniProfile,
} from '../services/agentProfileService.js';

// ── AgentProfilePopover pure helpers ─────────────────────────────────────────
import {
  POPOVER_WIDTH,
  POPOVER_HEIGHT,
  RARITY_COLORS,
  computePopoverPosition,
  escapeHtml,
  formatRelativeTime,
  buildPopoverHtml,
  createPopoverState,
  showState,
  hideState,
  isShowingAgent,
  type PopoverData,
  type PopoverPosition,
} from '../../client/src/ui/AgentProfilePopover.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const NOW_MS = 1_700_000_000_000; // fixed epoch

function makeProfile(overrides: Partial<AgentMiniProfile> = {}): AgentMiniProfile {
  return {
    agentId:        'agent-1',
    name:           'TestBot',
    avatarColor:    '#ff6b6b',
    badges:         [],
    mood:           'happy',
    moodEmoji:      '😊',
    recentMessages: [],
    stats:          { messageCount: 0, tradeCount: 0, roomCount: 0 },
    cachedAt:       NOW_MS,
    ...overrides,
  };
}

function makePopoverData(overrides: Partial<PopoverData> = {}): PopoverData {
  return {
    agentId:        'agent-1',
    name:           'TestBot',
    avatarColor:    '#4ecdc4',
    badges:         [],
    moodEmoji:      '😊',
    recentMessages: [],
    stats:          { messageCount: 5, tradeCount: 2, roomCount: 3 },
    ...overrides,
  };
}

function makeMessage(text: string, minsAgo = 1): RecentMessage {
  return {
    id:     `msg-${Math.random()}`,
    text,
    sentAt: new Date(NOW_MS - minsAgo * 60_000),
  };
}

// ─── 1. numberToHexColor ──────────────────────────────────────────────────────

describe('numberToHexColor', () => {
  it('converts a standard 24-bit color to lowercase hex', () => {
    expect(numberToHexColor(0xff6b6b)).toBe('#ff6b6b');
  });

  it('pads short values to 6 digits', () => {
    expect(numberToHexColor(0x000001)).toBe('#000001');
  });

  it('handles black (0x000000)', () => {
    expect(numberToHexColor(0x000000)).toBe('#000000');
  });

  it('returns DEFAULT_AVATAR_COLOR for null', () => {
    expect(numberToHexColor(null)).toBe(DEFAULT_AVATAR_COLOR);
  });

  it('returns DEFAULT_AVATAR_COLOR for undefined', () => {
    expect(numberToHexColor(undefined)).toBe(DEFAULT_AVATAR_COLOR);
  });

  it('returns DEFAULT_AVATAR_COLOR for negative values', () => {
    expect(numberToHexColor(-1)).toBe(DEFAULT_AVATAR_COLOR);
  });

  it('returns DEFAULT_AVATAR_COLOR for NaN', () => {
    expect(numberToHexColor(NaN)).toBe(DEFAULT_AVATAR_COLOR);
  });
});

// ─── 2. truncateMessage ───────────────────────────────────────────────────────

describe('truncateMessage', () => {
  it('does not truncate short messages', () => {
    expect(truncateMessage('Hello!')).toBe('Hello!');
  });

  it('does not truncate message at exactly maxLen', () => {
    const msg = 'A'.repeat(80);
    expect(truncateMessage(msg)).toBe(msg);
  });

  it('truncates messages longer than maxLen', () => {
    const msg = 'A'.repeat(90);
    const result = truncateMessage(msg);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(81); // 80 + '…'
  });

  it('truncates with a custom maxLen', () => {
    const result = truncateMessage('Hello World!', 5);
    expect(result).toBe('Hello…');
  });

  it('handles empty string', () => {
    expect(truncateMessage('')).toBe('');
  });
});

// ─── 3. pickRecentMessages ───────────────────────────────────────────────────

describe('pickRecentMessages', () => {
  it('returns empty array for no messages', () => {
    expect(pickRecentMessages([])).toEqual([]);
  });

  it('returns all messages when fewer than limit', () => {
    const msgs = [makeMessage('a'), makeMessage('b')];
    expect(pickRecentMessages(msgs)).toHaveLength(2);
  });

  it('returns only MAX_RECENT_MESSAGES when more are provided', () => {
    const msgs = [1, 2, 3, 4, 5].map((i) => makeMessage(`msg ${i}`, i));
    expect(pickRecentMessages(msgs)).toHaveLength(MAX_RECENT_MESSAGES);
  });

  it('returns messages sorted newest first', () => {
    const old   = makeMessage('old',   60);
    const fresh = makeMessage('fresh',  1);
    const mid   = makeMessage('mid',   30);
    const result = pickRecentMessages([old, fresh, mid]);
    expect(result[0].text).toBe('fresh');
    expect(result[1].text).toBe('mid');
    expect(result[2].text).toBe('old');
  });

  it('does not mutate the original array', () => {
    const msgs = [makeMessage('a', 10), makeMessage('b', 5)];
    const original = [...msgs];
    pickRecentMessages(msgs);
    expect(msgs[0].text).toBe(original[0].text);
    expect(msgs[1].text).toBe(original[1].text);
  });
});

// ─── 4. deriveAgentMood ──────────────────────────────────────────────────────

describe('deriveAgentMood', () => {
  it('chat activity → chatting + 💬', () => {
    const { mood, moodEmoji } = deriveAgentMood('chat', undefined, NOW_MS);
    expect(mood).toBe('chatting');
    expect(moodEmoji).toBe('💬');
  });

  it('trade activity → trading + 🤝', () => {
    const { mood, moodEmoji } = deriveAgentMood('trade', undefined, NOW_MS);
    expect(mood).toBe('trading');
    expect(moodEmoji).toBe('🤝');
  });

  it('achievement activity → excited + 🤩', () => {
    const { mood, moodEmoji } = deriveAgentMood('achievement', undefined, NOW_MS);
    expect(mood).toBe('excited');
    expect(moodEmoji).toBe('🤩');
  });

  it('default activity → happy + 😊', () => {
    const { mood, moodEmoji } = deriveAgentMood('default', undefined, NOW_MS);
    expect(mood).toBe('happy');
    expect(moodEmoji).toBe('😊');
  });

  it('idle <30 s → happy', () => {
    const { mood } = deriveAgentMood('idle', NOW_MS - 20_000, NOW_MS);
    expect(mood).toBe('happy');
  });

  it('idle ≥30 s → bored', () => {
    const { mood } = deriveAgentMood('idle', NOW_MS - 30_000, NOW_MS);
    expect(mood).toBe('bored');
  });

  it('idle ≥60 s → tired', () => {
    const { mood } = deriveAgentMood('idle', NOW_MS - 60_000, NOW_MS);
    expect(mood).toBe('tired');
  });
});

// ─── 5. Profile cache helpers ─────────────────────────────────────────────────

describe('agentProfileService cache', () => {
  beforeEach(() => clearProfileCache());

  it('cache starts empty', () => {
    expect(getProfileCacheSize()).toBe(0);
  });

  it('setProfileCacheEntry increases cache size', () => {
    setProfileCacheEntry(makeProfile());
    expect(getProfileCacheSize()).toBe(1);
  });

  it('isProfileCacheValid returns false for missing entry', () => {
    expect(isProfileCacheValid('nonexistent', NOW_MS)).toBe(false);
  });

  it('isProfileCacheValid returns true for fresh entry', () => {
    setProfileCacheEntry(makeProfile({ cachedAt: NOW_MS }));
    expect(isProfileCacheValid('agent-1', NOW_MS)).toBe(true);
  });

  it('isProfileCacheValid returns false for expired entry', () => {
    const expiredAt = NOW_MS - PROFILE_CACHE_TTL_MS - 1;
    setProfileCacheEntry(makeProfile({ cachedAt: expiredAt }));
    expect(isProfileCacheValid('agent-1', NOW_MS)).toBe(false);
  });

  it('invalidateProfileCache removes one entry', () => {
    setProfileCacheEntry(makeProfile({ agentId: 'a1' }));
    setProfileCacheEntry(makeProfile({ agentId: 'a2' }));
    invalidateProfileCache('a1');
    expect(getProfileCacheSize()).toBe(1);
    expect(isProfileCacheValid('a1', NOW_MS)).toBe(false);
  });

  it('clearProfileCache removes all entries', () => {
    setProfileCacheEntry(makeProfile({ agentId: 'x1' }));
    setProfileCacheEntry(makeProfile({ agentId: 'x2' }));
    clearProfileCache();
    expect(getProfileCacheSize()).toBe(0);
  });

  it('PROFILE_CACHE_TTL_MS is 20 000', () => {
    expect(PROFILE_CACHE_TTL_MS).toBe(20_000);
  });

  it('MAX_BADGES is 3', () => {
    expect(MAX_BADGES).toBe(3);
  });

  it('MAX_RECENT_MESSAGES is 3', () => {
    expect(MAX_RECENT_MESSAGES).toBe(3);
  });
});

// ─── 6. computePopoverPosition ───────────────────────────────────────────────

describe('computePopoverPosition', () => {
  const VW = 1024;
  const VH = 768;

  it('positions above-right of anchor by default', () => {
    const pos = computePopoverPosition(400, 400, VW, VH);
    expect(pos.left).toBeGreaterThan(400); // to the right
    expect(pos.top).toBeLessThan(400);     // above
  });

  it('flips horizontally near the right edge', () => {
    const pos = computePopoverPosition(VW - 10, 400, VW, VH);
    expect(pos.left).toBeLessThan(VW - 10); // flipped left
  });

  it('flips vertically near the top edge', () => {
    const pos = computePopoverPosition(400, 5, VW, VH);
    expect(pos.top).toBeGreaterThan(0); // flipped below
  });

  it('always clamps left ≥ 4', () => {
    const pos = computePopoverPosition(0, 400, VW, VH);
    expect(pos.left).toBeGreaterThanOrEqual(4);
  });

  it('always clamps top ≥ 4', () => {
    const pos = computePopoverPosition(400, 0, VW, VH);
    expect(pos.top).toBeGreaterThanOrEqual(4);
  });

  it('popover stays within viewport width', () => {
    const pos = computePopoverPosition(400, 400, VW, VH);
    expect(pos.left + POPOVER_WIDTH).toBeLessThanOrEqual(VW);
  });

  it('popover stays within viewport height', () => {
    const pos = computePopoverPosition(400, 400, VW, VH);
    expect(pos.top + POPOVER_HEIGHT).toBeLessThanOrEqual(VH);
  });
});

// ─── 7. escapeHtml ───────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hi"')).toBe('&quot;hi&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

// ─── 8. formatRelativeTime ───────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  const ref = new Date(NOW_MS);

  it('returns "just now" for < 1 minute ago', () => {
    expect(formatRelativeTime(new Date(NOW_MS - 30_000), ref)).toBe('just now');
  });

  it('returns minutes ago for 1–59 min', () => {
    expect(formatRelativeTime(new Date(NOW_MS - 5 * 60_000), ref)).toBe('5 min ago');
  });

  it('returns hours ago for 1–23 h', () => {
    expect(formatRelativeTime(new Date(NOW_MS - 3 * 3600_000), ref)).toBe('3 h ago');
  });

  it('returns days ago for ≥ 24 h', () => {
    expect(formatRelativeTime(new Date(NOW_MS - 2 * 86_400_000), ref)).toBe('2 d ago');
  });
});

// ─── 9. buildPopoverHtml ─────────────────────────────────────────────────────

describe('buildPopoverHtml', () => {
  it('includes agent name', () => {
    const html = buildPopoverHtml(makePopoverData({ name: 'Alice' }));
    expect(html).toContain('Alice');
  });

  it('includes mood emoji', () => {
    const html = buildPopoverHtml(makePopoverData({ moodEmoji: '🤩' }));
    expect(html).toContain('🤩');
  });

  it('includes avatar color as inline style', () => {
    const html = buildPopoverHtml(makePopoverData({ avatarColor: '#abc123' }));
    expect(html).toContain('#abc123');
  });

  it('shows "No badges yet" when badge list is empty', () => {
    const html = buildPopoverHtml(makePopoverData({ badges: [] }));
    expect(html).toContain('No badges yet');
  });

  it('renders up to 3 badges', () => {
    const badges = [
      { id: 1, name: 'A', icon: '⭐', rarity: 'common' as const, description: 'd1' },
      { id: 2, name: 'B', icon: '🏆', rarity: 'rare'   as const, description: 'd2' },
      { id: 3, name: 'C', icon: '🎖️', rarity: 'epic'   as const, description: 'd3' },
    ];
    const html = buildPopoverHtml(makePopoverData({ badges }));
    expect(html).toContain('⭐');
    expect(html).toContain('🏆');
    expect(html).toContain('🎖️');
  });

  it('shows "No messages yet" when recentMessages is empty', () => {
    const html = buildPopoverHtml(makePopoverData({ recentMessages: [] }));
    expect(html).toContain('No messages yet');
  });

  it('renders up to 3 recent messages', () => {
    const msgs: PopoverData['recentMessages'] = [
      { id: '1', text: 'Hello!',  sentAt: new Date(NOW_MS - 60_000) },
      { id: '2', text: 'World!',  sentAt: new Date(NOW_MS - 120_000) },
      { id: '3', text: 'Bye!',    sentAt: new Date(NOW_MS - 180_000) },
    ];
    const html = buildPopoverHtml(makePopoverData({ recentMessages: msgs }));
    expect(html).toContain('Hello!');
    expect(html).toContain('World!');
    expect(html).toContain('Bye!');
  });

  it('renders stats with correct values', () => {
    const html = buildPopoverHtml(
      makePopoverData({ stats: { messageCount: 42, tradeCount: 7, roomCount: 15 } })
    );
    expect(html).toContain('42');
    expect(html).toContain('7');
    expect(html).toContain('15');
  });

  it('XSS: escapes agent name containing HTML', () => {
    const html = buildPopoverHtml(makePopoverData({ name: '<script>alert(1)</script>' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('XSS: escapes message text containing HTML', () => {
    const msgs: PopoverData['recentMessages'] = [
      { id: '1', text: '<img src=x onerror=alert(1)>', sentAt: new Date(NOW_MS - 1000) },
    ];
    const html = buildPopoverHtml(makePopoverData({ recentMessages: msgs }));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('rarity colors are applied to badges', () => {
    const badges = [
      { id: 1, name: 'Legendary Badge', icon: '👑', rarity: 'legendary' as const, description: 'desc' },
    ];
    const html = buildPopoverHtml(makePopoverData({ badges }));
    expect(html).toContain(RARITY_COLORS.legendary);
  });
});

// ─── 10. Popover state machine ────────────────────────────────────────────────

describe('Popover state machine', () => {
  const pos: PopoverPosition = { left: 100, top: 200 };
  const data = makePopoverData();

  it('createPopoverState is hidden with null agentId', () => {
    const s = createPopoverState();
    expect(s.visible).toBe(false);
    expect(s.agentId).toBeNull();
  });

  it('showState transitions to visible', () => {
    const s = showState(createPopoverState(), 'agent-1', data, pos);
    expect(s.visible).toBe(true);
    expect(s.agentId).toBe('agent-1');
  });

  it('showState stores position', () => {
    const s = showState(createPopoverState(), 'agent-1', data, pos);
    if (s.visible) {
      expect(s.position.left).toBe(100);
      expect(s.position.top).toBe(200);
    }
  });

  it('showState stores data', () => {
    const s = showState(createPopoverState(), 'agent-1', data, pos);
    if (s.visible) {
      expect(s.data.name).toBe(data.name);
    }
  });

  it('hideState transitions to hidden', () => {
    const shown = showState(createPopoverState(), 'agent-1', data, pos);
    const s = hideState(shown);
    expect(s.visible).toBe(false);
    expect(s.agentId).toBeNull();
  });

  it('original state is not mutated by showState', () => {
    const initial = createPopoverState();
    showState(initial, 'agent-1', data, pos);
    expect(initial.visible).toBe(false);
  });

  it('original state is not mutated by hideState', () => {
    const shown = showState(createPopoverState(), 'agent-1', data, pos);
    hideState(shown);
    expect(shown.visible).toBe(true);
  });

  it('isShowingAgent returns true for current agentId', () => {
    const s = showState(createPopoverState(), 'agent-1', data, pos);
    expect(isShowingAgent(s, 'agent-1')).toBe(true);
  });

  it('isShowingAgent returns false for different agentId', () => {
    const s = showState(createPopoverState(), 'agent-1', data, pos);
    expect(isShowingAgent(s, 'agent-2')).toBe(false);
  });

  it('isShowingAgent returns false when hidden', () => {
    const s = createPopoverState();
    expect(isShowingAgent(s, 'agent-1')).toBe(false);
  });

  it('showState on same agent updates data', () => {
    const s1 = showState(createPopoverState(), 'agent-1', data, pos);
    const newData = makePopoverData({ name: 'Updated' });
    const s2 = showState(s1, 'agent-1', newData, pos);
    if (s2.visible) {
      expect(s2.data.name).toBe('Updated');
    }
  });
});
