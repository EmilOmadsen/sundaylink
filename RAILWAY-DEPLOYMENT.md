# Railway Deployment Guide

## Environment Variables

Set these environment variables in Railway's dashboard:

### Required Variables
```bash
DB_PATH=/mnt/data/soundlink-lite.db
NODE_ENV=production
RAILWAY_ENVIRONMENT=production
```

### Security Variables
```bash
JWT_SECRET=sunday-link-jwt-secret-key-2024-change-in-production
ENCRYPTION_KEY=sunday-link-encryption-key-32
```

### Spotify API Variables
```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=https://sundaylink-production.up.railway.app/auth/spotify/callback
```

### Optional Variables
```bash
RAILWAY_STARTUP_DELAY=2000
```

## Deployment Steps

1. **Set Environment Variables**: Add all variables above to Railway's environment section
2. **Deploy**: Railway will automatically deploy when you push to main branch
3. **Verify**: Check that health endpoint responds: `https://your-app.up.railway.app/health`

## Important Notes

- **Single Replica**: SQLite requires only 1 replica on Railway
- **Persistent Storage**: Database is stored in `/mnt/data/` for persistence
- **Health Checks**: Use `/health` endpoint for Railway health checks
- **Migrations**: Run automatically on startup
- **Backups**: Use `npm run backup:sqlite` to create database backups

## Troubleshooting

### 502 Errors
- Check that all required environment variables are set
- Verify database path is `/mnt/data/soundlink-lite.db`
- Ensure only 1 replica is running
- Check Railway logs for specific error messages

### Database Issues
- Verify `DB_PATH` is set correctly
- Check that migrations are running successfully
- Use backup script to restore if needed

### Spotify Integration
- Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are set
- Update `SPOTIFY_REDIRECT_URI` to match your Railway domain
- Re-authenticate users if encryption key changes
