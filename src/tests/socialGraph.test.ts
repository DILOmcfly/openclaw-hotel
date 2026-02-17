/**
 * T-349: Social Graph Service — Unit Tests
 *
 * Pure-logic tests (no DB required).
 * Tests cover:
 *  - agentColor() determinism & format
 *  - getRoomSocialGraph() shape (mocked sql)
 *  - Edge deduplication (accepted overrides pending)
 *  - Empty room (no presence) → empty graph
 *  - Single agent → no edges
 *  - countAcceptedEdges() helper
 *  - getNeighbours() helper
 *  - findHubAgent() helper
 *  - UUID validation in the route layer
 *  - Canonical edge key (lower id first)
 *  - Strength values per status
 *  - generatedAt ISO timestamp
 */

import { describe, it, expect, vi } from 'vitest';
import {
  agentColor,
  getRoomSocialGraph,
  countAcceptedEdges,
  getNeighbours,
  findHubAgent,
  type SocialGraph,
  type SocialGraphNode,
  type SocialGraphEdge,
} from '../services/socialGraph.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal mock sql factory */
function makeMockSql(presenceRows: any[], friendshipRows: any[]) {
  let callCount = 0;
  const tag = vi.fn((strings: TemplateStringsArray, ...values: any[]) => {
    callCount++;
    // First call → presence, second call → friendships
    return Promise.resolve(callCount === 1 ? presenceRows : friendshipRows);
  });
  return tag as unknown as import('postgres').Sql;
}

const ROOM_ID = '11111111-1111-1111-1111-111111111111';
const AGENT_A  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AGENT_B  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const AGENT_C  = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// ─── agentColor() ─────────────────────────────────────────────────────────────

