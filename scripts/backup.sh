#!/bin/bash

# OpenClaw Hotel Database Backup Script
# Automated PostgreSQL backup with compression and rotation

set -e  # Exit on error

# Configuration
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
BACKUP_FILE="backup-${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
RETENTION_DAYS=7
LOG_FILE="${BACKUP_DIR}/backup.log"

# Load environment variables from .env if it exists
if [ -f "$(dirname "$0")/../.env" ]; then
    export $(cat "$(dirname "$0")/../.env" | grep -v '^#' | grep -v '^$' | xargs)
fi

# Default database connection from environment or fallback
DB_URL="${DATABASE_URL:-postgres://openclaw:openclaw@localhost:5432/openclaw_hotel}"

# Parse DATABASE_URL (format: postgres://user:password@host:port/database)
if [[ $DB_URL =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
    PGUSER="${BASH_REMATCH[1]}"
    PGPASSWORD="${BASH_REMATCH[2]}"
    PGHOST="${BASH_REMATCH[3]}"
    PGPORT="${BASH_REMATCH[4]}"
    PGDATABASE="${BASH_REMATCH[5]}"
else
    echo "ERROR: Invalid DATABASE_URL format" | tee -a "$LOG_FILE"
    exit 1
fi

# Export for pg_dump
export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Log start
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup: $BACKUP_FILE" | tee -a "$LOG_FILE"

# Perform backup with compression
if pg_dump --clean --if-exists --create --format=plain "$PGDATABASE" | gzip > "$BACKUP_PATH"; then
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Backup successful: $BACKUP_FILE ($BACKUP_SIZE)" | tee -a "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ Backup failed!" | tee -a "$LOG_FILE"
    exit 1
fi

# Rotate old backups (keep last 7 days)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rotating old backups (keeping last $RETENTION_DAYS days)..." | tee -a "$LOG_FILE"
find "$BACKUP_DIR" -name "backup-*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup-*.sql.gz" -type f | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Total backups retained: $BACKUP_COUNT" | tee -a "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed successfully" | tee -a "$LOG_FILE"
