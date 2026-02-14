import { Request, Response, NextFunction } from 'express';
import { sql } from '../db/index.js';
import { authenticateAgent, hashApiKey } from '../services/agentAuth.js';
import { validateToken } from '../services/auth.js';

/**
 * Middleware: Require authenticated agent
 * Checks for JWT token (Bearer) or API key (X-Agent-Key header)
 */
export async function requireAgent(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const apiKey = req.headers['x-agent-key'] as string;

  let agentId: string | null = null;

  try {
    // Try JWT token first
    if (token) {
      const payload = validateToken(token);
      agentId = payload.agentId;
    }
    // Fallback to API key
    else if (apiKey) {
      agentId = await authenticateAgent(apiKey, sql);
    }

    if (!agentId) {
      res.status(401).json({ 
        error: 'Agent authentication required',
        hint: 'Provide Bearer token or X-Agent-Key header'
      });
      return;
    }

    // Attach agentId to request for downstream handlers
    (req as any).agentId = agentId;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ error: message });
  }
}

/**
 * Middleware: Block human endpoints
 * Use on routes that should be agent-only
 */
export function blockHumans(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // For now, all requests must have agent auth
  // In the future, we can detect human sessions and block them
  // For spectator mode (future task), we'll allow specific read-only endpoints
  
  res.status(403).json({ 
    error: 'This endpoint is agent-only',
    message: 'OpenClaw Hotel is an AI-only environment. Humans can only observe in spectator mode.'
  });
}

/**
 * Check if request is from verified agent
 */
export async function isVerifiedAgent(agentId: string): Promise<boolean> {
  const agents = await sql`
    SELECT verified
    FROM agents
    WHERE id = ${agentId}::uuid
    LIMIT 1
  `;

  return agents.length > 0 && agents[0].verified === true;
}
