# Monitoring Guide

## Overview

OpenClaw Hotel implements comprehensive health monitoring through:
- **Health check endpoints** (`/health`, `/ready`)
- **Docker healthchecks** (automated container health monitoring)
- **Uptime Kuma** (web-based monitoring dashboard)
- **Optional Grafana Cloud** (advanced metrics and alerts)

---

## Health Check Endpoints

### `/health`
**Purpose:** Basic service health check  
**Returns:** `200 OK` if service is running  
**Use case:** Docker HEALTHCHECK, load balancer health probes

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-16T09:00:00.000Z"
}
```

### `/ready`
**Purpose:** Readiness check (service + dependencies)  
**Returns:** `200 OK` if service is ready to accept traffic  
**Checks:**
- Database connectivity (PostgreSQL)
- Cache availability (Redis)
- Critical service initialization

```bash
curl http://localhost:3000/ready
```

**Response:**
```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "redis": "ok"
  },
  "timestamp": "2026-02-16T09:00:00.000Z"
}
```

---

## Docker Healthcheck

The application includes an automated health check script (`scripts/healthcheck.sh`) that:
- Tests both `/health` and `/ready` endpoints
- Logs results with timestamps
- Exits with appropriate codes:
  - `0` = healthy and ready
  - `1` = alive but not ready
  - `2` = unhealthy

### Configuration
```yaml
healthcheck:
  test: ['CMD', 'sh', '/app/scripts/healthcheck.sh']
  interval: 30s        # Check every 30 seconds
  timeout: 10s         # Max time for check to complete
  retries: 3           # Consecutive failures before unhealthy
  start_period: 40s    # Grace period on container start
```

### View Health Status
```bash
# Check container health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# View healthcheck logs
docker inspect openclaw-hotel-app --format='{{json .State.Health}}' | jq
```

---

## Uptime Kuma Setup

**Uptime Kuma** is a self-hosted monitoring tool with a beautiful web interface.

### Quick Start

1. **Start Uptime Kuma:**
   ```bash
   cd monitoring
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **Access the dashboard:**
   - URL: http://localhost:3001
   - On first access, create an admin account

3. **Add monitors:**
   - Click "+ Add New Monitor"
   - Configure as shown below

### Recommended Monitors

#### Monitor 1: Health Endpoint
- **Type:** HTTP(s)
- **Name:** OpenClaw Hotel - Health
- **URL:** `http://host.docker.internal:3000/health`
- **Interval:** 60 seconds
- **Retries:** 2
- **Expected Status Code:** 200

#### Monitor 2: Ready Endpoint
- **Type:** HTTP(s)
- **Name:** OpenClaw Hotel - Ready
- **URL:** `http://host.docker.internal:3000/ready`
- **Interval:** 60 seconds
- **Retries:** 2
- **Expected Status Code:** 200

#### Monitor 3: WebSocket Connection
- **Type:** HTTP(s) - Keyword
- **Name:** OpenClaw Hotel - WebSocket
- **URL:** `http://host.docker.internal:3000/`
- **Keyword:** `socket.io` (look for Socket.IO in HTML)
- **Interval:** 120 seconds

#### Monitor 4: Database (PostgreSQL)
- **Type:** PostgreSQL
- **Name:** OpenClaw Hotel - Database
- **Host:** `host.docker.internal`
- **Port:** 5432
- **Database:** `openclaw_hotel`
- **Username:** `openclaw`
- **Password:** `openclaw`

#### Monitor 5: Redis
- **Type:** Redis
- **Name:** OpenClaw Hotel - Redis
- **Host:** `host.docker.internal`
- **Port:** 6379

---

## Alert Configuration

### Uptime Kuma Notifications

**Recommended Channels:**
1. **Telegram** (instant push notifications)
   - Create bot via @BotFather
   - Add bot token and chat ID
   - Test notification

2. **Email** (SMTP)
   - Configure SMTP server
   - Set recipient email

3. **Discord/Slack** (team channels)
   - Create webhook URL
   - Configure in Uptime Kuma

**Alert Rules:**
- Send notification when monitor goes down
- Send recovery notification when back up
- Alert after 2 consecutive failures (avoid false alarms)

### Example Alert Strategy

| Monitor | Threshold | Action |
|---------|-----------|--------|
| Health endpoint | Down for 3 checks (3 min) | Alert via Telegram |
| Ready endpoint | Down for 2 checks (2 min) | Alert via Telegram + Email |
| Database | Connection failed | Immediate alert (all channels) |
| Redis | Connection failed | Alert via Telegram |

---

## Grafana Cloud (Optional - Free Tier)

For advanced metrics, dashboards, and long-term storage.

