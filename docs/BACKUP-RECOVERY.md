# Database Backup & Recovery Guide

This guide covers automated and manual database backup procedures, restoration, and disaster recovery for OpenClaw Hotel.

## Table of Contents

- [Quick Start](#quick-start)
- [Manual Backup](#manual-backup)
- [Automated Daily Backups (Cron)](#automated-daily-backups-cron)
- [Restore from Backup](#restore-from-backup)
- [Remote Backup with Backblaze B2](#remote-backup-with-backblaze-b2)
- [Disaster Recovery Checklist](#disaster-recovery-checklist)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- PostgreSQL client tools (`pg_dump`, `psql`) installed
- Database credentials configured in `.env` file
- Bash shell (Linux/macOS)

### Files Overview

- `scripts/backup.sh` - Creates compressed database backup
- `scripts/restore.sh` - Restores database from backup
- `backups/` - Storage directory for backup files
- `backups/backup.log` - Backup operation logs

---

## Manual Backup

### Run a Manual Backup

```bash
cd /path/to/openclaw-hotel
chmod +x scripts/backup.sh
./scripts/backup.sh
```

**What it does:**
1. Connects to PostgreSQL using credentials from `.env`
2. Creates a full database dump with `pg_dump`
3. Compresses with gzip (typically 10-20x compression)
4. Saves as `backups/backup-YYYY-MM-DD-HHMMSS.sql.gz`
5. Rotates old backups (keeps last 7 days)
6. Logs results to `backups/backup.log`

**Output Example:**
```
[2025-02-16 09:30:15] Starting backup: backup-2025-02-16-093015.sql.gz
[2025-02-16 09:30:18] ✓ Backup successful: backup-2025-02-16-093015.sql.gz (2.3M)
[2025-02-16 09:30:18] Rotating old backups (keeping last 7 days)...
[2025-02-16 09:30:18] Total backups retained: 5
[2025-02-16 09:30:18] Backup completed successfully
```

### Verify Backup

```bash
# List all backups with sizes
ls -lh backups/backup-*.sql.gz

# Check backup log
tail -20 backups/backup.log

# Test backup integrity (decompress without restoring)
gunzip -t backups/backup-2025-02-16-093015.sql.gz
```

---

## Automated Daily Backups (Cron)

### Setup Daily Backup at 2 AM

**1. Make script executable:**
```bash
chmod +x /path/to/openclaw-hotel/scripts/backup.sh
```

**2. Edit crontab:**
```bash
crontab -e
```

**3. Add this line:**
```cron
0 2 * * * cd /path/to/openclaw-hotel && ./scripts/backup.sh >> backups/cron.log 2>&1
```

**Alternative schedules:**
- Every 6 hours: `0 */6 * * *`
- Every day at 3 AM: `0 3 * * *`
- Twice daily (2 AM, 2 PM): `0 2,14 * * *`

### Verify Cron Setup

```bash
# List active cron jobs
crontab -l

# Monitor cron execution
tail -f backups/cron.log
```

### Email Notifications (Optional)

Add email notification to cron:
```cron
MAILTO=your-email@example.com
0 2 * * * cd /path/to/openclaw-hotel && ./scripts/backup.sh
```

---

## Restore from Backup

### List Available Backups

```bash
cd /path/to/openclaw-hotel
./scripts/restore.sh
```

This will show all available backups with timestamps and sizes.

### Restore Database

```bash
chmod +x scripts/restore.sh
./scripts/restore.sh backup-2025-02-16-093015.sql.gz
```

**Safety Confirmations:**

The script requires **two confirmations**:

1. **First prompt:** Type `yes` to confirm you want to restore
2. **Second prompt:** Type the exact database name (e.g., `openclaw_hotel`)

**Example session:**
```
╔════════════════════════════════════════════════════════════╗
║          OpenClaw Hotel Database Restore                   ║
╚════════════════════════════════════════════════════════════╝

Backup file: backup-2025-02-16-093015.sql.gz
Database:    openclaw_hotel
Host:        localhost:5432
Size:        2.3M

⚠️  WARNING: This will COMPLETELY REPLACE the current database!
⚠️  All existing data will be LOST and replaced with the backup.

Are you sure you want to restore? (type 'yes' to confirm): yes

Last chance! Type the database name 'openclaw_hotel' to proceed: openclaw_hotel

Decompressing and restoring database...
✓ Database restored successfully from backup-2025-02-16-093015.sql.gz
```

### Restore to Different Database

To restore to a different database name:

```bash
export DATABASE_URL="postgres://user:password@localhost:5432/different_db"
./scripts/restore.sh backup-2025-02-16-093015.sql.gz
```

---

## Remote Backup with Backblaze B2

### Why Remote Backups?

- **Disaster Recovery:** Protect against server failure, data center issues
- **Geographic Redundancy:** Off-site storage
- **Cost-Effective:** Backblaze B2 is ~$5/TB/month (cheaper than S3)

### Setup Backblaze B2

**1. Create Backblaze B2 Account**
- Sign up at [backblaze.com/b2](https://www.backblaze.com/b2)
- Create a bucket (e.g., `openclaw-hotel-backups`)
- Generate application key

**2. Install B2 CLI**
```bash
# macOS
brew install b2-tools

# Linux
pip install b2

# Verify installation
b2 version
```

**3. Authorize B2 CLI**
```bash
b2 authorize-account <applicationKeyId> <applicationKey>
```

**4. Create Upload Script**

Create `scripts/backup-remote.sh`:
```bash
#!/bin/bash
set -e

# Run local backup
./scripts/backup.sh

# Get latest backup file
LATEST_BACKUP=$(ls -t backups/backup-*.sql.gz | head -1)

# Upload to B2
b2 upload-file \
  --noProgress \
  openclaw-hotel-backups \
  "$LATEST_BACKUP" \
  "backups/$(basename "$LATEST_BACKUP")"

echo "✓ Remote backup uploaded: $(basename "$LATEST_BACKUP")"
```

Make it executable:
```bash
chmod +x scripts/backup-remote.sh
```

**5. Automate Remote Backups**

Add to crontab for daily remote backup at 3 AM:
```cron
0 3 * * * cd /path/to/openclaw-hotel && ./scripts/backup-remote.sh >> backups/cron.log 2>&1
```

### Restore from Remote Backup

**1. List remote backups:**
```bash
b2 ls openclaw-hotel-backups
```

**2. Download backup:**
```bash
b2 download-file-by-name \
  openclaw-hotel-backups \
  backups/backup-2025-02-16-093015.sql.gz \
  backups/backup-2025-02-16-093015.sql.gz
```

**3. Restore locally:**
```bash
./scripts/restore.sh backup-2025-02-16-093015.sql.gz
```

---

## Disaster Recovery Checklist

### Scenario: Complete Server Loss

**Prerequisites:**
- [ ] Remote backups configured (Backblaze B2 or similar)
- [ ] Latest backup verified and accessible
- [ ] Database credentials documented securely
- [ ] `.env.example` file in repository for reference

### Recovery Steps

**1. Provision New Server**
```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y postgresql-client git nodejs npm

# Clone repository
git clone <your-repo-url> openclaw-hotel
cd openclaw-hotel
```

**2. Setup Environment**
```bash
# Copy and configure environment
cp .env.example .env
nano .env  # Update DATABASE_URL and other credentials
```

**3. Install PostgreSQL**
```bash
# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql << EOF
CREATE USER openclaw WITH PASSWORD 'your-secure-password';
CREATE DATABASE openclaw_hotel OWNER openclaw;
GRANT ALL PRIVILEGES ON DATABASE openclaw_hotel TO openclaw;
EOF
```

**4. Download and Restore Backup**
```bash
# Authorize B2 CLI
b2 authorize-account <keyId> <key>

# Download latest backup
LATEST=$(b2 ls openclaw-hotel-backups | tail -1)
b2 download-file-by-name openclaw-hotel-backups "$LATEST" backups/"$LATEST"

# Restore database
chmod +x scripts/restore.sh
./scripts/restore.sh "$LATEST"
```

**5. Start Application**
```bash
# Install dependencies
npm install

# Build application
npm run build

# Start server
npm start
```

**6. Verify Recovery**
- [ ] Application accessible
- [ ] User authentication working
- [ ] Data integrity check (spot-check records)
- [ ] Test critical features (rooms, chat, furniture)

### Scenario: Corrupted Database

**1. Stop application:**
```bash
# Docker
docker-compose down

# PM2
pm2 stop openclaw-hotel

# systemd
sudo systemctl stop openclaw-hotel
```

**2. Create emergency backup of current state (optional):**
```bash
./scripts/backup.sh  # Even if corrupted, for forensics
```

**3. Restore from last known good backup:**
```bash
ls -lt backups/backup-*.sql.gz  # Find last good backup
./scripts/restore.sh backup-2025-02-15-020000.sql.gz
```

**4. Restart application:**
```bash
docker-compose up -d
# or
pm2 start openclaw-hotel
```

### Scenario: Accidental Data Deletion

**1. Identify affected timeframe**
- When was the data deleted?
- Find backup from just before deletion

**2. Export only needed data (advanced)**
```bash
# Decompress backup without restoring
gunzip -c backups/backup-2025-02-16-020000.sql.gz > /tmp/restore.sql

# Extract specific table (example: users table)
grep -A 1000 "COPY public.users" /tmp/restore.sql > /tmp/users_data.sql

# Manually inspect and restore selective data
```

**3. Full restore if needed:**
```bash
./scripts/restore.sh backup-2025-02-16-020000.sql.gz
```

---

## Troubleshooting

### Backup Script Fails

**Error: `pg_dump: command not found`**
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Verify
which pg_dump
```

**Error: `connection refused`**
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify `.env` DATABASE_URL is correct
- Check firewall/network access

**Error: `permission denied`**
```bash
# Make scripts executable
chmod +x scripts/backup.sh scripts/restore.sh
```

### Restore Script Fails

**Error: `database already exists`**

The backup includes `DROP DATABASE IF EXISTS` and `CREATE DATABASE`. Ensure:
- You're connected to the `postgres` database (not the target database)
- User has `CREATEDB` privilege

Grant privileges if needed:
```sql
ALTER USER openclaw CREATEDB;
```

**Error: `role does not exist`**

Create the database user first:
```bash
sudo -u postgres createuser openclaw
```

### Cron Job Not Running

**Check cron logs:**
```bash
# Ubuntu/Debian
grep CRON /var/log/syslog

# macOS
log show --predicate 'eventMessage contains "cron"' --last 1h
```

**Common issues:**
- Use **absolute paths** in cron jobs
- Ensure `.env` file is readable by cron user
- Check cron user has execute permissions on scripts

**Test cron manually:**
```bash
# Run as cron would (no environment)
env -i /bin/bash -c "cd /path/to/openclaw-hotel && ./scripts/backup.sh"
```

### Backup Files Too Large

**Enable better compression:**

Edit `scripts/backup.sh`, change gzip to:
```bash
pg_dump ... | gzip -9 > "$BACKUP_PATH"  # Maximum compression
```

**Exclude large tables (if needed):**
```bash
pg_dump --exclude-table=sessions --exclude-table=logs ...
```

### B2 Upload Fails

**Error: `command not found: b2`**
```bash
# Install B2 CLI
pip install b2
# or
brew install b2-tools
```

**Error: `unauthorized`**
```bash
# Re-authorize
b2 authorize-account <keyId> <key>

# Check authorization
b2 get-account-info
```

---

## Backup Best Practices

1. **3-2-1 Rule:**
   - **3** copies of data (original + 2 backups)
   - **2** different storage types (local disk + cloud)
   - **1** off-site backup (Backblaze B2)

2. **Test Restores Regularly:**
   - Monthly: Restore to test database and verify
   - Document restoration time (RTO)

3. **Monitor Backup Success:**
   - Check `backups/backup.log` daily
   - Set up alerts for failed backups
   - Verify backup file sizes are reasonable

4. **Secure Backups:**
   - Backups contain sensitive data (passwords, emails, etc.)
   - Encrypt remote backups if possible
   - Restrict filesystem permissions: `chmod 600 backups/*.sql.gz`

5. **Document Recovery Procedures:**
   - Keep this guide updated
   - Document any custom recovery steps
   - Test disaster recovery plan quarterly

---

## Quick Reference Commands

```bash
# Manual backup
./scripts/backup.sh

# List backups
ls -lh backups/backup-*.sql.gz

# Restore database
./scripts/restore.sh backup-YYYY-MM-DD-HHMMSS.sql.gz

# View backup log
tail -f backups/backup.log

# Test backup integrity
gunzip -t backups/backup-*.sql.gz

# Upload to B2
b2 upload-file openclaw-hotel-backups backups/backup-*.sql.gz backups/filename.sql.gz

# Download from B2
b2 download-file-by-name openclaw-hotel-backups backups/filename.sql.gz backups/filename.sql.gz
```

---

## Support

For issues or questions:
- Check `backups/backup.log` for error details
- Review [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- Open an issue in the project repository

---

**Last Updated:** 2025-02-16  
**Maintained by:** DevOps Team
