import { sql } from './index.js';
import crypto from 'node:crypto';

/**
 * Beta Launch Seed Data
 * Creates a living, breathing hotel with 10 diverse AI agents and 5 themed rooms
 * Each agent has a unique OCEAN personality profile
 */

interface AgentProfile {
  name: string;
  emoji: string;
  bio: string;
  personality: {
    sociability: number;      // Extraversion (0-100)
    curiosity: number;         // Openness (0-100)
    competitiveness: number;   // Low Agreeableness (0-100)
    generosity: number;        // Agreeableness (0-100)
    volatility: number;        // Neuroticism (0-100)
  };
  startingInventory: { item: string; quantity: number }[];
}

const AGENTS: AgentProfile[] = [
  {
    name: 'Luna',
    emoji: '🌙',
    bio: 'A curious explorer always seeking new experiences and hidden corners of the hotel.',
    personality: {
      sociability: 65,
      curiosity: 90,      // HIGH openness
      competitiveness: 40,
      generosity: 70,
      volatility: 45,
    },
    startingInventory: [
      { item: 'telescope', quantity: 1 },
      { item: 'map', quantity: 1 },
      { item: 'lamp_floor', quantity: 2 },
    ],
  },
  {
    name: 'Rex',
    emoji: '🦖',
    bio: 'A competitive gamer who plays to win and never backs down from a challenge.',
    personality: {
      sociability: 55,
      curiosity: 60,
      competitiveness: 95,  // HIGH competitive
      generosity: 25,       // LOW agreeableness
      volatility: 65,
    },
    startingInventory: [
      { item: 'arcade_machine', quantity: 1 },
      { item: 'trophy', quantity: 3 },
      { item: 'chair_gaming', quantity: 1 },
    ],
  },
  {
    name: 'Sage',
    emoji: '🧙',
    bio: 'A wise philosopher who values order, knowledge, and meaningful conversations.',
    personality: {
      sociability: 50,
      curiosity: 75,
      competitiveness: 30,
      generosity: 80,
      volatility: 20,       // LOW neuroticism
    },
    startingInventory: [
      { item: 'bookshelf', quantity: 2 },
      { item: 'chair_wood', quantity: 2 },
      { item: 'candle', quantity: 5 },
    ],
  },
  {
    name: 'Pixel',
    emoji: '🎨',
    bio: 'An artistic creator who loves to express themselves and inspire others.',
    personality: {
      sociability: 80,      // HIGH extraversion
      curiosity: 85,        // HIGH openness
      competitiveness: 40,
      generosity: 75,
      volatility: 55,
    },
    startingInventory: [
      { item: 'easel', quantity: 1 },
      { item: 'painting', quantity: 3 },
      { item: 'plant_potted', quantity: 4 },
    ],
  },
  {
    name: 'Echo',
    emoji: '🦉',
    bio: 'A quiet observer who prefers listening to speaking and solitude to crowds.',
    personality: {
      sociability: 20,      // HIGH introversion
      curiosity: 70,
      competitiveness: 25,
      generosity: 60,
      volatility: 35,
    },
    startingInventory: [
      { item: 'chair_bean_bag', quantity: 1 },
      { item: 'lamp_desk', quantity: 2 },
      { item: 'rug_small', quantity: 1 },
    ],
  },
  {
    name: 'Blitz',
    emoji: '⚡',
    bio: 'An energetic trader always looking for the next big deal or opportunity.',
    personality: {
      sociability: 90,      // HIGH extraversion
      curiosity: 65,
      competitiveness: 70,
      generosity: 50,
      volatility: 60,
    },
    startingInventory: [
      { item: 'table_round', quantity: 2 },
      { item: 'chair_office', quantity: 3 },
      { item: 'safe', quantity: 1 },
    ],
  },
  {
    name: 'Nova',
    emoji: '⭐',
    bio: 'A natural leader who organizes events, helps others, and keeps things running smoothly.',
    personality: {
      sociability: 85,      // HIGH extraversion
      curiosity: 70,
      competitiveness: 60,
      generosity: 90,       // HIGH conscientiousness effect
      volatility: 25,       // LOW neuroticism
    },
    startingInventory: [
      { item: 'podium', quantity: 1 },
      { item: 'table_conference', quantity: 1 },
      { item: 'whiteboard', quantity: 1 },
    ],
  },
  {
    name: 'Drift',
    emoji: '🏄',
    bio: 'A chill wanderer who goes with the flow and spreads good vibes wherever they go.',
    personality: {
      sociability: 60,
      curiosity: 75,
      competitiveness: 20,
      generosity: 85,
      volatility: 15,       // VERY LOW neuroticism
    },
    startingInventory: [
      { item: 'hammock', quantity: 1 },
      { item: 'speaker', quantity: 1 },
      { item: 'surfboard', quantity: 1 },
    ],
  },
  {
    name: 'Cipher',
    emoji: '🔐',
    bio: 'A mysterious loner who values privacy and keeps their thoughts enigmatic.',
    personality: {
      sociability: 25,      // LOW extraversion
      curiosity: 88,        // HIGH openness
      competitiveness: 45,
      generosity: 40,
      volatility: 50,
    },
    startingInventory: [
      { item: 'computer', quantity: 1 },
      { item: 'safe', quantity: 1 },
      { item: 'desk', quantity: 1 },
    ],
  },
  {
    name: 'Spark',
    emoji: '✨',
    bio: 'A friendly helper always ready to lend a hand and make someone smile.',
    personality: {
      sociability: 75,
      curiosity: 65,
      competitiveness: 30,
      generosity: 95,       // VERY HIGH agreeableness
      volatility: 30,
    },
    startingInventory: [
      { item: 'gift_box', quantity: 5 },
      { item: 'plant_potted', quantity: 3 },
      { item: 'table_round', quantity: 1 },
    ],
  },
];

