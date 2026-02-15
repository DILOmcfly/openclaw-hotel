/**
 * Load Test: HTTP Endpoints
 * 
 * Tests API endpoint performance under load.
 * Focuses on read-heavy endpoints (rooms, furniture, leaderboards).
 * 
 * Usage:
 *   node load-tests/http-endpoints.js
 */

const autocannon = require('autocannon');

const baseUrl = process.env.SERVER_URL || 'http://localhost:3000';

async function runTest(name, url, options = {}) {
  console.log(`\n🔥 ${name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const result = await autocannon({
    url: `${baseUrl}${url}`,
    connections: options.connections || 50,
    duration: options.duration || 30,
    pipelining: options.pipelining || 1,
    ...options,
  });

  console.log(`\n📊 Results for ${name}:`);
  console.log(`   Requests:  ${result.requests.total} total`);
  console.log(`   Throughput: ${(result.requests.average).toFixed(2)} req/s`);
  console.log(`   Latency:   p50=${result.latency.p50}ms p95=${result.latency.p95}ms p99=${result.latency.p99}ms`);
  console.log(`   Errors:    ${result.errors}`);
  console.log(`   Timeouts:  ${result.timeouts}`);

  return result;
}

async function main() {
  console.log('🏨 OpenClaw Hotel — HTTP Load Tests');
  console.log(`Server: ${baseUrl}\n`);

  const results = {};

  // Test 1: Rooms list (public endpoint)
  results.rooms = await runTest('GET /api/rooms (public rooms list)', '/api/rooms', {
    connections: 100,
    duration: 20,
  });

  await sleep(3000); // Cooldown

  // Test 2: Furniture catalog
  results.furniture = await runTest('GET /api/furniture (catalog)', '/api/furniture', {
    connections: 50,
    duration: 20,
  });

  await sleep(3000);

  // Test 3: Leaderboards
  results.leaderboard = await runTest('GET /api/leaderboard (trades)', '/api/leaderboard?category=trades', {
    connections: 80,
    duration: 20,
  });

  await sleep(3000);

  // Test 4: Analytics (spectator endpoint)
  results.analytics = await runTest('GET /api/analytics/agents', '/api/analytics/agents?metric=messages_sent&limit=10', {
    connections: 60,
    duration: 20,
  });

  // Summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  Object.entries(results).forEach(([name, result]) => {
    const passed = result.errors === 0 && result.timeouts === 0 && result.latency.p95 < 200;
    const status = passed ? '✅' : '⚠️';
    console.log(`${status} ${name.padEnd(20)} ${result.requests.average.toFixed(0)} req/s (p95: ${result.latency.p95}ms)`);
  });

  // Pass/fail criteria
  const allPassed = Object.values(results).every(r =>
    r.errors === 0 && r.timeouts === 0 && r.latency.p95 < 200
  );

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(allPassed ? '✅ All tests PASSED' : '⚠️  Some tests FAILED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(allPassed ? 0 : 1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
