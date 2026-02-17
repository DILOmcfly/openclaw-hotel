/**
 * T-336: Spectator Agent Profile Endpoint Tests
 * Tests for GET /api/spectate/agents/:agentId
 * Public endpoint — no auth required
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock sql before importing routes
vi.mock('../db/index.js', () => ({
  sql: vi.fn(),
}));

vi.mock('../ws/handler.js', () => ({
  roomMembers: new Map(),
}));

vi.mock('../ws/spectator.js', () => ({
  getSpectatorCount: vi.fn().mockReturnValue(0),
  spectatorsByRoom: new Map(),
}));

vi.mock('../services/personality.js', () => ({
  getPersonality: vi.fn(),
  calculateArchetype: vi.fn().mockReturnValue('explorer'),
}));

const { sql } = await import('../db/index.js');
const { getPersonality, calculateArchetype } = await import('../services/personality.js');

// Create test app
const spectatorRoutes = await import('../api/spectator.routes.js');
const app = express();
app.use(express.json());
app.use(spectatorRoutes.default);

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const INVALID_UUID = 'not-a-uuid';

describe('T-336: GET /api/spectate/agents/:agentId', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input validation', () => {
    it('rejects invalid UUID format with 400', async () => {
      const res = await request(app).get(`/api/spectate/agents/${INVALID_UUID}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid agent ID');
    });

    it('accepts valid UUID format', async () => {
      // Mock a successful agent lookup
      (sql as any).mockResolvedValueOnce([{
        id: VALID_UUID,
        displayName: 'TestBot',
        platform: 'claude',
        createdAt: new Date().toISOString(),
        bio: 'I am a test agent',
        avatarUrl: null,
      }]);
      // Subsequent queries return empty (personality, mood, friends, activity, stats)
      (sql as any).mockResolvedValue([]);
      (getPersonality as any).mockResolvedValue(null);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.status).toBe(200);
    });

    it('returns 404 for unknown agent', async () => {
      (sql as any).mockResolvedValueOnce([]); // Empty result = agent not found
      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Agent not found');
    });
  });

  describe('Response structure', () => {
    beforeEach(() => {
      // Mock agent found
      (sql as any).mockResolvedValueOnce([{
        id: VALID_UUID,
        displayName: 'ClaudeBot',
        platform: 'claude',
        createdAt: '2026-02-01T00:00:00Z',
        bio: 'A helpful AI agent',
        avatarUrl: null,
      }]);
    });

    it('includes required fields: id, displayName, platform', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', VALID_UUID);
      expect(res.body).toHaveProperty('displayName', 'ClaudeBot');
      expect(res.body).toHaveProperty('platform', 'claude');
    });

    it('includes bio from profile', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.bio).toBe('A helpful AI agent');
    });

    it('includes mood field (null when not available)', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]); // No status record

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body).toHaveProperty('mood');
    });

    it('includes personality field (null when not available)', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.personality).toBeNull();
    });

    it('includes personality with archetype when available', async () => {
      const mockPersonality = {
        curiosity: 80, sociability: 70, generosity: 60, volatility: 30,
      };
      (getPersonality as any).mockResolvedValue(mockPersonality);
      (calculateArchetype as any).mockReturnValue('socialite');
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.personality).not.toBeNull();
      expect(res.body.personality.archetype).toBe('socialite');
      expect(res.body.personality.curiosity).toBe(80);
    });

    it('includes friends object with count and topFriends array', async () => {
      (getPersonality as any).mockResolvedValue(null);
      // mood returns empty, friends returns 2 friends
      (sql as any)
        .mockResolvedValueOnce([]) // mood
        .mockResolvedValueOnce([ // friends
          { friendId: 'friend1', friendName: 'Alice' },
          { friendId: 'friend2', friendName: 'Bob' },
        ])
        .mockResolvedValue([]); // activity, stats

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.friends).toHaveProperty('count', 2);
      expect(res.body.friends.topFriends).toHaveLength(2);
      expect(res.body.friends.topFriends[0]).toHaveProperty('name', 'Alice');
    });

    it('includes zero friends when agent has none', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]); // All empty

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.friends.count).toBe(0);
      expect(res.body.friends.topFriends).toHaveLength(0);
    });

    it('includes recentActivity array', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(Array.isArray(res.body.recentActivity)).toBe(true);
    });

    it('includes stats object', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(typeof res.body.stats).toBe('object');
    });

    it('includes createdAt timestamp', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.createdAt).toBe('2026-02-01T00:00:00Z');
    });
  });

  describe('Graceful error handling', () => {
    beforeEach(() => {
      // Always return a valid agent for these tests
      (sql as any).mockResolvedValueOnce([{
        id: VALID_UUID,
        displayName: 'ResilientBot',
        platform: 'openai',
        createdAt: '2026-02-01T00:00:00Z',
        bio: null,
        avatarUrl: null,
      }]);
    });

    it('returns 200 even when personality service throws', async () => {
      (getPersonality as any).mockRejectedValue(new Error('DB connection failed'));
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.status).toBe(200);
      expect(res.body.personality).toBeNull(); // Graceful fallback
    });

    it('returns 200 even when friends query throws', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any)
        .mockResolvedValueOnce([]) // mood
        .mockRejectedValueOnce(new Error('Friends table error')) // friends throws
        .mockResolvedValue([]); // rest

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.status).toBe(200);
      expect(res.body.friends.count).toBe(0); // Graceful fallback
    });

    it('returns 200 even when activity log query throws', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any)
        .mockResolvedValueOnce([]) // mood
        .mockResolvedValueOnce([]) // friends
        .mockRejectedValueOnce(new Error('Activity log error')) // activity throws
        .mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.status).toBe(200);
      expect(res.body.recentActivity).toHaveLength(0); // Graceful fallback
    });

    it('returns null bio when bio is null in DB', async () => {
      (getPersonality as any).mockResolvedValue(null);
      (sql as any).mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.bio).toBeNull();
    });
  });

  describe('Friends top 3 limit', () => {
    it('shows max 3 friends in topFriends even with more', async () => {
      (sql as any).mockResolvedValueOnce([{
        id: VALID_UUID, displayName: 'PopularBot',
        platform: 'claude', createdAt: '2026-02-01T00:00:00Z',
        bio: null, avatarUrl: null,
      }]);
      (getPersonality as any).mockResolvedValue(null);
      (sql as any)
        .mockResolvedValueOnce([]) // mood
        .mockResolvedValueOnce([ // 10 friends returned
          { friendId: 'f1', friendName: 'Alice' },
          { friendId: 'f2', friendName: 'Bob' },
          { friendId: 'f3', friendName: 'Carol' },
          { friendId: 'f4', friendName: 'Dave' },
          { friendId: 'f5', friendName: 'Eve' },
          { friendId: 'f6', friendName: 'Frank' },
          { friendId: 'f7', friendName: 'Grace' },
          { friendId: 'f8', friendName: 'Heidi' },
          { friendId: 'f9', friendName: 'Ivan' },
          { friendId: 'f10', friendName: 'Judy' },
        ])
        .mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.friends.count).toBe(10); // Total count is 10
      expect(res.body.friends.topFriends).toHaveLength(3); // But only 3 shown
    });
  });

  describe('Recent activity formatting', () => {
    it('includes recent activity items with type, description, timestamp', async () => {
      (sql as any).mockResolvedValueOnce([{
        id: VALID_UUID, displayName: 'ActiveBot',
        platform: 'claude', createdAt: '2026-02-01T00:00:00Z',
        bio: null, avatarUrl: null,
      }]);
      (getPersonality as any).mockResolvedValue(null);
      (sql as any)
        .mockResolvedValueOnce([]) // mood
        .mockResolvedValueOnce([]) // friends
        .mockResolvedValueOnce([ // activity logs
          {
            eventType: 'chat',
            details: { description: 'Said hello to everyone' },
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            eventType: 'trade',
            details: { description: 'Completed trade with Alice' },
            timestamp: new Date(Date.now() - 7200000).toISOString(),
          },
        ])
        .mockResolvedValue([]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);
      expect(res.body.recentActivity).toHaveLength(2);
      expect(res.body.recentActivity[0]).toHaveProperty('type', 'chat');
      expect(res.body.recentActivity[0]).toHaveProperty('description');
      expect(res.body.recentActivity[0]).toHaveProperty('timestamp');
    });
  });
});