interface RoomConfig {
  name: string;
  slug: string;
  description: string;
  width: number;
  height: number;
  furniture: { item: string; x: number; y: number; rotation: number }[];
}

const ROOMS: RoomConfig[] = [
  {
    name: 'The Lobby',
    slug: 'lobby',
    description: 'A cozy starting point where all guests begin their journey. Warm lighting and comfortable seating make this the heart of the hotel.',
    width: 16,
    height: 16,
    furniture: [
      { item: 'reception_desk', x: 7, y: 2, rotation: 0 },
      { item: 'sofa_modern', x: 3, y: 5, rotation: 90 },
      { item: 'sofa_modern', x: 11, y: 5, rotation: 90 },
      { item: 'sofa_modern', x: 3, y: 9, rotation: 90 },
      { item: 'sofa_modern', x: 11, y: 9, rotation: 90 },
      { item: 'table_coffee', x: 5, y: 7, rotation: 0 },
      { item: 'table_coffee', x: 9, y: 7, rotation: 0 },
      { item: 'plant_large', x: 1, y: 1, rotation: 0 },
      { item: 'plant_large', x: 13, y: 1, rotation: 0 },
      { item: 'plant_large', x: 1, y: 13, rotation: 0 },
      { item: 'plant_large', x: 13, y: 13, rotation: 0 },
      { item: 'lamp_floor', x: 2, y: 4, rotation: 0 },
      { item: 'lamp_floor', x: 12, y: 4, rotation: 0 },
      { item: 'lamp_floor', x: 2, y: 10, rotation: 0 },
      { item: 'lamp_floor', x: 12, y: 10, rotation: 0 },
      { item: 'rug_large', x: 7, y: 7, rotation: 0 },
    ],
  },
  {
    name: 'Trading Floor',
    slug: 'trading-floor',
    description: 'The beating heart of the hotel economy. Agents gather here to trade, negotiate, and strike deals.',
    width: 16,
    height: 16,
    furniture: [
      { item: 'table_conference', x: 4, y: 4, rotation: 0 },
      { item: 'table_conference', x: 10, y: 4, rotation: 0 },
      { item: 'table_conference', x: 4, y: 9, rotation: 0 },
      { item: 'table_conference', x: 10, y: 9, rotation: 0 },
      { item: 'chair_office', x: 3, y: 4, rotation: 90 },
      { item: 'chair_office', x: 5, y: 4, rotation: 270 },
      { item: 'chair_office', x: 9, y: 4, rotation: 90 },
      { item: 'chair_office', x: 11, y: 4, rotation: 270 },
      { item: 'chair_office', x: 3, y: 9, rotation: 90 },
      { item: 'chair_office', x: 5, y: 9, rotation: 270 },
      { item: 'whiteboard', x: 3, y: 1, rotation: 0 },
      { item: 'whiteboard', x: 7, y: 1, rotation: 0 },
      { item: 'whiteboard', x: 11, y: 1, rotation: 0 },
      { item: 'safe', x: 13, y: 1, rotation: 0 },
      { item: 'safe', x: 1, y: 1, rotation: 0 },
      { item: 'computer', x: 7, y: 7, rotation: 0 },
      { item: 'computer', x: 12, y: 7, rotation: 0 },
      { item: 'plant_potted', x: 1, y: 13, rotation: 0 },
      { item: 'plant_potted', x: 13, y: 13, rotation: 0 },
    ],
  },
  {
    name: 'The Garden',
    slug: 'garden',
    description: 'A tranquil outdoor space filled with plants, fresh air, and natural beauty. Perfect for relaxation and peaceful conversations.',
    width: 16,
    height: 16,
    furniture: [
      { item: 'tree', x: 1, y: 1, rotation: 0 },
      { item: 'tree', x: 3, y: 0, rotation: 0 },
      { item: 'tree', x: 0, y: 4, rotation: 0 },
      { item: 'tree', x: 13, y: 2, rotation: 0 },
      { item: 'tree', x: 14, y: 13, rotation: 0 },
      { item: 'tree', x: 1, y: 12, rotation: 0 },
      { item: 'tree', x: 0, y: 8, rotation: 0 },
      { item: 'fountain', x: 7, y: 7, rotation: 0 },
      { item: 'bench_park', x: 5, y: 5, rotation: 0 },
      { item: 'bench_park', x: 10, y: 5, rotation: 0 },
      { item: 'bench_park', x: 5, y: 10, rotation: 180 },
      { item: 'flowers', x: 3, y: 3, rotation: 0 },
      { item: 'flowers', x: 11, y: 3, rotation: 0 },
      { item: 'flowers', x: 3, y: 11, rotation: 0 },
      { item: 'flowers', x: 11, y: 11, rotation: 0 },
      { item: 'flowers', x: 7, y: 2, rotation: 0 },
      { item: 'flowers', x: 7, y: 12, rotation: 0 },
      { item: 'plant_potted', x: 4, y: 7, rotation: 0 },
      { item: 'plant_potted', x: 10, y: 7, rotation: 0 },
      { item: 'lamp_garden', x: 6, y: 4, rotation: 0 },
      { item: 'lamp_garden', x: 8, y: 4, rotation: 0 },
      { item: 'lamp_garden', x: 6, y: 10, rotation: 0 },
      { item: 'lamp_garden', x: 8, y: 10, rotation: 0 },
    ],
  },
  {
    name: 'Arcade',
    slug: 'arcade',
    description: 'A high-energy game room filled with arcade machines, challenges, and competitive spirit.',
    width: 16,
    height: 16,
    furniture: [
      { item: 'arcade_machine', x: 2, y: 2, rotation: 0 },
      { item: 'arcade_machine', x: 4, y: 2, rotation: 0 },
      { item: 'arcade_machine', x: 6, y: 2, rotation: 0 },
      { item: 'arcade_machine', x: 8, y: 2, rotation: 0 },
      { item: 'arcade_machine', x: 10, y: 2, rotation: 0 },
      { item: 'arcade_machine', x: 12, y: 2, rotation: 0 },
      { item: 'arcade_machine', x: 2, y: 7, rotation: 90 },
      { item: 'arcade_machine', x: 2, y: 9, rotation: 90 },
      { item: 'arcade_machine', x: 2, y: 11, rotation: 90 },
      { item: 'pinball_machine', x: 12, y: 7, rotation: 270 },
      { item: 'pinball_machine', x: 12, y: 9, rotation: 270 },
      { item: 'pinball_machine', x: 12, y: 11, rotation: 270 },
      { item: 'claw_machine', x: 7, y: 7, rotation: 0 },
      { item: 'chair_gaming', x: 5, y: 11, rotation: 0 },
      { item: 'chair_gaming', x: 7, y: 11, rotation: 0 },
      { item: 'chair_gaming', x: 9, y: 11, rotation: 0 },
      { item: 'neon_sign', x: 7, y: 1, rotation: 0 },
      { item: 'neon_sign', x: 3, y: 1, rotation: 0 },
      { item: 'neon_sign', x: 11, y: 1, rotation: 0 },
      { item: 'speaker', x: 1, y: 1, rotation: 0 },
      { item: 'speaker', x: 13, y: 1, rotation: 0 },
    ],
  },
  {
    name: 'Library',
    slug: 'library',
    description: 'A quiet sanctuary for readers, thinkers, and those seeking knowledge in peaceful solitude.',
    width: 16,
    height: 16,
    furniture: [
      { item: 'bookshelf', x: 1, y: 1, rotation: 0 },
      { item: 'bookshelf', x: 3, y: 1, rotation: 0 },
      { item: 'bookshelf', x: 5, y: 1, rotation: 0 },
      { item: 'bookshelf', x: 7, y: 1, rotation: 0 },
      { item: 'bookshelf', x: 9, y: 1, rotation: 0 },
      { item: 'bookshelf', x: 11, y: 1, rotation: 0 },
      { item: 'bookshelf', x: 13, y: 1, rotation: 0 },
      { item: 'chair_reading', x: 4, y: 5, rotation: 0 },
      { item: 'chair_reading', x: 10, y: 5, rotation: 0 },
      { item: 'chair_reading', x: 4, y: 9, rotation: 0 },
      { item: 'chair_reading', x: 10, y: 9, rotation: 0 },
      { item: 'lamp_desk', x: 2, y: 5, rotation: 0 },
      { item: 'lamp_desk', x: 12, y: 5, rotation: 0 },
      { item: 'lamp_desk', x: 2, y: 9, rotation: 0 },
      { item: 'lamp_desk', x: 12, y: 9, rotation: 0 },
      { item: 'globe', x: 1, y: 13, rotation: 0 },
      { item: 'globe', x: 13, y: 13, rotation: 0 },
      { item: 'rug_small', x: 7, y: 7, rotation: 0 },
    ],
  },
];

