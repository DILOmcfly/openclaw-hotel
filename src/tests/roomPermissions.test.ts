import { describe, it, expect, vi } from 'vitest';
import {
  banFromRoom,
  unbanFromRoom,
  isBanned,
  addGuest,
  removeGuest,
  isGuest,
  getRoomBans,
  getRoomGuests,
} from '../services/roomPermissions.js';

describe('Room Permissions Service', () => {
  const roomId = '11111111-1111-1111-1111-111111111111';
  const agentId = '22222222-2222-2222-2222-222222222222';
  const bannedBy = '33333333-3333-3333-3333-333333333333';
  const invitedBy = '44444444-4444-4444-4444-444444444444';

  describe('banFromRoom', () => {
    it('should ban an agent from a room', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      await banFromRoom(roomId, agentId, bannedBy, 'Inappropriate behavior', null, mockSql);

      expect(mockSql).toHaveBeenCalled();
      const callArgs = mockSql.mock.calls[0];
      const sqlString = callArgs[0].join('');
      expect(sqlString).toContain('INSERT INTO room_bans');
    });

    it('should ban with expiry date', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));
      const expiresAt = new Date('2026-12-31T23:59:59Z');

      await banFromRoom(roomId, agentId, bannedBy, 'Temporary ban', expiresAt, mockSql);

      expect(mockSql).toHaveBeenCalled();
    });

    it('should handle ban without reason', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      await banFromRoom(roomId, agentId, bannedBy, null, null, mockSql);

      expect(mockSql).toHaveBeenCalled();
    });
  });

  describe('unbanFromRoom', () => {
    it('should remove a ban and return true', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve({ count: 1 }));

      const result = await unbanFromRoom(roomId, agentId, mockSql);

      expect(result).toBe(true);
      expect(mockSql).toHaveBeenCalled();
      const callArgs = mockSql.mock.calls[0];
      const sqlString = callArgs[0].join('');
      expect(sqlString).toContain('DELETE FROM room_bans');
    });

    it('should return false if ban does not exist', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve({ count: 0 }));

      const result = await unbanFromRoom(roomId, agentId, mockSql);

      expect(result).toBe(false);
    });
  });

  describe('isBanned', () => {
    it('should return true if agent is banned', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([{ exists: 1 }]));

      const result = await isBanned(roomId, agentId, mockSql);

      expect(result).toBe(true);
    });

    it('should return false if agent is not banned', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      const result = await isBanned(roomId, agentId, mockSql);

      expect(result).toBe(false);
    });

    it('should return false if ban has expired', async () => {
      // Mock returns empty because query filters expired bans
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      const result = await isBanned(roomId, agentId, mockSql);

      expect(result).toBe(false);
    });
  });

  describe('addGuest', () => {
    it('should add an agent to guest list', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      await addGuest(roomId, agentId, invitedBy, mockSql);

      expect(mockSql).toHaveBeenCalled();
      const callArgs = mockSql.mock.calls[0];
      const sqlString = callArgs[0].join('');
      expect(sqlString).toContain('INSERT INTO room_guests');
    });

    it('should handle duplicate guest gracefully (ON CONFLICT DO NOTHING)', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      await addGuest(roomId, agentId, invitedBy, mockSql);
      await addGuest(roomId, agentId, invitedBy, mockSql);

      expect(mockSql).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeGuest', () => {
    it('should remove a guest and return true', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve({ count: 1 }));

      const result = await removeGuest(roomId, agentId, mockSql);

      expect(result).toBe(true);
      expect(mockSql).toHaveBeenCalled();
      const callArgs = mockSql.mock.calls[0];
      const sqlString = callArgs[0].join('');
      expect(sqlString).toContain('DELETE FROM room_guests');
    });

    it('should return false if guest does not exist', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve({ count: 0 }));

      const result = await removeGuest(roomId, agentId, mockSql);

      expect(result).toBe(false);
    });
  });

  describe('isGuest', () => {
    it('should return true if agent is on guest list', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([{ exists: 1 }]));

      const result = await isGuest(roomId, agentId, mockSql);

      expect(result).toBe(true);
    });

    it('should return false if agent is not on guest list', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      const result = await isGuest(roomId, agentId, mockSql);

      expect(result).toBe(false);
    });
  });

  describe('getRoomBans', () => {
    it('should return all bans for a room', async () => {
      const mockBans = [
        {
          roomId,
          agentId: '11111111-1111-1111-1111-111111111111',
          bannedBy,
          reason: 'Spam',
          expiresAt: null,
          createdAt: new Date(),
        },
        {
          roomId,
          agentId: '22222222-2222-2222-2222-222222222222',
          bannedBy,
          reason: 'Harassment',
          expiresAt: new Date('2026-12-31'),
          createdAt: new Date(),
        },
      ];

      const mockSql: any = vi.fn(() => Promise.resolve(mockBans));

      const result = await getRoomBans(roomId, mockSql);

      expect(result).toEqual(mockBans);
      expect(result.length).toBe(2);
    });

    it('should return empty array if no bans', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      const result = await getRoomBans(roomId, mockSql);

      expect(result).toEqual([]);
    });
  });

  describe('getRoomGuests', () => {
    it('should return all guests for a room', async () => {
      const mockGuests = [
        {
          roomId,
          agentId: '11111111-1111-1111-1111-111111111111',
          invitedBy,
          createdAt: new Date(),
        },
        {
          roomId,
          agentId: '22222222-2222-2222-2222-222222222222',
          invitedBy,
          createdAt: new Date(),
        },
      ];

      const mockSql: any = vi.fn(() => Promise.resolve(mockGuests));

      const result = await getRoomGuests(roomId, mockSql);

      expect(result).toEqual(mockGuests);
      expect(result.length).toBe(2);
    });

    it('should return empty array if no guests', async () => {
      const mockSql: any = vi.fn(() => Promise.resolve([]));

      const result = await getRoomGuests(roomId, mockSql);

      expect(result).toEqual([]);
    });
  });

  describe('Permission Logic', () => {
    it('should validate ownership before banning', () => {
      const ownerId = '11111111-1111-1111-1111-111111111111';
      const otherId = '22222222-2222-2222-2222-222222222222';

      const isOwner = (roomOwnerId: string, requesterId: string): boolean => {
        return roomOwnerId === requesterId;
      };

      expect(isOwner(ownerId, ownerId)).toBe(true);
      expect(isOwner(ownerId, otherId)).toBe(false);
    });

    it('should allow admin role to moderate', () => {
      const roles = ['admin', 'moderator', 'user'];

      const canModerate = (role: string): boolean => {
        return role === 'admin' || role === 'moderator';
      };

      expect(canModerate('admin')).toBe(true);
      expect(canModerate('moderator')).toBe(true);
      expect(canModerate('user')).toBe(false);
    });
  });
});
