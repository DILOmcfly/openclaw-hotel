import { describe, it, expect } from 'vitest';
import { 
  hashPassword, 
  verifyPassword, 
  setRoomVisibility,
  validateRoomAccess,
  isRoomFull,
  type RoomVisibility 
} from '../services/roomPrivacy.js';

describe('Room Privacy Service', () => {
  describe('Password Hashing', () => {
    it('should hash passwords consistently', () => {
      const password = 'test123';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('should produce different hashes for different passwords', () => {
      const hash1 = hashPassword('password1');
      const hash2 = hashPassword('password2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct passwords', () => {
      const password = 'mySecret123';
      const hash = hashPassword(password);
      
      expect(verifyPassword(password, hash)).toBe(true);
      expect(verifyPassword('wrongPassword', hash)).toBe(false);
    });
  });

  describe('Room Visibility (unit logic)', () => {
    it('should validate visibility types', () => {
      const validTypes: RoomVisibility[] = ['public', 'private', 'password'];
      
      validTypes.forEach(type => {
        expect(['public', 'private', 'password']).toContain(type);
      });
    });

    it('should require password for password-protected visibility', async () => {
      // Mock sql object
      const mockSql: any = () => Promise.resolve([]);

      await expect(
        setRoomVisibility('room-id', 'password', mockSql)
      ).rejects.toThrow('Password required');
    });
  });

  describe('Access Validation Logic', () => {
    it('should allow owner access to private rooms', async () => {
      const ownerId = 'owner-123';
      const roomId = 'room-456';
      
      // Mock sql that returns a private room owned by ownerId
      const mockSql: any = () => Promise.resolve([{
        visibility: 'private',
        password_hash: null,
        created_by: ownerId
      }]);

      const result = await validateRoomAccess(roomId, ownerId, mockSql);
      
      expect(result.allowed).toBe(true);
    });

    it('should deny non-owner access to private rooms', async () => {
      const ownerId = 'owner-123';
      const otherId = 'other-456';
      const roomId = 'room-789';
      
      const mockSql: any = () => Promise.resolve([{
        visibility: 'private',
        password_hash: null,
        created_by: ownerId
      }]);

      const result = await validateRoomAccess(roomId, otherId, mockSql);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('This room is private');
    });

    it('should allow access to public rooms', async () => {
      const anyId = 'agent-123';
      const roomId = 'room-public';
      
      const mockSql: any = () => Promise.resolve([{
        visibility: 'public',
        password_hash: null,
        created_by: 'someone-else'
      }]);

      const result = await validateRoomAccess(roomId, anyId, mockSql);
      
      expect(result.allowed).toBe(true);
    });

    it('should validate password for password-protected rooms', async () => {
      const agentId = 'agent-123';
      const roomId = 'room-pwd';
      const password = 'secret123';
      const hash = hashPassword(password);
      
      const mockSql: any = () => Promise.resolve([{
        visibility: 'password',
        password_hash: hash,
        created_by: 'owner-999'
      }]);

      // Correct password
      const correctResult = await validateRoomAccess(roomId, agentId, mockSql, password);
      expect(correctResult.allowed).toBe(true);

      // Incorrect password
      const wrongResult = await validateRoomAccess(roomId, agentId, mockSql, 'wrongpass');
      expect(wrongResult.allowed).toBe(false);
      expect(wrongResult.reason).toBe('Incorrect password');
    });

    it('should require password for password-protected rooms', async () => {
      const agentId = 'agent-123';
      const roomId = 'room-pwd';
      const hash = hashPassword('somepass');
      
      const mockSql: any = () => Promise.resolve([{
        visibility: 'password',
        password_hash: hash,
        created_by: 'owner-999'
      }]);

      // No password provided
      const result = await validateRoomAccess(roomId, agentId, mockSql);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Password required');
    });
  });

  describe('Room Capacity Logic', () => {
    it('should detect when room is full', async () => {
      const roomId = 'room-full';
      
      // Mock sql: first call returns max_occupants=5, second returns count=5
      let callCount = 0;
      const mockSql: any = () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ max_occupants: 5 }]);
        } else {
          return Promise.resolve([{ count: 5 }]);
        }
      };

      const isFull = await isRoomFull(roomId, mockSql);
      
      expect(isFull).toBe(true);
    });

    it('should detect when room has space', async () => {
      const roomId = 'room-space';
      
      let callCount = 0;
      const mockSql: any = () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ max_occupants: 10 }]);
        } else {
          return Promise.resolve([{ count: 3 }]);
        }
      };

      const isFull = await isRoomFull(roomId, mockSql);
      
      expect(isFull).toBe(false);
    });

    it('should treat non-existent room as full', async () => {
      const mockSql: any = () => Promise.resolve([]);

      const isFull = await isRoomFull('non-existent', mockSql);
      
      expect(isFull).toBe(true);
    });
  });
});
