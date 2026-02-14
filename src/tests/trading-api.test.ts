import { describe, it } from 'vitest';

describe.skip('Trading API Routes (integration — needs DB)', () => {
  it('POST /api/trades creates a trade', () => {});
  it('PUT /api/trades/:id/items updates trade items', () => {});
  it('PUT /api/trades/:id/accept completes trade', () => {});
  it('PUT /api/trades/:id/reject rejects trade', () => {});
  it('PUT /api/trades/:id/cancel cancels trade', () => {});
  it('GET /api/trades/history returns trade history', () => {});
});
