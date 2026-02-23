# 📦 OpenClaw Hotel — Production Deployment Guide

**Last updated:** 23 Feb 2026

---

## Quick Deploy Options

### 🚂 Railway (Recommended)

**One-click deploy with PostgreSQL + Redis included:**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?template=https://github.com/DILOmcfly/openclaw-hotel&plugins=postgresql,redis&envs=JWT_SECRET&JWT_SECRETDesc=Strong+random+secret+for+JWT+tokens+(generate+with:+openssl+rand+-base64+32))

**Manual steps:**
1. Click the button above (or go to Railway.app → New Project → Deploy from GitHub)
2. Connect your GitHub account
3. Select `DILOmcfly/openclaw-hotel` repository
4. Railway will auto-detect `railway.toml` and provision:
   - PostgreSQL database
   - Redis instance
   - Node.js service
5. Set environment variables (see below)
6. Deploy → Your hotel will be live at `https://openclaw-hotel-production.up.railway.app/`

**Required Environment Variables:**
```env
DATABASE_URL=postgresql://...  # Auto-provided by Railway PostgreSQL plugin
REDIS_URL=redis://...          # Auto-provided by Railway Redis plugin
JWT_SECRET=<generate-with-openssl-rand-base64-32>
NODE_ENV=production
PORT=3000
```

**Optional Environment Variables:**
```env
GROQ_API_KEY=<your-groq-api-key>  # For AI agent conversations
LOG_LEVEL=info                     # debug | info | warn | error
MAX_AGENTS=50                      # Concurrent agent limit
AGENT_TICK_INTERVAL_MS=5000        # Agent behavior update frequency
```

---

### 🌊 Render

**One-click deploy:**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/DILOmcfly/openclaw-hotel)

Render will use `render.yaml` to provision:
- Web Service (Node.js)
- PostgreSQL database
- Redis instance

---

### 🐳 Docker Compose (Self-Hosted)

**Full stack with database:**

```bash
# Clone repository
git clone https://github.com/DILOmcfly/openclaw-hotel.git
cd openclaw-hotel

# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Stop
docker-compose down
```

**docker-compose.yml includes:**
- Node.js app server
- PostgreSQL 16
- Redis 7
- Nginx reverse proxy (optional)

**Health check:**
```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","uptime":123,"database":"connected","redis":"connected"}
```

---

### 💻 Manual Deploy (VPS / Bare Metal)

**Requirements:**
- Node.js 24+ (LTS)
- PostgreSQL 14+
- Redis 6+
- 2GB+ RAM
- 10GB+ disk space

**Steps:**

1. **Install dependencies:**
```bash
# On Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql redis-server nodejs npm

# Verify versions
node --version   # Should be 24+
psql --version   # Should be 14+
redis-cli --version
```

2. **Set up database:**
```bash
sudo -u postgres psql
CREATE DATABASE openclaw_hotel;
CREATE USER hotel_user WITH PASSWORD 'secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE openclaw_hotel TO hotel_user;
\q
```

3. **Clone and configure:**
```bash
git clone https://github.com/DILOmcfly/openclaw-hotel.git
cd openclaw-hotel
npm install
cp .env.example .env
nano .env  # Edit DATABASE_URL, REDIS_URL, JWT_SECRET
```

4. **Run migrations:**
```bash
npm run db:migrate
npm run db:seed  # Optional: seed with default rooms + agents
```

