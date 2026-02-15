#!/usr/bin/env node

/**
 * Continuous Simulation Loop for OpenClaw Hotel
 * 
 * Calls POST /api/internal/simulate every 30 seconds
 * to trigger autonomous agent movement and AI-powered chat
 * 
 * Usage: node tools/simulation-loop.mjs
 */

const SIMULATE_ENDPOINT = 'http://localhost:3000/api/internal/simulate';
const INTERVAL_MS = 30 * 1000; // 30 seconds

let iteration = 0;

/**
 * Call the simulation endpoint
 */
async function triggerSimulation() {
  iteration++;
  const timestamp = new Date().toISOString();
  
  console.log(`\n[${timestamp}] Iteration ${iteration}: Triggering simulation...`);

  try {
    const response = await fetch(SIMULATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Simulation failed: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();

    if (data.ok) {
      console.log(`✅ Simulation complete:`);
      console.log(`   - Agents moved: ${data.moved}`);
      console.log(`   - Agents chatted: ${data.chatted}`);

      // Log chat messages
      if (data.chatters && data.chatters.length > 0) {
        console.log(`   - Messages:`);
        data.chatters.forEach((chatter) => {
          console.log(`     • Agent ${chatter.agentId}: "${chatter.message}"`);
        });
      }

      // Log movements (if you want detailed logs)
      if (data.movements && data.movements.length > 0 && process.env.VERBOSE) {
        console.log(`   - Movements:`);
        data.movements.forEach((move) => {
          console.log(`     • Agent ${move.agentId}: (${move.x}, ${move.y}) rotation=${move.rotation}`);
        });
      }
    } else {
      console.error(`❌ Simulation returned not ok`);
    }
  } catch (error) {
    console.error(`❌ Error calling simulation endpoint:`, error.message);
  }
}

/**
 * Main loop
 */
async function main() {
  console.log('🚀 OpenClaw Hotel - Simulation Loop Started');
  console.log(`   - Endpoint: ${SIMULATE_ENDPOINT}`);
  console.log(`   - Interval: ${INTERVAL_MS / 1000} seconds`);
  console.log(`   - Set VERBOSE=1 to see detailed movement logs`);
  console.log('');
  console.log('Press Ctrl+C to stop\n');

  // Run first simulation immediately
  await triggerSimulation();

  // Then run every INTERVAL_MS
  setInterval(async () => {
    await triggerSimulation();
  }, INTERVAL_MS);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Simulation loop stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Simulation loop stopped');
  process.exit(0);
});

// Start the loop
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
