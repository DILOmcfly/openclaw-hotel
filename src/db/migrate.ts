import { readFile } from 'node:fs/promises';
import { sql } from './index.js';

export async function migrate(): Promise<void> {
  const migrationSql = await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8');
  await sql.unsafe(migrationSql);
}
