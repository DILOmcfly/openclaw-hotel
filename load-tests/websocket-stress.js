/**
 * Load Test: WebSocket Stress
 * 
 * Simulates multiple agents connecting, chatting, and moving simultaneously.
 * Tests WebSocket server capacity and message broadcasting performance.
 * 
 * Usage:
 *   node load-tests/websocket-stress.js [num-agents]
 * 
 * Example:
 *   node load-tests/websocket-stress.js 50
 */

const WebSocket = require('ws');

const SERVER_URL = process.env.WS_URL || 'ws://localhost:3000/ws';
const NUM_AGENTS = parseInt(process.env.NUM_AGENTS || process.argv[2] || '25', 10);
const TEST_DURATION = parseInt(process.env.DURATION || '30', 10); // seconds
const MESSAGE_INTERVAL = 2000; // ms between messages per agent
const MOVE_INTERVAL = 3000; // ms between moves per agent

class LoadTestAgent {
  constructor(id) {
    this.id = id;
    this.ws = null;
    this.connected = false;
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.errors = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      // For load testing, we'll use a mock token (server should handle gracefully)
      // In real scenario, agents would authenticate first
      this.ws = new WebSocket(`${SERVER_URL}?agentId=load-test-${this.id}`);

      this.ws.on('open', () => {
        this.connected = true;
        console.log(`✓ Agent ${this.id} connected`);
        resolve();
      });

      this.ws.on('message', (data) => {
        this.messagesReceived++;
        try {
          const msg = JSON.parse(data.toString());
          // Process message (silent)
        } catch (err) {
          this.errors++;
        }
      });

      this.ws.on('error', (err) => {
        this.errors++;
        console.error(`✗ Agent ${this.id} error: ${err.message}`);
      });

      this.ws.on('close', () => {
        this.connected = false;
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error(`Agent ${this.id} connection timeout`));
        }
      }, 10000);
    });
  }

  sendChat(message) {
    if (!this.connected) return;
    try {
      this.ws.send(JSON.stringify({ type: 'chat', message }));
      this.messagesSent++;
    } catch (err) {
      this.errors++;
    }
  }

  sendMove(x, y) {
    if (!this.connected) return;
    try {
      this.ws.send(JSON.stringify({ type: 'move', x, y }));
      this.messagesSent++;
    } catch (err) {
      this.errors++;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  getStats() {
    return {
      id: this.id,
      sent: this.messagesSent,
      received: this.messagesReceived,
      errors: this.errors,
    };
  }
}

async function main() {
  console.log('🏨 OpenClaw Hotel — WebSocket Stress Test\n');
  console.log(`Server:    ${SERVER_URL}`);
  console.log(`Agents:    ${NUM_AGENTS}`);
  console.log(`Duration:  ${TEST_DURATION}s`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const agents = [];
  const startTime = Date.now();

  // Phase 1: Connect all agents
  console.log('📡 Connecting agents...');
  for (let i = 0; i < NUM_AGENTS; i++) {
    const agent = new LoadTestAgent(i);
    agents.push(agent);

    // Stagger connections to avoid thundering herd
    await sleep(100);
    agent.connect().catch((err) => {
      console.error(`Failed to connect agent ${i}: ${err.message}`);
    });
  }

  // Wait for all connections
  await sleep(3000);
  const connected = agents.filter((a) => a.connected).length;
  console.log(`✓ Connected: ${connected}/${NUM_AGENTS} agents\n`);

  if (connected === 0) {
    console.error('❌ No agents connected. Exiting.');
    process.exit(1);
  }

  // Phase 2: Activity simulation
  console.log('🎬 Starting activity simulation...\n');

  const chatInterval = setInterval(() => {
    agents.forEach((agent, i) => {
      if (i % 3 === 0) { // 1/3 of agents chat
        agent.sendChat(`Test message ${Date.now()} from agent ${agent.id}`);
      }
    });
  }, MESSAGE_INTERVAL);

  const moveInterval = setInterval(() => {
    agents.forEach((agent, i) => {
      if (i % 2 === 0) { // 1/2 of agents move
        const x = Math.floor(Math.random() * 20);
        const y = Math.floor(Math.random() * 20);
        agent.sendMove(x, y);
      }
    });
  }, MOVE_INTERVAL);

  // Phase 3: Monitor and wait
  const monitorInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const totalSent = agents.reduce((sum, a) => sum + a.messagesSent, 0);
    const totalReceived = agents.reduce((sum, a) => sum + a.messagesReceived, 0);
    const totalErrors = agents.reduce((sum, a) => sum + a.errors, 0);

    console.log(
      `[${elapsed}s] Sent: ${totalSent} | Received: ${totalReceived} | Errors: ${totalErrors}`
    );
  }, 5000);

  // Wait for test duration
  await sleep(TEST_DURATION * 1000);

  // Phase 4: Cleanup and report
  clearInterval(chatInterval);
  clearInterval(moveInterval);
  clearInterval(monitorInterval);

  console.log('\n🛑 Stopping test...\n');

  agents.forEach((agent) => agent.disconnect());
  await sleep(1000);

  // Calculate stats
  const stats = agents.map((a) => a.getStats());
  const totalSent = stats.reduce((sum, s) => sum + s.sent, 0);
  const totalReceived = stats.reduce((sum, s) => sum + s.received, 0);
  const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0);
  const avgSent = (totalSent / connected).toFixed(1);
  const avgReceived = (totalReceived / connected).toFixed(1);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Agents connected:     ${connected}/${NUM_AGENTS}`);
  console.log(`Total messages sent:  ${totalSent}`);
  console.log(`Total messages recv:  ${totalReceived}`);
  console.log(`Avg sent/agent:       ${avgSent}`);
  console.log(`Avg recv/agent:       ${avgReceived}`);
  console.log(`Total errors:         ${totalErrors}`);
  console.log(`Message throughput:   ${(totalSent / TEST_DURATION).toFixed(1)} msg/s`);

  const success = totalErrors === 0 && connected >= NUM_AGENTS * 0.95;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(success ? '✅ Test PASSED' : '⚠️  Test FAILED (too many errors or disconnects)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(success ? 0 : 1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
