import { readFile } from 'node:fs/promises';
import { sql } from './index.js';

export async function migrate(): Promise<void> {
  const migration001 = await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration001);
  
  const migration002 = await readFile(new URL('./migrations/002_inventory.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration002);
  
  const migration003 = await readFile(new URL('./migrations/003_trading.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration003);
  
  const migration004 = await readFile(new URL('./migrations/004_friends.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration004);
  
  const migration005 = await readFile(new URL('./migrations/005_profiles.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration005);
  
  const migration006 = await readFile(new URL('./migrations/006_achievements.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration006);
  
  const migration008 = await readFile(new URL('./migrations/008_direct_messages.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration008);
  
  const migration009 = await readFile(new URL('./migrations/009_notifications.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration009);
  
  const migration010 = await readFile(new URL('./migrations/010_economy.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration010);
  
  const migration011 = await readFile(new URL('./migrations/011_admin_roles.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration011);
  
  const migration012 = await readFile(new URL('./migrations/012_navigator_enhancements.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration012);
  
  const migration013 = await readFile(new URL('./migrations/013_room_privacy.sql', import.meta.url), 'utf8');
  await sql.unsafe(migration013);
}
