#!/bin/bash

# OpenClaw Hotel Database Restore Script
# Restore PostgreSQL database from compressed backup

set -e  # Exit on error

# Configuration
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Check if backup file argument is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup-filename>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/backup-*.sql.gz 2>/dev/null || echo "  No backups found in $BACKUP_DIR"
    exit 1
fi

BACKUP_FILE="$1"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Check if backup file exists
if [ ! -f "$BACKUP_PATH" ]; then
    echo "ERROR: Backup file not found: $BACKUP_PATH"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/backup-*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

# Load environment variables from .env if it exists
if [ -f "$(dirname "$0")/../.env" ]; then
    export $(cat "$(dirname "$0")/../.env" | grep -v '^#' | grep -v '^$' | xargs)
fi

# Default database connection from environment or fallback
DB_URL="${DATABASE_URL:-postgres://openclaw:openclaw@localhost:5432/openclaw_hotel}"

# Parse DATABASE_URL
if [[ $DB_URL =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
    PGUSER="${BASH_REMATCH[1]}"
    PGPASSWORD="${BASH_REMATCH[2]}"
    PGHOST="${BASH_REMATCH[3]}"
    PGPORT="${BASH_REMATCH[4]}"
    PGDATABASE="${BASH_REMATCH[5]}"
else
    echo "ERROR: Invalid DATABASE_URL format"
    exit 1
fi

# Export for psql
export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE

# Display backup information
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          OpenClaw Hotel Database Restore                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "Database:    $PGDATABASE"
echo "Host:        $PGHOST:$PGPORT"
echo "Size:        $(du -h "$BACKUP_PATH" | cut -f1)"
echo ""

# Safety confirmation
echo "⚠️  WARNING: This will COMPLETELY REPLACE the current database!"
echo "⚠️  All existing data will be LOST and replaced with the backup."
echo ""
read -p "Are you sure you want to restore? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Second confirmation
echo ""
read -p "Last chance! Type the database name '$PGDATABASE' to proceed: " CONFIRM_DB

if [ "$CONFIRM_DB" != "$PGDATABASE" ]; then
    echo "Database name mismatch. Restore cancelled."
    exit 0
fi

# Log start
echo "" | tee -a "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting restore from: $BACKUP_FILE" | tee -a "$LOG_FILE"

# Perform restore
echo ""
echo "Decompressing and restoring database..."
if gunzip -c "$BACKUP_PATH" | psql -d postgres; then
    echo "" | tee -a "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Restore successful!" | tee -a "$LOG_FILE"
    echo ""
    echo "✓ Database restored successfully from $BACKUP_FILE"
else
    echo "" | tee -a "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ Restore failed!" | tee -a "$LOG_FILE"
    echo ""
    echo "✗ Restore failed! Check the log file: $LOG_FILE"
    exit 1
fi
