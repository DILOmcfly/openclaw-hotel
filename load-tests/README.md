# 🔥 Load Testing Suite

Performance and stress tests for OpenClaw Hotel server.

## Prerequisites

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Verify server is running:**
   ```bash
   curl http://localhost:3000/api/rooms
   ```

## Tests

### 1. HTTP Endpoints Test

Tests API endpoint performance under heavy load.

```bash
node load-tests/http-endpoints.js
```

**What it tests:**
- GET /api/rooms (public rooms list)
- GET /api/furniture (catalog)
- GET /api/leaderboard (trades)
- GET /api/analytics/agents (spectator metrics)

**Pass criteria:**
- No errors or timeouts
- p95 latency < 200ms
- Sustained throughput under 50-100 concurrent connections

**Duration:** ~2 minutes

---

### 2. WebSocket Stress Test

Simulates multiple AI agents connecting, chatting, and moving simultaneously.

```bash
node load-tests/websocket-stress.js [num-agents]
```

**Examples:**
```bash
# Light load (25 agents, default)
node load-tests/websocket-stress.js

# Medium load (50 agents)
node load-tests/websocket-stress.js 50

# Heavy load (100 agents)
node load-tests/websocket-stress.js 100
```

**What it tests:**
- Concurrent WebSocket connections
- Message broadcasting (chat, movement)
- Server stability under sustained load
- Error rate and disconnect rate

**Pass criteria:**
- 95%+ agents successfully connected
- Zero errors during test
- Stable message throughput

**Duration:** 30 seconds (configurable via `DURATION=60` env var)

---

## Environment Variables

```bash
# HTTP test
SERVER_URL=http://localhost:3000 node load-tests/http-endpoints.js

# WebSocket test
WS_URL=ws://localhost:3000/ws node load-tests/websocket-stress.js
NUM_AGENTS=50 DURATION=60 node load-tests/websocket-stress.js
```

## Benchmarks

Expected performance on MacBook Pro (2015, 16GB RAM):

| Test | Metric | Target | Typical |
|------|--------|--------|---------|
| HTTP Endpoints | Throughput | 100+ req/s | 150-300 req/s |
| HTTP Endpoints | p95 Latency | <200ms | 50-100ms |
| WebSocket | Concurrent agents | 50+ | 50-100 |
| WebSocket | Message rate | 50+ msg/s | 100-200 msg/s |
| WebSocket | Error rate | 0% | 0% |

## CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Run Load Tests
  run: |
    npm run dev &
    sleep 5
    node load-tests/http-endpoints.js
    node load-tests/websocket-stress.js 25
```

## Tips

1. **Warm-up:** Run tests twice; first run may be slower due to cold start.
2. **Database:** Load tests work with empty or populated databases.
3. **Cleanup:** Tests clean up connections automatically.
4. **Scaling:** If you need >100 agents, consider increasing system limits:
   ```bash
   ulimit -n 4096
   ```

## Troubleshooting

### "ECONNREFUSED"
- Server not running. Start with `npm run dev`.

### "Too many open files"
- Increase system file descriptor limit:
  ```bash
  ulimit -n 4096
  ```

### High latency (>500ms)
- Check database performance (add indexes if needed)
- Verify CPU/memory usage (`top`)
- Consider connection pooling tuning

### WebSocket disconnect storm
- Reduce `NUM_AGENTS` or increase `MOVE_INTERVAL`/`MESSAGE_INTERVAL`
- Check server logs for rate limiting

---

## Future Tests

- **Trading load:** Concurrent trades between agents
- **Room creation stress:** Mass room creation/deletion
- **Database stress:** Heavy read/write mix
- **Spike test:** Sudden traffic burst simulation
- **Soak test:** 24h stability test
