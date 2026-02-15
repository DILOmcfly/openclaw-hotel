import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { resetMetrics, incMetric } from '../services/metrics.js';

describe('Monitoring Routes', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('GET /metrics', () => {
    it('returns current metrics', async () => {
      const res = await request(app).get('/metrics');
      
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        connectedAgents: 0,
        activeRooms: 0,
        totalMessages: 0,
        totalTrades: 0,
        totalConnections: 0,
        messagesPerSecond: 0,
        tradesPerHour: 0,
      });
    });

    it('returns updated metrics after increments', async () => {
      incMetric('connectedAgents');
      incMetric('connectedAgents');
      incMetric('activeRooms');
      incMetric('totalMessages');
      
      const res = await request(app).get('/metrics');
      
      expect(res.status).toBe(200);
      expect(res.body.connectedAgents).toBe(2);
      expect(res.body.activeRooms).toBe(1);
      expect(res.body.totalMessages).toBe(1);
    });
  });

  describe('GET /metrics/history', () => {
    it('returns historical metrics array', async () => {
      const res = await request(app).get('/metrics/history');
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('historical entries have correct structure', async () => {
      // Add some metrics
      incMetric('connectedAgents');
      incMetric('totalMessages');
      
      const res = await request(app).get('/metrics/history');
      
      expect(res.status).toBe(200);
      
      // Historical data might be empty if no snapshot taken yet
      if (res.body.length > 0) {
        const entry = res.body[0];
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('connectedAgents');
        expect(entry).toHaveProperty('activeRooms');
        expect(entry).toHaveProperty('messagesPerSecond');
        expect(entry).toHaveProperty('tradesPerHour');
        expect(typeof entry.timestamp).toBe('number');
      }
    });
  });

  describe('GET /monitoring', () => {
    it('returns monitoring dashboard HTML', async () => {
      const res = await request(app).get('/monitoring');
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('Real-time Monitoring');
      expect(res.text).toContain('Chart.js');
    });

    it('dashboard includes all metric sections', async () => {
      const res = await request(app).get('/monitoring');
      
      expect(res.text).toContain('Connected Agents');
      expect(res.text).toContain('Active Rooms');
      expect(res.text).toContain('Messages/Second');
      expect(res.text).toContain('Trades/Hour');
    });

    it('dashboard includes chart canvases', async () => {
      const res = await request(app).get('/monitoring');
      
      expect(res.text).toContain('agentsChart');
      expect(res.text).toContain('roomsChart');
      expect(res.text).toContain('messagesChart');
      expect(res.text).toContain('tradesChart');
    });

    it('dashboard loads Chart.js from CDN', async () => {
      const res = await request(app).get('/monitoring');
      
      expect(res.text).toContain('chart.js');
      expect(res.text).toContain('cdn.jsdelivr.net');
    });
  });

  describe('GET /health', () => {
    it('returns health status', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
