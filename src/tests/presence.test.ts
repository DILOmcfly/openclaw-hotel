/**
 * Test suite for presence service
 * Core room presence system (join, leave, position tracking)
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import postgres from 'postgres';
import {
  getOccupants,
  joinRoom,
  leaveRoom,
  getAgentRoom,
  updatePosition,
} from '../services/presence.js';

// Test database configuration
const TEST_DB_USER = process.env.TEST_DB_USER || 'openclaw';
const TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'openclaw';
const TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
const TEST_DB_PORT = parseInt(process.env.TEST_DB_PORT || '5432', 10);

// Test database connection
const sql = postgres({
  host: TEST_DB_HOST,
  port: TEST_DB_PORT,
  database: 'openclaw_hotel_test',
  username: TEST_DB_USER,
  password: TEST_DB_PASSWORD,
  max: 1,
});

describe.skip('Presence Service', () => {
  let testAgentId: string;
  let testRoomId: string;

  beforeEach(async () => {

    // Create test agent
    const agentRows = await sql`
      INSERT INTO agents (id, display_name, platform, public_key, credits)
      VALUES (gen_random_uuid(), 'Test Agent', 'custom', 'test-public-key', 1000)
      RETURNING id
    `;
    testAgentId = agentRows[0].id;

    // Create test room
    const roomRows = await sql`
      INSERT INTO rooms (id, name, owner_id, max_occupants)
      VALUES (gen_random_uuid(), 'Test Room', ${testAgentId}::uuid, 10)
      RETURNING id
    `;
    testRoomId = roomRows[0].id;
  });

  afterAll(async () => {
    await sql.end();
  });

  describe('getOccupants', () => {
    it('should return empty array for empty room', async () => {
      const occupants = await getOccupants(testRoomId, sql);
      expect(occupants).toEqual([]);
    });

    it('should return all agents in room with positions', async () => {
      // Add agents to presence
      await sql`
        INSERT INTO presence (agent_id, room_id, x, y, rotation)
        VALUES (${testAgentId}::uuid, ${testRoomId}::uuid, 5, 10, 90)
      `;

      const occupants = await getOccupants(testRoomId, sql);
      
      expect(occupants).toHaveLength(1);
      expect(occupants[0]).toMatchObject({
        agentId: testAgentId,
        displayName: 'Test Agent',
        x: 5,
        y: 10,
        rotation: 90,
      });
    });

    it('should return agents ordered by joined_at', async () => {
      // Create second agent
      const agent2Rows = await sql`
        INSERT INTO agents (id, display_name, platform, public_key)
        VALUES (gen_random_uuid(), 'Second Agent', 'custom', 'key2')
        RETURNING id
      `;
      const agent2Id = agent2Rows[0].id;

      // Insert with 1 second delay
      await sql`
        INSERT INTO presence (agent_id, room_id, x, y, joined_at)
        VALUES 
          (${testAgentId}::uuid, ${testRoomId}::uuid, 0, 0, NOW()),
          (${agent2Id}::uuid, ${testRoomId}::uuid, 1, 1, NOW() + INTERVAL '1 second')
      `;

      const occupants = await getOccupants(testRoomId, sql);
      
      expect(occupants).toHaveLength(2);
      expect(occupants[0].agentId).toBe(testAgentId);
      expect(occupants[1].agentId).toBe(agent2Id);
    });
  });

  describe('joinRoom', () => {
    it('should successfully add agent to room', async () => {
      const result = await joinRoom(testAgentId, testRoomId, 5, 10, sql);

      expect(result.position).toEqual({ x: 5, y: 10 });
      expect(result.occupants).toHaveLength(1);
      expect(result.occupants[0]).toMatchObject({
        agentId: testAgentId,
        x: 5,
        y: 10,
      });
    });

    it('should throw error for non-existent room', async () => {
      const fakeRoomId = '00000000-0000-0000-0000-000000000000';
      
      await expect(
        joinRoom(testAgentId, fakeRoomId, 0, 0, sql)
      ).rejects.toThrow('Room not found');
    });

    it('should throw error when room is full', async () => {
      // Create room with max_occupants = 1
      const fullRoomRows = await sql`
        INSERT INTO rooms (id, name, owner_id, max_occupants)
        VALUES (gen_random_uuid(), 'Full Room', ${testAgentId}::uuid, 1)
        RETURNING id
      `;
      const fullRoomId = fullRoomRows[0].id;

      // Create second agent
      const agent2Rows = await sql`
        INSERT INTO agents (id, display_name, platform, public_key)
        VALUES (gen_random_uuid(), 'Second Agent', 'custom', 'key2')
        RETURNING id
      `;
      const agent2Id = agent2Rows[0].id;

      // First agent joins successfully
      await joinRoom(testAgentId, fullRoomId, 0, 0, sql);

      // Second agent should fail
      await expect(
        joinRoom(agent2Id, fullRoomId, 1, 1, sql)
      ).rejects.toThrow('Room is full');
    });

    it('should upsert if agent already in room (update position)', async () => {
      // Join first time
      await joinRoom(testAgentId, testRoomId, 5, 5, sql);

      // Join again with new position (should update)
      const result = await joinRoom(testAgentId, testRoomId, 10, 10, sql);

      expect(result.position).toEqual({ x: 10, y: 10 });
      expect(result.occupants).toHaveLength(1);
    });

    it('should create audit log entry', async () => {
      await joinRoom(testAgentId, testRoomId, 3, 7, sql);

      const logs = await sql`
        SELECT event_type, agent_id, room_id, details
        FROM audit_log
        WHERE event_type = 'room.join'
          AND agent_id = ${testAgentId}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `;

      expect(logs).toHaveLength(1);
      expect(logs[0].event_type).toBe('room.join');
      expect(logs[0].details).toEqual({ x: 3, y: 7 });
    });
  });

  describe('leaveRoom', () => {
    beforeEach(async () => {
      // Setup: agent in room
      await joinRoom(testAgentId, testRoomId, 0, 0, sql);
    });

    it('should remove agent from presence table', async () => {
      await leaveRoom(testAgentId, testRoomId, sql);

      const occupants = await getOccupants(testRoomId, sql);
      expect(occupants).toHaveLength(0);
    });

    it('should create audit log entry', async () => {
      await leaveRoom(testAgentId, testRoomId, sql);

      const logs = await sql`
        SELECT event_type, agent_id, room_id
        FROM audit_log
        WHERE event_type = 'room.leave'
          AND agent_id = ${testAgentId}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `;

      expect(logs).toHaveLength(1);
      expect(logs[0].event_type).toBe('room.leave');
    });

    it('should not throw if agent not in room', async () => {
      // Leave twice
      await leaveRoom(testAgentId, testRoomId, sql);
      
      // Should not throw
      await expect(
        leaveRoom(testAgentId, testRoomId, sql)
      ).resolves.not.toThrow();
    });
  });

  describe('getAgentRoom', () => {
    it('should return null if agent not in any room', async () => {
      const roomId = await getAgentRoom(testAgentId, sql);
      expect(roomId).toBeNull();
    });

    it('should return room id if agent in room', async () => {
      await joinRoom(testAgentId, testRoomId, 0, 0, sql);

      const roomId = await getAgentRoom(testAgentId, sql);
      expect(roomId).toBe(testRoomId);
    });

    it('should return most recent room if agent in multiple rooms', async () => {
      // Create second room
      const room2Rows = await sql`
        INSERT INTO rooms (id, name, owner_id)
        VALUES (gen_random_uuid(), 'Room 2', ${testAgentId}::uuid)
        RETURNING id
      `;
      const room2Id = room2Rows[0].id;

      // Join first room
      await sql`
        INSERT INTO presence (agent_id, room_id, x, y, joined_at)
        VALUES (${testAgentId}::uuid, ${testRoomId}::uuid, 0, 0, NOW())
      `;

      // Join second room later
      await sql`
        INSERT INTO presence (agent_id, room_id, x, y, joined_at)
        VALUES (${testAgentId}::uuid, ${room2Id}::uuid, 0, 0, NOW() + INTERVAL '1 second')
      `;

      const roomId = await getAgentRoom(testAgentId, sql);
      expect(roomId).toBe(room2Id);
    });
  });

  describe('updatePosition', () => {
    beforeEach(async () => {
      // Setup: agent in room
      await joinRoom(testAgentId, testRoomId, 0, 0, sql);
    });

    it('should update agent position in room', async () => {
      await updatePosition(testAgentId, testRoomId, 5, 10, 180, sql);

      const occupants = await getOccupants(testRoomId, sql);
      expect(occupants[0]).toMatchObject({
        x: 5,
        y: 10,
        rotation: 180,
      });
    });

    it('should not throw if agent not in room', async () => {
      // Remove agent first
      await leaveRoom(testAgentId, testRoomId, sql);

      // Should not throw (UPDATE with 0 rows affected)
      await expect(
        updatePosition(testAgentId, testRoomId, 5, 5, 0, sql)
      ).resolves.not.toThrow();
    });

    it('should not affect other agents in room', async () => {
      // Add second agent
      const agent2Rows = await sql`
        INSERT INTO agents (id, display_name, platform, public_key)
        VALUES (gen_random_uuid(), 'Agent 2', 'custom', 'key2')
        RETURNING id
      `;
      const agent2Id = agent2Rows[0].id;
      await joinRoom(agent2Id, testRoomId, 3, 3, sql);

      // Update first agent
      await updatePosition(testAgentId, testRoomId, 10, 10, 90, sql);

      const occupants = await getOccupants(testRoomId, sql);
      expect(occupants).toHaveLength(2);
      
      // First agent updated
      const agent1 = occupants.find(o => o.agentId === testAgentId);
      expect(agent1).toMatchObject({ x: 10, y: 10, rotation: 90 });

      // Second agent unchanged
      const agent2 = occupants.find(o => o.agentId === agent2Id);
      expect(agent2).toMatchObject({ x: 3, y: 3, rotation: 0 });
    });
  });
});
