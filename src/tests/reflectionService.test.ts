/**
 * Reflection Service Tests
 * 
 * Tests template-based reflection generation and importance-triggered synthesis
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import postgres from 'postgres';
import {
  buildReflectionPrompt,
  checkAndGenerateReflections,
  getReflectionStats,
  REFLECTION_THRESHOLD,
  checkAndGenerateMultipleReflections,
} from '../services/reflectionService.js';
import {
  addMemory,
  getRecentMemories,
  resetAccumulatedImportance,
  type Memory,
} from '../services/agentMemory.js';

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

describe('Reflection Service', () => {
  const testAgentId = '12345678-1234-1234-1234-123456789abc';

  beforeEach(async () => {
    // Clean up test data
    await sql`DELETE FROM agent_memories WHERE agent_id = ${testAgentId}::uuid`;
    resetAccumulatedImportance(testAgentId);
  });

  afterEach(async () => {
    // Clean up after tests
    await sql`DELETE FROM agent_memories WHERE agent_id = ${testAgentId}::uuid`;
    resetAccumulatedImportance(testAgentId);
  });

  describe('buildReflectionPrompt', () => {
    it('should generate social relationship reflection for frequent interactions', () => {
      const memories: Memory[] = [
        {
          id: 1,
          agentId: testAgentId,
          type: 'conversation',
          content: 'Had a pleasant chat with agent_42',
          importance: 7,
          relatedAgentIds: ['agent_42'],
          timestamp: new Date(),
        },
        {
          id: 2,
          agentId: testAgentId,
          type: 'conversation',
          content: 'Talked with agent_42 about the weather',
          importance: 6,
          relatedAgentIds: ['agent_42'],
          timestamp: new Date(),
        },
        {
          id: 3,
          agentId: testAgentId,
          type: 'conversation',
          content: 'Met agent_42 again, very friendly',
          importance: 7,
          relatedAgentIds: ['agent_42'],
          timestamp: new Date(),
        },
      ];

      const reflection = buildReflectionPrompt(memories);

      expect(reflection).toContain('agent_42');
      expect(reflection).toContain('positive');
      expect(reflection.length).toBeGreaterThan(10);
    });

    it('should generate activity pattern reflection for repeated actions', () => {
      const memories: Memory[] = [
        {
          id: 1,
          agentId: testAgentId,
          type: 'observation',
          content: 'Moved to a new location',
          importance: 5,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
        {
          id: 2,
          agentId: testAgentId,
          type: 'observation',
          content: 'Moved again to explore',
          importance: 5,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
        {
          id: 3,
          agentId: testAgentId,
          type: 'observation',
          content: 'Moved to another room',
          importance: 6,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
        {
          id: 4,
          agentId: testAgentId,
          type: 'observation',
          content: 'Moved back to the lobby',
          importance: 5,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
      ];

      const reflection = buildReflectionPrompt(memories);

      expect(reflection).toContain('moved');
      expect(reflection.length).toBeGreaterThan(10);
    });

    it('should generate room/location reflection for frequent visits', () => {
      const memories: Memory[] = [
        {
          id: 1,
          agentId: testAgentId,
          type: 'observation',
          content: 'Entered room_lobby',
          importance: 5,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
        {
          id: 2,
          agentId: testAgentId,
          type: 'observation',
          content: 'Still in room_lobby',
          importance: 4,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
        {
          id: 3,
          agentId: testAgentId,
          type: 'observation',
          content: 'Spending time in room_lobby',
          importance: 5,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
      ];

      const reflection = buildReflectionPrompt(memories);

      expect(reflection).toContain('lobby');
      expect(reflection.length).toBeGreaterThan(10);
    });

    it('should detect high conversation ratio', () => {
      const memories: Memory[] = [
        {
          id: 1,
          agentId: testAgentId,
          type: 'conversation',
          content: 'Chatted with agent_1',
          importance: 6,
          relatedAgentIds: ['agent_1'],
          timestamp: new Date(),
        },
        {
          id: 2,
          agentId: testAgentId,
          type: 'conversation',
          content: 'Talked to agent_2',
          importance: 6,
          relatedAgentIds: ['agent_2'],
          timestamp: new Date(),
        },
        {
          id: 3,
          agentId: testAgentId,
          type: 'conversation',
          content: 'Spoke with agent_3',
          importance: 7,
          relatedAgentIds: ['agent_3'],
          timestamp: new Date(),
        },
        {
          id: 4,
          agentId: testAgentId,
          type: 'observation',
          content: 'Observed the room',
          importance: 4,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
      ];

      const reflection = buildReflectionPrompt(memories);

      expect(reflection).toContain('talkative');
      expect(reflection.length).toBeGreaterThan(10);
    });

    it('should generate fallback reflection when no clear patterns', () => {
      const memories: Memory[] = [
        {
          id: 1,
          agentId: testAgentId,
          type: 'observation',
          content: 'Some random event',
          importance: 5,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
      ];

      const reflection = buildReflectionPrompt(memories);

      expect(reflection).toContain('Reflecting');
      expect(reflection.length).toBeGreaterThan(10);
    });

    it('should detect positive vs negative sentiment', () => {
      const positiveMemories: Memory[] = [
        {
          id: 1,
          agentId: testAgentId,
          type: 'conversation',
          content: 'Had an enjoyable conversation',
          importance: 7,
          relatedAgentIds: ['agent_1'],
          timestamp: new Date(),
        },
        {
          id: 2,
          agentId: testAgentId,
          type: 'observation',
          content: 'Witnessed a pleasant interaction',
          importance: 6,
          relatedAgentIds: [],
          timestamp: new Date(),
        },
        {
          id: 3,
          agentId: testAgentId,
          type: 'conversation',
          content: 'Really enjoyed the friendly atmosphere',
          importance: 8,
          relatedAgentIds: ['agent_2'],
          timestamp: new Date(),
        },
      ];

      const positiveReflection = buildReflectionPrompt(positiveMemories);
      expect(positiveReflection).toContain('positive');
    });
  });

  describe('checkAndGenerateReflections', () => {
    it('should not generate reflection if threshold not met', async () => {
      // Add memories below threshold
      await addMemory(testAgentId, {
        type: 'observation',
        content: 'Low importance event',
        importance: 3,
        relatedAgentIds: [],
      }, sql);

      const reflection = await checkAndGenerateReflections(testAgentId, sql);

      expect(reflection).toBeNull();
    });

    it('should generate reflection when threshold exceeded', async () => {
      // Add enough high-importance memories to exceed threshold (default 150)
      for (let i = 0; i < 20; i++) {
        await addMemory(testAgentId, {
          type: 'conversation',
          content: `Important conversation ${i}`,
          importance: 8,
          relatedAgentIds: ['agent_42'],
        }, sql);
      }

      const reflection = await checkAndGenerateReflections(testAgentId, sql);

      expect(reflection).not.toBeNull();
      expect(reflection?.type).toBe('reflection');
      expect(reflection?.importance).toBeGreaterThanOrEqual(8);
      expect(reflection?.importance).toBeLessThanOrEqual(10);
      expect(reflection?.content.length).toBeGreaterThan(10);
    });

    it('should reset accumulated importance after reflection', async () => {
      // Add enough memories to trigger reflection
      for (let i = 0; i < 20; i++) {
        await addMemory(testAgentId, {
          type: 'conversation',
          content: `Conversation ${i}`,
          importance: 8,
          relatedAgentIds: [],
        }, sql);
      }

      const stats1 = await getReflectionStats(testAgentId, sql);
      expect(stats1.readyForReflection).toBe(true);

      await checkAndGenerateReflections(testAgentId, sql);

      const stats2 = await getReflectionStats(testAgentId, sql);
      expect(stats2.accumulatedImportance).toBe(0);
      expect(stats2.readyForReflection).toBe(false);
    });

    it('should include related agent IDs from source memories', async () => {
      // Add memories with specific agent relationships
      for (let i = 0; i < 20; i++) {
        await addMemory(testAgentId, {
          type: 'conversation',
          content: 'Interaction',
          importance: 8,
          relatedAgentIds: ['agent_42', 'agent_99'],
        }, sql);
      }

      const reflection = await checkAndGenerateReflections(testAgentId, sql);

      expect(reflection).not.toBeNull();
      expect(reflection?.relatedAgentIds).toContain('agent_42');
      expect(reflection?.relatedAgentIds).toContain('agent_99');
    });

    it('should respect custom threshold parameter', async () => {
      // Add memories that exceed low threshold but not default
      for (let i = 0; i < 8; i++) {
        await addMemory(testAgentId, {
          type: 'observation',
          content: 'Event',
          importance: 7,
          relatedAgentIds: [],
        }, sql);
      }

      // Should not trigger with default threshold (150)
      const reflection1 = await checkAndGenerateReflections(testAgentId, sql);
      expect(reflection1).toBeNull();

      // Should trigger with custom low threshold (50)
      const reflection2 = await checkAndGenerateReflections(testAgentId, sql, 50);
      expect(reflection2).not.toBeNull();
    });
  });

  describe('checkAndGenerateMultipleReflections', () => {
    it('should generate multiple reflections if importance very high', async () => {
      // Add enough memories for 2 reflections (300 total importance)
      for (let i = 0; i < 40; i++) {
        await addMemory(testAgentId, {
          type: 'conversation',
          content: `High importance event ${i}`,
          importance: 8,
          relatedAgentIds: ['agent_42'],
        }, sql);
      }

      const reflections = await checkAndGenerateMultipleReflections(testAgentId, sql);

      expect(reflections.length).toBeGreaterThanOrEqual(1);
      expect(reflections.every(r => r.type === 'reflection')).toBe(true);
    });
  });

  describe('getReflectionStats', () => {
    it('should return accurate reflection statistics', async () => {
      // Add some memories
      await addMemory(testAgentId, {
        type: 'observation',
        content: 'Event',
        importance: 5,
        relatedAgentIds: [],
      }, sql);

      await addMemory(testAgentId, {
        type: 'reflection',
        content: 'Previous reflection',
        importance: 9,
        relatedAgentIds: [],
      }, sql);

      const stats = await getReflectionStats(testAgentId, sql);

      expect(stats.totalReflections).toBe(1);
      expect(stats.accumulatedImportance).toBeGreaterThan(0);
      expect(stats.distanceToThreshold).toBeGreaterThan(0);
      expect(typeof stats.readyForReflection).toBe('boolean');
    });

    it('should indicate when ready for reflection', async () => {
      // Add enough memories to exceed threshold
      for (let i = 0; i < 20; i++) {
        await addMemory(testAgentId, {
          type: 'conversation',
          content: `Event ${i}`,
          importance: 8,
          relatedAgentIds: [],
        }, sql);
      }

      const stats = await getReflectionStats(testAgentId, sql);

      expect(stats.readyForReflection).toBe(true);
      expect(stats.distanceToThreshold).toBe(0);
    });
  });
});
