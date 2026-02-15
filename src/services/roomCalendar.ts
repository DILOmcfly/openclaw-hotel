export type CalendarEvent = {
  id: number; roomId: number; title: string; description: string | null;
  eventType: string; startsAt: Date; endsAt: Date; recurring: string;
  maxAttendees: number; createdBy: string; createdAt: Date;
};
export type RSVP = { eventId: number; agentId: string; status: string; respondedAt: Date };
export type AttendeeStats = {
  going: number; maybe: number; declined: number;
  attendees: Array<{ agentId: string; status: string; respondedAt: Date }>;
};

const MAX_DAYS_AHEAD = 30;
const FIELDS = 'id, room_id AS "roomId", title, description, event_type AS "eventType", starts_at AS "startsAt", ends_at AS "endsAt", recurring, max_attendees AS "maxAttendees", created_by AS "createdBy", created_at AS "createdAt"';

export async function createEvent(
  roomId: number, title: string, startsAt: Date, endsAt: Date, createdBy: string, sql: any,
  opts?: { description?: string; eventType?: string; recurring?: string; maxAttendees?: number }
): Promise<CalendarEvent> {
  if (startsAt >= endsAt) throw new Error('Event start time must be before end time');
  const max = new Date(); max.setDate(max.getDate() + MAX_DAYS_AHEAD);
  if (startsAt > max) throw new Error(`Cannot schedule events more than ${MAX_DAYS_AHEAD} days in advance`);
  const r = await sql`
    INSERT INTO room_calendar (room_id, title, description, event_type, starts_at, ends_at, recurring, max_attendees, created_by)
    VALUES (${roomId}, ${title}, ${opts?.description || null}, ${opts?.eventType || 'general'}, 
            ${startsAt.toISOString()}, ${endsAt.toISOString()}, ${opts?.recurring || 'none'}, ${opts?.maxAttendees || 50}, ${createdBy})
    RETURNING ${sql.unsafe(FIELDS)}
  `;
  return r[0];
}

export async function updateEvent(
  eventId: number, agentId: string, updates: Partial<Omit<CalendarEvent, 'id' | 'createdBy' | 'createdAt'>>, sql: any
): Promise<CalendarEvent> {
  const e = await sql`SELECT created_by AS "createdBy" FROM room_calendar WHERE id = ${eventId}`;
  if (e.length === 0) throw new Error('Event not found');
  if (e[0].createdBy !== agentId) throw new Error('Only event creator can update event');
  const f: string[] = [], v: any[] = [];
  if (updates.title) { f.push('title'); v.push(updates.title); }
  if (updates.description !== undefined) { f.push('description'); v.push(updates.description); }
  if (updates.startsAt) { f.push('starts_at'); v.push(updates.startsAt.toISOString()); }
  if (updates.endsAt) { f.push('ends_at'); v.push(updates.endsAt.toISOString()); }
  if (f.length === 0) throw new Error('No updates provided');
  const r = await sql`UPDATE room_calendar SET ${sql(Object.fromEntries(f.map((x, i) => [x, v[i]])))} WHERE id = ${eventId} RETURNING ${sql.unsafe(FIELDS)}`;
  return r[0];
}

export async function cancelEvent(eventId: number, agentId: string, sql: any): Promise<void> {
  const e = await sql`SELECT created_by AS "createdBy" FROM room_calendar WHERE id = ${eventId}`;
  if (e.length === 0) throw new Error('Event not found');
  if (e[0].createdBy !== agentId) throw new Error('Only event creator can cancel event');
  await sql`DELETE FROM calendar_rsvp WHERE event_id = ${eventId}`;
  await sql`DELETE FROM room_calendar WHERE id = ${eventId}`;
}

export async function getUpcoming(roomId: number, sql: any): Promise<CalendarEvent[]> {
  return await sql`SELECT ${sql.unsafe(FIELDS)} FROM room_calendar WHERE room_id = ${roomId} AND ends_at >= ${new Date().toISOString()} ORDER BY starts_at ASC`;
}

export async function rsvp(eventId: number, agentId: string, status: string, sql: any): Promise<RSVP> {
  if (!['going', 'maybe', 'declined'].includes(status)) throw new Error('Invalid RSVP status');
  const r = await sql`INSERT INTO calendar_rsvp (event_id, agent_id, status) VALUES (${eventId}, ${agentId}, ${status}) ON CONFLICT (event_id, agent_id) DO UPDATE SET status = ${status}, responded_at = NOW() RETURNING event_id AS "eventId", agent_id AS "agentId", status, responded_at AS "respondedAt"`;
  return r[0];
}

export async function getAttendees(eventId: number, sql: any): Promise<AttendeeStats> {
  const r = await sql`SELECT agent_id AS "agentId", status, responded_at AS "respondedAt" FROM calendar_rsvp WHERE event_id = ${eventId} ORDER BY responded_at DESC`;
  return {
    going: r.filter((x: any) => x.status === 'going').length,
    maybe: r.filter((x: any) => x.status === 'maybe').length,
    declined: r.filter((x: any) => x.status === 'declined').length,
    attendees: r,
  };
}

export async function getAgentSchedule(agentId: string, sql: any): Promise<Array<CalendarEvent & { rsvpStatus: string }>> {
  return await sql`
    SELECT rc.id, rc.room_id AS "roomId", rc.title, rc.description, rc.event_type AS "eventType", 
           rc.starts_at AS "startsAt", rc.ends_at AS "endsAt", rc.recurring, rc.max_attendees AS "maxAttendees", 
           rc.created_by AS "createdBy", rc.created_at AS "createdAt", cr.status AS "rsvpStatus"
    FROM room_calendar rc JOIN calendar_rsvp cr ON cr.event_id = rc.id
    WHERE cr.agent_id = ${agentId} AND rc.ends_at >= ${new Date().toISOString()} ORDER BY rc.starts_at ASC
  `;
}

export async function checkConflicts(roomId: number, startsAt: Date, endsAt: Date, sql: any, excludeEventId?: number): Promise<CalendarEvent[]> {
  const base = `SELECT ${FIELDS} FROM room_calendar WHERE room_id = ${roomId} AND (starts_at < ${sql.escape(endsAt.toISOString())} AND ends_at > ${sql.escape(startsAt.toISOString())})`;
  return excludeEventId ? await sql`${sql.unsafe(base)} AND id != ${excludeEventId}` : await sql`${sql.unsafe(base)}`;
}
