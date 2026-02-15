/**
 * Visitor Log Service - Tracks room visitors and visit statistics
 */

export type Visit = {
  id: number;
  roomId: number;
  agentId: string;
  enteredAt: Date;
  leftAt: Date | null;
  durationSeconds: number;
};

export type Visitor = {
  agentId: string;
  enteredAt: Date;
};

export type VisitStats = {
  roomId: number;
  date: Date;
  uniqueVisitors: number;
  totalVisits: number;
  avgDuration: number;
};

/** Record agent entering a room */
export async function logEntry(roomId: number, agentId: string, sql: any): Promise<Visit> {
  const result = await sql`
    INSERT INTO room_visits (room_id, agent_id, entered_at)
    VALUES (${roomId}, ${agentId}, NOW())
    RETURNING id, room_id AS "roomId", agent_id AS "agentId",
      entered_at AS "enteredAt", left_at AS "leftAt", duration_seconds AS "durationSeconds"
  `;
  return result[0];
}

/** Record agent leaving a room */
export async function logExit(visitId: number, sql: any): Promise<Visit> {
  const result = await sql`
    UPDATE room_visits
    SET left_at = NOW(), duration_seconds = EXTRACT(EPOCH FROM (NOW() - entered_at))::INT
    WHERE id = ${visitId} AND left_at IS NULL
    RETURNING id, room_id AS "roomId", agent_id AS "agentId",
      entered_at AS "enteredAt", left_at AS "leftAt", duration_seconds AS "durationSeconds"
  `;
  return result[0];
}

/** Get current visitors in a room (not yet left) */
export async function getVisitors(roomId: number, sql: any): Promise<Visitor[]> {
  const result = await sql`
    SELECT agent_id AS "agentId", entered_at AS "enteredAt"
    FROM room_visits
    WHERE room_id = ${roomId} AND left_at IS NULL
    ORDER BY entered_at DESC
  `;
  return result;
}

/** Get visit history for a room (paginated) */
export async function getVisitHistory(
  roomId: number, limit: number, offset: number, sql: any
): Promise<Visit[]> {
  const result = await sql`
    SELECT id, room_id AS "roomId", agent_id AS "agentId",
      entered_at AS "enteredAt", left_at AS "leftAt", duration_seconds AS "durationSeconds"
    FROM room_visits
    WHERE room_id = ${roomId}
    ORDER BY entered_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return result;
}

/** Get agent's visit history (where they've been) */
export async function getAgentVisitHistory(agentId: string, limit: number, sql: any): Promise<Visit[]> {
  const result = await sql`
    SELECT id, room_id AS "roomId", agent_id AS "agentId",
      entered_at AS "enteredAt", left_at AS "leftAt", duration_seconds AS "durationSeconds"
    FROM room_visits
    WHERE agent_id = ${agentId}
    ORDER BY entered_at DESC
    LIMIT ${limit}
  `;
  return result;
}

/** Get daily stats for a room */
export async function getDailyStats(roomId: number, date: string, sql: any): Promise<VisitStats | null> {
  const result = await sql`
    SELECT room_id AS "roomId", date, unique_visitors AS "uniqueVisitors",
      total_visits AS "totalVisits", avg_duration AS "avgDuration"
    FROM room_visit_stats
    WHERE room_id = ${roomId} AND date = ${date}
  `;
  return result.length > 0 ? result[0] : null;
}

/** Get popular rooms by total visits in a period */
export async function getPopularRooms(startDate: string, endDate: string, limit: number, sql: any): Promise<any[]> {
  const result = await sql`
    SELECT room_id AS "roomId", SUM(total_visits) AS "totalVisits",
      SUM(unique_visitors) AS "uniqueVisitors"
    FROM room_visit_stats
    WHERE date BETWEEN ${startDate} AND ${endDate}
    GROUP BY room_id
    ORDER BY SUM(total_visits) DESC
    LIMIT ${limit}
  `;
  return result;
}

/** Get average visit duration for a room */
export async function getAverageDuration(roomId: number, sql: any): Promise<number> {
  const result = await sql`
    SELECT AVG(duration_seconds)::INT AS avg_duration
    FROM room_visits
    WHERE room_id = ${roomId} AND left_at IS NOT NULL
  `;
  return result[0]?.avg_duration || 0;
}

/** Get most frequent visitors to a room */
export async function getFrequentVisitors(roomId: number, limit: number, sql: any): Promise<any[]> {
  const result = await sql`
    SELECT agent_id AS "agentId", COUNT(*) AS "visitCount",
      AVG(duration_seconds)::INT AS "avgDuration"
    FROM room_visits
    WHERE room_id = ${roomId} AND left_at IS NOT NULL
    GROUP BY agent_id
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}
  `;
  return result;
}
