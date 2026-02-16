import IORedis from 'ioredis';
const Redis = IORedis as any;
type RedisType = any;

/**
 * In-memory fallback when Redis is not available
 */
class InMemoryStore {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async expire(key: string, ttl: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + ttl * 1000;
    return 1;
  }

  async quit(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Redis client for session storage and caching
 * Falls back to in-memory store when Redis is unavailable
 */
class RedisClient {
  private client: RedisType;
  private isConnected: boolean = false;
  private useMemory: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('[Redis] No REDIS_URL — using in-memory session store');
      this.client = new InMemoryStore();
      this.isConnected = true;
      this.useMemory = true;
      return;
    }

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > 5) {
          console.warn('[Redis] Max retries reached — falling back to in-memory');
          this.client = new InMemoryStore();
          this.isConnected = true;
          this.useMemory = true;
          return null; // stop retrying
        }
        return Math.min(times * 50, 2000);
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('[Redis] Connected to Redis server');
    });

    this.client.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err.message);
      if (!this.useMemory) {
        this.isConnected = false;
      }
    });

    this.client.on('close', () => {
      if (!this.useMemory) {
        this.isConnected = false;
        console.log('[Redis] Connection closed');
      }
    });
  }

  async setSession(sessionId: string, agentId: string, ttlSeconds: number = 30 * 24 * 60 * 60): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    const key = `session:${sessionId}`;
    const value = JSON.stringify({ agentId, createdAt: Date.now() });
    await this.client.setex(key, ttlSeconds, value);
  }

  async getSession(sessionId: string): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    const key = `session:${sessionId}`;
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed.agentId;
    } catch (err) {
      console.error('[Redis] Invalid session data:', err);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isConnected) throw new Error('Redis client not connected');
    await this.client.del(`session:${sessionId}`);
  }

  async extendSession(sessionId: string, ttlSeconds: number = 30 * 24 * 60 * 60): Promise<boolean> {
    if (!this.isConnected) throw new Error('Redis client not connected');
    const result = await this.client.expire(`session:${sessionId}`, ttlSeconds);
    return result === 1;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  getClient(): RedisType {
    return this.client;
  }
}

export const redisClient = new RedisClient();
