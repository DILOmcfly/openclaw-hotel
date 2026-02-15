import { describe, it, expect, vi } from 'vitest';
import { recordVisit, endVisit, getHourlyStats, getDailyStats, getPeakHour, getTotalVisitors } from '../services/roomAnalytics.js';

const createMockSql = (returnValue: any) => {
  const mockFn = vi.fn(() => Promise.resolve(returnValue)) as any;
  mockFn.begin = vi.fn();
  return mockFn;
};

describe('roomAnalytics service', () => {
  it('recordVisit creates new visit session', async () => {
    const mockSql = createMockSql([]);
    const sessionId = await recordVisit('room-1', 'agent-1', mockSql);

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(mockSql).toHaveBeenCalledOnce();
  });

  it('endVisit updates session with left_at and duration', async () => {
    const mockResult = [{
      id: 'session-1',
      duration_seconds: 300,
      hour: 14,
      date: '2026-02-15',
    }];
    const mockSql = createMockSql(mockResult);
    mockSql.mockReturnValueOnce(Promise.resolve(mockResult));
    mockSql.mockReturnValueOnce(Promise.resolve([{ unique_visitors: 1, visitor_count: 1, avg_stay_seconds: 300 }]));
    mockSql.mockReturnValueOnce(Promise.resolve([]));

    await endVisit('room-1', 'agent-1', mockSql);

    expect(mockSql).toHaveBeenCalled();
  });

  it('endVisit handles no active session gracefully', async () => {
    const mockSql = createMockSql([]);

    await endVisit('room-1', 'agent-1', mockSql);

    expect(mockSql).toHaveBeenCalledOnce();
  });

  it('getHourlyStats returns 24-hour array', async () => {
    const mockData = [
      { hour: 10, visitor_count: 5, unique_visitors: 3, avg_stay_seconds: 120 },
      { hour: 14, visitor_count: 8, unique_visitors: 6, avg_stay_seconds: 180 },
    ];
    const mockSql = createMockSql(mockData);

    const stats = await getHourlyStats('room-1', '2026-02-15', mockSql);

    expect(stats.length).toBe(24);
    expect(stats[10].visitor_count).toBe(5);
    expect(stats[14].visitor_count).toBe(8);
    expect(stats[0].visitor_count).toBe(0);
  });

  it('getHourlyStats fills empty hours with zeros', async () => {
    const mockSql = createMockSql([]);

    const stats = await getHourlyStats('room-1', '2026-02-15', mockSql);

    expect(stats.length).toBe(24);
    stats.forEach((s) => {
      expect(s.visitor_count).toBe(0);
      expect(s.unique_visitors).toBe(0);
      expect(s.avg_stay_seconds).toBe(0);
    });
  });

  it('getDailyStats returns aggregated daily data', async () => {
    const mockData = [
      { date: '2026-02-15', total_visitors: 50, total_unique: 30, avg_stay: 200 },
      { date: '2026-02-14', total_visitors: 40, total_unique: 25, avg_stay: 180 },
    ];
    const mockSql = createMockSql(mockData);

    const stats = await getDailyStats('room-1', 7, mockSql);

    expect(stats.length).toBe(2);
    expect(stats[0].date).toBe('2026-02-15');
    expect(stats[0].total_visitors).toBe(50);
    expect(stats[1].total_visitors).toBe(40);
  });

  it('getDailyStats handles empty results', async () => {
    const mockSql = createMockSql([]);

    const stats = await getDailyStats('room-1', 7, mockSql);

    expect(stats).toEqual([]);
  });

  it('getPeakHour returns hour with most visitors', async () => {
    const mockData = [{ hour: 14, total: 250 }];
    const mockSql = createMockSql(mockData);

    const peak = await getPeakHour('room-1', mockSql);

    expect(peak.hour).toBe(14);
    expect(peak.total).toBe(250);
  });

  it('getPeakHour returns default when no data', async () => {
    const mockSql = createMockSql([]);

    const peak = await getPeakHour('room-1', mockSql);

    expect(peak.hour).toBe(0);
    expect(peak.total).toBe(0);
  });

  it('getTotalVisitors returns unique visitor count', async () => {
    const mockData = [{ total: 150 }];
    const mockSql = createMockSql(mockData);

    const result = await getTotalVisitors('room-1', mockSql);

    expect(result.total).toBe(150);
  });

  it('getTotalVisitors handles no visitors', async () => {
    const mockSql = createMockSql([]);

    const result = await getTotalVisitors('room-1', mockSql);

    expect(result.total).toBe(0);
  });

  it('hourly stats preserve hour order', async () => {
    const mockData = [
      { hour: 23, visitor_count: 2, unique_visitors: 1, avg_stay_seconds: 90 },
      { hour: 0, visitor_count: 1, unique_visitors: 1, avg_stay_seconds: 60 },
    ];
    const mockSql = createMockSql(mockData);

    const stats = await getHourlyStats('room-1', '2026-02-15', mockSql);

    expect(stats[0].hour).toBe(0);
    expect(stats[23].hour).toBe(23);
    expect(stats[0].visitor_count).toBe(1);
    expect(stats[23].visitor_count).toBe(2);
  });

  it('daily stats query respects days parameter', async () => {
    const mockSql = createMockSql([
      { date: '2026-02-15', total_visitors: 10, total_unique: 8, avg_stay: 150 },
    ]);

    await getDailyStats('room-1', 30, mockSql);

    expect(mockSql).toHaveBeenCalled();
  });
});
