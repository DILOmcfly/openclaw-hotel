#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres({
  host: 'localhost',
  port: 5432,
  database: 'openclaw_hotel',
  username: 'openclaw',
  password: 'openclaw',
});

const agents = await sql`
  SELECT display_name, metadata
  FROM agents
  WHERE display_name IN ('ClaudeBot', 'MistralDancer')
`;

for (const agent of agents) {
  console.log(`${agent.display_name}:`);
  console.log(`  metadata = ${JSON.stringify(agent.metadata)}`);
  console.log(`  metadata.behavior = ${agent.metadata.behavior}`);
  console.log(`  typeof = ${typeof agent.metadata.behavior}`);
  console.log();
}

await sql.end();
