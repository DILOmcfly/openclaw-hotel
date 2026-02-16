import { describe, it, expect, vi } from 'vitest';
import * as appearanceService from '../services/appearance.js';

describe('Appearance Service', () => {
  // Mock SQL client
  const createMockSql = (returnValue: any) => {
    const mock = vi.fn().mockResolvedValue(returnValue);
    mock.mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
      return Promise.resolve(returnValue);
    });
    // Add unsafe method for dynamic queries
    (mock as any).unsafe = vi.fn().mockResolvedValue(returnValue);
    return mock as any;
  };

  describe('validateColor', () => {
    it('should validate correct hex colors', () => {
      expect(appearanceService.validateColor('#FFD93D')).toBe(true);
      expect(appearanceService.validateColor('#000000')).toBe(true);
      expect(appearanceService.validateColor('#FFFFFF')).toBe(true);
      expect(appearanceService.validateColor('#abc123')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(appearanceService.validateColor('FFD93D')).toBe(false); // Missing #
      expect(appearanceService.validateColor('#FFF')).toBe(false); // Too short
      expect(appearanceService.validateColor('#FFFFFFF')).toBe(false); // Too long
      expect(appearanceService.validateColor('#GGGGGG')).toBe(false); // Invalid characters
      expect(appearanceService.validateColor('red')).toBe(false); // Not hex
      expect(appearanceService.validateColor('')).toBe(false); // Empty
    });
  });

  describe('getAppearance', () => {
    it('should return existing appearance for agent', async () => {
      const mockAppearance = {
        agentId: 'agent-123',
        skinColor: '#FF6B6B',
        outfit: 'casual',
        accessory: 'hat',
      };
      const sql = createMockSql([mockAppearance]);

      const appearance = await appearanceService.getAppearance('agent-123', sql);

      expect(appearance).toEqual(mockAppearance);
      expect(appearance.skinColor).toBe('#FF6B6B');
      expect(appearance.outfit).toBe('casual');
      expect(appearance.accessory).toBe('hat');
    });

    it('should create default appearance for new agent', async () => {
      const sql = createMockSql([]);
      sql.mockResolvedValueOnce([]) // First call returns empty (no existing appearance)
        .mockResolvedValueOnce([
          // Second call returns new appearance
          {
            agentId: 'agent-new',
            skinColor: '#FFD93D',
            outfit: 'default',
            accessory: 'none',
          },
        ]);

      const appearance = await appearanceService.getAppearance('agent-new', sql);

      expect(appearance.agentId).toBe('agent-new');
      expect(appearance.skinColor).toBe('#FFD93D');
      expect(appearance.outfit).toBe('default');
      expect(appearance.accessory).toBe('none');
    });
  });

  describe('updateAppearance', () => {
    it('should update skin color only', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]);
      sql.mockResolvedValueOnce([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]); // getAppearance
      sql.unsafe = vi.fn().mockResolvedValue([
        { agentId: 'agent-123', skinColor: '#FF6B6B', outfit: 'default', accessory: 'none' },
      ]);

      const appearance = await appearanceService.updateAppearance(
        'agent-123',
        { skinColor: '#FF6B6B' },
        sql
      );

      expect(appearance.skinColor).toBe('#FF6B6B');
      expect(appearance.outfit).toBe('default');
      expect(appearance.accessory).toBe('none');
    });

    it('should update outfit only', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]);
      sql.mockResolvedValueOnce([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]); // getAppearance
      sql.unsafe = vi.fn().mockResolvedValue([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'sporty', accessory: 'none' },
      ]);

      const appearance = await appearanceService.updateAppearance(
        'agent-123',
        { outfit: 'sporty' },
        sql
      );

      expect(appearance.outfit).toBe('sporty');
    });

    it('should update accessory only', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]);
      sql.mockResolvedValueOnce([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]); // getAppearance
      sql.unsafe = vi.fn().mockResolvedValue([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'glasses' },
      ]);

      const appearance = await appearanceService.updateAppearance(
        'agent-123',
        { accessory: 'glasses' },
        sql
      );

      expect(appearance.accessory).toBe('glasses');
    });

    it('should update multiple properties at once', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]);
      sql.mockResolvedValueOnce([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]); // getAppearance
      sql.unsafe = vi.fn().mockResolvedValue([
        { agentId: 'agent-123', skinColor: '#4ECDC4', outfit: 'formal', accessory: 'crown' },
      ]);

      const appearance = await appearanceService.updateAppearance(
        'agent-123',
        { skinColor: '#4ECDC4', outfit: 'formal', accessory: 'crown' },
        sql
      );

      expect(appearance.skinColor).toBe('#4ECDC4');
      expect(appearance.outfit).toBe('formal');
      expect(appearance.accessory).toBe('crown');
    });

    it('should throw error for invalid skin color', async () => {
      const sql = createMockSql([]);

      await expect(
        appearanceService.updateAppearance('agent-123', { skinColor: 'invalid' }, sql)
      ).rejects.toThrow('Invalid skin color format');
    });

    it('should throw error for invalid outfit', async () => {
      const sql = createMockSql([]);

      await expect(
        appearanceService.updateAppearance('agent-123', { outfit: 'invalid' }, sql)
      ).rejects.toThrow('Invalid outfit');
    });

    it('should throw error for invalid accessory', async () => {
      const sql = createMockSql([]);

      await expect(
        appearanceService.updateAppearance('agent-123', { accessory: 'invalid' }, sql)
      ).rejects.toThrow('Invalid accessory');
    });

    it('should accept all valid outfits', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]);
      sql.unsafe = vi.fn().mockResolvedValue([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'casual', accessory: 'none' },
      ]);

      for (const outfit of appearanceService.VALID_OUTFITS) {
        sql.mockResolvedValueOnce([
          { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
        ]);
        sql.unsafe.mockResolvedValue([
          { agentId: 'agent-123', skinColor: '#FFD93D', outfit, accessory: 'none' },
        ]);

        const appearance = await appearanceService.updateAppearance(
          'agent-123',
          { outfit },
          sql
        );
        expect(appearance.outfit).toBe(outfit);
      }
    });

    it('should accept all valid accessories', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
      ]);
      sql.unsafe = vi.fn().mockResolvedValue([
        { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'hat' },
      ]);

      for (const accessory of appearanceService.VALID_ACCESSORIES) {
        sql.mockResolvedValueOnce([
          { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory: 'none' },
        ]);
        sql.unsafe.mockResolvedValue([
          { agentId: 'agent-123', skinColor: '#FFD93D', outfit: 'default', accessory },
        ]);

        const appearance = await appearanceService.updateAppearance(
          'agent-123',
          { accessory },
          sql
        );
        expect(appearance.accessory).toBe(accessory);
      }
    });
  });
});
