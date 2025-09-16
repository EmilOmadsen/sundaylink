# Spotify Redirect URI Setup for Railway

## Current Configuration Issues

### ❌ **Problem**: Redirect URI Mismatch
Your current `.env` file has:
```
SPOTIFY_REDIRECT_URI=https://sundaylink-production.up.railway.app/auth/spotify/callback
```

But Railway domains are dynamic and change with each deployment!

## ✅ **Solution**: Dynamic Railway Domain Detection

### 1. **Get Your Actual Railway Domain**
1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Settings" → "Domains"
4. Copy your actual Railway domain (e.g., `https://your-app-name-production.up.railway.app`)

### 2. **Update Environment Variables in Railway**
Set these in your Railway project environment variables:

```bash
# Required for Railway
DATABASE_PATH=/mnt/data/soundlink-lite.db
NODE_ENV=production
PORT=3000

# Security Keys
JWT_SECRET=sunday-link-jwt-secret-key-2024-change-in-production
ENCRYPTION_KEY=sunday-link-encryption-key-32
SESSION_SECRET=sunday-link-session-secret-key-2024-change-in-production

# Spotify Configuration
SPOTIFY_CLIENT_ID=cab1f7c20e1343b2a252848cc52c0de9
SPOTIFY_CLIENT_SECRET=aed885745f2d413692da6fb88a8fab61
SPOTIFY_REDIRECT_URI=https://YOUR-ACTUAL-RAILWAY-DOMAIN.up.railway.app/auth/spotify/callback
```

### 3. **Update Spotify App Settings**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click on your app
3. Go to "Settings"
4. Update "Redirect URIs" to match your Railway domain:
   ```
   https://YOUR-ACTUAL-RAILWAY-DOMAIN.up.railway.app/auth/spotify/callback
   ```

### 4. **Test the Redirect URI**
After deployment, test:
1. Go to your Railway app URL
2. Click "Login" or "Connect Spotify"
3. You should be redirected to Spotify
4. After authorization, you should be redirected back to your app

## 🔧 **Code Verification**

The callback route exists at: `src/routes/auth.ts:500`
```typescript
router.get('/spotify/callback', async (req, res) => {
  // Handles Spotify OAuth callback
});
```

## 🚨 **Common Issues**

1. **Domain Mismatch**: Railway domain ≠ Spotify redirect URI
2. **HTTPS Required**: Spotify requires HTTPS for production
3. **Case Sensitivity**: URIs are case-sensitive
4. **Trailing Slash**: Some services are picky about trailing slashes

## ✅ **Quick Fix**

Replace `YOUR-ACTUAL-RAILWAY-DOMAIN` with your real Railway domain in both:
- Railway environment variables
- Spotify app settings
