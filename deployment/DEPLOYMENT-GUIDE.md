# OpenClaw Hotel — Production Deployment Guide

This guide covers deploying OpenClaw Hotel to a production VPS with nginx, SSL, and Docker.

## Prerequisites

- Ubuntu 22.04 LTS VPS (2GB+ RAM recommended)
- Domain name pointing to your VPS IP
- SSH access with sudo privileges
- Docker and Docker Compose installed

## Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-username/openclaw-hotel.git
cd openclaw-hotel

# 2. Configure environment
cp .env.example .env
nano .env  # Edit with production values

# 3. Run deployment script
sudo ./deployment/deploy.sh your-domain.com admin@yourdomain.com
```

---

## Manual Deployment Steps

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Install nginx
sudo apt install nginx

# Enable firewall
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. Application Setup

```bash
# Clone repository
git clone https://github.com/your-username/openclaw-hotel.git
cd openclaw-hotel

# Create production environment file
cp .env.example .env

# Edit with secure values
nano .env
```

**Critical environment variables:**

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000

# Generate strong secrets (use: openssl rand -base64 32)
JWT_SECRET=your-strong-secret-here

# Database (change default password!)
POSTGRES_DB=openclaw_hotel
POSTGRES_USER=openclaw
POSTGRES_PASSWORD=your-strong-db-password

# Database connection URL
DATABASE_URL=postgres://openclaw:your-strong-db-password@postgres:5432/openclaw_hotel

# Redis
REDIS_URL=redis://redis:6379
```

### 3. Build and Start Services

```bash
# Build and start all services
docker compose up -d

# Check service health
docker compose ps
docker compose logs -f backend

# Initialize database
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### 4. Nginx Configuration

```bash
# Copy nginx config
sudo cp deployment/nginx.conf /etc/nginx/sites-available/openclaw-hotel

# Update domain in config
sudo sed -i 's/your-domain\.com/yourdomain.com/g' /etc/nginx/sites-available/openclaw-hotel

# Create webroot for client files
sudo mkdir -p /var/www/openclaw-hotel/client

# Copy client build
sudo cp -r client/dist/* /var/www/openclaw-hotel/client/

# Enable site
sudo ln -s /etc/nginx/sites-available/openclaw-hotel /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 5. SSL Setup (Let's Encrypt)

```bash
# Run SSL setup script
sudo ./deployment/setup-ssl.sh yourdomain.com admin@yourdomain.com
```

**Manual SSL setup (if script fails):**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Update nginx config with cert paths
sudo nano /etc/nginx/sites-available/openclaw-hotel

# Reload nginx
sudo systemctl reload nginx

# Test auto-renewal
sudo certbot renew --dry-run
```

### 6. Client Build and Deploy

```bash
# Build client locally (or on server)
cd client
npm ci
npm run build

# Copy to webroot
sudo cp -r dist/* /var/www/openclaw-hotel/client/

# Set permissions
sudo chown -R www-data:www-data /var/www/openclaw-hotel/client
```

---

## Environment Variables Reference

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `JWT_SECRET` | Secret for JWT tokens | Random 32+ chars |
| `POSTGRES_DB` | Database name | `openclaw_hotel` |
| `POSTGRES_USER` | Database user | `openclaw` |
| `POSTGRES_PASSWORD` | Database password | Strong password |

### Client (Vite build-time)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:3000` |

---

## Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild backend
docker compose build backend
docker compose up -d backend

# Run migrations
docker compose exec backend npx prisma migrate deploy

# Rebuild client
cd client
npm ci
npm run build
sudo cp -r dist/* /var/www/openclaw-hotel/client/

# Restart services
docker compose restart
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check all services
docker compose ps

# View logs
docker compose logs -f

# Check specific service
docker compose logs -f backend
docker compose logs -f postgres

# Database status
docker compose exec postgres psql -U openclaw -d openclaw_hotel -c "SELECT COUNT(*) FROM users;"

# Redis status
docker compose exec redis redis-cli ping
```

### Backups

```bash
# Backup database
docker compose exec postgres pg_dump -U openclaw openclaw_hotel > backup_$(date +%Y%m%d).sql

# Restore database
docker compose exec -T postgres psql -U openclaw openclaw_hotel < backup_20260214.sql

# Backup volumes
docker run --rm \
  -v openclaw-hotel_postgres_data:/data \
  -v $(pwd):/backup \
  ubuntu tar czf /backup/postgres_backup_$(date +%Y%m%d).tar.gz /data
```

### Log Rotation

```bash
# Configure Docker log limits
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
```

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker compose logs backend

# Check database connection
docker compose exec backend node -e "console.log(process.env.DATABASE_URL)"

# Restart services
docker compose restart
```

### Database connection issues

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check database exists
docker compose exec postgres psql -U openclaw -l

# Reset database (DESTRUCTIVE!)
docker compose down -v
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

### SSL certificate issues

```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Check nginx config
sudo nginx -t
```

### High memory usage

```bash
# Check container stats
docker stats

# Restart specific service
docker compose restart backend

# Prune unused resources
docker system prune -a
```

---

## Security Hardening

### 1. Change default passwords

Never use default credentials in production:
- PostgreSQL password
- Redis password (add authentication)
- JWT secret (use strong random value)

### 2. Firewall configuration

```bash
# Only allow necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH (consider changing default port)
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 3. SSH hardening

```bash
sudo nano /etc/ssh/sshd_config
```

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
sudo systemctl restart sshd
```

### 4. Add fail2ban

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 5. Regular updates

```bash
# Set up unattended upgrades
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Performance Optimization

### 1. Database indexing

Already configured in Prisma schema. Run:

```bash
docker compose exec backend npx prisma migrate deploy
```

### 2. Redis caching

Configured in `src/cache/RedisCache.ts`. Adjust TTL values if needed.

### 3. Nginx tuning

```nginx
# /etc/nginx/nginx.conf
worker_processes auto;
worker_connections 4096;

# Enable HTTP/2
listen 443 ssl http2;

# Optimize buffers
client_body_buffer_size 128k;
client_max_body_size 10m;
```

### 4. Database connection pooling

Configured in `src/db/DatabaseService.ts`:

```typescript
pool: {
  min: 2,
  max: 10
}
```

---

## Scaling Considerations

### Horizontal Scaling

To run multiple backend instances:

1. Use external PostgreSQL/Redis (not in docker-compose)
2. Add load balancer (nginx upstream, HAProxy, or cloud LB)
3. Share session data via Redis
4. Use sticky sessions for WebSocket connections

### Vertical Scaling

Adjust Docker resource limits:

```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 512M
```

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-username/openclaw-hotel/issues
- Documentation: `/docs/`
- Logs: `docker compose logs -f`
