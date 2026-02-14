import { Request, Response, NextFunction } from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';

export type AdminRole = 'user' | 'moderator' | 'admin';

/**
 * Middleware to check if authenticated agent has required role
 */
export function requireRole(minimumRole: 'moderator' | 'admin') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { agentId } = validateToken(token);

      // Fetch agent role from database
      const result = await sql`
        SELECT role FROM agents WHERE id = ${agentId}::uuid
      `;

      if (result.length === 0) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const agentRole: AdminRole = result[0].role || 'user';

      // Check permission hierarchy
      const roleLevel = { user: 0, moderator: 1, admin: 2 };
      if (roleLevel[agentRole] < roleLevel[minimumRole]) {
        logger.warn('Unauthorized admin access attempt', { agentId, agentRole, minimumRole });
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Attach agent info to request for downstream handlers
      (req as any).agentId = agentId;
      (req as any).agentRole = agentRole;

      next();
    } catch (error) {
      logger.error('Admin middleware error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
