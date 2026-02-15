/**
 * Room Access Codes Service - Manages private room access codes
 */

export type RoomCode = {
  id: number;
  roomId: number;
  code: string;
  createdBy: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
};

export type CodeStats = {
  totalUses: number;
  activeCodesCount: number;
};

function generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function verifyRoomOwner(roomId: number, agentId: string, sql: any): Promise<void> {
  const room = await sql`SELECT owner_id AS "ownerId" FROM rooms WHERE id = ${roomId}`;
  if (room.length === 0 || room[0].ownerId !== agentId) {
    throw new Error('Not room owner');
  }
}

export async function generateCode(
  roomId: number,
  agentId: string,
  sql: any,
  options: { maxUses?: number; expiresAt?: Date } = {}
): Promise<RoomCode> {
  await verifyRoomOwner(roomId, agentId, sql);

  let code = generateRandomCode();
  for (let i = 0; i < 10; i++) {
    const existing = await sql`SELECT id FROM room_access_codes WHERE room_id = ${roomId} AND code = ${code}`;
    if (existing.length === 0) break;
    code = generateRandomCode();
    if (i === 9) throw new Error('Failed to generate unique code');
  }

  const result = await sql`
    INSERT INTO room_access_codes (room_id, code, created_by, max_uses, expires_at)
    VALUES (${roomId}, ${code}, ${agentId}, ${options.maxUses || null}, ${options.expiresAt || null})
    RETURNING id, room_id AS "roomId", code, created_by AS "createdBy",
              max_uses AS "maxUses", use_count AS "useCount",
              expires_at AS "expiresAt", active, created_at AS "createdAt"
  `;
  return result[0];
}

export async function validateCode(
  roomId: number,
  code: string,
  sql: any
): Promise<{ valid: boolean; reason?: string }> {
  const result = await sql`
    SELECT id, active, expires_at AS "expiresAt", max_uses AS "maxUses", use_count AS "useCount"
    FROM room_access_codes WHERE room_id = ${roomId} AND code = ${code}
  `;

  if (result.length === 0) return { valid: false, reason: 'Invalid code' };

  const { active, expiresAt, maxUses, useCount } = result[0];
  if (!active) return { valid: false, reason: 'Code revoked' };
  if (expiresAt && new Date(expiresAt) < new Date()) return { valid: false, reason: 'Code expired' };
  if (maxUses !== null && useCount >= maxUses) return { valid: false, reason: 'Code max uses reached' };

  return { valid: true };
}

export async function useCode(roomId: number, code: string, sql: any): Promise<void> {
  const validation = await validateCode(roomId, code, sql);
  if (!validation.valid) throw new Error(validation.reason);
  await sql`UPDATE room_access_codes SET use_count = use_count + 1 WHERE room_id = ${roomId} AND code = ${code}`;
}

export async function listCodes(roomId: number, agentId: string, sql: any): Promise<RoomCode[]> {
  await verifyRoomOwner(roomId, agentId, sql);
  return await sql`
    SELECT id, room_id AS "roomId", code, created_by AS "createdBy",
           max_uses AS "maxUses", use_count AS "useCount",
           expires_at AS "expiresAt", active, created_at AS "createdAt"
    FROM room_access_codes WHERE room_id = ${roomId} ORDER BY created_at DESC
  `;
}

export async function revokeCode(roomId: number, codeId: number, agentId: string, sql: any): Promise<void> {
  await verifyRoomOwner(roomId, agentId, sql);
  await sql`UPDATE room_access_codes SET active = false WHERE id = ${codeId} AND room_id = ${roomId}`;
}

export async function getCodeStats(roomId: number, sql: any): Promise<CodeStats> {
  const result = await sql`
    SELECT COALESCE(SUM(use_count), 0) AS "totalUses",
           COUNT(*) FILTER (WHERE active = true) AS "activeCodesCount"
    FROM room_access_codes WHERE room_id = ${roomId}
  `;
  return {
    totalUses: parseInt(result[0].totalUses),
    activeCodesCount: parseInt(result[0].activeCodesCount),
  };
}
