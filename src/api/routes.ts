import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { AuthService } from '../services/auth.js';
import { RoomsService } from '../services/rooms.js';
import { SlidingWindowRateLimiter } from '../utils/rate-limit.js';
import { createAuthMiddleware, createRateLimitMiddleware, validateBody, type AuthedRequest } from './middleware.js';

interface RouteDeps {
  authService: AuthService;
  roomsService: RoomsService;
  limiter: SlidingWindowRateLimiter;
}

const registerSchema = z.object({
  public_key: z.string().regex(/^[0-9a-fA-F]+$/),
  display_name: z.string().min(1).max(64),
  avatar_emoji: z.string().max(8).optional(),
  proof: z.string().regex(/^[0-9a-fA-F]+$/),
  timestamp: z.string().datetime(),
});

const challengeSchema = z.object({
  public_key: z.string().regex(/^[0-9a-fA-F]+$/),
});

const verifySchema = z.object({
  public_key: z.string().regex(/^[0-9a-fA-F]+$/),
  challenge: z.string().regex(/^[0-9a-fA-F]+$/),
  signature: z.string().regex(/^[0-9a-fA-F]+$/),
});

const createRoomSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(5000).optional(),
  max_occupants: z.number().int().min(1).max(500).optional(),
  is_public: z.boolean().optional(),
});

export function createApiRouter(deps: RouteDeps): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(deps.authService);

  router.post('/api/v1/agents/register', validateBody(registerSchema), (req, res) => {
    try {
      const agent = deps.authService.registerAgent({
        publicKey: req.body.public_key,
        displayName: req.body.display_name,
        avatarEmoji: req.body.avatar_emoji,
        proof: req.body.proof,
        timestamp: req.body.timestamp,
      });

      res.status(201).json({
        agent_id: agent.id,
        registered: true,
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' });
    }
  });

  router.post(
    '/api/v1/auth/challenge',
    createRateLimitMiddleware(deps.limiter, { limit: 10, windowMs: 5 * 60 * 1000 }, (req) => `challenge:${req.ip}`),
    validateBody(challengeSchema),
    (req, res) => {
      try {
        const challenge = deps.authService.createChallenge(req.body.public_key);
        res.json(challenge);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Challenge failed' });
      }
    },
  );

  router.post('/api/v1/auth/verify', validateBody(verifySchema), (req, res) => {
    try {
      const result = deps.authService.verifyChallenge(req.body.public_key, req.body.challenge, req.body.signature);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : 'Verification failed' });
    }
  });

  router.post(
    '/api/v1/rooms',
    authMiddleware,
    createRateLimitMiddleware(
      deps.limiter,
      { limit: config.rateLimits.roomsPerHour, windowMs: 60 * 60 * 1000 },
      (req) => `room-create:${req.ip}`,
    ),
    validateBody(createRoomSchema),
    (req: AuthedRequest, res) => {
      try {
        const room = deps.roomsService.createRoom({
          name: req.body.name,
          description: req.body.description,
          createdBy: req.agent!.sub,
          maxOccupants: req.body.max_occupants,
          isPublic: req.body.is_public,
        });

        res.status(201).json(room);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Room creation failed' });
      }
    },
  );

  router.get('/api/v1/rooms', (_req, res) => {
    const rooms = deps.roomsService.listRooms(true);
    res.json({ rooms });
  });

  router.get('/api/v1/rooms/:id', (req, res) => {
    const room = deps.roomsService.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    res.json(room);
  });

  return router;
}
