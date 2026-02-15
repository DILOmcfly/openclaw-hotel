import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type EventType = 'party' | 'tournament' | 'contest' | 'meetup' | 'show';
export type EventStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export type RoomEvent = {
  id: string;
  roomId: string;
  hostId: string;
  title: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  startsAt: Date;
  endsAt: Date | null;
  maxParticipants: number;
  createdAt: Date;
};

export type EventParticipant = {
  eventId: string;
  agentId: string;
  joinedAt: Date;
};

/**
 * Create a new event
 */
export async function createEvent(
  roomId: string,
  hostId: string,
  title: string,
  description: string,
  eventType: EventType,
  startsAt: Date,
  endsAt: Date | null,
  maxParticipants: number,
  sql: Sql
): Promise<RoomEvent> {
  const id = randomUUID();

  const [event] = await sql<RoomEvent[]>`
    INSERT INTO room_events (
      id, room_id, host_id, title, description, event_type, 
      starts_at, ends_at, max_participants
    )
    VALUES (
      ${id}, ${roomId}, ${hostId}, ${title}, ${description}, ${eventType},
      ${startsAt}, ${endsAt}, ${maxParticipants}
    )
    RETURNING 
      id,
      room_id AS "roomId",
      host_id AS "hostId",
      title,
      description,
      event_type AS "eventType",
      status,
      starts_at AS "startsAt",
      ends_at AS "endsAt",
      max_participants AS "maxParticipants",
      created_at AS "createdAt"
  `;

  return event;
}

/**
 * Get upcoming events (scheduled, ordered by start time)
 */
export async function getUpcomingEvents(limit: number, sql: Sql): Promise<RoomEvent[]> {
  const events = await sql<RoomEvent[]>`
    SELECT 
      id,
      room_id AS "roomId",
      host_id AS "hostId",
      title,
      description,
      event_type AS "eventType",
      status,
      starts_at AS "startsAt",
      ends_at AS "endsAt",
      max_participants AS "maxParticipants",
      created_at AS "createdAt"
    FROM room_events
    WHERE status = 'scheduled'
    ORDER BY starts_at ASC
    LIMIT ${limit}
  `;

  return events;
}

/**
 * Get currently active events
 */
export async function getActiveEvents(sql: Sql): Promise<RoomEvent[]> {
  const events = await sql<RoomEvent[]>`
    SELECT 
      id,
      room_id AS "roomId",
      host_id AS "hostId",
      title,
      description,
      event_type AS "eventType",
      status,
      starts_at AS "startsAt",
      ends_at AS "endsAt",
      max_participants AS "maxParticipants",
      created_at AS "createdAt"
    FROM room_events
    WHERE status = 'active'
    ORDER BY starts_at ASC
  `;

  return events;
}

/**
 * Get event by ID
 */
export async function getEventById(eventId: string, sql: Sql): Promise<RoomEvent | null> {
  const [event] = await sql<RoomEvent[]>`
    SELECT 
      id,
      room_id AS "roomId",
      host_id AS "hostId",
      title,
      description,
      event_type AS "eventType",
      status,
      starts_at AS "startsAt",
      ends_at AS "endsAt",
      max_participants AS "maxParticipants",
      created_at AS "createdAt"
    FROM room_events
    WHERE id = ${eventId}
  `;

  return event || null;
}

/**
 * Join an event
 */
export async function joinEvent(eventId: string, agentId: string, sql: Sql): Promise<void> {
  const event = await getEventById(eventId, sql);

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'scheduled' && event.status !== 'active') {
    throw new Error('Cannot join this event');
  }

  // Check if already joined
  const [existing] = await sql<EventParticipant[]>`
    SELECT event_id AS "eventId", agent_id AS "agentId", joined_at AS "joinedAt"
    FROM event_participants
    WHERE event_id = ${eventId} AND agent_id = ${agentId}
  `;

  if (existing) {
    throw new Error('Already joined this event');
  }

  // Check capacity
  const [countResult] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM event_participants
    WHERE event_id = ${eventId}
  `;

  if (countResult && countResult.count >= event.maxParticipants) {
    throw new Error('Event is full');
  }

  // Join the event
  await sql`
    INSERT INTO event_participants (event_id, agent_id)
    VALUES (${eventId}, ${agentId})
  `;
}

/**
 * Leave an event
 */
export async function leaveEvent(eventId: string, agentId: string, sql: Sql): Promise<void> {
  const result = await sql`
    DELETE FROM event_participants
    WHERE event_id = ${eventId} AND agent_id = ${agentId}
  `;

  if (result.count === 0) {
    throw new Error('Not a participant of this event');
  }
}

/**
 * Start an event (host only)
 */
export async function startEvent(eventId: string, hostId: string, sql: Sql): Promise<void> {
  const event = await getEventById(eventId, sql);

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.hostId !== hostId) {
    throw new Error('Only the host can start this event');
  }

  if (event.status !== 'scheduled') {
    throw new Error('Event must be scheduled to start');
  }

  await sql`
    UPDATE room_events
    SET status = 'active'
    WHERE id = ${eventId}
  `;
}

/**
 * End an event (host only)
 */
export async function endEvent(eventId: string, hostId: string, sql: Sql): Promise<void> {
  const event = await getEventById(eventId, sql);

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.hostId !== hostId) {
    throw new Error('Only the host can end this event');
  }

  if (event.status !== 'active') {
    throw new Error('Event must be active to end');
  }

  await sql`
    UPDATE room_events
    SET status = 'ended'
    WHERE id = ${eventId}
  `;
}

/**
 * Cancel an event (host only)
 */
export async function cancelEvent(eventId: string, hostId: string, sql: Sql): Promise<void> {
  const event = await getEventById(eventId, sql);

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.hostId !== hostId) {
    throw new Error('Only the host can cancel this event');
  }

  if (event.status === 'ended' || event.status === 'cancelled') {
    throw new Error('Cannot cancel this event');
  }

  await sql`
    UPDATE room_events
    SET status = 'cancelled'
    WHERE id = ${eventId}
  `;
}

/**
 * Get participants of an event
 */
export async function getParticipants(eventId: string, sql: Sql): Promise<Array<{
  agentId: string;
  displayName: string;
  joinedAt: Date;
}>> {
  const participants = await sql<any[]>`
    SELECT 
      ep.agent_id,
      a.display_name,
      ep.joined_at
    FROM event_participants ep
    JOIN agents a ON ep.agent_id = a.id
    WHERE ep.event_id = ${eventId}
    ORDER BY ep.joined_at ASC
  `;

  return participants.map(p => ({
    agentId: p.agent_id,
    displayName: p.display_name,
    joinedAt: p.joined_at,
  }));
}
