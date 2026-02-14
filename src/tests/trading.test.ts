import { describe, it } from 'vitest';

describe.skip('Trading Service (integration — needs DB)', () => {
  it('createTrade creates a pending trade', () => {});
  it('acceptTrade transfers items atomically', () => {});
  it('rejectTrade updates status', () => {});
  it('cancelTrade only works for initiator', () => {});
  it('getTradeHistory returns agent trades', () => {});
});
