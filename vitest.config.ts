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
    fileParallelism: false, // Run test files sequentially to avoid database conflicts
    testTimeout: 30000 // 30s for integration tests with DB setup
  }
});
