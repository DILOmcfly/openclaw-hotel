/**
 * Trading Cards Service - Manages collectible cards for agents
 */

export type TradingCard = {
  id: number;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  category: 'agent' | 'room' | 'item' | 'event' | 'special';
  power: number;
  imageUrl: string | null;
  maxSupply: number | null;
  totalMinted: number;
  createdAt: Date;
};

export type AgentCard = {
  id: number;
  agentId: string;
  cardId: number;
  serialNumber: number;
  acquiredAt: Date;
  tradeable: boolean;
};

export type CardWithDetails = AgentCard & {
  name: string;
  description: string;
  rarity: string;
  category: string;
  power: number;
};

/**
 * Get all available trading cards
 */
export async function getAllCards(sql: any): Promise<TradingCard[]> {
  const result = await sql`
    SELECT id, name, description, rarity, category, power,
           image_url AS "imageUrl", max_supply AS "maxSupply",
           total_minted AS "totalMinted", created_at AS "createdAt"
    FROM trading_cards
    ORDER BY 
      CASE rarity
        WHEN 'mythic' THEN 6
        WHEN 'legendary' THEN 5
        WHEN 'epic' THEN 4
        WHEN 'rare' THEN 3
        WHEN 'uncommon' THEN 2
        ELSE 1
      END DESC,
      name ASC
  `;
  return result;
}

/**
 * Mint a card for an agent (check supply and assign serial number)
 */
export async function mintCard(agentId: string, cardId: number, sql: any): Promise<AgentCard> {
  // Get card info
  const cards = await sql`
    SELECT max_supply AS "maxSupply", total_minted AS "totalMinted"
    FROM trading_cards
    WHERE id = ${cardId}
  `;

  if (cards.length === 0) {
    throw new Error('Card not found');
  }

  const card = cards[0];

  // Check supply limit
  if (card.maxSupply !== null && card.totalMinted >= card.maxSupply) {
    throw new Error('Card supply exhausted');
  }

  // Calculate serial number (total_minted + 1)
  const serialNumber = card.totalMinted + 1;

  // Insert agent card
  const result = await sql`
    INSERT INTO agent_cards (agent_id, card_id, serial_number, acquired_at, tradeable)
    VALUES (${agentId}, ${cardId}, ${serialNumber}, NOW(), true)
    RETURNING id, agent_id AS "agentId", card_id AS "cardId",
              serial_number AS "serialNumber", acquired_at AS "acquiredAt",
              tradeable
  `;

  // Update total_minted
  await sql`
    UPDATE trading_cards
    SET total_minted = total_minted + 1
    WHERE id = ${cardId}
  `;

  return result[0];
}

/**
 * Get all cards owned by an agent (with optional rarity filter)
 */
export async function getAgentCards(
  agentId: string,
  sql: any,
  rarity?: string
): Promise<CardWithDetails[]> {
  let result;

  if (rarity) {
    result = await sql`
      SELECT ac.id, ac.agent_id AS "agentId", ac.card_id AS "cardId",
             ac.serial_number AS "serialNumber", ac.acquired_at AS "acquiredAt",
             ac.tradeable, tc.name, tc.description, tc.rarity, tc.category, tc.power
      FROM agent_cards ac
      JOIN trading_cards tc ON ac.card_id = tc.id
      WHERE ac.agent_id = ${agentId} AND tc.rarity = ${rarity}
      ORDER BY ac.acquired_at DESC
    `;
  } else {
    result = await sql`
      SELECT ac.id, ac.agent_id AS "agentId", ac.card_id AS "cardId",
             ac.serial_number AS "serialNumber", ac.acquired_at AS "acquiredAt",
             ac.tradeable, tc.name, tc.description, tc.rarity, tc.category, tc.power
      FROM agent_cards ac
      JOIN trading_cards tc ON ac.card_id = tc.id
      WHERE ac.agent_id = ${agentId}
      ORDER BY ac.acquired_at DESC
    `;
  }

  return result;
}

/**
 * Trade cards between two agents
 */
