/**
 * Agent Memory System Tests
 * 
 * Tests for memory-reflection-planning architecture including:
 * - Memory storage and retrieval
 * - Importance-weighted scoring
 * - Reflection generation
 * - Relationship tracking
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import postgres from 'postgres';
import {
  addMemory,
  getRecentMemories,
  getMemoriesAbout,
  getImportantMemories,
  getRelevantMemories,
  generateReflection,
  getAccumulatedImportance,
  resetAccumulatedImportance,
  getMemoryStats,
  calculateMemoryScore,
  type Memory,
  type MemoryInput,
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

// Test agent IDs
const AGENT_1 = '00000000-0000-0000-0000-000000000001';
const AGENT_2 = '00000000-0000-0000-0000-000000000002';
const AGENT_3 = '00000000-0000-0000-0000-000000000003';

beforeEach(async () => {
  // Clean up test data
  await sql`DELETE FROM agent_memories WHERE agent_id IN (${AGENT_1}::uuid, ${AGENT_2}::uuid, ${AGENT_3}::uuid)`;
  
  // Ensure test agents exist
  await sql`
    INSERT INTO agents (id, public_key, display_name)
    VALUES 
      (${AGENT_1}::uuid, E'\\\\x01', 'TestAgent1'),
      (${AGENT_2}::uuid, E'\\\\x02', 'TestAgent2'),
      (${AGENT_3}::uuid, E'\\\\x03', 'TestAgent3')
    ON CONFLICT (id) DO NOTHING
  `;

  // Reset accumulated importance
  resetAccumulatedImportance();
});

afterAll(async () => {
  await sql.end();
});

describe('Agent Memory System', () => {
  
  describe('addMemory', () => {
    it('should store a memory with correct attributes', async () => {
      const memoryInput: MemoryInput = {
        type: 'observation',
        content: 'Agent entered the lobby',
        importance: 5,
        relatedAgentIds: [AGENT_2],
      };

      const memory = await addMemory(AGENT_1, memoryInput, sql);

      expect(memory.agentId).toBe(AGENT_1);
      expect(memory.type).toBe('observation');
      expect(memory.content).toBe('Agent entered the lobby');
      expect(memory.importance).toBe(5);
      expect(memory.relatedAgentIds).toEqual([AGENT_2]);
      expect(memory.timestamp).toBeInstanceOf(Date);
    });

    it('should reject importance values outside 1-10 range', async () => {
      const invalidMemory: MemoryInput = {
        type: 'observation',
        content: 'Invalid importance',
        importance: 11,
      };

      await expect(addMemory(AGENT_1, invalidMemory, sql)).rejects.toThrow(
        'Importance must be between 1 and 10'
      );
    });

    it('should track accumulated importance for reflection triggers', async () => {
      await addMemory(AGENT_1, { type: 'observation', content: 'Test 1', importance: 7 }, sql);
      expect(getAccumulatedImportance(AGENT_1)).toBe(7);

      await addMemory(AGENT_1, { type: 'observation', content: 'Test 2', importance: 5 }, sql);
      expect(getAccumulatedImportance(AGENT_1)).toBe(12);
    });
  });

  describe('getRecentMemories', () => {
    it('should retrieve memories in chronological order (newest first)', async () => {
      await addMemory(AGENT_1, { type: 'observation', content: 'First', importance: 5 }, sql);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      await addMemory(AGENT_1, { type: 'observation', content: 'Second', importance: 5 }, sql);
      await new Promise(resolve => setTimeout(resolve, 100));
      await addMemory(AGENT_1, { type: 'observation', content: 'Third', importance: 5 }, sql);

      const memories = await getRecentMemories(AGENT_1, 10, sql);

      expect(memories.length).toBe(3);
      expect(memories[0].content).toBe('Third');
      expect(memories[1].content).toBe('Second');
      expect(memories[2].content).toBe('First');
    });

    it('should respect the limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await addMemory(AGENT_1, { type: 'observation', content: `Memory ${i}`, importance: 5 }, sql);
      }

      const memories = await getRecentMemories(AGENT_1, 3, sql);
      expect(memories.length).toBe(3);
    });

    it('should only return memories for the specified agent', async () => {
      await addMemory(AGENT_1, { type: 'observation', content: 'Agent 1 memory', importance: 5 }, sql);
      await addMemory(AGENT_2, { type: 'observation', content: 'Agent 2 memory', importance: 5 }, sql);

      const memories = await getRecentMemories(AGENT_1, 10, sql);
      expect(memories.length).toBe(1);
      expect(memories[0].content).toBe('Agent 1 memory');
    });
  });

  describe('getMemoriesAbout', () => {
    it('should retrieve memories related to a specific agent', async () => {
      await addMemory(AGENT_1, {
        type: 'conversation',
        content: 'Had a chat with Agent 2',
        importance: 7,
        relatedAgentIds: [AGENT_2],
      }, sql);

      await addMemory(AGENT_1, {
        type: 'observation',
        content: 'Saw Agent 3 in the lobby',
        importance: 5,
        relatedAgentIds: [AGENT_3],
      }, sql);

      await addMemory(AGENT_1, {
        type: 'conversation',
        content: 'Another chat with Agent 2',
        importance: 6,
        relatedAgentIds: [AGENT_2],
      }, sql);

      const memoriesAboutAgent2 = await getMemoriesAbout(AGENT_1, AGENT_2, sql);
      expect(memoriesAboutAgent2.length).toBe(2);
      expect(memoriesAboutAgent2.every(m => m.relatedAgentIds.includes(AGENT_2))).toBe(true);
    });

    it('should return empty array if no related memories exist', async () => {
      await addMemory(AGENT_1, {
        type: 'observation',
        content: 'Solo activity',
        importance: 5,
        relatedAgentIds: [],
      }, sql);

      const memories = await getMemoriesAbout(AGENT_1, AGENT_2, sql);
      expect(memories.length).toBe(0);
    });
  });

  describe('getImportantMemories', () => {
    it('should retrieve only high-importance memories', async () => {
      await addMemory(AGENT_1, { type: 'observation', content: 'Low importance', importance: 3 }, sql);
      await addMemory(AGENT_1, { type: 'observation', content: 'Medium importance', importance: 6 }, sql);
      await addMemory(AGENT_1, { type: 'observation', content: 'High importance', importance: 9 }, sql);
      await addMemory(AGENT_1, { type: 'reflection', content: 'Critical insight', importance: 10 }, sql);

      const importantMemories = await getImportantMemories(AGENT_1, 7, sql);
      expect(importantMemories.length).toBe(2);
      expect(importantMemories[0].importance).toBeGreaterThanOrEqual(7);
      expect(importantMemories[1].importance).toBeGreaterThanOrEqual(7);
    });

    it('should order by importance (highest first)', async () => {
      await addMemory(AGENT_1, { type: 'observation', content: 'Importance 7', importance: 7 }, sql);
      await addMemory(AGENT_1, { type: 'observation', content: 'Importance 10', importance: 10 }, sql);
      await addMemory(AGENT_1, { type: 'observation', content: 'Importance 8', importance: 8 }, sql);

      const memories = await getImportantMemories(AGENT_1, 7, sql);
      expect(memories[0].importance).toBe(10);
      expect(memories[1].importance).toBe(8);
      expect(memories[2].importance).toBe(7);
    });
  });

  describe('calculateMemoryScore', () => {
    it('should give higher scores to recent memories', () => {
      const now = new Date();
      const recentMemory: Memory = {
        id: 1,
        agentId: AGENT_1,
        type: 'observation',
        content: 'Recent event',
        importance: 5,
        relatedAgentIds: [],
        timestamp: new Date(now.getTime() - 1000 * 60 * 60), // 1 hour ago
      };

      const oldMemory: Memory = {
        ...recentMemory,
        id: 2,
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
      };

      const recentScore = calculateMemoryScore(recentMemory, now);
      const oldScore = calculateMemoryScore(oldMemory, now);

      expect(recentScore).toBeGreaterThan(oldScore);
    });

    it('should give higher scores to important memories', () => {
      const now = new Date();
      const importantMemory: Memory = {
        id: 1,
        agentId: AGENT_1,
        type: 'observation',
        content: 'Important event',
        importance: 9,
        relatedAgentIds: [],
        timestamp: now,
      };

      const normalMemory: Memory = {
        ...importantMemory,
        id: 2,
        importance: 3,
      };

      const importantScore = calculateMemoryScore(importantMemory, now);
      const normalScore = calculateMemoryScore(normalMemory, now);

      expect(importantScore).toBeGreaterThan(normalScore);
    });

    it('should respect custom weights', () => {
      const now = new Date();
      const memory: Memory = {
        id: 1,
        agentId: AGENT_1,
        type: 'observation',
        content: 'Test',
        importance: 5,
        relatedAgentIds: [],
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24), // 1 day ago
      };

      const recencyFocused = calculateMemoryScore(memory, now, { recency: 2.0, importance: 1.0 });
      const importanceFocused = calculateMemoryScore(memory, now, { recency: 1.0, importance: 2.0 });

      expect(recencyFocused).not.toBe(importanceFocused);
    });
  });

  describe('getRelevantMemories', () => {
    it('should return top-k most relevant memories using importance-weighted scoring', async () => {
      // Add mix of recent low-importance and older high-importance memories
      await addMemory(AGENT_1, { type: 'observation', content: 'Recent trivial', importance: 2 }, sql);
      await new Promise(resolve => setTimeout(resolve, 100));
      await addMemory(AGENT_1, { type: 'observation', content: 'Important event', importance: 10 }, sql);
      await new Promise(resolve => setTimeout(resolve, 100));
      await addMemory(AGENT_1, { type: 'observation', content: 'Medium recent', importance: 5 }, sql);

      const relevant = await getRelevantMemories(AGENT_1, 2, sql);

      // Should prioritize importance + recency
      expect(relevant.length).toBe(2);
      // Most recent high-importance should be first
      expect(relevant[0].content).toBe('Important event');
    });
  });

  describe('generateReflection', () => {
    it('should generate reflection when accumulated importance exceeds threshold', async () => {
      // Add memories totaling > 150 importance
      for (let i = 0; i < 20; i++) {
        await addMemory(AGENT_1, {
          type: 'observation',
          content: `Event ${i}`,
          importance: 8,
        }, sql);
      }

      const reflection = await generateReflection(AGENT_1, sql, { threshold: 150, enabled: true });

      expect(reflection).not.toBeNull();
      expect(reflection!.type).toBe('reflection');
      expect(reflection!.importance).toBe(8);
      expect(getAccumulatedImportance(AGENT_1)).toBe(0); // Should reset after reflection
    });

    it('should not generate reflection when threshold not met', async () => {
      await addMemory(AGENT_1, { type: 'observation', content: 'Low activity', importance: 5 }, sql);

      const reflection = await generateReflection(AGENT_1, sql, { threshold: 150, enabled: true });

      expect(reflection).toBeNull();
      expect(getAccumulatedImportance(AGENT_1)).toBe(5); // Should remain
    });

    it('should not generate reflection when disabled', async () => {
      for (let i = 0; i < 20; i++) {
        await addMemory(AGENT_1, { type: 'observation', content: `Event ${i}`, importance: 10 }, sql);
      }

      const reflection = await generateReflection(AGENT_1, sql, { threshold: 150, enabled: false });

      expect(reflection).toBeNull();
    });

    it('should include related agents in reflection', async () => {
      for (let i = 0; i < 20; i++) {
        await addMemory(AGENT_1, {
          type: 'conversation',
          content: `Chat with Agent 2`,
          importance: 8,
          relatedAgentIds: [AGENT_2],
        }, sql);
      }

      const reflection = await generateReflection(AGENT_1, sql, { threshold: 150, enabled: true });

      expect(reflection).not.toBeNull();
      expect(reflection!.relatedAgentIds).toContain(AGENT_2);
    });
  });

  describe('getMemoryStats', () => {
    it('should return accurate statistics', async () => {
      await addMemory(AGENT_1, { type: 'observation', content: 'Test 1', importance: 5 }, sql);
      await addMemory(AGENT_1, { type: 'observation', content: 'Test 2', importance: 7 }, sql);
      await addMemory(AGENT_1, { type: 'conversation', content: 'Test 3', importance: 8 }, sql);
      await addMemory(AGENT_1, { type: 'reflection', content: 'Test 4', importance: 9 }, sql);

      const stats = await getMemoryStats(AGENT_1, sql);

      expect(stats.totalMemories).toBe(4);
      expect(stats.byType.observation).toBe(2);
      expect(stats.byType.conversation).toBe(1);
      expect(stats.byType.reflection).toBe(1);
      expect(stats.averageImportance).toBeCloseTo(7.25, 1);
      expect(stats.accumulatedImportance).toBe(29); // Sum of all importance values
    });

    it('should handle agents with no memories', async () => {
      const stats = await getMemoryStats(AGENT_2, sql);

      expect(stats.totalMemories).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.averageImportance).toBe(0);
      expect(stats.accumulatedImportance).toBe(0);
    });
  });
});
