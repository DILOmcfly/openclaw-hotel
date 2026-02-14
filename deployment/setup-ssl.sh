#!/bin/bash
# OpenClaw Hotel - SSL Setup Script
# Run this on your VPS after initial deployment

set -e

# Configuration
DOMAIN="${1:-your-domain.com}"
EMAIL="${2:-admin@$DOMAIN}"
WEBROOT="/var/www/certbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}OpenClaw Hotel - SSL Setup${NC}"
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

# Check if domain was provided
if [ "$DOMAIN" = "your-domain.com" ]; then
    echo -e "${RED}Error: Please provide your domain name${NC}"
    echo "Usage: $0 <domain> [email]"
    echo "Example: $0 openclaw.example.com admin@example.com"
    exit 1
fi

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Installing certbot...${NC}"
    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        yum install -y certbot python3-certbot-nginx
    else
        echo -e "${RED}Error: Unsupported OS. Please install certbot manually.${NC}"
        exit 1
    fi
fi

# Create webroot directory for ACME challenge
mkdir -p "$WEBROOT"

# Stop nginx temporarily
echo -e "${YELLOW}Stopping nginx...${NC}"
systemctl stop nginx || true

# Obtain certificate
echo -e "${YELLOW}Obtaining SSL certificate from Let's Encrypt...${NC}"
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$DOMAIN,www.$DOMAIN" \
    --preferred-challenges http

# Update nginx config with actual domain
NGINX_CONF="/etc/nginx/sites-available/openclaw-hotel"
if [ -f "$NGINX_CONF" ]; then
    echo -e "${YELLOW}Updating nginx configuration with domain...${NC}"
    sed -i "s/your-domain\.com/$DOMAIN/g" "$NGINX_CONF"
fi

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
nginx -t

# Start nginx
echo -e "${YELLOW}Starting nginx...${NC}"
systemctl start nginx
systemctl enable nginx

# Setup auto-renewal
echo -e "${YELLOW}Setting up auto-renewal...${NC}"
CRON_CMD="0 0,12 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'"
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
fi

# Test renewal process
echo -e "${YELLOW}Testing certificate renewal (dry run)...${NC}"
certbot renew --dry-run

echo ""
echo -e "${GREEN}✓ SSL setup complete!${NC}"
echo ""
echo "Certificate details:"
certbot certificates | grep -A 10 "$DOMAIN"
echo ""
echo -e "${GREEN}Your site is now accessible at:${NC}"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo -e "${YELLOW}Certificate auto-renewal is scheduled via cron.${NC}"
echo "Certificates will renew automatically 30 days before expiration."
