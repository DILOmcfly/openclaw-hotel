#!/usr/bin/env node
import { createHmac, randomBytes } from 'node:crypto';

const DEFAULT_CONNECTIONS = 50;
const MESSAGES_PER_CONNECTION = 10;
const MESSAGE_INTERVAL_MS = 200;
const WS_URL = process.env.STRESS_WS_URL ?? 'ws://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

const argCount = Number.parseInt(process.argv[2] ?? '', 10);
const connectionCount = Number.isFinite(argCount) && argCount > 0 ? argCount : DEFAULT_CONNECTIONS;

const stats = {
  attemptedConnections: connectionCount,
  successfulConnections: 0,
  failedConnections: 0,
  totalMessagesSent: 0,
  responseTimesMs: [],
};

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createFakeToken(agentId) {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    agentId,
    publicKey: randomBytes(32).toString('hex'),
    exp: nowSeconds + 60 * 60,
    iat: nowSeconds,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', JWT_SECRET).update(signingInput).digest();

  return `${signingInput}.${toBase64Url(signature)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function printSummary() {
  const responseCount = stats.responseTimesMs.length;
  const avgResponse =
    responseCount > 0
      ? stats.responseTimesMs.reduce((sum, value) => sum + value, 0) / responseCount
      : 0;
  const peakResponse = responseCount > 0 ? Math.max(...stats.responseTimesMs) : 0;

  console.log('\n=== Stress Test Summary ===');
  console.log(`Total connections attempted: ${stats.attemptedConnections}`);
  console.log(`Successful connections:      ${stats.successfulConnections}`);
  console.log(`Failed connections:          ${stats.failedConnections}`);
  console.log(`Total messages sent:         ${stats.totalMessagesSent}`);
  console.log(`Average response time:       ${avgResponse.toFixed(2)} ms`);
  console.log(`Peak response time:          ${peakResponse.toFixed(2)} ms`);
}

async function runConnection(index) {
  const agentId = `stress-agent-${index + 1}`;
  const token = createFakeToken(agentId);
  const url = `${WS_URL}?token=${encodeURIComponent(token)}`;

  return new Promise((resolve) => {
    let resolved = false;
    let sendLoopDone = false;
    const pendingSentAt = [];

    const ws = new WebSocket(url);

    const finalize = (success) => {
      if (resolved) {
        return;
      }
      resolved = true;

      if (success) {
        stats.successfulConnections += 1;
      } else {
        stats.failedConnections += 1;
      }
      resolve();
    };

    const closeSoon = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };

    ws.addEventListener('open', async () => {
      try {
        ws.send(
          JSON.stringify({
            type: 'room.join',
            roomId: 'stress-room',
          })
        );

        for (let i = 0; i < MESSAGES_PER_CONNECTION; i += 1) {
          if (ws.readyState !== WebSocket.OPEN) {
            break;
          }

          pendingSentAt.push(Date.now());
          ws.send(
            JSON.stringify({
              type: 'chat.send',
              roomId: 'stress-room',
              content: `stress message ${i + 1} from ${agentId}`,
              signature: `fake-signature-${i + 1}`,
            })
          );

          stats.totalMessagesSent += 1;

          if (i < MESSAGES_PER_CONNECTION - 1) {
            await sleep(MESSAGE_INTERVAL_MS);
          }
        }

        sendLoopDone = true;
        setTimeout(closeSoon, 500);
      } catch {
        closeSoon();
      }
    });

    ws.addEventListener('message', (event) => {
      if (pendingSentAt.length > 0) {
        const sentAt = pendingSentAt.shift();
        if (typeof sentAt === 'number') {
          stats.responseTimesMs.push(Date.now() - sentAt);
        }
      }

      const payload = typeof event.data === 'string' ? safeJsonParse(event.data) : null;
      if (payload?.type === 'error' && sendLoopDone) {
        closeSoon();
      }
    });

    ws.addEventListener('error', () => {
      finalize(false);
    });

    ws.addEventListener('close', () => {
      const success = sendLoopDone;
      finalize(success);
    });
  });
}

async function main() {
  console.log(`Starting stress test against ${WS_URL}`);
  console.log(`Attempting ${connectionCount} concurrent connections...`);

  try {
    await Promise.all(Array.from({ length: connectionCount }, (_, i) => runConnection(i)));
    printSummary();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Stress test failed unexpectedly: ${message}`);
    printSummary();
    process.exitCode = 1;
  }
}

main();
