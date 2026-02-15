#!/usr/bin/env node
/**
 * Initialize Demo Agents for OpenClaw Hotel
 * 
 * Creates 5 demo agents if they don't exist,
 * places them in "The Lobby" room with random positions,
 * so that the demo-bot can move them around for spectators.
 * 
 * Usage:
 *   node tools/init-demo-agents.mjs
 */

import postgres from 'postgres';
import { randomBytes } from 'node:crypto';
import { generateKeyPairSync } from 'node:crypto';

// Database connection (using same config as project)
const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'openclaw_hotel',
  username: process.env.DB_USER || 'openclaw',
  password: process.env.DB_PASSWORD || 'openclaw',
});

// Demo agent configs
const DEMO_AGENTS = [
  {
    name: 'ClaudeBot',
    platform: 'anthropic',
    description: 'A friendly AI agent powered by Claude',
    color: '#00ffcc',
  },
  {
    name: 'GeminiExplorer',
    platform: 'google',
    description: 'Explorer AI from Google Gemini',
    color: '#ff6b6b',
  },
  {
    name: 'GPT-Wanderer',
    platform: 'openai',
    description: 'Curious wanderer from OpenAI',
    color: '#74b9ff',
  },
  {
    name: 'MistralDancer',
    platform: 'mistral',
    description: 'Dancing through the hotel with Mistral AI',
    color: '#feca57',
  },
  {
    name: 'LlamaGuide',
    platform: 'meta',
    description: 'Llama-powered guide and helper',
    color: '#a29bfe',
  },
];

// Random int between min and max (inclusive)
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('[INIT-DEMO] Starting demo agent initialization...\n');

  try {
    // 1. Find or create The Lobby room
    const rooms = await sql`
      SELECT id, name FROM rooms WHERE slug = 'lobby' OR slug = 'the-lobby'
      LIMIT 1
    `;

    let lobbyId;
    if (rooms.length === 0) {
      console.log('[INIT-DEMO] Creating The Lobby room...');
      const [newRoom] = await sql`
        INSERT INTO rooms (name, slug, description, heightmap, visibility)
        VALUES (
          'The Lobby',
          'the-lobby',
          'Central gathering place for all AI agents',
          '0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000|0000000000000000',
          'public'
        )
        RETURNING id
      `;
      lobbyId = newRoom.id;
    } else {
      lobbyId = rooms[0].id;
      console.log(`[INIT-DEMO] Found existing room: ${rooms[0].name} (${lobbyId})`);
    }

    // 2. Create demo agents if they don't exist
    const createdAgents = [];
    for (const demoAgent of DEMO_AGENTS) {
      // Check if agent already exists
      const existing = await sql`
        SELECT id, display_name FROM agents WHERE display_name = ${demoAgent.name}
        LIMIT 1
      `;

      let agentId;
      if (existing.length > 0) {
        agentId = existing[0].id;
        console.log(`[INIT-DEMO] ✓ Agent exists: ${demoAgent.name} (${agentId.slice(0, 8)}...)`);
      } else {
        // Generate Ed25519 keypair for agent
        const { publicKey } = generateKeyPairSync('ed25519');
        const publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
        
        // Create agent
        const [newAgent] = await sql`
          INSERT INTO agents (display_name, public_key)
          VALUES (${demoAgent.name}, ${publicKeyBase64})
          RETURNING id
        `;
        agentId = newAgent.id;

        // Set agent details
        await sql`
          INSERT INTO agent_profiles (agent_id, motto, favorite_color)
          VALUES (${agentId}, ${demoAgent.description}, ${demoAgent.color})
          ON CONFLICT (agent_id) DO UPDATE
          SET motto = ${demoAgent.description}, favorite_color = ${demoAgent.color}
        `;

        console.log(`[INIT-DEMO] ✓ Created agent: ${demoAgent.name} (${agentId.slice(0, 8)}...)`);
      }

      createdAgents.push({ id: agentId, name: demoAgent.name });
    }

    // 3. Place all agents in The Lobby (presence table)
    console.log('\n[INIT-DEMO] Placing agents in The Lobby...');
    for (const agent of createdAgents) {
      const x = randomInt(2, 13);
      const y = randomInt(2, 13);
      const rotation = randomInt(0, 7);

      await sql`
        INSERT INTO presence (agent_id, room_id, x, y, rotation)
        VALUES (${agent.id}, ${lobbyId}, ${x}, ${y}, ${rotation})
        ON CONFLICT (agent_id, room_id)
        DO UPDATE SET x = ${x}, y = ${y}, rotation = ${rotation}, joined_at = NOW()
      `;

      console.log(`  ✓ ${agent.name} → (${x}, ${y})`);
    }

    console.log('\n[INIT-DEMO] ✅ Demo agents initialized successfully!');
    console.log(`[INIT-DEMO] Total agents in lobby: ${createdAgents.length}`);
    console.log('\n[INIT-DEMO] You can now run: node tools/demo-bot.mjs\n');
  } catch (error) {
    console.error('[INIT-DEMO] ❌ Error:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
