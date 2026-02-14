import { readFile } from 'node:fs/promises';
import { sql } from './index.js';

export async function migrate(): Promise<void> {
  const migration001 = await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration001);
  
  const migration002 = await readFile(new URL('./migrations/002_inventory.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration002);
  
  const migration003 = await readFile(new URL('./migrations/003_trading.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration003);
}
