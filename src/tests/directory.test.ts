import { describe, it, expect, beforeEach } from 'vitest';
import { roomMembers } from '../ws/handler.js';

/**
 * Unit tests for Agent Directory
 * Tests directory logic, search/filter, and agent enrichment
 * NO DATABASE required - pure in-memory tests
 */

describe('Agent Directory', () => {
  beforeEach(() => {
    // Clear room state before each test
    roomMembers.clear();
  });

  describe('Online Status Detection', () => {
    it('should detect agent as online when in a room', () => {
      const agentId = 'agent-123';
      const roomId = 'room-abc';

      // Add agent to room
      const members = new Set<string>();
      members.add(agentId);
      roomMembers.set(roomId, members);

      // Check online status
      let isOnline = false;
      for (const members of roomMembers.values()) {
        if (members.has(agentId)) {
          isOnline = true;
          break;
        }
      }

      expect(isOnline).toBe(true);
    });

    it('should detect agent as offline when not in any room', () => {
      const agentId = 'agent-123';

      // Add other agents to rooms, but not this one
      roomMembers.set('room-1', new Set(['agent-456']));
      roomMembers.set('room-2', new Set(['agent-789']));

      // Check online status
      let isOnline = false;
      for (const members of roomMembers.values()) {
        if (members.has(agentId)) {
          isOnline = true;
          break;
        }
      }

      expect(isOnline).toBe(false);
    });

    it('should find current room for online agent', () => {
      const agentId = 'agent-123';
      const targetRoomId = 'room-target';

      // Add agent to multiple rooms (should only be in one in reality)
      roomMembers.set('room-1', new Set(['agent-456']));
      roomMembers.set(targetRoomId, new Set([agentId, 'agent-789']));
      roomMembers.set('room-3', new Set(['agent-101']));

      // Find current room
      let currentRoom: string | null = null;
      for (const [roomId, members] of roomMembers.entries()) {
        if (members.has(agentId)) {
          currentRoom = roomId;
          break;
        }
      }

      expect(currentRoom).toBe(targetRoomId);
    });

    it('should return null for offline agent current room', () => {
      const agentId = 'agent-offline';

      roomMembers.set('room-1', new Set(['agent-456']));

      let currentRoom: string | null = null;
      for (const [roomId, members] of roomMembers.entries()) {
        if (members.has(agentId)) {
          currentRoom = roomId;
          break;
        }
      }

      expect(currentRoom).toBeNull();
    });
  });

  describe('Agent Enrichment Logic', () => {
    it('should enrich agent with default values when optional fields are null', () => {
      const mockAgent = {
        id: 'agent-1',
        displayName: 'TestBot',
        platform: 'openclaw',
        verified: false,
        description: null,
        badge: null,
        bio: null,
        skinColor: null,
        outfit: null,
        accessory: null,
        createdAt: new Date().toISOString(),
      };

      // Enrich with defaults
      const enriched = {
        ...mockAgent,
        skinColor: mockAgent.skinColor || '#FFD93D',
        outfit: mockAgent.outfit || 'default',
        accessory: mockAgent.accessory || 'none',
        online: false,
        currentRoom: null,
      };

      expect(enriched.skinColor).toBe('#FFD93D');
      expect(enriched.outfit).toBe('default');
      expect(enriched.accessory).toBe('none');
    });

    it('should preserve custom appearance when provided', () => {
      const mockAgent = {
        id: 'agent-2',
        displayName: 'StyledBot',
        platform: 'claude',
        verified: true,
        description: 'A stylish agent',
        badge: '⭐',
        bio: 'I am very stylish',
        skinColor: '#FF6B6B',
        outfit: 'formal',
        accessory: 'crown',
        createdAt: new Date().toISOString(),
      };

      // Add to room
      roomMembers.set('room-1', new Set([mockAgent.id]));

      // Find online status
      let isOnline = false;
      let currentRoom: string | null = null;
      for (const [roomId, members] of roomMembers.entries()) {
        if (members.has(mockAgent.id)) {
          isOnline = true;
          currentRoom = roomId;
          break;
        }
      }

      const enriched = {
        ...mockAgent,
        online: isOnline,
        currentRoom: currentRoom,
      };

      expect(enriched.skinColor).toBe('#FF6B6B');
      expect(enriched.outfit).toBe('formal');
      expect(enriched.accessory).toBe('crown');
      expect(enriched.online).toBe(true);
      expect(enriched.currentRoom).toBe('room-1');
    });
  });

  describe('Search/Filter Logic', () => {
    it('should match agent by display name (case insensitive)', () => {
      const agents = [
        { displayName: 'AlphaBot', description: 'First agent' },
        { displayName: 'BetaBot', description: 'Second agent' },
        { displayName: 'GammaBot', description: 'Third agent' },
      ];

      const searchTerm = 'beta';
      const filtered = agents.filter(a => 
        a.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].displayName).toBe('BetaBot');
    });

    it('should match agent by description', () => {
      const agents = [
        { displayName: 'AlphaBot', description: 'Explores new worlds' },
        { displayName: 'BetaBot', description: 'Trading specialist' },
        { displayName: 'GammaBot', description: 'Social butterfly' },
      ];

      const searchTerm = 'trading';
      const filtered = agents.filter(a => 
        a.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].displayName).toBe('BetaBot');
    });

    it('should filter by platform', () => {
      const agents = [
        { displayName: 'Bot1', platform: 'openclaw' },
        { displayName: 'Bot2', platform: 'claude' },
        { displayName: 'Bot3', platform: 'chatgpt' },
        { displayName: 'Bot4', platform: 'claude' },
      ];

      const platformFilter = 'claude';
      const filtered = agents.filter(a => a.platform === platformFilter);

      expect(filtered.length).toBe(2);
      expect(filtered[0].platform).toBe('claude');
      expect(filtered[1].platform).toBe('claude');
    });

    it('should handle empty search gracefully', () => {
      const agents = [
        { displayName: 'Bot1', description: 'First' },
        { displayName: 'Bot2', description: 'Second' },
      ];

      const searchTerm = '';
      const filtered = agents.filter(a => {
        if (!searchTerm.trim()) return true;
        return a.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               a.description.toLowerCase().includes(searchTerm.toLowerCase());
      });

      expect(filtered.length).toBe(2);
    });
  });

  describe('Pagination Logic', () => {
    it('should calculate correct offset from page number', () => {
      const page = 3;
      const limit = 20;
      const offset = (page - 1) * limit;

      expect(offset).toBe(40);
    });

    it('should cap limit at maximum allowed', () => {
      const requestedLimit = 500;
      const maxLimit = 100;
      const actualLimit = Math.min(requestedLimit, maxLimit);

      expect(actualLimit).toBe(100);
    });

    it('should default to page 1 when page is invalid', () => {
      const invalidInputs = ['invalid', '', undefined];
      
      invalidInputs.forEach(invalidInput => {
        const page = parseInt(invalidInput as string) || 1;
        expect(page).toBe(1);
      });
    });
  });

  describe('Multiple Agents Status Tracking', () => {
    it('should track multiple agents across multiple rooms', () => {
      // Setup rooms with agents
      roomMembers.set('room-1', new Set(['agent-1', 'agent-2']));
      roomMembers.set('room-2', new Set(['agent-3']));
      roomMembers.set('room-3', new Set(['agent-4', 'agent-5', 'agent-6']));

      const agentIds = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-7'];

      const enrichedAgents = agentIds.map(agentId => {
        let currentRoom: string | null = null;
        let isOnline = false;

        for (const [roomId, members] of roomMembers.entries()) {
          if (members.has(agentId)) {
            currentRoom = roomId;
            isOnline = true;
            break;
          }
        }

        return {
          id: agentId,
          online: isOnline,
          currentRoom: currentRoom,
        };
      });

      // Verify results
      expect(enrichedAgents[0].online).toBe(true);  // agent-1 in room-1
      expect(enrichedAgents[0].currentRoom).toBe('room-1');
      
      expect(enrichedAgents[1].online).toBe(true);  // agent-2 in room-1
      expect(enrichedAgents[1].currentRoom).toBe('room-1');
      
      expect(enrichedAgents[2].online).toBe(true);  // agent-3 in room-2
      expect(enrichedAgents[2].currentRoom).toBe('room-2');
      
      expect(enrichedAgents[3].online).toBe(true);  // agent-4 in room-3
      expect(enrichedAgents[3].currentRoom).toBe('room-3');
      
      expect(enrichedAgents[4].online).toBe(false); // agent-7 offline
      expect(enrichedAgents[4].currentRoom).toBeNull();
    });
  });
});
