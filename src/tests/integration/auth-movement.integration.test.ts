/**
 * Integration Tests: Auth & Movement Flow
 * 
 * Tests authentication and basic agent movement:
 * - Register new agent
 * - Login and get JWT token
 * - Join room
 * - Move within room
 * - Leave room
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql, isDatabaseAvailable } from './setup.js';
import * as agentAuthService from '../../services/agentAuth.js';
import * as authService from '../../services/auth.js';
import * as roomsService from '../../services/rooms.js';
import { nanoid } from 'nanoid';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: Auth & Movement Flow', () => {
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
    // Clean up test agents created during tests (keep seed data)
    await sql`
      DELETE FROM agent_appearance WHERE agent_id NOT IN ('test-agent-1', 'test-agent-2')
    `;
    await sql`
      DELETE FROM agent_balances WHERE agent_id NOT IN ('test-agent-1', 'test-agent-2')
    `;
    await sql`
      DELETE FROM agent_profiles WHERE agent_id NOT IN ('test-agent-1', 'test-agent-2')
    `;
    await sql`
      DELETE FROM agents WHERE id NOT IN ('test-agent-1', 'test-agent-2')
    `;
  });

  describe('Register → Login → Join → Move → Leave', () => {
    it('should complete full auth flow: register → login → token validation', async () => {
      const agentId = `auth-test-${nanoid(8)}`;
      const agentName = 'MovementTestAgent';

      // Step 1: Register agent
      const registration = await agentAuthService.registerAgent(
        {
          agentId,
          name: agentName,
          platform: 'test',
          agentType: 'basic',
          publicKey: 'test-key-123',
          proof: 'test-proof-456',
        },
        sql
      );

      expect(registration).toBeDefined();
      expect(registration.apiKey).toMatch(/^ock_[A-Za-z0-9]{32}$/);
      expect(registration.agentId).toBe(agentId);

      // Step 2: Authenticate with API key
      const authResult = await agentAuthService.authenticateAgent(
        registration.apiKey,
        sql
      );

      expect(authResult).toBeDefined();
      expect(authResult.agentId).toBe(agentId);
      expect(authResult.name).toBe(agentName);

      // Step 3: Generate JWT token
      const token = authService.signToken({ agentId, name: agentName });
      expect(token).toBeDefined();

      // Step 4: Validate token
      const decoded = authService.validateToken(token);
      expect(decoded.agentId).toBe(agentId);
      expect(decoded.name).toBe(agentName);

      // Verify agent profile auto-created
      const [profile] = await sql`
        SELECT agent_id FROM agent_profiles WHERE agent_id = ${agentId}
      `;
      expect(profile).toBeDefined();

      // Verify agent balance auto-created (500 starter coins)
      const [balance] = await sql`
        SELECT coins FROM agent_balances WHERE agent_id = ${agentId}
      `;
      expect(balance.coins).toBe(500);
    });

    it('should join room and update position', async () => {
      const agentId = 'test-agent-1';
      const roomId = 'test-room-1';

      // Join room
      const joined = await roomsService.joinRoom(roomId, agentId, sql);
      expect(joined.currentOccupants).toBeGreaterThan(0);

      // Record agent position in room
      await sql`
        INSERT INTO agent_positions (agent_id, room_id, x, y, z, facing)
        VALUES (${agentId}, ${roomId}, 5, 5, 0, 'south')
        ON CONFLICT (agent_id) DO UPDATE
        SET room_id = ${roomId}, x = 5, y = 5, z = 0, facing = 'south'
      `;

      // Verify position recorded
      const [position] = await sql`
        SELECT agent_id, room_id, x, y, facing
        FROM agent_positions
        WHERE agent_id = ${agentId}
      `;

      expect(position).toBeDefined();
      expect(position.room_id).toBe(roomId);
      expect(position.x).toBe(5);
      expect(position.y).toBe(5);
    });

    it('should move agent within room', async () => {
      const agentId = 'test-agent-2';
      const roomId = 'test-room-1';

      // Join and set initial position
      await roomsService.joinRoom(roomId, agentId, sql);
      await sql`
        INSERT INTO agent_positions (agent_id, room_id, x, y, z, facing)
        VALUES (${agentId}, ${roomId}, 3, 3, 0, 'north')
        ON CONFLICT (agent_id) DO UPDATE
        SET room_id = ${roomId}, x = 3, y = 3, z = 0, facing = 'north'
      `;

      // Move to new position
      await sql`
        UPDATE agent_positions
        SET x = 7, y = 8, facing = 'east'
        WHERE agent_id = ${agentId}
      `;

      // Verify new position
      const [newPosition] = await sql`
        SELECT x, y, facing FROM agent_positions WHERE agent_id = ${agentId}
      `;

      expect(newPosition.x).toBe(7);
      expect(newPosition.y).toBe(8);
      expect(newPosition.facing).toBe('east');
    });

    it('should leave room and clear position', async () => {
      const agentId = 'test-agent-1';
      const roomId = 'test-room-1';

      // Join room
      await roomsService.joinRoom(roomId, agentId, sql);

      // Get occupant count
      const [beforeLeave] = await sql`
        SELECT current_occupants FROM rooms WHERE id = ${roomId}
      `;

      // Leave room
      await roomsService.leaveRoom(roomId, agentId, sql);

      // Verify occupant count decreased
      const [afterLeave] = await sql`
        SELECT current_occupants FROM rooms WHERE id = ${roomId}
      `;

      expect(afterLeave.current_occupants).toBe(beforeLeave.current_occupants - 1);

      // Clear position
      await sql`
        UPDATE agent_positions SET room_id = NULL WHERE agent_id = ${agentId}
      `;

      const [position] = await sql`
        SELECT room_id FROM agent_positions WHERE agent_id = ${agentId}
      `;

      expect(position?.room_id).toBeNull();
    });

    it('should handle multiple agents in same room', async () => {
      const agent1 = 'test-agent-1';
      const agent2 = 'test-agent-2';
      const roomId = 'test-room-1';

      // Both join room
      await roomsService.joinRoom(roomId, agent1, sql);
      await roomsService.joinRoom(roomId, agent2, sql);

      // Verify both have positions
      await sql`
        INSERT INTO agent_positions (agent_id, room_id, x, y, z, facing)
        VALUES 
          (${agent1}, ${roomId}, 2, 2, 0, 'north'),
          (${agent2}, ${roomId}, 8, 8, 0, 'south')
        ON CONFLICT (agent_id) DO UPDATE
        SET room_id = EXCLUDED.room_id, x = EXCLUDED.x, y = EXCLUDED.y, facing = EXCLUDED.facing
      `;

      const positions = await sql`
        SELECT agent_id, x, y FROM agent_positions WHERE room_id = ${roomId}
      `;

      expect(positions).toHaveLength(2);
      expect(positions.some(p => p.agent_id === agent1 && p.x === 2)).toBe(true);
      expect(positions.some(p => p.agent_id === agent2 && p.x === 8)).toBe(true);

      // Verify occupant count
      const [room] = await sql`
        SELECT current_occupants FROM rooms WHERE id = ${roomId}
      `;

      expect(room.current_occupants).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should reject duplicate agent registration', async () => {
      const agentId = `duplicate-${nanoid(8)}`;

      // First registration
      await agentAuthService.registerAgent(
        {
          agentId,
          name: 'FirstAgent',
          platform: 'test',
          agentType: 'basic',
          publicKey: 'key1',
          proof: 'proof1',
        },
        sql
      );

      // Duplicate registration
      await expect(
        agentAuthService.registerAgent(
          {
            agentId,
            name: 'DuplicateAgent',
            platform: 'test',
            agentType: 'basic',
            publicKey: 'key2',
            proof: 'proof2',
          },
          sql
        )
      ).rejects.toThrow(/already registered/i);
    });

    it('should reject invalid JWT token', () => {
      const invalidToken = 'invalid.jwt.token';

      expect(() => authService.validateToken(invalidToken)).toThrow();
    });

    it('should prevent agent from exceeding room capacity', async () => {
      const ownerId = 'test-agent-1';
      const room = await roomsService.createRoom(
        {
          name: 'Capacity Test',
          ownerId,
          category: 'public',
          visibility: 'public',
          maxOccupants: 1,
        },
        sql
      );

      // First join (OK)
      await roomsService.joinRoom(room.id, ownerId, sql);

      // Second join (should fail)
      await expect(
        roomsService.joinRoom(room.id, 'test-agent-2', sql)
      ).rejects.toThrow(/room is full/i);
    });
  });
});
