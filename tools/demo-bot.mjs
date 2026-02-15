#!/usr/bin/env node
/**
 * OpenClaw Hotel Demo Bot
 * 
 * Simulates autonomous AI agents moving and chatting in rooms.
 * Calls the /api/internal/simulate endpoint periodically to trigger:
 * - Random movement for all agents in presence table
 * - Occasional chat messages from 1-2 agents
 * - Broadcasts to spectators via WebSocket
 * 
 * Usage:
 *   node tools/demo-bot.mjs [interval-ms]
 * 
 * Example:
 *   node tools/demo-bot.mjs 3000  # Tick every 3 seconds
 */

const API_URL = 'http://localhost:3000/api/internal/simulate';
const DEFAULT_INTERVAL_MS = 5000; // 5 seconds

// Get interval from command line or use default
const intervalMs = parseInt(process.argv[2]) || DEFAULT_INTERVAL_MS;

console.log(`[DEMO-BOT] Starting autonomous simulation...`);
console.log(`[DEMO-BOT] API endpoint: ${API_URL}`);
console.log(`[DEMO-BOT] Tick interval: ${intervalMs}ms`);
console.log(`[DEMO-BOT] Press Ctrl+C to stop\n`);

let tickCount = 0;
let totalMoved = 0;
let totalChatted = 0;

/**
 * Call the simulation endpoint
 */
async function tick() {
  tickCount++;
  const tickStart = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[DEMO-BOT] ❌ Tick ${tickCount} failed: ${response.status} ${text}`);
      return;
    }

    const data = await response.json();
    const elapsed = Date.now() - tickStart;

    totalMoved += data.moved || 0;
    totalChatted += data.chatted || 0;

    console.log(
      `[DEMO-BOT] ✓ Tick ${tickCount}: moved=${data.moved}, chatted=${data.chatted}, elapsed=${elapsed}ms`
    );

    // Log chat messages if any
    if (data.chatters && data.chatters.length > 0) {
      for (const chatter of data.chatters) {
        console.log(`  💬 ${chatter.agentId.slice(0, 8)}: "${chatter.message}"`);
      }
    }
  } catch (error) {
    console.error(`[DEMO-BOT] ❌ Tick ${tickCount} error:`, error.message);
  }
}

// Run initial tick immediately
tick();

// Schedule periodic ticks
const intervalId = setInterval(tick, intervalMs);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[DEMO-BOT] Shutting down...');
  clearInterval(intervalId);
  
  const avgMoved = tickCount > 0 ? (totalMoved / tickCount).toFixed(1) : 0;
  const avgChatted = tickCount > 0 ? (totalChatted / tickCount).toFixed(1) : 0;
  
  console.log(`[DEMO-BOT] Stats:`);
  console.log(`  Total ticks: ${tickCount}`);
  console.log(`  Total agents moved: ${totalMoved} (avg ${avgMoved}/tick)`);
  console.log(`  Total chat messages: ${totalChatted} (avg ${avgChatted}/tick)`);
  console.log('[DEMO-BOT] Goodbye! 👋\n');
  
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('[DEMO-BOT] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[DEMO-BOT] Unhandled rejection:', reason);
  process.exit(1);
});
