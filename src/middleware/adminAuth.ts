import type { Request, Response, NextFunction } from 'express';

/**
 * Role-based authorization middleware
 * Requires validateToken middleware to run first (sets req.agent)
 */
export function requireRole(requiredRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if agent data exists (validateToken should have set this)
    if (!req.agent) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if agent has required role
    if (req.agent.role !== requiredRole) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredRole,
        current: req.agent.role || 'none'
      });
      return;
    }

    next();
  };
}

/**
 * Admin-only middleware (shorthand)
 */
export const requireAdmin = requireRole('admin');
