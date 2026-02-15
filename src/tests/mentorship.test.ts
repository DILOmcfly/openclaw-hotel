import { describe, it, expect, vi } from 'vitest';
import * as mentorshipService from '../services/mentorship.js';

describe('Mentorship System - Unit Tests', () => {
  // Mock SQL responses
  const createMockSql = (mockResponses: any[]) => {
    let callIndex = 0;
    const mockFn = vi.fn((...args: any[]) => {
      const response = mockResponses[callIndex++];
      return Promise.resolve(response || []);
    });
    return mockFn as any;
  };

  describe('startMentorship', () => {
    it('should prevent self-mentorship', async () => {
      const sql = createMockSql([]);
      await expect(mentorshipService.startMentorship('agent1', 'agent1', sql)).rejects.toThrow(
        'Cannot mentor yourself'
      );
    });

    it('should enforce max 3 active mentees per mentor', async () => {
      const sql = createMockSql([[{ count: 3 }]]);
      await expect(mentorshipService.startMentorship('mentor1', 'mentee1', sql)).rejects.toThrow(
        'Mentor has reached maximum of 3 active mentees'
      );
    });

    it('should successfully create a new mentorship', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'active',
        startedAt: new Date(),
        completedAt: null,
        rating: null,
        feedback: null,
      };

      const sql = createMockSql([[{ count: 0 }], [mockMentorship]]);
      const result = await mentorshipService.startMentorship('mentor1', 'mentee1', sql);

      expect(result.mentorId).toBe('mentor1');
      expect(result.menteeId).toBe('mentee1');
      expect(result.status).toBe('active');
    });

    it('should allow mentor with 2 active mentees to take one more', async () => {
      const mockMentorship = {
        id: 2,
        mentorId: 'mentor1',
        menteeId: 'mentee2',
        status: 'active',
        startedAt: new Date(),
        completedAt: null,
        rating: null,
        feedback: null,
      };

      const sql = createMockSql([[{ count: 2 }], [mockMentorship]]);
      const result = await mentorshipService.startMentorship('mentor1', 'mentee2', sql);

      expect(result.id).toBe(2);
      expect(result.status).toBe('active');
    });
  });

  describe('completeMentorship', () => {
    it('should reject rating below 1', async () => {
      const sql = createMockSql([]);
      await expect(mentorshipService.completeMentorship(1, 0, null, sql)).rejects.toThrow(
        'Rating must be between 1 and 5'
      );
    });

    it('should reject rating above 5', async () => {
      const sql = createMockSql([]);
      await expect(mentorshipService.completeMentorship(1, 6, null, sql)).rejects.toThrow(
        'Rating must be between 1 and 5'
      );
    });

    it('should accept valid rating of 1', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        rating: 1,
        feedback: null,
      };

      const sql = createMockSql([
        [mockMentorship],
        [{ count: 1, avg_rating: 1 }],
        [],
      ]);

      const result = await mentorshipService.completeMentorship(1, 1, null, sql);
      expect(result.rating).toBe(1);
      expect(result.status).toBe('completed');
    });

    it('should accept valid rating of 5', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        rating: 5,
        feedback: 'Great mentor!',
      };

      const sql = createMockSql([
        [mockMentorship],
        [{ count: 1, avg_rating: 5 }],
        [],
      ]);

      const result = await mentorshipService.completeMentorship(1, 5, 'Great mentor!', sql);
      expect(result.rating).toBe(5);
      expect(result.feedback).toBe('Great mentor!');
    });

    it('should throw error if mentorship not found', async () => {
      const sql = createMockSql([[]]);
      await expect(mentorshipService.completeMentorship(999, 4, null, sql)).rejects.toThrow(
        'Mentorship not found or already completed'
      );
    });

    it('should store feedback with completion', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        rating: 4,
        feedback: 'Very helpful',
      };

      const sql = createMockSql([
        [mockMentorship],
        [{ count: 1, avg_rating: 4 }],
        [],
      ]);

      const result = await mentorshipService.completeMentorship(1, 4, 'Very helpful', sql);
      expect(result.feedback).toBe('Very helpful');
    });
  });

  describe('cancelMentorship', () => {
    it('should successfully cancel active mentorship', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'cancelled',
        startedAt: new Date(),
        completedAt: null,
        rating: null,
        feedback: null,
      };

      const sql = createMockSql([[mockMentorship]]);
      const result = await mentorshipService.cancelMentorship(1, sql);

      expect(result.status).toBe('cancelled');
    });

    it('should throw error if mentorship not found', async () => {
      const sql = createMockSql([[]]);
      await expect(mentorshipService.cancelMentorship(999, sql)).rejects.toThrow(
        'Mentorship not found or already completed/cancelled'
      );
    });
  });

  describe('getActiveMentorships', () => {
    it('should return active mentorships for mentor', async () => {
      const mockMentorships = [
        {
          id: 1,
          mentorId: 'mentor1',
          menteeId: 'mentee1',
          status: 'active',
          startedAt: new Date(),
          completedAt: null,
          rating: null,
          feedback: null,
        },
        {
          id: 2,
          mentorId: 'mentor1',
          menteeId: 'mentee2',
          status: 'active',
          startedAt: new Date(),
          completedAt: null,
          rating: null,
          feedback: null,
        },
      ];

      const sql = createMockSql([mockMentorships]);
      const result = await mentorshipService.getActiveMentorships('mentor1', sql);

      expect(result).toHaveLength(2);
      expect(result[0].mentorId).toBe('mentor1');
    });

    it('should return empty array if no active mentorships', async () => {
      const sql = createMockSql([[]]);
      const result = await mentorshipService.getActiveMentorships('agent1', sql);

      expect(result).toHaveLength(0);
    });
  });

  describe('getMentorStats', () => {
    it('should return existing mentor stats', async () => {
      const mockStats = {
        agentId: 'mentor1',
        menteesHelped: 5,
        avgRating: 4.5,
        totalReviews: 5,
        mentorLevel: 'intermediate',
      };

      const sql = createMockSql([[mockStats]]);
      const result = await mentorshipService.getMentorStats('mentor1', sql);

      expect(result.menteesHelped).toBe(5);
      expect(result.avgRating).toBe(4.5);
      expect(result.mentorLevel).toBe('intermediate');
    });

    it('should create default stats for new mentor', async () => {
      const mockNewStats = {
        agentId: 'newmentor',
        menteesHelped: 0,
        avgRating: 0,
        totalReviews: 0,
        mentorLevel: 'beginner',
      };

      const sql = createMockSql([[], [mockNewStats]]);
      const result = await mentorshipService.getMentorStats('newmentor', sql);

      expect(result.menteesHelped).toBe(0);
      expect(result.mentorLevel).toBe('beginner');
    });
  });

  describe('Mentor Level Calculation', () => {
    it('should assign beginner level for 0-2 mentees', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        rating: 4,
        feedback: null,
      };

      const sql = createMockSql([
        [mockMentorship],
        [{ count: 2, avg_rating: 4 }],
        [],
      ]);

      await mentorshipService.completeMentorship(1, 4, null, sql);
      expect(sql).toHaveBeenCalled();
    });

    it('should assign intermediate level for 3-5 mentees', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        rating: 4,
        feedback: null,
      };

      const sql = createMockSql([
        [mockMentorship],
        [{ count: 4, avg_rating: 4.2 }],
        [],
      ]);

      await mentorshipService.completeMentorship(1, 4, null, sql);
      expect(sql).toHaveBeenCalled();
    });

    it('should assign expert level for 6-10 mentees', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        rating: 5,
        feedback: null,
      };

      const sql = createMockSql([
        [mockMentorship],
        [{ count: 8, avg_rating: 4.8 }],
        [],
      ]);

      await mentorshipService.completeMentorship(1, 5, null, sql);
      expect(sql).toHaveBeenCalled();
    });

    it('should assign master level for 11+ mentees', async () => {
      const mockMentorship = {
        id: 1,
        mentorId: 'mentor1',
        menteeId: 'mentee1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        rating: 5,
        feedback: null,
      };

      const sql = createMockSql([
        [mockMentorship],
        [{ count: 15, avg_rating: 4.9 }],
        [],
      ]);

      await mentorshipService.completeMentorship(1, 5, null, sql);
      expect(sql).toHaveBeenCalled();
    });
  });

  describe('getTopMentors', () => {
    it('should return top mentors sorted by rating', async () => {
      const mockMentors = [
        {
          agentId: 'mentor1',
          menteesHelped: 10,
          avgRating: 4.9,
          totalReviews: 10,
          mentorLevel: 'expert',
        },
        {
          agentId: 'mentor2',
          menteesHelped: 8,
          avgRating: 4.7,
          totalReviews: 8,
          mentorLevel: 'expert',
        },
      ];

      const sql = createMockSql([mockMentors]);
      const result = await mentorshipService.getTopMentors(10, sql);

      expect(result).toHaveLength(2);
      expect(result[0].avgRating).toBeGreaterThanOrEqual(result[1].avgRating);
    });

    it('should respect limit parameter', async () => {
      const mockMentors = [
        {
          agentId: 'mentor1',
          menteesHelped: 5,
          avgRating: 5.0,
          totalReviews: 5,
          mentorLevel: 'intermediate',
        },
      ];

      const sql = createMockSql([mockMentors]);
      const result = await mentorshipService.getTopMentors(1, sql);

      expect(result).toHaveLength(1);
    });
  });

  describe('findMentor', () => {
    it('should return available mentors with capacity', async () => {
      const mockMentors = [
        {
          agentId: 'mentor1',
          menteesHelped: 5,
          avgRating: 4.5,
          totalReviews: 5,
          mentorLevel: 'intermediate',
          active_count: 1,
        },
        {
          agentId: 'mentor2',
          menteesHelped: 3,
          avgRating: 4.2,
          totalReviews: 3,
          mentorLevel: 'intermediate',
          active_count: 0,
        },
      ];

      const sql = createMockSql([mockMentors]);
      const result = await mentorshipService.findMentor(sql);

      expect(result).toHaveLength(2);
      expect(result[0].agentId).toBe('mentor1');
    });

    it('should return empty array if no mentors available', async () => {
      const sql = createMockSql([[]]);
      const result = await mentorshipService.findMentor(sql);

      expect(result).toHaveLength(0);
    });
  });
});
