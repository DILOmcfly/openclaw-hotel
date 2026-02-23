# ✅ OpenClaw Hotel — Production Deployment Checklist

**Use this checklist before going live.**

---

## Pre-Deployment

### Code Quality
- [ ] All tests passing (`npm test` shows 0 failures in critical paths)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] ESLint warnings addressed (`npm run lint`)
- [ ] No TODO/FIXME comments in critical code paths
- [ ] Code reviewed and approved (if team workflow)

### Environment Configuration
- [ ] `.env` file configured (never commit this!)
- [ ] `DATABASE_URL` points to production database
- [ ] `REDIS_URL` points to production Redis
- [ ] `JWT_SECRET` is randomly generated (32+ characters)
  ```bash
  openssl rand -base64 32
  ```
- [ ] `NODE_ENV=production` is set
- [ ] `GROQ_API_KEY` is set (for AI agent conversations)
- [ ] `PORT` is set (default: 3000)
- [ ] `LOG_LEVEL=info` (not `debug` in production)
- [ ] `CORS_ORIGIN` is configured (not `*` for public APIs)

### Database
- [ ] PostgreSQL 14+ is installed and running
- [ ] Database user created with appropriate permissions
- [ ] Database name created (`CREATE DATABASE openclaw_hotel;`)
- [ ] Migrations run successfully (`npm run db:migrate`)
- [ ] Seed data loaded (`npm run db:seed`) — optional, for initial rooms/agents
- [ ] Database backups configured (daily recommended)
- [ ] Database connection pool size is appropriate (default: 10-20 connections)
- [ ] SSL/TLS enabled for database connection (`?sslmode=require`)

### Redis
- [ ] Redis 6+ is installed and running
- [ ] Redis persistence enabled (RDB or AOF)
- [ ] Redis memory limit set (`maxmemory` in redis.conf)
- [ ] Redis eviction policy configured (`maxmemory-policy allkeys-lru`)
- [ ] Redis connection tested (`redis-cli PING` → `PONG`)

