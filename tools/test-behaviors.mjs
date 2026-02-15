#!/usr/bin/env node
/**
 * Test Agent Behaviors
 * 
 * Runs 5 ticks and displays behavior patterns
 */

import postgres from 'postgres';

const sql = postgres({
  host: 'localhost',
  port: 5432,
  database: 'openclaw_hotel',
  username: 'openclaw',
  password: 'openclaw',
});

const API_URL = 'http://localhost:3000/api/internal/simulate';

async function getAgentStates() {
  const agents = await sql`
    SELECT 
      a.display_name,
      a.metadata->>'behavior' as behavior,
      p.x,
      p.y,
      p.rotation,
      p.room_id
    FROM agents a
    JOIN presence p ON a.id = p.agent_id
    ORDER BY a.display_name
  `;
  return agents;
}

async function tick() {
  const response = await fetch(API_URL, { method: 'POST' });
  const data = await response.json();
  return data;
}

async function main() {
  console.log('Testing Agent Behaviors...\n');

  // Initial state
  console.log('=== Initial State ===');
  let states = await getAgentStates();
  for (const agent of states) {
    console.log(
      `${agent.display_name.padEnd(20)} [${agent.behavior}] at (${agent.x}, ${agent.y}) rotation=${agent.rotation}`
    );
  }

  // Run 5 ticks
  for (let i = 1; i <= 5; i++) {
    console.log(`\n=== Tick ${i} ===`);
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for DB update

    states = await getAgentStates();
    for (const agent of states) {
      console.log(
        `${agent.display_name.padEnd(20)} [${agent.behavior.padEnd(7)}] at (${agent.x}, ${agent.y}) rotation=${agent.rotation}`
      );
    }
  }

  console.log('\n✅ Behavior test complete');
  await sql.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
