/**
 * Games API Routes
 */
import express from 'express';
import { z } from 'zod';
import { validateToken } from '../services/auth.js';
import {
  createGame,
  getGameState,
  joinGame,
  makeMove,
  getActiveGamesInRoom,
} from '../services/games.js';

const router = express.Router();

const createGameSchema = z.object({
  roomId: z.string(),
  gameType: z.enum(['dice', 'coinflip', 'rps']),
});

const makeMoveSchema = z.object({
  move: z.union([z.string(), z.number()]),
});

/**
 * POST /api/games
 * Create a new game
 */
router.post('/api/games', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId, gameType } = createGameSchema.parse(req.body);

    const game = createGame(roomId, gameType, agentId);

    return res.status(201).json({
      gameId: game.id,
      roomId: game.roomId,
      type: game.type,
      status: game.status,
      hostId: game.hostId,
      participants: game.participants,
    });
  } catch (error: any) {
    return res.status(400).json({
      error: error.message || 'Failed to create game',
    });
  }
});

/**
 * GET /api/games/:id
 * Get game state
 */
router.get('/api/games/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    validateToken(token);

    const game = getGameState(req.params.id);

    return res.json({
      gameId: game.id,
      roomId: game.roomId,
      type: game.type,
      status: game.status,
      hostId: game.hostId,
      participants: game.participants,
      result: game.result,
    });
  } catch (error: any) {
    return res.status(404).json({
      error: error.message || 'Game not found',
    });
  }
});

/**
 * POST /api/games/:id/join
 * Join a game
 */
router.post('/api/games/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);

    const game = joinGame(req.params.id, agentId);

    return res.json({
      gameId: game.id,
      status: game.status,
      participants: game.participants,
    });
  } catch (error: any) {
    return res.status(400).json({
      error: error.message || 'Failed to join game',
    });
  }
});

/**
 * POST /api/games/:id/move
 * Make a move in a game
 */
router.post('/api/games/:id/move', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { move } = makeMoveSchema.parse(req.body);

    const game = makeMove(req.params.id, agentId, move);

    return res.json({
      gameId: game.id,
      status: game.status,
      result: game.result,
    });
  } catch (error: any) {
    return res.status(400).json({
      error: error.message || 'Failed to make move',
    });
  }
});

/**
 * GET /api/games/room/:roomId
 * Get active games in a room
 */
router.get('/api/games/room/:roomId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    validateToken(token);

    const games = getActiveGamesInRoom(req.params.roomId);

    return res.json({
      games: games.map((game) => ({
        gameId: game.id,
        type: game.type,
        status: game.status,
        hostId: game.hostId,
        participants: game.participants,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Failed to fetch games',
    });
  }
});

export default router;
