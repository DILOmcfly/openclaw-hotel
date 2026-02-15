import { describe, it, expect, vi } from 'vitest';
import * as triviaService from '../services/trivia.js';

/**
 * Trivia Service Unit Tests
 * All SQL calls are mocked - no real database connections
 */

describe('Trivia Service Tests', () => {
  describe('getDailyQuestions', () => {
    it('should return 5 unanswered questions', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { id: 1, question: 'Q1', options: '["A","B","C","D"]', correctOption: 0, category: 'science', difficulty: 'easy', rewardCoins: 10, createdAt: new Date() },
        { id: 2, question: 'Q2', options: '["A","B","C","D"]', correctOption: 1, category: 'history', difficulty: 'medium', rewardCoins: 25, createdAt: new Date() },
        { id: 3, question: 'Q3', options: '["A","B","C","D"]', correctOption: 2, category: 'tech', difficulty: 'hard', rewardCoins: 50, createdAt: new Date() },
        { id: 4, question: 'Q4', options: '["A","B","C","D"]', correctOption: 3, category: 'gaming', difficulty: 'easy', rewardCoins: 10, createdAt: new Date() },
        { id: 5, question: 'Q5', options: '["A","B","C","D"]', correctOption: 0, category: 'general', difficulty: 'medium', rewardCoins: 25, createdAt: new Date() },
      ]);

      const questions = await triviaService.getDailyQuestions('agent1', mockSql);

      expect(questions).toHaveLength(5);
      expect(questions[0].options).toEqual(['A', 'B', 'C', 'D']);
      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it('should parse JSON options correctly', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { id: 1, question: 'Test', options: '["Option1","Option2","Option3","Option4"]', correctOption: 0, category: 'test', difficulty: 'easy', rewardCoins: 10, createdAt: new Date() },
      ]);

      const questions = await triviaService.getDailyQuestions('agent1', mockSql);

      expect(questions[0].options).toEqual(['Option1', 'Option2', 'Option3', 'Option4']);
    });

    it('should handle empty results', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const questions = await triviaService.getDailyQuestions('agent1', mockSql);

      expect(questions).toHaveLength(0);
    });
  });

  describe('answerQuestion', () => {
    it('should accept correct answer and award coins', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([]) // Check not answered
        .mockResolvedValueOnce([{ correctOption: 1, rewardCoins: 25 }]) // Get question
        .mockResolvedValueOnce([]) // Insert answer
        .mockResolvedValueOnce([]); // Update balance

      const result = await triviaService.answerQuestion('agent1', 1, 1, mockSql);

      expect(result.correct).toBe(true);
      expect(result.coinsAwarded).toBe(25);
      expect(result.correctOption).toBe(1);
      expect(mockSql).toHaveBeenCalledTimes(4);
    });

    it('should accept incorrect answer with 0 coins', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([]) // Check not answered
        .mockResolvedValueOnce([{ correctOption: 2, rewardCoins: 50 }]) // Get question
        .mockResolvedValueOnce([]); // Insert answer (no balance update for wrong answer)

      const result = await triviaService.answerQuestion('agent1', 1, 0, mockSql);

      expect(result.correct).toBe(false);
      expect(result.coinsAwarded).toBe(0);
      expect(result.correctOption).toBe(2);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('should throw error if question already answered', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([{ id: 1 }]); // Already answered

      await expect(triviaService.answerQuestion('agent1', 1, 0, mockSql))
        .rejects.toThrow('Question already answered');
    });

    it('should throw error if question not found', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([]) // Not answered
        .mockResolvedValueOnce([]); // Question not found

      await expect(triviaService.answerQuestion('agent1', 999, 0, mockSql))
        .rejects.toThrow('Question not found');
    });

    it('should throw error for invalid option (negative)', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]); // Not answered

      await expect(triviaService.answerQuestion('agent1', 1, -1, mockSql))
        .rejects.toThrow('Invalid option selected');
    });

    it('should throw error for invalid option (too high)', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]); // Not answered

      await expect(triviaService.answerQuestion('agent1', 1, 4, mockSql))
        .rejects.toThrow('Invalid option selected');
    });
  });

  describe('getAgentStats', () => {
    it('should calculate stats correctly', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ total_answered: '10', correct_answers: '7' }])
        .mockResolvedValueOnce([{ coins_earned: '150' }]);

      const stats = await triviaService.getAgentStats('agent1', mockSql);

      expect(stats.totalAnswered).toBe(10);
      expect(stats.correctAnswers).toBe(7);
      expect(stats.correctPercentage).toBe(70);
      expect(stats.coinsEarned).toBe(150);
    });

    it('should handle agent with no answers', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ total_answered: '0', correct_answers: '0' }])
        .mockResolvedValueOnce([{ coins_earned: null }]);

      const stats = await triviaService.getAgentStats('agent1', mockSql);

      expect(stats.totalAnswered).toBe(0);
      expect(stats.correctAnswers).toBe(0);
      expect(stats.correctPercentage).toBe(0);
      expect(stats.coinsEarned).toBe(0);
    });

    it('should round percentage correctly', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ total_answered: '3', correct_answers: '2' }])
        .mockResolvedValueOnce([{ coins_earned: '50' }]);

      const stats = await triviaService.getAgentStats('agent1', mockSql);

      expect(stats.correctPercentage).toBe(67); // 66.666... rounded
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard sorted by correct answers', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { agentId: 'agent1', total_answered: '10', correct_answers: '8' },
        { agentId: 'agent2', total_answered: '15', correct_answers: '7' },
        { agentId: 'agent3', total_answered: '5', correct_answers: '5' },
      ]);

      const leaderboard = await triviaService.getLeaderboard(10, mockSql);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].agentId).toBe('agent1');
      expect(leaderboard[0].correctAnswers).toBe(8);
      expect(leaderboard[0].accuracy).toBe(80);
    });

    it('should handle empty leaderboard', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const leaderboard = await triviaService.getLeaderboard(10, mockSql);

      expect(leaderboard).toHaveLength(0);
    });

    it('should calculate accuracy correctly', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { agentId: 'agent1', total_answered: '20', correct_answers: '15' },
      ]);

      const leaderboard = await triviaService.getLeaderboard(10, mockSql);

      expect(leaderboard[0].accuracy).toBe(75);
    });
  });

  describe('getQuestionStats', () => {
    it('should calculate question stats correctly', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { total_attempts: '20', correct_attempts: '12' },
      ]);

      const stats = await triviaService.getQuestionStats(1, mockSql);

      expect(stats.questionId).toBe(1);
      expect(stats.totalAttempts).toBe(20);
      expect(stats.correctAttempts).toBe(12);
      expect(stats.successRate).toBe(60);
    });

    it('should handle question with no attempts', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { total_attempts: '0', correct_attempts: '0' },
      ]);

      const stats = await triviaService.getQuestionStats(1, mockSql);

      expect(stats.totalAttempts).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should handle 100% success rate', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { total_attempts: '5', correct_attempts: '5' },
      ]);

      const stats = await triviaService.getQuestionStats(1, mockSql);

      expect(stats.successRate).toBe(100);
    });
  });

  describe('getStreak', () => {
    it('should calculate consecutive correct answers', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { correct: true },
        { correct: true },
        { correct: true },
        { correct: false },
        { correct: true },
      ]);

      const streak = await triviaService.getStreak('agent1', mockSql);

      expect(streak).toBe(3);
    });

    it('should return 0 for no streak', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { correct: false },
        { correct: true },
      ]);

      const streak = await triviaService.getStreak('agent1', mockSql);

      expect(streak).toBe(0);
    });

    it('should handle all correct answers', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { correct: true },
        { correct: true },
        { correct: true },
      ]);

      const streak = await triviaService.getStreak('agent1', mockSql);

      expect(streak).toBe(3);
    });

    it('should handle no answers', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const streak = await triviaService.getStreak('agent1', mockSql);

      expect(streak).toBe(0);
    });
  });
});
