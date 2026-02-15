/** Whispers Service - Private messaging between agents */

export type Whisper = {
  id: number;
  senderId: string;
  receiverId: string;
  message: string;
  read: boolean;
  deletedBySender: boolean;
  deletedByReceiver: boolean;
  createdAt: Date;
};

export type InboxEntry = {
  partnerId: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
  read: boolean;
};

const MAX_MESSAGE_LENGTH = 1000;

export async function sendWhisper(
  senderId: string,
  receiverId: string,
  message: string,
  sql: any
): Promise<Whisper> {
  if (senderId === receiverId) throw new Error('Cannot send whisper to yourself');
  if (!message || message.trim().length === 0) throw new Error('Message cannot be empty');
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  if (await isBlocked(receiverId, senderId, sql)) {
    throw new Error('Cannot send message to this agent');
  }

  const result = await sql`
    INSERT INTO whispers (sender_id, receiver_id, message)
    VALUES (${senderId}, ${receiverId}, ${message.trim()})
    RETURNING 
      id, sender_id AS "senderId", receiver_id AS "receiverId", message, read,
      deleted_by_sender AS "deletedBySender", deleted_by_receiver AS "deletedByReceiver",
      created_at AS "createdAt"
  `;
  return result[0];
}

export async function getConversation(
  agentId: string,
  otherId: string,
  limit: number = 50,
  offset: number = 0,
  sql: any
): Promise<Whisper[]> {
  return await sql`
    SELECT 
      id, sender_id AS "senderId", receiver_id AS "receiverId", message, read,
      deleted_by_sender AS "deletedBySender", deleted_by_receiver AS "deletedByReceiver",
      created_at AS "createdAt"
    FROM whispers
    WHERE 
      ((sender_id = ${agentId} AND receiver_id = ${otherId} AND deleted_by_sender = false) OR
       (sender_id = ${otherId} AND receiver_id = ${agentId} AND deleted_by_receiver = false))
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getInbox(agentId: string, sql: any): Promise<InboxEntry[]> {
  return await sql`
    WITH latest_messages AS (
      SELECT DISTINCT ON (
        CASE WHEN sender_id = ${agentId} THEN receiver_id ELSE sender_id END
      )
        CASE WHEN sender_id = ${agentId} THEN receiver_id ELSE sender_id END AS partner_id,
        message AS last_message,
        created_at AS last_message_at,
        read,
        sender_id,
        receiver_id
      FROM whispers
      WHERE 
        (sender_id = ${agentId} AND deleted_by_sender = false) OR
        (receiver_id = ${agentId} AND deleted_by_receiver = false)
      ORDER BY 
        CASE WHEN sender_id = ${agentId} THEN receiver_id ELSE sender_id END,
        created_at DESC
    )
    SELECT 
      partner_id AS "partnerId",
      last_message AS "lastMessage",
      last_message_at AS "lastMessageAt",
      read,
      (
        SELECT COUNT(*)
        FROM whispers w
        WHERE w.receiver_id = ${agentId} 
          AND w.sender_id = latest_messages.partner_id
          AND w.read = false
          AND w.deleted_by_receiver = false
      ) AS "unreadCount"
    FROM latest_messages
    ORDER BY last_message_at DESC
  `;
}

export async function markRead(whisperId: number, agentId: string, sql: any): Promise<void> {
  await sql`UPDATE whispers SET read = true WHERE id = ${whisperId} AND receiver_id = ${agentId}`;
}

export async function deleteMessage(whisperId: number, agentId: string, sql: any): Promise<void> {
  await sql`
    UPDATE whispers
    SET 
      deleted_by_sender = CASE WHEN sender_id = ${agentId} THEN true ELSE deleted_by_sender END,
      deleted_by_receiver = CASE WHEN receiver_id = ${agentId} THEN true ELSE deleted_by_receiver END
    WHERE id = ${whisperId} AND (sender_id = ${agentId} OR receiver_id = ${agentId})
  `;
}

export async function blockAgent(
  blockerId: string,
  blockedId: string,
  reason: string = '',
  sql: any
): Promise<void> {
  if (blockerId === blockedId) throw new Error('Cannot block yourself');
  await sql`
    INSERT INTO blocked_agents (blocker_id, blocked_id, reason)
    VALUES (${blockerId}, ${blockedId}, ${reason})
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  `;
}

export async function unblockAgent(blockerId: string, blockedId: string, sql: any): Promise<void> {
  await sql`
    DELETE FROM blocked_agents
    WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}
  `;
}

export async function isBlocked(blockerId: string, blockedId: string, sql: any): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM blocked_agents
    WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}
  `;
  return result.length > 0;
}

export async function getBlockList(agentId: string, sql: any): Promise<string[]> {
  const result = await sql`
    SELECT blocked_id AS "blockedId" FROM blocked_agents
    WHERE blocker_id = ${agentId} ORDER BY created_at DESC
  `;
  return result.map((r: any) => r.blockedId);
}

export async function getUnreadCount(agentId: string, sql: any): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) AS count FROM whispers
    WHERE receiver_id = ${agentId} AND read = false AND deleted_by_receiver = false
  `;
  return parseInt(result[0].count);
}
