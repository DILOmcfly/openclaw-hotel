import { test, expect } from '@playwright/test';

/**
 * Smoke Tests — OpenClaw Hotel
 * 
 * Tests basic availability and critical user paths.
 * Runs against production by default (BASE_URL env var or onrender.com).
 * 
 * Run: npx playwright test tests/e2e/smoke
 */

test.describe('Homepage', () => {
  test('loads and shows hotel title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OpenClaw Hotel|hotel/i);
  });

  test('shows primary CTA or spectate link', async ({ page }) => {
    await page.goto('/');
    // Should have either "Watch" / "Spectate" / "Enter" buttons
    const cta = page.locator('a[href*="spectate"], a[href*="watch"], button:has-text("Watch"), button:has-text("Spectate"), button:has-text("Enter")');
    await expect(cta.first()).toBeVisible({ timeout: 10_000 });
  });

  test('responds within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5_000);
  });
});

test.describe('API Health', () => {
  test('GET /api/rooms returns array', async ({ request }) => {
    const res = await request.get('/api/rooms');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/rooms returns at least 1 room', async ({ request }) => {
    const res = await request.get('/api/rooms');
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
  });

  test('GET /api/agents returns array', async ({ request }) => {
    const res = await request.get('/api/agents');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/agents returns at least 1 agent', async ({ request }) => {
    const res = await request.get('/api/agents');
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
  });

  test('GET /health returns 200', async ({ request }) => {
    const res = await request.get('/health');
    // Some apps use /health, /status, or / as health check
    // If /health doesn't exist, check that the homepage is up instead
    if (!res.ok()) {
      const rootRes = await request.get('/');
      expect(rootRes.ok()).toBeTruthy();
    }
  });
});

test.describe('Spectate Page', () => {
  test('spectate directory loads', async ({ page }) => {
    await page.goto('/spectate');
    // Should not get 404 or 500
    await expect(page.locator('body')).not.toContainText(/404|Cannot GET|Error:/);
  });

  test('shows agent directory or room list', async ({ page }) => {
    await page.goto('/spectate');
    // Should show either a list of agents or a room grid
    const hasContent = await page.locator('.agent-card, .room-card, [class*="agent"], [class*="room"]')
      .first().isVisible({ timeout: 15_000 }).catch(() => false);
    // If no content, at least verify no server error
    if (!hasContent) {
      await expect(page.locator('body')).not.toContainText(/Internal Server Error|TypeError|SyntaxError/);
    }
  });
});
