/**
 * Integration Test Setup
 * 
 * Provides test database setup/teardown utilities for end-to-end tests.
 * Uses a dedicated test database (openclaw_hotel_test) to avoid polluting dev data.
 */

import postgres from 'postgres';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

// Test database configuration
const TEST_DB_NAME = 'openclaw_hotel_test';
const TEST_DB_USER = process.env.TEST_DB_USER || 'openclaw';
const TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'openclaw';
const TEST_DB_HOST = process.env.TEST_DB_HOST || 'localhost';
const TEST_DB_PORT = parseInt(process.env.TEST_DB_PORT || '5432', 10);

// Admin connection (for creating/dropping test database)
let adminSql: ReturnType<typeof postgres>;
let testSql: ReturnType<typeof postgres>;

/**
 * Create admin SQL connection (connects to 'postgres' DB)
 */
function getAdminConnection() {
  if (!adminSql) {
    adminSql = postgres({
      host: TEST_DB_HOST,
      port: TEST_DB_PORT,
      database: 'postgres',
      username: TEST_DB_USER,
      password: TEST_DB_PASSWORD,
      max: 1, // Only need 1 connection for setup/teardown
    });
  }
  return adminSql;
}

/**
 * Create test database SQL connection
 */
function getTestConnection() {
  if (!testSql) {
    testSql = postgres({
      host: TEST_DB_HOST,
      port: TEST_DB_PORT,
      database: TEST_DB_NAME,
      username: TEST_DB_USER,
      password: TEST_DB_PASSWORD,
      max: 10, // Pool for parallel test execution
    });
  }
  return testSql;
}

/**
 * Drop and recreate test database (clean slate)
 */
export async function recreateTestDatabase() {
  const sql = getAdminConnection();

  try {
    // Force disconnect all connections
    await sql.unsafe(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${TEST_DB_NAME}'
        AND pid <> pg_backend_pid();
    `);

    // Drop database if exists
    await sql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME};`);

    // Create fresh database
    await sql.unsafe(`CREATE DATABASE ${TEST_DB_NAME} OWNER ${TEST_DB_USER};`);

    console.log(`✅ Test database "${TEST_DB_NAME}" recreated`);
  } catch (error) {
    console.error('Error recreating test database:', error);
    throw error;
  }
}

/**
 * Run all database migrations on test database
 */
export async function runMigrations() {
  const sql = getTestConnection();
  const migrationsDir = join(process.cwd(), 'src', 'db', 'migrations');

  try {
    // Get all migration files sorted by name (001_, 002_, etc.)
    const files = await readdir(migrationsDir);
    const migrationFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`📦 Running ${migrationFiles.length} migrations...`);

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const migrationSql = await readFile(filePath, 'utf-8');

      // Execute the entire migration file as one statement
      // This handles SQL functions with $$ delimiters correctly
      try {
        await sql.unsafe(migrationSql);
        console.log(`  ✅ ${file}`);
      } catch (error) {
        console.error(`  ❌ ${file} failed:`, error);
        throw error;
      }
    }

    console.log(`✅ Migrations complete`);
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

/**
 * Seed deterministic test data (5 agents, 3 rooms, 10 furniture items)
 */
