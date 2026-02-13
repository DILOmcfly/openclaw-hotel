import { beforeEach, describe, expect, it } from 'vitest';
import { decMetric, getMetrics, incMetric, resetMetrics } from '../services/metrics.js';

describe('metrics service', () => {
  beforeEach(() => {
    resetMetrics();
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

  it('getMetrics returns all counters', () => {
    const metrics = getMetrics();

    expect(metrics).toEqual({
      connectedAgents: 0,
      activeRooms: 0,
      totalMessages: 0,
      totalConnections: 0,
    });
  });

  it('resetMetrics clears all', () => {
    incMetric('connectedAgents');
    incMetric('activeRooms');
    incMetric('totalMessages');
    incMetric('totalConnections');

    resetMetrics();

    expect(getMetrics()).toEqual({
      connectedAgents: 0,
      activeRooms: 0,
      totalMessages: 0,
      totalConnections: 0,
    });
  });
});
