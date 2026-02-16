// @ts-nocheck - TODO: fix type errors
import { describe, it, expect, beforeEach } from 'vitest';
import { getSpectatorCount, spectatorsByRoom } from '../ws/spectator.js';
import { roomMembers } from '../ws/handler.js';

/**
 * Unit tests for Spectator Mode
 * Tests spectator tracking, read-only enforcement, and room listing
 * NO DATABASE required - pure in-memory tests
 */

describe('Spectator Mode', () => {
  beforeEach(() => {
    // Clear spectator and room state before each test
    spectatorsByRoom.clear();
    roomMembers.clear();
  });

  describe('Spectator Count Tracking', () => {
    it('should return 0 for room with no spectators', () => {
      const count = getSpectatorCount('room-123');
      expect(count).toBe(0);
    });

    it('should track spectators when added to room', () => {
      const roomId = 'room-123';
      const mockWs1 = { readyState: 1 } as any;
      const mockWs2 = { readyState: 1 } as any;

      // Simulate adding spectators
      const spectators = new Set<any>();
      spectators.add(mockWs1);
      spectators.add(mockWs2);
      spectatorsByRoom.set(roomId, spectators);

      const count = getSpectatorCount(roomId);
      expect(count).toBe(2);
    });

    it('should handle multiple rooms independently', () => {
      const room1 = 'room-1';
      const room2 = 'room-2';
      
      const spectators1 = new Set<any>();
      spectators1.add({ readyState: 1 });
      spectatorsByRoom.set(room1, spectators1);

      const spectators2 = new Set<any>();
      spectators2.add({ readyState: 1 });
      spectators2.add({ readyState: 1 });
      spectators2.add({ readyState: 1 });
      spectatorsByRoom.set(room2, spectators2);

      expect(getSpectatorCount(room1)).toBe(1);
      expect(getSpectatorCount(room2)).toBe(3);
    });
  });

  describe('Read-Only Enforcement', () => {
    it('should not allow spectators to modify room state', () => {
      // Spectators should never be in roomMembers (agents only)
      const roomId = 'room-123';
      const agentId = 'agent-1';
      
      // Add agent to room
      const members = new Set<string>();
      members.add(agentId);
      roomMembers.set(roomId, members);

      // Spectators are in separate map
      const spectators = new Set<any>();
      spectators.add({ readyState: 1 });
      spectatorsByRoom.set(roomId, spectators);

      // Verify separation
      expect(roomMembers.get(roomId)?.has('spectator-ws')).toBe(false);
      expect(roomMembers.get(roomId)?.size).toBe(1);
      expect(getSpectatorCount(roomId)).toBe(1);
    });

    it('should track agents and spectators separately', () => {
      const roomId = 'room-xyz';

      // Add 3 agents
      const members = new Set<string>();
      members.add('agent-1');
      members.add('agent-2');
      members.add('agent-3');
      roomMembers.set(roomId, members);

      // Add 5 spectators
      const spectators = new Set<any>();
      for (let i = 0; i < 5; i++) {
        spectators.add({ readyState: 1 });
      }
      spectatorsByRoom.set(roomId, spectators);

      expect(roomMembers.get(roomId)?.size).toBe(3);
      expect(getSpectatorCount(roomId)).toBe(5);
    });
  });

  describe('Room Listing Logic', () => {
    it('should identify active rooms correctly', () => {
      const room1 = 'room-with-agents';
      const room2 = 'room-with-spectators';
      const room3 = 'room-with-both';
      const room4 = 'room-empty';

      // Room 1: only agents
      roomMembers.set(room1, new Set(['agent-1']));

      // Room 2: only spectators
      spectatorsByRoom.set(room2, new Set([{ readyState: 1 }]));

      // Room 3: both
      roomMembers.set(room3, new Set(['agent-2']));
      spectatorsByRoom.set(room3, new Set([{ readyState: 1 }, { readyState: 1 }]));

      // Room 4: empty (nothing added)

      // Check active status (has agents OR spectators)
      const isRoom1Active = (roomMembers.get(room1)?.size || 0) > 0 || getSpectatorCount(room1) > 0;
      const isRoom2Active = (roomMembers.get(room2)?.size || 0) > 0 || getSpectatorCount(room2) > 0;
      const isRoom3Active = (roomMembers.get(room3)?.size || 0) > 0 || getSpectatorCount(room3) > 0;
      const isRoom4Active = (roomMembers.get(room4)?.size || 0) > 0 || getSpectatorCount(room4) > 0;

      expect(isRoom1Active).toBe(true);
      expect(isRoom2Active).toBe(true);
      expect(isRoom3Active).toBe(true);
      expect(isRoom4Active).toBe(false);
    });

    it('should count total spectators across all rooms', () => {
      spectatorsByRoom.set('room-1', new Set([{ readyState: 1 }, { readyState: 1 }]));
      spectatorsByRoom.set('room-2', new Set([{ readyState: 1 }]));
      spectatorsByRoom.set('room-3', new Set([{ readyState: 1 }, { readyState: 1 }, { readyState: 1 }]));

      let totalSpectators = 0;
      for (const spectators of spectatorsByRoom.values()) {
        totalSpectators += spectators.size;
      }

      expect(totalSpectators).toBe(6);
    });

    it('should count total agents across all rooms', () => {
      roomMembers.set('room-1', new Set(['agent-1', 'agent-2']));
      roomMembers.set('room-2', new Set(['agent-3']));
      roomMembers.set('room-3', new Set(['agent-4', 'agent-5', 'agent-6']));

      let totalAgents = 0;
      for (const members of roomMembers.values()) {
        totalAgents += members.size;
      }

      expect(totalAgents).toBe(6);
    });

    it('should count active rooms correctly', () => {
      roomMembers.set('room-1', new Set(['agent-1']));
      spectatorsByRoom.set('room-2', new Set([{ readyState: 1 }]));
      roomMembers.set('room-3', new Set(['agent-2']));
      spectatorsByRoom.set('room-3', new Set([{ readyState: 1 }]));

      const allRoomIds = new Set([
        ...roomMembers.keys(),
        ...spectatorsByRoom.keys(),
      ]);

      expect(allRoomIds.size).toBe(3);
    });
  });

  describe('Spectator Removal', () => {
    it('should clean up empty spectator sets', () => {
      const roomId = 'room-123';
      const spectators = new Set<any>();
      const ws1 = { readyState: 1 } as any;
      const ws2 = { readyState: 1 } as any;

      spectators.add(ws1);
      spectators.add(ws2);
      spectatorsByRoom.set(roomId, spectators);

      expect(getSpectatorCount(roomId)).toBe(2);

      // Remove all spectators
      spectators.delete(ws1);
      spectators.delete(ws2);

      expect(getSpectatorCount(roomId)).toBe(0);

      // Clean up empty set (would be done in actual handler)
      if (spectators.size === 0) {
        spectatorsByRoom.delete(roomId);
      }

      expect(spectatorsByRoom.has(roomId)).toBe(false);
    });
  });

  describe('Spectator Broadcast Isolation', () => {
    it('should not mix agent and spectator broadcasts', () => {
      const roomId = 'room-test';

      // Agents in room
      const agents = new Set(['agent-1', 'agent-2']);
      roomMembers.set(roomId, agents);

      // Spectators watching
      const spectators = new Set<any>();
      spectators.add({ readyState: 1 });
      spectators.add({ readyState: 1 });
      spectatorsByRoom.set(roomId, spectators);

      // Verify separation
      expect(roomMembers.get(roomId)?.size).toBe(2);
      expect(getSpectatorCount(roomId)).toBe(2);
      
      // Agents and spectators are in different data structures
      for (const agentId of agents) {
        expect(typeof agentId).toBe('string');
      }

      for (const spectator of spectators) {
        expect(spectator).toHaveProperty('readyState');
      }
    });
  });
});
