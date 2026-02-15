import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export type AdminRole = 'user' | 'moderator' | 'admin';

/**
 * Role-based authorization middleware
 * REQUIRES: validateToken middleware must run first (sets req.agent)
 * 
 * Enforces role hierarchy: user < moderator < admin
 */
export function requireRole(minimumRole: 'moderator' | 'admin') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if agent data exists (validateToken should have set this)
      if (!req.agent) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const agentRole: AdminRole = (req.agent.role as AdminRole) || 'user';

      // Check permission hierarchy
      const roleLevel: Record<AdminRole, number> = { user: 0, moderator: 1, admin: 2 };
      
      if (roleLevel[agentRole] < roleLevel[minimumRole]) {
        logger.warn('Unauthorized admin access attempt', {
          agentId: req.agent.id,
          agentRole,
          minimumRole
        });
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Attach legacy properties for backward compatibility
      (req as any).agentId = req.agent.id;
      (req as any).agentRole = agentRole;

      next();
    } catch (error) {
      logger.error('Admin middleware error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
