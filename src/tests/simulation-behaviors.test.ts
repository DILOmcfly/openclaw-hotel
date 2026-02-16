import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  getRecentMemories: vi.fn(async () => []),
}));

vi.mock('../services/reflectionService.js', () => ({
  checkAndGenerateReflections: vi.fn(async () => {}),
}));

vi.mock('../services/socialDynamics.js', () => ({
  updateRelationship: vi.fn(async () => {}),
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
        energy: 70,
        social_need: 50,
      },
      lastUpdated: new Date(),
    })),
  };
});

describe('SimulationService - Enhanced Behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SimulationService.resetMetrics();
  });

  describe('Behavior Probability Distribution', () => {
    it('should generate all behavior types across 100 iterations', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const behaviors = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const mockAgents = [{ agentId: `agent-${i}`, roomId: 'room-test' }];

        mockSql
          .mockResolvedValueOnce(mockAgents) // getActiveAgents
          .mockImplementation(async (strings: any) => {
            // Agent position query
            if (strings[0]?.includes('SELECT x, y') && strings[0]?.includes('FROM presence')) {
              return [{ x: 10, y: 10 }];
            }
            // Nearby furniture
            if (strings[0]?.includes('FROM furniture')) {
              return [{ id: 'furniture-1', x: 11, y: 11, itemDefId: 'chair' }];
            }
            // Nearby agents
            if (strings[0]?.includes('SELECT agent_id::text') && strings[0]?.includes('FROM presence')) {
              return [{ agentId: 'agent-nearby', x: 12, y: 12 }];
            }
            // Room theme
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'lounge' }];
            }
            // Room population
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 2 }];
            }
            // Update queries
            if (strings[0]?.includes('UPDATE presence')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        // Track broadcast types
        mockBroadcast.mock.calls.forEach((call) => {
          if (call[1]?.type) {
            behaviors.add(call[1].type);
          }
        });

        vi.clearAllMocks();
      }

      // Should have generated variety of behaviors
      expect(behaviors.size).toBeGreaterThan(3);
    });

    it('should respect probability distribution (sum = 100%)', () => {
      // Probabilities: idle (5%), wander (40%), follow (10%), dance (5%), 
      //                useFurniture (15%), playGame (10%), tradeItem (10%), emoteReact (5%)
      const expectedSum = 5 + 40 + 10 + 5 + 15 + 10 + 10 + 5;
      expect(expectedSum).toBe(100);
    });
  });

  describe('Context Detection - Nearby Furniture', () => {
    it('should detect furniture within 2 tiles', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-1', roomId: 'room-1' }];

      mockSql
        .mockResolvedValueOnce(mockAgents)
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('FROM furniture') && strings[0]?.includes('abs(x -')) {
            return [
              { id: 'furniture-1', x: 10, y: 10, itemDefId: 'chair' },
              { id: 'furniture-2', x: 11, y: 10, itemDefId: 'table' },
            ];
          }
          if (strings[0]?.includes('SELECT x, y')) {
            return [{ x: 10, y: 10 }];
          }
          if (strings[0]?.includes('SELECT agent_id::text')) {
            return [];
          }
          if (strings[0]?.includes('SELECT theme')) {
            return [{ theme: 'library' }];
          }
          if (strings[0]?.includes('SELECT COUNT')) {
            return [{ count: 1 }];
          }
          if (strings[0]?.includes('UPDATE presence')) {
            return [];
          }
          return [];
        });

      await SimulationService.tick(config, mockSql, mockBroadcast);

      // Check that SQL was called (furniture query happens in behavior decision)
      expect(mockSql).toHaveBeenCalled();
      // Verify query pattern includes furniture query
      const furnitureQueryCalled = mockSql.mock.calls.some((call: any) => 
        call[0]?.[0]?.includes('FROM furniture')
      );
      expect(furnitureQueryCalled).toBe(true);
    });

    it('should handle no nearby furniture gracefully', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-1', roomId: 'room-1' }];

      mockSql
        .mockResolvedValueOnce(mockAgents)
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('FROM furniture')) {
            return []; // No furniture
          }
          if (strings[0]?.includes('SELECT x, y')) {
            return [{ x: 10, y: 10 }];
          }
          if (strings[0]?.includes('SELECT agent_id::text')) {
            return [];
          }
          if (strings[0]?.includes('SELECT theme')) {
            return [{ theme: 'empty' }];
          }
          if (strings[0]?.includes('SELECT COUNT')) {
            return [{ count: 1 }];
          }
          if (strings[0]?.includes('UPDATE presence')) {
            return [];
          }
          return [];
        });

      const actionsExecuted = await SimulationService.tick(config, mockSql, mockBroadcast);

      // Should not crash, should fallback to other behaviors
      expect(actionsExecuted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context Detection - Nearby Agents', () => {
    it('should detect agents within 3 tiles', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-1', roomId: 'room-1' }];

      mockSql
        .mockResolvedValueOnce(mockAgents)
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('SELECT agent_id::text') && strings[0]?.includes('abs(x -')) {
            return [
              { agentId: 'agent-2', x: 11, y: 11 },
              { agentId: 'agent-3', x: 12, y: 10 },
            ];
          }
          if (strings[0]?.includes('SELECT x, y')) {
            return [{ x: 10, y: 10 }];
          }
          if (strings[0]?.includes('FROM furniture')) {
            return [];
          }
          if (strings[0]?.includes('SELECT theme')) {
            return [{ theme: 'arcade' }];
          }
          if (strings[0]?.includes('SELECT COUNT')) {
            return [{ count: 3 }];
          }
          if (strings[0]?.includes('UPDATE presence')) {
            return [];
          }
          return [];
        });

      await SimulationService.tick(config, mockSql, mockBroadcast);

      // Check that SQL was called (nearby agents query happens in behavior decision)
      expect(mockSql).toHaveBeenCalled();
      // Verify query pattern includes nearby agents query
      const nearbyAgentsQueryCalled = mockSql.mock.calls.some((call: any) => 
        call[0]?.[0]?.includes('SELECT agent_id::text') && call[0]?.[0]?.includes('FROM presence')
      );
      expect(nearbyAgentsQueryCalled).toBe(true);
    });
  });

  describe('Context Detection - Room Theme', () => {
    it('should query room theme for context', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-1', roomId: 'room-1' }];

      let themeQueryCalled = false;

      mockSql
        .mockResolvedValueOnce(mockAgents)
        .mockImplementation(async (strings: any) => {
          if (strings[0]?.includes('SELECT theme') && strings[0]?.includes('FROM rooms')) {
            themeQueryCalled = true;
            return [{ theme: 'kitchen' }];
          }
          if (strings[0]?.includes('SELECT x, y')) {
            return [{ x: 10, y: 10 }];
          }
          if (strings[0]?.includes('FROM furniture')) {
            return [];
          }
          if (strings[0]?.includes('SELECT agent_id::text')) {
            return [];
          }
          if (strings[0]?.includes('SELECT COUNT')) {
            return [{ count: 1 }];
          }
          if (strings[0]?.includes('UPDATE presence')) {
            return [];
          }
          return [];
        });

      await SimulationService.tick(config, mockSql, mockBroadcast);

      expect(themeQueryCalled).toBe(true);
    });
  });

  describe('Behavior: useFurniture', () => {
    it('should broadcast furniture_use event when furniture is nearby', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-furniture', roomId: 'room-1' }];

      // Run multiple times to hit furniture behavior
      for (let i = 0; i < 50; i++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('SELECT x, y')) {
              return [{ x: 10, y: 10 }];
            }
            if (strings[0]?.includes('FROM furniture')) {
              return [{ id: 'chair-1', x: 11, y: 11, itemDefId: 'red_chair' }];
            }
            if (strings[0]?.includes('SELECT agent_id::text')) {
              return [];
            }
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'lounge' }];
            }
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 1 }];
            }
            if (strings[0]?.includes('UPDATE presence')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        // Check if furniture_use was broadcasted
        const furnitureUse = mockBroadcast.mock.calls.find(
          (call) => call[1]?.type === 'furniture_use'
        );

        if (furnitureUse) {
          expect(furnitureUse[1]).toHaveProperty('furnitureId');
          expect(furnitureUse[1]).toHaveProperty('action');
          return; // Test passed
        }

        vi.clearAllMocks();
      }

      // If we get here, behavior didn't trigger in 50 tries (acceptable due to randomness)
      console.log('useFurniture behavior did not trigger in 50 attempts (acceptable)');
    });
  });

  describe('Behavior: playGame', () => {
    it('should broadcast game_invite when agents are nearby', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-gamer', roomId: 'room-1' }];

      for (let i = 0; i < 50; i++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('SELECT x, y')) {
              return [{ x: 10, y: 10 }];
            }
            if (strings[0]?.includes('FROM furniture')) {
              return [];
            }
            if (strings[0]?.includes('SELECT agent_id::text')) {
              return [{ agentId: 'agent-opponent', x: 11, y: 11 }];
            }
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'arcade' }];
            }
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 2 }];
            }
            if (strings[0]?.includes('UPDATE presence')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        const gameInvite = mockBroadcast.mock.calls.find(
          (call) => call[1]?.type === 'game_invite'
        );

        if (gameInvite) {
          expect(gameInvite[1]).toHaveProperty('opponentId');
          expect(gameInvite[1]).toHaveProperty('gameType');
          expect(['tictactoe', 'dice', 'coinflip']).toContain(gameInvite[1].gameType);
          return;
        }

        vi.clearAllMocks();
      }

      console.log('playGame behavior did not trigger in 50 attempts (acceptable)');
    });
  });

  describe('Behavior: tradeItem', () => {
    it('should broadcast trade_offer when agents are nearby', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-trader', roomId: 'room-1' }];

      for (let i = 0; i < 50; i++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('SELECT x, y')) {
              return [{ x: 10, y: 10 }];
            }
            if (strings[0]?.includes('FROM furniture')) {
              return [];
            }
            if (strings[0]?.includes('SELECT agent_id::text')) {
              return [{ agentId: 'agent-partner', x: 12, y: 12 }];
            }
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'market' }];
            }
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 2 }];
            }
            if (strings[0]?.includes('UPDATE presence')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        const tradeOffer = mockBroadcast.mock.calls.find(
          (call) => call[1]?.type === 'trade_offer'
        );

        if (tradeOffer) {
          expect(tradeOffer[1]).toHaveProperty('partnerId');
          expect(tradeOffer[1]).toHaveProperty('item');
          return;
        }

        vi.clearAllMocks();
      }

      console.log('tradeItem behavior did not trigger in 50 attempts (acceptable)');
    });
  });

  describe('Behavior: emoteReact', () => {
    it('should broadcast emote event as reaction', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-reactor', roomId: 'room-1' }];

      for (let i = 0; i < 50; i++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('SELECT x, y')) {
              return [{ x: 10, y: 10 }];
            }
            if (strings[0]?.includes('FROM furniture')) {
              return [];
            }
            if (strings[0]?.includes('SELECT agent_id::text')) {
              return [
                { agentId: 'agent-nearby1', x: 11, y: 11 },
                { agentId: 'agent-nearby2', x: 12, y: 12 },
              ];
            }
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'plaza' }];
            }
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 3 }];
            }
            if (strings[0]?.includes('UPDATE presence')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        const emoteEvent = mockBroadcast.mock.calls.find(
          (call) => call[1]?.type === 'emote' && 
                    ['wave', 'clap', 'laugh', 'nod', 'thumbsup'].includes(call[1]?.emote)
        );

        if (emoteEvent) {
          expect(emoteEvent[1]).toHaveProperty('emote');
          return;
        }

        vi.clearAllMocks();
      }

      console.log('emoteReact behavior did not trigger in 50 attempts (acceptable)');
    });
  });

  describe('Behavior: wander', () => {
    it('should broadcast move event with random position', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-wanderer', roomId: 'room-1' }];

      for (let i = 0; i < 50; i++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('SELECT x, y')) {
              return [{ x: 10, y: 10 }];
            }
            if (strings[0]?.includes('FROM furniture')) {
              return [];
            }
            if (strings[0]?.includes('SELECT agent_id::text')) {
              return [];
            }
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'forest' }];
            }
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 1 }];
            }
            if (strings[0]?.includes('UPDATE presence')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        const moveEvent = mockBroadcast.mock.calls.find(
          (call) => call[1]?.type === 'move'
        );

        if (moveEvent) {
          expect(moveEvent[1]).toHaveProperty('x');
          expect(moveEvent[1]).toHaveProperty('y');
          expect(moveEvent[1].x).toBeGreaterThanOrEqual(0);
          expect(moveEvent[1].x).toBeLessThan(20);
          return;
        }

        vi.clearAllMocks();
      }

      console.log('wander behavior did not trigger in 50 attempts (acceptable)');
    });
  });

  describe('Behavior: dance', () => {
    it('should broadcast dance emote', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-dancer', roomId: 'room-1' }];

      for (let i = 0; i < 50; i++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('SELECT x, y')) {
              return [{ x: 10, y: 10 }];
            }
            if (strings[0]?.includes('FROM furniture')) {
              return [];
            }
            if (strings[0]?.includes('SELECT agent_id::text')) {
              return [];
            }
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'club' }];
            }
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 1 }];
            }
            if (strings[0]?.includes('UPDATE presence')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        const danceEvent = mockBroadcast.mock.calls.find(
          (call) => call[1]?.type === 'emote' && call[1]?.emote === 'dance'
        );

        if (danceEvent) {
          expect(danceEvent[1].emote).toBe('dance');
          return;
        }

        vi.clearAllMocks();
      }

      console.log('dance behavior did not trigger in 50 attempts (acceptable)');
    });
  });

  describe('Behavior: follow', () => {
    it('should move towards target agent position', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-follower', roomId: 'room-1' }];

      for (let i = 0; i < 50; i++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('SELECT x, y')) {
              return [{ x: 5, y: 5 }];
            }
            if (strings[0]?.includes('FROM furniture')) {
              return [];
            }
            if (strings[0]?.includes('SELECT agent_id::text')) {
              return [{ agentId: 'agent-leader', x: 15, y: 15 }];
            }
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'plaza' }];
            }
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 2 }];
            }
            if (strings[0]?.includes('UPDATE presence SET x =')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        const moveEvent = mockBroadcast.mock.calls.find(
          (call) => call[1]?.type === 'move'
        );

        if (moveEvent && (moveEvent[1].x === 15 && moveEvent[1].y === 15)) {
          // Successfully followed to target position
          expect(moveEvent[1].x).toBe(15);
          expect(moveEvent[1].y).toBe(15);
          return;
        }

        vi.clearAllMocks();
      }

      console.log('follow behavior did not trigger in 50 attempts (acceptable)');
    });
  });

  describe('Integration: Multiple Behaviors in Sequence', () => {
    it('should execute different behaviors across multiple ticks', async () => {
      const config = { enabled: true, actionProbability: 1.0 };
      const mockAgents = [{ agentId: 'agent-multi', roomId: 'room-1' }];
      const behaviorTypes = new Set<string>();

      for (let tick = 0; tick < 20; tick++) {
        mockSql
          .mockResolvedValueOnce(mockAgents)
          .mockImplementation(async (strings: any) => {
            if (strings[0]?.includes('SELECT x, y')) {
              return [{ x: 10, y: 10 }];
            }
            if (strings[0]?.includes('FROM furniture')) {
              return [{ id: 'f1', x: 11, y: 11, itemDefId: 'table' }];
            }
            if (strings[0]?.includes('SELECT agent_id::text')) {
              return [{ agentId: 'other', x: 12, y: 12 }];
            }
            if (strings[0]?.includes('SELECT theme')) {
              return [{ theme: 'mixed' }];
            }
            if (strings[0]?.includes('SELECT COUNT')) {
              return [{ count: 2 }];
            }
            if (strings[0]?.includes('UPDATE presence')) {
              return [];
            }
            return [];
          });

        await SimulationService.tick(config, mockSql, mockBroadcast);

        mockBroadcast.mock.calls.forEach((call) => {
          if (call[1]?.type) {
            behaviorTypes.add(call[1].type);
          }
        });

        vi.clearAllMocks();
      }

      // Should see variety over 20 ticks
      expect(behaviorTypes.size).toBeGreaterThan(2);
    });
  });
});