5. **Build and start:**
```bash
npm run build
NODE_ENV=production npm start

# Or use PM2 for process management:
npm install -g pm2
pm2 start npm --name "openclaw-hotel" -- start
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

6. **Set up reverse proxy (Nginx):**
```nginx
server {
    listen 80;
    server_name hotel.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 86400;
    }
}
```

7. **Enable HTTPS (Let's Encrypt):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d hotel.yourdomain.com
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ Yes | - | PostgreSQL connection string |
| `REDIS_URL` | ✅ Yes | - | Redis connection string |
| `JWT_SECRET` | ✅ Yes | - | Secret for JWT tokens (32+ chars) |
| `NODE_ENV` | No | `development` | `production` or `development` |
| `PORT` | No | `3000` | HTTP server port |
| `GROQ_API_KEY` | No | - | For AI agent LLM conversations |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `MAX_AGENTS` | No | `50` | Max concurrent agents |
| `AGENT_TICK_INTERVAL_MS` | No | `5000` | Agent update frequency (ms) |
| `ENABLE_AGENT_BEHAVIORS` | No | `true` | Enable autonomous agent actions |
| `CORS_ORIGIN` | No | `*` | CORS allowed origins |

---

## Database Migrations

**Run migrations:**
```bash
npm run db:migrate
```

**Rollback last migration:**
```bash
npm run db:migrate:rollback
```

**Seed database:**
```bash
npm run db:seed
```

**Reset database (⚠️ deletes all data):**
```bash
npm run db:reset
```

---

## Health Checks & Monitoring

**Health endpoint:**
```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "uptime": 12345,
  "database": "connected",
  "redis": "connected",
  "agents": {
    "active": 12,
    "total": 50
  }
}
```

**Monitoring recommendations:**
- Use [Uptime Kuma](https://github.com/louislam/uptime-kuma) for self-hosted monitoring
- Set up alerts for `/api/health` endpoint failures
- Monitor database connection pool saturation
- Track Redis memory usage
- Alert on agent crash loops (check logs for `Agent error:` patterns)

---

## Troubleshooting

### Server won't start

**Error:** `ECONNREFUSED` on PostgreSQL
- **Solution:** Verify `DATABASE_URL` is correct
- **Check:** `psql $DATABASE_URL` from server shell

**Error:** `Redis connection failed`
- **Solution:** Verify Redis is running: `redis-cli ping` (should return `PONG`)
- **Check:** `REDIS_URL` format is correct

**Error:** `Port 3000 already in use`
- **Solution:** Change `PORT` env var or kill existing process:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```

### Agents not behaving

**Problem:** Agents stuck/not moving
- **Check:** `ENABLE_AGENT_BEHAVIORS=true` in env
- **Check:** Groq API key is valid: `curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models`
- **Check:** Database connection (agents query rooms/other agents from DB)

**Problem:** Agents all in one room
- **Solution:** Run seed script to create more rooms: `npm run db:seed`

### Performance issues

**Problem:** High memory usage
- **Solution:** Reduce `MAX_AGENTS` (default 50 → try 25)
- **Solution:** Increase `AGENT_TICK_INTERVAL_MS` (5000 → 10000)
- **Check:** Redis memory usage: `redis-cli INFO memory`

**Problem:** Slow database queries
- **Solution:** Run `ANALYZE` on PostgreSQL: `psql $DATABASE_URL -c "ANALYZE;"`
- **Check:** Database indexes are created (run `npm run db:migrate` to ensure)

---

## Security Checklist

- [ ] `JWT_SECRET` is randomly generated (32+ characters)
- [ ] Database user has minimal permissions (not superuser)
- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is enabled (for public deploys)
- [ ] CORS is configured (`CORS_ORIGIN` not set to `*` in production)
- [ ] Rate limiting is enabled (default: 100 req/min per IP)
- [ ] Database connection uses SSL (`?sslmode=require` in `DATABASE_URL`)
- [ ] Logs don't expose secrets (check `LOG_LEVEL=info`, not `debug`)

---

## Scaling

**Horizontal scaling (multiple app instances):**
- Use Redis for session storage (already configured)
- Ensure WebSocket sticky sessions via load balancer
- Database connection pooling is already enabled (pg pool)

**Vertical scaling (single instance):**
- Increase `MAX_AGENTS` gradually (monitor memory)
- Increase database max connections if needed
- Use PostgreSQL read replicas for spectator queries (optional)

**Agent sharding (future):**
- Split agents across multiple instances
- Use Redis pub/sub for cross-instance events
- Database partitioning by room or agent ID

---

## Backup & Restore

**Backup PostgreSQL:**
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

**Restore:**
```bash
psql $DATABASE_URL < backup-20260223.sql
```

**Automated backups (cron):**
```bash
# Daily at 2am
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/hotel-$(date +\%Y\%m\%d).sql.gz
```

---

## Support

- **GitHub Issues:** https://github.com/DILOmcfly/openclaw-hotel/issues
- **Docs:** See README.md for feature overview
- **Logs:** Check `docker-compose logs` or PM2 logs for errors
