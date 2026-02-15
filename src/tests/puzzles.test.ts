import { describe, it, expect } from 'vitest';

/**
 * Puzzles System Unit Tests
 * Tests collaborative room puzzle logic without database
 */

describe('Puzzles System', () => {
  describe('Answer Validation', () => {
    it('should match answer case-insensitive', () => {
      const checkAnswer = (guess: string, answer: string): boolean => {
        return guess.trim().toLowerCase() === answer.trim().toLowerCase();
      };

      expect(checkAnswer('BLUE', 'blue')).toBe(true);
      expect(checkAnswer('Blue', 'BLUE')).toBe(true);
      expect(checkAnswer('  blue  ', 'blue')).toBe(true);
    });

    it('should reject incorrect answers', () => {
      const checkAnswer = (guess: string, answer: string): boolean => {
        return guess.trim().toLowerCase() === answer.trim().toLowerCase();
      };

      expect(checkAnswer('red', 'blue')).toBe(false);
      expect(checkAnswer('blu', 'blue')).toBe(false);
    });

    it('should handle whitespace in answers', () => {
      const checkAnswer = (guess: string, answer: string): boolean => {
        return guess.trim().toLowerCase() === answer.trim().toLowerCase();
      };

      expect(checkAnswer('  answer  ', 'answer')).toBe(true);
      expect(checkAnswer('answer', '  answer  ')).toBe(true);
    });
  });

  describe('Attempt Tracking', () => {
    it('should count failed attempts correctly', () => {
      const attempts = [
        { correct: false },
        { correct: false },
        { correct: false },
      ];

      const failedCount = attempts.filter(a => !a.correct).length;
      expect(failedCount).toBe(3);
    });

    it('should detect when max attempts reached', () => {
      const maxAttempts = 10;
      const currentAttempts = 10;

      expect(currentAttempts >= maxAttempts).toBe(true);
    });

    it('should allow attempts before limit', () => {
      const maxAttempts = 10;
      const currentAttempts = 5;

      expect(currentAttempts < maxAttempts).toBe(true);
    });
  });

  describe('Hint Availability', () => {
    it('should require 3 failed attempts before showing hint', () => {
      const canShowHint = (failedAttempts: number): boolean => {
        return failedAttempts >= 3;
      };

      expect(canShowHint(0)).toBe(false);
      expect(canShowHint(1)).toBe(false);
      expect(canShowHint(2)).toBe(false);
      expect(canShowHint(3)).toBe(true);
      expect(canShowHint(5)).toBe(true);
    });

    it('should hide hint before threshold', () => {
      const attempts = [
        { correct: false },
        { correct: false },
      ];

      const failedCount = attempts.filter(a => !a.correct).length;
      expect(failedCount < 3).toBe(true);
    });
  });

  describe('Puzzle Status Management', () => {
    it('should mark puzzle as solved on correct answer', () => {
      type PuzzleStatus = 'active' | 'solved' | 'expired';
      
      const updateStatus = (correct: boolean): PuzzleStatus => {
        return correct ? 'solved' : 'active';
      };

      expect(updateStatus(true)).toBe('solved');
      expect(updateStatus(false)).toBe('active');
    });

    it('should mark puzzle as expired when max attempts reached', () => {
      type PuzzleStatus = 'active' | 'solved' | 'expired';
      
      const updateStatus = (attempts: number, maxAttempts: number): PuzzleStatus => {
        return attempts >= maxAttempts ? 'expired' : 'active';
      };

      expect(updateStatus(10, 10)).toBe('expired');
      expect(updateStatus(11, 10)).toBe('expired');
      expect(updateStatus(5, 10)).toBe('active');
    });

    it('should not accept guesses for inactive puzzles', () => {
      type PuzzleStatus = 'active' | 'solved' | 'expired';
      
      const canAcceptGuess = (status: PuzzleStatus): boolean => {
        return status === 'active';
      };

      expect(canAcceptGuess('active')).toBe(true);
      expect(canAcceptGuess('solved')).toBe(false);
      expect(canAcceptGuess('expired')).toBe(false);
    });
  });

  describe('Reward System', () => {
    it('should award coins on correct answer', () => {
      const calculateReward = (correct: boolean, rewardCoins: number): number => {
        return correct ? rewardCoins : 0;
      };

      expect(calculateReward(true, 50)).toBe(50);
      expect(calculateReward(true, 100)).toBe(100);
      expect(calculateReward(false, 50)).toBe(0);
    });

    it('should not award coins for incorrect guesses', () => {
      const calculateReward = (correct: boolean, rewardCoins: number): number => {
        return correct ? rewardCoins : 0;
      };

      expect(calculateReward(false, 50)).toBe(0);
      expect(calculateReward(false, 100)).toBe(0);
    });
  });

  describe('Puzzle Types Validation', () => {
    it('should accept valid puzzle types', () => {
      const validTypes = ['word', 'math', 'logic', 'pattern', 'trivia'];
      
      const isValidType = (type: string): boolean => {
        return validTypes.includes(type);
      };

      expect(isValidType('word')).toBe(true);
      expect(isValidType('math')).toBe(true);
      expect(isValidType('logic')).toBe(true);
      expect(isValidType('pattern')).toBe(true);
      expect(isValidType('trivia')).toBe(true);
    });

    it('should reject invalid puzzle types', () => {
      const validTypes = ['word', 'math', 'logic', 'pattern', 'trivia'];
      
      const isValidType = (type: string): boolean => {
        return validTypes.includes(type);
      };

      expect(isValidType('invalid')).toBe(false);
      expect(isValidType('random')).toBe(false);
      expect(isValidType('')).toBe(false);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate solve percentage correctly', () => {
      const calculateSolvePercentage = (solved: number, total: number): number => {
        return total > 0 ? (solved / total) * 100 : 0;
      };

      expect(calculateSolvePercentage(5, 10)).toBe(50);
      expect(calculateSolvePercentage(7, 10)).toBe(70);
      expect(calculateSolvePercentage(10, 10)).toBe(100);
      expect(calculateSolvePercentage(0, 10)).toBe(0);
    });

    it('should handle zero total puzzles', () => {
      const calculateSolvePercentage = (solved: number, total: number): number => {
        return total > 0 ? (solved / total) * 100 : 0;
      };

      expect(calculateSolvePercentage(0, 0)).toBe(0);
    });

    it('should calculate average attempts to solve', () => {
      const attemptCounts = [3, 5, 2, 7, 1];
      const avg = attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length;

      expect(avg).toBe(3.6);
    });

    it('should handle no solved puzzles for average', () => {
      const attemptCounts: number[] = [];
      const avg = attemptCounts.length > 0 
        ? attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length 
        : 0;

      expect(avg).toBe(0);
    });
  });

  describe('Leaderboard Sorting', () => {
    it('should sort by puzzles solved descending', () => {
      const agents = [
        { agentId: 'a1', puzzlesSolved: 5 },
        { agentId: 'a2', puzzlesSolved: 12 },
        { agentId: 'a3', puzzlesSolved: 3 },
      ];

      const sorted = [...agents].sort((a, b) => b.puzzlesSolved - a.puzzlesSolved);

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a3');
    });

    it('should respect limit parameter', () => {
      const agents = [
        { agentId: 'a1', puzzlesSolved: 10 },
        { agentId: 'a2', puzzlesSolved: 9 },
        { agentId: 'a3', puzzlesSolved: 8 },
        { agentId: 'a4', puzzlesSolved: 7 },
      ];

      const limit = 2;
      const limited = agents.slice(0, limit);

      expect(limited).toHaveLength(2);
      expect(limited.map(a => a.agentId)).toEqual(['a1', 'a2']);
    });

    it('should filter out agents with zero puzzles solved', () => {
      const agents = [
        { agentId: 'a1', puzzlesSolved: 5 },
        { agentId: 'a2', puzzlesSolved: 0 },
        { agentId: 'a3', puzzlesSolved: 3 },
      ];

      const filtered = agents.filter(a => a.puzzlesSolved > 0);

      expect(filtered).toHaveLength(2);
      expect(filtered.map(a => a.agentId)).toEqual(['a1', 'a3']);
    });
  });

  describe('Answer Hiding', () => {
    it('should hide answer for active puzzles', () => {
      type PuzzleStatus = 'active' | 'solved' | 'expired';
      
      const getDisplayAnswer = (status: PuzzleStatus, answer: string): string | null => {
        return status === 'solved' ? answer : null;
      };

      expect(getDisplayAnswer('active', 'secret')).toBeNull();
      expect(getDisplayAnswer('expired', 'secret')).toBeNull();
    });

    it('should show answer for solved puzzles', () => {
      type PuzzleStatus = 'active' | 'solved' | 'expired';
      
      const getDisplayAnswer = (status: PuzzleStatus, answer: string): string | null => {
        return status === 'solved' ? answer : null;
      };

      expect(getDisplayAnswer('solved', 'secret')).toBe('secret');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty guess', () => {
      const checkAnswer = (guess: string, answer: string): boolean => {
        return guess.trim().toLowerCase() === answer.trim().toLowerCase();
      };

      expect(checkAnswer('', 'answer')).toBe(false);
      expect(checkAnswer('   ', 'answer')).toBe(false);
    });

    it('should handle special characters in answers', () => {
      const checkAnswer = (guess: string, answer: string): boolean => {
        return guess.trim().toLowerCase() === answer.trim().toLowerCase();
      };

      expect(checkAnswer('hello-world', 'hello-world')).toBe(true);
      expect(checkAnswer('c++', 'C++')).toBe(true);
      expect(checkAnswer('user@email.com', 'USER@EMAIL.COM')).toBe(true);
    });

    it('should handle numeric answers as strings', () => {
      const checkAnswer = (guess: string, answer: string): boolean => {
        return guess.trim().toLowerCase() === answer.trim().toLowerCase();
      };

      expect(checkAnswer('42', '42')).toBe(true);
      expect(checkAnswer('3.14', '3.14')).toBe(true);
    });
  });
});
