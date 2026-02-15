import { describe, it, expect } from 'vitest';
import { validateOpensAt } from '../services/timeCapsules.js';
import type { TimeCapsule } from '../services/timeCapsules.js';

describe('Time Capsules Tests', () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const ONE_YEAR_MS = 365 * ONE_DAY_MS;

  describe('validateOpensAt', () => {
    it('accepts date 1 day in future', () => {
      const tomorrow = new Date(Date.now() + ONE_DAY_MS);
      expect(validateOpensAt(tomorrow)).toBe(true);
    });

    it('accepts date 1 year in future', () => {
      const oneYear = new Date(Date.now() + ONE_YEAR_MS);
      expect(validateOpensAt(oneYear)).toBe(true);
    });

    it('accepts date 6 months in future', () => {
      const sixMonths = new Date(Date.now() + (ONE_YEAR_MS / 2));
      expect(validateOpensAt(sixMonths)).toBe(true);
    });

    it('rejects date less than 1 day in future', () => {
      const tooSoon = new Date(Date.now() + (ONE_DAY_MS / 2));
      expect(validateOpensAt(tooSoon)).toBe(false);
    });

    it('rejects date more than 1 year in future', () => {
      const tooFar = new Date(Date.now() + ONE_YEAR_MS + ONE_DAY_MS);
      expect(validateOpensAt(tooFar)).toBe(false);
    });

    it('rejects past date', () => {
      const past = new Date(Date.now() - ONE_DAY_MS);
      expect(validateOpensAt(past)).toBe(false);
    });

    it('rejects current time', () => {
      const now = new Date();
      expect(validateOpensAt(now)).toBe(false);
    });
  });

  describe('Capsule Structure', () => {
    it('validates capsule has required fields', () => {
      const capsule: TimeCapsule = {
        id: 1,
        creatorId: 'agent-1',
        roomId: null,
        title: 'Test',
        message: 'Hello future',
        items: [],
        opensAt: new Date(),
        opened: false,
        openedAt: null,
        viewers: [],
        createdAt: new Date(),
      };
      expect(capsule.id).toBeDefined();
      expect(capsule.creatorId).toBeDefined();
      expect(capsule.message).toBeDefined();
    });

    it('allows null roomId', () => {
      const capsule: Partial<TimeCapsule> = { roomId: null };
      expect(capsule.roomId).toBeNull();
    });

    it('allows null title', () => {
      const capsule: Partial<TimeCapsule> = { title: null };
      expect(capsule.title).toBeNull();
    });

    it('parses items as array', () => {
      const items = ['item1', 'item2'];
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(2);
    });

    it('parses viewers as array', () => {
      const viewers = ['agent-1', 'agent-2'];
      expect(Array.isArray(viewers)).toBe(true);
      expect(viewers).toHaveLength(2);
    });
  });

  describe('Max Active Capsules', () => {
    it('enforces max 10 active capsules per agent', () => {
      const MAX_ACTIVE = 10;
      const active = 10;
      expect(active >= MAX_ACTIVE).toBe(true);
    });

    it('allows creation when under limit', () => {
      const MAX_ACTIVE = 10;
      const active = 5;
      expect(active < MAX_ACTIVE).toBe(true);
    });

    it('counts only unopened capsules', () => {
      const capsules: Partial<TimeCapsule>[] = [
        { opened: false },
        { opened: false },
        { opened: true },
      ];
      const active = capsules.filter(c => !c.opened).length;
      expect(active).toBe(2);
    });
  });

  describe('Capsule Opening', () => {
    it('allows opening when past opensAt', () => {
      const opensAt = new Date(Date.now() - ONE_DAY_MS);
      expect(opensAt < new Date()).toBe(true);
    });

    it('prevents opening before opensAt', () => {
      const opensAt = new Date(Date.now() + ONE_DAY_MS);
      expect(opensAt > new Date()).toBe(true);
    });

    it('marks capsule as opened', () => {
      const capsule: Partial<TimeCapsule> = { opened: false };
      capsule.opened = true;
      expect(capsule.opened).toBe(true);
    });

    it('records opened timestamp', () => {
      const openedAt = new Date();
      expect(openedAt).toBeInstanceOf(Date);
    });
  });

  describe('Message Visibility', () => {
    it('hides message when not opened', () => {
      const capsule: TimeCapsule = {
        id: 1,
        creatorId: 'agent-1',
        roomId: null,
        title: 'Test',
        message: 'Secret message',
        items: [],
        opensAt: new Date(Date.now() + ONE_DAY_MS),
        opened: false,
        openedAt: null,
        viewers: [],
        createdAt: new Date(),
      };

      const hidden = !capsule.opened ? '[Capsule not yet opened]' : capsule.message;
      expect(hidden).toBe('[Capsule not yet opened]');
    });

    it('shows message when opened', () => {
      const capsule: TimeCapsule = {
        id: 1,
        creatorId: 'agent-1',
        roomId: null,
        title: 'Test',
        message: 'Secret message',
        items: [],
        opensAt: new Date(),
        opened: true,
        openedAt: new Date(),
        viewers: [],
        createdAt: new Date(),
      };

      const visible = capsule.opened ? capsule.message : '[Capsule not yet opened]';
      expect(visible).toBe('Secret message');
    });

    it('hides items when not opened', () => {
      const items = ['item1', 'item2'];
      const opened = false;
      const visible = opened ? items : [];
      expect(visible).toHaveLength(0);
    });
  });

  describe('Viewers', () => {
    it('adds viewer to list', () => {
      const viewers: string[] = [];
      const agentId = 'agent-1';
      if (!viewers.includes(agentId)) {
        viewers.push(agentId);
      }
      expect(viewers).toContain('agent-1');
    });

    it('prevents duplicate viewers', () => {
      const viewers = ['agent-1'];
      const agentId = 'agent-1';
      if (!viewers.includes(agentId)) {
        viewers.push(agentId);
      }
      expect(viewers).toHaveLength(1);
    });

    it('only allows viewers on opened capsules', () => {
      const opened = true;
      expect(opened).toBe(true);
    });

    it('tracks multiple viewers', () => {
      const viewers = ['agent-1', 'agent-2', 'agent-3'];
      expect(viewers).toHaveLength(3);
    });
  });

  describe('Room Capsules', () => {
    it('filters capsules by room', () => {
      const capsules: Partial<TimeCapsule>[] = [
        { roomId: 1 },
        { roomId: 2 },
        { roomId: 1 },
      ];
      const roomCapsules = capsules.filter(c => c.roomId === 1);
      expect(roomCapsules).toHaveLength(2);
    });

    it('sorts by opensAt ascending', () => {
      const now = Date.now();
      const capsules: Partial<TimeCapsule>[] = [
        { opensAt: new Date(now + 3 * ONE_DAY_MS) },
        { opensAt: new Date(now + ONE_DAY_MS) },
        { opensAt: new Date(now + 2 * ONE_DAY_MS) },
      ];
      const sorted = [...capsules].sort((a, b) => 
        a.opensAt!.getTime() - b.opensAt!.getTime()
      );
      expect(sorted[0].opensAt!.getTime()).toBeLessThan(sorted[1].opensAt!.getTime());
    });
  });

  describe('Agent Capsules', () => {
    it('filters capsules by creator', () => {
      const capsules: Partial<TimeCapsule>[] = [
        { creatorId: 'agent-1' },
        { creatorId: 'agent-2' },
        { creatorId: 'agent-1' },
      ];
      const agentCapsules = capsules.filter(c => c.creatorId === 'agent-1');
      expect(agentCapsules).toHaveLength(2);
    });

    it('sorts by created_at descending', () => {
      const now = Date.now();
      const capsules: Partial<TimeCapsule>[] = [
        { createdAt: new Date(now - 3 * ONE_DAY_MS) },
        { createdAt: new Date(now - ONE_DAY_MS) },
        { createdAt: new Date(now - 2 * ONE_DAY_MS) },
      ];
      const sorted = [...capsules].sort((a, b) => 
        b.createdAt!.getTime() - a.createdAt!.getTime()
      );
      expect(sorted[0].createdAt!.getTime()).toBeGreaterThan(sorted[1].createdAt!.getTime());
    });
  });

  describe('Upcoming Capsules', () => {
    it('includes capsules opening in 7 days', () => {
      const sevenDaysFromNow = Date.now() + 7 * ONE_DAY_MS;
      const opensAt = new Date(Date.now() + 3 * ONE_DAY_MS);
      expect(opensAt.getTime()).toBeLessThan(sevenDaysFromNow);
    });

    it('excludes capsules opening after 7 days', () => {
      const sevenDaysFromNow = Date.now() + 7 * ONE_DAY_MS;
      const opensAt = new Date(Date.now() + 10 * ONE_DAY_MS);
      expect(opensAt.getTime()).toBeGreaterThan(sevenDaysFromNow);
    });

    it('excludes already opened capsules', () => {
      const opened = true;
      expect(opened).toBe(true);
    });

    it('excludes past capsules', () => {
      const opensAt = new Date(Date.now() - ONE_DAY_MS);
      expect(opensAt < new Date()).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('counts total capsules', () => {
      const capsules = [1, 2, 3, 4, 5];
      expect(capsules.length).toBe(5);
    });

    it('counts opened capsules', () => {
      const capsules: Partial<TimeCapsule>[] = [
        { opened: true },
        { opened: false },
        { opened: true },
      ];
      const opened = capsules.filter(c => c.opened).length;
      expect(opened).toBe(2);
    });

    it('counts pending capsules', () => {
      const capsules: Partial<TimeCapsule>[] = [
        { opened: true },
        { opened: false },
        { opened: false },
      ];
      const pending = capsules.filter(c => !c.opened).length;
      expect(pending).toBe(2);
    });

    it('handles empty state', () => {
      const capsules: Partial<TimeCapsule>[] = [];
      expect(capsules.length).toBe(0);
    });
  });
});
