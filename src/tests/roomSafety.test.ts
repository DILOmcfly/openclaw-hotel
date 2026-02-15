import { describe, it, expect } from 'vitest';
import { setRating, addWarning, removeWarning, getRating, verifyRating, reportRoom, getRoomsByRating, type SafetyRating } from '../services/roomSafety.js';

describe('Room Safety Service', () => {
  describe('setRating', () => {
    it('should set valid rating', async () => {
      const mockSql: any = () => Promise.resolve([]);
      await expect(setRating('room-1', 'mature', mockSql)).resolves.not.toThrow();
    });

    it('should reject invalid rating', async () => {
      const mockSql: any = () => Promise.resolve([]);
      await expect(setRating('room-1', 'invalid' as SafetyRating, mockSql)).rejects.toThrow('Invalid rating');
    });

    it('should accept all valid ratings', async () => {
      const mockSql: any = () => Promise.resolve([]);
      const validRatings: SafetyRating[] = ['everyone', 'teen', 'mature', 'restricted'];
      for (const rating of validRatings) {
        await expect(setRating('room-1', rating, mockSql)).resolves.not.toThrow();
      }
    });
  });

  describe('addWarning', () => {
    it('should add warning when under limit', async () => {
      const mockSql: any = () => Promise.resolve([{ content_warnings: ['warning1'] }]);
      await expect(addWarning('room-1', 'warning2', mockSql)).resolves.not.toThrow();
    });

    it('should reject empty warning', async () => {
      const mockSql: any = () => Promise.resolve([]);
      await expect(addWarning('room-1', '', mockSql)).rejects.toThrow('Warning cannot be empty');
    });

    it('should reject when at max warnings', async () => {
      const mockSql: any = () => Promise.resolve([{ content_warnings: ['w1', 'w2', 'w3', 'w4', 'w5'] }]);
      await expect(addWarning('room-1', 'w6', mockSql)).rejects.toThrow('Maximum 5 warnings allowed');
    });

    it('should reject duplicate warning', async () => {
      const mockSql: any = () => Promise.resolve([{ content_warnings: ['violence'] }]);
      await expect(addWarning('room-1', 'violence', mockSql)).rejects.toThrow('Warning already exists');
    });

    it('should add to new room with no warnings', async () => {
      const mockSql: any = () => Promise.resolve([]);
      await expect(addWarning('room-new', 'first-warning', mockSql)).resolves.not.toThrow();
    });
  });

  describe('removeWarning', () => {
    it('should remove existing warning', async () => {
      let callCount = 0;
      const mockSql: any = () => {
        callCount++;
        return callCount === 1 ? Promise.resolve([{ content_warnings: ['warning1', 'warning2'] }]) : Promise.resolve([]);
      };
      const result = await removeWarning('room-1', 'warning1', mockSql);
      expect(result).toBe(true);
    });

    it('should return false for non-existent warning', async () => {
      const mockSql: any = () => Promise.resolve([{ content_warnings: ['warning1'] }]);
      const result = await removeWarning('room-1', 'warning2', mockSql);
      expect(result).toBe(false);
    });

    it('should return false when room has no safety record', async () => {
      const mockSql: any = () => Promise.resolve([]);
      const result = await removeWarning('room-unknown', 'warning', mockSql);
      expect(result).toBe(false);
    });
  });

  describe('getRating', () => {
    it('should return rating data when exists', async () => {
      const mockSql: any = () => Promise.resolve([{
        room_id: 'room-1', rating: 'teen', content_warnings: ['language'], verified_by: 'admin-1',
        verified_at: new Date('2024-01-01'), reports_count: 2, updated_at: new Date('2024-01-15'),
      }]);
      const result = await getRating('room-1', mockSql);
      expect(result).not.toBeNull();
      expect(result?.rating).toBe('teen');
      expect(result?.contentWarnings).toEqual(['language']);
      expect(result?.reportsCount).toBe(2);
    });

    it('should return null when room has no safety record', async () => {
      const mockSql: any = () => Promise.resolve([]);
      const result = await getRating('room-unknown', mockSql);
      expect(result).toBeNull();
    });

    it('should handle empty content warnings', async () => {
      const mockSql: any = () => Promise.resolve([{
        room_id: 'room-1', rating: 'everyone', content_warnings: null, reports_count: 0, updated_at: new Date(),
      }]);
      const result = await getRating('room-1', mockSql);
      expect(result?.contentWarnings).toEqual([]);
    });
  });

  describe('verifyRating', () => {
    it('should update verification info', async () => {
      const mockSql: any = () => Promise.resolve([]);
      await expect(verifyRating('room-1', 'admin-123', mockSql)).resolves.not.toThrow();
    });
  });

  describe('reportRoom', () => {
    it('should increment report count', async () => {
      let callCount = 0;
      const mockSql: any = () => {
        callCount++;
        return callCount === 2 ? Promise.resolve([{ reports_count: 3 }]) : Promise.resolve([]);
      };
      const count = await reportRoom('room-1', mockSql);
      expect(count).toBe(3);
    });

    it('should initialize count for new room', async () => {
      let callCount = 0;
      const mockSql: any = () => {
        callCount++;
        return callCount === 2 ? Promise.resolve([{ reports_count: 1 }]) : Promise.resolve([]);
      };
      const count = await reportRoom('room-new', mockSql);
      expect(count).toBe(1);
    });
  });

  describe('getRoomsByRating', () => {
    it('should return room IDs with matching rating', async () => {
      const mockSql: any = () => Promise.resolve([{ room_id: 'room-1' }, { room_id: 'room-2' }, { room_id: 'room-3' }]);
      const rooms = await getRoomsByRating('mature', mockSql);
      expect(rooms).toHaveLength(3);
      expect(rooms).toContain('room-1');
    });

    it('should return empty array when no rooms match', async () => {
      const mockSql: any = () => Promise.resolve([]);
      const rooms = await getRoomsByRating('restricted', mockSql);
      expect(rooms).toHaveLength(0);
    });
  });
});
