import { describe, it, expect } from 'vitest';
import { getMemoryUsage, getCPUUsage, getChromeProcesses, getHeavyNodeProcesses } from '../../../tools/resource-monitor/index.mjs';

describe('Resource Monitor', () => {
  describe('getMemoryUsage', () => {
    it('should return memory stats in GB', () => {
      const mem = getMemoryUsage();
      
      expect(mem).toHaveProperty('total');
      expect(mem).toHaveProperty('used');
      expect(mem).toHaveProperty('free');
      expect(mem).toHaveProperty('usedPercent');
      
      expect(parseFloat(mem.total)).toBeGreaterThan(0);
      expect(parseFloat(mem.used)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(mem.free)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(mem.usedPercent)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(mem.usedPercent)).toBeLessThanOrEqual(100);
    });
  });
  
  describe('getCPUUsage', () => {
    it('should return CPU usage stats', () => {
      const cpu = getCPUUsage();
      
      expect(cpu).toHaveProperty('usage');
      expect(cpu).toHaveProperty('cores');
      
      expect(cpu.usage).toBeGreaterThanOrEqual(0);
      expect(cpu.usage).toBeLessThanOrEqual(100);
      expect(cpu.cores).toBeGreaterThan(0);
    });
  });
  
  describe('getChromeProcesses', () => {
    it('should return Chrome process stats', () => {
      const chrome = getChromeProcesses();
      
      expect(chrome).toHaveProperty('count');
      expect(chrome).toHaveProperty('totalMemPercent');
      expect(chrome).toHaveProperty('processes');
      
      expect(chrome.count).toBeGreaterThanOrEqual(0);
      expect(chrome.processes).toBeInstanceOf(Array);
      
      if (chrome.count > 0) {
        expect(chrome.processes.length).toBeGreaterThan(0);
        expect(chrome.processes[0]).toHaveProperty('pid');
        expect(chrome.processes[0]).toHaveProperty('mem');
      }
    });
  });
  
  describe('getHeavyNodeProcesses', () => {
    it('should return heavy Node process stats', () => {
      const heavy = getHeavyNodeProcesses();
      
      expect(heavy).toHaveProperty('count');
      expect(heavy).toHaveProperty('processes');
      expect(heavy.processes).toBeInstanceOf(Array);
      
      if (heavy.count > 0) {
        expect(heavy.processes[0]).toHaveProperty('pid');
        expect(heavy.processes[0]).toHaveProperty('memMB');
        expect(parseFloat(heavy.processes[0].memMB)).toBeGreaterThan(1024); // >1GB
      }
    });
  });
});
