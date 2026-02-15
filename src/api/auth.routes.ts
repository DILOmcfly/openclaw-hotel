import { Router } from 'express';
import { z } from 'zod';
import { createChallenge, registerAgent, verifyChallenge } from '../services/auth.js';
import { sql } from '../db/index.js';
import { redisClient } from '../services/redis.js';

const router = Router();

// Get raw Redis client for auth operations
const redis = redisClient.getClient();

const registerSchema = z.object({
  publicKey: z.string(),
  displayName: z.string(),
  proof: z.string(),
  timestamp: z.string()
});

const challengeSchema = z.object({
  publicKey: z.string()
});

const verifySchema = z.object({
  publicKey: z.string(),
  challenge: z.string(),
  signature: z.string()
});

router.post('/api/v1/agents/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const { publicKey, displayName, proof, timestamp } = parsed.data;

  try {
    const { agentId } = await registerAgent(publicKey, displayName, proof, timestamp, sql);
    res.status(201).json({ agentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';

    if (message.toLowerCase().includes('already registered')) {
      res.status(409).json({ error: message });
      return;
    }

    if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('signature')) {
      res.status(401).json({ error: message });
      return;
    }

    res.status(400).json({ error: message });
  }
});

router.post('/api/v1/auth/challenge', async (req, res) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const { challenge, expiresIn } = await createChallenge(parsed.data.publicKey, redis);
    res.status(200).json({ challenge, expiresIn });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Challenge creation failed';
    res.status(400).json({ error: message });
  }
});

router.post('/api/v1/auth/verify', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const { publicKey, challenge, signature } = parsed.data;

  try {
    const { token, expiresAt } = await verifyChallenge(publicKey, challenge, signature, sql, redis);
    res.status(200).json({ token, expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    res.status(400).json({ error: message });
  }
});

/**
 * Logout endpoint
 * JWTs are stateless, so logout is client-side (delete token).
 * This endpoint exists for API consistency and future blacklist support.
 */
router.post('/api/v1/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);
  
  try {
    // Future: Add token to Redis blacklist with remaining TTL
    // For now, client-side deletion is sufficient for stateless JWT
    
    res.status(200).json({ message: 'Logged out successfully. Client should delete token.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logout failed';
    res.status(400).json({ error: message });
  }
});

export default router;
