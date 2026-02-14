# Secrets Management Guide

Proper secrets management is critical for security. Never commit sensitive credentials to version control.

## Environment Variables

### Required Production Secrets

| Variable | Purpose | How to Generate |
|----------|---------|-----------------|
| `JWT_SECRET` | Sign authentication tokens | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | Database password | `openssl rand -base64 24 \| tr -d "=+/" \| cut -c1-20` |
| `REDIS_PASSWORD` | Redis password (optional) | `openssl rand -base64 24 \| tr -d "=+/" \| cut -c1-20` |

### Generate All Secrets

```bash
# Quick command to generate all secrets
cat << EOF

# Production secrets (generated $(date))
JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)

EOF
```

Copy the output to your `.env` file and keep it secure.

---

## Storage Methods

### 1. Local Development

**File:** `.env` (gitignored)

```bash
cp .env.example .env
nano .env  # Edit with real values
```

**Never commit `.env` to git!**

### 2. Production Server

**Option A: Environment file**

```bash
# Store in secure location
sudo nano /opt/openclaw-hotel/.env
sudo chmod 600 /opt/openclaw-hotel/.env
sudo chown root:root /opt/openclaw-hotel/.env
```

**Option B: Docker secrets**

```bash
# Create secrets
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-db-password" | docker secret create db_password -

# Update docker-compose.yml
secrets:
  jwt_secret:
    external: true
  db_password:
    external: true

services:
  backend:
    secrets:
      - jwt_secret
      - db_password
```

**Option C: Environment variables in systemd**

```ini
# /etc/systemd/system/openclaw-hotel.service
[Service]
Environment="JWT_SECRET=your-secret"
Environment="POSTGRES_PASSWORD=your-password"
```

### 3. Cloud Providers

**AWS Secrets Manager**

```bash
aws secretsmanager create-secret \
  --name openclaw-hotel/jwt-secret \
  --secret-string "your-secret-value"

# Retrieve in application
aws secretsmanager get-secret-value \
  --secret-id openclaw-hotel/jwt-secret \
  --query SecretString --output text
```

**Google Cloud Secret Manager**

```bash
echo -n "your-secret" | gcloud secrets create jwt-secret --data-file=-

# Access in application
gcloud secrets versions access latest --secret="jwt-secret"
```

**Azure Key Vault**

```bash
az keyvault secret set \
  --vault-name openclaw-vault \
  --name jwt-secret \
  --value "your-secret"
```

---

## GitHub Actions Secrets

For CI/CD pipelines, store secrets in GitHub repository settings.

### Setup

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each secret:

| Name | Description |
|------|-------------|
| `SSH_PRIVATE_KEY` | Private key for server access |
| `SERVER_HOST` | Production server IP/hostname |
| `SERVER_USER` | SSH username |
| `JWT_SECRET` | JWT signing secret |
| `POSTGRES_PASSWORD` | Database password |

### Usage in Workflow

```yaml
- name: Deploy
  env:
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    DB_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
  run: |
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    echo "POSTGRES_PASSWORD=$DB_PASSWORD" >> .env
```

---

## Security Best Practices

### 1. Rotation Policy

Rotate secrets regularly:
- **JWT_SECRET**: Every 90 days
- **Database passwords**: Every 180 days
- **API keys**: When team members leave

### 2. Access Control

Limit who can access secrets:
```bash
# Server-side
sudo chown root:docker /opt/openclaw-hotel/.env
sudo chmod 640 /opt/openclaw-hotel/.env
```

### 3. Audit Logging

Track secret access:
```bash
# AWS CloudTrail
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=openclaw-hotel/jwt-secret

# Linux audit
sudo auditctl -w /opt/openclaw-hotel/.env -p war -k secret-access
```

### 4. Never Log Secrets

```javascript
// ❌ BAD
console.log('JWT secret:', process.env.JWT_SECRET);

// ✅ GOOD
console.log('JWT secret: [REDACTED]');
```

### 5. Encryption at Rest

Encrypt `.env` file:
```bash
# Encrypt
gpg --symmetric --cipher-algo AES256 .env

# Decrypt when needed
gpg --decrypt .env.gpg > .env
```

---

## Secrets Checklist

Before deploying to production:

- [ ] All secrets use strong random values (32+ characters)
- [ ] `.env` is in `.gitignore`
- [ ] No secrets in code, comments, or commit history
- [ ] Secrets file has restrictive permissions (600 or 640)
- [ ] Secrets are backed up securely (encrypted)
- [ ] Team members know not to share secrets via chat/email
- [ ] Different secrets for development, staging, production
- [ ] Secrets rotation schedule is documented

---

## Emergency Procedures

### If Secrets Are Leaked

**Immediate Actions:**

1. **Rotate all secrets immediately**
   ```bash
   # Generate new secrets
   NEW_JWT=$(openssl rand -base64 32)
   NEW_DB_PASS=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
   
   # Update .env
   sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT/" .env
   sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_DB_PASS/" .env
   
   # Update database password
   docker compose exec postgres psql -U openclaw -c \
     "ALTER USER openclaw WITH PASSWORD '$NEW_DB_PASS';"
   
   # Restart services
   docker compose restart
   ```

2. **Invalidate all sessions**
   ```bash
   docker compose exec redis redis-cli FLUSHDB
   ```

3. **Review access logs**
   ```bash
   docker compose logs backend | grep -i "unauthorized\|failed"
   ```

4. **Notify team and affected users**

### Prevention

- Use `.gitignore` from day one
- Enable pre-commit hooks to detect secrets
- Use tools like `git-secrets` or `truffleHog`

---

## Tools

### Secret Scanning

```bash
# Install git-secrets
brew install git-secrets  # macOS
apt install git-secrets   # Linux

# Setup
git secrets --install
git secrets --register-aws
git secrets --add 'JWT_SECRET=.*'
```

### Secrets Detection

```bash
# Scan repository history
truffleHog git file://. --json

# Scan for high entropy strings
npx secretlint "**/*"
```

---

## References

- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secret_Management_Cheat_Sheet.html)
- [12 Factor App - Config](https://12factor.net/config)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
