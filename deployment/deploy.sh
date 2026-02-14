#!/bin/bash
# OpenClaw Hotel - Automated Deployment Script
# Usage: sudo ./deploy.sh <domain> [email]

set -e

# Configuration
DOMAIN="${1:-}"
EMAIL="${2:-admin@$DOMAIN}"
APP_DIR="/opt/openclaw-hotel"
WEBROOT="/var/www/openclaw-hotel"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Banner
echo -e "${BLUE}"
cat << "EOF"
   ___                   ____ _                   _   _       _       _ 
  / _ \ _ __   ___ _ __ / ___| | __ ___      __  | | | | ___ | |_ ___| |
 | | | | '_ \ / _ \ '_ \| |   | |/ _` \ \ /\ / /  | |_| |/ _ \| __/ _ \ |
 | |_| | |_) |  __/ | | | |___| | (_| |\ V  V /   |  _  | (_) | ||  __/ |
  \___/| .__/ \___|_| |_|\____|_|\__,_| \_/\_/    |_| |_|\___/ \__\___|_|
       |_|                                                                
EOF
echo -e "${NC}"
echo -e "${GREEN}Production Deployment Script${NC}"
echo ""

# Validation
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Usage: sudo $0 <domain> [email]"
    exit 1
fi

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Domain name required${NC}"
    echo "Usage: sudo $0 <domain> [email]"
    echo "Example: sudo $0 openclaw.example.com admin@example.com"
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo "  App directory: $APP_DIR"
echo ""

read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Step 1: System dependencies
echo -e "\n${YELLOW}[1/8] Installing system dependencies...${NC}"
apt update
apt install -y curl git nginx certbot python3-certbot-nginx

# Step 2: Docker installation
if ! command -v docker &> /dev/null; then
    echo -e "\n${YELLOW}[2/8] Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    systemctl enable docker
    systemctl start docker
else
    echo -e "\n${GREEN}[2/8] Docker already installed${NC}"
fi

# Step 3: Clone/update repository
echo -e "\n${YELLOW}[3/8] Setting up application...${NC}"
if [ -d "$APP_DIR" ]; then
    echo "Updating existing installation..."
    cd "$APP_DIR"
    git pull
else
    echo "Cloning repository..."
    git clone https://github.com/your-username/openclaw-hotel.git "$APP_DIR"
    cd "$APP_DIR"
fi

# Step 4: Environment configuration
echo -e "\n${YELLOW}[4/8] Configuring environment...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    
    # Generate secure secrets
    JWT_SECRET=$(openssl rand -base64 32)
    DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
    
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$DB_PASSWORD/" .env
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgres://openclaw:$DB_PASSWORD@postgres:5432/openclaw_hotel|" .env
    sed -i "s/NODE_ENV=.*/NODE_ENV=production/" .env
    
    echo -e "${GREEN}✓ Environment configured with secure secrets${NC}"
else
    echo -e "${GREEN}✓ Environment file already exists${NC}"
fi

# Step 5: Build and start services
echo -e "\n${YELLOW}[5/8] Building and starting services...${NC}"
docker compose down || true
docker compose build
docker compose up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 10

# Run database migrations
echo "Running database migrations..."
docker compose exec -T backend npx prisma migrate deploy || true

# Seed initial data
echo "Seeding database..."
docker compose exec -T backend npx prisma db seed || true

# Step 6: Build client
echo -e "\n${YELLOW}[6/8] Building client application...${NC}"
cd client
npm ci
npm run build

# Deploy client files
mkdir -p "$WEBROOT/client"
cp -r dist/* "$WEBROOT/client/"
chown -R www-data:www-data "$WEBROOT/client"

cd "$APP_DIR"

# Step 7: Configure nginx
echo -e "\n${YELLOW}[7/8] Configuring nginx...${NC}"

# Copy and customize config
cp deployment/nginx.conf /etc/nginx/sites-available/openclaw-hotel
sed -i "s/your-domain\.com/$DOMAIN/g" /etc/nginx/sites-available/openclaw-hotel

# Enable site
ln -sf /etc/nginx/sites-available/openclaw-hotel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload nginx
systemctl reload nginx

# Step 8: SSL setup
echo -e "\n${YELLOW}[8/8] Setting up SSL...${NC}"
./deployment/setup-ssl.sh "$DOMAIN" "$EMAIL"

# Firewall setup
echo -e "\n${YELLOW}Configuring firewall...${NC}"
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Final status check
echo -e "\n${YELLOW}Checking service status...${NC}"
docker compose ps

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment Complete! 🎉${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Your OpenClaw Hotel is now live at:${NC}"
echo -e "  ${GREEN}https://$DOMAIN${NC}"
echo -e "  ${GREEN}https://www.$DOMAIN${NC}"
echo ""
echo -e "${BLUE}Admin panel:${NC}"
echo -e "  ${GREEN}https://$DOMAIN/admin${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Test the application in your browser"
echo "  2. Create an admin user via API"
echo "  3. Configure monitoring (optional)"
echo "  4. Set up backups (see DEPLOYMENT-GUIDE.md)"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:     cd $APP_DIR && docker compose logs -f"
echo "  Restart:       cd $APP_DIR && docker compose restart"
echo "  Update app:    cd $APP_DIR && git pull && docker compose up -d --build"
echo "  Database backup: docker compose exec postgres pg_dump -U openclaw openclaw_hotel > backup.sql"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  $APP_DIR/deployment/DEPLOYMENT-GUIDE.md"
echo ""
