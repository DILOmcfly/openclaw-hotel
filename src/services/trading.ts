import type { Sql } from 'postgres';
import { notifyAgent } from './notifications.js';

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export type Trade = {
  id: string;
  initiatorId: string;
  targetId: string;
  status: TradeStatus;
  createdAt: Date;
  completedAt: Date | null;
};

export type TradeItem = {
  id: string;
  tradeId: string;
  agentId: string;
  itemDefId: string;
  quantity: number;
};

// Rate limiting cache: agentId -> timestamp[]
const tradeRequestsCache = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

/**
 * Check if agent is rate-limited for trade requests
 */
export function checkRateLimit(agentId: string): boolean {
  const now = Date.now();
  const requests = tradeRequestsCache.get(agentId) ?? [];
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limited
  }
  
  // Add new request
  recentRequests.push(now);
  tradeRequestsCache.set(agentId, recentRequests);
  
  return true;
}

/**
 * Create a new trade request
 */
export async function createTrade(
  initiatorId: string,
  targetId: string,
  sql: Sql
): Promise<Trade> {
  if (initiatorId === targetId) {
    throw new Error('Cannot trade with yourself');
  }
  
  // Check rate limit
  if (!checkRateLimit(initiatorId)) {
    throw new Error('Trade request rate limit exceeded (max 5 per minute)');
  }
  
  // Create trade
  const [trade] = await sql<Trade[]>`
    INSERT INTO trades (initiator_id, target_id, status)
    VALUES (${initiatorId}, ${targetId}, 'pending')
    RETURNING id, initiator_id AS "initiatorId", target_id AS "targetId", status, created_at AS "createdAt", completed_at AS "completedAt"
  `;
  
  // Get initiator's display name for notification
  const [initiator] = await sql<{ displayName: string }[]>`
    SELECT display_name AS "displayName" FROM agents WHERE id = ${initiatorId}
  `;

  // Notify target about trade request
  if (initiator) {
    notifyAgent({
      agentId: targetId,
      type: 'trade_offer',
      title: 'New Trade Offer',
      message: `${initiator.displayName} wants to trade with you`,
      link: `/trade/${trade.id}`,
    }, sql);
  }
  
  return trade;
}

/**
 * Get a trade by ID
 */
export async function getTrade(tradeId: string, sql: Sql): Promise<Trade | null> {
  const [trade] = await sql<Trade[]>`
    SELECT id, initiator_id AS "initiatorId", target_id AS "targetId", status, created_at AS "createdAt", completed_at AS "completedAt"
    FROM trades
    WHERE id = ${tradeId}
  `;
  
  return trade || null;
}

/**
 * Get trade items for a specific trade
 */
export async function getTradeItems(tradeId: string, sql: Sql): Promise<TradeItem[]> {
  return await sql<TradeItem[]>`
    SELECT id, trade_id AS "tradeId", agent_id AS "agentId", item_def_id AS "itemDefId", quantity
    FROM trade_items
    WHERE trade_id = ${tradeId}
  `;
}

/**
 * Update items offered by an agent in a trade
 */
export async function updateTradeItems(
  tradeId: string,
  agentId: string,
  items: Array<{ itemDefId: string; quantity: number }>,
  sql: Sql
): Promise<void> {
  await sql.begin(async (tx: any) => {
    // Verify trade exists and is pending
    const [trade] = await tx`
      SELECT id, initiator_id AS "initiatorId", target_id AS "targetId", status, created_at AS "createdAt", completed_at AS "completedAt"
      FROM trades
      WHERE id = ${tradeId}
    `;
    
    if (!trade) {
      throw new Error('Trade not found');
    }
    
    if (trade.status !== 'pending') {
      throw new Error('Trade is not pending');
    }
    
    if (trade.initiatorId !== agentId && trade.targetId !== agentId) {
      throw new Error('Agent is not part of this trade');
    }
    
    // Verify agent owns the items
    for (const item of items) {
      const [inventory] = await tx`
        SELECT quantity
        FROM user_inventory
        WHERE agent_id = ${agentId} AND item_def_id = ${item.itemDefId}
      `;
      
      if (!inventory || inventory.quantity < item.quantity) {
        throw new Error(`Insufficient quantity of ${item.itemDefId}`);
      }
    }
    
    // Delete existing items for this agent in this trade
    await tx`
      DELETE FROM trade_items
      WHERE trade_id = ${tradeId} AND agent_id = ${agentId}
    `;
    
    // Insert new items
    for (const item of items) {
      await tx`
        INSERT INTO trade_items (trade_id, agent_id, item_def_id, quantity)
        VALUES (${tradeId}, ${agentId}, ${item.itemDefId}, ${item.quantity})
      `;
    }
  });
}

/**
 * Accept a trade and transfer items atomically
 */
