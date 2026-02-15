import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/tests/**/*.test.ts',
      'src/tests/integration/**/*.integration.test.ts',
      'client/src/tests/**/*.test.ts'
    ],
    environment: 'node',
    // Run integration tests serially to avoid DB conflicts (Vitest 4+)
    pool: 'forks',
    poolOptions: {
      forks: {
        isolate: false // Run tests in same process to share DB connection
      }
    },
    testTimeout: 30000 // 30s for integration tests with DB setup
  }
});
