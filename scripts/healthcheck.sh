#!/bin/sh
# Health check script for OpenClaw Hotel
# Checks /health and /ready endpoints and exits with appropriate code

HOST="${HOST:-localhost}"
PORT="${PORT:-3000}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo "[$TIMESTAMP] $1"
}

# Check /health endpoint
log "Checking /health endpoint..."
HEALTH_CODE=$(wget --no-verbose --tries=1 --spider --server-response "http://${HOST}:${PORT}/health" 2>&1 | grep "HTTP/" | awk '{print $2}' | head -n 1)

if [ "$HEALTH_CODE" = "200" ]; then
  log "${GREEN}✓ Health endpoint: OK (200)${NC}"
  HEALTH_OK=1
else
  log "${RED}✗ Health endpoint: FAIL (${HEALTH_CODE:-no response})${NC}"
  HEALTH_OK=0
fi

# Check /ready endpoint
log "Checking /ready endpoint..."
READY_CODE=$(wget --no-verbose --tries=1 --spider --server-response "http://${HOST}:${PORT}/ready" 2>&1 | grep "HTTP/" | awk '{print $2}' | head -n 1)

if [ "$READY_CODE" = "200" ]; then
  log "${GREEN}✓ Ready endpoint: OK (200)${NC}"
  READY_OK=1
else
  log "${YELLOW}⚠ Ready endpoint: NOT READY (${READY_CODE:-no response})${NC}"
  READY_OK=0
fi

# Exit with appropriate code
if [ $HEALTH_OK -eq 1 ] && [ $READY_OK -eq 1 ]; then
  log "${GREEN}✓ All checks passed${NC}"
  exit 0
elif [ $HEALTH_OK -eq 1 ]; then
  log "${YELLOW}⚠ Service is alive but not ready${NC}"
  exit 1
else
  log "${RED}✗ Service is unhealthy${NC}"
  exit 2
fi
