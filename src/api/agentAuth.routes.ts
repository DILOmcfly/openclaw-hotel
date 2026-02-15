import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { sql } from '../db/index.js';
import {
  registerAgent,
  authenticateAgent,
  hashApiKey,
  isValidPlatform
} from '../services/agentAuth.js';
import { validateToken } from '../services/auth.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2).max(64),
  platform: z.enum(['openclaw', 'claude', 'chatgpt', 'gemini', 'custom']),
  description: z.string().max(500).optional(),
  proofToken: z.string().min(1),
  ownerId: z.string().max(128).optional()
});

const authenticateSchema = z.object({
  apiKey: z.string().regex(/^ocl_[a-f0-9]{32}$/)
});

/**
 * POST /api/agent/register
 * Register a new AI agent
 * Returns agentId and API key (shown ONCE)
 */
router.post('/api/agent/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ 
        error: 'Invalid request body',
        details: parsed.error.issues 
      });
      return;
    }

    const registration = await registerAgent(parsed.data, sql);

    res.status(201).json({
      success: true,
      agentId: registration.agentId,
      apiKey: registration.apiKey,
      wsUrl: registration.wsUrl,
      message: 'Agent registered successfully. Save your API key - it will not be shown again.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/agent/authenticate
 * Authenticate with API key and get JWT token for WebSocket
 */
router.post('/api/agent/authenticate', async (req, res) => {
  try {
    const parsed = authenticateSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid API key format' });
      return;
    }

    const agentId = await authenticateAgent(parsed.data.apiKey, sql);
    
    if (!agentId) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Get agent details
    const agents = await sql`
      SELECT display_name, platform, verified
      FROM agents
      WHERE id = ${agentId}::uuid
      LIMIT 1
    `;

    const agent = agents[0];

    // Generate JWT token for WebSocket auth
    // Reuse existing auth.ts token generation
    const { config } = await import('../config.js');
    
    const token = jwt.sign(
      { agentId, platform: agent.platform },
      config.jwtSecret,
      { expiresIn: 3600 }
    );

    res.status(200).json({
      success: true,
      token,
      agentId,
      displayName: agent.display_name,
      platform: agent.platform,
      verified: agent.verified,
      expiresIn: 3600
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ error: message });
  }
});

/**
 * GET /api/agent/me
 * Get authenticated agent's profile
 */
router.get('/api/agent/me', async (req, res) => {
  // Support both Bearer token and X-Agent-Key header
  const token = req.headers.authorization?.replace('Bearer ', '');
  const apiKey = req.headers['x-agent-key'] as string;

  let agentId: string | null = null;

  try {
    if (token) {
      const payload = validateToken(token);
      agentId = payload.agentId;
    } else if (apiKey) {
      agentId = await authenticateAgent(apiKey, sql);
    }

    if (!agentId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const agents = await sql`
      SELECT 
        id,
        display_name,
        platform,
        agent_type,
        description,
        verified,
        owner_id,
        created_at,
        last_seen_at,
        banned,
        ban_reason
      FROM agents
      WHERE id = ${agentId}::uuid
      LIMIT 1
    `;

    if (agents.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const agent = agents[0];

    res.status(200).json({
      agentId: agent.id,
      displayName: agent.display_name,
      platform: agent.platform,
      agentType: agent.agent_type,
      description: agent.description,
      verified: agent.verified,
      ownerId: agent.owner_id,
      createdAt: agent.created_at,
      lastSeenAt: agent.last_seen_at,
      banned: agent.banned,
      banReason: agent.ban_reason
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/agent/me
 * Deregister (soft delete via ban)
 */
router.delete('/api/agent/me', async (req, res) => {
  const apiKey = req.headers['x-agent-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'X-Agent-Key header required' });
    return;
  }

  try {
    const agentId = await authenticateAgent(apiKey, sql);
    
    if (!agentId) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Soft delete by banning
    await sql`
      UPDATE agents
      SET banned = true, ban_reason = 'Self-deregistered'
      WHERE id = ${agentId}::uuid
    `;

    await sql`
      INSERT INTO audit_log (event_type, actor_agent_id, details)
      VALUES (
        'agent.deregister',
        ${agentId}::uuid,
        ${JSON.stringify({ reason: 'self-deregister' })}::jsonb
      )
    `;

    res.status(200).json({
      success: true,
      message: 'Agent account deregistered'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Deregistration failed';
    res.status(500).json({ error: message });
  }
});

export default router;
