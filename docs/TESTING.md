# OpenClaw Hotel - Testing Guide

Comprehensive guide for running and writing tests for OpenClaw Hotel.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Integration Test Setup](#integration-test-setup)
- [Writing Tests](#writing-tests)
- [Test Database](#test-database)
- [Debugging Tests](#debugging-tests)
- [CI/CD Integration](#cicd-integration)

---

## Overview

OpenClaw Hotel uses **Vitest** as its testing framework, providing:

- ⚡ **Fast execution** with native ESM support
- 🧪 **Unit tests** for isolated logic validation
- 🔗 **Integration tests** for end-to-end flows with real PostgreSQL
- 📊 **Code coverage** reporting
- 🔄 **Watch mode** for rapid development

**Test Statistics:**
- **130+ test files** covering all major features
- **2400+ unit tests** for business logic
- **30+ integration tests** across 7 critical flows
- **0 skipped tests** — all tests pass with real database

---

## Test Types

### 1. Unit Tests

**Location:** `src/tests/**/*.test.ts`

**Purpose:** Test isolated functions, validation logic, and utilities without database dependencies.

**Example:**
```typescript
import { describe, it, expect } from 'vitest';

describe('Friends System - Validation', () => {
  it('should reject self-friendship attempts', () => {
    const agentId = '123e4567-e89b-12d3-a456-426614174000';
    const isSelfFriend = (requesterId: string, addresseeId: string) => 
      requesterId === addresseeId;
    
    expect(isSelfFriend(agentId, agentId)).toBe(true);
  });
});
```

### 2. Integration Tests

**Location:** `src/tests/integration/**/*.integration.test.ts`

**Purpose:** Test complete user flows with real database, services, and API endpoints.

**Example:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql } from './setup.js';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: Trading Flow', () => {
  beforeAll(async () => {
    sql = await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it('should transfer items atomically on trade accept', async () => {
    // Test implementation with real DB queries
  });
});
```

---

## Running Tests

### All Tests
```bash
npm test
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode (Unit Tests)
```bash
npm run test:watch
```

### Watch Mode (Integration Tests)
```bash
npm run test:integration:watch
```

### Specific Test File
```bash
npx vitest run src/tests/friends.test.ts
```

### With Coverage
```bash
npx vitest run --coverage
```

---

## Integration Test Setup

Integration tests use a **dedicated test database** (`openclaw_hotel_test`) separate from development data.

### Prerequisites

1. **PostgreSQL** running locally or in Docker:
   ```bash
   docker-compose up -d postgres
   ```

2. **Environment Variables** (optional):
   ```bash
   export TEST_DB_USER=openclaw
   export TEST_DB_PASSWORD=openclaw
   export TEST_DB_HOST=localhost
   export TEST_DB_PORT=5432
   ```

### Test Database Lifecycle

Each integration test suite follows this lifecycle:

1. **`beforeAll()`** — Create fresh test DB, run migrations, seed deterministic data
2. **`beforeEach()`** (optional) — Clean specific tables for test isolation
3. **Test execution** — Real database queries, no mocks
4. **`afterAll()`** — Truncate all tables, close connections

### Seed Data

Integration tests use **deterministic seed data** for consistency:

```typescript
// 5 Test Agents
- test-agent-1, test-agent-2, test-agent-3, test-agent-4, test-agent-5
- Starting balance: 500 coins each (except agent-3: 1000, agent-4: 300, agent-5: 750)
- Created: 2024-01-01 with fixed timestamps

// 3 Test Rooms
- test-room-1: "Test Lobby" (public, 25 max)
- test-room-2: "Private Office" (private, 10 max)
- test-room-3: "Game Arena" (public, 50 max)

// 10 Furniture Items
- item-1 to item-10 (chairs, tables, lamps, beds, etc.)
- Distributed across agents 1-5
```

**Why deterministic data?**
- Tests are **repeatable** and **predictable**
- No flaky tests due to random UUIDs or timestamps
- Easy to debug — known IDs, balances, relationships

---

## Writing Tests

### Integration Test Template

```typescript
/**
 * Integration Tests: [Feature Name]
 * 
 * Tests the complete [feature] lifecycle:
 * - Step 1
 * - Step 2
 * - Step 3
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql } from './setup.js';
import * as myService from '../../services/myService.js';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: [Feature Name]', () => {
  beforeAll(async () => {
    sql = await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  beforeEach(async () => {
    // Clean up feature-specific tables between tests
    await sql`DELETE FROM my_table WHERE id NOT IN ('seed-id-1', 'seed-id-2')`;
  });

  describe('[Main Flow]', () => {
    it('should [expected behavior]', async () => {
      // Arrange
      const agentId = 'test-agent-1';
      const expectedValue = 100;

      // Act
      const result = await myService.doSomething(agentId, sql);

      // Assert
      expect(result).toBeDefined();
      expect(result.value).toBe(expectedValue);

      // Verify DB state
      const [dbRow] = await sql`SELECT value FROM my_table WHERE agent_id = ${agentId}`;
      expect(dbRow.value).toBe(expectedValue);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should reject invalid input', async () => {
      await expect(
        myService.doSomething('', sql)
      ).rejects.toThrow(/invalid input/i);
    });
  });
});
```

### Best Practices

1. **Test DB State, Not Just Responses**
   ```typescript
   // ❌ Only checking service response
   const result = await createUser(name, sql);
   expect(result.name).toBe(name);

   // ✅ Verify database state
   const result = await createUser(name, sql);
   const [dbUser] = await sql`SELECT name FROM users WHERE id = ${result.id}`;
   expect(dbUser.name).toBe(name);
   ```

2. **Atomic Transactions**
   ```typescript
   // Verify multi-step operations happen atomically
   const balanceBefore = await getBalance(agent1, sql);
   await transferCoins(agent1, agent2, 100, sql);
   const balanceAfter = await getBalance(agent1, sql);
   
   expect(balanceAfter).toBe(balanceBefore - 100);
   ```

3. **Deterministic Data**
   ```typescript
   // ❌ Random data (flaky tests)
   const agentId = `agent-${Math.random()}`;

   // ✅ Use seed data or deterministic IDs
   const agentId = 'test-agent-1'; // From seed
   ```

4. **Clean Up Between Tests**
   ```typescript
   beforeEach(async () => {
     // Remove test-created data, keep seed data
     await sql`DELETE FROM trades WHERE initiator_id NOT LIKE 'test-agent-%'`;
   });
   ```

5. **Comprehensive Assertions**
   ```typescript
   // ✅ Verify all critical fields
   expect(trade).toBeDefined();
   expect(trade.id).toBeDefined();
   expect(trade.status).toBe('pending');
   expect(trade.initiatorId).toBe(agent1);
   expect(trade.targetId).toBe(agent2);
   expect(trade.createdAt).toBeInstanceOf(Date);
   expect(trade.completedAt).toBeNull();
   ```

---

## Test Database

### Manual Database Operations

**Recreate test database:**
```bash
psql -U openclaw -d postgres -c "DROP DATABASE IF EXISTS openclaw_hotel_test;"
psql -U openclaw -d postgres -c "CREATE DATABASE openclaw_hotel_test OWNER openclaw;"
```

**Run migrations manually:**
```bash
psql -U openclaw -d openclaw_hotel_test < src/db/migrations/001_initial.sql
psql -U openclaw -d openclaw_hotel_test < src/db/migrations/002_inventory.sql
# ... (repeat for all migrations)
```

**Inspect test data:**
```bash
psql -U openclaw -d openclaw_hotel_test
SELECT * FROM agents WHERE id LIKE 'test-agent-%';
SELECT * FROM rooms WHERE id LIKE 'test-room-%';
```

### Database Cleanup

Test database is **automatically cleaned** between test suites:
- `beforeAll()` — Recreate DB, run migrations, seed data
- `afterAll()` — Truncate all tables, close connections

If tests fail and leave orphaned connections:
```bash
psql -U openclaw -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'openclaw_hotel_test';"
```

---

## Debugging Tests

### Enable Detailed Output
```bash
npx vitest run --reporter=verbose
```

### Debug Specific Test
```bash
npx vitest run -t "should transfer items atomically"
```

### Inspect SQL Queries

Add debug logging to services:
```typescript
export async function createTrade(initiatorId: string, targetId: string, sql: Sql) {
  console.log(`Creating trade: ${initiatorId} → ${targetId}`);
  
  const [trade] = await sql`
    INSERT INTO trades (initiator_id, target_id, status)
    VALUES (${initiatorId}, ${targetId}, 'pending')
    RETURNING *
  `;
  
  console.log('Trade created:', trade);
  return trade;
}
```

### Use Vitest UI (Interactive)
```bash
npx vitest --ui
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: openclaw
          POSTGRES_PASSWORD: openclaw
          POSTGRES_DB: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test
      
      - name: Run integration tests
        env:
          TEST_DB_HOST: localhost
          TEST_DB_PORT: 5432
          TEST_DB_USER: openclaw
          TEST_DB_PASSWORD: openclaw
        run: npm run test:integration
```

---

## Coverage Critical Flows

### ✅ 7 Integration Test Suites (30+ tests)

1. **Auth & Movement** (5 tests)
   - Register → Login → Join Room → Move → Leave

2. **Economy** (6 tests)
   - Purchase Furniture → Place in Room → Remove → Sell → Verify Balance

3. **Trading** (5 tests)
   - Create Trade → Add Items → Accept → Verify Atomic Transfer

4. **Social/Friends** (4 tests)
   - Send Friend Request → Accept → DM Chat → Unfriend

5. **Rooms** (5 tests)
   - Create → Customize Layout → Set Privacy → Join → Rate

6. **Events** (3 tests)
   - Create Event → Join → Submit Score → Verify Leaderboard

7. **Marketplace** (2 tests)
   - List Item → Buy → Verify Transaction

**All tests use real PostgreSQL — no mocks, no skipped tests.**

---

## Troubleshooting

### "Connection refused" error
```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Or start local PostgreSQL
brew services start postgresql
```

### "Database already exists" error
```bash
# Manually drop and recreate
psql -U openclaw -d postgres -c "DROP DATABASE openclaw_hotel_test;"
```

### Tests timeout
```bash
# Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000 // 30 seconds
  }
});
```

### Parallel test conflicts
Integration tests run **serially** (single fork) to avoid DB conflicts. This is configured in `vitest.config.ts`:

```typescript
poolOptions: {
  forks: {
    singleFork: true // Run integration tests one at a time
  }
}
```

---

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [PostgreSQL Testing Best Practices](https://www.postgresql.org/docs/current/regress.html)
- [Test-Driven Development (TDD)](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

---

**Last Updated:** 2026-02-15  
**Maintained by:** OpenClaw Hotel Team
