/**
 * Unit tests for src/middleware/agentOnly.ts
 * Mocks: ../services/auth.js (validateToken), ../db/index.js (sql),
 *        ../services/agentAuth.js (authenticateAgent)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../services/auth.js', () => ({
  validateToken: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  sql: vi.fn(),
}));

vi.mock('../services/agentAuth.js', () => ({
  authenticateAgent: vi.fn(),
  hashApiKey: vi.fn((k: string) => `hashed:${k}`),
}));

import { validateToken } from '../services/auth.js';
import { sql } from '../db/index.js';
import { authenticateAgent } from '../services/agentAuth.js';
import { requireAgent, blockHumans, isVerifiedAgent } from '../middleware/agentOnly.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(opts: {
  authorization?: string;
  agentKey?: string;
} = {}): Partial<Request> {
  const headers: Record<string, string> = {};
  if (opts.authorization) headers['authorization'] = opts.authorization;
  if (opts.agentKey) headers['x-agent-key'] = opts.agentKey;
  return { headers } as Partial<Request>;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ── requireAgent ──────────────────────────────────────────────────────────────

describe('middleware: requireAgent (agentOnly.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── No credentials ─────────────────────────────────────────────────────────

  it('returns 401 when no token and no api key are provided', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await requireAgent(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Agent authentication required',
      hint: 'Provide Bearer token or X-Agent-Key header',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ── JWT token path ─────────────────────────────────────────────────────────

  it('authenticates via Bearer JWT and calls next()', async () => {
    vi.mocked(validateToken).mockReturnValue({ agentId: 'jwt-agent-id', publicKey: 'pk' });

    const req = makeReq({ authorization: 'Bearer valid.jwt.token' }) as Request;
    const res = makeRes();
    const next = makeNext();

    await requireAgent(req, res, next);

    expect(validateToken).toHaveBeenCalledWith('valid.jwt.token');
    expect((req as any).agentId).toBe('jwt-agent-id');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when JWT validation throws', async () => {
    vi.mocked(validateToken).mockImplementation(() => {
      throw new Error('Invalid or expired token');
    });

    const req = makeReq({ authorization: 'Bearer bad.token' });
    const res = makeRes();
    const next = makeNext();

    await requireAgent(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('strips "Bearer " prefix before calling validateToken', async () => {
    const captured: string[] = [];
    vi.mocked(validateToken).mockImplementation((t: string) => {
      captured.push(t);
      return { agentId: 'x', publicKey: 'y' };
    });

    await requireAgent(
      makeReq({ authorization: 'Bearer actual-token' }) as Request,
      makeRes(),
      makeNext()
    );

    expect(captured[0]).toBe('actual-token');
  });

  // ── API key path ───────────────────────────────────────────────────────────

  it('authenticates via X-Agent-Key header and calls next()', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue('api-key-agent-id');

    const req = makeReq({ agentKey: 'ocl_testapikey' }) as Request;
    const res = makeRes();
    const next = makeNext();

    await requireAgent(req, res, next);

    expect(authenticateAgent).toHaveBeenCalledWith('ocl_testapikey', sql);
    expect((req as any).agentId).toBe('api-key-agent-id');
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when API key is invalid (authenticateAgent returns null)', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue(null);

    const req = makeReq({ agentKey: 'ocl_badkey' });
    const res = makeRes();
    const next = makeNext();

    await requireAgent(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Agent authentication required',
      hint: 'Provide Bearer token or X-Agent-Key header',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when authenticateAgent throws (e.g. banned agent)', async () => {
    vi.mocked(authenticateAgent).mockRejectedValue(new Error('Agent account is banned'));

    const req = makeReq({ agentKey: 'ocl_bannedkey' });
    const res = makeRes();
    const next = makeNext();

    await requireAgent(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Agent account is banned' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with generic message when a non-Error is thrown', async () => {
    vi.mocked(authenticateAgent).mockRejectedValue('unexpected string error');

    const req = makeReq({ agentKey: 'ocl_somekey' });
    const res = makeRes();
    const next = makeNext();

    await requireAgent(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
  });

  // ── Token priority ─────────────────────────────────────────────────────────

  it('prefers JWT token over API key when both are present', async () => {
    vi.mocked(validateToken).mockReturnValue({ agentId: 'from-jwt', publicKey: 'pk' });

    const req = makeReq({
      authorization: 'Bearer jwt.token',
      agentKey: 'ocl_apikey',
    }) as Request;
    const res = makeRes();
    const next = makeNext();

    await requireAgent(req, res, next);

    expect(validateToken).toHaveBeenCalled();
    expect(authenticateAgent).not.toHaveBeenCalled();
    expect((req as any).agentId).toBe('from-jwt');
  });
});

// ── blockHumans ───────────────────────────────────────────────────────────────

describe('middleware: blockHumans (agentOnly.ts)', () => {
  it('always returns 403 with agent-only message', () => {
    const req = {} as Request;
    const res = makeRes();
    const next = makeNext();

    blockHumans(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'This endpoint is agent-only',
      message: 'OpenClaw Hotel is an AI-only environment. Humans can only observe in spectator mode.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('never calls next()', () => {
    const next = makeNext();
    blockHumans({} as Request, makeRes(), next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── isVerifiedAgent ───────────────────────────────────────────────────────────

describe('isVerifiedAgent (agentOnly.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for a verified agent', async () => {
    vi.mocked(sql).mockResolvedValue([{ verified: true }] as any);

    const result = await isVerifiedAgent('uuid-verified');

    expect(result).toBe(true);
  });

  it('returns false when agent.verified is false', async () => {
    vi.mocked(sql).mockResolvedValue([{ verified: false }] as any);

    const result = await isVerifiedAgent('uuid-unverified');

    expect(result).toBe(false);
  });

  it('returns false when agent is not found in DB', async () => {
    vi.mocked(sql).mockResolvedValue([] as any);

    const result = await isVerifiedAgent('uuid-missing');

    expect(result).toBe(false);
  });
});
