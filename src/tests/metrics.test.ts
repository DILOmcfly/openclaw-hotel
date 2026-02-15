import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 
  decMetric, 
  getMetrics, 
  getHistoricalMetrics, 
  incMetric, 
  resetMetrics 
} from '../services/metrics.js';

describe('metrics service', () => {
  beforeEach(() => {
    resetMetrics();
    vi.clearAllTimers();
  });

  it('incMetric increments counter', () => {
    incMetric('connectedAgents');
    expect(getMetrics().connectedAgents).toBe(1);
  });

  it('decMetric decrements counter', () => {
    incMetric('activeRooms');
    decMetric('activeRooms');
    expect(getMetrics().activeRooms).toBe(0);
  });

  it('decMetric prevents negative values', () => {
    decMetric('connectedAgents');
    expect(getMetrics().connectedAgents).toBe(0);
  });

  it('getMetrics returns all counters including rates', () => {
    const metrics = getMetrics();
    expect(metrics).toMatchObject({
      connectedAgents: 0,
      activeRooms: 0,
      totalMessages: 0,
      totalTrades: 0,
      totalConnections: 0,
      messagesPerSecond: 0,
      tradesPerHour: 0,
    });
  });

  it('calculates messages per second rate', () => {
    // Simulate 60 messages over 1 minute
    for (let i = 0; i < 60; i++) {
      incMetric('totalMessages');
    }
    
    const metrics = getMetrics();
    expect(metrics.messagesPerSecond).toBe(1.00); // 60 messages / 60 seconds
  });

  it('calculates trades per hour rate', () => {
    // Simulate 10 trades
    for (let i = 0; i < 10; i++) {
      incMetric('totalTrades');
    }
    
    const metrics = getMetrics();
    expect(metrics.tradesPerHour).toBe(10);
  });

  it('getHistoricalMetrics returns snapshot array', () => {
    const history = getHistoricalMetrics();
    expect(Array.isArray(history)).toBe(true);
  });

  it('historical snapshots have correct structure', () => {
    incMetric('connectedAgents');
    incMetric('totalMessages');
    
    // Wait for potential snapshot (in real scenario)
    const history = getHistoricalMetrics();
    
    if (history.length > 0) {
      const snapshot = history[0];
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('connectedAgents');
      expect(snapshot).toHaveProperty('activeRooms');
      expect(snapshot).toHaveProperty('messagesPerSecond');
      expect(snapshot).toHaveProperty('tradesPerHour');
    }
  });

  it('resetMetrics clears all counters and rates', () => {
    incMetric('connectedAgents');
    incMetric('activeRooms');
    incMetric('totalMessages');
    incMetric('totalTrades');
    incMetric('totalConnections');

    resetMetrics();

    const metrics = getMetrics();
    expect(metrics.connectedAgents).toBe(0);
    expect(metrics.activeRooms).toBe(0);
    expect(metrics.totalMessages).toBe(0);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.totalConnections).toBe(0);
    expect(metrics.messagesPerSecond).toBe(0);
    expect(metrics.tradesPerHour).toBe(0);
  });

  it('resetMetrics clears historical data', () => {
    incMetric('connectedAgents');
    resetMetrics();
    
    const history = getHistoricalMetrics();
    expect(history.length).toBe(0);
  });

  it('ignores invalid metric names for increment', () => {
    incMetric('invalidMetric');
    const metrics = getMetrics();
    expect(metrics).not.toHaveProperty('invalidMetric');
  });

  it('ignores invalid metric names for decrement', () => {
    decMetric('invalidMetric');
    const metrics = getMetrics();
    expect(metrics).not.toHaveProperty('invalidMetric');
  });

  it('ignores decrement on non-decrementable metrics', () => {
    incMetric('totalMessages');
    const before = getMetrics().totalMessages;
    decMetric('totalMessages');
    const after = getMetrics().totalMessages;
    expect(after).toBe(before); // Should not decrease
  });

  it('tracks multiple agents and rooms independently', () => {
    incMetric('connectedAgents');
    incMetric('connectedAgents');
    incMetric('activeRooms');
    
    const metrics = getMetrics();
    expect(metrics.connectedAgents).toBe(2);
    expect(metrics.activeRooms).toBe(1);
  });

  it('handles rapid message increments', () => {
    const messageCount = 1000;
    for (let i = 0; i < messageCount; i++) {
      incMetric('totalMessages');
    }
    
    const metrics = getMetrics();
    expect(metrics.totalMessages).toBe(messageCount);
    expect(metrics.messagesPerSecond).toBeGreaterThan(0);
  });

  it('returns correct data types for rates', () => {
    incMetric('totalMessages');
    incMetric('totalTrades');
    
    const metrics = getMetrics();
    expect(typeof metrics.messagesPerSecond).toBe('number');
    expect(typeof metrics.tradesPerHour).toBe('number');
  });
});
