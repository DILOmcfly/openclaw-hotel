import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type CompetitiveEventType = 'rps_tournament' | 'trivia' | 'room_decoration_contest';
export type CompetitiveEventStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export type CompetitiveEvent = {
  id: string;
  name: string;
  type: CompetitiveEventType;
  status: CompetitiveEventStatus;
  startTime: Date;
  endTime: Date | null;
  config: any;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventParticipant = {
  id: string;
  eventId: string;
  agentId: string;
  score: number;
  rank: number | null;
  joinedAt: Date;
};

/**
 * Create a new competitive event
 */
export async function createCompetitiveEvent(
  name: string,
  type: CompetitiveEventType,
  startTime: Date,
  endTime: Date | null,
  config: any,
  createdBy: string | null,
  sql: Sql
): Promise<CompetitiveEvent> {
  const id = randomUUID();

  const [event] = await sql<any[]>`
    INSERT INTO events (
      id, name, type, start_time, end_time, config, created_by
    )
    VALUES (
      ${id}, ${name}, ${type}, ${startTime}, ${endTime}, ${config}, ${createdBy}
    )
    RETURNING 
      id,
      name,
      type,
      status,
      start_time,
      end_time,
      config,
      created_by,
      created_at,
      updated_at
  `;

  return {
    id: event.id,
    name: event.name,
    type: event.type,
    status: event.status,
    startTime: event.start_time,
    endTime: event.end_time,
    config: event.config,
    createdBy: event.created_by,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

/**
 * Get event by ID
 */
export async function getCompetitiveEventById(
  eventId: string,
  sql: Sql
): Promise<CompetitiveEvent | null> {
  const [event] = await sql<any[]>`
    SELECT 
      id,
      name,
      type,
      status,
      start_time,
      end_time,
      config,
      created_by,
      created_at,
      updated_at
    FROM events
    WHERE id = ${eventId}
  `;

  if (!event) return null;

  return {
    id: event.id,
    name: event.name,
    type: event.type,
    status: event.status,
    startTime: event.start_time,
    endTime: event.end_time,
    config: event.config,
    createdBy: event.created_by,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

/**
 * Get all active events
 */
export async function getActiveCompetitiveEvents(sql: Sql): Promise<CompetitiveEvent[]> {
  const events = await sql<any[]>`
    SELECT 
      id,
      name,
      type,
      status,
      start_time,
      end_time,
      config,
      created_by,
      created_at,
      updated_at
    FROM events
    WHERE status = 'active'
    ORDER BY start_time ASC
  `;

  return events.map(e => ({
    id: e.id,
    name: e.name,
    type: e.type,
    status: e.status,
    startTime: e.start_time,
    endTime: e.end_time,
    config: e.config,
    createdBy: e.created_by,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }));
}

/**
 * Get all scheduled/active events (not ended/cancelled)
 */
export async function getAllCompetitiveEvents(sql: Sql): Promise<CompetitiveEvent[]> {
  const events = await sql<any[]>`
    SELECT 
      id,
      name,
      type,
      status,
      start_time,
      end_time,
      config,
      created_by,
      created_at,
      updated_at
    FROM events
    WHERE status IN ('scheduled', 'active')
    ORDER BY start_time ASC
  `;

  return events.map(e => ({
    id: e.id,
    name: e.name,
    type: e.type,
    status: e.status,
    startTime: e.start_time,
    endTime: e.end_time,
    config: e.config,
    createdBy: e.created_by,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }));
}

/**
 * Join a competitive event
 */
export async function joinCompetitiveEvent(
  eventId: string,
  agentId: string,
  sql: Sql
): Promise<void> {
  const event = await getCompetitiveEventById(eventId, sql);

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'scheduled' && event.status !== 'active') {
    throw new Error('Cannot join this event');
  }

  // Check if already joined
  const [existing] = await sql<any[]>`
    SELECT id FROM event_participants
    WHERE event_id = ${eventId} AND agent_id = ${agentId}
  `;

  if (existing) {
    throw new Error('Already joined this event');
  }

  // Join the event
  const id = randomUUID();
  await sql`
    INSERT INTO event_participants (id, event_id, agent_id)
    VALUES (${id}, ${eventId}, ${agentId})
  `;
}

/**
 * Submit score for a participant
 */
export async function submitEventScore(
  eventId: string,
  agentId: string,
  score: number,
  sql: Sql
): Promise<void> {
  const event = await getCompetitiveEventById(eventId, sql);

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'active') {
    throw new Error('Event must be active to submit scores');
  }

  // Update score
  await sql`
    UPDATE event_participants
    SET score = ${score}
    WHERE event_id = ${eventId} AND agent_id = ${agentId}
  `;
}

/**
 * Get event leaderboard (sorted by score desc)
 */
export async function getEventLeaderboard(
  eventId: string,
  sql: Sql
): Promise<Array<{
  agentId: string;
  displayName: string;
  score: number;
  rank: number;
}>> {
  const participants = await sql<any[]>`
    SELECT 
      ep.agent_id,
      a.display_name,
      ep.score,
      ROW_NUMBER() OVER (ORDER BY ep.score DESC) as rank
    FROM event_participants ep
    JOIN agents a ON ep.agent_id = a.id
    WHERE ep.event_id = ${eventId}
    ORDER BY ep.score DESC
  `;

  return participants.map(p => ({
    agentId: p.agent_id,
    displayName: p.display_name,
    score: p.score,
    rank: Number(p.rank),
  }));
}

/**
 * End an event and calculate final rankings
 */
export async function endCompetitiveEvent(
  eventId: string,
  sql: Sql
): Promise<void> {
  const event = await getCompetitiveEventById(eventId, sql);

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'active') {
    throw new Error('Event must be active to end');
  }

  // Calculate ranks
  await sql`
    WITH ranked AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY score DESC) as rank
      FROM event_participants
      WHERE event_id = ${eventId}
    )
    UPDATE event_participants ep
    SET rank = r.rank
    FROM ranked r
    WHERE ep.id = r.id
  `;

  // Update event status
  await sql`
    UPDATE events
    SET status = 'ended', updated_at = NOW()
    WHERE id = ${eventId}
  `;
}

/**
 * Cancel an event (admin only)
 */
export async function cancelCompetitiveEvent(
  eventId: string,
  sql: Sql
): Promise<void> {
  const event = await getCompetitiveEventById(eventId, sql);

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status === 'ended' || event.status === 'cancelled') {
    throw new Error('Cannot cancel this event');
  }

  await sql`
    UPDATE events
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${eventId}
  `;
}

/**
 * Get participants of an event
 */
export async function getEventParticipants(
  eventId: string,
  sql: Sql
): Promise<EventParticipant[]> {
  const participants = await sql<any[]>`
    SELECT 
      id,
      event_id,
      agent_id,
      score,
      rank,
      joined_at
    FROM event_participants
    WHERE event_id = ${eventId}
    ORDER BY joined_at ASC
  `;

  return participants.map(p => ({
    id: p.id,
    eventId: p.event_id,
    agentId: p.agent_id,
    score: p.score,
    rank: p.rank,
    joinedAt: p.joined_at,
  }));
}
