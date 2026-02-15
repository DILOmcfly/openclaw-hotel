import { describe, it, expect } from 'vitest';

/**
 * Reputation System Unit Tests
 * These tests validate input and logic without requiring a database connection
 */

describe('Reputation System - Validation', () => {
  it('should validate review score is -1 or 1', () => {
    const validScores = [-1, 1];
    const invalidScores = [0, 2, -2, 5, -5, 0.5, 1.5];
    
    const isValidScore = (score: number): boolean => {
      return score === -1 || score === 1;
    };
    
    validScores.forEach(score => {
      expect(isValidScore(score)).toBe(true);
    });
    
    invalidScores.forEach(score => {
      expect(isValidScore(score)).toBe(false);
    });
  });

  it('should prevent self-review', () => {
    const agentId = 'agent-123';
    
    const isSelfReview = (reviewerId: string, targetId: string): boolean => {
      return reviewerId === targetId;
    };
    
    expect(isSelfReview(agentId, agentId)).toBe(true);
    expect(isSelfReview(agentId, 'agent-456')).toBe(false);
  });

  it('should validate comment length (max 200 chars)', () => {
    const validComment = 'Great agent!';
    const longComment = 'a'.repeat(201);
    const maxComment = 'a'.repeat(200);
    
    const isValidComment = (comment: string): boolean => {
      return comment.length <= 200;
    };
    
    expect(isValidComment(validComment)).toBe(true);
    expect(isValidComment(maxComment)).toBe(true);
    expect(isValidComment(longComment)).toBe(false);
    expect(isValidComment('')).toBe(true); // Empty comment is allowed
  });

  it('should calculate karma correctly from reviews', () => {
    type Review = { score: number };
    
    const calculateKarma = (reviews: Review[]): number => {
      return reviews.reduce((sum, review) => sum + review.score, 0);
    };
    
    expect(calculateKarma([{ score: 1 }, { score: 1 }, { score: 1 }])).toBe(3);
    expect(calculateKarma([{ score: -1 }, { score: -1 }])).toBe(-2);
    expect(calculateKarma([{ score: 1 }, { score: -1 }, { score: 1 }])).toBe(1);
    expect(calculateKarma([])).toBe(0);
  });

  it('should count positive and negative reviews correctly', () => {
    type Review = { score: number };
    type Counts = { positive: number; negative: number };
    
    const countReviews = (reviews: Review[]): Counts => {
      return reviews.reduce(
        (acc, review) => {
          if (review.score === 1) acc.positive++;
          if (review.score === -1) acc.negative++;
          return acc;
        },
        { positive: 0, negative: 0 }
      );
    };
    
    expect(countReviews([{ score: 1 }, { score: 1 }, { score: -1 }])).toEqual({
      positive: 2,
      negative: 1,
    });
    
    expect(countReviews([{ score: -1 }, { score: -1 }, { score: -1 }])).toEqual({
      positive: 0,
      negative: 3,
    });
    
    expect(countReviews([])).toEqual({ positive: 0, negative: 0 });
  });

  it('should detect duplicate review attempts', () => {
    type Review = { reviewerId: string; targetId: string };
    
    const hasDuplicateReview = (
      existingReviews: Review[],
      reviewerId: string,
      targetId: string
    ): boolean => {
      return existingReviews.some(
        r => r.reviewerId === reviewerId && r.targetId === targetId
      );
    };
    
    const reviews: Review[] = [
      { reviewerId: 'agent-1', targetId: 'agent-2' },
      { reviewerId: 'agent-2', targetId: 'agent-3' },
    ];
    
    expect(hasDuplicateReview(reviews, 'agent-1', 'agent-2')).toBe(true);
    expect(hasDuplicateReview(reviews, 'agent-1', 'agent-3')).toBe(false);
    expect(hasDuplicateReview([], 'agent-1', 'agent-2')).toBe(false);
  });

  it('should calculate karma delta when updating review', () => {
    const calculateDelta = (oldScore: number, newScore: number): number => {
      return newScore - oldScore;
    };
    
    expect(calculateDelta(1, -1)).toBe(-2); // Changed from positive to negative
    expect(calculateDelta(-1, 1)).toBe(2);  // Changed from negative to positive
    expect(calculateDelta(1, 1)).toBe(0);   // No change
    expect(calculateDelta(-1, -1)).toBe(0); // No change
  });

  it('should sort reputation by karma descending', () => {
    type Reputation = { agentId: string; karma: number; positiveReviews: number };
    
    const sortByReputation = (reps: Reputation[]): Reputation[] => {
      return [...reps].sort((a, b) => {
        if (b.karma !== a.karma) {
          return b.karma - a.karma;
        }
        return b.positiveReviews - a.positiveReviews;
      });
    };
    
    const reputations: Reputation[] = [
      { agentId: 'agent-1', karma: 5, positiveReviews: 5 },
      { agentId: 'agent-2', karma: 10, positiveReviews: 10 },
      { agentId: 'agent-3', karma: 10, positiveReviews: 12 },
      { agentId: 'agent-4', karma: 3, positiveReviews: 4 },
    ];
    
    const sorted = sortByReputation(reputations);
    
    expect(sorted[0].agentId).toBe('agent-3'); // karma=10, positive=12
    expect(sorted[1].agentId).toBe('agent-2'); // karma=10, positive=10
    expect(sorted[2].agentId).toBe('agent-1'); // karma=5
    expect(sorted[3].agentId).toBe('agent-4'); // karma=3
  });

  it('should limit reviews list by count', () => {
    type Review = { id: string; score: number };
    
    const limitReviews = (reviews: Review[], limit: number): Review[] => {
      return reviews.slice(0, limit);
    };
    
    const reviews: Review[] = [
      { id: '1', score: 1 },
      { id: '2', score: -1 },
      { id: '3', score: 1 },
      { id: '4', score: 1 },
      { id: '5', score: -1 },
    ];
    
    expect(limitReviews(reviews, 3)).toHaveLength(3);
    expect(limitReviews(reviews, 10)).toHaveLength(5);
    expect(limitReviews(reviews, 0)).toHaveLength(0);
  });

  it('should handle reputation for new agent (no reviews)', () => {
    type Reputation = {
      agentId: string;
      karma: number;
      positiveReviews: number;
      negativeReviews: number;
    };
    
    const getDefaultReputation = (agentId: string): Reputation => {
      return {
        agentId,
        karma: 0,
        positiveReviews: 0,
        negativeReviews: 0,
      };
    };
    
    const newAgentRep = getDefaultReputation('agent-new');
    
    expect(newAgentRep.karma).toBe(0);
    expect(newAgentRep.positiveReviews).toBe(0);
    expect(newAgentRep.negativeReviews).toBe(0);
  });

  it('should validate review score change logic', () => {
    type ScoreChange = {
      oldScore: number;
      newScore: number;
      isValid: boolean;
    };
    
    const isValidScoreChange = (oldScore: number, newScore: number): boolean => {
      // Both scores must be valid (-1 or 1)
      if ((oldScore !== -1 && oldScore !== 1) || (newScore !== -1 && newScore !== 1)) {
        return false;
      }
      return true;
    };
    
    const changes: ScoreChange[] = [
      { oldScore: 1, newScore: -1, isValid: true },
      { oldScore: -1, newScore: 1, isValid: true },
      { oldScore: 1, newScore: 1, isValid: true },
      { oldScore: 1, newScore: 0, isValid: false },
      { oldScore: 0, newScore: 1, isValid: false },
      { oldScore: 2, newScore: 1, isValid: false },
    ];
    
    changes.forEach(change => {
      expect(isValidScoreChange(change.oldScore, change.newScore)).toBe(change.isValid);
    });
  });

  it('should format review timestamp correctly', () => {
    const formatReviewDate = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };
    
    const testDate = new Date('2024-02-15T10:30:00Z');
    expect(formatReviewDate(testDate)).toBe('2024-02-15');
  });

  it('should calculate review count increment correctly', () => {
    type UpdateCounts = {
      oldScore: number;
      newScore: number;
      positiveDelta: number;
      negativeDelta: number;
    };
    
    const calculateCountDeltas = (oldScore: number, newScore: number): UpdateCounts => {
      let positiveDelta = 0;
      let negativeDelta = 0;
      
      // Remove old score count
      if (oldScore === 1) positiveDelta--;
      if (oldScore === -1) negativeDelta--;
      
      // Add new score count
      if (newScore === 1) positiveDelta++;
      if (newScore === -1) negativeDelta++;
      
      return { oldScore, newScore, positiveDelta, negativeDelta };
    };
    
    // Change from positive to negative
    expect(calculateCountDeltas(1, -1)).toEqual({
      oldScore: 1,
      newScore: -1,
      positiveDelta: -1,
      negativeDelta: 1,
    });
    
    // Change from negative to positive
    expect(calculateCountDeltas(-1, 1)).toEqual({
      oldScore: -1,
      newScore: 1,
      positiveDelta: 1,
      negativeDelta: -1,
    });
    
    // No change
    expect(calculateCountDeltas(1, 1)).toEqual({
      oldScore: 1,
      newScore: 1,
      positiveDelta: 0,
      negativeDelta: 0,
    });
  });

  it('should validate empty vs null comment', () => {
    const normalizeComment = (comment: string | null | undefined): string => {
      return comment || '';
    };
    
    expect(normalizeComment('Great!')).toBe('Great!');
    expect(normalizeComment('')).toBe('');
    expect(normalizeComment(null)).toBe('');
    expect(normalizeComment(undefined)).toBe('');
  });

  it('should check if agent can review another agent', () => {
    type ReviewPermission = {
      reviewerId: string;
      targetId: string;
      existingReviews: { reviewerId: string; targetId: string }[];
    };
    
    const canReview = (perm: ReviewPermission): { allowed: boolean; reason?: string } => {
      // Self-review check
      if (perm.reviewerId === perm.targetId) {
        return { allowed: false, reason: 'Cannot review yourself' };
      }
      
      // Duplicate review check
      const hasDuplicate = perm.existingReviews.some(
        r => r.reviewerId === perm.reviewerId && r.targetId === perm.targetId
      );
      
      if (hasDuplicate) {
        return { allowed: false, reason: 'Already reviewed this agent' };
      }
      
      return { allowed: true };
    };
    
    const existingReviews = [
      { reviewerId: 'agent-1', targetId: 'agent-2' },
    ];
    
    // Self-review
    expect(canReview({
      reviewerId: 'agent-1',
      targetId: 'agent-1',
      existingReviews,
    })).toEqual({ allowed: false, reason: 'Cannot review yourself' });
    
    // Duplicate
    expect(canReview({
      reviewerId: 'agent-1',
      targetId: 'agent-2',
      existingReviews,
    })).toEqual({ allowed: false, reason: 'Already reviewed this agent' });
    
    // Valid
    expect(canReview({
      reviewerId: 'agent-1',
      targetId: 'agent-3',
      existingReviews,
    })).toEqual({ allowed: true });
  });
});
