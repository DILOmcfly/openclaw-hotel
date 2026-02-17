/**
 * Social Graph Service — T-349
 *
 * Builds a friendship graph for agents currently present in a room.
 * Designed for the spectator overlay: no auth required, read-only.
 */

import type { Sql } from 'postgres';

export interface SocialGraphNode {
  id: string;
  displayName: string;
  color: string;   // hex color for avatar chip
  mood?: string;
  isOnline: boolean;
}

export interface SocialGraphEdge {
  source: string;  // agent id
  target: string;  // agent id
  status: 'accepted' | 'pending';
  strength: number; // 0.0–1.0; accepted=1.0, pending=0.4 (extendable with interaction count)
}

export interface SocialGraph {
  roomId: string;
  nodes: SocialGraphNode[];
  edges: SocialGraphEdge[];
  generatedAt: string;
}

// Stable deterministic color from agent id string
export function agentColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0;
  }
  const h = hash % 360;
  // HSL → CSS hex approximation via known palette
  const palettes: Record<number, string> = {};
  // Return an HSL color string (browser will render correctly)
  return `hsl(${h}, 65%, 55%)`;
}

/**
 * Retrieve the social graph for agents currently present in a room.
 *
 * @param roomId  UUID of the room
 * @param sql     postgres tagged-template instance
 */
export async function getRoomSocialGraph(
  roomId: string,
  sql: Sql
): Promise<SocialGraph> {
  // 1. Get agents currently in the room via the presence table
  const presenceRows = await sql<{
    agentId: string;
    displayName: string;
    mood: string | null;
  }[]>`
    SELECT
      p.agent_id::text AS "agentId",
      COALESCE(a.display_name, 'Agent') AS "displayName",
      ap.mood
    FROM presence p
    LEFT JOIN agents a  ON a.id  = p.agent_id
    LEFT JOIN agent_profiles ap ON ap.agent_id = p.agent_id
    WHERE p.room_id = ${roomId}::uuid
    LIMIT 50
  `;

  if (presenceRows.length === 0) {
    return {
      roomId,
      nodes: [],
      edges: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const agentIds = presenceRows.map((r) => r.agentId);

  // 2. Build nodes
  const nodes: SocialGraphNode[] = presenceRows.map((row) => ({
    id: row.agentId,
    displayName: row.displayName,
    color: agentColor(row.agentId),
    mood: row.mood ?? undefined,
    isOnline: true,
  }));

  // 3. Get all friendships between those agents
  //    Use a single query – both directions must be checked
  const friendshipRows = await sql<{
    requesterId: string;
    addresseeId: string;
    status: 'accepted' | 'pending';
  }[]>`
    SELECT
      requester_id::text AS "requesterId",
      addressee_id::text AS "addresseeId",
      status
    FROM friendships
    WHERE status IN ('accepted', 'pending')
      AND requester_id = ANY(${agentIds}::uuid[])
      AND addressee_id = ANY(${agentIds}::uuid[])
  `;

  // 4. Deduplicate edges (accepted overrides pending for same pair)
  const edgeMap = new Map<string, SocialGraphEdge>();

  for (const row of friendshipRows) {
    // Canonical key: lower id first
    const key =
      row.requesterId < row.addresseeId
        ? `${row.requesterId}:${row.addresseeId}`
        : `${row.addresseeId}:${row.requesterId}`;

    const existing = edgeMap.get(key);
    // accepted > pending
    if (!existing || (existing.status === 'pending' && row.status === 'accepted')) {
      edgeMap.set(key, {
        source: row.requesterId,
        target: row.addresseeId,
        status: row.status,
        strength: row.status === 'accepted' ? 1.0 : 0.4,
      });
    }
  }

  return {
    roomId,
    nodes,
    edges: Array.from(edgeMap.values()),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Count accepted friendships for a set of agents in a room.
 * Used by tests and analytics.
 */
export function countAcceptedEdges(graph: SocialGraph): number {
  return graph.edges.filter((e) => e.status === 'accepted').length;
}

/**
 * Find an agent's direct neighbours (friends) in the graph.
 */
export function getNeighbours(graph: SocialGraph, agentId: string): string[] {
  const neighbours: string[] = [];
  for (const edge of graph.edges) {
    if (edge.status !== 'accepted') continue;
    if (edge.source === agentId) neighbours.push(edge.target);
    if (edge.target === agentId) neighbours.push(edge.source);
  }
  return neighbours;
}

/**
 * Identify the most connected agent ("hub") in the graph.
 */
export function findHubAgent(graph: SocialGraph): SocialGraphNode | null {
  if (graph.nodes.length === 0) return null;

  const degree = new Map<string, number>();
  for (const node of graph.nodes) degree.set(node.id, 0);

  for (const edge of graph.edges) {
    if (edge.status !== 'accepted') continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  let maxDeg = -1;
  let hubId = '';
  for (const [id, deg] of degree) {
    if (deg > maxDeg) {
      maxDeg = deg;
      hubId = id;
    }
  }

  return graph.nodes.find((n) => n.id === hubId) ?? null;
}
