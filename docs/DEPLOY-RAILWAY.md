# Railway Deployment Guide

This guide walks you through deploying OpenClaw Hotel to Railway.app.

## Prerequisites

- GitHub account with the openclaw-hotel repository
- Railway account (free tier available)
- Project pushed to GitHub

## Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with your GitHub account (free tier includes $5 credit/month)
3. Verify your email

## Step 2: Create New Project

1. Click **"New Project"** in Railway dashboard
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub account
4. Select the `openclaw-hotel` repository
5. Railway will automatically detect the Dockerfile

## Step 3: Add PostgreSQL Database

1. In your project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway automatically creates a PostgreSQL instance
4. The `DATABASE_URL` environment variable is automatically set

## Step 4: Add Redis

1. Click **"+ New"** again
2. Select **"Database"** → **"Add Redis"**
3. Railway automatically creates a Redis instance
4. The `REDIS_URL` environment variable is automatically set

## Step 5: Configure Environment Variables

1. Click on your main service (openclaw-hotel)
2. Go to **"Variables"** tab
3. Add the following **REQUIRED** variables:

```bash
# Required for Production
NODE_ENV=production
PORT=${{PORT}}  # Railway auto-injects this
JWT_SECRET=<generate-a-secure-random-string>

# Optional: Agent Behavior Configuration
ROOM_HOPPING_ENABLED=true
ROOM_HOPPING_INTERVAL_MS=300000
SIMULATION_ENABLED=true
SIMULATION_INTERVAL_MS=60000
SIMULATION_ACTION_PROBABILITY=0.5

# Optional: LLM-Powered Agent Conversations
AGENT_LLM_ENABLED=false
GROQ_API_KEY=<your-groq-api-key-if-enabled>
AGENT_LLM_RATE_LIMIT_MS=120000
```

**Note:** Railway automatically provides `DATABASE_URL` and `REDIS_URL` when you add those services.

### Generate JWT Secret

Use a cryptographically secure random string:

```bash
# macOS/Linux
openssl rand -base64 32

# Or Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Step 6: Deploy

1. Railway automatically triggers a deployment after you add environment variables
2. Monitor the build logs in the **"Deployments"** tab
3. Wait for the status to show **"Success"**
4. Your app will be available at `https://<your-app>.up.railway.app`

## Step 7: Health Check

1. Visit your deployment URL
2. Check `/health` endpoint: `https://<your-app>.up.railway.app/health`
3. Should return: `{"status":"ok"}`

## Step 8: Custom Domain (Optional)

1. Go to your service **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"** for a Railway subdomain
4. Or click **"Custom Domain"** to add your own domain
5. Follow the DNS configuration instructions

### DNS Configuration for Custom Domain

Add a CNAME record pointing to your Railway domain:

```
Type: CNAME
Name: hotel (or your subdomain)
Value: <your-app>.up.railway.app
TTL: 3600
```

## Troubleshooting

### Build Failures

- Check **"Deployments"** → **"Build Logs"**
- Ensure Dockerfile is valid: `docker build -t openclaw-hotel .`
- Verify all dependencies are in `package.json`

### Database Connection Errors

- Verify `DATABASE_URL` is set in environment variables
- Check PostgreSQL service is running (green status)
- Review migration logs in deployment output

### Redis Connection Errors

- Verify `REDIS_URL` is set in environment variables
- Check Redis service is running (green status)

### Port Binding Issues

- Ensure your server listens on `process.env.PORT` (Railway injects this)
- Check `src/server.ts` uses: `const port = process.env.PORT || 3000`

### Migration Failures

- Check entrypoint.sh logs in deployment output
- Manually run migrations if needed:
  ```bash
  railway run npm run migrate
  ```

## Scaling & Monitoring

### View Metrics

1. Go to your service dashboard
2. Click **"Metrics"** tab
3. Monitor CPU, Memory, Network usage

### Scaling (Pro Plan)

- Vertical scaling: Adjust resources in **"Settings"** → **"Resources"**
- Horizontal scaling: Not available in free tier

### Logs

1. Click **"Deployments"** → Select deployment
2. View real-time logs
3. Use `railway logs` CLI command for local access

## CLI Deployment (Alternative)

Install Railway CLI:

```bash
npm install -g @railway/cli
```

Deploy from terminal:

```bash
railway login
railway link  # Link to existing project
railway up    # Deploy
```

## Rollback

1. Go to **"Deployments"** tab
2. Find a previous successful deployment
3. Click **"⋯"** → **"Redeploy"**

## Cost Optimization (Free Tier)

- Free tier: $5 credit/month (~500 hours of uptime)
- Sleep after inactivity to save credits (configure in Settings)
- Monitor usage in billing dashboard

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord Community](https://discord.gg/railway)
- [OpenClaw Hotel GitHub](https://github.com/openclaw/openclaw-hotel)

---

**Need Help?** Open an issue on GitHub or contact the maintainers.
