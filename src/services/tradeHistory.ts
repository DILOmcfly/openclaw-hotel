/**
 * Trade History Service - Track all trades, purchases, and transactions
 */

import { randomUUID } from 'crypto';

export type TransactionType = 'trade' | 'purchase' | 'sale' | 'gift' | 'daily_bonus' | 'refund';

export type TradeHistoryRecord = {
  id: string;
  type: TransactionType;
  agentId: string;
  counterpartId: string | null;
  itemsGiven: any[];
  itemsReceived: any[];
  coinsGiven: number;
  coinsReceived: number;
  roomId: string | null;
  createdAt: string;
};

/**
 * Log a transaction to trade history
 */
export async function logTransaction(
  type: TransactionType,
  agentId: string,
  counterpartId: string | null,
  itemsGiven: any[],
  itemsReceived: any[],
  coinsGiven: number,
  coinsReceived: number,
  roomId: string | null,
  sql: any
): Promise<TradeHistoryRecord> {
  const id = randomUUID();

  const query = sql`
    INSERT INTO trade_history (
      id, type, agent_id, counterpart_id, items_given, items_received,
      coins_given, coins_received, room_id
    ) VALUES (
      ${sql.typed.uuid(id)},
      ${sql.typed.text(type)},
      ${sql.typed.uuid(agentId)},
      ${counterpartId ? sql.typed.uuid(counterpartId) : null},
      ${sql.typed.jsonb(itemsGiven)},
      ${sql.typed.jsonb(itemsReceived)},
      ${sql.typed.integer(coinsGiven)},
      ${sql.typed.integer(coinsReceived)},
      ${roomId ? sql.typed.uuid(roomId) : null}
    )
    RETURNING 
      id,
      type,
      agent_id AS "agentId",
      counterpart_id AS "counterpartId",
      items_given AS "itemsGiven",
      items_received AS "itemsReceived",
      coins_given AS "coinsGiven",
      coins_received AS "coinsReceived",
      room_id AS "roomId",
      created_at AS "createdAt"
  `;

  const [result] = await query;
  return result;
}

/**
 * Get transaction history for an agent with optional filters
 */
export async function getHistory(
  agentId: string,
  type: TransactionType | null,
  limit: number,
  offset: number,
  sql: any
): Promise<TradeHistoryRecord[]> {
  let whereClause = `agent_id = ${sql.typed.uuid(agentId)}`;

  if (type) {
    whereClause += ` AND type = ${sql.typed.text(type)}`;
  }

  const query = sql`
    SELECT 
      id,
      type,
      agent_id AS "agentId",
      counterpart_id AS "counterpartId",
      items_given AS "itemsGiven",
      items_received AS "itemsReceived",
      coins_given AS "coinsGiven",
      coins_received AS "coinsReceived",
      room_id AS "roomId",
      created_at AS "createdAt"
    FROM trade_history
    WHERE ${sql.raw(whereClause)}
    ORDER BY created_at DESC
    LIMIT ${sql.typed.integer(limit)}
    OFFSET ${sql.typed.integer(offset)}
  `;

  const results = await query;
  return results;
}

/**
 * Get a single transaction by ID
 */
export async function getTransactionById(
  id: string,
  sql: any
): Promise<TradeHistoryRecord | null> {
  const query = sql`
    SELECT 
      id,
      type,
      agent_id AS "agentId",
      counterpart_id AS "counterpartId",
      items_given AS "itemsGiven",
      items_received AS "itemsReceived",
      coins_given AS "coinsGiven",
      coins_received AS "coinsReceived",
      room_id AS "roomId",
      created_at AS "createdAt"
    FROM trade_history
    WHERE id = ${sql.typed.uuid(id)}
  `;

  const [result] = await query;
  return result || null;
}

/**
 * Get total coins earned by an agent
 */
export async function getTotalCoinsEarned(
  agentId: string,
  sql: any
): Promise<number> {
  const query = sql`
    SELECT COALESCE(SUM(coins_received), 0) AS total
    FROM trade_history
    WHERE agent_id = ${sql.typed.uuid(agentId)}
  `;

  const [result] = await query;
  return parseInt(result?.total || '0', 10);
}

/**
 * Get total coins spent by an agent
 */
export async function getTotalCoinsSpent(
  agentId: string,
  sql: any
): Promise<number> {
  const query = sql`
    SELECT COALESCE(SUM(coins_given), 0) AS total
    FROM trade_history
    WHERE agent_id = ${sql.typed.uuid(agentId)}
  `;

  const [result] = await query;
  return parseInt(result?.total || '0', 10);
}

/**
 * Get unique trade partners for an agent
 */
export async function getTradePartners(
  agentId: string,
  limit: number,
  offset: number,
  sql: any
): Promise<string[]> {
  const query = sql`
    SELECT DISTINCT counterpart_id
    FROM trade_history
    WHERE agent_id = ${sql.typed.uuid(agentId)}
      AND counterpart_id IS NOT NULL
    ORDER BY counterpart_id
    LIMIT ${sql.typed.integer(limit)}
    OFFSET ${sql.typed.integer(offset)}
  `;

  const results = await query;
  return results.map((row: any) => row.counterpart_id);
}

/**
 * Get total count of unique trade partners for an agent
 */
export async function getTradePartnersCount(
  agentId: string,
  sql: any
): Promise<number> {
  const query = sql`
    SELECT COUNT(DISTINCT counterpart_id)::int as count
    FROM trade_history
    WHERE agent_id = ${sql.typed.uuid(agentId)}
      AND counterpart_id IS NOT NULL
  `;

  const [result] = await query;
  return result?.count || 0;
}