export async function seedTestData() {
  const sql = getTestConnection();

  try {
    // Insert 5 test agents with fixed IDs and deterministic data
    await sql`
      INSERT INTO agents (id, name, email, password_hash, platform, agent_type, verified, created_at)
      VALUES
        ('test-agent-1', 'TestAgent1', 'agent1@test.com', 'hash1', 'test', 'basic', true, '2024-01-01 10:00:00'),
        ('test-agent-2', 'TestAgent2', 'agent2@test.com', 'hash2', 'test', 'basic', true, '2024-01-01 11:00:00'),
        ('test-agent-3', 'TestAgent3', 'agent3@test.com', 'hash3', 'test', 'premium', true, '2024-01-01 12:00:00'),
        ('test-agent-4', 'TestAgent4', 'agent4@test.com', 'hash4', 'test', 'basic', true, '2024-01-01 13:00:00'),
        ('test-agent-5', 'TestAgent5', 'agent5@test.com', 'hash5', 'test', 'basic', true, '2024-01-01 14:00:00')
      ON CONFLICT (id) DO NOTHING;
    `;

    // Insert agent balances (500 coins each for deterministic testing)
    await sql`
      INSERT INTO agent_balances (agent_id, coins, last_daily_claim)
      VALUES
        ('test-agent-1', 500, NULL),
        ('test-agent-2', 500, NULL),
        ('test-agent-3', 1000, NULL),
        ('test-agent-4', 300, NULL),
        ('test-agent-5', 750, NULL)
      ON CONFLICT (agent_id) DO NOTHING;
    `;

    // Insert agent profiles
    await sql`
      INSERT INTO agent_profiles (agent_id, bio, avatar_url, joined_at)
      VALUES
        ('test-agent-1', 'Test bio 1', NULL, '2024-01-01 10:00:00'),
        ('test-agent-2', 'Test bio 2', NULL, '2024-01-01 11:00:00'),
        ('test-agent-3', 'Test bio 3', NULL, '2024-01-01 12:00:00'),
        ('test-agent-4', 'Test bio 4', NULL, '2024-01-01 13:00:00'),
        ('test-agent-5', 'Test bio 5', NULL, '2024-01-01 14:00:00')
      ON CONFLICT (agent_id) DO NOTHING;
    `;

    // Insert agent appearance
    await sql`
      INSERT INTO agent_appearance (agent_id, skin_color, outfit, accessory)
      VALUES
        ('test-agent-1', 0xFF5733, 'casual', 'none'),
        ('test-agent-2', 0x33C4FF, 'formal', 'glasses'),
        ('test-agent-3', 0x28A745, 'sporty', 'cap'),
        ('test-agent-4', 0xFFC107, 'casual', 'watch'),
        ('test-agent-5', 0x6F42C1, 'elegant', 'necklace')
      ON CONFLICT (agent_id) DO NOTHING;
    `;

    // Insert 3 test rooms with deterministic IDs
    await sql`
      INSERT INTO rooms (id, name, owner_id, category, visibility, max_occupants, created_at)
      VALUES
        ('test-room-1', 'Test Lobby', 'test-agent-1', 'public', 'public', 25, '2024-01-01 10:00:00'),
        ('test-room-2', 'Private Office', 'test-agent-2', 'private', 'private', 10, '2024-01-01 11:00:00'),
        ('test-room-3', 'Game Arena', 'test-agent-3', 'public', 'public', 50, '2024-01-01 12:00:00')
      ON CONFLICT (id) DO NOTHING;
    `;

    // Insert 10 furniture items with fixed IDs across multiple agents
    await sql`
      INSERT INTO inventory_items (id, item_type, agent_id, room_id, x, y, rotation, created_at)
      VALUES
        ('item-1', 'furn_chair', 'test-agent-1', NULL, 0, 0, 0, '2024-01-01 10:00:00'),
        ('item-2', 'furn_table', 'test-agent-1', NULL, 0, 0, 0, '2024-01-01 10:01:00'),
        ('item-3', 'furn_lamp', 'test-agent-1', NULL, 0, 0, 0, '2024-01-01 10:02:00'),
        ('item-4', 'furn_bed', 'test-agent-1', NULL, 0, 0, 0, '2024-01-01 10:03:00'),
        ('item-5', 'furn_sofa', 'test-agent-2', NULL, 0, 0, 0, '2024-01-01 11:00:00'),
        ('item-6', 'furn_desk', 'test-agent-2', NULL, 0, 0, 0, '2024-01-01 11:01:00'),
        ('item-7', 'furn_bookshelf', 'test-agent-3', NULL, 0, 0, 0, '2024-01-01 12:00:00'),
        ('item-8', 'furn_plant', 'test-agent-3', NULL, 0, 0, 0, '2024-01-01 12:01:00'),
        ('item-9', 'furn_rug', 'test-agent-4', NULL, 0, 0, 0, '2024-01-01 13:00:00'),
        ('item-10', 'furn_mirror', 'test-agent-5', NULL, 0, 0, 0, '2024-01-01 14:00:00')
      ON CONFLICT (id) DO NOTHING;
    `;

    console.log('✅ Test data seeded (5 agents, 3 rooms, 10 furniture items)');
  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  }
}

/**
 * Clear all test data (truncate tables)
 */
export async function clearTestData() {
  const sql = getTestConnection();

  try {
    // Truncate all tables in reverse dependency order
    await sql.unsafe(`
      TRUNCATE TABLE
        marketplace_listings,
        lucky_wheel_spins,
        trade_items,
        trades,
        event_participants,
        events,
        direct_messages,
        friendships,
        agent_achievements,
        achievements,
        notifications,
        room_ratings,
        room_visits,
        room_favorites,
        room_templates,
        moderation_log,
        moderation_actions,
        word_filters,
        inventory_items,
        rooms,
        agent_balances,
        agent_profiles,
        agent_appearance,
        agents
      RESTART IDENTITY CASCADE;
    `);

    console.log('✅ Test data cleared');
  } catch (error) {
    console.error('Error clearing test data:', error);
    throw error;
  }
}

/**
 * Close all database connections
 */
export async function closeConnections() {
  if (testSql) {
    await testSql.end();
  }
  if (adminSql) {
    await adminSql.end();
  }
}

/**
 * Setup hook for integration test suites (call in beforeAll)
 */
export async function setupIntegrationTests() {
  await recreateTestDatabase();
  await runMigrations();
  await seedTestData();
  return getTestConnection();
}

/**
 * Teardown hook for integration test suites (call in afterAll)
 */
export async function teardownIntegrationTests() {
  await clearTestData();
  await closeConnections();
}

/**
 * Get test SQL connection (for use in tests)
 */
export { getTestConnection as getTestSql };

/**
 * Check if database is available (for skipping integration tests)
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const sql = postgres({
      host: TEST_DB_HOST,
      port: TEST_DB_PORT,
      database: 'postgres',
      username: TEST_DB_USER,
      password: TEST_DB_PASSWORD,
      max: 1,
      connect_timeout: 2, // 2 second timeout
    });

    // Try a simple query
    await sql`SELECT 1`;
    await sql.end();
    return true;
  } catch (error) {
    return false;
  }
}