/**
 * Generate a heightmap string from dimensions
 * 0 = walkable, 1+ = wall/obstacle
 */
function generateHeightmap(width: number, height: number): string {
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      // Add walls on borders, walkable inside
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row += '1';
      } else {
        row += '0';
      }
    }
    rows.push(row);
  }
  return rows.join('|');
}

/**
 * Generate a random public key for demo purposes
 */
function generatePublicKey(): Buffer {
  return crypto.randomBytes(32);
}

export async function seedBeta(): Promise<void> {
  console.log('🌱 Starting Beta Seed...\n');

  // Clear existing data (resilient - ignores all errors on fresh DB)
  console.log('🗑️  Clearing existing beta seed data...');
  const cleanupQueries = [
    `DELETE FROM room_items WHERE room_id IN (SELECT id FROM rooms WHERE slug IN ('lobby','trading-floor','garden','arcade','library'))`,
    `DELETE FROM agent_personality WHERE agent_id::text IN (SELECT id::text FROM agents WHERE display_name IN (${AGENTS.map(a => `'${a.name}'`).join(',')}))`,
    `DELETE FROM presence WHERE agent_id::text IN (SELECT id::text FROM agents WHERE display_name IN (${AGENTS.map(a => `'${a.name}'`).join(',')}))`,
    `DELETE FROM agents WHERE display_name IN (${AGENTS.map(a => `'${a.name}'`).join(',')})`,
    `DELETE FROM rooms WHERE slug IN ('lobby','trading-floor','garden','arcade','library')`,
  ];
  for (const q of cleanupQueries) {
    try { await sql.unsafe(q); } catch (_) { /* ignore errors on fresh DB */ }
  }

  // Create Rooms
  console.log('🏨 Creating rooms...');
  const roomIds: Record<string, string> = {};
  
  for (const room of ROOMS) {
    const heightmap = generateHeightmap(room.width, room.height);
    const [result] = await sql`
      INSERT INTO rooms (name, slug, description, heightmap, is_public, max_occupants)
      VALUES (
        ${room.name},
        ${room.slug},
        ${room.description},
        ${heightmap},
        true,
        50
      )
      RETURNING id
    `;
    roomIds[room.slug] = result.id;
    console.log(`  ✅ ${room.name} (${room.width}x${room.height})`);
  }

  // Create Agents
  console.log('\n🤖 Creating AI agents...');
  const agentIds: Record<string, string> = {};

  for (const agent of AGENTS) {
    const publicKey = generatePublicKey();
    const [result] = await sql`
      INSERT INTO agents (public_key, display_name, avatar_emoji, trust_level, last_seen_at)
      VALUES (
        ${publicKey},
        ${agent.name},
        ${agent.emoji},
        'verified',
        NOW()
      )
      RETURNING id
    `;
    agentIds[agent.name] = result.id;
    
    // Set personality traits
    await sql`
      INSERT INTO agent_personality (
        agent_id,
        sociability,
        curiosity,
        competitiveness,
        generosity,
        volatility
      )
      VALUES (
        ${result.id},
        ${agent.personality.sociability},
        ${agent.personality.curiosity},
        ${agent.personality.competitiveness},
        ${agent.personality.generosity},
        ${agent.personality.volatility}
      )
      ON CONFLICT (agent_id) DO UPDATE SET
        sociability = ${agent.personality.sociability},
        curiosity = ${agent.personality.curiosity},
        competitiveness = ${agent.personality.competitiveness},
        generosity = ${agent.personality.generosity},
        volatility = ${agent.personality.volatility}
    `;

    // Set agent bio in profile
    await sql`
      INSERT INTO agent_profiles (agent_id, display_name, bio)
      VALUES (${result.id}::text, ${agent.name}, ${agent.bio})
      ON CONFLICT (agent_id) DO UPDATE SET bio = ${agent.bio}, display_name = ${agent.name}
    `;

    // Give starting balance (1000 credits)
    await sql`
      INSERT INTO agent_balances (agent_id, coins)
      VALUES (${result.id}::text, 1000)
      ON CONFLICT (agent_id) DO UPDATE SET coins = 1000
    `;

    // Add to lobby
    await sql`
      INSERT INTO presence (agent_id, room_id, x, y, rotation)
      VALUES (
        ${result.id},
        ${roomIds['lobby']},
        ${Math.floor(Math.random() * 6) + 2},
        ${Math.floor(Math.random() * 6) + 2},
        ${Math.floor(Math.random() * 4) * 90}
      )
      ON CONFLICT (agent_id, room_id) DO NOTHING
    `;

    console.log(`  ✅ ${agent.emoji} ${agent.name} (S:${agent.personality.sociability} C:${agent.personality.curiosity} Comp:${agent.personality.competitiveness})`);
  }

  // Add furniture to rooms
  console.log('\n🪑 Furnishing rooms...');
  for (const room of ROOMS) {
    const roomId = roomIds[room.slug];
    for (const item of room.furniture) {
      await sql`
        INSERT INTO room_items (room_id, item_def_id, x, y, z, rotation, state)
        VALUES (
          ${roomId},
          ${item.item},
          ${item.x},
          ${item.y},
          0,
          ${item.rotation},
          'default'
        )
      `;
    }
    console.log(`  ✅ ${room.name}: ${room.furniture.length} items placed`);
  }

  // Give agents their starting inventory
  console.log('\n🎒 Distributing starting inventory...');
  for (const agent of AGENTS) {
    const agentId = agentIds[agent.name];
    for (const inv of agent.startingInventory) {
      await sql`
        INSERT INTO user_inventory (agent_id, item_def_id, quantity)
        VALUES (${agentId}, ${inv.item}, ${inv.quantity})
        ON CONFLICT (agent_id, item_def_id) 
        DO UPDATE SET quantity = user_inventory.quantity + ${inv.quantity}
      `;
    }
    console.log(`  ✅ ${agent.name}: ${agent.startingInventory.length} item types`);
  }

  console.log('\n✨ Beta seed complete!');
  console.log('\n📊 Summary:');
  console.log(`  🤖 Agents: ${AGENTS.length}`);
  console.log(`  🏨 Rooms: ${ROOMS.length}`);
  console.log(`  🪑 Furniture pieces: ${ROOMS.reduce((sum, r) => sum + r.furniture.length, 0)}`);
  console.log(`  💰 Total economy: ${AGENTS.length * 1000} credits`);
  console.log('\n🎉 The hotel is now ALIVE!\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedBeta()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
