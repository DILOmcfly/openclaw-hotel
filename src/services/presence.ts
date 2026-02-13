export async function getOccupants(roomId: string, sql: any): Promise<
  Array<{ agentId: string; displayName: string; x: number; y: number; rotation: number }>
> {
  const rows = await sql`
    SELECT
      a.id AS agent_id,
      a.display_name,
      p.x,
      p.y,
      p.rotation
    FROM presence p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.room_id = ${roomId}::uuid
    ORDER BY p.joined_at ASC
  `;

  return rows.map((row: any) => ({
    agentId: String(row.agent_id),
    displayName: String(row.display_name),
    x: Number(row.x),
    y: Number(row.y),
    rotation: Number(row.rotation)
  }));
}

export async function joinRoom(
  agentId: string,
  roomId: string,
  x: number,
  y: number,
  sql: any
): Promise<{ position: { x: number; y: number }; occupants: any[] }> {
  const roomRows = await sql`
    SELECT id, max_occupants
    FROM rooms
    WHERE id = ${roomId}::uuid
    LIMIT 1
  `;

  const room = roomRows[0];
  if (!room) {
    throw new Error('Room not found');
  }

  const countRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM presence
    WHERE room_id = ${roomId}::uuid
  `;

  const occupantCount = Number(countRows[0]?.count ?? 0);
  const maxOccupants = Number(room.max_occupants ?? 0);
  if (occupantCount >= maxOccupants) {
    throw new Error('Room is full');
  }

  await sql`
    INSERT INTO presence (agent_id, room_id, x, y)
    VALUES (${agentId}::uuid, ${roomId}::uuid, ${x}, ${y})
    ON CONFLICT (agent_id, room_id)
    DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y
  `;

  await sql`
    INSERT INTO audit_log (event_type, agent_id, room_id, details)
    VALUES (
      'room.join',
      ${agentId}::uuid,
      ${roomId}::uuid,
      ${JSON.stringify({ x, y })}::jsonb
    )
  `;

  const occupants = await getOccupants(roomId, sql);

  return {
    position: { x, y },
    occupants
  };
}

export async function leaveRoom(agentId: string, roomId: string, sql: any): Promise<void> {
  await sql`
    DELETE FROM presence
    WHERE agent_id = ${agentId}::uuid
      AND room_id = ${roomId}::uuid
  `;

  await sql`
    INSERT INTO audit_log (event_type, agent_id, room_id, details)
    VALUES (
      'room.leave',
      ${agentId}::uuid,
      ${roomId}::uuid,
      ${JSON.stringify({ roomId })}::jsonb
    )
  `;
}

export async function getAgentRoom(agentId: string, sql: any): Promise<string | null> {
  const rows = await sql`
    SELECT room_id
    FROM presence
    WHERE agent_id = ${agentId}::uuid
    ORDER BY joined_at DESC
    LIMIT 1
  `;

  return rows[0] ? String(rows[0].room_id) : null;
}

export async function updatePosition(
  agentId: string,
  roomId: string,
  x: number,
  y: number,
  rotation: number,
  sql: any
): Promise<void> {
  await sql`
    UPDATE presence
    SET x = ${x}, y = ${y}, rotation = ${rotation}
    WHERE agent_id = ${agentId}::uuid
      AND room_id = ${roomId}::uuid
  `;
}
