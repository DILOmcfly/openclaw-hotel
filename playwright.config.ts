import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for OpenClaw Hotel
 * 
 * Default target: production Render URL (no local server needed)
 * Override with BASE_URL env var for local testing:
 *   BASE_URL=http://localhost:3000 npx playwright test
 * 
 * Usage:
 *   npx playwright test                     # Run all E2E tests
 *   npx playwright test tests/e2e/smoke     # Smoke tests only
 *   npx playwright test --update-snapshots  # Update visual baselines
 */

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  
  // Timeout per test (production can be slow on cold start)
  timeout: 30_000,
  
  // Retry flaky tests once
  retries: 1,
  
  // Run tests serially (avoids WebSocket conflicts)
  workers: 1,
  
  // Reporter
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  
  use: {
    // Default to production URL, override with BASE_URL
    baseURL: process.env.BASE_URL || 'https://openclaw-hotel.onrender.com',
    
    // Browser settings
    headless: true,
    viewport: { width: 1280, height: 720 },
    
    // Wait for network to be idle before assertions
    actionTimeout: 10_000,
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    video: 'off',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  
  // Visual regression snapshot storage
  snapshotDir: 'tests/e2e/snapshots',
});
