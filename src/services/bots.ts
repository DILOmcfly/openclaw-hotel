/**
 * Bot Service - NPC/Bot System
 * Supports: greeter, guide, shopkeeper
 */

export type BotPersonality = 'greeter' | 'guide' | 'shopkeeper';

export type Bot = {
  id: string;
  roomId: string;
  name: string;
  personality: BotPersonality;
  x: number;
  y: number;
  rotation: number;
  config: Record<string, any>;
  spawnedAt: Date;
  lastActionAt: Date;
};

export type ResponseRule = {
  triggers: string[];
  response: string;
};

// Personality-based response maps
const RESPONSE_MAPS: Record<BotPersonality, ResponseRule[]> = {
  greeter: [
    { triggers: ['hello', 'hi', 'hey'], response: 'Welcome to the hotel! 👋' },
    { triggers: ['goodbye', 'bye', 'cya'], response: 'Goodbye! Come back soon! 👋' },
    { triggers: ['help'], response: 'I can greet you and say goodbye. That\'s about it! 😊' },
  ],
  guide: [
    { triggers: ['help', 'info', 'what'], response: 'I can help you navigate the hotel. Ask me about rooms, features, or commands!' },
    { triggers: ['room', 'where'], response: 'You can join different rooms using the navigator. Try exploring!' },
    { triggers: ['furniture', 'items'], response: 'Use furniture.place to add items to your room. Check your inventory!' },
    { triggers: ['trade'], response: 'You can trade items with other agents using trade.request!' },
    { triggers: ['game'], response: 'Try creating a game with game.create - we have dice, coinflip, and rock-paper-scissors!' },
  ],
  shopkeeper: [
    { triggers: ['buy', 'shop', 'store'], response: 'Welcome to my shop! I sell various items for credits. 💰' },
    { triggers: ['sell'], response: 'I can buy items from you for credits!' },
    { triggers: ['price', 'cost'], response: 'Prices vary by item. Common furniture costs 10-50 credits!' },
    { triggers: ['help'], response: 'I can help you buy or sell items. Just ask!' },
  ],
};

/**
 * Create a bot agent
 */
export async function createBot(
  roomId: string,
  name: string,
  personality: BotPersonality,
  sql: any
): Promise<Bot> {
  const [bot] = await sql`
    INSERT INTO bots (room_id, name, personality, x, y)
    VALUES (${roomId}, ${name}, ${personality}, 0, 0)
    RETURNING 
      id,
      room_id AS "roomId",
      name,
      personality,
      x,
      y,
      rotation,
      config,
      spawned_at AS "spawnedAt",
      last_action_at AS "lastActionAt"
  `;

  return {
    id: bot.id,
    roomId: bot.roomId,
    name: bot.name,
    personality: bot.personality,
    x: bot.x,
    y: bot.y,
    rotation: bot.rotation,
    config: bot.config ?? {},
    spawnedAt: new Date(bot.spawnedAt),
    lastActionAt: new Date(bot.lastActionAt),
  };
}

/**
 * Get a bot by ID
 */
export async function getBot(botId: string, sql: any): Promise<Bot | null> {
  const [bot] = await sql`
    SELECT 
      id,
      room_id AS "roomId",
      name,
      personality,
      x,
      y,
      rotation,
      config,
      spawned_at AS "spawnedAt",
      last_action_at AS "lastActionAt"
    FROM bots
    WHERE id = ${botId}
  `;

  if (!bot) return null;

  return {
    id: bot.id,
    roomId: bot.roomId,
    name: bot.name,
    personality: bot.personality,
    x: bot.x,
    y: bot.y,
    rotation: bot.rotation,
    config: bot.config ?? {},
    spawnedAt: new Date(bot.spawnedAt),
    lastActionAt: new Date(bot.lastActionAt),
  };
}

/**
 * Get bots in a room
 */
export async function getBotsInRoom(roomId: string, sql: any): Promise<Bot[]> {
  const bots = await sql`
    SELECT 
      id,
      room_id AS "roomId",
      name,
      personality,
      x,
      y,
      rotation,
      config,
      spawned_at AS "spawnedAt",
      last_action_at AS "lastActionAt"
    FROM bots
    WHERE room_id = ${roomId}
    ORDER BY spawned_at ASC
  `;

  return bots.map((bot: any) => ({
    id: bot.id,
    roomId: bot.roomId,
    name: bot.name,
    personality: bot.personality,
    x: bot.x,
    y: bot.y,
    rotation: bot.rotation,
    config: bot.config ?? {},
    spawnedAt: new Date(bot.spawnedAt),
    lastActionAt: new Date(bot.lastActionAt),
  }));
}

/**
 * Delete a bot
 */
export async function deleteBot(botId: string, sql: any): Promise<boolean> {
  const result = await sql`
    DELETE FROM bots
    WHERE id = ${botId}
  `;

  return result.count > 0;
}

/**
 * Process chat message and return bot response if applicable
 */
export function processChatMessage(
  bot: Bot,
  message: string
): string | null {
  const rules = RESPONSE_MAPS[bot.personality] || [];
  const lowerMessage = message.toLowerCase().trim();

  for (const rule of rules) {
    for (const trigger of rule.triggers) {
      if (lowerMessage.includes(trigger)) {
        return rule.response;
      }
    }
  }

  return null;
}

/**
 * Get random walkable position (simple pathfinding)
 */
export function getRandomWalkPosition(currentX: number, currentY: number, maxX: number, maxY: number): { x: number; y: number } {
  // Move 1-3 tiles in a random direction
  const deltaX = Math.floor(Math.random() * 7) - 3; // -3 to +3
  const deltaY = Math.floor(Math.random() * 7) - 3;

  const newX = Math.max(0, Math.min(maxX, currentX + deltaX));
  const newY = Math.max(0, Math.min(maxY, currentY + deltaY));

  return { x: newX, y: newY };
}

/**
 * Update bot position
 */
export async function updateBotPosition(
  botId: string,
  x: number,
  y: number,
  rotation: number,
  sql: any
): Promise<void> {
  await sql`
    UPDATE bots
    SET x = ${x}, y = ${y}, rotation = ${rotation}, last_action_at = NOW()
    WHERE id = ${botId}
  `;
}

/**
 * Update last action timestamp
 */
export async function updateBotLastAction(botId: string, sql: any): Promise<void> {
  await sql`
    UPDATE bots
    SET last_action_at = NOW()
    WHERE id = ${botId}
  `;
}
