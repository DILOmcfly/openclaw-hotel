import express from 'express';
import { sql } from '../db/index.js';
import * as triviaService from '../services/trivia.js';

const router = express.Router();

/**
 * GET /api/trivia/daily/:agentId
 * Get 5 random unanswered questions for an agent
 */
router.get('/api/trivia/daily/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const questions = await triviaService.getDailyQuestions(agentId, sql);

    // Don't send correct answer to client
    const sanitized = questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      category: q.category,
      difficulty: q.difficulty,
      rewardCoins: q.rewardCoins,
    }));

    res.json({ questions: sanitized });
  } catch (error) {
    console.error('[Trivia API] Error fetching daily questions:', error);
    res.status(500).json({ error: 'Failed to fetch daily questions' });
  }
});

/**
 * POST /api/trivia/answer
 * Submit an answer to a trivia question
 * Body: { agentId, questionId, selectedOption }
 */
router.post('/api/trivia/answer', async (req, res) => {
  try {
    const { agentId, questionId, selectedOption } = req.body;

    if (!agentId || questionId === undefined || selectedOption === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await triviaService.answerQuestion(agentId, questionId, selectedOption, sql);

    res.json({
      correct: result.correct,
      coinsAwarded: result.coinsAwarded,
      correctOption: result.correctOption,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit answer';
    console.error('[Trivia API] Error submitting answer:', error);
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/agents/:agentId/trivia/stats
 * Get trivia statistics for an agent
 */
router.get('/api/agents/:agentId/trivia/stats', async (req, res) => {
  try {
    const { agentId } = req.params;
    const stats = await triviaService.getAgentStats(agentId, sql);
    const streak = await triviaService.getStreak(agentId, sql);

    res.json({ ...stats, currentStreak: streak });
  } catch (error) {
    console.error('[Trivia API] Error fetching agent stats:', error);
    res.status(500).json({ error: 'Failed to fetch agent stats' });
  }
});

/**
 * GET /api/trivia/leaderboard
 * Get trivia leaderboard
 * Query: ?limit=10
 */
router.get('/api/trivia/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await triviaService.getLeaderboard(limit, sql);

    res.json({ leaderboard });
  } catch (error) {
    console.error('[Trivia API] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/trivia/questions/:id/stats
 * Get statistics for a specific question
 */
router.get('/api/trivia/questions/:id/stats', async (req, res) => {
  try {
    const questionId = parseInt(req.params.id);
    const stats = await triviaService.getQuestionStats(questionId, sql);

    res.json(stats);
  } catch (error) {
    console.error('[Trivia API] Error fetching question stats:', error);
    res.status(500).json({ error: 'Failed to fetch question stats' });
  }
});

export default router;