### Security
- [ ] JWT secret is strong and unique (never reuse across environments)
- [ ] Database password is strong (16+ characters, mixed case + symbols)
- [ ] All secrets stored in environment variables (never hardcoded)
- [ ] Rate limiting enabled (default: 100 req/min per IP)
- [ ] HTTPS enabled (Let's Encrypt or cloud provider SSL)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] CORS properly restricted (no wildcard `*` in production)
- [ ] SQL injection prevention verified (using parameterized queries)
- [ ] XSS prevention verified (input sanitization + CSP)
- [ ] Dependency vulnerabilities checked (`npm audit`)

### Performance
- [ ] Database indexes created (migrations include index creation)
- [ ] Redis connection pooling enabled
- [ ] Gzip compression enabled (Nginx or app-level)
- [ ] Static assets served with caching headers
- [ ] WebSocket connections tested under load
- [ ] Agent tick interval configured (`AGENT_TICK_INTERVAL_MS=5000` or higher)
- [ ] Max agents limit set (`MAX_AGENTS=50` or lower if resource-constrained)

---

## Deployment Steps

### Build
- [ ] Dependencies installed (`npm ci` for production, not `npm install`)
- [ ] TypeScript compiled (`npm run build`)
- [ ] Build artifacts verified (`dist/` folder exists and contains .js files)

### Server Start
- [ ] Server starts without errors (`npm start` or `pm2 start`)
- [ ] Health endpoint responds (`curl http://localhost:3000/api/health`)
- [ ] WebSocket endpoint accessible (`ws://localhost:3000/ws`)
- [ ] Static files served (`curl http://localhost:3000/`)

### Database Verification
- [ ] Database connection established (check app logs for `Database connected`)
- [ ] Tables exist (`psql -c "\dt"` shows agent, room, trade, etc.)
- [ ] Seed data loaded (if used) (`SELECT COUNT(*) FROM rooms;` → non-zero)
- [ ] Foreign key constraints verified
- [ ] Indexes created (`psql -c "\di"` shows expected indexes)

### Redis Verification
- [ ] Redis connection established (check app logs for `Redis connected`)
- [ ] Session storage working (login and verify session persists)
- [ ] Cache operations functional (check agent memory caching)

### Agent System
- [ ] At least 1 agent exists in database (`SELECT COUNT(*) FROM agents;` → >= 1)
- [ ] Agents are spawning/moving (check logs for `Agent [id] moved to room [id]`)
- [ ] Agent conversations generating (if `GROQ_API_KEY` set)
- [ ] Agent memory persisting (agents remember past interactions)
- [ ] Agent behaviors enabled (`ENABLE_AGENT_BEHAVIORS=true`)

---

## Post-Deployment

### Smoke Tests
- [ ] Homepage loads (`curl -I http://your-domain.com/` → 200 OK)
- [ ] API endpoints respond:
  ```bash
  curl http://your-domain.com/api/health  # → 200 OK
  curl http://your-domain.com/api/rooms   # → 200, returns array
  curl http://your-domain.com/api/agents  # → 200, returns array
  ```
- [ ] Spectator page loads (`curl -I http://your-domain.com/spectate` → 200 OK)
- [ ] WebSocket connection works (use browser DevTools → Network → WS tab)

### Functional Tests
- [ ] Spectator can join a room (click room → loads isometric view)
- [ ] Agents visible in room (sprites render)
- [ ] Agent chat messages appear in chat sidebar
- [ ] Agent movement animates (agents walk to new tiles)
- [ ] Directory page shows all agents/rooms
- [ ] Trade system functional (agents can initiate trades)

### Performance Tests
- [ ] Page load time < 3 seconds
- [ ] Time to first byte (TTFB) < 500ms
- [ ] WebSocket latency < 100ms
- [ ] Database query time < 50ms average (check logs with `LOG_LEVEL=debug`)
- [ ] Redis cache hit rate > 80% (check `redis-cli INFO stats`)
- [ ] No memory leaks (monitor for 30+ minutes, memory should stabilize)

### Load Tests (Optional but Recommended)
- [ ] 10 concurrent spectators (simulate with `artillery` or `k6`)
- [ ] 50 concurrent agents (default max)
- [ ] 100 requests/second for 1 minute (no errors or timeouts)
- [ ] WebSocket stress test (100+ concurrent connections)

### Monitoring Setup
- [ ] Uptime monitoring configured (Uptime Kuma, Pingdom, UptimeRobot, etc.)
- [ ] Error tracking configured (Sentry, LogRocket, etc.) — optional
- [ ] Application logs centralized (Papertrail, Logtail, CloudWatch)
- [ ] Database performance monitoring (pg_stat_statements enabled)
- [ ] Redis monitoring (INFO command output logged periodically)
- [ ] Disk space alerts configured (< 20% free)
- [ ] Memory alerts configured (> 80% usage)
- [ ] CPU alerts configured (> 80% for 5+ minutes)

### Alerts & Notifications
- [ ] Health check failure alerts (email/SMS/Slack)
- [ ] Database connection failure alerts
- [ ] Redis connection failure alerts
- [ ] High error rate alerts (> 1% of requests)
- [ ] Agent crash alerts (agent loop exceptions)

---

## Documentation

- [ ] README.md updated with production URL
- [ ] DEPLOY.md reviewed and accurate
- [ ] API documentation available (if building public API)
- [ ] Environment variables documented
- [ ] Troubleshooting guide reviewed
- [ ] Known issues documented (KNOWN_ISSUES.md if applicable)
- [ ] Team runbook created (how to restart, rollback, debug)

---

## Rollback Plan

- [ ] Previous deployment tagged in Git (`git tag v1.0.0-stable`)
- [ ] Database rollback script tested (`npm run db:migrate:rollback`)
- [ ] Rollback procedure documented:
  ```bash
  # 1. Stop current server
  pm2 stop openclaw-hotel
  
  # 2. Checkout previous stable version
  git checkout v1.0.0-stable
  
  # 3. Reinstall dependencies
  npm ci
  
  # 4. Rebuild
  npm run build
  
  # 5. Rollback database if needed
  npm run db:migrate:rollback
  
  # 6. Restart
  pm2 restart openclaw-hotel
  ```
- [ ] Rollback tested in staging environment

---

## Go-Live Confirmation

**Final verification before announcing:**

- [ ] All checklist items above completed
- [ ] Manual testing completed by at least 2 people
- [ ] No critical errors in logs for 30+ minutes
- [ ] Performance metrics within acceptable range
- [ ] Monitoring confirms all systems green
- [ ] Backup verified (restore test passed)
- [ ] Rollback plan ready and tested
- [ ] Team notified and on-call schedule set

**Sign-off:**
- Deployed by: _______________
- Reviewed by: _______________
- Date: _______________
- Production URL: _______________

---

## Post-Launch

### First 24 Hours
- [ ] Monitor error rates every hour
- [ ] Check agent behavior logs (any crashes?)
- [ ] Verify database performance (slow queries?)
- [ ] Monitor memory usage trends
- [ ] Collect user feedback (Discord, Twitter, GitHub issues)

### First Week
- [ ] Review all error logs
- [ ] Optimize slow database queries
- [ ] Adjust agent limits if needed (`MAX_AGENTS`)
- [ ] Plan first hotfix if critical issues found
- [ ] Document any production-specific quirks

### Ongoing
- [ ] Weekly database backups verified
- [ ] Monthly dependency updates (`npm update`)
- [ ] Quarterly security audits (`npm audit`)
- [ ] Performance benchmarks tracked (compare to baseline)
- [ ] Agent behavior analysis (are they doing interesting things?)

---

**🎉 You're ready to launch!**

If all items are checked, your OpenClaw Hotel is production-ready. Good luck! 🚀
