import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as roomHoppingService from '../services/RoomHoppingService.js';
import * as presenceService from '../services/presence.js';

// Mock presence service
vi.mock('../services/presence.js', () => ({
  getAgentRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
}));

describe('RoomHoppingService', () => {
  const mockSql = vi.fn() as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSql.mockReset();
  });

  describe('hopAgent', () => {
    it('should move agent from one room to another', async () => {
      const agentId = 'agent-1';
      const currentRoom = 'room-1';
      const targetRoom = 'room-2';

      // Mock current room
      vi.mocked(presenceService.getAgentRoom).mockResolvedValue(currentRoom);

      // Mock available rooms
      mockSql.mockResolvedValue([
        { id: 'room-2', occupants: 2, max_occupants: 10 },
        { id: 'room-3', occupants: 0, max_occupants: 10 },
      ]);

      // Force hop (probability = 1)
      const result = await roomHoppingService.hopAgent(
        agentId,
        { hopProbability: 1.0, preferActiveRooms: false },
        mockSql
      );

      expect(result).not.toBeNull();
      expect(result?.agentId).toBe(agentId);
      expect(result?.fromRoom).toBe(currentRoom);
      expect(['room-2', 'room-3']).toContain(result?.toRoom);

      // Verify presence service calls
      expect(presenceService.leaveRoom).toHaveBeenCalledWith(agentId, currentRoom, mockSql);
      expect(presenceService.joinRoom).toHaveBeenCalled();
    });

    it('should skip hop when probability check fails', async () => {
      const agentId = 'agent-1';

      // Mock current room
      vi.mocked(presenceService.getAgentRoom).mockResolvedValue('room-1');

      // Force skip (probability = 0)
      const result = await roomHoppingService.hopAgent(
        agentId,
        { hopProbability: 0.0 },
        mockSql
      );

      expect(result).toBeNull();
      expect(presenceService.leaveRoom).not.toHaveBeenCalled();
      expect(presenceService.joinRoom).not.toHaveBeenCalled();
    });

    it('should handle agent not in any room', async () => {
      const agentId = 'agent-1';

      // Mock no current room
      vi.mocked(presenceService.getAgentRoom).mockResolvedValue(null);

      // Mock available rooms
      mockSql.mockResolvedValue([
        { id: 'room-1', occupants: 2, max_occupants: 10 },
      ]);

      const result = await roomHoppingService.hopAgent(
        agentId,
        { hopProbability: 1.0 },
        mockSql
      );

      expect(result).not.toBeNull();
      expect(result?.fromRoom).toBeNull();
      expect(result?.toRoom).toBe('room-1');

      // Should NOT call leaveRoom (no current room)
      expect(presenceService.leaveRoom).not.toHaveBeenCalled();
      expect(presenceService.joinRoom).toHaveBeenCalled();
    });

    it('should return null when no available rooms', async () => {
      const agentId = 'agent-1';

      // Mock current room
      vi.mocked(presenceService.getAgentRoom).mockResolvedValue('room-1');

      // Mock no available rooms (only current room exists)
      mockSql.mockResolvedValue([
        { id: 'room-1', occupants: 5, max_occupants: 10 },
      ]);

      const result = await roomHoppingService.hopAgent(
        agentId,
        { hopProbability: 1.0 },
        mockSql
      );

      expect(result).toBeNull();
    });

    it('should prefer active rooms when configured', async () => {
      const agentId = 'agent-1';
      const hopCount = 100; // Run multiple hops to verify weighting

      // Mock current room
      vi.mocked(presenceService.getAgentRoom).mockResolvedValue('room-0');

      // Mock rooms with different occupancy
      mockSql.mockResolvedValue([
        { id: 'room-empty', occupants: 0, max_occupants: 10 }, // Low weight
        { id: 'room-active', occupants: 2, max_occupants: 10 }, // High weight
        { id: 'room-crowded', occupants: 8, max_occupants: 10 }, // Low weight
      ]);

      const roomCounts: Record<string, number> = {
        'room-empty': 0,
        'room-active': 0,
        'room-crowded': 0,
      };

      for (let i = 0; i < hopCount; i++) {
        const result = await roomHoppingService.hopAgent(
          agentId,
          { hopProbability: 1.0, preferActiveRooms: true },
          mockSql
        );

        if (result?.toRoom) {
          roomCounts[result.toRoom] = (roomCounts[result.toRoom] || 0) + 1;
        }
      }

      // Active room should be picked most often
      expect(roomCounts['room-active']).toBeGreaterThan(roomCounts['room-empty']);
      expect(roomCounts['room-active']).toBeGreaterThan(roomCounts['room-crowded']);
    });
  });

  describe('tick', () => {
    it('should process multiple agents', async () => {
      // Mock active agents
      mockSql.mockResolvedValueOnce([
        { agent_id: 'agent-1' },
        { agent_id: 'agent-2' },
        { agent_id: 'agent-3' },
      ]);

      // Mock rooms (for all agents)
      mockSql.mockResolvedValue([
        { id: 'room-1', occupants: 1, max_occupants: 10 },
        { id: 'room-2', occupants: 2, max_occupants: 10 },
      ]);

      // Mock getAgentRoom for all agents
      vi.mocked(presenceService.getAgentRoom).mockResolvedValue('room-0');

      const results = await roomHoppingService.tick(
        { hopProbability: 1.0 },
        mockSql
      );

      // All 3 agents should hop
      expect(results.length).toBe(3);
      expect(results[0].agentId).toBe('agent-1');
      expect(results[1].agentId).toBe('agent-2');
      expect(results[2].agentId).toBe('agent-3');
    });

    it('should return empty array when disabled', async () => {
      const results = await roomHoppingService.tick(
        { enabled: false },
        mockSql
      );

      expect(results).toEqual([]);
    });

    it('should handle agent hop failures gracefully', async () => {
      // Mock active agents
      mockSql.mockResolvedValueOnce([
        { agent_id: 'agent-1' },
        { agent_id: 'agent-2' },
      ]);

      // Mock rooms
      mockSql.mockResolvedValue([
        { id: 'room-1', occupants: 1, max_occupants: 10 },
      ]);

      // First agent succeeds
      vi.mocked(presenceService.getAgentRoom).mockResolvedValueOnce('room-0');

      // Second agent fails (simulate error)
      vi.mocked(presenceService.getAgentRoom).mockRejectedValueOnce(
        new Error('Database error')
      );

      const results = await roomHoppingService.tick(
        { hopProbability: 1.0 },
        mockSql
      );

      // Only first agent should succeed
      expect(results.length).toBe(1);
      expect(results[0].agentId).toBe('agent-1');
    });
  });

  describe('startLoop and stopLoop', () => {
    it('should create and clear interval', () => {
      // Simple test: verify interval is created and cleared
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const interval = roomHoppingService.startLoop(
        { intervalMs: 5000 },
        mockSql
      );

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      expect(interval).toBeDefined();

      roomHoppingService.stopLoop(interval);
      expect(clearIntervalSpy).toHaveBeenCalledWith(interval);

      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });
});
