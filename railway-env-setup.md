# Railway Environment Variables Setup

## Required Environment Variables for Railway

Set these in your Railway project dashboard:

### Database
```
DATABASE_PATH=/mnt/data/soundlink-lite.db
```

### Security Keys
```
JWT_SECRET=sunday-link-jwt-secret-key-2024-change-in-production
ENCRYPTION_KEY=sunday-link-encryption-key-32
SESSION_SECRET=sunday-link-session-secret-key-2024-change-in-production
```

### Application
```
NODE_ENV=production
PORT=8080
```

### Spotify (Optional - for full functionality)
```
SPOTIFY_CLIENT_ID=cab1f7c20e1343b2a252848cc52c0de9
SPOTIFY_CLIENT_SECRET=aed885745f2d413692da6fb88a8fab61
SPOTIFY_REDIRECT_URI=https://your-railway-domain.up.railway.app/auth/spotify/callback
```

## Railway-Specific Variables (Auto-set by Railway)
- `RAILWAY_ENVIRONMENT=production`
- `RAILWAY_PROJECT_NAME=your-project-name`
- `RAILWAY_SERVICE_NAME=your-service-name`

## Health Check Configuration
- **Path**: `/health`
- **Timeout**: 60 seconds
- **Start Command**: `node railway-ultra-minimal.js`