export async function acceptTrade(tradeId: string, acceptingAgentId: string, sql: Sql): Promise<void> {
  await sql.begin(async (tx: any) => {
    // Get trade
    const [trade] = await tx`
      SELECT id, initiator_id AS "initiatorId", target_id AS "targetId", status, created_at AS "createdAt", completed_at AS "completedAt"
      FROM trades
      WHERE id = ${tradeId}
    `;
    
    if (!trade) {
      throw new Error('Trade not found');
    }
    
    if (trade.status !== 'pending') {
      throw new Error('Trade is not pending');
    }
    
    if (trade.targetId !== acceptingAgentId) {
      throw new Error('Only the target can accept the trade');
    }
    
    // Get all trade items
    const tradeItems = await tx`
      SELECT id, trade_id AS "tradeId", agent_id AS "agentId", item_def_id AS "itemDefId", quantity
      FROM trade_items
      WHERE trade_id = ${tradeId}
    `;
    
    // Verify both agents still have the items
    for (const item of tradeItems) {
      const [inventory] = await tx`
        SELECT quantity
        FROM user_inventory
        WHERE agent_id = ${item.agentId} AND item_def_id = ${item.itemDefId}
      `;
      
      if (!inventory || inventory.quantity < item.quantity) {
        throw new Error(`Agent ${item.agentId} no longer has sufficient ${item.itemDefId}`);
      }
    }
    
    // Transfer items atomically
    for (const item of tradeItems) {
      const recipientId = item.agentId === trade.initiatorId ? trade.targetId : trade.initiatorId;
      
      // Deduct from sender
      await tx`
        UPDATE user_inventory
        SET quantity = quantity - ${item.quantity}
        WHERE agent_id = ${item.agentId} AND item_def_id = ${item.itemDefId}
      `;
      
      // Add to recipient
      await tx`
        INSERT INTO user_inventory (agent_id, item_def_id, quantity)
        VALUES (${recipientId}, ${item.itemDefId}, ${item.quantity})
        ON CONFLICT (agent_id, item_def_id)
        DO UPDATE SET quantity = user_inventory.quantity + ${item.quantity}
      `;
    }
    
    // Clean up zero-quantity items
    await tx`
      DELETE FROM user_inventory
      WHERE quantity <= 0
    `;
    
    // Mark trade as accepted
    await tx`
      UPDATE trades
      SET status = 'accepted', completed_at = NOW()
      WHERE id = ${tradeId}
    `;
    
    // Log trade completion
    console.log(`[Trade] Completed trade ${tradeId} between ${trade.initiatorId} and ${trade.targetId}`);
  });
}

/**
 * Reject a trade
 */
export async function rejectTrade(tradeId: string, rejectingAgentId: string, sql: Sql): Promise<void> {
  const trade = await getTrade(tradeId, sql);
  if (!trade) {
    throw new Error('Trade not found');
  }
  
  if (trade.status !== 'pending') {
    throw new Error('Trade is not pending');
  }
  
  if (trade.targetId !== rejectingAgentId) {
    throw new Error('Only the target can reject the trade');
  }
  
  await sql`
    UPDATE trades
    SET status = 'rejected', completed_at = NOW()
    WHERE id = ${tradeId}
  `;
}

/**
 * Cancel a trade
 */
export async function cancelTrade(tradeId: string, cancellingAgentId: string, sql: Sql): Promise<void> {
  const trade = await getTrade(tradeId, sql);
  if (!trade) {
    throw new Error('Trade not found');
  }
  
  if (trade.status !== 'pending') {
    throw new Error('Trade is not pending');
  }
  
  if (trade.initiatorId !== cancellingAgentId) {
    throw new Error('Only the initiator can cancel the trade');
  }
  
  await sql`
    UPDATE trades
    SET status = 'cancelled', completed_at = NOW()
    WHERE id = ${tradeId}
  `;
}

/**
 * Get trade history for an agent
 */
export async function getTradeHistory(agentId: string, sql: Sql, limit: number = 20): Promise<Trade[]> {
  return await sql<Trade[]>`
    SELECT id, initiator_id AS "initiatorId", target_id AS "targetId", status, created_at AS "createdAt", completed_at AS "completedAt"
    FROM trades
    WHERE initiator_id = ${agentId} OR target_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

/**
 * Validate that two agents are in the same room
 */
export async function validateSameRoom(agentId1: string, agentId2: string, sql: Sql): Promise<string | null> {
  const [presence1] = await sql`
    SELECT room_id FROM presence WHERE agent_id = ${agentId1}
  `;
  
  const [presence2] = await sql`
    SELECT room_id FROM presence WHERE agent_id = ${agentId2}
  `;
  
  if (!presence1 || !presence2) {
    return null;
  }
  
  if (presence1.room_id !== presence2.room_id) {
    return null;
  }
  
  return presence1.room_id;
}
