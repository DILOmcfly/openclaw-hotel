function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export async function createRoom(
  name: string,
  description: string,
  heightmap: string,
  createdBy: string | null,
  sql: any
): Promise<any> {
  const slug = toSlug(name);

  const inserted = await sql`
    INSERT INTO rooms (name, slug, description, heightmap, created_by)
    VALUES (
      ${name},
      ${slug},
      ${description},
      ${heightmap},
      ${createdBy ? sql`${createdBy}::uuid` : null}
    )
    RETURNING *
  `;

  const room = inserted[0] ?? null;
  if (!room) {
    throw new Error('Room creation failed');
  }

  await sql`
    INSERT INTO audit_log (event_type, agent_id, room_id, details)
    VALUES (
      'room.create',
      ${createdBy ? sql`${createdBy}::uuid` : null},
      ${room.id}::uuid,
      ${JSON.stringify({ name, slug })}::jsonb
    )
  `;

  return room;
}

export async function listRooms(
  sql: any,
  filters?: { isPublic?: boolean; limit?: number; offset?: number }
): Promise<any[]> {
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const rows = await sql`
    SELECT
      r.*,
      COUNT(p.agent_id)::int AS occupant_count
    FROM rooms r
    LEFT JOIN presence p ON p.room_id = r.id
    WHERE ${typeof filters?.isPublic === 'boolean' ? sql`r.is_public = ${filters.isPublic}` : sql`TRUE`}
    GROUP BY r.id
    ORDER BY r.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return rows;
}

export async function getRoom(roomId: string, sql: any): Promise<any | null> {
  const rows = await sql`
    SELECT
      r.*,
      COUNT(p.agent_id)::int AS occupant_count
    FROM rooms r
    LEFT JOIN presence p ON p.room_id = r.id
    WHERE r.id = ${roomId}::uuid
    GROUP BY r.id
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function deleteRoom(roomId: string, deletedBy: string, sql: any): Promise<boolean> {
  const deleted = await sql`
    DELETE FROM rooms
    WHERE id = ${roomId}::uuid
      AND created_by = ${deletedBy}::uuid
    RETURNING id
  `;

  const success = deleted.length > 0;

  if (success) {
    await sql`
      INSERT INTO audit_log (event_type, agent_id, room_id, details)
      VALUES (
        'room.delete',
        ${deletedBy}::uuid,
        ${roomId}::uuid,
        ${JSON.stringify({ roomId })}::jsonb
      )
    `;
  }

  return success;
}
