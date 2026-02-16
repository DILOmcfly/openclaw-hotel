// @ts-nocheck - TODO: fix type errors
/**
 * Integration Tests: Rooms Flow
 * 
 * Tests the complete room lifecycle:
 * - Create room
 * - Customize layout (heightmap)
 * - Set privacy settings
 * - Join/leave room
 * - Rate/review room
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql, isDatabaseAvailable } from './setup.js';
import * as roomsService from '../../services/rooms.js';
import { nanoid } from 'nanoid';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: Rooms Flow', () => {
  beforeAll(async (ctx) => {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.log('⏭️  Skipping integration tests: PostgreSQL database not available');
      ctx.skip();
      return;
    }
    sql = await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  beforeEach(async () => {
    // Clear room-related data between tests
    await sql`DELETE FROM room_ratings WHERE room_id NOT IN ('test-room-1', 'test-room-2')`;
    await sql`DELETE FROM room_visits WHERE room_id NOT IN ('test-room-1', 'test-room-2')`;
    await sql`DELETE FROM rooms WHERE id NOT IN ('test-room-1', 'test-room-2')`;
  });

  describe('Create → Customize → Privacy → Join Flow', () => {
    it('should create a new room with default settings', async () => {
      const ownerId = 'test-agent-1';
      const roomName = 'Integration Test Room';

      // Create room
      const room = await roomsService.createRoom(
        {
          name: roomName,
          ownerId,
          category: 'public',
          visibility: 'public',
          maxOccupants: 25,
          description: 'A test room for integration testing',
        },
        sql
      );

      expect(room).toBeDefined();
      expect(room.id).toBeDefined();
      expect(room.name).toBe(roomName);
      expect(room.ownerId).toBe(ownerId);
      expect(room.category).toBe('public');
      expect(room.visibility).toBe('public');
      expect(room.maxOccupants).toBe(25);
      expect(room.currentOccupants).toBe(0);

      // Verify in database
      const [dbRoom] = await sql`
        SELECT id, name, owner_id, category, visibility, max_occupants
        FROM rooms
        WHERE id = ${room.id}
      `;

      expect(dbRoom).toBeDefined();
      expect(dbRoom.name).toBe(roomName);
    });

    it('should customize room layout (heightmap)', async () => {
      const ownerId = 'test-agent-1';
      const room = await roomsService.createRoom(
        { name: 'Custom Layout Room', ownerId, category: 'public', visibility: 'public' },
        sql
      );

      // Create valid 10x10 heightmap
      const heightmap = '0000000000|'.repeat(10).slice(0, -1); // Remove trailing |

      // Update room layout
      const updated = await roomsService.updateRoomLayout(
        room.id,
        ownerId,
        heightmap,
        sql
      );

      expect(updated.heightmap).toBe(heightmap);

      // Verify in database
      const [dbRoom] = await sql`
        SELECT heightmap FROM rooms WHERE id = ${room.id}
      `;

      expect(dbRoom.heightmap).toBe(heightmap);
    });

    it('should set room privacy settings', async () => {
      const ownerId = 'test-agent-1';
      const room = await roomsService.createRoom(
        { name: 'Privacy Test Room', ownerId, category: 'private', visibility: 'public' },
        sql
      );

      // Initially public visibility
      expect(room.visibility).toBe('public');

      // Change to private (friends-only)
      const updated = await roomsService.updateRoomPrivacy(
        room.id,
        ownerId,
        'friends',
        sql
      );

      expect(updated.visibility).toBe('friends');

      // Verify in database
      const [dbRoom] = await sql`
        SELECT visibility FROM rooms WHERE id = ${room.id}
      `;

      expect(dbRoom.visibility).toBe('friends');
    });

    it('should join room and track visit', async () => {
      const roomId = 'test-room-1'; // From seed data
      const agentId = 'test-agent-2';

      // Get initial occupants
      const [initialRoom] = await sql`
        SELECT current_occupants FROM rooms WHERE id = ${roomId}
      `;

      // Join room
      const joined = await roomsService.joinRoom(roomId, agentId, sql);

      expect(joined.currentOccupants).toBe(initialRoom.current_occupants + 1);

      // Verify visit recorded
      const [visit] = await sql`
        SELECT room_id, agent_id, visited_at
        FROM room_visits
        WHERE room_id = ${roomId} AND agent_id = ${agentId}
        ORDER BY visited_at DESC
        LIMIT 1
      `;

      expect(visit).toBeDefined();
      expect(visit.room_id).toBe(roomId);
      expect(visit.agent_id).toBe(agentId);

      // Leave room
      const left = await roomsService.leaveRoom(roomId, agentId, sql);
      expect(left.currentOccupants).toBe(initialRoom.current_occupants);
    });

    it('should rate and review room', async () => {
      const roomId = 'test-room-1';
      const agentId = 'test-agent-2';

      // Rate room (5 stars)
      const rating = await roomsService.rateRoom(
        roomId,
        agentId,
        5,
        'Amazing room!',
        sql
      );

      expect(rating).toBeDefined();
      expect(rating.roomId).toBe(roomId);
      expect(rating.agentId).toBe(agentId);
      expect(rating.rating).toBe(5);
      expect(rating.comment).toBe('Amazing room!');

      // Get room ratings
      const ratings = await roomsService.getRoomRatings(roomId, sql);

      expect(ratings).toHaveLength(1);
      expect(ratings[0].rating).toBe(5);
      expect(ratings[0].agentName).toBeDefined(); // Should include agent name

      // Get room with average rating
      const room = await roomsService.getRoom(roomId, sql);
      expect(room.averageRating).toBe(5);
      expect(room.totalRatings).toBe(1);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should reject room creation with invalid name', async () => {
      await expect(
        roomsService.createRoom(
          { name: '', ownerId: 'test-agent-1', category: 'public', visibility: 'public' },
          sql
        )
      ).rejects.toThrow(/name is required/i);
    });

    it('should reject joining room at max capacity', async () => {
      const ownerId = 'test-agent-1';
      const room = await roomsService.createRoom(
        { name: 'Full Room', ownerId, category: 'public', visibility: 'public', maxOccupants: 1 },
        sql
      );

      // First agent joins (fills capacity)
      await roomsService.joinRoom(room.id, ownerId, sql);

      // Second agent tries to join (should fail)
      await expect(
        roomsService.joinRoom(room.id, 'test-agent-2', sql)
      ).rejects.toThrow(/room is full/i);
    });

    it('should only allow owner to modify room settings', async () => {
      const ownerId = 'test-agent-1';
      const notOwner = 'test-agent-2';

      const room = await roomsService.createRoom(
        { name: 'Owner Only Room', ownerId, category: 'public', visibility: 'public' },
        sql
      );

      // Non-owner tries to change privacy (should fail)
      await expect(
        roomsService.updateRoomPrivacy(room.id, notOwner, 'private', sql)
      ).rejects.toThrow(/only the owner can modify/i);
    });

    it('should prevent rating same room twice by same agent', async () => {
      const roomId = 'test-room-1';
      const agentId = 'test-agent-2';

      // First rating
      await roomsService.rateRoom(roomId, agentId, 5, 'Great!', sql);

      // Second rating (should update, not create duplicate)
      const updated = await roomsService.rateRoom(roomId, agentId, 3, 'Changed my mind', sql);

      // Verify only one rating exists (updated)
      const ratings = await sql`
        SELECT rating, comment FROM room_ratings 
        WHERE room_id = ${roomId} AND agent_id = ${agentId}
      `;

      expect(ratings).toHaveLength(1);
      expect(ratings[0].rating).toBe(3);
      expect(ratings[0].comment).toBe('Changed my mind');
    });

    it('should reject invalid heightmap dimensions', async () => {
      const ownerId = 'test-agent-1';
      const room = await roomsService.createRoom(
        { name: 'Invalid Layout Room', ownerId, category: 'public', visibility: 'public' },
        sql
      );

      // Create invalid heightmap (too small: 5x5)
      const invalidHeightmap = '00000|'.repeat(5).slice(0, -1);

      await expect(
        roomsService.updateRoomLayout(room.id, ownerId, invalidHeightmap, sql)
      ).rejects.toThrow(/minimum room width is 10/i);
    });
  });
});
