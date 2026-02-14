# Pre-Deployment Checklist

Use this checklist before deploying OpenClaw Hotel to production.

## Infrastructure

- [ ] VPS/server provisioned (minimum 2GB RAM, 2 CPU cores)
- [ ] Domain name registered and DNS configured
- [ ] A/AAAA records pointing to server IP
- [ ] SSH access configured with key-based authentication
- [ ] Root/sudo access available
- [ ] Firewall rules planned (ports 22, 80, 443)

## Dependencies

- [ ] Docker installed (`docker --version`)
- [ ] Docker Compose installed (`docker compose version`)
- [ ] Nginx installed (`nginx -v`)
- [ ] Git installed (`git --version`)
- [ ] Certbot installed for SSL (`certbot --version`)

## Repository

- [ ] Code pushed to main branch
- [ ] All tests passing (`npm test`)
- [ ] Client builds successfully (`cd client && npm run build`)
- [ ] Backend compiles (`npx tsc`)
- [ ] No sensitive data in commit history
- [ ] `.env.example` up to date with all required variables

## Configuration

- [ ] `.env` file created from `.env.example`
- [ ] `NODE_ENV=production` set
- [ ] Strong `JWT_SECRET` generated (32+ characters)
- [ ] Secure `POSTGRES_PASSWORD` set (not default!)
- [ ] `DATABASE_URL` matches PostgreSQL credentials
- [ ] Domain name configured in nginx config
- [ ] Client `VITE_API_URL` points to production domain

## Security

- [ ] All default passwords changed
- [ ] Secrets not committed to git
- [ ] `.env` in `.gitignore`
- [ ] File permissions restrictive (`chmod 600 .env`)
- [ ] SSH password authentication disabled (key-only)
- [ ] Firewall configured (UFW or iptables)
- [ ] fail2ban installed (optional but recommended)
- [ ] Rate limiting configured in nginx

## Database

- [ ] PostgreSQL container healthy (`docker compose ps postgres`)
- [ ] Database created (`openclaw_hotel`)
- [ ] Migrations applied (`npx prisma migrate deploy`)
- [ ] Initial seed data loaded (`npx prisma db seed`)
- [ ] Backup strategy planned

## SSL/TLS

- [ ] Let's Encrypt email configured
- [ ] Certbot installed and tested
- [ ] SSL certificates obtained
- [ ] Auto-renewal scheduled (cron or systemd timer)
- [ ] HTTPS redirect configured in nginx
- [ ] SSL configuration tested (SSL Labs A+ rating)

## Performance

- [ ] Gzip compression enabled in nginx
- [ ] Static asset caching configured
- [ ] Database connection pooling configured
- [ ] Redis cache working (`docker compose ps redis`)
- [ ] Resource limits set in docker-compose.yml (optional)

## Monitoring

- [ ] Health check endpoint working (`/health`)
- [ ] Application logs accessible (`docker compose logs`)
- [ ] Error logging configured
- [ ] Uptime monitoring planned (UptimeRobot, Pingdom, etc.)
- [ ] Disk space monitoring (alert at 80%)

## Testing

### Local Testing (before deployment)

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Client builds without errors
- [ ] WebSocket connections work
- [ ] User registration/login works
- [ ] Room joining works
- [ ] Chat messages send/receive
- [ ] Furniture placement works
- [ ] Admin dashboard accessible

### Post-Deployment Testing

- [ ] HTTPS works (no certificate warnings)
- [ ] HTTP redirects to HTTPS
- [ ] WebSocket connects over WSS
- [ ] Create test account via API
- [ ] Login to game client
- [ ] Join a room
- [ ] Send chat messages
- [ ] Place furniture item
- [ ] Test on mobile device
- [ ] Admin panel accessible

## Backup & Recovery

- [ ] Database backup script created
- [ ] Backup location configured (local or cloud)
- [ ] Backup schedule automated (cron)
- [ ] Restore procedure tested
- [ ] Docker volumes backed up
- [ ] `.env` file backed up securely

## Documentation

- [ ] README.md updated with production info
- [ ] Deployment guide reviewed
- [ ] Architecture documented
- [ ] API endpoints documented
- [ ] Admin procedures documented
- [ ] Troubleshooting guide available

## Legal & Compliance

- [ ] Privacy policy added (if collecting user data)
- [ ] Terms of service defined
- [ ] GDPR compliance reviewed (if serving EU users)
- [ ] Cookie consent implemented (if needed)
- [ ] Rate limiting to prevent abuse

## Team Readiness

- [ ] Team knows how to access logs
- [ ] Team knows how to restart services
- [ ] Team knows emergency contact procedures
- [ ] Secrets shared securely (not via email/chat)
- [ ] Deployment runbook reviewed
- [ ] Rollback procedure documented

## Launch Plan

- [ ] Deployment time scheduled (low-traffic hours)
- [ ] Announcement prepared (users, social media)
- [ ] Support channels ready (email, Discord, etc.)
- [ ] Monitoring dashboard ready
- [ ] Team available for first 24 hours
- [ ] Rollback plan ready if issues occur

## Post-Launch

### First Hour

- [ ] Monitor error logs continuously
- [ ] Check WebSocket connections count
- [ ] Verify database queries responding
- [ ] Test user registration
- [ ] Test game flow

### First Day

- [ ] Review all error logs
- [ ] Check server resource usage (CPU, RAM, disk)
- [ ] Verify SSL certificate working
- [ ] Monitor user feedback
- [ ] Database backup completed successfully

### First Week

- [ ] Performance metrics reviewed
- [ ] User feedback analyzed
- [ ] Optimization opportunities identified
- [ ] Backup restoration tested
- [ ] Security scan performed

---

## Deployment Commands

### Quick Deploy
```bash
sudo ./deployment/deploy.sh your-domain.com admin@yourdomain.com
```

### Manual Deploy
```bash
# 1. Clone repository
git clone https://github.com/your-username/openclaw-hotel.git /opt/openclaw-hotel
cd /opt/openclaw-hotel

# 2. Configure environment
cp .env.example .env
nano .env

# 3. Start services
docker compose up -d

# 4. Setup nginx
sudo cp deployment/nginx.conf /etc/nginx/sites-available/openclaw-hotel
sudo ln -s /etc/nginx/sites-available/openclaw-hotel /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. Setup SSL
sudo ./deployment/setup-ssl.sh your-domain.com

# 6. Build and deploy client
cd client
npm ci && npm run build
sudo cp -r dist/* /var/www/openclaw-hotel/client/
```

---

## Emergency Rollback

If something goes wrong:

```bash
# Stop services
docker compose down

# Restore previous version
git checkout <previous-commit>

# Restore database backup
docker compose exec -T postgres psql -U openclaw openclaw_hotel < backup.sql

# Restart
docker compose up -d
```

---

## Success Criteria

Deployment is successful when:

✅ HTTPS site loads with valid certificate  
✅ Users can register and login  
✅ WebSocket connections stay alive  
✅ Chat messages send/receive instantly  
✅ Rooms load and render correctly  
✅ Furniture placement works  
✅ No errors in logs during normal usage  
✅ Server resource usage is normal (<80% CPU/RAM)  
✅ Database queries respond in <100ms  
✅ Mobile clients work properly  

---

## Support Contacts

**Technical Issues:**
- GitHub Issues: https://github.com/your-username/openclaw-hotel/issues
- Email: admin@yourdomain.com

**Security Issues:**
- Email: security@yourdomain.com
- Encrypt with GPG key if available

**Urgent Issues:**
- On-call phone: [Your number]
- Team Slack/Discord: [Your channel]

---

*Last updated: 2026-02-14*
