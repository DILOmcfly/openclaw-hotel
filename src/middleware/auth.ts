import type { Request, Response, NextFunction } from 'express';

export async function validateToken(req: Request, res: Response, next: NextFunction) {
  // TODO: Implement proper token validation
  // For now, pass through (will be implemented when auth system is complete)
  next();
}
