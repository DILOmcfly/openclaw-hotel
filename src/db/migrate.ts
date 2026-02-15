import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { sql } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function migrate(): Promise<void> {
  // Create migrations tracking table
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get migrations directory path
  const migrationsDir = join(__dirname, 'migrations');
  
  // Read all .sql files
  const files = await readdir(migrationsDir);
  const sqlFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      // Extract numeric prefix for sorting
      const numA = parseInt(a.split('_')[0], 10);
      const numB = parseInt(b.split('_')[0], 10);
      return numA - numB;
    });

  console.log(`Found ${sqlFiles.length} migration files`);

  // Get already applied migrations
  const applied = await sql<{ name: string }[]>`
    SELECT name FROM migrations_applied
  `;
  const appliedSet = new Set(applied.map(r => r.name));

  // Run each migration
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of sqlFiles) {
    if (appliedSet.has(file)) {
      console.log(`⏭️  Skipping ${file} (already applied)`);
      skipCount++;
      continue;
    }

    try {
      console.log(`🔄 Running ${file}...`);
      const migrationPath = join(migrationsDir, file);
      const migrationSQL = await readFile(migrationPath, 'utf8');
      
      // Run migration
      await sql.unsafe(migrationSQL);
      
      // Mark as applied
      await sql`
        INSERT INTO migrations_applied (name) 
        VALUES (${file})
      `;
      
      console.log(`✅ Applied ${file}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error applying ${file}:`, error instanceof Error ? error.message : error);
      errorCount++;
      // Continue with next migration despite error
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Applied: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📁 Total: ${sqlFiles.length}`);
}
