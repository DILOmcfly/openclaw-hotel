/**
 * Unit tests for src/middleware/adminAuth.ts
 * No external mocks needed — pure logic only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireRole, requireAdmin } from '../middleware/adminAuth.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function makeReqWithAgent(agent?: Request['agent']): Request {
  return { agent } as Request;
}

// ── requireRole ───────────────────────────────────────────────────────────────

describe('middleware: requireRole (adminAuth.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── No agent attached ──────────────────────────────────────────────────────

  it('returns 401 when req.agent is undefined (validateToken not run)', () => {
    const middleware = requireRole('admin');
    const req = makeReqWithAgent(undefined);
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  // ── Role mismatch ──────────────────────────────────────────────────────────

  it('returns 403 when agent role does not match required role', () => {
    const middleware = requireRole('admin');
    const req = makeReqWithAgent({
      id: 'uuid-1',
      publicKey: 'pk',
      displayName: 'Bob',
      role: 'user',
      banned: false,
    });
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Insufficient permissions',
      required: 'admin',
      current: 'user',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 with current: "none" when agent has no role', () => {
    const middleware = requireRole('moderator');
    const req = makeReqWithAgent({
      id: 'uuid-2',
      publicKey: 'pk',
      displayName: 'NoRoleBot',
      role: undefined,
      banned: false,
    });
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Insufficient permissions',
      required: 'moderator',
      current: 'none',
    });
  });

  it('returns 403 when a different privileged role is provided (wrong role)', () => {
    const middleware = requireRole('admin');
    const req = makeReqWithAgent({
      id: 'uuid-3',
      publicKey: 'pk',
      displayName: 'ModBot',
      role: 'moderator',
      banned: false,
    });
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Insufficient permissions',
      required: 'admin',
      current: 'moderator',
    });
  });

  // ── Role match (happy path) ────────────────────────────────────────────────

  it('calls next() when agent role matches required role', () => {
    const middleware = requireRole('admin');
    const req = makeReqWithAgent({
      id: 'uuid-4',
      publicKey: 'pk',
      displayName: 'AdminBot',
      role: 'admin',
      banned: false,
    });
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next() for a custom role match', () => {
    const middleware = requireRole('moderator');
    const req = makeReqWithAgent({
      id: 'uuid-5',
      publicKey: 'pk',
      displayName: 'ModBot',
      role: 'moderator',
      banned: false,
    });
    const res = makeRes();
    const next = makeNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  // ── Factory produces independent middleware instances ──────────────────────

  it('produces independent middleware per role call', () => {
    const adminMw = requireRole('admin');
    const modMw = requireRole('moderator');

    const adminReq = makeReqWithAgent({ id: 'a', publicKey: 'p', displayName: 'A', role: 'admin', banned: false });
    const modReq = makeReqWithAgent({ id: 'b', publicKey: 'p', displayName: 'B', role: 'moderator', banned: false });

    const adminNext = makeNext();
    const modNext = makeNext();

    adminMw(adminReq, makeRes(), adminNext);
    modMw(modReq, makeRes(), modNext);

    expect(adminNext).toHaveBeenCalled();
    expect(modNext).toHaveBeenCalled();
  });
});

// ── requireAdmin shorthand ────────────────────────────────────────────────────

describe('middleware: requireAdmin (adminAuth.ts)', () => {
  it('is a function (middleware shorthand)', () => {
    expect(typeof requireAdmin).toBe('function');
  });

  it('calls next() when agent has "admin" role', () => {
    const req = makeReqWithAgent({
      id: 'uuid-admin',
      publicKey: 'pk',
      displayName: 'AdminBot',
      role: 'admin',
      banned: false,
    });
    const res = makeRes();
    const next = makeNext();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when agent is not an admin', () => {
    const req = makeReqWithAgent({
      id: 'uuid-user',
      publicKey: 'pk',
      displayName: 'UserBot',
      role: 'user',
      banned: false,
    });
    const res = makeRes();
    const next = makeNext();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Insufficient permissions',
      required: 'admin',
      current: 'user',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.agent is missing', () => {
    const req = makeReqWithAgent(undefined);
    const res = makeRes();
    const next = makeNext();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });

  it('returns 403 with current: "none" for agent with no role', () => {
    const req = makeReqWithAgent({
      id: 'uuid-norole',
      publicKey: 'pk',
      displayName: 'NoRoleBot',
      role: undefined,
      banned: false,
    });
    const res = makeRes();
    const next = makeNext();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Insufficient permissions',
      required: 'admin',
      current: 'none',
    });
  });
});
