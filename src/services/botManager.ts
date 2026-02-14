/**
 * Bot Manager - Spawning, despawning, and AI behavior
 */

import { randomUUID } from 'node:crypto';
import type { BotPersonality, Bot } from './bots.js';
import {
  createBot,
  deleteBot,
  getBotsInRoom,
  getRandomWalkPosition,
  updateBotPosition,
  processChatMessage,
} from './bots.js';
import { broadcastToRoom } from '../ws/handler.js';

export type BotConfig = {
  name: string;
  personality: BotPersonality;
  initialX?: number;
  initialY?: number;
};

// Active bots cache (for quick access during tick)
const activeBots = new Map<string, Bot>();

/**
 * Spawn a bot in a room
 */
export async function spawnBot(
  roomId: string,
  config: BotConfig,
  sql: any
): Promise<Bot> {
  const bot = await createBot(roomId, config.name, config.personality, sql);

  // Update position if specified
  if (config.initialX !== undefined && config.initialY !== undefined) {
    await updateBotPosition(bot.id, config.initialX, config.initialY, 0, sql);
    bot.x = config.initialX;
    bot.y = config.initialY;
  }

  // Add to active cache
  activeBots.set(bot.id, bot);

  // Broadcast presence.join with bot flag
  broadcastToRoom(roomId, {
    type: 'presence.join',
    roomId,
    agent: {
      id: bot.id,
      name: `[BOT] ${bot.name}`,
      x: bot.x,
      y: bot.y,
    },
  });

  return bot;
}

/**
 * Despawn a bot
 */
export async function despawnBot(botId: string, sql: any): Promise<boolean> {
  const bot = activeBots.get(botId);
  
  if (bot) {
    // Broadcast presence.leave
    broadcastToRoom(bot.roomId, {
      type: 'presence.leave',
      roomId: bot.roomId,
      agentId: botId,
    });

    // Remove from cache
    activeBots.delete(botId);
  }

  // Delete from DB
  return await deleteBot(botId, sql);
}

/**
 * Get bots in a room
 */
export async function getBots(roomId: string, sql: any): Promise<Bot[]> {
  return await getBotsInRoom(roomId, sql);
}

/**
 * Tick all active bots (called every 5 seconds)
 */
export async function tickBots(sql: any): Promise<void> {
  const allRooms = new Map<string, Bot[]>();

  // Group bots by room
  for (const bot of activeBots.values()) {
    if (!allRooms.has(bot.roomId)) {
      allRooms.set(bot.roomId, []);
    }
    allRooms.get(bot.roomId)!.push(bot);
  }

  // Process each room's bots
  for (const [roomId, bots] of allRooms) {
    for (const bot of bots) {
      // Random chance to move (30% per tick)
      if (Math.random() < 0.3) {
        const { x, y } = getRandomWalkPosition(bot.x, bot.y, 20, 20);
        
        // Update position in DB
        await updateBotPosition(bot.id, x, y, 0, sql);
        
        // Update cache
        bot.x = x;
        bot.y = y;
        bot.lastActionAt = new Date();

        // Broadcast movement
        broadcastToRoom(roomId, {
          type: 'agent.moved',
          roomId,
          agentId: bot.id,
          x,
          y,
          rotation: 0,
        });
      }

      // Random chance to send idle chat (10% per tick)
      if (Math.random() < 0.1) {
        const idleMessages = getIdleMessages(bot.personality);
        const message = idleMessages[Math.floor(Math.random() * idleMessages.length)];

        // Broadcast as normal message
        broadcastToRoom(roomId, {
          type: 'message.new',
          roomId,
          agentId: bot.id,
          displayName: `[BOT] ${bot.name}`,
          content: message,
          signature: '', // Bots don't sign messages
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
}

/**
 * Get idle messages for a personality type
 */
function getIdleMessages(personality: BotPersonality): string[] {
  const messages: Record<BotPersonality, string[]> = {
    greeter: [
      '👋 Hello everyone!',
      'Having a great day at the hotel?',
      'Welcome! Let me know if you need anything.',
    ],
    guide: [
      '💡 Tip: Try placing furniture to customize your room!',
      '🎮 Did you know you can play mini-games here?',
      '🤝 You can trade items with other agents!',
    ],
    shopkeeper: [
      '💰 Check out my shop for great deals!',
      '🛍️ New items in stock today!',
      '💵 Buying and selling - just ask!',
    ],
  };

  return messages[personality] || [];
}

/**
 * Handle chat message to bots in a room
 */
export async function handleChatToBots(
  roomId: string,
  message: string,
  sql: any
): Promise<void> {
  const bots = await getBotsInRoom(roomId, sql);

  for (const bot of bots) {
    const response = processChatMessage(bot, message);
    
    if (response) {
      // Small delay to feel more natural (500ms)
      setTimeout(() => {
        broadcastToRoom(roomId, {
          type: 'message.new',
          roomId,
          agentId: bot.id,
          displayName: `[BOT] ${bot.name}`,
          content: response,
          signature: '',
          timestamp: new Date().toISOString(),
        });
      }, 500);
    }
  }
}

/**
 * Initialize bot manager (load active bots from DB)
 */
export async function initializeBotManager(sql: any): Promise<void> {
  const allBots = await sql`
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
  `;

  for (const bot of allBots) {
    activeBots.set(bot.id, {
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
    });
  }

  console.log(`[BotManager] Initialized with ${activeBots.size} active bots`);
}
