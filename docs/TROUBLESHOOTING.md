# Soundlink Troubleshooting Guide

## Common Issues and Solutions

### Spotify OAuth Issues

#### "Illegal redirect_uri" Error

**Symptoms:**
```
Error: Illegal redirect_uri
Failed to exchange authorization code
```

**Causes:**
- Redirect URI in code doesn't match Spotify app settings
- Missing or incorrect protocol (http vs https)
- Environment-specific URI mismatches

**Solutions:**
1. **Check Spotify App Settings**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Select your app → Settings
   - Verify redirect URIs match exactly:
     - Development: `http://localhost:3000/auth/spotify/callback`
     - Production: `https://yourdomain.com/auth/spotify/callback`

2. **Update Environment Variables**
   ```env
   SPOTIFY_REDIRECT_URI=https://yourdomain.com/auth/spotify/callback
   ```

3. **Check Code Implementation**
   ```typescript
   // Ensure buildRedirectUri handles protocol correctly
   const redirectUri = buildRedirectUri(req);
   ```

#### "Authorization code expired or invalid" Error

**Symptoms:**
```
Error: Authorization code expired or invalid
```

**Causes:**
- Authorization code used multiple times
- Code expired (10-minute limit)
- Network delays during OAuth flow

**Solutions:**
1. **Immediate Token Exchange**
   - Ensure code is exchanged immediately after redirect
   - Don't store authorization codes

2. **Handle Expiration Gracefully**
   ```typescript
   try {
     const tokens = await exchangeCodeForTokens(code);
   } catch (error) {
     if (error.message.includes('expired')) {
       // Redirect back to authorization
       return res.redirect('/auth/spotify');
     }
   }
   ```

3. **Check Network Connectivity**
   - Verify stable internet connection
   - Test OAuth flow in incognito mode

### Database Issues

#### "NOT NULL constraint failed" Error

**Symptoms:**
```
Error: NOT NULL constraint failed: users.password_hash
```

**Causes:**
- Database schema mismatch
- Missing migration execution
- Incorrect user creation logic

**Solutions:**
1. **Run Database Migrations**
   ```bash
   npm run migrate
   ```

2. **Check Schema**
   ```sql
   PRAGMA table_info(users);
   ```

3. **Verify User Creation Logic**
   ```typescript
   // Ensure auth_type is set correctly
   const user = {
     id: generateId(),
     email: userData.email,
     auth_type: 'spotify', // or 'email'
     password_hash: authType === 'spotify' ? null : hashedPassword
   };
   ```

#### "UNIQUE constraint failed" Error

**Symptoms:**
```
Error: UNIQUE constraint failed: users.email
```

**Causes:**
- Duplicate email addresses
- User already exists with different auth type
- Race conditions in user creation

**Solutions:**
1. **Check for Existing User**
   ```typescript
   const existingUser = await getUserByEmail(email);
   if (existingUser) {
     // Update existing user instead of creating new one
     return updateUser(existingUser.id, userData);
   }
   ```

2. **Handle Auth Type Conflicts**
   ```typescript
   // Allow users to link multiple auth types
   if (existingUser && existingUser.auth_type !== newAuthType) {
     return updateUserAuthType(existingUser.id, newAuthType);
   }
   ```

### Analytics Issues

#### Analytics Showing 0 Values

**Symptoms:**
- Campaign shows 0 streams, 0 listeners
- Clicks recorded but no analytics data
- Dashboard metrics not updating

**Causes:**
- Polling service not running
- Attribution logic failing
- Playlist verification issues
- Session linking problems

**Solutions:**
1. **Check Polling Service**
   ```typescript
   // Verify polling service is active
   console.log('Polling service status:', pollingService.isActive());
   ```

2. **Manual Data Sync**
   - Click "Sync Data" button in dashboard
   - Check debug endpoint: `/debug-play-data/{campaignId}`

3. **Verify Attribution Logic**
   ```typescript
   // Check if plays are being attributed
   const attributions = await getAttributionsForCampaign(campaignId);
   console.log('Attributions:', attributions.length);
   ```

4. **Check Session Linking**
   ```sql
   -- Verify sessions are created for clicks
   SELECT c.id, s.id as session_id 
   FROM clicks c 
   LEFT JOIN sessions s ON c.id = s.click_id 
   WHERE c.campaign_id = ?;
   ```

#### Playlist Verification Issues

**Symptoms:**
- All user plays counted (not just playlist tracks)
- Incorrect stream attribution
- Playlist tracks not cached

**Solutions:**
1. **Clear Playlist Cache**
   ```
   GET /debug-clear-playlist-cache/{playlistId}
   ```

2. **Verify Playlist Tracks**
   ```typescript
   // Check if playlist tracks are fetched correctly
   const tracks = await spotifyService.getPlaylistTracks(playlistId);
   console.log('Playlist tracks:', tracks.length);
   ```

3. **Check Attribution Logic**
   ```typescript
   // Ensure isPlayFromCampaignPlaylist works correctly
   const isFromPlaylist = await isPlayFromCampaignPlaylist(playId, campaignId);
   ```

### Performance Issues

#### Slow Dashboard Loading

**Symptoms:**
- Dashboard takes > 5 seconds to load
- Charts not rendering
- API timeouts

**Causes:**
- Large dataset queries
- Missing database indexes
- Inefficient API calls
- Network latency

