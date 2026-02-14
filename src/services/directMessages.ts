/**
 * directMessages.ts
 * Service for private messaging (whisper) between friends
 */

import type { Sql } from 'postgres';
import { notifyAgent } from './notifications.js';

export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type ConversationPreview = {
  otherAgentId: string;
  otherAgentName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

export class DirectMessageService {
  constructor(private sql: Sql) {}

  /**
   * Send a direct message (whisper)
   * @throws Error if sender and recipient are not friends
   */
  async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<DirectMessage> {
    // Validate content
    if (!content || content.length === 0 || content.length > 500) {
      throw new Error('Message content must be between 1 and 500 characters');
    }

    // Check if they are friends
    const friendship = await this.sql<{ status: string }[]>`
      SELECT status FROM friendships
      WHERE (requester_id = ${senderId} AND addressee_id = ${recipientId})
         OR (requester_id = ${recipientId} AND addressee_id = ${senderId})
      LIMIT 1
    `;

    if (friendship.length === 0 || friendship[0].status !== 'accepted') {
      throw new Error('Can only whisper to friends');
    }

    // Insert message
    const [message] = await this.sql<DirectMessage[]>`
      INSERT INTO direct_messages (sender_id, recipient_id, content)
      VALUES (${senderId}, ${recipientId}, ${content})
      RETURNING 
        id::text,
        sender_id AS "senderId",
        recipient_id AS "recipientId",
        content,
        created_at::text AS "createdAt",
        read_at::text AS "readAt"
    `;

    // Get sender's display name for notification
    const [sender] = await this.sql<{ displayName: string }[]>`
      SELECT display_name AS "displayName" FROM agents WHERE id = ${senderId}
    `;

    // Notify recipient about new message
    if (sender) {
      const preview = content.length > 50 ? content.slice(0, 47) + '...' : content;
      notifyAgent({
        agentId: recipientId,
        type: 'whisper',
        title: `Message from ${sender.displayName}`,
        message: preview,
        link: `/whisper/${senderId}`,
      }, this.sql);
    }

    return message;
  }

  /**
   * Get conversation history between two agents
   */
  async getConversation(
    agentId1: string,
    agentId2: string,
    limit = 50,
  ): Promise<DirectMessage[]> {
    const messages = await this.sql<DirectMessage[]>`
      SELECT 
        id::text,
        sender_id AS "senderId",
        recipient_id AS "recipientId",
        content,
        created_at::text AS "createdAt",
        read_at::text AS "readAt"
      FROM direct_messages
      WHERE (sender_id = ${agentId1} AND recipient_id = ${agentId2})
         OR (sender_id = ${agentId2} AND recipient_id = ${agentId1})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return messages.reverse(); // Oldest first for UI display
  }

  /**
   * Get list of conversations for an agent (inbox preview)
   */
  async getConversationPreviews(agentId: string): Promise<ConversationPreview[]> {
    // This query is complex: get the most recent message from each unique conversation
    const previews = await this.sql<ConversationPreview[]>`
      WITH latest_messages AS (
        SELECT DISTINCT ON (
          CASE WHEN sender_id = ${agentId} THEN recipient_id ELSE sender_id END
        )
          CASE WHEN sender_id = ${agentId} THEN recipient_id ELSE sender_id END AS other_agent_id,
          content AS last_message,
          created_at AS last_message_at
        FROM direct_messages
        WHERE sender_id = ${agentId} OR recipient_id = ${agentId}
        ORDER BY 
          CASE WHEN sender_id = ${agentId} THEN recipient_id ELSE sender_id END,
          created_at DESC
      ),
      unread_counts AS (
        SELECT 
          sender_id AS other_agent_id,
          COUNT(*) AS unread_count
        FROM direct_messages
        WHERE recipient_id = ${agentId} AND read_at IS NULL
        GROUP BY sender_id
      )
      SELECT 
        lm.other_agent_id AS "otherAgentId",
        a.display_name AS "otherAgentName",
        lm.last_message AS "lastMessage",
        lm.last_message_at::text AS "lastMessageAt",
        COALESCE(uc.unread_count, 0)::int AS "unreadCount"
      FROM latest_messages lm
      JOIN agents a ON a.id = lm.other_agent_id
      LEFT JOIN unread_counts uc ON uc.other_agent_id = lm.other_agent_id
      ORDER BY lm.last_message_at DESC
    `;

    return previews;
  }

  /**
   * Mark messages as read
   */
  async markAsRead(recipientId: string, senderId: string): Promise<number> {
    const result = await this.sql`
      UPDATE direct_messages
      SET read_at = NOW()
      WHERE recipient_id = ${recipientId} 
        AND sender_id = ${senderId}
        AND read_at IS NULL
    `;

    return result.count ?? 0;
  }

  /**
   * Get unread message count for an agent
   */
  async getUnreadCount(agentId: string): Promise<number> {
    const [result] = await this.sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM direct_messages
      WHERE recipient_id = ${agentId} AND read_at IS NULL
    `;

    return result?.count ?? 0;
  }

  /**
   * Delete a conversation (for testing/admin)
   */
  async deleteConversation(agentId1: string, agentId2: string): Promise<number> {
    const result = await this.sql`
      DELETE FROM direct_messages
      WHERE (sender_id = ${agentId1} AND recipient_id = ${agentId2})
         OR (sender_id = ${agentId2} AND recipient_id = ${agentId1})
    `;

    return result.count ?? 0;
  }
}
