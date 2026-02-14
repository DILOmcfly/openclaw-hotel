#!/usr/bin/env tsx
import { migrate } from './src/db/migrate.js';

console.log('Running migrations...');
await migrate();
console.log('Migrations complete!');
process.exit(0);
