/**
 * Unit tests for economy.routes.ts
 * Tests: GET /api/economy/balance, POST /api/economy/daily, GET /api/economy/balance/:agentId
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks (hoisted by vitest) ────────────────────────────────────────────────

vi.mock('../services/auth.js', () => ({
  validateToken: vi.fn().mockReturnValue({ agentId: 'agent-123', publicKey: 'pk-abc' }),
}));

vi.mock('../db/index.js', () => ({
  sql: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/economy.js', () => ({
  getBalance: vi.fn(),
  grantDailyBonus: vi.fn(),
  canClaimDailyBonus: vi.fn(),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import { validateToken } from '../services/auth.js';
import * as economyService from '../services/economy.js';
import economyRouter from '../api/economy.routes.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(economyRouter);
  return app;
}

const VALID_TOKEN = 'Bearer valid-jwt-token';
const AGENT_ID = 'agent-123';

const mockBalance = {
  agentId: AGENT_ID,
  coins: 750,
  lastDailyClaim: new Date('2024-01-15T10:00:00Z'),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Economy Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default validateToken behaviour
    vi.mocked(validateToken).mockReturnValue({ agentId: AGENT_ID, publicKey: 'pk-abc' });
    app = createApp();
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('GET /api/economy/balance', () => {
    it('returns 200 with balance data for authenticated agent', async () => {
      vi.mocked(economyService.getBalance).mockResolvedValueOnce(mockBalance);
      vi.mocked(economyService.canClaimDailyBonus).mockReturnValueOnce(true);

      const res = await request(app)
        .get('/api/economy/balance')
        .set('Authorization', VALID_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        coins: 750,
        canClaimDaily: true,
      });
      expect(res.body).toHaveProperty('lastDailyClaim');
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/economy/balance');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns error when token is empty string after Bearer', async () => {
      const res = await request(app)
        .get('/api/economy/balance')
        .set('Authorization', 'Bearer ');

      // Empty token causes auth to fail — exact status depends on middleware implementation
      expect([401, 500]).toContain(res.status);
    });

    it('returns 500 when economy service throws', async () => {
      vi.mocked(economyService.getBalance).mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .get('/api/economy/balance')
        .set('Authorization', VALID_TOKEN);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch balance' });
    });

    it('passes agentId extracted from token to getBalance', async () => {
      vi.mocked(economyService.getBalance).mockResolvedValueOnce(mockBalance);
      vi.mocked(economyService.canClaimDailyBonus).mockReturnValueOnce(false);

      await request(app)
        .get('/api/economy/balance')
        .set('Authorization', VALID_TOKEN);

      expect(economyService.getBalance).toHaveBeenCalledWith(AGENT_ID, expect.anything());
    });

    it('includes canClaimDaily: false when bonus already claimed', async () => {
      vi.mocked(economyService.getBalance).mockResolvedValueOnce(mockBalance);
      vi.mocked(economyService.canClaimDailyBonus).mockReturnValueOnce(false);

      const res = await request(app)
        .get('/api/economy/balance')
        .set('Authorization', VALID_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.canClaimDaily).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('POST /api/economy/daily', () => {
    it('returns 200 with success payload on first daily claim', async () => {
      const updatedBalance = { ...mockBalance, coins: 850 };
      vi.mocked(economyService.grantDailyBonus).mockResolvedValueOnce(updatedBalance);

      const res = await request(app)
        .post('/api/economy/daily')
        .set('Authorization', VALID_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        coins: 850,
        bonusAmount: 100,
        message: 'Daily bonus claimed! +100 coins',
      });
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(app).post('/api/economy/daily');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when service throws (e.g. already claimed)', async () => {
      vi.mocked(economyService.grantDailyBonus).mockRejectedValueOnce(
        new Error('Daily bonus already claimed today')
      );

      const res = await request(app)
        .post('/api/economy/daily')
        .set('Authorization', VALID_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Daily bonus already claimed today' });
    });

    it('returns 400 with generic message when non-Error is thrown', async () => {
      vi.mocked(economyService.grantDailyBonus).mockRejectedValueOnce('unexpected string error');

      const res = await request(app)
        .post('/api/economy/daily')
        .set('Authorization', VALID_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Failed to claim daily bonus' });
    });

    it('calls grantDailyBonus with the correct agentId', async () => {
      vi.mocked(economyService.grantDailyBonus).mockResolvedValueOnce(mockBalance);

      await request(app)
        .post('/api/economy/daily')
        .set('Authorization', VALID_TOKEN);

      expect(economyService.grantDailyBonus).toHaveBeenCalledWith(AGENT_ID, expect.anything());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe('GET /api/economy/balance/:agentId', () => {
    it('returns 200 with public balance data for any agentId', async () => {
      vi.mocked(economyService.getBalance).mockResolvedValueOnce(mockBalance);

      const res = await request(app).get('/api/economy/balance/agent-123');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        agentId: AGENT_ID,
        coins: 750,
      });
      // Should not expose lastDailyClaim or canClaimDaily in public endpoint
      expect(res.body).not.toHaveProperty('lastDailyClaim');
      expect(res.body).not.toHaveProperty('canClaimDaily');
    });

    it('does not require authentication', async () => {
      vi.mocked(economyService.getBalance).mockResolvedValueOnce(mockBalance);

      // No Authorization header — should still return 200
      const res = await request(app).get('/api/economy/balance/agent-456');

      expect(res.status).toBe(200);
    });

    it('passes the :agentId param to getBalance', async () => {
      vi.mocked(economyService.getBalance).mockResolvedValueOnce(mockBalance);

      await request(app).get('/api/economy/balance/target-agent-999');

      expect(economyService.getBalance).toHaveBeenCalledWith('target-agent-999', expect.anything());
    });

    it('returns 500 when economy service throws', async () => {
      vi.mocked(economyService.getBalance).mockRejectedValueOnce(new Error('Not found'));

      const res = await request(app).get('/api/economy/balance/missing-agent');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to fetch balance' });
    });
  });
});
