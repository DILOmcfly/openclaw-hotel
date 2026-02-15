#!/usr/bin/env node

/**
 * Resource Monitor
 * Checks RAM, CPU, processes for memory leaks and auto-suggests cleanup
 * 
 * Usage:
 *   node tools/resource-monitor/index.mjs [--kill-chrome] [--kill-node] [--json]
 * 
 * Thresholds:
 *   RAM: warn >12GB, critical >14GB (MBP mid-2015 has 16GB total)
 *   CPU: warn >70%, critical >90% sustained for 30s
 */

import { execSync } from 'child_process';
import os from 'os';

const WARN_RAM_GB = 12;
const CRITICAL_RAM_GB = 14;
const WARN_CPU_PERCENT = 70;
const CRITICAL_CPU_PERCENT = 90;
const HEAVY_NODE_MB = 1024; // 1GB

function bytesToGB(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    total: bytesToGB(totalMem),
    used: bytesToGB(usedMem),
    free: bytesToGB(freeMem),
    usedPercent: ((usedMem / totalMem) * 100).toFixed(1)
  };
}

function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  
  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);
  
  return {
    usage,
    cores: cpus.length
  };
}

function getChromeProcesses() {
  try {
    // macOS: find Chrome processes
    const output = execSync('ps aux | grep -i chrome | grep -v grep || true', { encoding: 'utf8' });
    const lines = output.trim().split('\n').filter(l => l);
    
    const processes = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parts[1],
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        command: parts.slice(10).join(' ')
      };
    });
    
    const totalMem = processes.reduce((sum, p) => sum + p.mem, 0);
    
    return {
      count: processes.length,
      totalMemPercent: totalMem.toFixed(1),
      processes: processes.slice(0, 5) // Top 5
    };
  } catch (err) {
    return { count: 0, totalMemPercent: 0, processes: [] };
  }
}

function getHeavyNodeProcesses() {
  try {
    // Find Node processes >1GB
    const output = execSync('ps aux | grep node | grep -v grep || true', { encoding: 'utf8' });
    const lines = output.trim().split('\n').filter(l => l);
    
    const totalMemBytes = os.totalmem();
    
    const processes = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const memPercent = parseFloat(parts[3]);
      const memMB = (totalMemBytes * memPercent / 100) / 1024 / 1024;
      
      return {
        pid: parts[1],
        cpu: parseFloat(parts[2]),
        memPercent: memPercent,
        memMB: memMB.toFixed(0),
        command: parts.slice(10).join(' ').substring(0, 80)
      };
    }).filter(p => p.memMB > HEAVY_NODE_MB);
    
    return {
      count: processes.length,
      processes: processes.sort((a, b) => b.memMB - a.memMB).slice(0, 5)
    };
  } catch (err) {
    return { count: 0, processes: [] };
  }
}

function generateRecommendations(mem, chrome, heavyNode) {
  const recommendations = [];
  
  const usedGB = parseFloat(mem.used);
  
  if (usedGB > CRITICAL_RAM_GB) {
    recommendations.push({
      level: 'CRITICAL',
      message: `RAM critically high (${mem.used}GB/${mem.total}GB)`,
      action: 'Consider killing Chrome or heavy Node processes immediately'
    });
    
    if (chrome.count > 0) {
      recommendations.push({
        level: 'ACTION',
        message: `Chrome using ${chrome.totalMemPercent}% RAM`,
        command: 'killall -9 "Google Chrome"'
      });
    }
    
    if (heavyNode.count > 0) {
      const heaviest = heavyNode.processes[0];
      recommendations.push({
        level: 'ACTION',
        message: `Heavy Node process: ${heaviest.memMB}MB (PID ${heaviest.pid})`,
        command: `kill -9 ${heaviest.pid}`
      });
    }
  } else if (usedGB > WARN_RAM_GB) {
    recommendations.push({
      level: 'WARNING',
      message: `RAM usage high (${mem.used}GB/${mem.total}GB)`,
      action: 'Monitor closely, avoid launching heavy processes'
    });
  }
  
  return recommendations;
}

function run(options = {}) {
  const mem = getMemoryUsage();
  const cpu = getCPUUsage();
  const chrome = getChromeProcesses();
  const heavyNode = getHeavyNodeProcesses();
  const recommendations = generateRecommendations(mem, chrome, heavyNode);
  
  const report = {
    timestamp: new Date().toISOString(),
    memory: mem,
    cpu,
    chrome,
    heavyNode,
    recommendations
  };
  
  // Handle auto-kill options
  if (options.killChrome && chrome.count > 0) {
    console.log('🔴 Killing Chrome processes...');
    try {
      execSync('killall -9 "Google Chrome"');
      console.log('✅ Chrome killed');
    } catch (err) {
      console.error('❌ Failed to kill Chrome:', err.message);
    }
  }
  
  if (options.killNode && heavyNode.count > 0) {
    const pid = heavyNode.processes[0].pid;
    console.log(`🔴 Killing heavy Node process (PID ${pid})...`);
    try {
      execSync(`kill -9 ${pid}`);
      console.log('✅ Process killed');
    } catch (err) {
      console.error('❌ Failed to kill process:', err.message);
    }
  }
  
  // Output
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n📊 RESOURCE MONITOR REPORT');
    console.log('='.repeat(50));
    console.log(`🕒 ${report.timestamp}`);
    console.log(`\n💾 Memory: ${mem.used}GB / ${mem.total}GB (${mem.usedPercent}%)`);
    console.log(`⚡ CPU: ${cpu.usage}% (${cpu.cores} cores)`);
    console.log(`\n🌐 Chrome: ${chrome.count} processes, ${chrome.totalMemPercent}% RAM`);
    console.log(`📦 Heavy Node: ${heavyNode.count} processes (>1GB)`);
    
    if (recommendations.length > 0) {
      console.log('\n⚠️  RECOMMENDATIONS:');
      recommendations.forEach(rec => {
        console.log(`\n[${rec.level}] ${rec.message}`);
        if (rec.action) console.log(`  → ${rec.action}`);
        if (rec.command) console.log(`  $ ${rec.command}`);
      });
    } else {
      console.log('\n✅ All systems nominal');
    }
    
    console.log('\n' + '='.repeat(50));
  }
  
  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    killChrome: args.includes('--kill-chrome'),
    killNode: args.includes('--kill-node'),
    json: args.includes('--json')
  };
  
  run(options);
}

export { run, getMemoryUsage, getCPUUsage, getChromeProcesses, getHeavyNodeProcesses };
