import { randomUUID } from 'node:crypto';

export type MessageType = 'chat' | 'emote' | 'system' | 'command';

export type ChatMessage = {
  id: string;
  room_id: string;
  agent_id: string;
  agent_name: string;
  message: string;
  message_type: MessageType;
  created_at: Date;
};

/**
 * Save a chat message to the database
 */
export async function saveMessage(
  roomId: string,
  agentId: string,
  agentName: string,
  message: string,
  messageType: MessageType,
  sql: any
): Promise<{ id: string }> {
  if (message.length > 500) {
    throw new Error('Message exceeds 500 characters');
  }

  const validTypes: MessageType[] = ['chat', 'emote', 'system', 'command'];
  if (!validTypes.includes(messageType)) {
    throw new Error('Invalid message type');
  }

  const id = randomUUID();

  await sql`
    INSERT INTO chat_messages (id, room_id, agent_id, agent_name, message, message_type)
    VALUES (
      ${id},
      ${roomId},
      ${agentId},
      ${agentName},
      ${message},
      ${messageType}
    )
  `;

  return { id };
}

/**
 * Get room chat history with cursor-based pagination
 */
export async function getRoomHistory(
  roomId: string,
  limit: number = 50,
  before?: string,
  sql?: any
): Promise<ChatMessage[]> {
  const maxLimit = Math.min(Math.max(limit, 1), 200);

  let rows;
  if (before) {
    rows = await sql`
      SELECT id, room_id, agent_id, agent_name, message, message_type, created_at
      FROM chat_messages
      WHERE room_id = ${roomId}
        AND created_at < (SELECT created_at FROM chat_messages WHERE id = ${before})
      ORDER BY created_at DESC
      LIMIT ${maxLimit}
    `;
  } else {
    rows = await sql`
      SELECT id, room_id, agent_id, agent_name, message, message_type, created_at
      FROM chat_messages
      WHERE room_id = ${roomId}
      ORDER BY created_at DESC
      LIMIT ${maxLimit}
    `;
  }

  return rows.map((row: any) => ({
    id: row.id,
    room_id: row.room_id,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    message: row.message,
    message_type: row.message_type,
    created_at: row.created_at,
  }));
}

/**
 * Search messages in a room by keyword
 */
export async function searchMessages(
  roomId: string,
  query: string,
  sql: any
): Promise<ChatMessage[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = `%${query}%`;

  const rows = await sql`
    SELECT id, room_id, agent_id, agent_name, message, message_type, created_at
    FROM chat_messages
    WHERE room_id = ${roomId}
      AND message ILIKE ${searchTerm}
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return rows.map((row: any) => ({
    id: row.id,
    room_id: row.room_id,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    message: row.message,
    message_type: row.message_type,
    created_at: row.created_at,
  }));
}

/**
 * Get total message count for a room
 */
export async function getMessageCount(
  roomId: string,
  sql: any
): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int as count
    FROM chat_messages
    WHERE room_id = ${roomId}
  `;

  return rows[0]?.count || 0;
}

/**
 * Delete old messages from a room (cleanup)
 */
export async function deleteOldMessages(
  roomId: string,
  daysBefore: number,
  sql: any
): Promise<number> {
  if (daysBefore < 1) {
    throw new Error('daysBefore must be at least 1');
  }

  const result = await sql`
    DELETE FROM chat_messages
    WHERE room_id = ${roomId}
      AND created_at < NOW() - INTERVAL '${daysBefore} days'
  `;

  return result.count || 0;
}
