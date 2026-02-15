/**
 * Gift Service - Manage gifting of coins and furniture between agents
 */

import { randomUUID } from 'crypto';
import { getBalance, deductCoins, addCoins } from './economy.js';

export type Gift = {
  id: string;
  senderId: string;
  receiverId: string;
  giftType: 'coins' | 'furniture';
  itemId: string | null;
  amount: number | null;
  message: string;
  createdAt: string;
};

const MIN_COIN_GIFT = 1;
const MAX_COIN_GIFT = 10000;

/**
 * Send coins to another agent
 */
export async function sendCoins(
  senderId: string,
  receiverId: string,
  amount: number,
  message: string,
  sql: any
): Promise<Gift> {
  // Validation
  if (senderId === receiverId) {
    throw new Error('Cannot send gift to yourself');
  }

  if (amount < MIN_COIN_GIFT || amount > MAX_COIN_GIFT) {
    throw new Error(`Coin amount must be between ${MIN_COIN_GIFT} and ${MAX_COIN_GIFT}`);
  }

  if (!Number.isInteger(amount)) {
    throw new Error('Coin amount must be a whole number');
  }

  // Check sender has sufficient coins
  const senderBalance = await getBalance(senderId, sql);
  if (senderBalance.coins < amount) {
    throw new Error(`Insufficient funds. You have ${senderBalance.coins} coins`);
  }

  // Deduct from sender
  await deductCoins(senderId, amount, sql);

  // Add to receiver
  await addCoins(receiverId, amount, sql);

  // Record gift
  const giftId = randomUUID();
  const result = await sql`
    INSERT INTO gift_history (id, sender_id, receiver_id, gift_type, item_id, amount, message, created_at)
    VALUES (${giftId}, ${senderId}, ${receiverId}, 'coins', NULL, ${amount}, ${message}, NOW())
    RETURNING id, sender_id AS "senderId", receiver_id AS "receiverId", 
              gift_type AS "giftType", item_id AS "itemId", amount, message, created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Send furniture item to another agent
 */
export async function sendFurniture(
  senderId: string,
  receiverId: string,
  itemId: string,
  message: string,
  sql: any
): Promise<Gift> {
  // Validation
  if (senderId === receiverId) {
    throw new Error('Cannot send gift to yourself');
  }

  // Verify sender owns the item and it's not placed in a room
  const item = await sql`
    SELECT id, agent_id AS "agentId", room_id AS "roomId"
    FROM inventory
    WHERE id = ${itemId}
  `;

  if (item.length === 0) {
    throw new Error('Item not found');
  }

  if (item[0].agentId !== senderId) {
    throw new Error('You do not own this item');
  }

  if (item[0].roomId !== null) {
    throw new Error('Cannot gift items that are placed in a room. Remove it first.');
  }

  // Transfer ownership
  await sql`
    UPDATE inventory
    SET agent_id = ${receiverId}
    WHERE id = ${itemId}
  `;

  // Record gift
  const giftId = randomUUID();
  const result = await sql`
    INSERT INTO gift_history (id, sender_id, receiver_id, gift_type, item_id, amount, message, created_at)
    VALUES (${giftId}, ${senderId}, ${receiverId}, 'furniture', ${itemId}, NULL, ${message}, NOW())
    RETURNING id, sender_id AS "senderId", receiver_id AS "receiverId", 
              gift_type AS "giftType", item_id AS "itemId", amount, message, created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Get gifts received by an agent
 */
export async function getReceivedGifts(
  agentId: string,
  limit: number,
  sql: any
): Promise<Gift[]> {
  const gifts = await sql`
    SELECT id, sender_id AS "senderId", receiver_id AS "receiverId",
           gift_type AS "giftType", item_id AS "itemId", amount, message, created_at AS "createdAt"
    FROM gift_history
    WHERE receiver_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return gifts;
}

/**
 * Get gifts sent by an agent
 */
export async function getSentGifts(
  agentId: string,
  limit: number,
  sql: any
): Promise<Gift[]> {
  const gifts = await sql`
    SELECT id, sender_id AS "senderId", receiver_id AS "receiverId",
           gift_type AS "giftType", item_id AS "itemId", amount, message, created_at AS "createdAt"
    FROM gift_history
    WHERE sender_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return gifts;
}

/**
 * Get total count of gifts received (for achievements)
 */
export async function getGiftCount(agentId: string, sql: any): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) AS count
    FROM gift_history
    WHERE receiver_id = ${agentId}
  `;

  return parseInt(result[0].count, 10);
}