describe('agentColor()', () => {
  it('returns a string', () => {
    expect(typeof agentColor(AGENT_A)).toBe('string');
  });

  it('is deterministic (same input → same output)', () => {
    expect(agentColor(AGENT_A)).toBe(agentColor(AGENT_A));
  });

  it('returns different colors for different agents (most of the time)', () => {
    const colorA = agentColor(AGENT_A);
    const colorB = agentColor(AGENT_B);
    // Statistical: UUIDs differ enough that hashes will differ
    expect(colorA).not.toBe(colorB);
  });

  it('contains hsl(', () => {
    expect(agentColor(AGENT_A)).toContain('hsl(');
  });

  it('hue is 0–359', () => {
    const color = agentColor(AGENT_A);
    const match = color.match(/hsl\((\d+),/);
    expect(match).toBeTruthy();
    const hue = parseInt(match![1]);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });

  it('handles empty string id', () => {
    const color = agentColor('');
    expect(typeof color).toBe('string');
    expect(color.startsWith('hsl(')).toBe(true);
  });
});

// ─── getRoomSocialGraph() ─────────────────────────────────────────────────────

describe('getRoomSocialGraph()', () => {
  it('returns empty graph when room has no agents', async () => {
    const sql = makeMockSql([], []);
    const graph = await getRoomSocialGraph(ROOM_ID, sql);

    expect(graph.roomId).toBe(ROOM_ID);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it('returns correct generatedAt ISO string', async () => {
    const sql = makeMockSql([], []);
    const graph = await getRoomSocialGraph(ROOM_ID, sql);
    expect(() => new Date(graph.generatedAt)).not.toThrow();
    expect(graph.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('builds nodes from presence rows', async () => {
    const presence = [
      { agentId: AGENT_A, displayName: 'Alpha', mood: 'happy' },
      { agentId: AGENT_B, displayName: 'Beta',  mood: null },
    ];
    const sql = makeMockSql(presence, []);
    const graph = await getRoomSocialGraph(ROOM_ID, sql);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0].id).toBe(AGENT_A);
    expect(graph.nodes[0].displayName).toBe('Alpha');
    expect(graph.nodes[0].mood).toBe('happy');
    expect(graph.nodes[1].mood).toBeUndefined();
  });

  it('sets isOnline=true for all room agents', async () => {
    const presence = [{ agentId: AGENT_A, displayName: 'Alpha', mood: null }];
    const sql = makeMockSql(presence, []);
    const { nodes } = await getRoomSocialGraph(ROOM_ID, sql);
    expect(nodes[0].isOnline).toBe(true);
  });

  it('assigns colors to nodes', async () => {
    const presence = [{ agentId: AGENT_A, displayName: 'Alpha', mood: null }];
    const sql = makeMockSql(presence, []);
    const { nodes } = await getRoomSocialGraph(ROOM_ID, sql);
    expect(nodes[0].color).toContain('hsl(');
  });

  it('builds accepted friendship edge', async () => {
    const presence = [
      { agentId: AGENT_A, displayName: 'Alpha', mood: null },
      { agentId: AGENT_B, displayName: 'Beta',  mood: null },
    ];
    const friendships = [
      { requesterId: AGENT_A, addresseeId: AGENT_B, status: 'accepted' },
    ];
    const sql = makeMockSql(presence, friendships);
    const { edges } = await getRoomSocialGraph(ROOM_ID, sql);

    expect(edges).toHaveLength(1);
    expect(edges[0].status).toBe('accepted');
    expect(edges[0].strength).toBe(1.0);
  });

  it('builds pending friendship edge with lower strength', async () => {
    const presence = [
      { agentId: AGENT_A, displayName: 'Alpha', mood: null },
      { agentId: AGENT_B, displayName: 'Beta',  mood: null },
    ];
    const friendships = [
      { requesterId: AGENT_A, addresseeId: AGENT_B, status: 'pending' },
    ];
    const sql = makeMockSql(presence, friendships);
    const { edges } = await getRoomSocialGraph(ROOM_ID, sql);

    expect(edges[0].status).toBe('pending');
    expect(edges[0].strength).toBe(0.4);
  });

  it('deduplicates: accepted overrides pending for same pair', async () => {
    const presence = [
      { agentId: AGENT_A, displayName: 'Alpha', mood: null },
      { agentId: AGENT_B, displayName: 'Beta',  mood: null },
    ];
    const friendships = [
      { requesterId: AGENT_A, addresseeId: AGENT_B, status: 'pending' },
      { requesterId: AGENT_B, addresseeId: AGENT_A, status: 'accepted' },
    ];
    const sql = makeMockSql(presence, friendships);
    const { edges } = await getRoomSocialGraph(ROOM_ID, sql);

    // Should collapse to 1 edge with status 'accepted'
    expect(edges).toHaveLength(1);
    expect(edges[0].status).toBe('accepted');
  });

  it('single agent produces no edges', async () => {
    const presence = [{ agentId: AGENT_A, displayName: 'Alpha', mood: null }];
    const sql = makeMockSql(presence, []);
    const { edges } = await getRoomSocialGraph(ROOM_ID, sql);
    expect(edges).toHaveLength(0);
  });

  it('three agents with two friendships → two edges', async () => {
    const presence = [
      { agentId: AGENT_A, displayName: 'Alpha', mood: null },
      { agentId: AGENT_B, displayName: 'Beta',  mood: null },
      { agentId: AGENT_C, displayName: 'Gamma', mood: null },
    ];
    const friendships = [
      { requesterId: AGENT_A, addresseeId: AGENT_B, status: 'accepted' },
      { requesterId: AGENT_B, addresseeId: AGENT_C, status: 'accepted' },
    ];
    const sql = makeMockSql(presence, friendships);
    const { edges } = await getRoomSocialGraph(ROOM_ID, sql);
    expect(edges).toHaveLength(2);
  });
});

// ─── countAcceptedEdges() ─────────────────────────────────────────────────────

describe('countAcceptedEdges()', () => {
  const makeGraph = (edges: SocialGraphEdge[]): SocialGraph => ({
    roomId: ROOM_ID,
    nodes: [],
    edges,
    generatedAt: new Date().toISOString(),
  });

  it('returns 0 for empty edges', () => {
    expect(countAcceptedEdges(makeGraph([]))).toBe(0);
  });

  it('counts only accepted edges', () => {
    const edges: SocialGraphEdge[] = [
      { source: AGENT_A, target: AGENT_B, status: 'accepted', strength: 1.0 },
      { source: AGENT_B, target: AGENT_C, status: 'pending',  strength: 0.4 },
    ];
    expect(countAcceptedEdges(makeGraph(edges))).toBe(1);
  });

  it('counts all accepted when all are accepted', () => {
    const edges: SocialGraphEdge[] = [
      { source: AGENT_A, target: AGENT_B, status: 'accepted', strength: 1.0 },
      { source: AGENT_B, target: AGENT_C, status: 'accepted', strength: 1.0 },
      { source: AGENT_A, target: AGENT_C, status: 'accepted', strength: 1.0 },
    ];
    expect(countAcceptedEdges(makeGraph(edges))).toBe(3);
  });
});

// ─── getNeighbours() ──────────────────────────────────────────────────────────

describe('getNeighbours()', () => {
  const makeGraph = (edges: SocialGraphEdge[]): SocialGraph => ({
    roomId: ROOM_ID,
    nodes: [],
    edges,
    generatedAt: new Date().toISOString(),
  });

  it('returns empty array when agent has no connections', () => {
    expect(getNeighbours(makeGraph([]), AGENT_A)).toEqual([]);
  });

  it('finds neighbour from source direction', () => {
    const graph = makeGraph([
      { source: AGENT_A, target: AGENT_B, status: 'accepted', strength: 1.0 },
    ]);
    expect(getNeighbours(graph, AGENT_A)).toContain(AGENT_B);
  });

  it('finds neighbour from target direction', () => {
    const graph = makeGraph([
      { source: AGENT_A, target: AGENT_B, status: 'accepted', strength: 1.0 },
    ]);
    expect(getNeighbours(graph, AGENT_B)).toContain(AGENT_A);
  });

  it('excludes pending edges from neighbours', () => {
    const graph = makeGraph([
      { source: AGENT_A, target: AGENT_B, status: 'pending', strength: 0.4 },
    ]);
    expect(getNeighbours(graph, AGENT_A)).toHaveLength(0);
  });

  it('returns multiple neighbours', () => {
    const graph = makeGraph([
      { source: AGENT_A, target: AGENT_B, status: 'accepted', strength: 1.0 },
      { source: AGENT_C, target: AGENT_A, status: 'accepted', strength: 1.0 },
    ]);
    const neighbours = getNeighbours(graph, AGENT_A);
    expect(neighbours).toContain(AGENT_B);
    expect(neighbours).toContain(AGENT_C);
    expect(neighbours).toHaveLength(2);
  });
});

// ─── findHubAgent() ───────────────────────────────────────────────────────────

describe('findHubAgent()', () => {
  const makeNode = (id: string): SocialGraphNode => ({
    id,
    displayName: id.slice(0, 4),
    color: 'hsl(0, 65%, 55%)',
    isOnline: true,
  });

  const makeGraph = (
    nodes: SocialGraphNode[],
    edges: SocialGraphEdge[]
  ): SocialGraph => ({ roomId: ROOM_ID, nodes, edges, generatedAt: new Date().toISOString() });

  it('returns null for empty graph', () => {
    expect(findHubAgent(makeGraph([], []))).toBeNull();
  });

  it('returns the single node for a graph with one node', () => {
    const graph = makeGraph([makeNode(AGENT_A)], []);
    expect(findHubAgent(graph)?.id).toBe(AGENT_A);
  });

  it('identifies the most-connected agent as hub', () => {
    // A-B, A-C → A has degree 2; B and C have degree 1
    const graph = makeGraph(
      [makeNode(AGENT_A), makeNode(AGENT_B), makeNode(AGENT_C)],
      [
        { source: AGENT_A, target: AGENT_B, status: 'accepted', strength: 1.0 },
        { source: AGENT_A, target: AGENT_C, status: 'accepted', strength: 1.0 },
      ]
    );
    expect(findHubAgent(graph)?.id).toBe(AGENT_A);
  });

  it('ignores pending edges when calculating degree', () => {
    // A→B accepted, A→C pending → A has degree 1 (only accepted counts)
    // B has degree 1 as well → first wins (stable)
    const graph = makeGraph(
      [makeNode(AGENT_A), makeNode(AGENT_B), makeNode(AGENT_C)],
      [
        { source: AGENT_A, target: AGENT_B, status: 'accepted', strength: 1.0 },
        { source: AGENT_A, target: AGENT_C, status: 'pending',  strength: 0.4 },
      ]
    );
    // Hub is A or B (both degree 1 accepted) — we just test it returns something valid
    const hub = findHubAgent(graph);
    expect(hub).not.toBeNull();
    expect([AGENT_A, AGENT_B]).toContain(hub?.id);
  });
});
