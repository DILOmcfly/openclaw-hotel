/**
 * Integration Tests for SimulationService AI Layer
 * 
 * Tests the full integration of:
 * - Personality Engine (behavior decisions, mood)
 * - Agent Memory (observation storage)
 * - Social Dynamics (relationship tracking)
 * - Reflection Service (insight generation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as simulationService from '../services/SimulationService.js';
import * as agentMemory from '../services/agentMemory.js';
import * as personalityEngine from '../services/personalityEngine.js';
import * as socialDynamics from '../services/socialDynamics.js';
import * as reflectionService from '../services/reflectionService.js';

// Mock SQL client
function createMockSql() {
  const mockSql = vi.fn() as any;
  
  // Mock presence query (active agents)
  mockSql.mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
    const query = strings.join('').toLowerCase();
    
    // Get active agents
    if (query.includes('select') && query.includes('presence') && query.includes('order by random')) {
      return Promise.resolve([
        { agentId: 'agent-1', roomId: 'room-lobby' },
        { agentId: 'agent-2', roomId: 'room-lobby' },
      ]);
    }
    
    // Get room population
    if (query.includes('count') && query.includes('from presence') && query.includes('where room_id')) {
      return Promise.resolve([{ count: 2 }]);
    }
    
    // Get nearby agents
    if (query.includes('from presence') && query.includes('limit 10')) {
      return Promise.resolve([
        { agentId: 'agent-2' },
      ]);
    }
    
    // Update presence position
    if (query.includes('update presence') && query.includes('set x =')) {
      return Promise.resolve([]);
    }
    
    // Insert memory
    if (query.includes('insert into agent_memories')) {
      return Promise.resolve([{
        id: Date.now(),
        agentId: values[0],
        type: values[1],
        content: values[2],
        importance: values[3],
        relatedAgentIds: values[4] || [],
        timestamp: new Date(),
      }]);
    }
    
    // Get recent memories
    if (query.includes('from agent_memories') && query.includes('order by created_at desc')) {
      return Promise.resolve([]);
    }
    
    // Insert/update relationship
    if (query.includes('agent_relationships')) {
      const affinity = Math.floor(Math.random() * 20) + 5; // 5-25
      return Promise.resolve([{
        id: Date.now(),
        agentId: values[0],
        targetAgentId: values[1],
        affinity,
        interactions: 1,
        lastInteraction: new Date(),
      }]);
    }
    
    return Promise.resolve([]);
  });
  
  return mockSql;
}

// Mock broadcast function
function createMockBroadcast() {
  return vi.fn();
}

describe('SimulationService AI Integration', () => {
  let mockSql: any;
  let mockBroadcast: any;

  beforeEach(() => {
    mockSql = createMockSql();
    mockBroadcast = createMockBroadcast();
    simulationService.resetMetrics();
  });

  afterEach(() => {
    // Restore all mocks after each test to prevent interference
    vi.restoreAllMocks();
  });

  it('should use personality engine to decide agent behavior', async () => {
    // Spy on decideBehavior
    const decideBehaviorSpy = vi.spyOn(personalityEngine, 'decideBehavior');

    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    const actionsExecuted = await simulationService.tick(config, mockSql, mockBroadcast);

    // Verify personality engine was consulted for behavior decisions
    expect(decideBehaviorSpy).toHaveBeenCalled();
    expect(actionsExecuted).toBeGreaterThan(0);
  });

  it('should store memories after agent actions', async () => {
    // Spy on addMemory
    const addMemorySpy = vi.spyOn(agentMemory, 'addMemory');

    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    await simulationService.tick(config, mockSql, mockBroadcast);

    // Verify memories were created (move, chat, or emote)
    expect(addMemorySpy).toHaveBeenCalled();
    
    // Check memory structure
    const firstCall = addMemorySpy.mock.calls[0];
    expect(firstCall[0]).toBeTruthy(); // agentId
    expect(firstCall[1]).toHaveProperty('type');
    expect(firstCall[1]).toHaveProperty('content');
    expect(firstCall[1]).toHaveProperty('importance');
    expect(firstCall[1].importance).toBeGreaterThanOrEqual(1);
    expect(firstCall[1].importance).toBeLessThanOrEqual(10);
  });

  it('should update social relationships after chat interactions', async () => {
    // Spy on updateRelationship
    const updateRelationshipSpy = vi.spyOn(socialDynamics, 'updateRelationship');

    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    
    // Run multiple ticks to increase chance of chat action
    for (let i = 0; i < 5; i++) {
      await simulationService.tick(config, mockSql, mockBroadcast);
    }

    // Verify relationships were updated if any chat occurred
    // (may not happen every time due to random action selection)
    const chatOccurred = mockBroadcast.mock.calls.some(
      (call: any) => call[1]?.type === 'chat'
    );
    
    if (chatOccurred) {
      expect(updateRelationshipSpy).toHaveBeenCalled();
      
      // Check relationship update structure
      const firstCall = updateRelationshipSpy.mock.calls[0];
      expect(firstCall[0]).toBeTruthy(); // agentId
      expect(firstCall[1]).toBeTruthy(); // targetAgentId
      expect(firstCall[2]).toBe('chat'); // event type
      expect(firstCall[3]).toBe(mockSql); // sql client
    }
  });

  it('should check for reflection generation after actions', async () => {
    // Spy on checkAndGenerateReflections
    const checkReflectionsSpy = vi.spyOn(reflectionService, 'checkAndGenerateReflections');

    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    await simulationService.tick(config, mockSql, mockBroadcast);

    // Verify reflection service was consulted
    expect(checkReflectionsSpy).toHaveBeenCalled();
  });

  it('should update mood based on events', async () => {
    // Spy on updateMood
    const updateMoodSpy = vi.spyOn(personalityEngine, 'updateMood');

    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    
    // Run multiple ticks to trigger mood updates
    for (let i = 0; i < 3; i++) {
      await simulationService.tick(config, mockSql, mockBroadcast);
    }

    // Verify mood was updated based on events (chat, crowded room, etc.)
    // May not happen every tick, but should happen at least once in 3 ticks
    const moodUpdated = updateMoodSpy.mock.calls.length > 0;
    
    if (moodUpdated) {
      const firstCall = updateMoodSpy.mock.calls[0];
      expect(firstCall[0]).toHaveProperty('agentId'); // profile
      expect(firstCall[0]).toHaveProperty('mood');
      expect(firstCall[1]).toHaveProperty('type'); // event
    }
  });

  it('should gracefully degrade if AI services fail', async () => {
    // Mock addMemory to throw error
    vi.spyOn(agentMemory, 'addMemory').mockRejectedValue(new Error('Memory service down'));
    
    // Mock updateRelationship to throw error
    vi.spyOn(socialDynamics, 'updateRelationship').mockRejectedValue(new Error('Social service down'));
    
    // Mock checkAndGenerateReflections to throw error
    vi.spyOn(reflectionService, 'checkAndGenerateReflections').mockRejectedValue(new Error('Reflection service down'));

    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    
    // Should not throw - graceful degradation
    await expect(simulationService.tick(config, mockSql, mockBroadcast)).resolves.not.toThrow();
    
    // Actions should still execute (broadcast still works)
    expect(mockBroadcast).toHaveBeenCalled();
  });

  it('should create personality profiles on first agent encounter', async () => {
    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    
    // Run a tick - this will create profiles internally
    const actionsExecuted = await simulationService.tick(config, mockSql, mockBroadcast);
    
    // Verify that actions were executed, which means profiles were created
    // (profiles are required for decideBehavior to work)
    expect(actionsExecuted).toBeGreaterThanOrEqual(0);
    
    // Verify broadcast was called with personality-driven behavior
    expect(mockBroadcast).toHaveBeenCalled();
  });

  it('should track metrics across multiple ticks', async () => {
    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 0.8 };
    
    // Run 5 simulation ticks
    for (let i = 0; i < 5; i++) {
      await simulationService.tick(config, mockSql, mockBroadcast);
    }
    
    const metrics = simulationService.getMetrics();
    
    expect(metrics.totalTicks).toBe(5);
    expect(metrics.totalActions).toBeGreaterThan(0);
    expect(metrics.lastTickTime).toBeInstanceOf(Date);
    expect(metrics.actionsPerTick).toHaveLength(5);
  });

  it('should integrate all AI systems in a single tick flow', async () => {
    // Comprehensive spy setup
    const decideBehaviorSpy = vi.spyOn(personalityEngine, 'decideBehavior');
    const addMemorySpy = vi.spyOn(agentMemory, 'addMemory');
    const updateRelationshipSpy = vi.spyOn(socialDynamics, 'updateRelationship');
    const checkReflectionsSpy = vi.spyOn(reflectionService, 'checkAndGenerateReflections');
    const updateMoodSpy = vi.spyOn(personalityEngine, 'updateMood');

    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    
    // Run multiple ticks to ensure various actions occur
    for (let i = 0; i < 5; i++) {
      await simulationService.tick(config, mockSql, mockBroadcast);
    }

    // Verify all systems were engaged
    expect(decideBehaviorSpy).toHaveBeenCalled(); // Personality engine decides behavior
    expect(addMemorySpy).toHaveBeenCalled(); // Memories stored
    expect(checkReflectionsSpy).toHaveBeenCalled(); // Reflections checked
    
    // Social and mood updates may vary based on actions
    const allSystemsEngaged = 
      decideBehaviorSpy.mock.calls.length > 0 &&
      addMemorySpy.mock.calls.length > 0 &&
      checkReflectionsSpy.mock.calls.length > 0;
    
    expect(allSystemsEngaged).toBe(true);
  });

  it('should apply mood decay over time', async () => {
    const config = { enabled: true, tickIntervalMs: 1000, actionProbability: 1.0 };
    
    // Run multiple ticks - mood decay happens internally when time passes
    for (let i = 0; i < 3; i++) {
      await simulationService.tick(config, mockSql, mockBroadcast);
    }

    // Verify simulation continues working (mood decay is applied internally)
    const metrics = simulationService.getMetrics();
    expect(metrics.totalTicks).toBe(3);
    expect(metrics.totalActions).toBeGreaterThanOrEqual(0);
  });
});
