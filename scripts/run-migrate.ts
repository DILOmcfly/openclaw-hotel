import { migrate } from '../src/db/migrate.js';
import { sql } from '../src/db/index.js';

await migrate();
console.log('✅ Migrations completed');
await sql.end();
process.exit(0);
