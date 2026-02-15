import type postgres from 'postgres';

export type SafetyRating = 'everyone' | 'teen' | 'mature' | 'restricted';

export interface RoomSafety {
  roomId: string;
  rating: SafetyRating;
  contentWarnings: string[];
  verifiedBy?: string;
  verifiedAt?: Date;
  reportsCount: number;
  updatedAt: Date;
}

const MAX_WARNINGS = 5;
const VALID_RATINGS: SafetyRating[] = ['everyone', 'teen', 'mature', 'restricted'];

export async function setRating(roomId: string, rating: SafetyRating, sql: postgres.Sql): Promise<void> {
  if (!VALID_RATINGS.includes(rating)) throw new Error('Invalid rating');
  await sql`INSERT INTO room_safety (room_id, rating, updated_at) VALUES (${roomId}, ${rating}, NOW()) ON CONFLICT (room_id) DO UPDATE SET rating = ${rating}, updated_at = NOW()`;
}

export async function addWarning(roomId: string, warning: string, sql: postgres.Sql): Promise<void> {
  if (!warning?.trim()) throw new Error('Warning cannot be empty');
  const result = await sql`SELECT content_warnings FROM room_safety WHERE room_id = ${roomId}`;
  const current: string[] = result[0]?.content_warnings || [];
  if (current.length >= MAX_WARNINGS) throw new Error(`Maximum ${MAX_WARNINGS} warnings allowed`);
  if (current.includes(warning.trim())) throw new Error('Warning already exists');
  const newWarnings = [...current, warning.trim()];
  await sql`INSERT INTO room_safety (room_id, content_warnings, updated_at) VALUES (${roomId}, ${JSON.stringify(newWarnings)}, NOW()) ON CONFLICT (room_id) DO UPDATE SET content_warnings = ${JSON.stringify(newWarnings)}, updated_at = NOW()`;
}

export async function removeWarning(roomId: string, warning: string, sql: postgres.Sql): Promise<boolean> {
  const result = await sql`SELECT content_warnings FROM room_safety WHERE room_id = ${roomId}`;
  if (!result.length) return false;
  const current: string[] = result[0].content_warnings || [];
  const newWarnings = current.filter(w => w !== warning.trim());
  if (newWarnings.length === current.length) return false;
  await sql`UPDATE room_safety SET content_warnings = ${JSON.stringify(newWarnings)}, updated_at = NOW() WHERE room_id = ${roomId}`;
  return true;
}

export async function getRating(roomId: string, sql: postgres.Sql): Promise<RoomSafety | null> {
  const result = await sql`SELECT * FROM room_safety WHERE room_id = ${roomId}`;
  if (!result.length) return null;
  const r = result[0];
  return {
    roomId: r.room_id,
    rating: r.rating,
    contentWarnings: r.content_warnings || [],
    verifiedBy: r.verified_by,
    verifiedAt: r.verified_at ? new Date(r.verified_at) : undefined,
    reportsCount: r.reports_count || 0,
    updatedAt: new Date(r.updated_at),
  };
}

export async function verifyRating(roomId: string, verifiedBy: string, sql: postgres.Sql): Promise<void> {
  await sql`UPDATE room_safety SET verified_by = ${verifiedBy}, verified_at = NOW(), updated_at = NOW() WHERE room_id = ${roomId}`;
}

export async function reportRoom(roomId: string, sql: postgres.Sql): Promise<number> {
  await sql`INSERT INTO room_safety (room_id, reports_count, updated_at) VALUES (${roomId}, 1, NOW()) ON CONFLICT (room_id) DO UPDATE SET reports_count = room_safety.reports_count + 1, updated_at = NOW()`;
  const result = await sql`SELECT reports_count FROM room_safety WHERE room_id = ${roomId}`;
  return result[0].reports_count;
}

export async function getRoomsByRating(rating: SafetyRating, sql: postgres.Sql): Promise<string[]> {
  const result = await sql`SELECT room_id FROM room_safety WHERE rating = ${rating}`;
  return result.map(r => r.room_id);
}
