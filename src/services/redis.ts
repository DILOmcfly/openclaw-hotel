import Redis from 'ioredis';

/**
 * Redis client for session storage and caching
 * Uses connection pooling for production scalability
 */
class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('[Redis] Connected to Redis server');
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
      console.log('[Redis] Connection closed');
    });
  }

  /**
   * Store session data with TTL
   * @param sessionId - Unique session identifier
   * @param agentId - Agent ID
   * @param ttlSeconds - Time to live in seconds (default 30 days)
   */
  async setSession(sessionId: string, agentId: string, ttlSeconds: number = 30 * 24 * 60 * 60): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    
    const key = `session:${sessionId}`;
    const value = JSON.stringify({ agentId, createdAt: Date.now() });
    
    await this.client.setex(key, ttlSeconds, value);
  }

  /**
   * Retrieve session data
   * @param sessionId - Session identifier
   * @returns Agent ID if session exists, null otherwise
   */
  async getSession(sessionId: string): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    
    const key = `session:${sessionId}`;
    const value = await this.client.get(key);
    
    if (!value) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(value);
      return parsed.agentId;
    } catch (err) {
      console.error('[Redis] Invalid session data:', err);
      return null;
    }
  }

  /**
   * Delete session (logout)
   * @param sessionId - Session identifier
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    
    const key = `session:${sessionId}`;
    await this.client.del(key);
  }

  /**
   * Extend session TTL (on activity)
   * @param sessionId - Session identifier
   * @param ttlSeconds - New TTL in seconds
   */
  async extendSession(sessionId: string, ttlSeconds: number = 30 * 24 * 60 * 60): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    
    const key = `session:${sessionId}`;
    const result = await this.client.expire(key, ttlSeconds);
    return result === 1;
  }

  /**
   * Check if Redis is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Close Redis connection (for graceful shutdown)
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Get raw Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.client;
  }
}

// Singleton instance
export const redisClient = new RedisClient();
