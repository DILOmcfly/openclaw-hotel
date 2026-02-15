import type { Request, Response, NextFunction } from 'express';

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // TODO: Implement proper role-based authorization
    // For now, pass through (will be implemented when auth system is complete)
    next();
  };
}
