import { describe, it, expect, vi } from 'vitest';
import * as modTools from '../services/moderationTools.js';

describe('Moderation Tools Service', () => {
  // Mock SQL client (postgres.js uses tagged template literals)
  const createMockClient = (returnValue: any) => {
    const mockFn = vi.fn().mockResolvedValue(returnValue);
    return mockFn as any;
  };

  describe('muteAgent', () => {
    it('should create a mute action with expiry time', async () => {
      const mockAction = {
        id: 'action-123',
        agent_id: 'agent-456',
        action_type: 'mute',
        reason: 'Spam',
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        moderator_id: 'mod-789',
        is_active: true,
      };

      const client = createMockClient([mockAction]);

      const result = await modTools.muteAgent('agent-456', 'mod-789', 60, 'Spam', client);

      expect(result.agent_id).toBe('agent-456');
      expect(result.action_type).toBe('mute');
      expect(result.reason).toBe('Spam');
      expect(client).toHaveBeenCalled();
    });

    it('should create a permanent mute when durationMinutes is null', async () => {
      const mockAction = {
        id: 'action-123',
        agent_id: 'agent-456',
        action_type: 'mute',
        reason: 'Severe violation',
        expires_at: null,
        moderator_id: 'mod-789',
        is_active: true,
      };

      const client = createMockClient([mockAction]);

      const result = await modTools.muteAgent('agent-456', 'mod-789', null, 'Severe violation', client);

      expect(result.expires_at).toBeNull();
    });
  });

  describe('isAgentMuted', () => {
    it('should return true for muted agent', async () => {
      const client = createMockClient([{ count: '1' }]);

      const muted = await modTools.isAgentMuted('agent-456', client);

      expect(muted).toBe(true);
    });

    it('should return false for unmuted agent', async () => {
      const client = createMockClient([{ count: '0' }]);

      const muted = await modTools.isAgentMuted('agent-789', client);

      expect(muted).toBe(false);
    });
  });

  describe('checkMessageFilters', () => {
    it('should block message with high-severity filter', async () => {
      const mockFilters = [
        {
          id: 'filter-1',
          pattern: 'badword',
          severity: 'high',
          action: 'block',
          auto_mute_duration_minutes: null,
          is_active: true,
        },
      ];

      const client = createMockClient(mockFilters);

      const result = await modTools.checkMessageFilters('this is a badword test', client);

      expect(result.blocked).toBe(true);
      expect(result.matchedFilters).toContain('badword');
    });

    it('should flag message with low-severity filter', async () => {
      const mockFilters = [
        {
          id: 'filter-2',
          pattern: 'spam',
          severity: 'low',
          action: 'flag',
          auto_mute_duration_minutes: null,
          is_active: true,
        },
      ];

      const client = createMockClient(mockFilters);

      const result = await modTools.checkMessageFilters('this is spam content', client);

      expect(result.flagged).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should auto-mute on high-severity pattern', async () => {
      const mockFilters = [
        {
          id: 'filter-3',
          pattern: 'hateful',
          severity: 'high',
          action: 'auto_mute',
          auto_mute_duration_minutes: 30,
          is_active: true,
        },
      ];

      const client = createMockClient(mockFilters);

      const result = await modTools.checkMessageFilters('hateful speech here', client);

      expect(result.autoMute).toBe(true);
      expect(result.muteDurationMinutes).toBe(30);
    });

    it('should allow message with no filter matches', async () => {
      const client = createMockClient([]);

      const result = await modTools.checkMessageFilters('this is a clean message', client);

      expect(result.blocked).toBe(false);
      expect(result.flagged).toBe(false);
      expect(result.autoMute).toBe(false);
      expect(result.matchedFilters).toHaveLength(0);
    });

    it('should handle regex patterns correctly', async () => {
      const mockFilters = [
        {
          id: 'filter-4',
          pattern: 'f[u*]ck|sh[i*]t',
          severity: 'medium',
          action: 'flag',
          auto_mute_duration_minutes: null,
          is_active: true,
        },
      ];

      const client = createMockClient(mockFilters);

      const result1 = await modTools.checkMessageFilters('what the fuck', client);
      const result2 = await modTools.checkMessageFilters('oh shit', client);
      const result3 = await modTools.checkMessageFilters('clean message', client);

      expect(result1.flagged).toBe(true);
      expect(result2.flagged).toBe(true);
      expect(result3.flagged).toBe(false);
    });
  });

  describe('addWordFilter', () => {
    it('should reject invalid regex patterns', async () => {
      const client = createMockClient([]);

      await expect(
        modTools.addWordFilter('[invalid(regex', 'high', 'block', null, 'admin-123', client)
      ).rejects.toThrow('Invalid regex pattern');
    });

    it('should create valid word filter', async () => {
      const mockFilter = {
        id: 'filter-5',
        pattern: 'test',
        severity: 'low',
        action: 'flag',
        auto_mute_duration_minutes: null,
        created_by: 'admin-123',
        is_active: true,
      };

      const client = createMockClient([mockFilter]);

      const result = await modTools.addWordFilter('test', 'low', 'flag', null, 'admin-123', client);

      expect(result.pattern).toBe('test');
      expect(result.severity).toBe('low');
      expect(result.action).toBe('flag');
    });
  });

  describe('banIP', () => {
    it('should create IP ban with expiry', async () => {
      const mockBan = {
        id: 'ban-123',
        agent_id: '00000000-0000-0000-0000-000000000000',
        action_type: 'ip_ban',
        reason: 'Multiple violations',
        ip_address: '192.168.1.100',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        moderator_id: 'admin-123',
        is_active: true,
      };

      const client = createMockClient([mockBan]);

      const result = await modTools.banIP('192.168.1.100', 'admin-123', 'Multiple violations', 1440, client);

      expect(result.ip_address).toBe('192.168.1.100');
      expect(result.action_type).toBe('ip_ban');
    });
  });

  describe('isIPBanned', () => {
    it('should return true for banned IP', async () => {
      const client = createMockClient([{ count: '1' }]);

      const banned = await modTools.isIPBanned('192.168.1.100', client);

      expect(banned).toBe(true);
    });

    it('should return false for non-banned IP', async () => {
      const client = createMockClient([{ count: '0' }]);

      const banned = await modTools.isIPBanned('10.0.0.1', client);

      expect(banned).toBe(false);
    });
  });
});
