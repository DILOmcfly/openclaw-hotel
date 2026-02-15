import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as v8 from 'node:v8';

/**
 * Resource Monitor Unit Tests
 * Validates resource tracking logic without running the full monitoring loop
 */

describe('Resource Monitor - Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should correctly calculate heap percentage', () => {
    const calculateHeapPct = (heapUsed: number, heapLimit: number): number => {
      return (heapUsed / heapLimit) * 100;
    };

    expect(calculateHeapPct(800_000_000, 1_000_000_000)).toBe(80);
    expect(calculateHeapPct(1_500_000_000, 1_500_000_000)).toBe(100);
    expect(calculateHeapPct(500_000_000, 2_000_000_000)).toBe(25);
    expect(calculateHeapPct(0, 1_000_000_000)).toBe(0);
  });

  it('should trigger warning when heap exceeds 80%', () => {
    const checkHeapWarning = (heapPct: number): boolean => {
      return heapPct > 80;
    };

    expect(checkHeapWarning(85)).toBe(true);
    expect(checkHeapWarning(100)).toBe(true);
    expect(checkHeapWarning(80.1)).toBe(true);
    expect(checkHeapWarning(80)).toBe(false);
    expect(checkHeapWarning(79.9)).toBe(false);
    expect(checkHeapWarning(50)).toBe(false);
  });

  it('should calculate average CPU from samples', () => {
    const calculateAvgCPU = (samples: number[][]): number => {
      const allUsages = samples.flat();
      if (allUsages.length === 0) return 0;
      return allUsages.reduce((sum, val) => sum + val, 0) / allUsages.length;
    };

    expect(calculateAvgCPU([[50, 60], [70, 80]])).toBe(65);
    expect(calculateAvgCPU([[100, 100]])).toBe(100);
    expect(calculateAvgCPU([[0, 0, 0, 0]])).toBe(0);
    expect(calculateAvgCPU([])).toBe(0);
    expect(calculateAvgCPU([[25, 50, 75]])).toBeCloseTo(50, 1);
  });

  it('should trigger warning for sustained high CPU', () => {
    const checkCPUWarning = (avgCPU: number, sampleCount: number): boolean => {
      return sampleCount >= 2 && avgCPU > 90;
    };

    expect(checkCPUWarning(95, 2)).toBe(true);
    expect(checkCPUWarning(91, 3)).toBe(true);
    expect(checkCPUWarning(95, 1)).toBe(false); // Not enough samples
    expect(checkCPUWarning(90, 2)).toBe(false); // Not exceeding 90%
    expect(checkCPUWarning(89, 2)).toBe(false);
    expect(checkCPUWarning(50, 2)).toBe(false);
  });

  it('should convert bytes to MB correctly', () => {
    const bytesToMB = (bytes: number): number => {
      return Math.round(bytes / 1024 / 1024);
    };

    expect(bytesToMB(1_048_576)).toBe(1); // 1 MB
    expect(bytesToMB(10_485_760)).toBe(10); // 10 MB
    expect(bytesToMB(1_073_741_824)).toBe(1024); // 1 GB
    expect(bytesToMB(524_288)).toBe(1); // 0.5 MB rounds to 1
    expect(bytesToMB(0)).toBe(0);
  });

  it('should format heap percentage with 2 decimals', () => {
    const formatPct = (value: number): number => {
      return parseFloat(value.toFixed(2));
    };

    expect(formatPct(85.123456)).toBe(85.12);
    expect(formatPct(90.999)).toBe(91.0);
    expect(formatPct(100)).toBe(100);
    expect(formatPct(0.123)).toBe(0.12);
  });

  it('should get max heap size from V8', () => {
    const heapStats = v8.getHeapStatistics();
    expect(heapStats.heap_size_limit).toBeGreaterThan(0);
    expect(typeof heapStats.heap_size_limit).toBe('number');
  });

  it('should validate resource metrics structure', () => {
    const validateMetrics = (metrics: any): boolean => {
      return (
        typeof metrics.memoryMB === 'number' &&
        typeof metrics.heapUsedPct === 'number' &&
        typeof metrics.cpuPct === 'number' &&
        Array.isArray(metrics.warnings) &&
        metrics.memoryMB >= 0 &&
        metrics.heapUsedPct >= 0 &&
        metrics.cpuPct >= 0
      );
    };

    const validMetrics = {
      memoryMB: 512,
      heapUsedPct: 75.5,
      cpuPct: 45.2,
      warnings: [],
    };

    const metricsWithWarnings = {
      memoryMB: 1200,
      heapUsedPct: 85.5,
      cpuPct: 92.1,
      warnings: ['High heap usage', 'High CPU usage'],
    };

    expect(validateMetrics(validMetrics)).toBe(true);
    expect(validateMetrics(metricsWithWarnings)).toBe(true);
    expect(validateMetrics({ memoryMB: -1, heapUsedPct: 0, cpuPct: 0, warnings: [] })).toBe(false);
    expect(validateMetrics({ memoryMB: 100 })).toBe(false); // Missing fields
  });

  it('should maintain CPU sample window correctly', () => {
    const maintainSampleWindow = <T>(samples: T[], maxSize: number, newSample: T): T[] => {
      const updated = [...samples, newSample];
      if (updated.length > maxSize) {
        updated.shift();
      }
      return updated;
    };

    let samples: number[] = [];
    samples = maintainSampleWindow(samples, 2, 10);
    expect(samples).toEqual([10]);
    
    samples = maintainSampleWindow(samples, 2, 20);
    expect(samples).toEqual([10, 20]);
    
    samples = maintainSampleWindow(samples, 2, 30);
    expect(samples).toEqual([20, 30]); // 10 dropped
    
    samples = maintainSampleWindow(samples, 2, 40);
    expect(samples).toEqual([30, 40]); // 20 dropped
  });
});
