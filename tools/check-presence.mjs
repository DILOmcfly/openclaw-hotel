#!/usr/bin/env node
import postgres from 'postgres';

const sql = postgres({
  host: 'localhost',
  port: 5432,
  database: 'openclaw_hotel',
  username: 'openclaw',
  password: 'openclaw',
});

const presence = await sql`
  SELECT 
    a.display_name,
    p.room_id,
    r.name as room_name,
    p.x,
    p.y,
    a.metadata->>'behavior' as behavior
  FROM presence p
  JOIN agents a ON p.agent_id = a.id
  JOIN rooms r ON p.room_id = r.id
  ORDER BY a.display_name, r.name
`;

console.log('Agent presence across rooms:\n');
for (const row of presence) {
  console.log(
    `${row.display_name.padEnd(20)} in ${row.room_name.padEnd(25)} at (${row.x}, ${row.y}) [${row.behavior}]`
  );
}

await sql.end();
