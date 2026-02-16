import { migrate } from './migrate.js';
import { sql } from './index.js';

migrate().then(() => sql.end()).catch(e => { console.error(e); process.exit(1); });
