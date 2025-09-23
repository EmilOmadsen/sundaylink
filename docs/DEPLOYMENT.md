# Soundlink Deployment Guide

## Overview

This guide covers deploying the Soundlink application to production using Railway, including configuration, environment setup, and monitoring.

## Railway Deployment

### Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Push your code to GitHub
3. **Spotify Developer Account**: Set up Spotify app for OAuth
4. **Domain** (optional): Custom domain for production

### Step 1: Connect Repository

1. **Login to Railway**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your Soundlink repository

3. **Configure Deployment**
   - Railway will auto-detect Node.js
   - Build command: `npm run build`
   - Start command: `npm start`

### Step 2: Environment Configuration

Configure the following environment variables in Railway dashboard:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID | `abc123def456...` |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret | `xyz789uvw012...` |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL | `https://your-app.railway.app/auth/spotify/callback` |
| `ENCRYPTION_KEY` | 32-character encryption key | `my32characterencryptionkey123` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | Database file path | `/app/db/soundlink-lite.db` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |

### Step 3: Spotify App Configuration

1. **Update Redirect URIs**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Select your app
   - Go to "Settings"
   - Add redirect URI: `https://your-app.railway.app/auth/spotify/callback`

2. **Verify App Settings**
   - Ensure app is not in "Development Mode" if you want public access
   - Check that required scopes are enabled:
     - `user-read-recently-played`
     - `user-read-private`
     - `user-read-email`

### Step 4: Database Setup

Railway provides persistent storage for the SQLite database:

1. **Database Migration**
   - Railway will run migrations automatically on first deployment
   - Check logs for migration status

2. **Database Persistence**
   - Database file is stored in Railway's persistent volume
   - Data persists across deployments

### Step 5: Custom Domain (Optional)

1. **Add Custom Domain**
   - In Railway dashboard, go to "Settings"
   - Click "Domains"
   - Add your custom domain

2. **Update Spotify Redirect URI**
   - Update redirect URI in Spotify app settings
   - Update `SPOTIFY_REDIRECT_URI` environment variable

## Environment-Specific Configuration

### Development Environment

```env
SPOTIFY_CLIENT_ID=your_dev_client_id
SPOTIFY_CLIENT_SECRET=your_dev_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/spotify/callback
ENCRYPTION_KEY=dev32characterencryptionkey123
DATABASE_PATH=./db/soundlink-lite.db
NODE_ENV=development
PORT=3000
```

### Staging Environment

```env
SPOTIFY_CLIENT_ID=your_staging_client_id
SPOTIFY_CLIENT_SECRET=your_staging_client_secret
SPOTIFY_REDIRECT_URI=https://staging-your-app.railway.app/auth/spotify/callback
ENCRYPTION_KEY=staging32characterencryptionkey123
DATABASE_PATH=/app/db/soundlink-lite.db
NODE_ENV=staging
PORT=3000
```

### Production Environment

```env
SPOTIFY_CLIENT_ID=your_prod_client_id
SPOTIFY_CLIENT_SECRET=your_prod_client_secret
SPOTIFY_REDIRECT_URI=https://your-domain.com/auth/spotify/callback
ENCRYPTION_KEY=prod32characterencryptionkey123
DATABASE_PATH=/app/db/soundlink-lite.db
NODE_ENV=production
PORT=3000
```

## Build Configuration

### package.json Scripts

Ensure your `package.json` has the correct scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon src/index.ts",
    "migrate": "node dist/utils/migrate.js"
  }
}
```

### TypeScript Configuration

Verify `tsconfig.json` is configured for production builds:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Railway Configuration

Railway automatically detects Node.js projects, but you can customize with `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Monitoring and Logs

### Railway Logs

1. **View Logs**
   - Go to Railway dashboard
   - Click on your service
   - Navigate to "Deployments" tab
   - Click on deployment to view logs

2. **Log Levels**
   - Application logs appear in real-time
   - Error logs are highlighted
   - Build logs show compilation status

### Health Monitoring

Add a health check endpoint:

```typescript
// In src/index.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});
```

### Error Monitoring

Consider adding error monitoring service:

1. **Sentry Integration**
   ```bash
   npm install @sentry/node
   ```

2. **Configure Sentry**
   ```typescript
   import * as Sentry from '@sentry/node';
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV
   });
   ```

