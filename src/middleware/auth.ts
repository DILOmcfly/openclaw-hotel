import type { Request, Response, NextFunction } from 'express';
import { validateToken as verifyJWT } from '../services/auth.js';
import { sql } from '../db/index.js';

/**
 * Extend Express Request to include agent info
 */
declare global {
  namespace Express {
    interface Request {
      agent?: {
        id: string;
        publicKey: string;
        displayName: string;
        role?: string;
        banned: boolean;
      };
    }
  }
}

/**
 * JWT validation middleware
 * Extracts token from Authorization header, validates, and loads agent data
 */
export async function validateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Check for Bearer token
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT signature and extract payload
    const { agentId, publicKey } = verifyJWT(token);

    // Load agent from database
    const agents = await sql`
      SELECT id, display_name, role, banned, ban_reason
      FROM agents
      WHERE id = ${agentId}::uuid
      LIMIT 1
    `;

    if (agents.length === 0) {
      res.status(401).json({ error: 'Agent not found' });
      return;
    }

    const agent = agents[0];

    // Check if banned
    if (agent.banned) {
      res.status(403).json({
        error: 'Account banned',
        reason: agent.ban_reason || 'No reason provided'
      });
      return;
    }

    // Attach agent info to request
    req.agent = {
      id: String(agent.id),
      publicKey,
      displayName: agent.display_name,
      role: agent.role || undefined,
      banned: false
    };

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token validation failed';
    res.status(401).json({ error: message });
  }
}
