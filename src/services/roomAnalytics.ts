import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export async function recordVisit(roomId: string, agentId: string, sql: Sql): Promise<string> {
  const sessionId = randomUUID();
  await sql`
    INSERT INTO room_visit_sessions (id, room_id, agent_id, entered_at)
    VALUES (${sessionId}, ${roomId}, ${agentId}, NOW())
  `;
  return sessionId;
}

export async function endVisit(roomId: string, agentId: string, sql: Sql): Promise<void> {
  const result = await sql`
    UPDATE room_visit_sessions
    SET left_at = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - entered_at))::INTEGER
    WHERE room_id = ${roomId}
      AND agent_id = ${agentId}
      AND left_at IS NULL
    RETURNING id, duration_seconds, 
              EXTRACT(HOUR FROM entered_at)::INTEGER as hour,
              DATE(entered_at) as date
  `;

  if (result.length === 0) return;

  const session = result[0];
  await updateHourlyStats(roomId, session.date, session.hour, sql);
}

async function updateHourlyStats(roomId: string, date: string, hour: number, sql: Sql): Promise<void> {
  const stats = await sql`
    SELECT 
      COUNT(DISTINCT agent_id) as unique_visitors,
      COUNT(*) as visitor_count,
      COALESCE(AVG(duration_seconds)::INTEGER, 0) as avg_stay_seconds
    FROM room_visit_sessions
    WHERE room_id = ${roomId}
      AND DATE(entered_at) = ${date}
      AND EXTRACT(HOUR FROM entered_at) = ${hour}
      AND left_at IS NOT NULL
  `;

  const { unique_visitors, visitor_count, avg_stay_seconds } = stats[0];

  await sql`
    INSERT INTO room_analytics (room_id, date, hour, visitor_count, unique_visitors, avg_stay_seconds)
    VALUES (${roomId}, ${date}, ${hour}, ${visitor_count}, ${unique_visitors}, ${avg_stay_seconds})
    ON CONFLICT (room_id, date, hour)
    DO UPDATE SET
      visitor_count = ${visitor_count},
      unique_visitors = ${unique_visitors},
      avg_stay_seconds = ${avg_stay_seconds}
  `;
}

export async function getHourlyStats(roomId: string, date: string, sql: Sql) {
  const stats = await sql`
    SELECT hour, visitor_count, unique_visitors, avg_stay_seconds
    FROM room_analytics
    WHERE room_id = ${roomId}
      AND date = ${date}
    ORDER BY hour ASC
  `;

  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    visitor_count: 0,
    unique_visitors: 0,
    avg_stay_seconds: 0,
  }));

  stats.forEach((stat: any) => {
    hourlyData[stat.hour] = {
      hour: stat.hour,
      visitor_count: stat.visitor_count,
      unique_visitors: stat.unique_visitors,
      avg_stay_seconds: stat.avg_stay_seconds,
    };
  });

  return hourlyData;
}

export async function getDailyStats(roomId: string, days: number, sql: Sql) {
  const stats = await sql`
    SELECT 
      date,
      SUM(visitor_count) as total_visitors,
      SUM(unique_visitors) as total_unique,
      AVG(avg_stay_seconds)::INTEGER as avg_stay
    FROM room_analytics
    WHERE room_id = ${roomId}
      AND date >= CURRENT_DATE - ${days - 1}
    GROUP BY date
    ORDER BY date DESC
  `;

  return stats.map((s: any) => ({
    date: s.date,
    total_visitors: s.total_visitors,
    total_unique: s.total_unique,
    avg_stay: s.avg_stay,
  }));
}

export async function getPeakHour(roomId: string, sql: Sql) {
  const result = await sql`
    SELECT hour, SUM(visitor_count) as total
    FROM room_analytics
    WHERE room_id = ${roomId}
      AND date >= CURRENT_DATE - 30
    GROUP BY hour
    ORDER BY total DESC
    LIMIT 1
  `;

  if (result.length === 0) {
    return { hour: 0, total: 0 };
  }

  return { hour: result[0].hour, total: result[0].total };
}

export async function getTotalVisitors(roomId: string, sql: Sql) {
  const result = await sql`
    SELECT COUNT(DISTINCT agent_id) as total
    FROM room_visit_sessions
    WHERE room_id = ${roomId}
  `;

  return { total: result[0]?.total || 0 };
}
