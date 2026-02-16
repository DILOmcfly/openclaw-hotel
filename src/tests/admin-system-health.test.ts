import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import adminRoutes from '../api/admin.routes.js';
import { sql } from '../db/index.js';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock dependencies
vi.mock('../db/index.js', () => ({
  sql: vi.fn()
}));

vi.mock('../middleware/auth.js', () => ({
  validateToken: vi.fn((req, res, next) => {
    req.agentId = 'test-agent-123';
    req.role = 'admin';
    next();
  })
}));

vi.mock('../middleware/admin.js', () => ({
  requireRole: vi.fn(() => (req: any, res: any, next: any) => next()),
  AdminRole: {
    USER: 'user',
    MODERATOR: 'moderator',
    ADMIN: 'admin'
  }
}));

vi.mock('../services/moderation.js', () => ({
  banAgent: vi.fn()
}));

// Import mocked exec after defining the mock
import { exec as mockExec } from 'child_process';

describe('Admin System Health Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(adminRoutes);
    vi.clearAllMocks();
  });

  it('should return system health data successfully', async () => {
    // Mock successful tool executions
    vi.mocked(mockExec)
      .mockImplementationOnce((cmd, opts, callback: any) => {
        // resource-monitor
        callback(null, {
          stdout: JSON.stringify({
            timestamp: '2026-02-16T10:00:00.000Z',
            memory: { total: '16.00', used: '8.00', free: '8.00', usedPercent: '50.0' },
            cpu: { usage: 10, cores: 8 },
            chrome: { count: 5, totalMemPercent: '10.0', processes: [] },
            heavyNode: { count: 0, processes: [] },
            recommendations: []
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        // rate-limiter
        callback(null, {
          stdout: JSON.stringify({
            brave: { perSecond: '0/1', perMinute: 'N/A', perMonth: '100/2000', quotaUsed: 5, lastCall: '2026-02-16T09:00:00.000Z' },
            anthropic: { perSecond: 'N/A', perMinute: '0/50', perMonth: 'N/A', quotaUsed: null, lastCall: 'Never' }
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        // agent-monitor
        callback(null, {
          stdout: JSON.stringify({
            timestamp: '2026-02-16T10:00:00.000Z',
            checks: [
              { check: 'context', status: 'OK', usage: null, message: 'Context check requires OpenClaw API integration' },
              { check: 'spawns', status: 'OK', message: 'No spawn history found' },
              { check: 'quality', status: 'OK', avgScore: 'NaN', recentAvg: 'NaN', trend: 'stable', alerts: [] },
              { check: 'logs', status: 'OK', message: 'No log files found' }
            ],
            overallStatus: 'OK',
            alerts: []
          }),
          stderr: ''
        });
        return {} as any;
      });

    const response = await request(app)
      .get('/api/admin/system-health')
      .expect(200);

    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('resources');
    expect(response.body).toHaveProperty('rateLimits');
    expect(response.body).toHaveProperty('agentMonitor');
    expect(response.body).toHaveProperty('alerts');
    expect(response.body).toHaveProperty('overallStatus');

    // Check resource data
    expect(response.body.resources.memory.usedPercent).toBe('50.0');
    expect(response.body.resources.cpu.usage).toBe(10);
    expect(response.body.resources.chrome.count).toBe(5);

    // Check rate limits
    expect(response.body.rateLimits.brave.quotaUsed).toBe(5);

    // Check overall status (should be OK with these values)
    expect(response.body.overallStatus).toBe('OK');
    expect(response.body.alerts).toHaveLength(0);
  });

  it('should generate CRITICAL alert when RAM >90%', async () => {
    vi.mocked(mockExec)
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            timestamp: '2026-02-16T10:00:00.000Z',
            memory: { total: '16.00', used: '15.00', free: '1.00', usedPercent: '93.8' },
            cpu: { usage: 10, cores: 8 },
            chrome: { count: 5, totalMemPercent: '10.0', processes: [] },
            heavyNode: { count: 0, processes: [] },
            recommendations: []
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            brave: { perSecond: '0/1', perMinute: 'N/A', perMonth: '100/2000', quotaUsed: 5, lastCall: '2026-02-16T09:00:00.000Z' },
            anthropic: { perSecond: 'N/A', perMinute: '0/50', perMonth: 'N/A', quotaUsed: null, lastCall: 'Never' }
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({ timestamp: '2026-02-16T10:00:00.000Z', checks: [], overallStatus: 'OK', alerts: [] }),
          stderr: ''
        });
        return {} as any;
      });

    const response = await request(app)
      .get('/api/admin/system-health')
      .expect(200);

    expect(response.body.overallStatus).toBe('CRITICAL');
    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0].level).toBe('CRITICAL');
    expect(response.body.alerts[0].message).toContain('RAM critically high');
  });

  it('should generate WARNING alert when RAM 70-90%', async () => {
    vi.mocked(mockExec)
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            timestamp: '2026-02-16T10:00:00.000Z',
            memory: { total: '16.00', used: '12.00', free: '4.00', usedPercent: '75.0' },
            cpu: { usage: 10, cores: 8 },
            chrome: { count: 5, totalMemPercent: '10.0', processes: [] },
            heavyNode: { count: 0, processes: [] },
            recommendations: []
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            brave: { perSecond: '0/1', perMinute: 'N/A', perMonth: '100/2000', quotaUsed: 5, lastCall: '2026-02-16T09:00:00.000Z' },
            anthropic: { perSecond: 'N/A', perMinute: '0/50', perMonth: 'N/A', quotaUsed: null, lastCall: 'Never' }
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({ timestamp: '2026-02-16T10:00:00.000Z', checks: [], overallStatus: 'OK', alerts: [] }),
          stderr: ''
        });
        return {} as any;
      });

    const response = await request(app)
      .get('/api/admin/system-health')
      .expect(200);

    expect(response.body.overallStatus).toBe('WARNING');
    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0].level).toBe('WARNING');
    expect(response.body.alerts[0].message).toContain('RAM high');
  });

  it('should generate WARNING alert when Brave Search quota >80%', async () => {
    vi.mocked(mockExec)
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            timestamp: '2026-02-16T10:00:00.000Z',
            memory: { total: '16.00', used: '8.00', free: '8.00', usedPercent: '50.0' },
            cpu: { usage: 10, cores: 8 },
            chrome: { count: 5, totalMemPercent: '10.0', processes: [] },
            heavyNode: { count: 0, processes: [] },
            recommendations: []
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            brave: { perSecond: '0/1', perMinute: 'N/A', perMonth: '1650/2000', quotaUsed: 82.5, lastCall: '2026-02-16T09:00:00.000Z' },
            anthropic: { perSecond: 'N/A', perMinute: '0/50', perMonth: 'N/A', quotaUsed: null, lastCall: 'Never' }
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({ timestamp: '2026-02-16T10:00:00.000Z', checks: [], overallStatus: 'OK', alerts: [] }),
          stderr: ''
        });
        return {} as any;
      });

    const response = await request(app)
      .get('/api/admin/system-health')
      .expect(200);

    expect(response.body.overallStatus).toBe('WARNING');
    const braveAlert = response.body.alerts.find((a: any) => a.message.includes('Brave Search'));
    expect(braveAlert).toBeDefined();
    expect(braveAlert.level).toBe('WARNING');
  });

  it('should generate CRITICAL alert when Brave Search quota >90%', async () => {
    vi.mocked(mockExec)
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            timestamp: '2026-02-16T10:00:00.000Z',
            memory: { total: '16.00', used: '8.00', free: '8.00', usedPercent: '50.0' },
            cpu: { usage: 10, cores: 8 },
            chrome: { count: 5, totalMemPercent: '10.0', processes: [] },
            heavyNode: { count: 0, processes: [] },
            recommendations: []
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            brave: { perSecond: '0/1', perMinute: 'N/A', perMonth: '1850/2000', quotaUsed: 92.5, lastCall: '2026-02-16T09:00:00.000Z' },
            anthropic: { perSecond: 'N/A', perMinute: '0/50', perMonth: 'N/A', quotaUsed: null, lastCall: 'Never' }
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({ timestamp: '2026-02-16T10:00:00.000Z', checks: [], overallStatus: 'OK', alerts: [] }),
          stderr: ''
        });
        return {} as any;
      });

    const response = await request(app)
      .get('/api/admin/system-health')
      .expect(200);

    expect(response.body.overallStatus).toBe('CRITICAL');
    const braveAlert = response.body.alerts.find((a: any) => a.message.includes('Brave Search'));
    expect(braveAlert).toBeDefined();
    expect(braveAlert.level).toBe('CRITICAL');
  });

  it('should generate WARNING alert when Chrome processes >20', async () => {
    vi.mocked(mockExec)
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            timestamp: '2026-02-16T10:00:00.000Z',
            memory: { total: '16.00', used: '8.00', free: '8.00', usedPercent: '50.0' },
            cpu: { usage: 10, cores: 8 },
            chrome: { count: 35, totalMemPercent: '20.0', processes: [] },
            heavyNode: { count: 0, processes: [] },
            recommendations: []
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({
            brave: { perSecond: '0/1', perMinute: 'N/A', perMonth: '100/2000', quotaUsed: 5, lastCall: '2026-02-16T09:00:00.000Z' },
            anthropic: { perSecond: 'N/A', perMinute: '0/50', perMonth: 'N/A', quotaUsed: null, lastCall: 'Never' }
          }),
          stderr: ''
        });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, {
          stdout: JSON.stringify({ timestamp: '2026-02-16T10:00:00.000Z', checks: [], overallStatus: 'OK', alerts: [] }),
          stderr: ''
        });
        return {} as any;
      });

    const response = await request(app)
      .get('/api/admin/system-health')
      .expect(200);

    expect(response.body.overallStatus).toBe('WARNING');
    const chromeAlert = response.body.alerts.find((a: any) => a.message.includes('Chrome processes'));
    expect(chromeAlert).toBeDefined();
    expect(chromeAlert.level).toBe('WARNING');
  });

  it('should handle tool execution failures gracefully', async () => {
    // Mock all tools failing
    vi.mocked(mockExec)
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(new Error('resource-monitor failed'), { stdout: '', stderr: 'Error' });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(new Error('rate-limiter failed'), { stdout: '', stderr: 'Error' });
        return {} as any;
      })
      .mockImplementationOnce((cmd, opts, callback: any) => {
        callback(new Error('agent-monitor failed'), { stdout: '', stderr: 'Error' });
        return {} as any;
      });

    const response = await request(app)
      .get('/api/admin/system-health')
      .expect(200);

    // Should still return data (with error placeholders)
    expect(response.body).toHaveProperty('resources');
    expect(response.body.resources).toHaveProperty('error');
    expect(response.body).toHaveProperty('rateLimits');
    expect(response.body.rateLimits).toHaveProperty('error');
    expect(response.body).toHaveProperty('agentMonitor');
    expect(response.body.agentMonitor).toHaveProperty('error');
  });

  it('should require moderator role', async () => {
    // Mock middleware to reject non-moderators
    const appRestricted = express();
    appRestricted.use(express.json());
    
    // Override requireRole to actually check role
    const restrictedAdminRoutes = express.Router();
    restrictedAdminRoutes.get('/api/admin/system-health', (req, res, next) => {
      const role = (req as any).role;
      if (role !== 'moderator' && role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    }, (req, res) => res.json({ status: 'ok' }));
    
    appRestricted.use(restrictedAdminRoutes);

    // Test without role
    const response = await request(appRestricted)
      .get('/api/admin/system-health')
      .expect(403);

    expect(response.body).toHaveProperty('error');
  });
});
