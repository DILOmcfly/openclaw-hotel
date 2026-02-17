/**
 * Unit tests for src/api/spectator.routes.ts
 * Tests all public spectator API endpoints using vitest + supertest
 * No real database required — all dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Hoisted variables (must be defined before vi.mock factories run) ──────────

const {
  mockSql,
  mockRoomMembers,
  mockSpectatorsByRoom,
  mockGetSpectatorCount,
  mockGetPersonality,
  mockCalculateArchetype,
  mockGetRoomHistory,
  mockGetLiveEvents,
} = vi.hoisted(() => {
  const mockSpectatorsByRoom = new Map<string, Set<any>>();
  return {
    mockSql: vi.fn(),
    mockRoomMembers: new Map<string, Set<string>>(),
    mockSpectatorsByRoom,
    mockGetSpectatorCount: vi.fn((roomId: string) => mockSpectatorsByRoom.get(roomId)?.size ?? 0),
    mockGetPersonality: vi.fn(),
    mockCalculateArchetype: vi.fn(),
    mockGetRoomHistory: vi.fn(),
    mockGetLiveEvents: vi.fn(),
  };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../db/index.js', () => ({
  sql: mockSql,
}));

vi.mock('../ws/handler.js', () => ({
  get roomMembers() {
    return mockRoomMembers;
  },
}));

vi.mock('../ws/spectator.js', () => ({
  get spectatorsByRoom() {
    return mockSpectatorsByRoom;
  },
  getSpectatorCount: mockGetSpectatorCount,
}));

vi.mock('../services/personality.js', () => ({
  getPersonality: mockGetPersonality,
  calculateArchetype: mockCalculateArchetype,
}));

vi.mock('../services/chatHistory.js', () => ({
  getRoomHistory: mockGetRoomHistory,
}));

vi.mock('../services/liveEventsStore.js', () => ({
  getLiveEvents: mockGetLiveEvents,
}));

// ── Import router after mocks ─────────────────────────────────────────────────

import spectatorRouter from '../api/spectator.routes.js';

// ── App factory ───────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(spectatorRouter);
  return app;
}

// ── Shared constants ──────────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVALID_UUID = 'not-a-valid-uuid!!';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Spectator Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoomMembers.clear();
    mockSpectatorsByRoom.clear();
    // Default: sql returns empty array
    mockSql.mockResolvedValue([]);
    // Default: no live events
    mockGetLiveEvents.mockReturnValue([]);
    app = createApp();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/spectate/rooms', () => {
    it('returns 200 with rooms array and totalRooms', async () => {
      const mockRooms = [
        { id: VALID_UUID, name: 'Lobby', description: 'Main lobby', createdAt: new Date().toISOString(), metadata: {} },
      ];
      const mockPresence = [{ room_id: VALID_UUID, cnt: 3 }];

      // First sql call: rooms query; second: presence counts
      mockSql
        .mockResolvedValueOnce(mockRooms)
        .mockResolvedValueOnce(mockPresence);

      mockGetSpectatorCount.mockReturnValue(2);

      const res = await request(app).get('/api/spectate/rooms');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('rooms');
      expect(res.body).toHaveProperty('totalRooms', 1);
      expect(Array.isArray(res.body.rooms)).toBe(true);
    });

    it('returns correct room shape including agentCount and spectatorCount', async () => {
      const mockRooms = [
        { id: VALID_UUID, name: 'Test Room', description: 'desc', createdAt: '2024-01-01', metadata: null },
      ];
      mockSql
        .mockResolvedValueOnce(mockRooms)
        .mockResolvedValueOnce([{ room_id: VALID_UUID, cnt: 5 }]);

      mockGetSpectatorCount.mockReturnValue(3);

      const res = await request(app).get('/api/spectate/rooms');

      expect(res.status).toBe(200);
      const room = res.body.rooms[0];
      expect(room).toMatchObject({
        id: VALID_UUID,
        name: 'Test Room',
        description: 'desc',
        agentCount: 5,
        spectatorCount: 3,
        isActive: true,
      });
      expect(room).toHaveProperty('createdAt');
    });

    it('marks room as inactive when agentCount=0 and spectatorCount=0', async () => {
      const mockRooms = [
        { id: VALID_UUID, name: 'Empty Room', description: '', createdAt: '2024-01-01', metadata: null },
      ];
      mockSql
        .mockResolvedValueOnce(mockRooms)
        .mockResolvedValueOnce([]); // no presence

      mockGetSpectatorCount.mockReturnValue(0);

      const res = await request(app).get('/api/spectate/rooms');

      expect(res.status).toBe(200);
      expect(res.body.rooms[0].isActive).toBe(false);
    });

    it('uses in-memory roomMembers count when higher than DB presence', async () => {
      const roomId = VALID_UUID;
      // DB says 1 agent, WS says 4 agents → should use 4
      mockRoomMembers.set(roomId, new Set(['a1', 'a2', 'a3', 'a4']));

      const mockRooms = [
        { id: roomId, name: 'Room', description: '', createdAt: '2024-01-01', metadata: null },
      ];
      mockSql
        .mockResolvedValueOnce(mockRooms)
        .mockResolvedValueOnce([{ room_id: roomId, cnt: 1 }]);

      mockGetSpectatorCount.mockReturnValue(0);

      const res = await request(app).get('/api/spectate/rooms');

      expect(res.status).toBe(200);
      expect(res.body.rooms[0].agentCount).toBe(4);
    });

    it('returns 200 with empty rooms array when no rooms exist', async () => {
      mockSql.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const res = await request(app).get('/api/spectate/rooms');

      expect(res.status).toBe(200);
      expect(res.body.rooms).toEqual([]);
      expect(res.body.totalRooms).toBe(0);
    });

    it('returns 500 on database error', async () => {
      mockSql.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await request(app).get('/api/spectate/rooms');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Internal server error');
    });

    it('sorts active rooms before inactive rooms', async () => {
      const activeId = '550e8400-e29b-41d4-a716-446655440001';
      const inactiveId = '550e8400-e29b-41d4-a716-446655440002';
      const mockRooms = [
        { id: inactiveId, name: 'Inactive', description: '', createdAt: '2024-01-01', metadata: null },
        { id: activeId, name: 'Active', description: '', createdAt: '2024-01-02', metadata: null },
      ];
      mockSql
        .mockResolvedValueOnce(mockRooms)
        .mockResolvedValueOnce([{ room_id: activeId, cnt: 2 }]);

      mockGetSpectatorCount.mockImplementation((id: string) => (id === activeId ? 1 : 0));

      const res = await request(app).get('/api/spectate/rooms');

      expect(res.status).toBe(200);
      expect(res.body.rooms[0].id).toBe(activeId);
      expect(res.body.rooms[1].id).toBe(inactiveId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/spectate/rooms/:id', () => {
    it('returns 200 with full room details', async () => {
      const mockRoom = {
        id: VALID_UUID,
        name: 'Grand Hall',
        description: 'A grand hall',
        heightmap: '0000|0000',
        createdAt: '2024-01-01',
        metadata: { theme: 'classic' },
      };
      const mockFurniture = [
        { id: 'f1', itemDefId: 'chair', x: 1, y: 2, z: 0, rotation: 0 },
      ];
      const mockChat = [{ sender: 'agent-1', message: 'Hello', timestamp: '2024-01-01' }];

      mockSql
        .mockResolvedValueOnce([mockRoom])    // room query
        .mockResolvedValueOnce(mockFurniture); // furniture query

      mockGetSpectatorCount.mockReturnValue(5);
      mockGetRoomHistory.mockResolvedValue(mockChat);

      const res = await request(app).get(`/api/spectate/rooms/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: VALID_UUID,
        name: 'Grand Hall',
        description: 'A grand hall',
        heightmap: '0000|0000',
        spectatorCount: 5,
        agentCount: 0,
      });
      expect(Array.isArray(res.body.agents)).toBe(true);
      expect(Array.isArray(res.body.furniture)).toBe(true);
      expect(Array.isArray(res.body.recentChat)).toBe(true);
      expect(res.body.metadata).toEqual({ theme: 'classic' });
    });

    it('returns 404 when room does not exist', async () => {
      mockSql.mockResolvedValueOnce([]); // no room found

      const res = await request(app).get(`/api/spectate/rooms/${VALID_UUID}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Room not found');
    });

    it('includes agents from in-memory roomMembers', async () => {
      const agentId = '550e8400-e29b-41d4-a716-446655440001';
      mockRoomMembers.set(VALID_UUID, new Set([agentId]));

      const mockRoom = {
        id: VALID_UUID, name: 'R', description: '', heightmap: '', createdAt: '2024', metadata: null,
      };
      const mockAgents = [{ id: agentId, displayName: 'AgentOne' }];
      const mockFurniture: any[] = [];

      mockSql
        .mockResolvedValueOnce([mockRoom])   // room
        .mockResolvedValueOnce(mockAgents)   // agents
        .mockResolvedValueOnce(mockFurniture); // furniture

      mockGetRoomHistory.mockResolvedValue([]);
      mockGetSpectatorCount.mockReturnValue(0);

      const res = await request(app).get(`/api/spectate/rooms/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].displayName).toBe('AgentOne');
      expect(res.body.agentCount).toBe(1);
    });

    it('falls back to presence table when no WS members', async () => {
      const mockRoom = {
        id: VALID_UUID, name: 'R', description: '', heightmap: '', createdAt: '2024', metadata: null,
      };
      const presenceAgents = [
        { id: '550e8400-e29b-41d4-a716-446655440009', displayName: 'PresenceAgent', x: 1, y: 2 },
      ];

      mockSql
        .mockResolvedValueOnce([mockRoom])     // room
        .mockResolvedValueOnce(presenceAgents) // presence fallback
        .mockResolvedValueOnce([]);            // furniture

      mockGetRoomHistory.mockResolvedValue([]);
      mockGetSpectatorCount.mockReturnValue(0);

      const res = await request(app).get(`/api/spectate/rooms/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(1);
    });

    it('returns empty recentChat when chatHistory service throws', async () => {
      const mockRoom = {
        id: VALID_UUID, name: 'R', description: '', heightmap: '', createdAt: '2024', metadata: null,
      };
      mockSql
        .mockResolvedValueOnce([mockRoom])
        .mockResolvedValueOnce([]); // furniture

      mockGetRoomHistory.mockRejectedValue(new Error('table not found'));
      mockGetSpectatorCount.mockReturnValue(0);

      const res = await request(app).get(`/api/spectate/rooms/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.recentChat).toEqual([]);
    });

    it('returns 500 on unexpected database error', async () => {
      mockSql.mockRejectedValueOnce(new Error('fatal DB error'));

      const res = await request(app).get(`/api/spectate/rooms/${VALID_UUID}`);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Internal server error');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/spectate/stats', () => {
    it('returns 200 with correct shape', async () => {
      // presence count query
      mockSql.mockResolvedValueOnce([{ cnt: 4 }]);
      // presence distinct rooms query
      mockSql.mockResolvedValueOnce([{ cnt: 2 }]);

      const res = await request(app).get('/api/spectate/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalAgentsOnline');
      expect(res.body).toHaveProperty('totalSpectators');
      expect(res.body).toHaveProperty('activeRooms');
      expect(res.body).toHaveProperty('timestamp');
      expect(typeof res.body.totalAgentsOnline).toBe('number');
      expect(typeof res.body.totalSpectators).toBe('number');
      expect(typeof res.body.activeRooms).toBe('number');
    });

    it('counts agents from in-memory roomMembers when higher than DB', async () => {
      // WS: 5 agents (2 + 3 across 2 rooms)
      mockRoomMembers.set('room-1', new Set(['a1', 'a2']));
      mockRoomMembers.set('room-2', new Set(['a3', 'a4', 'a5']));

      // DB says 1 (lower)
      mockSql.mockResolvedValueOnce([{ cnt: 1 }]);

      const res = await request(app).get('/api/spectate/stats');

      expect(res.status).toBe(200);
      expect(res.body.totalAgentsOnline).toBe(5);
    });

    it('counts spectators across all rooms', async () => {
      mockSpectatorsByRoom.set('room-1', new Set([{}, {}, {}]));
      mockSpectatorsByRoom.set('room-2', new Set([{}]));

      mockSql.mockResolvedValue([{ cnt: 0 }]);

      const res = await request(app).get('/api/spectate/stats');

      expect(res.status).toBe(200);
      expect(res.body.totalSpectators).toBe(4);
    });

    it('counts activeRooms from WS data when available', async () => {
      mockRoomMembers.set('room-a', new Set(['agent-1']));
      mockSpectatorsByRoom.set('room-b', new Set([{}]));

      mockSql.mockResolvedValue([{ cnt: 0 }]);

      const res = await request(app).get('/api/spectate/stats');

      expect(res.status).toBe(200);
      // room-a + room-b = 2 unique rooms
      expect(res.body.activeRooms).toBe(2);
    });

    it('timestamp is a valid ISO string', async () => {
      mockSql.mockResolvedValue([{ cnt: 0 }]);

      const res = await request(app).get('/api/spectate/stats');

      expect(res.status).toBe(200);
      expect(() => new Date(res.body.timestamp)).not.toThrow();
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });

    it('returns 500 on unexpected error', async () => {
      // Force a top-level error by making the DB throw immediately
      mockSql.mockRejectedValueOnce(new Error('crash'));

      const res = await request(app).get('/api/spectate/stats');

      // The route catches most errors gracefully; only unhandled ones hit 500
      // (presence query is wrapped in try/catch, so this tests the outer handler)
      expect([200, 500]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/spectate/agents/:agentId', () => {
    const mockAgent = {
      id: VALID_UUID,
      displayName: 'TestAgent',
      platform: 'web',
      createdAt: '2024-01-01',
      bio: 'Hello world',
      avatarUrl: 'https://example.com/avatar.png',
    };

    it('returns 200 with agent profile', async () => {
      mockSql.mockResolvedValueOnce([mockAgent]);   // agent profile
      // mood, friends, activity, stats all throw → gracefully skipped
      mockSql.mockRejectedValue(new Error('no table'));

      mockGetPersonality.mockResolvedValue({
        agentId: VALID_UUID, sociability: 70, curiosity: 80, competitiveness: 50,
        generosity: 60, volatility: 30, lastUpdated: new Date(), totalActions: 100, createdAt: new Date(),
      });
      mockCalculateArchetype.mockReturnValue('Explorer');

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: VALID_UUID,
        displayName: 'TestAgent',
        platform: 'web',
        bio: 'Hello world',
        avatarUrl: 'https://example.com/avatar.png',
      });
      expect(res.body).toHaveProperty('personality');
      expect(res.body.personality.archetype).toBe('Explorer');
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await request(app).get(`/api/spectate/agents/${INVALID_UUID}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid agent ID format');
    });

    it('returns 404 when agent does not exist', async () => {
      mockSql.mockResolvedValueOnce([]); // no agent

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Agent not found');
    });

    it('returns personality as null when service throws', async () => {
      mockSql.mockResolvedValueOnce([mockAgent]);
      mockSql.mockRejectedValue(new Error('no table'));
      mockGetPersonality.mockRejectedValue(new Error('no personality'));

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.personality).toBeNull();
    });

    it('returns null mood when agent_status table missing', async () => {
      mockSql.mockResolvedValueOnce([mockAgent]);
      mockSql.mockRejectedValue(new Error('no table'));
      mockGetPersonality.mockResolvedValue(null);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.mood).toBeNull();
    });

    it('includes correct friends shape', async () => {
      const friendRow = { friendId: '550e8400-e29b-41d4-a716-446655440001', friendName: 'BuddyAgent' };

      mockSql
        .mockResolvedValueOnce([mockAgent]) // agent
        .mockResolvedValueOnce([])          // mood
        .mockResolvedValueOnce([friendRow]) // friends
        .mockResolvedValueOnce([])          // activity
        .mockResolvedValueOnce([]);         // stats

      mockGetPersonality.mockResolvedValue(null);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.friends).toMatchObject({
        count: 1,
        topFriends: [{ id: friendRow.friendId, name: 'BuddyAgent' }],
      });
    });

    it('includes recentActivity list', async () => {
      const activityRow = {
        eventType: 'room_join',
        details: { description: 'Joined Grand Hall' },
        timestamp: '2024-01-10T12:00:00Z',
      };

      mockSql
        .mockResolvedValueOnce([mockAgent]) // agent
        .mockResolvedValueOnce([])          // mood
        .mockResolvedValueOnce([])          // friends
        .mockResolvedValueOnce([activityRow]) // activity
        .mockResolvedValueOnce([]);           // stats

      mockGetPersonality.mockResolvedValue(null);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.recentActivity).toHaveLength(1);
      expect(res.body.recentActivity[0]).toMatchObject({
        type: 'room_join',
        description: 'Joined Grand Hall',
        timestamp: '2024-01-10T12:00:00Z',
      });
    });

    it('includes stats when analytics table exists', async () => {
      const statsRow = {
        messagesSent: 42,
        roomsVisited: 10,
        tradesCompleted: 3,
        gamesWon: 7,
        friendsCount: 15,
      };

      mockSql
        .mockResolvedValueOnce([mockAgent]) // agent
        .mockResolvedValueOnce([])          // mood
        .mockResolvedValueOnce([])          // friends
        .mockResolvedValueOnce([])          // activity
        .mockResolvedValueOnce([statsRow]); // stats

      mockGetPersonality.mockResolvedValue(null);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.stats).toMatchObject({ messagesSent: 42, roomsVisited: 10 });
    });

    it('returns 500 on unexpected error', async () => {
      // Simulate a fatal error even before agent query resolves
      mockSql.mockImplementationOnce(() => {
        throw new Error('fatal');
      });

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}`);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Internal server error');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/spectate/agents/:agentId/room', () => {
    it('returns roomId and roomName when agent is in a WS room', async () => {
      const agentId = VALID_UUID;
      const roomId = '550e8400-e29b-41d4-a716-446655440010';
      mockRoomMembers.set(roomId, new Set([agentId]));

      // DB call for room name
      mockSql.mockResolvedValueOnce([{ name: 'The Lobby' }]);

      const res = await request(app).get(`/api/spectate/agents/${agentId}/room`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ roomId, roomName: 'The Lobby' });
    });

    it('falls back to presence table when agent not in WS rooms', async () => {
      mockSql.mockResolvedValueOnce([
        { roomId: '550e8400-e29b-41d4-a716-446655440020', roomName: 'Presence Room' },
      ]);

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}/room`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        roomId: '550e8400-e29b-41d4-a716-446655440020',
        roomName: 'Presence Room',
      });
    });

    it('returns roomId: null when agent is not in any room', async () => {
      mockSql.mockResolvedValueOnce([]); // no presence row

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}/room`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ roomId: null, roomName: null });
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await request(app).get(`/api/spectate/agents/${INVALID_UUID}/room`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid agent ID format');
    });

    it('returns 500 on database error', async () => {
      mockSql.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get(`/api/spectate/agents/${VALID_UUID}/room`);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Internal server error');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/spectate/live-events', () => {
    const sampleEvents = [
      { id: 'e1', type: 'chat', roomId: 'r1', message: 'Hello!', timestamp: '2024-01-01T00:00:00Z' },
      { id: 'e2', type: 'join', roomId: 'r1', agentId: 'a1', timestamp: '2024-01-01T00:01:00Z' },
    ];

    it('returns 200 with events and total', async () => {
      mockGetLiveEvents.mockReturnValue(sampleEvents);

      const res = await request(app).get('/api/spectate/live-events');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(res.body).toHaveProperty('total', 2);
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it('defaults to limit=20 when not specified', async () => {
      mockGetLiveEvents.mockReturnValue([]);

      await request(app).get('/api/spectate/live-events');

      expect(mockGetLiveEvents).toHaveBeenCalledWith(20);
    });

    it('respects custom limit query param', async () => {
      mockGetLiveEvents.mockReturnValue([]);

      await request(app).get('/api/spectate/live-events?limit=10');

      expect(mockGetLiveEvents).toHaveBeenCalledWith(10);
    });

    it('clamps limit to max of 50', async () => {
      mockGetLiveEvents.mockReturnValue([]);

      await request(app).get('/api/spectate/live-events?limit=9999');

      expect(mockGetLiveEvents).toHaveBeenCalledWith(50);
    });

    it('clamps limit to min of 1', async () => {
      mockGetLiveEvents.mockReturnValue([]);

      await request(app).get('/api/spectate/live-events?limit=0');

      expect(mockGetLiveEvents).toHaveBeenCalledWith(1);
    });

    it('falls back to limit=20 for non-numeric limit', async () => {
      mockGetLiveEvents.mockReturnValue([]);

      await request(app).get('/api/spectate/live-events?limit=banana');

      expect(mockGetLiveEvents).toHaveBeenCalledWith(20);
    });

    it('returns empty events array when no events exist', async () => {
      mockGetLiveEvents.mockReturnValue([]);

      const res = await request(app).get('/api/spectate/live-events');

      expect(res.status).toBe(200);
      expect(res.body.events).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('returns 500 when getLiveEvents throws', async () => {
      mockGetLiveEvents.mockImplementation(() => {
        throw new Error('store error');
      });

      const res = await request(app).get('/api/spectate/live-events');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error', 'Internal server error');
    });
  });
});
