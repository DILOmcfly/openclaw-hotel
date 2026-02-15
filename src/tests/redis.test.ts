import { describe, it, expect, vi, beforeEach } from 'vitest';

// Store event handlers
const eventHandlers: Record<string, Function> = {};

// Create shared mock client
const mockRedisClient = {
  setex: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn((event, callback) => {
    eventHandlers[event] = callback;
    // Immediately trigger connect event synchronously for tests
    if (event === 'connect') {
      callback();
    }
  }),
};

// Mock ioredis before importing RedisClient
vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      setex = mockRedisClient.setex;
      get = mockRedisClient.get;
      del = mockRedisClient.del;
      expire = mockRedisClient.expire;
      quit = mockRedisClient.quit;
      on = mockRedisClient.on;
    },
  };
});

describe('RedisClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set session with TTL', async () => {
    const { redisClient } = await import('../services/redis.js');
    
    await redisClient.setSession('sess_123', 'agent_456', 3600);
    
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      'session:sess_123',
      3600,
      expect.stringContaining('agent_456')
    );
  });

  it('should get session and return agentId', async () => {
    const sessionData = JSON.stringify({ agentId: 'agent_789', createdAt: Date.now() });
    mockRedisClient.get.mockResolvedValue(sessionData);
    
    const { redisClient } = await import('../services/redis.js');
    const agentId = await redisClient.getSession('sess_123');
    
    expect(agentId).toBe('agent_789');
    expect(mockRedisClient.get).toHaveBeenCalledWith('session:sess_123');
  });

  it('should return null for non-existent session', async () => {
    mockRedisClient.get.mockResolvedValue(null);
    
    const { redisClient } = await import('../services/redis.js');
    const agentId = await redisClient.getSession('sess_nonexistent');
    
    expect(agentId).toBeNull();
  });

  it('should delete session on logout', async () => {
    const { redisClient } = await import('../services/redis.js');
    
    await redisClient.deleteSession('sess_123');
    
    expect(mockRedisClient.del).toHaveBeenCalledWith('session:sess_123');
  });

  it('should extend session TTL', async () => {
    const { redisClient } = await import('../services/redis.js');
    
    const result = await redisClient.extendSession('sess_123', 7200);
    
    expect(result).toBe(true);
    expect(mockRedisClient.expire).toHaveBeenCalledWith('session:sess_123', 7200);
  });

  it('should return false if session extension fails', async () => {
    mockRedisClient.expire.mockResolvedValue(0); // Redis returns 0 if key doesn't exist
    
    const { redisClient } = await import('../services/redis.js');
    const result = await redisClient.extendSession('sess_nonexistent', 7200);
    
    expect(result).toBe(false);
  });

  it('should handle invalid JSON in session data', async () => {
    mockRedisClient.get.mockResolvedValue('invalid-json{');
    
    const { redisClient } = await import('../services/redis.js');
    const agentId = await redisClient.getSession('sess_corrupted');
    
    expect(agentId).toBeNull();
  });

  it('should use default 30-day TTL if not specified', async () => {
    const { redisClient } = await import('../services/redis.js');
    
    await redisClient.setSession('sess_123', 'agent_456');
    
    const expectedTTL = 30 * 24 * 60 * 60; // 30 days in seconds
    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      'session:sess_123',
      expectedTTL,
      expect.any(String)
    );
  });
});
