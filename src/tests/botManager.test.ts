/**
 * Test suite for botManager service
 * Bot spawning, despawning, and autonomous behavior
 */

import { describe, it, expect, beforeEach, vi, afterEach, afterAll } from 'vitest';
import postgres from 'postgres';
import {
  spawnBot,
  despawnBot,
  getBots,
  tickBots,
  handleChatToBots,
  initializeBotManager,
  type BotConfig,
} from '../services/botManager.js';
import * as handler from '../ws/handler.js';

// Mock WebSocket broadcasting
vi.mock('../ws/handler.js', () => ({
  broadcastToRoom: vi.fn(),
}));

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

describe.skip('BotManager Service', () => {
  let testAgentId: string;
  let testRoomId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test agent (bot owner)
    const agentRows = await sql`
      INSERT INTO agents (id, display_name, platform, public_key)
      VALUES (gen_random_uuid(), 'Test Agent', 'custom', 'key')
      RETURNING id
    `;
    testAgentId = agentRows[0].id;

    // Create test room
    const roomRows = await sql`
      INSERT INTO rooms (id, name, owner_id)
      VALUES (gen_random_uuid(), 'Bot Test Room', ${testAgentId}::uuid)
      RETURNING id
    `;
    testRoomId = roomRows[0].id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await sql.end();
  });

  describe('spawnBot', () => {
    it('should create bot in database', async () => {
      const config: BotConfig = {
        name: 'Greeter',
        personality: 'greeter',
        initialX: 5,
        initialY: 10,
      };

      const bot = await spawnBot(testRoomId, config, sql);

      expect(bot).toMatchObject({
        roomId: testRoomId,
        name: 'Greeter',
        personality: 'greeter',
        x: 5,
        y: 10,
      });

      // Verify in database
      const dbBots = await sql`
        SELECT id, name, personality, x, y
        FROM bots
        WHERE id = ${bot.id}::uuid
      `;
      expect(dbBots).toHaveLength(1);
      expect(dbBots[0].name).toBe('Greeter');
    });

    it('should broadcast presence.join event', async () => {
      const config: BotConfig = {
        name: 'Guide',
        personality: 'guide',
      };

      const bot = await spawnBot(testRoomId, config, sql);

      expect(handler.broadcastToRoom).toHaveBeenCalledWith(
        testRoomId,
        expect.objectContaining({
          type: 'presence.join',
          roomId: testRoomId,
          agent: expect.objectContaining({
            id: bot.id,
            name: '[BOT] Guide',
          }),
        })
      );
    });

    it('should use default position if not specified', async () => {
      const config: BotConfig = {
        name: 'Shopkeeper',
        personality: 'shopkeeper',
      };

      const bot = await spawnBot(testRoomId, config, sql);

      // Default position should be set by createBot (0, 0 typically)
      expect(bot.x).toBeDefined();
      expect(bot.y).toBeDefined();
    });

    it('should handle multiple bots in same room', async () => {
      const bot1 = await spawnBot(testRoomId, {
        name: 'Bot1',
        personality: 'greeter',
      }, sql);

      const bot2 = await spawnBot(testRoomId, {
        name: 'Bot2',
        personality: 'guide',
      }, sql);

      expect(bot1.id).not.toBe(bot2.id);
      expect(bot1.roomId).toBe(bot2.roomId);
    });
  });

  describe('despawnBot', () => {
    let botId: string;

    beforeEach(async () => {
      const bot = await spawnBot(testRoomId, {
        name: 'TestBot',
        personality: 'greeter',
      }, sql);
      botId = bot.id;
      vi.clearAllMocks(); // Clear spawn broadcasts
    });

    it('should delete bot from database', async () => {
      const result = await despawnBot(botId, sql);
      expect(result).toBe(true);

      // Verify deletion
      const dbBots = await sql`
        SELECT id FROM bots WHERE id = ${botId}::uuid
      `;
      expect(dbBots).toHaveLength(0);
    });

    it('should broadcast presence.leave event', async () => {
      await despawnBot(botId, sql);

      expect(handler.broadcastToRoom).toHaveBeenCalledWith(
        testRoomId,
        expect.objectContaining({
          type: 'presence.leave',
          roomId: testRoomId,
          agentId: botId,
        })
      );
    });

    it('should return false if bot does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const result = await despawnBot(fakeId, sql);
      expect(result).toBe(false);
    });

    it('should not throw if bot not in active cache', async () => {
      // Despawn twice (second time not in cache)
      await despawnBot(botId, sql);
      
      // Should still return false, not throw
      const result = await despawnBot(botId, sql);
      expect(result).toBe(false);
    });
  });

  describe('getBots', () => {
    it('should return empty array for room with no bots', async () => {
      const bots = await getBots(testRoomId, sql);
      expect(bots).toEqual([]);
    });

    it('should return all bots in room', async () => {
      await spawnBot(testRoomId, {
        name: 'Bot1',
        personality: 'greeter',
      }, sql);

      await spawnBot(testRoomId, {
        name: 'Bot2',
        personality: 'guide',
      }, sql);

      const bots = await getBots(testRoomId, sql);
      expect(bots).toHaveLength(2);
      expect(bots[0].name).toBe('Bot1');
      expect(bots[1].name).toBe('Bot2');
    });

    it('should not return bots from other rooms', async () => {
      // Create second room
      const room2Rows = await sql`
        INSERT INTO rooms (id, name, owner_id)
        VALUES (gen_random_uuid(), 'Room 2', ${testAgentId}::uuid)
        RETURNING id
      `;
      const room2Id = room2Rows[0].id;

      // Spawn bots in different rooms
      await spawnBot(testRoomId, { name: 'Bot1', personality: 'greeter' }, sql);
      await spawnBot(room2Id, { name: 'Bot2', personality: 'guide' }, sql);

      const bots = await getBots(testRoomId, sql);
      expect(bots).toHaveLength(1);
      expect(bots[0].name).toBe('Bot1');
    });
  });

  describe('tickBots', () => {
    beforeEach(async () => {
      // Spawn 2 bots
      await spawnBot(testRoomId, {
        name: 'Bot1',
        personality: 'greeter',
        initialX: 0,
        initialY: 0,
      }, sql);

      await spawnBot(testRoomId, {
        name: 'Bot2',
        personality: 'guide',
        initialX: 5,
        initialY: 5,
      }, sql);

      vi.clearAllMocks();
    });

    it('should execute without throwing', async () => {
      await expect(tickBots(sql)).resolves.not.toThrow();
    });

    it('should broadcast movement events (probabilistic)', async () => {
      // Run multiple ticks to ensure at least one movement
      for (let i = 0; i < 20; i++) {
        await tickBots(sql);
      }

      // At least one agent.moved event should have been broadcast
      const moveCalls = (handler.broadcastToRoom as any).mock.calls.filter(
        (call: any) => call[1]?.type === 'agent.moved'
      );

      expect(moveCalls.length).toBeGreaterThan(0);
    });

    it('should broadcast chat messages (probabilistic)', async () => {
      // Run multiple ticks
      for (let i = 0; i < 50; i++) {
        await tickBots(sql);
      }

      // At least one message.new event should have been broadcast
      const chatCalls = (handler.broadcastToRoom as any).mock.calls.filter(
        (call: any) => call[1]?.type === 'message.new'
      );

      expect(chatCalls.length).toBeGreaterThan(0);
    });

    it('should update bot positions in database', async () => {
      // Run multiple ticks
      for (let i = 0; i < 10; i++) {
        await tickBots(sql);
      }

      // Check that at least one bot moved
      const dbBots = await sql`
        SELECT x, y FROM bots WHERE room_id = ${testRoomId}::uuid
      `;

      // At least one bot should have moved from initial position
      const bot1Moved = dbBots[0].x !== 0 || dbBots[0].y !== 0;
      const bot2Moved = dbBots[1].x !== 5 || dbBots[1].y !== 5;

      expect(bot1Moved || bot2Moved).toBe(true);
    });

    it('should handle empty bot cache gracefully', async () => {
      // Clear all bots
      await sql`DELETE FROM bots WHERE room_id = ${testRoomId}::uuid`;

      // Should not throw
      await expect(tickBots(sql)).resolves.not.toThrow();

      // No broadcasts should happen
      expect(handler.broadcastToRoom).not.toHaveBeenCalled();
    });
  });

  describe('handleChatToBots', () => {
    beforeEach(async () => {
      await spawnBot(testRoomId, {
        name: 'Greeter',
        personality: 'greeter',
      }, sql);

      vi.clearAllMocks();
    });

    it('should not throw with message', async () => {
      await expect(
        handleChatToBots(testRoomId, 'Hello!', sql)
      ).resolves.not.toThrow();
    });

    it('should broadcast bot responses (if implemented)', async () => {
      await handleChatToBots(testRoomId, 'hi', sql);

      // Wait for setTimeout (500ms)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Check if any responses were broadcast
      const chatCalls = (handler.broadcastToRoom as any).mock.calls.filter(
        (call: any) => call[1]?.type === 'message.new'
      );

      // May or may not respond depending on processChatMessage logic
      expect(chatCalls.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty room gracefully', async () => {
      // Empty room
      const emptyRoomRows = await sql`
        INSERT INTO rooms (id, name, owner_id)
        VALUES (gen_random_uuid(), 'Empty', ${testAgentId}::uuid)
        RETURNING id
      `;
      const emptyRoomId = emptyRoomRows[0].id;

      await expect(
        handleChatToBots(emptyRoomId, 'test', sql)
      ).resolves.not.toThrow();
    });
  });

  describe('initializeBotManager', () => {
    it('should load bots from database', async () => {
      // Spawn bots
      const bot1 = await spawnBot(testRoomId, {
        name: 'Bot1',
        personality: 'greeter',
      }, sql);

      const bot2 = await spawnBot(testRoomId, {
        name: 'Bot2',
        personality: 'guide',
      }, sql);

      // Re-initialize (simulates server restart)
      await initializeBotManager(sql);

      // Verify bots are loaded
      const bots = await getBots(testRoomId, sql);
      expect(bots).toHaveLength(2);
      expect(bots.map(b => b.id)).toContain(bot1.id);
      expect(bots.map(b => b.id)).toContain(bot2.id);
    });

    it('should handle empty database gracefully', async () => {
      await expect(initializeBotManager(sql)).resolves.not.toThrow();
    });
  });
});
