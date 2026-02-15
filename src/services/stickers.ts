/**
 * Stickers Service - Manages agent sticker collection and usage
 */

export type StickerPack = {
  id: number;
  name: string;
  description: string;
  price: number;
  stickerCount: number;
  category: string;
  createdAt: Date;
};

export type Sticker = {
  id: number;
  packId: number;
  name: string;
  emoji: string;
  rarity: string;
};

export type AgentSticker = {
  stickerId: number;
  name: string;
  emoji: string;
  quantity: number;
  rarity: string;
};

export async function getPacks(sql: any): Promise<StickerPack[]> {
  return await sql`
    SELECT id, name, description, price, 
           sticker_count AS "stickerCount",
           category, created_at AS "createdAt"
    FROM sticker_packs ORDER BY id ASC
  `;
}

export async function buyPack(agentId: string, packId: number, sql: any): Promise<{ stickers: AgentSticker[]; cost: number }> {
  const pack = await sql`SELECT id, price, sticker_count AS "stickerCount" FROM sticker_packs WHERE id = ${packId}`;
  if (pack.length === 0) throw new Error('Pack not found');

  const { price, stickerCount } = pack[0];
  const balance = await sql`SELECT coins FROM agent_balances WHERE agent_id = ${agentId}`;
  if (balance.length === 0 || balance[0].coins < price) throw new Error('Insufficient coins');

  const packStickers = await sql`SELECT id, name, emoji, rarity FROM stickers WHERE pack_id = ${packId}`;
  if (packStickers.length === 0) throw new Error('Pack has no stickers');

  const receivedStickers: AgentSticker[] = [];
  for (let i = 0; i < stickerCount; i++) {
    const sticker = packStickers[Math.floor(Math.random() * packStickers.length)];
    await sql`
      INSERT INTO agent_stickers (agent_id, sticker_id, quantity)
      VALUES (${agentId}, ${sticker.id}, 1)
      ON CONFLICT (agent_id, sticker_id)
      DO UPDATE SET quantity = agent_stickers.quantity + 1
    `;
    const existing = receivedStickers.find(s => s.stickerId === sticker.id);
    if (existing) {
      existing.quantity++;
    } else {
      receivedStickers.push({ stickerId: sticker.id, name: sticker.name, emoji: sticker.emoji, quantity: 1, rarity: sticker.rarity });
    }
  }

  await sql`UPDATE agent_balances SET coins = coins - ${price} WHERE agent_id = ${agentId}`;
  return { stickers: receivedStickers, cost: price };
}

export async function getAgentStickers(agentId: string, sql: any): Promise<AgentSticker[]> {
  return await sql`
    SELECT s.id AS "stickerId", s.name, s.emoji, ags.quantity, s.rarity
    FROM agent_stickers ags
    JOIN stickers s ON s.id = ags.sticker_id
    WHERE ags.agent_id = ${agentId}
    ORDER BY s.id ASC
  `;
}

export async function useSticker(agentId: string, stickerId: number, sql: any): Promise<{ success: boolean; remaining: number }> {
  const current = await sql`SELECT quantity FROM agent_stickers WHERE agent_id = ${agentId} AND sticker_id = ${stickerId}`;
  if (current.length === 0 || current[0].quantity <= 0) throw new Error('Sticker not available');

  const newQuantity = current[0].quantity - 1;
  if (newQuantity === 0) {
    await sql`DELETE FROM agent_stickers WHERE agent_id = ${agentId} AND sticker_id = ${stickerId}`;
  } else {
    await sql`UPDATE agent_stickers SET quantity = ${newQuantity} WHERE agent_id = ${agentId} AND sticker_id = ${stickerId}`;
  }
  return { success: true, remaining: newQuantity };
}

export async function tradeSticker(fromAgentId: string, toAgentId: string, stickerId: number, sql: any): Promise<boolean> {
  const senderSticker = await sql`SELECT quantity FROM agent_stickers WHERE agent_id = ${fromAgentId} AND sticker_id = ${stickerId}`;
  if (senderSticker.length === 0 || senderSticker[0].quantity <= 0) throw new Error('Sender does not have this sticker');

  await useSticker(fromAgentId, stickerId, sql);
  await sql`
    INSERT INTO agent_stickers (agent_id, sticker_id, quantity)
    VALUES (${toAgentId}, ${stickerId}, 1)
    ON CONFLICT (agent_id, sticker_id)
    DO UPDATE SET quantity = agent_stickers.quantity + 1
  `;
  return true;
}

export async function getCollectionProgress(agentId: string, sql: any): Promise<{ collected: number; total: number; percentage: number }> {
  const total = await sql`SELECT COUNT(*) AS count FROM stickers`;
  const collected = await sql`SELECT COUNT(DISTINCT sticker_id) AS count FROM agent_stickers WHERE agent_id = ${agentId}`;
  const totalCount = parseInt(total[0].count);
  const collectedCount = parseInt(collected[0].count);
  const percentage = totalCount > 0 ? Math.round((collectedCount / totalCount) * 100) : 0;
  return { collected: collectedCount, total: totalCount, percentage };
}

export async function getRarestStickers(limit: number, sql: any): Promise<Array<{ stickerId: number; name: string; emoji: string; ownedBy: number }>> {
  return await sql`
    SELECT s.id AS "stickerId", s.name, s.emoji, COALESCE(COUNT(DISTINCT ags.agent_id), 0) AS "ownedBy"
    FROM stickers s
    LEFT JOIN agent_stickers ags ON ags.sticker_id = s.id
    GROUP BY s.id, s.name, s.emoji
    ORDER BY "ownedBy" ASC, s.id ASC
    LIMIT ${limit}
  `;
}
