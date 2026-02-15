export type CollectibleCard = {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  series: string;
  imageKey: string;
  maxSupply: number;
  minted: number;
  createdAt: string;
};

export type AgentCard = {
  agentId: string;
  cardId: string;
  quantity: number;
  acquiredAt: string;
};

export type CardWithQuantity = CollectibleCard & {
  quantity: number;
};

const CARD_COLUMNS = `id, name, description, rarity, series, image_key AS "imageKey", max_supply AS "maxSupply", minted, created_at AS "createdAt"`;

/**
 * Get all cards in the catalog
 */
export async function getAllCards(sql: any): Promise<CollectibleCard[]> {
  return await sql`SELECT ${sql.raw(CARD_COLUMNS)} FROM collectible_cards ORDER BY 
    CASE rarity 
      WHEN 'legendary' THEN 1 
      WHEN 'epic' THEN 2 
      WHEN 'rare' THEN 3 
      WHEN 'uncommon' THEN 4 
      WHEN 'common' THEN 5 
    END, name`;
}

/**
 * Get agent's card collection with quantities
 */
export async function getMyCards(agentId: string, sql: any): Promise<CardWithQuantity[]> {
  const result = await sql`
    SELECT c.id, c.name, c.description, c.rarity, c.series, c.image_key AS "imageKey", 
           c.max_supply AS "maxSupply", c.minted, c.created_at AS "createdAt", ac.quantity
    FROM collectible_cards c
    INNER JOIN agent_cards ac ON c.id = ac.card_id
    WHERE ac.agent_id = ${sql.typed.text(agentId)}
    ORDER BY CASE c.rarity 
      WHEN 'legendary' THEN 1 
      WHEN 'epic' THEN 2 
      WHEN 'rare' THEN 3 
      WHEN 'uncommon' THEN 4 
      WHEN 'common' THEN 5 
    END, c.name`;
  return result;
}

/**
 * Mint (give) a card to an agent, respecting supply limits
 */
export async function mintCard(cardId: string, agentId: string, sql: any): Promise<CardWithQuantity> {
  // Check if card exists and supply
  const card = await sql`SELECT ${sql.raw(CARD_COLUMNS)} FROM collectible_cards WHERE id = ${sql.typed.text(cardId)}`;
  
  if (card.length === 0) {
    throw new Error('Card not found');
  }
  
  const cardData = card[0];
  
  if (cardData.minted >= cardData.maxSupply) {
    throw new Error('Card supply exhausted');
  }
  
  // Check if agent already has this card
  const existing = await sql`SELECT quantity FROM agent_cards WHERE agent_id = ${sql.typed.text(agentId)} AND card_id = ${sql.typed.text(cardId)}`;
  
  if (existing.length > 0) {
    // Increment quantity
    await sql`UPDATE agent_cards SET quantity = quantity + 1 WHERE agent_id = ${sql.typed.text(agentId)} AND card_id = ${sql.typed.text(cardId)}`;
  } else {
    // Insert new card
    await sql`INSERT INTO agent_cards (agent_id, card_id, quantity, acquired_at) VALUES (${sql.typed.text(agentId)}, ${sql.typed.text(cardId)}, 1, NOW())`;
  }
  
  // Increment minted count
  await sql`UPDATE collectible_cards SET minted = minted + 1 WHERE id = ${sql.typed.text(cardId)}`;
  
  // Return updated card with quantity
  const result = await sql`
    SELECT c.id, c.name, c.description, c.rarity, c.series, c.image_key AS "imageKey", 
           c.max_supply AS "maxSupply", c.minted, c.created_at AS "createdAt", ac.quantity
    FROM collectible_cards c
    INNER JOIN agent_cards ac ON c.id = ac.card_id
    WHERE ac.agent_id = ${sql.typed.text(agentId)} AND c.id = ${sql.typed.text(cardId)}`;
  
  return result[0];
}

/**
 * Trade cards between agents
 */
export async function tradeCards(fromAgent: string, toAgent: string, cardId: string, quantity: number, sql: any): Promise<void> {
  if (quantity <= 0) {
    throw new Error('Quantity must be positive');
  }
  
  // Check if fromAgent has enough cards
  const fromCards = await sql`SELECT quantity FROM agent_cards WHERE agent_id = ${sql.typed.text(fromAgent)} AND card_id = ${sql.typed.text(cardId)}`;
  
  if (fromCards.length === 0) {
    throw new Error('You do not own this card');
  }
  
  if (fromCards[0].quantity < quantity) {
    throw new Error('Insufficient card quantity');
  }
  
  // Deduct from sender
  const newFromQuantity = fromCards[0].quantity - quantity;
  
  if (newFromQuantity === 0) {
    await sql`DELETE FROM agent_cards WHERE agent_id = ${sql.typed.text(fromAgent)} AND card_id = ${sql.typed.text(cardId)}`;
  } else {
    await sql`UPDATE agent_cards SET quantity = ${sql.typed.int4(newFromQuantity)} WHERE agent_id = ${sql.typed.text(fromAgent)} AND card_id = ${sql.typed.text(cardId)}`;
  }
  
  // Add to receiver
  const toCards = await sql`SELECT quantity FROM agent_cards WHERE agent_id = ${sql.typed.text(toAgent)} AND card_id = ${sql.typed.text(cardId)}`;
  
  if (toCards.length > 0) {
    await sql`UPDATE agent_cards SET quantity = quantity + ${sql.typed.int4(quantity)} WHERE agent_id = ${sql.typed.text(toAgent)} AND card_id = ${sql.typed.text(cardId)}`;
  } else {
    await sql`INSERT INTO agent_cards (agent_id, card_id, quantity, acquired_at) VALUES (${sql.typed.text(toAgent)}, ${sql.typed.text(cardId)}, ${sql.typed.int4(quantity)}, NOW())`;
  }
}

/**
 * Get cards filtered by rarity
 */
export async function getCardsByRarity(rarity: CollectibleCard['rarity'], sql: any): Promise<CollectibleCard[]> {
  const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  
  if (!validRarities.includes(rarity)) {
    throw new Error('Invalid rarity');
  }
  
  return await sql`SELECT ${sql.raw(CARD_COLUMNS)} FROM collectible_cards WHERE rarity = ${sql.typed.text(rarity)} ORDER BY name`;
}

/**
 * Get collection completion percentage for an agent
 */
export async function getCollectionCompletion(agentId: string, sql: any): Promise<{ total: number; owned: number; percentage: number }> {
  const totalCards = await sql`SELECT COUNT(DISTINCT id) AS count FROM collectible_cards`;
  const ownedCards = await sql`SELECT COUNT(DISTINCT card_id) AS count FROM agent_cards WHERE agent_id = ${sql.typed.text(agentId)}`;
  
  const total = Number(totalCards[0]?.count || 0);
  const owned = Number(ownedCards[0]?.count || 0);
  const percentage = total > 0 ? Math.round((owned / total) * 100) : 0;
  
  return { total, owned, percentage };
}
