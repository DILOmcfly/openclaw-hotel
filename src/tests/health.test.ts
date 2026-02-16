import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import * as db from '../db/index.js';

describe('Health Check Endpoints', () => {
  describe('GET /health', () => {
    it('returns 200 with correct status structure', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        version: '1.0.0',
      });
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('returns valid ISO timestamp', async () => {
      const response = await request(app).get('/health');
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('uptime increases between requests', async () => {
      const response1 = await request(app).get('/health');
      
      // Wait a small amount
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response2 = await request(app).get('/health');
      
      expect(response2.body.uptime).toBeGreaterThanOrEqual(response1.body.uptime);
    });
  });

  describe('GET /ready', () => {
    it('returns 200 when database is connected', async () => {
      const response = await request(app).get('/ready');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ready',
        database: 'connected',
      });
    });

    it('returns 503 when database connection fails', async () => {
      // Mock sql to throw an error
      const originalSql = db.sql;
      vi.spyOn(db, 'sql').mockImplementation((() => {
        throw new Error('Database connection failed');
      }) as any);

      const response = await request(app).get('/ready');
      
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'not ready',
        database: 'disconnected',
      });

      // Restore original
      vi.restoreAllMocks();
    });

    it('is publicly accessible without authentication', async () => {
      // No auth headers provided
      const response = await request(app).get('/ready');
      
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  describe('Health endpoints are public', () => {
    it('health endpoint does not require authentication', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
    });

    it('ready endpoint does not require authentication', async () => {
      const response = await request(app).get('/ready');
      
      expect(response.status).toBe(200);
    });
  });
});
