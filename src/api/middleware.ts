import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { AuthTokenPayload } from '../types/domain.js';
import { AuthService } from '../services/auth.js';
import { SlidingWindowRateLimiter, type LimitConfig } from '../utils/rate-limit.js';

export interface AuthedRequest extends Request {
  agent?: AuthTokenPayload;
}

export function createAuthMiddleware(authService: AuthService) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }

    const token = header.slice('Bearer '.length);

    try {
      req.agent = authService.validateToken(token);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

export function createRateLimitMiddleware(
  limiter: SlidingWindowRateLimiter,
  config: LimitConfig,
  keyBuilder: (req: Request) => string,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyBuilder(req);
    const result = limiter.check(key, config);
    if (!result.allowed) {
      res.status(429).json({ error: 'Rate limited', retry_after_ms: result.retryAfterMs });
      return;
    }

    next();
  };
}

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
      return;
    }

    req.body = parsed.data;
    next();
  };
}
