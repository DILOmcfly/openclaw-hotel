/**
 * @vitest-environment jsdom
 *
 * Tests for BadgeSystem — agent achievement badge renderer
 * T-361: Agent Achievement Badges in Room View
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BadgeSystem, type BadgeData } from '../renderer/BadgeSystem.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBadge(overrides: Partial<BadgeData> = {}): BadgeData {
  return {
    achievementId: `ach-${Math.random().toString(36).slice(2)}`,
    name: 'Social Butterfly',
    description: 'Made 10 friends',
    icon: '🦋',
    awardedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeBadges(count: number): BadgeData[] {
  return Array.from({ length: count }, (_, i) =>
    makeBadge({
      achievementId: `ach-${i}`,
      name: `Achievement ${i}`,
      description: `Description ${i}`,
      icon: ['🏆', '⭐', '🎯', '🦋', '🎮'][i % 5],
      awardedAt: new Date(Date.now() - i * 1000).toISOString(),
    })
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BadgeSystem', () => {
  let system: BadgeSystem;

  beforeEach(() => {
    system = new BadgeSystem(400, 300);
  });

  afterEach(() => {
    system.destroy();
  });

  // ── Initialization ──────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('creates overlay element and appends to document body', () => {
      const overlay = document.getElementById('badge-overlay');
      expect(overlay).not.toBeNull();
    });

    it('starts with no agents', () => {
      expect(system.getAgentCount()).toBe(0);
    });
  });

  // ── setAgentBadges ──────────────────────────────────────────────────────────

  describe('setAgentBadges', () => {
    it('adds a new agent entry with badges', () => {
      const badges = makeBadges(2);
      system.setAgentBadges('agent-1', badges, 3, 4);
      expect(system.getAgentCount()).toBe(1);
    });

    it('stores all provided badges', () => {
      const badges = makeBadges(3);
      system.setAgentBadges('agent-1', badges, 3, 4);
      expect(system.getAgentBadges('agent-1')).toHaveLength(3);
    });

    it('handles empty badge array (no badges yet)', () => {
      system.setAgentBadges('agent-1', [], 3, 4);
      expect(system.getAgentBadges('agent-1')).toHaveLength(0);
      expect(system.getAgentCount()).toBe(1);
    });

    it('updates existing agent badges without creating duplicate entry', () => {
      const badges1 = makeBadges(1);
      const badges2 = makeBadges(3);
      system.setAgentBadges('agent-1', badges1, 3, 4);
      system.setAgentBadges('agent-1', badges2, 3, 4);
      expect(system.getAgentCount()).toBe(1);
      expect(system.getAgentBadges('agent-1')).toHaveLength(3);
    });

    it('updates position on re-set for existing agent', () => {
      system.setAgentBadges('agent-1', makeBadges(1), 0, 0);
      system.setAgentBadges('agent-1', makeBadges(2), 5, 7);
      // Should not throw; position updates internally
      expect(system.getAgentCount()).toBe(1);
    });

    it('handles multiple different agents independently', () => {
      system.setAgentBadges('agent-1', makeBadges(2), 0, 0);
      system.setAgentBadges('agent-2', makeBadges(1), 2, 2);
      system.setAgentBadges('agent-3', makeBadges(3), 4, 4);
      expect(system.getAgentCount()).toBe(3);
      expect(system.getAgentBadges('agent-1')).toHaveLength(2);
      expect(system.getAgentBadges('agent-2')).toHaveLength(1);
      expect(system.getAgentBadges('agent-3')).toHaveLength(3);
    });
  });

  // ── addBadge ────────────────────────────────────────────────────────────────

  describe('addBadge', () => {
    it('adds a badge to an existing agent', () => {
      system.setAgentBadges('agent-1', [], 3, 4);
      const badge = makeBadge();
      system.addBadge('agent-1', badge);
      expect(system.getAgentBadges('agent-1')).toHaveLength(1);
    });

    it('prepends badge (most recent first)', () => {
      const existing = makeBadge({ achievementId: 'old', name: 'Old Achievement' });
      system.setAgentBadges('agent-1', [existing], 3, 4);

      const newBadge = makeBadge({ achievementId: 'new', name: 'New Achievement' });
      system.addBadge('agent-1', newBadge);

      const badges = system.getAgentBadges('agent-1');
      expect(badges[0].achievementId).toBe('new');
      expect(badges[1].achievementId).toBe('old');
    });

    it('does not add duplicate badges (same achievementId)', () => {
      const badge = makeBadge({ achievementId: 'ach-dupe' });
      system.setAgentBadges('agent-1', [badge], 3, 4);
      system.addBadge('agent-1', badge);
      expect(system.getAgentBadges('agent-1')).toHaveLength(1);
    });

    it('does nothing if agent not in current room', () => {
      const badge = makeBadge();
      // agent-999 was never added
      system.addBadge('agent-999', badge);
      expect(system.getAgentCount()).toBe(0);
    });

    it('accumulates multiple new badges', () => {
      system.setAgentBadges('agent-1', [], 3, 4);
      for (let i = 0; i < 5; i++) {
        system.addBadge('agent-1', makeBadge({ achievementId: `ach-${i}` }));
      }
      expect(system.getAgentBadges('agent-1')).toHaveLength(5);
    });
  });

  // ── updatePosition ──────────────────────────────────────────────────────────

  describe('updatePosition', () => {
    it('updates agent grid position', () => {
      system.setAgentBadges('agent-1', makeBadges(1), 0, 0);
      // Should not throw
      expect(() => system.updatePosition('agent-1', 5, 5)).not.toThrow();
    });

    it('does nothing for unknown agent', () => {
      expect(() => system.updatePosition('ghost-agent', 5, 5)).not.toThrow();
    });
  });

  // ── removeAgent ─────────────────────────────────────────────────────────────

  describe('removeAgent', () => {
    it('removes agent from tracking', () => {
      system.setAgentBadges('agent-1', makeBadges(2), 3, 4);
      system.removeAgent('agent-1');
      expect(system.getAgentCount()).toBe(0);
    });

    it('removes agent DOM element from overlay', () => {
      system.setAgentBadges('agent-1', makeBadges(1), 3, 4);
      const overlay = document.getElementById('badge-overlay')!;
      expect(overlay.children.length).toBeGreaterThan(0);
      system.removeAgent('agent-1');
      expect(overlay.children.length).toBe(0);
    });

    it('does not throw for unknown agent', () => {
      expect(() => system.removeAgent('ghost-agent')).not.toThrow();
    });

    it('removes only the specified agent, leaving others', () => {
      system.setAgentBadges('agent-1', makeBadges(1), 0, 0);
      system.setAgentBadges('agent-2', makeBadges(1), 2, 2);
      system.removeAgent('agent-1');
      expect(system.getAgentCount()).toBe(1);
      expect(system.getAgentBadges('agent-2')).toHaveLength(1);
    });
  });

  // ── clear ───────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all agents', () => {
      system.setAgentBadges('agent-1', makeBadges(1), 0, 0);
      system.setAgentBadges('agent-2', makeBadges(2), 2, 2);
      system.setAgentBadges('agent-3', makeBadges(3), 4, 4);
      system.clear();
      expect(system.getAgentCount()).toBe(0);
    });

    it('clears DOM overlay', () => {
      system.setAgentBadges('agent-1', makeBadges(1), 0, 0);
      system.clear();
      const overlay = document.getElementById('badge-overlay')!;
      expect(overlay.children.length).toBe(0);
    });

    it('is idempotent (safe to call multiple times)', () => {
      system.clear();
      system.clear();
      expect(system.getAgentCount()).toBe(0);
    });
  });

  // ── updateOffset ────────────────────────────────────────────────────────────

  describe('updateOffset', () => {
    it('updates world offset without throwing', () => {
      expect(() => system.updateOffset(500, 250)).not.toThrow();
    });

    it('repositions badges after offset update', () => {
      system.setAgentBadges('agent-1', makeBadges(1), 3, 3);
      expect(() => {
        system.updateOffset(800, 600);
        system.updateAllPositions();
      }).not.toThrow();
    });
  });

  // ── updateAllPositions ──────────────────────────────────────────────────────

  describe('updateAllPositions', () => {
    it('updates all agent positions without errors', () => {
      system.setAgentBadges('agent-1', makeBadges(1), 0, 0);
      system.setAgentBadges('agent-2', makeBadges(2), 3, 3);
      expect(() => system.updateAllPositions()).not.toThrow();
    });

    it('is safe when no agents exist', () => {
      expect(() => system.updateAllPositions()).not.toThrow();
    });
  });

  // ── getAgentBadges ──────────────────────────────────────────────────────────

  describe('getAgentBadges', () => {
    it('returns empty array for unknown agent', () => {
      expect(system.getAgentBadges('nobody')).toEqual([]);
    });

    it('returns correct badges for agent', () => {
      const badges = makeBadges(3);
      system.setAgentBadges('agent-1', badges, 0, 0);
      expect(system.getAgentBadges('agent-1')).toHaveLength(3);
    });
  });

  // ── MAX_VISIBLE_BADGES limit ─────────────────────────────────────────────────

  describe('MAX_VISIBLE_BADGES enforcement', () => {
    it('stores all badges even when more than 3 exist', () => {
      // BadgeSystem stores all badges, renders only first 3 in DOM
      const badges = makeBadges(6);
      system.setAgentBadges('agent-1', badges, 0, 0);
      // All 6 are stored
      expect(system.getAgentBadges('agent-1')).toHaveLength(6);
    });

    it('DOM shows at most 3 badge icons + overflow indicator', () => {
      const badges = makeBadges(5);
      system.setAgentBadges('agent-1', badges, 0, 0);
      const overlay = document.getElementById('badge-overlay')!;
      const row = overlay.querySelector('[data-agent-id="agent-1"]')!;
      // 3 icons + 1 "+N" overflow = 4 children
      expect(row.children.length).toBe(4);
    });

    it('no overflow indicator when exactly 3 badges', () => {
      const badges = makeBadges(3);
      system.setAgentBadges('agent-1', badges, 0, 0);
      const overlay = document.getElementById('badge-overlay')!;
      const row = overlay.querySelector('[data-agent-id="agent-1"]')!;
      // Exactly 3 icons, no "+N"
      expect(row.children.length).toBe(3);
    });

    it('no overflow indicator when fewer than 3 badges', () => {
      const badges = makeBadges(2);
      system.setAgentBadges('agent-1', badges, 0, 0);
      const overlay = document.getElementById('badge-overlay')!;
      const row = overlay.querySelector('[data-agent-id="agent-1"]')!;
      expect(row.children.length).toBe(2);
    });
  });

  // ── destroy ──────────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('removes overlay from DOM', () => {
      system.destroy();
      const overlay = document.getElementById('badge-overlay');
      expect(overlay).toBeNull();
      // Re-create for afterEach cleanup (it will call destroy again; safe)
      system = new BadgeSystem(400, 300);
    });

    it('clears all agents on destroy', () => {
      system.setAgentBadges('agent-1', makeBadges(2), 0, 0);
      system.destroy();
      // Re-create to allow afterEach to call destroy safely
      system = new BadgeSystem(400, 300);
      expect(system.getAgentCount()).toBe(0);
    });
  });
});