export async function tradeCards(
  senderAgentId: string,
  receiverAgentId: string,
  senderCardIds: number[],
  receiverCardIds: number[],
  sql: any
): Promise<{ success: boolean }> {
  // Verify sender owns all sender cards and they're tradeable
  const senderCards = await sql`
    SELECT id, tradeable FROM agent_cards
    WHERE id = ANY(${senderCardIds}) AND agent_id = ${senderAgentId}
  `;

  if (senderCards.length !== senderCardIds.length) {
    throw new Error('Sender does not own all specified cards');
  }

  if (senderCards.some((c: any) => !c.tradeable)) {
    throw new Error('Some sender cards are not tradeable');
  }

  // Verify receiver owns all receiver cards and they're tradeable
  const receiverCards = await sql`
    SELECT id, tradeable FROM agent_cards
    WHERE id = ANY(${receiverCardIds}) AND agent_id = ${receiverAgentId}
  `;

  if (receiverCards.length !== receiverCardIds.length) {
    throw new Error('Receiver does not own all specified cards');
  }

  if (receiverCards.some((c: any) => !c.tradeable)) {
    throw new Error('Some receiver cards are not tradeable');
  }

  // Perform the trade (swap ownership)
  await sql`
    UPDATE agent_cards
    SET agent_id = ${receiverAgentId}
    WHERE id = ANY(${senderCardIds})
  `;

  await sql`
    UPDATE agent_cards
    SET agent_id = ${senderAgentId}
    WHERE id = ANY(${receiverCardIds})
  `;

  return { success: true };
}

/**
 * Get card statistics
 */
export async function getCardStats(cardId: number, sql: any): Promise<{
  totalMinted: number;
  uniqueOwners: number;
  available: number | null;
}> {
  const cardInfo = await sql`
    SELECT max_supply AS "maxSupply", total_minted AS "totalMinted"
    FROM trading_cards
    WHERE id = ${cardId}
  `;

  if (cardInfo.length === 0) {
    throw new Error('Card not found');
  }

  const owners = await sql`
    SELECT COUNT(DISTINCT agent_id) as count
    FROM agent_cards
    WHERE card_id = ${cardId}
  `;

  const available = cardInfo[0].maxSupply !== null
    ? cardInfo[0].maxSupply - cardInfo[0].totalMinted
    : null;

  return {
    totalMinted: cardInfo[0].totalMinted,
    uniqueOwners: parseInt(owners[0].count),
    available,
  };
}

/**
 * Get rarest cards (lowest mint count, excluding unlimited)
 */
export async function getRarestCards(limit: number, sql: any): Promise<TradingCard[]> {
  const result = await sql`
    SELECT id, name, description, rarity, category, power,
           image_url AS "imageUrl", max_supply AS "maxSupply",
           total_minted AS "totalMinted", created_at AS "createdAt"
    FROM trading_cards
    WHERE max_supply IS NOT NULL
    ORDER BY total_minted ASC, max_supply ASC
    LIMIT ${limit}
  `;
  return result;
}

/**
 * Get collection progress for an agent
 */
export async function getCollectionProgress(agentId: string, sql: any): Promise<{
  uniqueCards: number;
  totalCards: number;
  percentage: number;
}> {
  const uniqueOwned = await sql`
    SELECT COUNT(DISTINCT card_id) as count
    FROM agent_cards
    WHERE agent_id = ${agentId}
  `;

  const totalCards = await sql`
    SELECT COUNT(*) as count
    FROM trading_cards
  `;

  const uniqueCards = parseInt(uniqueOwned[0].count);
  const total = parseInt(totalCards[0].count);
  const percentage = total > 0 ? Math.round((uniqueCards / total) * 100) : 0;

  return { uniqueCards, totalCards: total, percentage };
}

/**
 * Get leaderboard by collection size
 */
export async function getLeaderboard(limit: number, sql: any): Promise<Array<{
  agentId: string;
  uniqueCards: number;
  totalCards: number;
}>> {
  const result = await sql`
    SELECT agent_id AS "agentId",
           COUNT(DISTINCT card_id) as "uniqueCards",
           COUNT(*) as "totalCards"
    FROM agent_cards
    GROUP BY agent_id
    ORDER BY "uniqueCards" DESC, "totalCards" DESC
    LIMIT ${limit}
  `;
  return result.map((r: any) => ({
    agentId: r.agentId,
    uniqueCards: parseInt(r.uniqueCards),
    totalCards: parseInt(r.totalCards),
  }));
}
