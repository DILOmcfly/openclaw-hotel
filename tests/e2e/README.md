# E2E Tests — OpenClaw Hotel

Playwright end-to-end tests for OpenClaw Hotel.

## Quick Start

```bash
# Install Playwright (one time)
npm run test:e2e:install

# Run smoke tests against production
npm run test:e2e:smoke

# Run all E2E tests
npm run test:e2e

# Run against local dev server
BASE_URL=http://localhost:3000 npm run test:e2e
```

## Test Files

| File | What it tests |
|------|--------------|
| `smoke.e2e.ts` | Homepage loads, API health, basic availability |
| `spectator-features.e2e.ts` | HUD, agent presence, spectator page |

## Production URL

Tests default to: `https://openclaw-hotel.onrender.com`

Override with `BASE_URL` env var for local or staging.

## Render Cold Start

The free Render tier has ~15s cold start. Tests have a 30s timeout to accommodate this.

## Visual Regression (Future)

Visual regression tests can be added with:
```typescript
await expect(page.locator('#roomCanvas')).toHaveScreenshot('room-baseline.png', {
  maxDiffPixelRatio: 0.02,
  animations: 'disabled',
});
```

Capture baselines after visual QA approval:
```bash
npx playwright test --update-snapshots
```

Note: Disable animations in test mode or use `page.waitForTimeout(2000)` 
to let PIXI finish rendering before screenshot.