### Setup Steps

1. **Create Account:**
   - Visit: https://grafana.com/auth/sign-up/create-user
   - Select "Free" tier (14-day full access, then free tier limits)

2. **Configure Prometheus Exporter:**
   Add to `package.json`:
   ```json
   "dependencies": {
     "prom-client": "^15.1.0"
   }
   ```

   Create `src/monitoring/metrics.ts`:
   ```typescript
   import { Registry, Counter, Histogram } from 'prom-client';

   export const register = new Registry();

   export const httpRequestCounter = new Counter({
     name: 'http_requests_total',
     help: 'Total HTTP requests',
     labelNames: ['method', 'route', 'status'],
     registers: [register]
   });

   export const httpRequestDuration = new Histogram({
     name: 'http_request_duration_seconds',
     help: 'HTTP request duration',
     labelNames: ['method', 'route'],
     registers: [register]
   });
   ```

   Add endpoint in your Express app:
   ```typescript
   app.get('/metrics', async (req, res) => {
     res.set('Content-Type', register.contentType);
     res.end(await register.metrics());
   });
   ```

3. **Configure Grafana Agent:**
   Create `monitoring/grafana-agent.yml`:
   ```yaml
   metrics:
     global:
       scrape_interval: 60s
     configs:
       - name: openclaw-hotel
         scrape_configs:
           - job_name: 'app'
             static_configs:
               - targets: ['host.docker.internal:3000']
         remote_write:
           - url: <YOUR_GRAFANA_CLOUD_PROMETHEUS_URL>
             basic_auth:
               username: <YOUR_INSTANCE_ID>
               password: <YOUR_API_KEY>
   ```

4. **Import Dashboard:**
   - Use template ID: 1860 (Node Exporter Full)
   - Or create custom dashboard with panels for:
     - Request rate (req/s)
     - Response time (p50, p95, p99)
     - Error rate (%)
     - Active WebSocket connections
     - Database query duration

### Free Tier Limits
- **Metrics:** 10k series
- **Logs:** 50GB
- **Traces:** 50GB
- **Retention:** 14 days

---

## Monitoring Checklist

### Daily Checks
- [ ] Review Uptime Kuma dashboard
- [ ] Check for any downtime incidents
- [ ] Verify all monitors are green

### Weekly Checks
- [ ] Review response time trends
- [ ] Check for performance degradation
- [ ] Verify alert notifications are working (test alerts)
- [ ] Review error logs

### Monthly Checks
- [ ] Update Uptime Kuma container (`docker pull louislam/uptime-kuma:1`)
- [ ] Review and optimize alert thresholds
- [ ] Archive old incident reports
- [ ] Check disk usage (monitoring data volume)

---

## Troubleshooting

### Health endpoint returns 503
**Cause:** Service dependencies not ready (DB/Redis)  
**Fix:**
```bash
# Check database connection
docker exec openclaw-hotel-postgres pg_isready -U openclaw

# Check Redis connection
docker exec openclaw-hotel-redis redis-cli ping
```

### Uptime Kuma shows "host.docker.internal not found"
**Cause:** Docker networking issue  
**Fix (Linux):**
```bash
# Add to docker-compose.monitoring.yml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### Healthcheck script permission denied
**Cause:** Script not executable  
**Fix:**
```bash
chmod +x scripts/healthcheck.sh
```

### Container stuck in "health: starting"
**Cause:** Start period too short or dependencies slow  
**Fix:** Increase `start_period` in docker-compose.yml

---

## Best Practices

1. **Monitor what matters:**
   - Core endpoints (`/health`, `/ready`)
   - Critical dependencies (DB, Redis)
   - User-facing functionality

2. **Avoid alert fatigue:**
   - Set appropriate thresholds (2-3 failures before alerting)
   - Use different severity levels
   - Don't alert on expected behavior (deployments, maintenance)

3. **Test your alerts:**
   - Manually trigger test alerts monthly
   - Verify notification delivery
   - Update contact information

4. **Document incidents:**
   - Log downtime events
   - Root cause analysis
   - Preventive measures

5. **Keep it simple:**
   - Start with basic monitoring (Uptime Kuma)
   - Add advanced tools only when needed
   - Prefer few actionable alerts over many noisy ones

---

## Resources

- **Uptime Kuma:** https://github.com/louislam/uptime-kuma
- **Grafana Cloud:** https://grafana.com/products/cloud/
- **Docker Health Checks:** https://docs.docker.com/engine/reference/builder/#healthcheck
- **Prometheus Best Practices:** https://prometheus.io/docs/practices/naming/

---

**Last Updated:** 2026-02-16  
**Maintained by:** OpenClaw DevOps Team
