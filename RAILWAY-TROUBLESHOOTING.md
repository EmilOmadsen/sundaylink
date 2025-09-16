# Railway 502 Error Troubleshooting Guide

## Current Status
- ✅ Local development: Working perfectly
- ✅ SQLite implementation: Complete and tested
- ✅ Health endpoints: Working locally
- ❌ Railway deployment: Persistent 502 errors

## Troubleshooting Steps

### 1. Check Railway Deployment Status
1. Go to Railway dashboard: https://railway.app/dashboard
2. Navigate to your project: `sundaylink`
3. Check the "Deployments" tab for recent deployments
4. Look for any build or deployment errors

### 2. Verify Environment Variables
In Railway dashboard, ensure these variables are set:
```bash
DB_PATH=/mnt/data/soundlink-lite.db
NODE_ENV=production
RAILWAY_ENVIRONMENT=production
PORT=3000
```

### 3. Check Railway Logs
1. In Railway dashboard, go to "Logs" tab
2. Look for:
   - Build errors
   - Runtime errors
   - Environment variable issues
   - Port binding problems

### 4. Verify Railway Configuration
Check `railway.json`:
```json
{
  "startCommand": "node railway-simple.js",
  "healthcheckPath": "/health",
  "healthcheckTimeout": 15000
}
```

### 5. Test Different Endpoints
Try these URLs:
- `https://sundaylink-production.up.railway.app/health`
- `https://sundaylink-production.up.railway.app/ping`
- `https://sundaylink-production.up.railway.app/healthz`
- `https://sundaylink-production.up.railway.app/`

### 6. Railway-Specific Issues

#### Build Process
- Railway might be failing during `npm ci` or `npm install`
- Check if all dependencies are properly listed in `package.json`
- Verify Node.js version compatibility

#### Port Binding
- Railway provides `PORT` environment variable
- Ensure app binds to `0.0.0.0` not `localhost`
- Check that `process.env.PORT` is used correctly

#### Health Check Configuration
- Railway health checks might be timing out
- Current timeout: 15 seconds
- Health check path: `/health`

### 7. Alternative Solutions

#### Option A: Manual Railway Configuration
1. In Railway dashboard, go to "Settings"
2. Set "Start Command" to: `node railway-simple.js`
3. Set "Health Check Path" to: `/health`
4. Set "Health Check Timeout" to: 15 seconds

#### Option B: Use Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy directly
railway up
```

#### Option C: Check Railway Service Status
1. In Railway dashboard, check if service is "Running"
2. Verify the service has a public URL
3. Check if the service is properly exposed

### 8. Common Railway Issues

#### Service Not Exposed
- Railway services need to be explicitly exposed
- Check "Settings" → "Domains" → "Generate Domain"

#### Environment Variables Not Set
- Railway doesn't automatically set environment variables
- Must be manually added in dashboard

#### Build Failures
- Check Railway build logs for npm/Node.js errors
- Verify `package.json` scripts are correct

#### Port Issues
- Railway assigns random ports
- Must use `process.env.PORT` not hardcoded ports

### 9. Next Steps

If 502 errors persist:
1. Check Railway dashboard for specific error messages
2. Verify all environment variables are set
3. Check Railway service logs
4. Consider using Railway CLI for direct deployment
5. Contact Railway support if issue persists

## Current Server Files

### railway-simple.js
- Ultra-simple Express server
- Zero dependencies
- Health check endpoints
- Automatic environment setup

### railway-start.js
- Railway-specific startup script
- Environment variable handling
- Fallback to minimal server

### railway-minimal.js
- Original minimal server
- Basic health checks only
