import { Router } from 'express';
import * as os from 'node:os';
import * as v8 from 'node:v8';
import { logger } from '../utils/logger.js';

const router = Router();

interface ResourceMetrics {
  memoryMB: number;
  heapUsedPct: number;
  cpuPct: number;
  warnings: string[];
}

interface CPUSample {
  timestamp: number;
  usage: number[];
}

// State
let lastMetrics: ResourceMetrics = {
  memoryMB: 0,
  heapUsedPct: 0,
  cpuPct: 0,
  warnings: [],
};

let cpuSamples: CPUSample[] = [];
const MAX_CPU_SAMPLES = 2; // 30s current + 30s previous = sustained check

// Get max heap size from V8 or default to 1.5GB
function getMaxHeapSize(): number {
  const heapStats = v8.getHeapStatistics();
  return heapStats.heap_size_limit;
}

// Calculate current CPU usage percentage
function getCPUUsage(): number[] {
  const cpus = os.cpus();
  return cpus.map((cpu) => {
    const times = cpu.times;
    const total = times.user + times.nice + times.sys + times.idle + times.irq;
    const idle = times.idle;
    return total > 0 ? ((total - idle) / total) * 100 : 0;
  });
}

// Calculate average CPU from samples
function getAverageCPU(): number {
  if (cpuSamples.length === 0) return 0;
  
  const allUsages = cpuSamples.flatMap(s => s.usage);
  return allUsages.reduce((sum, val) => sum + val, 0) / allUsages.length;
}

// Poll resources and log warnings
function pollResources(): void {
  const mem = process.memoryUsage();
  const maxHeap = getMaxHeapSize();
  const heapUsedPct = (mem.heapUsed / maxHeap) * 100;
  const memoryMB = Math.round(mem.heapUsed / 1024 / 1024);
  
  // Collect CPU sample
  const cpuUsage = getCPUUsage();
  cpuSamples.push({ timestamp: Date.now(), usage: cpuUsage });
  
  // Keep only last MAX_CPU_SAMPLES
  if (cpuSamples.length > MAX_CPU_SAMPLES) {
    cpuSamples.shift();
  }
  
  const cpuPct = getAverageCPU();
  const warnings: string[] = [];
  
  // Check heap usage
  if (heapUsedPct > 80) {
    const warning = `High heap usage: ${heapUsedPct.toFixed(1)}% (${memoryMB}MB / ${Math.round(maxHeap / 1024 / 1024)}MB)`;
    warnings.push(warning);
    logger.warn(warning, { heapUsedPct, memoryMB, maxHeapMB: Math.round(maxHeap / 1024 / 1024) });
  }
  
  // Check sustained CPU usage (only if we have enough samples)
  if (cpuSamples.length >= MAX_CPU_SAMPLES && cpuPct > 90) {
    const warning = `Sustained high CPU usage: ${cpuPct.toFixed(1)}%`;
    warnings.push(warning);
    logger.warn(warning, { cpuPct, samples: cpuSamples.length });
  }
  
  // Update cached metrics
  lastMetrics = {
    memoryMB,
    heapUsedPct: parseFloat(heapUsedPct.toFixed(2)),
    cpuPct: parseFloat(cpuPct.toFixed(2)),
    warnings,
  };
}

// Start polling every 30 seconds
const POLL_INTERVAL_MS = 30_000;
const pollInterval = setInterval(pollResources, POLL_INTERVAL_MS);

// Initial poll
pollResources();

// Health endpoint
router.get('/api/internal/health/resources', (_req, res) => {
  res.json(lastMetrics);
});

// Cleanup on module unload (for tests)
export function stopMonitoring(): void {
  clearInterval(pollInterval);
  cpuSamples = [];
}

export { router as resourceMonitorRouter };
