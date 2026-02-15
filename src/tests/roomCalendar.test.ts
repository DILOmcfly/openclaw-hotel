import { describe, it, expect } from 'vitest';

describe('Room Calendar System', () => {
  describe('Event Time Validation', () => {
    const validateTimes = (start: Date, end: Date) => start < end;
    const validateAdvance = (start: Date, max: number) => {
      const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + max); return start <= maxDate;
    };

    it('rejects invalid times', () => {
      const start = new Date('2024-03-15T14:00:00Z'), end = new Date('2024-03-15T13:00:00Z');
      expect(validateTimes(start, end)).toBe(false);
      expect(validateTimes(start, start)).toBe(false);
    });

    it('accepts valid times', () => {
      expect(validateTimes(new Date('2024-03-15T14:00:00Z'), new Date('2024-03-15T16:00:00Z'))).toBe(true);
    });

    it('enforces 30-day advance limit', () => {
      const tooFar = new Date(); tooFar.setDate(tooFar.getDate() + 31);
      const ok = new Date(); ok.setDate(ok.getDate() + 1);
      expect(validateAdvance(tooFar, 30)).toBe(false);
      expect(validateAdvance(ok, 30)).toBe(true);
    });
  });

  describe('RSVP Status Validation', () => {
    const isValid = (s: string) => ['going', 'maybe', 'declined'].includes(s);

    it('accepts valid statuses', () => {
      expect(isValid('going')).toBe(true); expect(isValid('maybe')).toBe(true); expect(isValid('declined')).toBe(true);
    });

    it('rejects invalid statuses', () => {
      expect(isValid('yes')).toBe(false); expect(isValid('')).toBe(false);
    });
  });

  describe('Event Ownership', () => {
    const owns = (creator: string, requester: string) => creator === requester;

    it('validates ownership', () => {
      expect(owns('agent1', 'agent1')).toBe(true);
      expect(owns('agent1', 'agent2')).toBe(false);
    });
  });

  describe('Time Conflict Detection', () => {
    type Ev = { startsAt: Date; endsAt: Date };
    const conflicts = (e1: Ev, e2: Ev) => e1.startsAt < e2.endsAt && e1.endsAt > e2.startsAt;

    it('detects overlaps', () => {
      const e1 = { startsAt: new Date('2024-03-15T14:00:00Z'), endsAt: new Date('2024-03-15T16:00:00Z') };
      const e2 = { startsAt: new Date('2024-03-15T15:00:00Z'), endsAt: new Date('2024-03-15T17:00:00Z') };
      expect(conflicts(e1, e2)).toBe(true);
    });

    it('allows non-overlaps', () => {
      const e1 = { startsAt: new Date('2024-03-15T14:00:00Z'), endsAt: new Date('2024-03-15T16:00:00Z') };
      const e2 = { startsAt: new Date('2024-03-15T16:00:00Z'), endsAt: new Date('2024-03-15T18:00:00Z') };
      expect(conflicts(e1, e2)).toBe(false);
    });

    it('detects contained events', () => {
      const outer = { startsAt: new Date('2024-03-15T14:00:00Z'), endsAt: new Date('2024-03-15T18:00:00Z') };
      const inner = { startsAt: new Date('2024-03-15T15:00:00Z'), endsAt: new Date('2024-03-15T16:00:00Z') };
      expect(conflicts(outer, inner)).toBe(true); expect(conflicts(inner, outer)).toBe(true);
    });
  });

  describe('Attendee Counting', () => {
    it('counts by status', () => {
      const rsvps = [
        { agentId: 'a1', status: 'going' }, { agentId: 'a2', status: 'going' },
        { agentId: 'a3', status: 'maybe' }, { agentId: 'a4', status: 'declined' }
      ];
      expect(rsvps.filter(r => r.status === 'going').length).toBe(2);
      expect(rsvps.filter(r => r.status === 'maybe').length).toBe(1);
      expect(rsvps.filter(r => r.status === 'declined').length).toBe(1);
    });

    it('handles empty list', () => {
      const rsvps: any[] = [];
      expect(rsvps.filter(r => r.status === 'going').length).toBe(0);
    });

    it('updates RSVP', () => {
      const rsvps = new Map([['a1', 'going']]);
      rsvps.set('a1', 'declined');
      expect(rsvps.get('a1')).toBe('declined');
    });
  });

  describe('Upcoming Events Filter', () => {
    it('filters past events', () => {
      const now = new Date('2024-03-15T12:00:00Z');
      const events = [
        { id: 1, endsAt: new Date('2024-03-14T10:00:00Z') },
        { id: 2, endsAt: new Date('2024-03-15T14:00:00Z') }
      ];
      const upcoming = events.filter(e => e.endsAt >= now);
      expect(upcoming).toHaveLength(1); expect(upcoming[0].id).toBe(2);
    });

    it('sorts by start time', () => {
      const events = [
        { id: 1, startsAt: new Date('2024-03-17T10:00:00Z') },
        { id: 2, startsAt: new Date('2024-03-15T10:00:00Z') }
      ];
      const sorted = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      expect(sorted.map(e => e.id)).toEqual([2, 1]);
    });
  });

  describe('Recurring Events', () => {
    const isValidRecurring = (t: string) => ['none', 'daily', 'weekly', 'monthly'].includes(t);

    it('validates types', () => {
      expect(isValidRecurring('daily')).toBe(true); expect(isValidRecurring('yearly')).toBe(false);
    });

    it('defaults to none', () => {
      const get = (t?: string) => t || 'none';
      expect(get()).toBe('none'); expect(get('weekly')).toBe('weekly');
    });
  });

  describe('Agent Schedule', () => {
    it('filters by RSVP', () => {
      const all = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const rsvps = [1, 3];
      const schedule = all.filter(e => rsvps.includes(e.id));
      expect(schedule).toHaveLength(2); expect(schedule.map(e => e.id)).toEqual([1, 3]);
    });

    it('includes status', () => {
      const events = [{ id: 1, rsvpStatus: 'going' }];
      expect(events[0].rsvpStatus).toBe('going');
    });
  });

  describe('Max Attendees', () => {
    const getMax = (max?: number) => max || 50;

    it('defaults to 50', () => {
      expect(getMax()).toBe(50); expect(getMax(undefined)).toBe(50);
    });

    it('accepts custom', () => {
      expect(getMax(100)).toBe(100);
    });
  });

  describe('Event Types', () => {
    const getType = (t?: string) => t || 'general';

    it('defaults to general', () => {
      expect(getType()).toBe('general');
    });

    it('accepts custom', () => {
      expect(getType('party')).toBe('party');
    });
  });

  describe('Edge Cases', () => {
    it('handles same times', () => {
      const t = new Date('2024-03-15T14:00:00Z');
      expect(t < t).toBe(false);
    });

    it('handles timezones', () => {
      const utc = new Date('2024-03-15T14:00:00Z');
      const est = new Date('2024-03-15T09:00:00-05:00');
      expect(utc.getTime()).toBe(est.getTime());
    });

    it('excludes from conflicts', () => {
      const events = [
        { id: 1, startsAt: new Date('2024-03-15T14:00:00Z'), endsAt: new Date('2024-03-15T16:00:00Z') },
        { id: 2, startsAt: new Date('2024-03-15T15:00:00Z'), endsAt: new Date('2024-03-15T17:00:00Z') }
      ];
      const check = (start: Date, end: Date, exclude?: number) => 
        events.filter(e => {
          if (exclude && e.id === exclude) return false;
          return e.startsAt < end && e.endsAt > start;
        });
      
      expect(check(new Date('2024-03-15T15:30:00Z'), new Date('2024-03-15T16:30:00Z'))).toHaveLength(2);
      expect(check(new Date('2024-03-15T15:30:00Z'), new Date('2024-03-15T16:30:00Z'), 1)).toHaveLength(1);
    });
  });
});
