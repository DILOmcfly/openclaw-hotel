import { describe, it, expect, vi } from 'vitest';
import {
  createContest,
  enterContest,
  vote,
  getResults,
  advanceStatus,
  getActiveContests,
} from '../services/contests.js';

describe('Room Decoration Contests', () => {
  describe('createContest', () => {
    it('should create a new contest with valid data', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([]) // INSERT
        .mockResolvedValueOnce([{
          id: 'contest-1',
          title: 'Winter Wonderland',
          theme: 'Winter',
          status: 'open',
          entriesCloseAt: '2025-02-20T00:00:00.000Z',
          votingCloseAt: '2025-02-27T00:00:00.000Z',
          createdBy: 'agent-1',
          createdAt: '2025-02-15T00:00:00.000Z',
        }]);

      const contest = await createContest(
        'Winter Wonderland',
        'Winter',
        new Date('2025-02-20'),
        new Date('2025-02-27'),
        'agent-1',
        mockSql
      );

      expect(contest.title).toBe('Winter Wonderland');
      expect(contest.theme).toBe('Winter');
      expect(contest.status).toBe('open');
      expect(mockSql).toHaveBeenCalledTimes(2);
    });
  });

  describe('enterContest', () => {
    it('should allow entry during open status', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ status: 'open' }]) // Check status
        .mockResolvedValueOnce([]) // Check existing entries
        .mockResolvedValueOnce([]); // Insert entry

      const result = await enterContest('contest-1', 'room-1', 'agent-1', mockSql);

      expect(result.success).toBe(true);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('should reject entry when contest not found', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]); // No contest

      const result = await enterContest('invalid', 'room-1', 'agent-1', mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contest not found');
    });

    it('should reject entry when status is not open', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([{ status: 'voting' }]);

      const result = await enterContest('contest-1', 'room-1', 'agent-1', mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contest is not open for entries');
    });

    it('should reject duplicate entries from same agent', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ status: 'open' }])
        .mockResolvedValueOnce([{ contest_id: 'contest-1', owner_id: 'agent-1' }]); // Existing entry

      const result = await enterContest('contest-1', 'room-2', 'agent-1', mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent already has an entry in this contest');
    });
  });

  describe('vote', () => {
    it('should record vote during voting status', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ status: 'voting' }]) // Check status
        .mockResolvedValueOnce([{ ownerId: 'agent-2' }]) // Check entry exists
        .mockResolvedValueOnce([]); // Insert vote

      const result = await vote('contest-1', 'agent-1', 'room-2', 5, mockSql);

      expect(result.success).toBe(true);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('should reject vote with invalid score', async () => {
      const mockSql = vi.fn();

      const result1 = await vote('contest-1', 'agent-1', 'room-1', 0, mockSql);
      const result2 = await vote('contest-1', 'agent-1', 'room-1', 6, mockSql);

      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Score must be between 1 and 5');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Score must be between 1 and 5');
      expect(mockSql).not.toHaveBeenCalled();
    });

    it('should reject vote when contest not found', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]);

      const result = await vote('invalid', 'agent-1', 'room-1', 5, mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contest not found');
    });

    it('should reject vote when status is not voting', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([{ status: 'open' }]);

      const result = await vote('contest-1', 'agent-1', 'room-1', 5, mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contest is not open for voting');
    });

    it('should reject vote when room not in contest', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ status: 'voting' }])
        .mockResolvedValueOnce([]); // No entry found

      const result = await vote('contest-1', 'agent-1', 'room-invalid', 5, mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Room is not entered in this contest');
    });

    it('should prevent self-voting', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ status: 'voting' }])
        .mockResolvedValueOnce([{ ownerId: 'agent-1' }]); // Owner is same as voter

      const result = await vote('contest-1', 'agent-1', 'room-1', 5, mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot vote for your own room');
    });
  });

  describe('getResults', () => {
    it('should return results sorted by average score', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([
        {
          roomId: 'room-1',
          ownerId: 'agent-1',
          averageScore: 4.5,
          voteCount: 10,
          submittedAt: '2025-02-15T10:00:00.000Z',
        },
        {
          roomId: 'room-2',
          ownerId: 'agent-2',
          averageScore: 4.2,
          voteCount: 8,
          submittedAt: '2025-02-15T11:00:00.000Z',
        },
        {
          roomId: 'room-3',
          ownerId: 'agent-3',
          averageScore: 3.8,
          voteCount: 5,
          submittedAt: '2025-02-15T09:00:00.000Z',
        },
      ]);

      const results = await getResults('contest-1', mockSql);

      expect(results).toHaveLength(3);
      expect(results[0].averageScore).toBe(4.5);
      expect(results[1].averageScore).toBe(4.2);
      expect(results[2].averageScore).toBe(3.8);
    });

    it('should handle contests with no votes', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([
        {
          roomId: 'room-1',
          ownerId: 'agent-1',
          averageScore: 0,
          voteCount: 0,
          submittedAt: '2025-02-15T10:00:00.000Z',
        },
      ]);

      const results = await getResults('contest-1', mockSql);

      expect(results).toHaveLength(1);
      expect(results[0].averageScore).toBe(0);
      expect(results[0].voteCount).toBe(0);
    });
  });

  describe('advanceStatus', () => {
    it('should advance from open to voting', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ status: 'open' }])
        .mockResolvedValueOnce([]);

      const result = await advanceStatus('contest-1', mockSql);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('voting');
    });

    it('should advance from voting to ended', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ status: 'voting' }])
        .mockResolvedValueOnce([]);

      const result = await advanceStatus('contest-1', mockSql);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('ended');
    });

    it('should reject advancing from ended', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([{ status: 'ended' }]);

      const result = await advanceStatus('contest-1', mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contest has already ended');
    });

    it('should reject when contest not found', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]);

      const result = await advanceStatus('invalid', mockSql);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contest not found');
    });
  });

  describe('getActiveContests', () => {
    it('should return only open and voting contests', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([
        {
          id: 'contest-1',
          title: 'Winter Wonderland',
          theme: 'Winter',
          status: 'open',
          entriesCloseAt: '2025-02-20T00:00:00.000Z',
          votingCloseAt: '2025-02-27T00:00:00.000Z',
          createdBy: 'agent-1',
          createdAt: '2025-02-15T00:00:00.000Z',
        },
        {
          id: 'contest-2',
          title: 'Spring Garden',
          theme: 'Spring',
          status: 'voting',
          entriesCloseAt: '2025-02-18T00:00:00.000Z',
          votingCloseAt: '2025-02-25T00:00:00.000Z',
          createdBy: 'agent-1',
          createdAt: '2025-02-10T00:00:00.000Z',
        },
      ]);

      const contests = await getActiveContests(mockSql);

      expect(contests).toHaveLength(2);
      expect(contests[0].status).toBe('open');
      expect(contests[1].status).toBe('voting');
    });

    it('should return empty array when no active contests', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]);

      const contests = await getActiveContests(mockSql);

      expect(contests).toHaveLength(0);
    });
  });
});
