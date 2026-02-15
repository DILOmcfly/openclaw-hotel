import { describe, it, expect } from 'vitest';

/**
 * Competitive Events System Unit Tests
 * These tests validate input and logic without requiring a database connection
 */

describe('Competitive Events - Validation', () => {
  it('should validate event type constraints', () => {
    const validEventTypes = ['rps_tournament', 'trivia', 'room_decoration_contest'];

    const validateEventType = (type: string): boolean => {
      return validEventTypes.includes(type);
    };

    expect(validateEventType('rps_tournament')).toBe(true);
    expect(validateEventType('trivia')).toBe(true);
    expect(validateEventType('room_decoration_contest')).toBe(true);
    expect(validateEventType('invalid_type')).toBe(false);
    expect(validateEventType('tournament')).toBe(false);
    expect(validateEventType('')).toBe(false);
  });

  it('should validate status transitions', () => {
    type EventStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

    const canTransition = (from: EventStatus, to: EventStatus): boolean => {
      const validTransitions: Record<EventStatus, EventStatus[]> = {
        scheduled: ['active', 'cancelled'],
        active: ['ended'],
        ended: [],
        cancelled: [],
      };

      return validTransitions[from]?.includes(to) ?? false;
    };

    // Valid transitions
    expect(canTransition('scheduled', 'active')).toBe(true);
    expect(canTransition('scheduled', 'cancelled')).toBe(true);
    expect(canTransition('active', 'ended')).toBe(true);

    // Invalid transitions
    expect(canTransition('scheduled', 'ended')).toBe(false);
    expect(canTransition('active', 'scheduled')).toBe(false);
    expect(canTransition('ended', 'active')).toBe(false);
    expect(canTransition('cancelled', 'active')).toBe(false);
    expect(canTransition('ended', 'cancelled')).toBe(false);
  });

  it('should validate event name length', () => {
    const validateEventName = (name: string): { valid: boolean; error?: string } => {
      if (name.length === 0) {
        return { valid: false, error: 'Event name cannot be empty' };
      }
      if (name.length > 100) {
        return { valid: false, error: 'Event name cannot exceed 100 characters' };
      }
      return { valid: true };
    };

    expect(validateEventName('RPS Championship')).toEqual({ valid: true });
    expect(validateEventName('a'.repeat(100))).toEqual({ valid: true });
    expect(validateEventName('')).toEqual({ valid: false, error: 'Event name cannot be empty' });
    expect(validateEventName('a'.repeat(101))).toEqual({
      valid: false,
      error: 'Event name cannot exceed 100 characters',
    });
  });

  it('should correctly sort leaderboard by score descending', () => {
    type LeaderboardEntry = {
      agentId: string;
      displayName: string;
      score: number;
    };

    const sortLeaderboard = (entries: LeaderboardEntry[]): LeaderboardEntry[] => {
      return [...entries].sort((a, b) => b.score - a.score);
    };

    const unsorted: LeaderboardEntry[] = [
      { agentId: '1', displayName: 'Alice', score: 50 },
      { agentId: '2', displayName: 'Bob', score: 100 },
      { agentId: '3', displayName: 'Charlie', score: 75 },
    ];

    const sorted = sortLeaderboard(unsorted);

    expect(sorted[0].displayName).toBe('Bob');
    expect(sorted[0].score).toBe(100);
    expect(sorted[1].displayName).toBe('Charlie');
    expect(sorted[1].score).toBe(75);
    expect(sorted[2].displayName).toBe('Alice');
    expect(sorted[2].score).toBe(50);
  });

  it('should assign ranks correctly based on scores', () => {
    type ParticipantWithScore = {
      agentId: string;
      score: number;
    };

    type ParticipantWithRank = ParticipantWithScore & {
      rank: number;
    };

    const assignRanks = (participants: ParticipantWithScore[]): ParticipantWithRank[] => {
      const sorted = [...participants].sort((a, b) => b.score - a.score);
      return sorted.map((p, index) => ({
        ...p,
        rank: index + 1,
      }));
    };

    const participants: ParticipantWithScore[] = [
      { agentId: '1', score: 50 },
      { agentId: '2', score: 100 },
      { agentId: '3', score: 75 },
    ];

    const ranked = assignRanks(participants);

    expect(ranked[0].agentId).toBe('2');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].agentId).toBe('3');
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].agentId).toBe('1');
    expect(ranked[2].rank).toBe(3);
  });

  it('should validate score is non-negative', () => {
    const validateScore = (score: number): boolean => {
      return Number.isInteger(score) && score >= 0;
    };

    expect(validateScore(0)).toBe(true);
    expect(validateScore(100)).toBe(true);
    expect(validateScore(-1)).toBe(false);
    expect(validateScore(-100)).toBe(false);
    expect(validateScore(1.5)).toBe(false);
  });

  it('should validate event start/end time constraints', () => {
    const validateEventTimes = (
      startTime: Date,
      endTime: Date | null
    ): { valid: boolean; error?: string } => {
      const now = new Date();

      if (startTime < now) {
        return { valid: false, error: 'Start time cannot be in the past' };
      }

      if (endTime && endTime <= startTime) {
        return { valid: false, error: 'End time must be after start time' };
      }

      return { valid: true };
    };

    const now = new Date();
    const future = new Date(Date.now() + 3600000); // +1 hour
    const farFuture = new Date(Date.now() + 7200000); // +2 hours
    const past = new Date(Date.now() - 3600000); // -1 hour

    expect(validateEventTimes(future, farFuture)).toEqual({ valid: true });
    expect(validateEventTimes(future, null)).toEqual({ valid: true });
    expect(validateEventTimes(past, farFuture)).toEqual({
      valid: false,
      error: 'Start time cannot be in the past',
    });
    expect(validateEventTimes(farFuture, future)).toEqual({
      valid: false,
      error: 'End time must be after start time',
    });
  });

  it('should handle tie-breaking in leaderboards', () => {
    type LeaderboardEntry = {
      agentId: string;
      score: number;
      joinedAt: Date;
    };

    const sortLeaderboardWithTieBreaker = (entries: LeaderboardEntry[]): LeaderboardEntry[] => {
      return [...entries].sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Tie-breaker: earlier join time wins
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      });
    };

    const now = new Date();
    const entries: LeaderboardEntry[] = [
      { agentId: '1', score: 100, joinedAt: new Date(now.getTime() + 1000) },
      { agentId: '2', score: 100, joinedAt: new Date(now.getTime()) },
      { agentId: '3', score: 90, joinedAt: new Date(now.getTime()) },
    ];

    const sorted = sortLeaderboardWithTieBreaker(entries);

    expect(sorted[0].agentId).toBe('2'); // Same score, joined first
    expect(sorted[1].agentId).toBe('1');
    expect(sorted[2].agentId).toBe('3');
  });

  it('should detect duplicate participant entries', () => {
    type Participant = {
      eventId: string;
      agentId: string;
    };

    const isDuplicateParticipant = (
      existing: Participant[],
      eventId: string,
      agentId: string
    ): boolean => {
      return existing.some((p) => p.eventId === eventId && p.agentId === agentId);
    };

    const existing: Participant[] = [
      { eventId: 'event1', agentId: 'agent1' },
      { eventId: 'event1', agentId: 'agent2' },
      { eventId: 'event2', agentId: 'agent1' },
    ];

    expect(isDuplicateParticipant(existing, 'event1', 'agent1')).toBe(true);
    expect(isDuplicateParticipant(existing, 'event1', 'agent3')).toBe(false);
    expect(isDuplicateParticipant(existing, 'event3', 'agent1')).toBe(false);
  });

  it('should validate config object structure', () => {
    const validateConfig = (config: any): { valid: boolean; error?: string } => {
      if (typeof config !== 'object' || config === null) {
        return { valid: false, error: 'Config must be an object' };
      }

      if (Array.isArray(config)) {
        return { valid: false, error: 'Config cannot be an array' };
      }

      return { valid: true };
    };

    expect(validateConfig({})).toEqual({ valid: true });
    expect(validateConfig({ maxParticipants: 10 })).toEqual({ valid: true });
    expect(validateConfig(null)).toEqual({ valid: false, error: 'Config must be an object' });
    expect(validateConfig([])).toEqual({ valid: false, error: 'Config cannot be an array' });
    expect(validateConfig('string')).toEqual({ valid: false, error: 'Config must be an object' });
  });

  it('should calculate total participants correctly', () => {
    type EventParticipants = {
      eventId: string;
      count: number;
    };

    const getTotalParticipants = (
      participants: EventParticipants[],
      eventId: string
    ): number => {
      const event = participants.find((p) => p.eventId === eventId);
      return event?.count ?? 0;
    };

    const participants: EventParticipants[] = [
      { eventId: 'event1', count: 10 },
      { eventId: 'event2', count: 5 },
      { eventId: 'event3', count: 0 },
    ];

    expect(getTotalParticipants(participants, 'event1')).toBe(10);
    expect(getTotalParticipants(participants, 'event2')).toBe(5);
    expect(getTotalParticipants(participants, 'event3')).toBe(0);
    expect(getTotalParticipants(participants, 'nonexistent')).toBe(0);
  });

  it('should format event type for display', () => {
    const formatEventType = (type: string): string => {
      const typeMap: Record<string, string> = {
        rps_tournament: 'RPS Tournament',
        trivia: 'Trivia',
        room_decoration_contest: 'Room Decoration Contest',
      };

      return typeMap[type] ?? type;
    };

    expect(formatEventType('rps_tournament')).toBe('RPS Tournament');
    expect(formatEventType('trivia')).toBe('Trivia');
    expect(formatEventType('room_decoration_contest')).toBe('Room Decoration Contest');
    expect(formatEventType('unknown')).toBe('unknown');
  });

  it('should determine if event can accept new participants', () => {
    type Event = {
      status: 'scheduled' | 'active' | 'ended' | 'cancelled';
    };

    const canJoinEvent = (event: Event): boolean => {
      return event.status === 'scheduled' || event.status === 'active';
    };

    expect(canJoinEvent({ status: 'scheduled' })).toBe(true);
    expect(canJoinEvent({ status: 'active' })).toBe(true);
    expect(canJoinEvent({ status: 'ended' })).toBe(false);
    expect(canJoinEvent({ status: 'cancelled' })).toBe(false);
  });

  it('should calculate average score for event', () => {
    type Participant = {
      score: number;
    };

    const calculateAverageScore = (participants: Participant[]): number => {
      if (participants.length === 0) return 0;

      const total = participants.reduce((sum, p) => sum + p.score, 0);
      return Math.round((total / participants.length) * 100) / 100; // Round to 2 decimals
    };

    expect(calculateAverageScore([{ score: 100 }, { score: 50 }, { score: 75 }])).toBe(75);
    expect(calculateAverageScore([{ score: 0 }, { score: 0 }])).toBe(0);
    expect(calculateAverageScore([])).toBe(0);
    expect(calculateAverageScore([{ score: 100 }])).toBe(100);
  });
});
