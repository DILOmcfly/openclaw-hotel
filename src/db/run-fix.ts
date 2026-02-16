import { sql } from './index.js';

async function fix() {
  // Create agent_balances without FK constraint
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS agent_balances (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(255) NOT NULL UNIQUE,
      coins INTEGER NOT NULL DEFAULT 500,
      last_daily_claim TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ agent_balances created');
  await sql.end();
}
fix().catch(e => { console.error(e); process.exit(1); });
