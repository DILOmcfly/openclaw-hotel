/**
 * Unit tests for src/middleware/auth.ts
 * Mocks: ../services/auth.js (validateToken), ../db/index.js (sql)
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

import { validateToken as verifyJWT } from '../services/auth.js';
import { sql } from '../db/index.js';
import { validateToken } from '../middleware/auth.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('middleware: validateToken (auth.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Missing / malformed header ─────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await validateToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or invalid Authorization header',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header lacks "Bearer " prefix', async () => {
    const req = makeReq('Token abc123');
    const res = makeRes();
    const next = makeNext();

    await validateToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or invalid Authorization header',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is just "Bearer " with no token', async () => {
    const req = makeReq('Bearer ');
    const res = makeRes();
    const next = makeNext();

    // verifyJWT with empty string should throw
    vi.mocked(verifyJWT).mockImplementation(() => {
      throw new Error('Invalid or expired token');
    });

    await validateToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // ── JWT validation failures ────────────────────────────────────────────────

  it('returns 401 when JWT signature is invalid', async () => {
    vi.mocked(verifyJWT).mockImplementation(() => {
      throw new Error('Invalid or expired token');
    });

    const req = makeReq('Bearer bad.token.here');
    const res = makeRes();
    const next = makeNext();

    await validateToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with generic message when non-Error is thrown during JWT validation', async () => {
    vi.mocked(verifyJWT).mockImplementation(() => {
      throw 'string error'; // non-Error
    });

    const req = makeReq('Bearer some.token');
    const res = makeRes();
    const next = makeNext();

    await validateToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token validation failed' });
  });

  // ── DB lookup failures ─────────────────────────────────────────────────────

  it('returns 401 when agent is not found in DB', async () => {
    vi.mocked(verifyJWT).mockReturnValue({ agentId: 'uuid-123', publicKey: 'pubkey-abc' });
    vi.mocked(sql).mockResolvedValue([] as any); // no rows

    const req = makeReq('Bearer valid.token');
    const res = makeRes();
    const next = makeNext();

    await validateToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Agent not found' });
    expect(next).not.toHaveBeenCalled();
  });

  // ── Banned agents ──────────────────────────────────────────────────────────

  it('returns 403 when agent is banned (with ban reason)', async () => {
    vi.mocked(verifyJWT).mockReturnValue({ agentId: 'uuid-456', publicKey: 'pubkey-abc' });
    vi.mocked(sql).mockResolvedValue([
      { id: 'uuid-456', display_name: 'BadBot', role: null, banned: true, ban_reason: 'Spamming' },
    ] as any);

    const req = makeReq('Bearer valid.token');
    const res = makeRes();
    const next = makeNext();

    await validateToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account banned', reason: 'Spamming' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 with fallback reason when agent is banned without a ban_reason', async () => {
    vi.mocked(verifyJWT).mockReturnValue({ agentId: 'uuid-456', publicKey: 'pubkey-abc' });
    vi.mocked(sql).mockResolvedValue([
      { id: 'uuid-456', display_name: 'BadBot', role: null, banned: true, ban_reason: null },
    ] as any);

    const req = makeReq('Bearer valid.token');
    const res = makeRes();
    const next = makeNext();

    await validateToken(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Account banned',
      reason: 'No reason provided',
    });
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('calls next() and attaches req.agent for a valid, non-banned agent', async () => {
    vi.mocked(verifyJWT).mockReturnValue({ agentId: 'uuid-789', publicKey: 'pubkey-xyz' });
    vi.mocked(sql).mockResolvedValue([
      { id: 'uuid-789', display_name: 'GoodBot', role: 'admin', banned: false, ban_reason: null },
    ] as any);

    const req = makeReq('Bearer valid.token') as Request;
    const res = makeRes();
    const next = makeNext();

    await validateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.agent).toEqual({
      id: 'uuid-789',
      publicKey: 'pubkey-xyz',
      displayName: 'GoodBot',
      role: 'admin',
      banned: false,
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets req.agent.role to undefined when agent has no role in DB', async () => {
    vi.mocked(verifyJWT).mockReturnValue({ agentId: 'uuid-000', publicKey: 'pubkey-abc' });
    vi.mocked(sql).mockResolvedValue([
      { id: 'uuid-000', display_name: 'PlainBot', role: null, banned: false, ban_reason: null },
    ] as any);

    const req = makeReq('Bearer valid.token') as Request;
    const res = makeRes();
    const next = makeNext();

    await validateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.agent?.role).toBeUndefined();
  });

  it('strips exactly 7 chars ("Bearer ") from the token', async () => {
    const capturedTokens: string[] = [];
    vi.mocked(verifyJWT).mockImplementation((t: string) => {
      capturedTokens.push(t);
      return { agentId: 'x', publicKey: 'y' };
    });
    vi.mocked(sql).mockResolvedValue([
      { id: 'x', display_name: 'Bot', role: null, banned: false, ban_reason: null },
    ] as any);

    await validateToken(makeReq('Bearer my-actual-token') as Request, makeRes(), makeNext());

    expect(capturedTokens[0]).toBe('my-actual-token');
  });
});