## Performance Optimization

### Railway Resource Limits

Railway provides different resource tiers:

- **Hobby**: 512MB RAM, 1 vCPU
- **Pro**: 8GB RAM, 8 vCPU
- **Team**: Custom resources

### Database Optimization

1. **Connection Pooling**
   - SQLite handles connections efficiently
   - No additional pooling needed for small to medium loads

2. **Query Optimization**
   - Use prepared statements
   - Add appropriate indexes
   - Monitor query performance

### Caching Strategy

1. **In-Memory Caching**
   - Cache playlist tracks (1 hour TTL)
   - Cache user sessions
   - Cache frequently accessed data

2. **Redis Integration** (Optional)
   ```bash
   npm install redis
   ```

## Security Configuration

### Environment Security

1. **Secure Environment Variables**
   - Never commit secrets to Git
   - Use Railway's encrypted environment variables
   - Rotate keys regularly

2. **HTTPS Configuration**
   - Railway provides HTTPS automatically
   - Custom domains get SSL certificates
   - Force HTTPS redirects

### Application Security

1. **Input Validation**
   - Validate all user inputs
   - Sanitize database queries
   - Use parameterized statements

2. **Rate Limiting**
   - Implement API rate limiting
   - Protect against abuse
   - Monitor suspicious activity

## Backup Strategy

### Database Backups

1. **Automated Backups**
   - Railway provides automatic backups
   - Download backups regularly
   - Test restore procedures

2. **Manual Backup Script**
   ```bash
   # Connect to Railway database
   railway connect
   
   # Export database
   sqlite3 soundlink-lite.db ".backup backup-$(date +%Y%m%d).db"
   ```

### Code Backups

1. **Git Repository**
   - Push all changes to GitHub
   - Use feature branches
   - Tag releases

2. **Deployment History**
   - Railway keeps deployment history
   - Easy rollback to previous versions
   - Monitor deployment success rates

## Troubleshooting

### Common Deployment Issues

1. **Build Failures**
   ```
   Error: TypeScript compilation failed
   ```
   **Solution**: Check TypeScript errors, fix type issues

2. **Environment Variable Issues**
   ```
   Error: Missing required environment variable
   ```
   **Solution**: Verify all required variables are set in Railway

3. **Spotify OAuth Issues**
   ```
   Error: Illegal redirect_uri
   ```
   **Solution**: Update redirect URI in Spotify app settings

4. **Database Connection Issues**
   ```
   Error: Database locked
   ```
   **Solution**: Check database file permissions, restart service

### Debugging Steps

1. **Check Logs**
   - Review Railway deployment logs
   - Look for error messages
   - Check build output

2. **Verify Configuration**
   - Confirm environment variables
   - Check Spotify app settings
   - Verify database connectivity

3. **Test Endpoints**
   - Test health check endpoint
   - Verify OAuth flow
   - Check API responses

### Rollback Procedure

1. **Railway Rollback**
   - Go to Railway dashboard
   - Select deployment
   - Click "Rollback"

2. **Manual Rollback**
   - Revert Git commit
   - Push to main branch
   - Trigger new deployment

## Scaling Considerations

### Horizontal Scaling

1. **Multiple Instances**
   - Railway supports multiple instances
   - Load balancing automatic
   - Shared database (SQLite limitation)

2. **Database Migration**
   - Consider PostgreSQL for scaling
   - Use connection pooling
   - Implement read replicas

### Vertical Scaling

1. **Resource Upgrades**
   - Increase Railway plan
   - More CPU and memory
   - Better performance

2. **Optimization**
   - Profile application performance
   - Optimize database queries
   - Implement caching layers

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs
   - Check disk usage
   - Monitor performance metrics

2. **Monthly**
   - Update dependencies
   - Review security patches
   - Backup database

3. **Quarterly**
   - Rotate encryption keys
   - Review access logs
   - Performance optimization

### Update Procedure

1. **Development**
   - Make changes locally
   - Test thoroughly
   - Commit to Git

2. **Staging**
   - Deploy to staging environment
   - Run integration tests
   - Verify functionality

3. **Production**
   - Deploy to production
   - Monitor deployment
   - Verify critical functionality

---

**Deployment Version**: 1.0  
**Last Updated**: January 2025  
**Railway Documentation**: [railway.app/docs](https://railway.app/docs)