**Solutions:**
1. **Optimize Database Queries**
   ```sql
   -- Add missing indexes
   CREATE INDEX idx_attributions_campaign_created ON attributions(campaign_id, created_at);
   CREATE INDEX idx_plays_user_played ON plays(user_id, played_at);
   ```

2. **Implement Pagination**
   ```typescript
   // Limit result sets
   const results = await queryDatabase(`
     SELECT * FROM attributions 
     WHERE campaign_id = ? 
     ORDER BY created_at DESC 
     LIMIT 100
   `, [campaignId]);
   ```

3. **Add Caching**
   ```typescript
   // Cache frequently accessed data
   const cachedData = cache.get(`campaign_${campaignId}_metrics`);
   if (cachedData) return cachedData;
   ```

#### High Memory Usage

**Symptoms:**
- Application crashes with out-of-memory errors
- Slow response times
- Railway deployment failures

**Solutions:**
1. **Monitor Memory Usage**
   ```typescript
   console.log('Memory usage:', process.memoryUsage());
   ```

2. **Optimize Data Processing**
   ```typescript
   // Process data in chunks
   const chunkSize = 100;
   for (let i = 0; i < data.length; i += chunkSize) {
     const chunk = data.slice(i, i + chunkSize);
     await processChunk(chunk);
   }
   ```

3. **Implement Garbage Collection**
   ```typescript
   // Force garbage collection periodically
   setInterval(() => {
     if (global.gc) global.gc();
   }, 30000);
   ```

### Deployment Issues

#### Railway Build Failures

**Symptoms:**
- TypeScript compilation errors
- Docker build failures
- Missing dependencies

**Solutions:**
1. **Check TypeScript Errors**
   ```bash
   npm run build
   ```

2. **Verify Dependencies**
   ```bash
   npm install
   npm audit fix
   ```

3. **Check Railway Logs**
   - View build logs in Railway dashboard
   - Look for specific error messages
   - Check environment variables

#### Environment Variable Issues

**Symptoms:**
- Application crashes on startup
- "Missing required environment variable" errors
- OAuth not working

**Solutions:**
1. **Verify All Required Variables**
   ```env
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=https://yourdomain.com/auth/spotify/callback
   ENCRYPTION_KEY=your_32_character_encryption_key
   ```

2. **Check Variable Values**
   - Ensure no extra spaces or quotes
   - Verify special characters are escaped
   - Test with environment-specific values

3. **Use Default Values**
   ```typescript
   const port = process.env.PORT || 3000;
   const databasePath = process.env.DATABASE_PATH || './db/soundlink-lite.db';
   ```

### API Issues

#### CORS Errors

**Symptoms:**
```
Error: CORS policy blocks request
Access to fetch blocked by CORS policy
```

**Solutions:**
1. **Configure CORS Middleware**
   ```typescript
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
     credentials: true
   }));
   ```

2. **Check Request Headers**
   ```typescript
   // Ensure proper headers are sent
   res.header('Access-Control-Allow-Origin', origin);
   res.header('Access-Control-Allow-Credentials', 'true');
   ```

#### Rate Limiting Issues

**Symptoms:**
- API requests returning 429 status
- "Too many requests" errors
- Spotify API rate limit exceeded

**Solutions:**
1. **Implement Rate Limiting**
   ```typescript
   const rateLimit = require('express-rate-limit');
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   
   app.use('/api/', limiter);
   ```

2. **Handle Spotify Rate Limits**
   ```typescript
   if (error.response?.status === 429) {
     const retryAfter = error.response.headers['retry-after'];
     await sleep(retryAfter * 1000);
     return retryRequest();
   }
   ```

## Debugging Tools

### Debug Endpoints

The application provides several debug endpoints:

1. **Play Data Debug**
   ```
   GET /debug-play-data/{campaignId}
   ```
   Shows detailed play data for a campaign

2. **Clear Cache**
   ```
   GET /debug-clear-playlist-cache
   GET /debug-clear-playlist-cache/{playlistId}
   ```
   Clears playlist cache

3. **Health Check**
   ```
   GET /health
   ```
   Returns system health status

### Logging

Enable detailed logging for debugging:

```typescript
// Set log level
process.env.LOG_LEVEL = 'debug';

// Add debug logging
console.log('Debug info:', {
  campaignId,
  userId,
  timestamp: new Date().toISOString()
});
```

### Database Debugging

Check database state:

```sql
-- Check table schemas
PRAGMA table_info(users);
PRAGMA table_info(campaigns);
PRAGMA table_info(attributions);

-- Check data counts
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL
SELECT 'attributions', COUNT(*) FROM attributions;

-- Check recent activity
SELECT * FROM attributions 
ORDER BY created_at DESC 
LIMIT 10;
```

## Getting Help

### Before Asking for Help

1. **Check Logs**
   - Review application logs
   - Check Railway deployment logs
   - Look for error messages

2. **Reproduce Issue**
   - Document exact steps to reproduce
   - Note environment (dev/prod)
   - Include error messages

3. **Gather Information**
   - Application version
   - Environment variables (sanitized)
   - Database schema version
   - Recent changes

### Support Channels

1. **GitHub Issues**
   - Create detailed issue reports
   - Include logs and error messages
   - Provide reproduction steps

2. **Documentation**
   - Check this troubleshooting guide
   - Review API documentation
   - Consult architecture docs

3. **Community**
   - Stack Overflow for technical questions
   - Discord/Slack for real-time help
   - Developer forums

---

**Troubleshooting Version**: 1.0  
**Last Updated**: January 2025
