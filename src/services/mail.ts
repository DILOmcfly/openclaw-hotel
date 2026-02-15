import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type Mail = {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
};

export type MailListItem = Mail & {
  senderName?: string;
  recipientName?: string;
};

/**
 * Send mail from one agent to another
 */
export async function sendMail(
  senderId: string,
  recipientId: string,
  subject: string,
  body: string,
  sql: Sql
): Promise<Mail> {
  if (senderId === recipientId) {
    throw new Error('Cannot send mail to yourself');
  }

  if (!subject || subject.length > 100) {
    throw new Error('Subject must be between 1 and 100 characters');
  }

  if (!body || body.length > 2000) {
    throw new Error('Body must be between 1 and 2000 characters');
  }

  const id = randomUUID();

  const [mail] = await sql<Mail[]>`
    INSERT INTO agent_mail (id, sender_id, recipient_id, subject, body)
    VALUES (${id}, ${senderId}, ${recipientId}, ${subject}, ${body})
    RETURNING 
      id,
      sender_id AS "senderId",
      recipient_id AS "recipientId",
      subject,
      body,
      is_read AS "isRead",
      created_at AS "createdAt"
  `;

  return mail;
}

/**
 * Get inbox for an agent (newest first)
 */
export async function getInbox(
  agentId: string,
  limit: number = 20,
  offset: number = 0,
  sql: Sql
): Promise<MailListItem[]> {
  const mails = await sql<MailListItem[]>`
    SELECT 
      m.id,
      m.sender_id AS "senderId",
      m.recipient_id AS "recipientId",
      m.subject,
      m.body,
      m.is_read AS "isRead",
      m.created_at AS "createdAt",
      a.display_name AS "senderName"
    FROM agent_mail m
    LEFT JOIN agents a ON m.sender_id = a.id
    WHERE m.recipient_id = ${agentId}
    ORDER BY m.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return mails;
}

/**
 * Get sent mail for an agent (newest first)
 */
export async function getSentMail(
  agentId: string,
  limit: number = 20,
  offset: number = 0,
  sql: Sql
): Promise<MailListItem[]> {
  const mails = await sql<MailListItem[]>`
    SELECT 
      m.id,
      m.sender_id AS "senderId",
      m.recipient_id AS "recipientId",
      m.subject,
      m.body,
      m.is_read AS "isRead",
      m.created_at AS "createdAt",
      a.display_name AS "recipientName"
    FROM agent_mail m
    LEFT JOIN agents a ON m.recipient_id = a.id
    WHERE m.sender_id = ${agentId}
    ORDER BY m.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return mails;
}

/**
 * Mark mail as read (recipient only)
 */
export async function readMail(
  mailId: string,
  agentId: string,
  sql: Sql
): Promise<void> {
  const [mail] = await sql<Mail[]>`
    SELECT 
      id,
      sender_id AS "senderId",
      recipient_id AS "recipientId",
      subject,
      body,
      is_read AS "isRead",
      created_at AS "createdAt"
    FROM agent_mail
    WHERE id = ${mailId}
  `;

  if (!mail) {
    throw new Error('Mail not found');
  }

  if (mail.recipientId !== agentId) {
    throw new Error('Only the recipient can mark mail as read');
  }

  await sql`
    UPDATE agent_mail
    SET is_read = true
    WHERE id = ${mailId}
  `;
}

/**
 * Delete mail (sender or recipient can delete)
 */
export async function deleteMail(
  mailId: string,
  agentId: string,
  sql: Sql
): Promise<void> {
  const [mail] = await sql<Mail[]>`
    SELECT 
      id,
      sender_id AS "senderId",
      recipient_id AS "recipientId",
      subject,
      body,
      is_read AS "isRead",
      created_at AS "createdAt"
    FROM agent_mail
    WHERE id = ${mailId}
  `;

  if (!mail) {
    throw new Error('Mail not found');
  }

  if (mail.senderId !== agentId && mail.recipientId !== agentId) {
    throw new Error('Only sender or recipient can delete mail');
  }

  await sql`
    DELETE FROM agent_mail
    WHERE id = ${mailId}
  `;
}

/**
 * Get unread mail count for an agent
 */
export async function getUnreadCount(
  agentId: string,
  sql: Sql
): Promise<number> {
  const [result] = await sql<{ count: number }[]>`
    SELECT COUNT(*) AS count
    FROM agent_mail
    WHERE recipient_id = ${agentId} AND is_read = false
  `;

  return result?.count ?? 0;
}
