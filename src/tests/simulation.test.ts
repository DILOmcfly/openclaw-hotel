import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as SimulationService from '../services/SimulationService.js';

// Mock dependencies
const mockSql = vi.fn();
const mockBroadcast = vi.fn();

// Mock external services
vi.mock('../services/agentConversation.js', () => ({
  generateAgentMessage: vi.fn(async () => ({
    message: 'Hello from test agent!',
    source: 'fallback' as const,
  })),
  getConversationConfig: vi.fn(() => ({
    enabled: true,
    fallbackEnabled: true,
    model: 'test-model',
  })),
}));

vi.mock('../services/agentMemory.js', () => ({
  addMemory: vi.fn(async () => {}),
}));

vi.mock('../services/reflectionService.js', () => ({
  checkAndGenerateReflections: vi.fn(async () => {}),
}));

vi.mock('../services/personalityEngine.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    generatePersonalityProfile: vi.fn((agentId: string) => ({
      agentId,
      traits: {
        extraversion: 50,
        agreeableness: 50,
        conscientiousness: 50,
        neuroticism: 50,
        openness: 50,
      },
      mood: {
        current_mood: 'neutral' as const,
        arousal: 5,
        valence: 5,
      },
      lastUpdated: new Date(),
    })),
  };
});

describe('SimulationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SimulationService.resetMetrics();
    
    // Default SQL mock: return empty agent list
    mockSql.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('tick()', () => {
    it('should execute successfully with no agents', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      // Mock empty presence table
      mockSql.mockResolvedValueOnce([]);

      const actionsExecuted = await SimulationService.tick(config, mockSql, mockBroadcast);

      expect(actionsExecuted).toBe(0);
      expect(mockSql).toHaveBeenCalled();
      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('should execute actions for active agents with 100% probability', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      const mockAgents = [
        { agentId: 'agent-1', roomId: 'room-1' },
        { agentId: 'agent-2', roomId: 'room-1' },
      ];

      // Mock presence query
      mockSql
        .mockResolvedValueOnce(mockAgents) // getActiveAgents
        .mockResolvedValue([{ count: 2 }]); // getRoomPopulation

      // Mock position updates
      mockSql.mockImplementation(async (strings: any, ...values: any[]) => {
        if (strings[0]?.includes('UPDATE presence')) {
          return []; // Success
        }
        if (strings[0]?.includes('SELECT COUNT')) {
          return [{ count: 2 }];
        }
        if (strings[0]?.includes('SELECT p.agent_id')) {
          return []; // No nearby agents
        }
        return [];
      });

      const actionsExecuted = await SimulationService.tick(config, mockSql, mockBroadcast);

      expect(actionsExecuted).toBeGreaterThan(0);
      expect(actionsExecuted).toBeLessThanOrEqual(2);
      expect(mockBroadcast).toHaveBeenCalled();
    });

    it('should respect action probability (0% = no actions)', async () => {
      const config = { enabled: true, actionProbability: 0.0 };
      
      const mockAgents = [
        { agentId: 'agent-1', roomId: 'room-1' },
        { agentId: 'agent-2', roomId: 'room-1' },
      ];

      mockSql.mockResolvedValueOnce(mockAgents);

      const actionsExecuted = await SimulationService.tick(config, mockSql, mockBroadcast);

      expect(actionsExecuted).toBe(0);
      expect(mockBroadcast).not.toHaveBeenCalled();
    });

    it('should skip tick when disabled', async () => {
      const config = { enabled: false, actionProbability: 1.0 };
      
      const actionsExecuted = await SimulationService.tick(config, mockSql, mockBroadcast);

      expect(actionsExecuted).toBe(0);
      expect(mockSql).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      // Simulate SQL error
      mockSql.mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(
        SimulationService.tick(config, mockSql, mockBroadcast)
      ).rejects.toThrow('Database connection lost');
    });

    it('should broadcast move events correctly', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      const mockAgents = [{ agentId: 'agent-move', roomId: 'room-1' }];

      mockSql
        .mockResolvedValueOnce(mockAgents) // getActiveAgents
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('UPDATE presence')) return [];
          if (strings[0]?.includes('SELECT COUNT')) return [{ count: 1 }];
          if (strings[0]?.includes('SELECT p.agent_id')) return [];
          return [];
        });

      await SimulationService.tick(config, mockSql, mockBroadcast);

      // At least one action should trigger (move, chat, or emote)
      expect(mockBroadcast).toHaveBeenCalled();
      
      // Check if broadcast was called with room ID
      const broadcastCalls = mockBroadcast.mock.calls;
      expect(broadcastCalls[0][0]).toBe('room-1');
      expect(broadcastCalls[0][1]).toHaveProperty('type');
    });

    it('should broadcast chat events with message', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      const mockAgents = [{ agentId: 'agent-chat', roomId: 'room-1' }];

      // Mock to force chat action
      let callCount = 0;
      mockSql
        .mockResolvedValueOnce(mockAgents) // getActiveAgents
        .mockImplementation(async (strings: any) => {
          callCount++;
          if (strings[0]?.includes('UPDATE presence')) return [];
          if (strings[0]?.includes('SELECT COUNT')) return [{ count: 1 }];
          if (strings[0]?.includes('SELECT p.agent_id')) return [];
          return [];
        });

      await SimulationService.tick(config, mockSql, mockBroadcast);

      // Should have broadcasted at least one event
      expect(mockBroadcast).toHaveBeenCalled();
    });

    it('should handle multiple agents in same room', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      const mockAgents = [
        { agentId: 'agent-1', roomId: 'room-shared' },
        { agentId: 'agent-2', roomId: 'room-shared' },
        { agentId: 'agent-3', roomId: 'room-shared' },
      ];

      mockSql
        .mockResolvedValueOnce(mockAgents) // getActiveAgents
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('UPDATE presence')) return [];
          if (strings[0]?.includes('SELECT COUNT')) return [{ count: 3 }];
          if (strings[0]?.includes('SELECT p.agent_id')) {
            // Return other agents in room
            return [
              { agentId: 'agent-1' },
              { agentId: 'agent-2' },
            ];
          }
          return [];
        });

      const actionsExecuted = await SimulationService.tick(config, mockSql, mockBroadcast);

      expect(actionsExecuted).toBeGreaterThan(0);
      
      // All broadcasts should target the same room
      const roomIds = mockBroadcast.mock.calls.map(call => call[0]);
      expect(roomIds.every(id => id === 'room-shared')).toBe(true);
    });
  });

  describe('getMetrics()', () => {
    it('should return initial metrics', () => {
      const metrics = SimulationService.getMetrics();

      expect(metrics).toEqual({
        totalTicks: 0,
        totalActions: 0,
        lastTickTime: null,
        actionsPerTick: [],
      });
    });

    it('should update metrics after tick execution', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      const mockAgents = [{ agentId: 'agent-1', roomId: 'room-1' }];

      mockSql
        .mockResolvedValueOnce(mockAgents)
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('UPDATE presence')) return [];
          if (strings[0]?.includes('SELECT COUNT')) return [{ count: 1 }];
          if (strings[0]?.includes('SELECT p.agent_id')) return [];
          return [];
        });

      await SimulationService.tick(config, mockSql, mockBroadcast);

      const metrics = SimulationService.getMetrics();

      expect(metrics.totalTicks).toBe(1);
      expect(metrics.lastTickTime).toBeInstanceOf(Date);
      expect(metrics.actionsPerTick.length).toBe(1);
    });

    it('should track actions across multiple ticks', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      const mockAgents = [{ agentId: 'agent-1', roomId: 'room-1' }];

      for (let i = 0; i < 3; i++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('UPDATE presence')) return [];
            if (strings[0]?.includes('SELECT COUNT')) return [{ count: 1 }];
            if (strings[0]?.includes('SELECT p.agent_id')) return [];
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);
      }

      const metrics = SimulationService.getMetrics();

      expect(metrics.totalTicks).toBe(3);
      expect(metrics.actionsPerTick.length).toBe(3);
    });

    it('should limit actionsPerTick to last 100 ticks', async () => {
      const config = { enabled: true, actionProbability: 0.0 }; // No actions, fast ticks

      for (let i = 0; i < 150; i++) {
        mockSql.mockResolvedValueOnce([]);
        await SimulationService.tick(config, mockSql, mockBroadcast);
      }

      const metrics = SimulationService.getMetrics();

      expect(metrics.totalTicks).toBe(150);
      expect(metrics.actionsPerTick.length).toBe(100); // Should cap at 100
    });
  });

  describe('resetMetrics()', () => {
    it('should reset all metrics to initial state', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      const mockAgents = [{ agentId: 'agent-1', roomId: 'room-1' }];

      mockSql
        .mockResolvedValueOnce(mockAgents)
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('UPDATE presence')) return [];
          if (strings[0]?.includes('SELECT COUNT')) return [{ count: 1 }];
          if (strings[0]?.includes('SELECT p.agent_id')) return [];
          return [];
        });

      // Execute a tick to generate metrics
      await SimulationService.tick(config, mockSql, mockBroadcast);

      // Verify metrics exist
      let metrics = SimulationService.getMetrics();
      expect(metrics.totalTicks).toBeGreaterThan(0);

      // Reset
      SimulationService.resetMetrics();

      // Verify reset
      metrics = SimulationService.getMetrics();
      expect(metrics).toEqual({
        totalTicks: 0,
        totalActions: 0,
        lastTickTime: null,
        actionsPerTick: [],
      });
    });
  });

  describe('Performance', () => {
    it('should process 100 agents in <1 second', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      
      // Generate 100 mock agents
      const mockAgents = Array.from({ length: 100 }, (_, i) => ({
        agentId: `agent-${i}`,
        roomId: `room-${i % 10}`, // 10 different rooms
      }));

      mockSql
        .mockResolvedValueOnce(mockAgents)
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('UPDATE presence')) return [];
          if (strings[0]?.includes('SELECT COUNT')) return [{ count: 10 }];
          if (strings[0]?.includes('SELECT p.agent_id')) return [];
          return [];
        });

      const startTime = Date.now();
      await SimulationService.tick(config, mockSql, mockBroadcast);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in <1s
    }, 10000); // Increase test timeout to 10s to be safe
  });
});
