import dotenv from 'dotenv';

// MUST load environment variables FIRST before any other imports
dotenv.config();

// Check for required environment variables and set defaults
const requiredEnvVars = ['DATABASE_PATH', 'JWT_SECRET', 'ENCRYPTION_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
  console.warn('Using default values for development...');
  
  // Set default values
  if (!process.env.DATABASE_PATH) {
    // Use Railway's persistent storage if available, otherwise local path
    if (process.env.RAILWAY_ENVIRONMENT) {
      // Railway: use current directory for database (Railway filesystem is writable)
      process.env.DATABASE_PATH = './db/soundlink-lite.db';
    } else {
      process.env.DATABASE_PATH = './db/soundlink-lite.db';
    }
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'sunday-link-jwt-secret-key-2024-change-in-production';
  }
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = 'sunday-link-encryption-key-32';
  }
}

// Ensure DATABASE_PATH is set and log it clearly
const dbPath = process.env.DATABASE_PATH;
if (!dbPath) {
  console.error('❌ DATABASE_PATH environment variable is required!');
  console.error('💡 For Railway deployment, set: DATABASE_PATH=/mnt/data/soundlink-lite.db');
  console.error('💡 For local development, set: DATABASE_PATH=./db/soundlink-lite.db');
  process.exit(1);
}

console.log('🗄️ SQLite DB path:', dbPath);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('🚂 Railway Environment:', process.env.RAILWAY_ENVIRONMENT || 'local');

// Railway provides PORT automatically, use 3000 as fallback for local development
if (!process.env.PORT) {
  process.env.PORT = '3000';
}

// Railway-specific environment variable fallback
if (!process.env.NIXPACKS_NODE_VERSION) {
  process.env.NIXPACKS_NODE_VERSION = '20';
}

// Railway detection - if we're on Railway, use minimal startup
const IS_RAILWAY = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_NAME;

// Railway deployment environment detection
if (IS_RAILWAY) {
  console.log(`🚂 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'production'}`);
  console.log(`🔧 Railway Project: ${process.env.RAILWAY_PROJECT_NAME || 'unknown'}`);
  console.log(`🌍 Railway Service: ${process.env.RAILWAY_SERVICE_NAME || 'unknown'}`);
  console.log(`🌐 Railway Region: ${process.env.RAILWAY_REGION || 'unknown'}`);
  console.log(`📊 Railway Port: ${process.env.PORT || 'not set'}`);
  console.log(`🗄️ Database Path: ${process.env.DATABASE_PATH || './db/soundlink-lite.db'}`);
  console.log(`🎯 Railway Mode: Bulletproof startup for EU West region`);
  
  // EU West specific optimizations
  if (process.env.RAILWAY_REGION && process.env.RAILWAY_REGION.includes('europe-west')) {
    console.log(`🇪🇺 EU West region detected - applying region-specific optimizations`);
  }
}

import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// Import logger after env is loaded
import logger from './utils/logger';
import logManager from './utils/logManager';
import { requestLogger, errorLogger } from './middleware/requestLogger';
import MigrationRunner from './utils/migrate';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Helper function to log all registered routes
function logRegisteredRoutes() {
  console.log('📋 Registered Routes:');
  const routes: string[] = [];
  
  function extractRoutes(stack: any[], basePath = '') {
    stack.forEach((middleware) => {
      if (middleware.route) {
        // Direct route
        const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
        routes.push(`${methods} ${basePath}${middleware.route.path}`);
      } else if (middleware.name === 'router' && middleware.handle?.stack) {
        // Router middleware
        const routerPath = middleware.regexp.source
          .replace('\\/?', '')
          .replace('\\/', '/')
          .replace('^', '')
          .replace('$', '')
          .replace('(?=\\/|$)', '');
        
        const cleanPath = routerPath === '\\/' ? '' : routerPath;
        extractRoutes(middleware.handle.stack, basePath + cleanPath);
      }
    });
  }
  
  if (app._router?.stack) {
    extractRoutes(app._router.stack);
  }
  
  routes.forEach(route => console.log(`  ✓ ${route}`));
  console.log(`📊 Total routes: ${routes.length}`);
}

// Process guards for better error handling
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', { 
    error: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined
  }, err instanceof Error ? err : undefined);
  
  // Don't exit in development, just log the error
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { 
    error: err.message,
    stack: err.stack 
  }, err);
  
  // Don't exit in development, just log the error
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Ensure database directory exists (especially important for Railway)
try {
  const dbPath = process.env.DATABASE_PATH || './db/soundlink-lite.db';
  const dbDir = path.dirname(dbPath);
  console.log(`📁 Database directory: ${dbDir}`);
  console.log(`📄 Database file: ${dbPath}`);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`✅ Created database directory: ${dbDir}`);
  } else {
    console.log(`✅ Database directory exists: ${dbDir}`);
  }
  
  // Check if we can write to the directory
  const testFile = path.join(dbDir, 'test-write.tmp');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log(`✅ Database directory is writable`);
  
} catch (error) {
  console.error('❌ Database directory issue:', error instanceof Error ? error.message : 'Unknown error');
  console.log('⚠️ This may cause database initialization to fail');
}

// Initialize database and run migrations BEFORE starting server
async function initializeDatabase() {
  console.log('🔄 Initializing database and running migrations...');
  try {
    // Import database connection (this will establish the connection with PRAGMAs)
    const { getDatabaseConnection } = await import('./utils/database');
    const dbConnection = getDatabaseConnection();
    dbConnection.connect(); // This will run PRAGMAs and log connection details
    
    // Run migrations
    const migrationRunner = new MigrationRunner();
    await migrationRunner.run();
    
    // Ensure all analytics tables exist
    await ensureAnalyticsTables();
    
    console.log('✅ Database initialization and migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // On Railway, continue anyway but create in-memory fallback
    if (process.env.RAILWAY_ENVIRONMENT) {
      console.log('🚂 Railway detected - continuing with in-memory fallback');
      console.log('⚠️ Database features may be limited but app will work');
      return true; // Return true so API routes get registered
    }
    
    console.log('⚠️ Continuing without database - API will return errors but app will still work');
    console.log('💡 Check DATABASE_PATH environment variable and database permissions');
    return false;
  }
}

// Health check endpoint - Railway compatible (no dependencies, cannot throw)
// MUST be first route before any middleware
app.get('/health', (req, res) => {
  // Ultra-simple health check - no database, no services, no dependencies
  // This endpoint must work even if database is not available
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '3000',
    railway: process.env.RAILWAY_ENVIRONMENT ? 'production' : 'local'
  });
});

// Debug endpoint to check API_BASE configuration
app.get('/debug-api-base', (req, res) => {
  const envConfig = {
    VITE_API_URL: process.env.VITE_API_URL || `${req.protocol}://${req.get('host')}`
  };
  
  res.json({
    envConfig,
    process_env_VITE_API_URL: process.env.VITE_API_URL,
    calculated_fallback: `${req.protocol}://${req.get('host')}`,
    headers: {
      host: req.get('host'),
      protocol: req.protocol
    },
    api_base_would_be: (envConfig.VITE_API_URL || "").replace(/\/+$/, "")
  });
});

// Comprehensive diagnostics endpoint for Spotify and analytics
app.get('/debug-analytics', async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      spotify_config: {
        client_id: process.env.SPOTIFY_CLIENT_ID ? `${process.env.SPOTIFY_CLIENT_ID.substring(0, 8)}...` : 'NOT_SET',
        client_secret: process.env.SPOTIFY_CLIENT_SECRET ? 'SET' : 'NOT_SET',
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'NOT_SET'
      },
      database_config: {
        path: process.env.DATABASE_PATH || './db/soundlink-lite.db',
        exists: false
      },
      services_status: {
        polling_service: 'unknown',
        attribution_service: 'unknown',
        polling_details: null as any,
        polling_error: null as any
      },
      database_stats: {
        campaigns_count: 0,
        clicks_count: 0,
        users_count: 0,
        plays_count: 0,
        attributions_count: 0,
        sessions_count: 0
      }
    };

    // Check database
    try {
      const { default: database } = await import('./services/database');
      diagnostics.database_config.exists = true;
      
      // Get table counts
      try {
        const campaignsCount = database.prepare('SELECT COUNT(*) as count FROM campaigns').get() as { count: number };
        diagnostics.database_stats.campaigns_count = campaignsCount.count;
      } catch (e) {}
      
      try {
        const clicksCount = database.prepare('SELECT COUNT(*) as count FROM clicks').get() as { count: number };
        diagnostics.database_stats.clicks_count = clicksCount.count;
      } catch (e) {}
      
      try {
        const usersCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
        diagnostics.database_stats.users_count = usersCount.count;
      } catch (e) {
        diagnostics.database_stats.users_count = -1; // Table doesn't exist
      }
      
      try {
        const playsCount = database.prepare('SELECT COUNT(*) as count FROM plays').get() as { count: number };
        diagnostics.database_stats.plays_count = playsCount.count;
      } catch (e) {
        diagnostics.database_stats.plays_count = -1; // Table doesn't exist
      }
      
      try {
        const attributionsCount = database.prepare('SELECT COUNT(*) as count FROM attributions').get() as { count: number };
        diagnostics.database_stats.attributions_count = attributionsCount.count;
      } catch (e) {
        diagnostics.database_stats.attributions_count = -1; // Table doesn't exist
      }
      
      try {
        const sessionsCount = database.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
        diagnostics.database_stats.sessions_count = sessionsCount.count;
      } catch (e) {
        diagnostics.database_stats.sessions_count = -1; // Table doesn't exist
      }
      
    } catch (error) {
      diagnostics.database_config.exists = false;
    }

    // Check polling service
    try {
      const { default: pollingService } = await import('./services/polling');
      const status = pollingService.getStatus();
      diagnostics.services_status.polling_service = status.is_running ? 'RUNNING' : 'STOPPED';
      diagnostics.services_status.polling_details = {
        connected_users: status.connected_users,
        interval_minutes: status.interval_minutes,
        is_running: status.is_running
      };
    } catch (error) {
      diagnostics.services_status.polling_service = 'ERROR';
      diagnostics.services_status.polling_error = error instanceof Error ? error.message : 'Unknown error';
    }

    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get diagnostics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Additional Railway health check routes
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Simple test endpoint for Railway
app.get('/test', (req, res) => {
  res.status(200).send('Railway test endpoint working');
});

// Test endpoint to manually trigger polling with detailed logging
app.get('/debug-trigger-polling', async (req, res) => {
  try {
    const { default: pollingService } = await import('./services/polling');
    
    // Get current status
    const status = pollingService.getStatus();
    
    if (!status.is_running) {
      return res.json({
        error: 'Polling service is not running',
        status,
        message: 'Start the polling service first'
      });
    }
    
    console.log('🚀 [DEBUG] Manual polling triggered via API endpoint');
    
    // Manually trigger polling
    await pollingService.pollAllUsers();
    
    // Wait a moment then check database stats
    setTimeout(async () => {
      try {
        const { default: database } = await import('./services/database');
        const playsCount = database.prepare('SELECT COUNT(*) as count FROM plays').get() as { count: number };
        const usersCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
        console.log(`📊 [DEBUG] After polling - Users: ${usersCount.count}, Plays: ${playsCount.count}`);
      } catch (e) {
        console.log('📊 [DEBUG] Could not check post-polling stats');
      }
    }, 1000);
    
    res.json({
      message: 'Polling cycle triggered manually',
      status,
      timestamp: new Date().toISOString(),
      note: 'Check Railway logs for detailed polling debug information'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to trigger polling',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to fix encryption key issues by clearing invalid refresh tokens
app.post('/debug-fix-encryption-keys', async (req, res) => {
  try {
    const { default: database } = await import('./services/database');
    
    console.log('🔧 [FIX] Starting encryption key fix...');
    
    // Get all users with refresh tokens
    const usersWithTokens = database.prepare(`
      SELECT id, spotify_user_id, email, refresh_token_encrypted IS NOT NULL as has_token
      FROM users 
      WHERE refresh_token_encrypted IS NOT NULL
    `).all();
    
    console.log(`🔍 [FIX] Found ${usersWithTokens.length} users with refresh tokens`);
    
    // Clear refresh tokens for users (they'll need to re-authenticate)
    const clearTokens = database.prepare(`
      UPDATE users 
      SET refresh_token_encrypted = NULL, 
          last_polled_at = NULL
      WHERE refresh_token_encrypted IS NOT NULL
    `);
    
    const result = clearTokens.run();
    
    console.log(`✅ [FIX] Cleared refresh tokens for ${result.changes} users`);
    
    res.json({
      message: 'Encryption key fix applied',
      users_affected: result.changes,
      users_found: usersWithTokens.length,
      note: 'Users will need to re-authenticate with Spotify to collect play data',
      next_steps: [
        '1. Users click tracker links',
        '2. Complete Spotify OAuth again', 
        '3. New refresh tokens will be encrypted with current key',
        '4. Polling will work properly'
      ]
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fix encryption keys',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to check recent polling activity
app.get('/debug-polling-logs', async (req, res) => {
  try {
    const { default: database } = await import('./services/database');
    
    // Get recent users and their details
    const users = database.prepare(`
      SELECT id, spotify_user_id, email, display_name, 
             refresh_token_encrypted IS NOT NULL as has_refresh_token,
             last_polled_at, created_at
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all();
    
    // Get recent plays
    const plays = database.prepare(`
      SELECT p.id, p.user_id, p.track_name, p.artist_name, p.played_at, p.created_at,
             u.email, u.spotify_user_id
      FROM plays p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 10
    `).all();
    
    // Get database stats
    const stats = {
      users_count: database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
      plays_count: database.prepare('SELECT COUNT(*) as count FROM plays').get() as { count: number },
      attributions_count: database.prepare('SELECT COUNT(*) as count FROM attributions').get() as { count: number },
      campaigns_count: database.prepare('SELECT COUNT(*) as count FROM campaigns').get() as { count: number },
      clicks_count: database.prepare('SELECT COUNT(*) as count FROM clicks').get() as { count: number }
    };
    
    // Try to get polling service status
    let pollingStatus = null;
    try {
      const { default: pollingService } = await import('./services/polling');
      pollingStatus = pollingService.getStatus();
    } catch (e) {
      pollingStatus = { error: 'Could not get polling status' };
    }
    
    res.json({
      timestamp: new Date().toISOString(),
      database_stats: stats,
      polling_status: pollingStatus,
      recent_users: users,
      recent_plays: plays,
      analysis: {
        users_with_refresh_tokens: users.filter((u: any) => u.has_refresh_token).length,
        users_never_polled: users.filter((u: any) => !u.last_polled_at).length,
        plays_in_last_hour: plays.filter((p: any) => {
          const playTime = new Date(p.created_at);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return playTime > oneHourAgo;
        }).length
      }
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get polling logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Detailed Spotify OAuth flow debugging
app.get('/debug-spotify-flow/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const diagnostics = {
      step: 'starting_debug',
      timestamp: new Date().toISOString(),
      campaign_check: null as any,
      spotify_config: null as any,
      auth_url: null as any,
      database_users: null as any,
      recent_clicks: null as any,
      error: null as any
    };

    // Step 1: Check campaign exists
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const campaignResponse = await fetch(`${baseUrl}/api/campaigns`);
      const campaigns = await campaignResponse.json();
      const campaign = campaigns.find((c: any) => c.id === campaignId);
      
      diagnostics.campaign_check = {
        found: !!campaign,
        campaign_id: campaignId,
        total_campaigns: campaigns.length,
        campaign_details: campaign ? {
          name: campaign.name,
          spotify_track_id: campaign.spotify_track_id,
          status: campaign.status,
          clicks: campaign.clicks
        } : null
      };
    } catch (error) {
      diagnostics.campaign_check = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Step 2: Check Spotify configuration
    try {
      const { default: spotifyService } = await import('./services/spotify');
      diagnostics.spotify_config = {
        client_id: process.env.SPOTIFY_CLIENT_ID ? `${process.env.SPOTIFY_CLIENT_ID.substring(0, 8)}...` : 'NOT_SET',
        client_secret: process.env.SPOTIFY_CLIENT_SECRET ? 'SET' : 'NOT_SET',
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'NOT_SET',
        computed_redirect_uri: `${req.protocol}://${req.get('host')}/auth/spotify/callback`
      };

      // Test auth URL generation
      const testState = JSON.stringify({
        campaignId: campaignId,
        clickId: 'test-click-id',
        destinationUrl: 'https://open.spotify.com/track/test',
        returnTo: 'destination'
      });
      
      diagnostics.auth_url = spotifyService.getAuthUrl(Buffer.from(testState).toString('base64'));
    } catch (error) {
      diagnostics.spotify_config = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Step 3: Check database users
    try {
      const { default: database } = await import('./services/database');
      const users = database.prepare('SELECT id, spotify_user_id, email, is_spotify_connected, created_at FROM users ORDER BY created_at DESC LIMIT 10').all();
      const clicks = database.prepare('SELECT id, campaign_id, clicked_at FROM clicks WHERE campaign_id = ? ORDER BY clicked_at DESC LIMIT 5').all(campaignId);
      
      diagnostics.database_users = {
        total_users: users.length,
        recent_users: users,
        campaign_clicks: clicks.length,
        recent_clicks: clicks
      };
    } catch (error) {
      diagnostics.database_users = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test Spotify OAuth callback manually
app.get('/debug-test-oauth', async (req, res) => {
  try {
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Spotify OAuth</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
          .success { border-color: #4CAF50; background: #f9fff9; }
          .error { border-color: #f44336; background: #fff9f9; }
        </style>
      </head>
      <body>
        <h1>🎵 Spotify OAuth Test</h1>
        
        <div class="step">
          <h3>Step 1: Check Spotify Configuration</h3>
          <p><strong>Client ID:</strong> ${process.env.SPOTIFY_CLIENT_ID ? process.env.SPOTIFY_CLIENT_ID.substring(0, 8) + '...' : '❌ NOT SET'}</p>
          <p><strong>Client Secret:</strong> ${process.env.SPOTIFY_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET'}</p>
          <p><strong>Redirect URI:</strong> ${process.env.SPOTIFY_REDIRECT_URI || '❌ NOT SET'}</p>
          <p><strong>Expected URI:</strong> ${req.protocol}://${req.get('host')}/auth/spotify/callback</p>
        </div>
        
        <div class="step">
          <h3>Step 2: Test OAuth Flow</h3>
          <p>Click the button below to test the Spotify OAuth flow:</p>
          <button onclick="testSpotifyAuth()" style="padding: 10px 20px; font-size: 16px;">Test Spotify Login</button>
        </div>
        
        <div class="step">
          <h3>Step 3: Debug Information</h3>
          <p><a href="/debug-analytics">View System Diagnostics</a></p>
          <p><a href="/debug-trigger-polling">Trigger Manual Polling</a></p>
        </div>

        <script>
          function testSpotifyAuth() {
            const testState = JSON.stringify({
              campaignId: 'test-campaign',
              clickId: 'test-click-' + Date.now(),
              destinationUrl: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
              returnTo: 'destination'
            });
            
            const encodedState = btoa(testState);
            const clientId = '${process.env.SPOTIFY_CLIENT_ID || 'NOT_SET'}';
            const redirectUri = encodeURIComponent('${req.protocol}://${req.get('host')}/auth/spotify/callback');
            
            if (clientId === 'NOT_SET') {
              alert('❌ Spotify Client ID not configured! Set SPOTIFY_CLIENT_ID in Railway environment variables.');
              return;
            }
            
            const authUrl = 'https://accounts.spotify.com/authorize?' +
              'response_type=code' +
              '&client_id=' + clientId +
              '&scope=user-read-recently-played user-read-email' +
              '&redirect_uri=' + redirectUri +
              '&state=' + encodedState +
              '&show_dialog=true';
            
            console.log('🔗 Redirecting to:', authUrl);
            window.location.href = authUrl;
          }
        </script>
      </body>
      </html>
    `;
    
    res.send(testHtml);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate test page',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test endpoint to create a sample campaign with Spotify track
app.post('/debug-create-test-campaign', async (req, res) => {
  try {
    const testCampaign = {
      name: 'Test Spotify Campaign',
      destination_url: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh', // Sample Spotify track
      spotify_track_id: '4iV5W9uYEdYUVa79Axb7Rh',
      spotify_artist_id: '1Xyo4u8uXC1ZmMpatF05PJ', // Sample artist ID
      spotify_playlist_id: null
    };
    
    // Make internal request to create campaign
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = await fetch(`${baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCampaign)
    });
    
    if (!response.ok) {
      throw new Error(`Campaign creation failed: ${response.status}`);
    }
    
    const campaign = await response.json();
    
    res.json({
      message: 'Test campaign created successfully',
      campaign,
      test_link: campaign.smart_link_url,
      instructions: 'Click the test_link to test the full analytics flow'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create test campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manual session creation for testing attribution
app.post('/debug-create-session', async (req, res) => {
  try {
    const { default: database } = await import('./services/database');
    const { default: sessionService } = await import('./services/sessions');
    
    // Get the most recent click and user
    const recentClick = database.prepare('SELECT * FROM clicks ORDER BY clicked_at DESC LIMIT 1').get() as any;
    const recentUser = database.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 1').get() as any;
    
    if (!recentClick || !recentUser) {
      return res.json({
        error: 'No recent click or user found',
        clicks_count: recentClick ? 1 : 0,
        users_count: recentUser ? 1 : 0
      });
    }
    
    console.log('🔗 Creating manual session for testing...');
    console.log(`   Click ID: ${recentClick.id}`);
    console.log(`   User ID: ${recentUser.id}`);
    console.log(`   Campaign ID: ${recentClick.campaign_id}`);
    
    // Create session linking user to click
    try {
      const session = sessionService.create({
        click_id: recentClick.id,
        user_id: recentUser.id
      });
      
      console.log('✅ Manual session created:', session);
      
      // Now trigger attribution
      const { default: attributionService } = await import('./services/attribution');
      const attributionResult = await attributionService.attributeNewPlays();
      
      console.log('🎯 Attribution result:', attributionResult);
      
      res.json({
        message: 'Manual session created and attribution triggered',
        session: session,
        attribution_result: attributionResult,
        click: recentClick,
        user: recentUser
      });
      
    } catch (sessionError) {
      console.log('❌ Failed to create session:', sessionError);
      res.json({
        error: 'Failed to create session',
        message: sessionError instanceof Error ? sessionError.message : 'Unknown error',
        click: recentClick,
        user: recentUser
      });
    }
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create test session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test the complete OAuth flow for a campaign
app.get('/test-oauth-flow/:campaignId', async (req, res) => {
  const { campaignId } = req.params;
  
  try {
    const { default: database } = await import('./services/database');
    const { default: spotifyService } = await import('./services/spotify');
    
    // Get campaign details
    const campaign = database.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) as any;
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Generate Spotify OAuth URL with campaign info in state
    const testClickId = 'test-click-' + Date.now();
    const campaignState = Buffer.from(JSON.stringify({
      campaignId: campaignId,
      clickId: testClickId,
      destinationUrl: campaign.destination_url
    })).toString('base64');
    
    const authUrl = spotifyService.getAuthUrl(campaignState);
    
    res.json({
      message: 'Test OAuth flow for campaign',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        destination_url: campaign.destination_url
      },
      auth_url: authUrl,
      instructions: {
        step1: 'Click the auth_url to authenticate with Spotify',
        step2: 'After authentication, you should be redirected to the destination_url',
        step3: 'Check the dashboard to see if analytics data appears',
        step4: 'Check Railway logs for session creation details'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create test OAuth flow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to check which clicks have sessions
app.get('/debug-click-sessions', async (req, res) => {
  try {
    const { default: database } = await import('./services/database');
    
    // Get all clicks with their campaign info
    const clicks = database.prepare(`
      SELECT c.*, ca.name as campaign_name, ca.destination_url
      FROM clicks c
      LEFT JOIN campaigns ca ON c.campaign_id = ca.id
      ORDER BY c.clicked_at DESC
    `).all();
    
    // Get all sessions
    const sessions = database.prepare(`
      SELECT s.*, u.email, u.display_name, u.spotify_user_id
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `).all();
    
    // Get all attributions
    const attributions = database.prepare(`
      SELECT a.*, ca.name as campaign_name
      FROM attributions a
      LEFT JOIN campaigns ca ON a.campaign_id = ca.id
      ORDER BY a.created_at DESC
    `).all();
    
    res.json({
      message: 'Click-Session-Attribution Analysis',
      clicks: clicks,
      sessions: sessions,
      attributions: attributions,
      analysis: {
        total_clicks: clicks.length,
        clicks_with_sessions: clicks.filter((c: any) => sessions.some((s: any) => s.click_id === c.id)).length,
        total_sessions: sessions.length,
        total_attributions: attributions.length,
        campaigns_with_data: [...new Set(attributions.map((a: any) => a.campaign_name))],
        campaigns_without_data: [...new Set(clicks.map((c: any) => c.campaign_name).filter((name: any) => 
          !attributions.some((a: any) => a.campaign_name === name)
        ))]
      }
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to analyze click-session data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create sessions for connected users who have recent clicks
app.post('/debug-create-sessions-for-connected-users', async (req, res) => {
  try {
    const { default: database } = await import('./services/database');
    const { default: sessionService } = await import('./services/sessions');
    
    console.log('🔗 Creating sessions for connected users with recent clicks...');
    
    // Get all connected users
    const connectedUsers = database.prepare(`
      SELECT id, email, display_name, spotify_user_id 
      FROM users 
      WHERE refresh_token_encrypted IS NOT NULL 
      AND refresh_token_encrypted != ''
    `).all();
    
    console.log(`👥 Found ${connectedUsers.length} connected users`);
    
    let sessionsCreated = 0;
    const results = [];
    
    for (const user of connectedUsers) {
      const userTyped = user as any;
      console.log(`🔍 Checking clicks for user ${userTyped.id} (${userTyped.email})`);
      
      // Get recent clicks (within last 48 hours) that don't have sessions
      const recentClicksWithoutSessions = database.prepare(`
        SELECT c.*, ca.name as campaign_name
        FROM clicks c
        LEFT JOIN campaigns ca ON c.campaign_id = ca.id
        LEFT JOIN sessions s ON c.id = s.click_id
        WHERE c.clicked_at > datetime('now', '-48 hours')
        AND s.id IS NULL
        ORDER BY c.clicked_at DESC
      `).all();
      
      console.log(`   Found ${recentClicksWithoutSessions.length} recent clicks without sessions`);
      
      for (const click of recentClicksWithoutSessions) {
        const clickTyped = click as any;
        try {
          const session = sessionService.create({
            click_id: clickTyped.id,
            user_id: userTyped.id
          });
          
          sessionsCreated++;
          results.push({
            user_id: userTyped.id,
            user_email: userTyped.email,
            click_id: clickTyped.id,
            campaign_name: clickTyped.campaign_name,
            session_id: session.id
          });
          
          console.log(`   ✅ Created session for click ${clickTyped.id} (${clickTyped.campaign_name})`);
        } catch (error) {
          console.log(`   ⚠️ Failed to create session for click ${clickTyped.id}:`, error);
        }
      }
    }
    
    // Now trigger attribution for all users
    console.log('🎯 Triggering attribution after session creation...');
    const { default: attributionService } = await import('./services/attribution');
    const attributionResult = await attributionService.attributeNewPlays();
    
    res.json({
      message: 'Sessions created for connected users',
      sessions_created: sessionsCreated,
      connected_users: connectedUsers.length,
      results: results,
      attribution_result: attributionResult
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create sessions for connected users',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Quick fix: Create session for specific click
app.post('/debug-create-session-for-click/:clickId', async (req, res) => {
  try {
    const { clickId } = req.params;
    const { default: database } = await import('./services/database');
    const { default: sessionService } = await import('./services/sessions');
    
    // Get the most recent connected user
    const connectedUser = database.prepare(`
      SELECT id, email, display_name 
      FROM users 
      WHERE refresh_token_encrypted IS NOT NULL 
      AND refresh_token_encrypted != ''
      ORDER BY created_at DESC
      LIMIT 1
    `).get() as any;
    
    if (!connectedUser) {
      return res.json({ error: 'No connected user found' });
    }
    
    // Create session for this click
    const session = sessionService.create({
      click_id: clickId,
      user_id: connectedUser.id
    });
    
    // Trigger attribution
    const { default: attributionService } = await import('./services/attribution');
    const attributionResult = await attributionService.attributeNewPlays();
    
    res.json({
      message: 'Session created for click',
      click_id: clickId,
      user_id: connectedUser.id,
      user_email: connectedUser.email,
      session_id: session.id,
      attribution_result: attributionResult
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create session for click',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create sessions for all recent clicks from connected users (bulk fix)
app.post('/debug-create-all-sessions', async (req, res) => {
  try {
    const { default: database } = await import('./services/database');
    const { default: sessionService } = await import('./services/sessions');
    
    console.log('🔗 Creating sessions for ALL recent clicks...');
    
    // Get all connected users
    const connectedUsers = database.prepare(`
      SELECT id, email, display_name 
      FROM users 
      WHERE refresh_token_encrypted IS NOT NULL 
      AND refresh_token_encrypted != ''
    `).all();
    
    console.log(`👥 Found ${connectedUsers.length} connected users`);
    
    if (connectedUsers.length === 0) {
      return res.json({ error: 'No connected users found' });
    }
    
    // Get the first connected user
    const user = connectedUsers[0] as any;
    console.log(`👤 Using user: ${user.id} (${user.email})`);
    
    // Get ALL recent clicks without sessions (last 48 hours)
    const recentClicksWithoutSessions = database.prepare(`
      SELECT c.*, ca.name as campaign_name
      FROM clicks c
      LEFT JOIN campaigns ca ON c.campaign_id = ca.id
      LEFT JOIN sessions s ON c.id = s.click_id
      WHERE c.clicked_at > datetime('now', '-48 hours')
      AND s.id IS NULL
      ORDER BY c.clicked_at DESC
    `).all();
    
    console.log(`🔍 Found ${recentClicksWithoutSessions.length} recent clicks without sessions`);
    
    let sessionsCreated = 0;
    const results = [];
    
    for (const click of recentClicksWithoutSessions) {
      const clickTyped = click as any;
      try {
        const session = sessionService.create({
          click_id: clickTyped.id,
          user_id: user.id
        });
        
        sessionsCreated++;
        results.push({
          click_id: clickTyped.id,
          campaign_name: clickTyped.campaign_name,
          session_id: session.id,
          clicked_at: clickTyped.clicked_at
        });
        
        console.log(`   ✅ Created session for click ${clickTyped.id} (${clickTyped.campaign_name})`);
      } catch (error) {
        console.log(`   ⚠️ Failed to create session for click ${clickTyped.id}:`, error);
      }
    }
    
    // Now trigger attribution for all users
    console.log('🎯 Triggering attribution after session creation...');
    const { default: attributionService } = await import('./services/attribution');
    const attributionResult = await attributionService.attributeNewPlays();
    
    res.json({
      message: 'Sessions created for all recent clicks',
      sessions_created: sessionsCreated,
      user_used: { id: user.id, email: user.email },
      results: results,
      attribution_result: attributionResult
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create sessions for all clicks',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Direct attribution fix - create sessions for recent clicks and run attribution
app.post('/debug-fix-johan-campaigns', async (req, res) => {
  try {
    const { default: database } = await import('./services/database');
    const { default: sessionService } = await import('./services/sessions');
    
    console.log('🔧 Fixing johan campaigns attribution...');
    
    // Get connected user
    const user = database.prepare(`
      SELECT id, email FROM users 
      WHERE refresh_token_encrypted IS NOT NULL 
      ORDER BY created_at DESC LIMIT 1
    `).get() as any;
    
    if (!user) {
      return res.json({ error: 'No connected user found' });
    }
    
    // Get johan campaign clicks
    const johanClicks = database.prepare(`
      SELECT c.*, ca.name as campaign_name
      FROM clicks c
      LEFT JOIN campaigns ca ON c.campaign_id = ca.id
      WHERE ca.name LIKE '%johan%'
      AND c.clicked_at > datetime('now', '-24 hours')
    `).all();
    
    console.log(`🔍 Found ${johanClicks.length} johan campaign clicks`);
    
    let sessionsCreated = 0;
    const results = [];
    
    for (const click of johanClicks) {
      const clickTyped = click as any;
      try {
        // Check if session already exists
        const existingSession = database.prepare(`
          SELECT id FROM sessions WHERE click_id = ?
        `).get(clickTyped.id);
        
        if (existingSession) {
          console.log(`   ⏭️ Session already exists for click ${clickTyped.id}`);
          continue;
        }
        
        const session = sessionService.create({
          click_id: clickTyped.id,
          user_id: user.id
        });
        
        sessionsCreated++;
        results.push({
          click_id: clickTyped.id,
          campaign_name: clickTyped.campaign_name,
          session_id: session.id
        });
        
        console.log(`   ✅ Created session for ${clickTyped.campaign_name}`);
      } catch (error) {
        console.log(`   ⚠️ Failed: ${error}`);
      }
    }
    
    // Trigger attribution
    console.log('🎯 Running attribution...');
    const { default: attributionService } = await import('./services/attribution');
    const attributionResult = await attributionService.attributeNewPlays();
    
    res.json({
      message: 'Johan campaigns attribution fixed',
      sessions_created: sessionsCreated,
      user_used: user,
      results: results,
      attribution_result: attributionResult
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fix johan campaigns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test Spotify API functionality
app.get('/debug-test-spotify', async (req, res) => {
  try {
    const { default: spotifyService } = await import('./services/spotify');
    
    // Test 1: Check if Spotify service is configured
    const isConfigured = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REDIRECT_URI);
    
    // Test 2: Try to generate an auth URL
    let authUrl = null;
    try {
      authUrl = spotifyService.getAuthUrl('test-state');
    } catch (error) {
      console.log('Auth URL generation failed:', error);
    }
    
    // Test 3: Check environment variables (without exposing secrets)
    const envCheck = {
      SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ? 'SET' : 'NOT SET',
      SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ? 'SET' : 'NOT SET',
      SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI || 'NOT SET'
    };
    
    res.json({
      message: 'Spotify API Test Results',
      tests: {
        service_configured: isConfigured,
        auth_url_generated: !!authUrl,
        auth_url: authUrl
      },
      environment: envCheck,
      recommendations: {
        if_not_configured: 'Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI environment variables',
        if_auth_url_fails: 'Check that all Spotify credentials are properly set',
        test_oauth_flow: 'Try /test-oauth-flow/:campaignId to test complete OAuth flow'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Spotify API test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ensure all analytics tables exist
async function ensureAnalyticsTables() {
  try {
    const { default: database } = await import('./services/database');
    
    console.log('🔧 Ensuring all analytics tables exist...');
    
    // Create all tables from the schema
    database.exec(`
      -- Users table - stores both email/password and Spotify OAuth users
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        display_name TEXT,
        spotify_user_id TEXT,
        refresh_token_encrypted TEXT,
        is_spotify_connected BOOLEAN DEFAULT 0,
        auth_type TEXT DEFAULT 'spotify' CHECK (auth_type IN ('email', 'spotify')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_polled_at DATETIME,
        expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
      );

      -- Sessions table - links users to clicks for attribution
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        click_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME DEFAULT (datetime('now', '+40 days')),
        UNIQUE(click_id, user_id)
      );

      -- Plays table - stores recently played tracks from Spotify
      CREATE TABLE IF NOT EXISTS plays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        spotify_track_id TEXT NOT NULL,
        spotify_artist_id TEXT,
        played_at DATETIME NOT NULL,
        track_name TEXT,
        artist_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
      );

      -- Attributions table - links plays to clicks with confidence scores
      CREATE TABLE IF NOT EXISTS attributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        play_id INTEGER NOT NULL,
        click_id TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        time_diff_hours REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
      );

      -- Followers snapshots table - tracks follower counts over time
      CREATE TABLE IF NOT EXISTS followers_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        spotify_id TEXT NOT NULL,
        spotify_type TEXT NOT NULL CHECK (spotify_type IN ('artist', 'playlist')),
        follower_count INTEGER NOT NULL,
        snapshot_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME DEFAULT (datetime('now', '+40 days')),
        UNIQUE(spotify_id, spotify_type, snapshot_date)
      );
    `);
    
    // Create indexes for performance
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_spotify_user_id ON users(spotify_user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_click_id ON sessions(click_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_plays_user_id ON plays(user_id);
      CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays(played_at);
      CREATE INDEX IF NOT EXISTS idx_attributions_campaign_id ON attributions(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_attributions_play_id ON attributions(play_id);
      CREATE INDEX IF NOT EXISTS idx_followers_spotify_id ON followers_snapshots(spotify_id);
    `);
    
    console.log('✅ All analytics tables and indexes created successfully');
  } catch (error) {
    console.error('❌ Failed to create analytics tables:', error);
    throw error;
  }
}

// Trust proxy for getting real IP addresses
app.set('trust proxy', true);

// Add request logging middleware
app.use(requestLogger);

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      // Allow inline scripts for our server-rendered pages (dashboard/create-campaign)
      "script-src": ["'self'", "'unsafe-inline'", 'https:'],
      // Allow inline event handler attributes like onclick on dev pages
      "script-src-attr": ["'unsafe-inline'"],
      // Allow inline styles used by the minimal pages
      "style-src": ["'self'", "'unsafe-inline'", 'https:'],
      // Permit images and icons
      "img-src": ["'self'", 'data:', 'https:'],
      // XHR/Fetch to same-origin APIs and Chart.js CDN
      "connect-src": ["'self'", "https://cdn.jsdelivr.net"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
// Global request logger
app.use((req, _res, next) => { 
  console.log(req.method, req.url); 
  next(); 
});

app.use(cors({
  origin: [
    "https://sundaylink-production.up.railway.app",
    "http://localhost:3000",
    "http://localhost:5173" // Vite dev server default
  ],
  credentials: true
}));

// Serve static files from root directory and public directory
app.use(express.static('.'));
app.use(express.static('public'));

// Favicon route - prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content - prevents 404
});

// Robots.txt route - prevent 404 errors
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow:');
});

// Root route - redirect to simple login page (original design)
app.get('/', (req, res) => {
  res.redirect('/simple-auth/login');
});

// Debug route to test API routes are working
app.get('/debug/routes', (req, res) => {
  res.json({
    message: 'Routes debug endpoint',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /health',
      'GET /auth/login',
      'POST /api/campaigns',
      'GET /api/campaigns',
      'GET /dashboard',
      'GET /create-campaign'
    ],
    version: '3.0-production'
  });
});

// Start server AFTER database initialization
async function startServer() {
  console.log('🚀 Starting bulletproof server...');
  
  // Initialize database first
  const dbInitialized = await initializeDatabase();
  
  // SIMPLE route registration - restore original design
  console.log('📋 Importing and mounting routes...');
  
  try {
    // Import routes dynamically AFTER database is initialized
    const authRoutes = (await import('./routes/auth')).default;
    const simpleAuthRoutes = (await import('./routes/simple-auth')).default;
    const dashboardRoutes = (await import('./routes/dashboard')).default;
    const createCampaignRoutes = (await import('./routes/create-campaign')).default;
    const campaignAnalyticsRoutes = (await import('./routes/campaign-analytics')).default;
    const campaignAnalyticsApiRoutes = (await import('./routes/campaign-analytics-api')).default;
    const campaignRoutes = (await import('./routes/campaigns')).default;
    // const clickRoutes = (await import('./routes/clicks')).default; // DISABLED - using direct handler instead

    // Register routes
    app.use('/auth', authRoutes);
    app.use('/simple-auth', simpleAuthRoutes);
    app.use('/dashboard', dashboardRoutes);
    app.use('/create-campaign', createCampaignRoutes);
    app.use('/campaign-analytics', campaignAnalyticsRoutes);
    app.use('/api/campaign-analytics', campaignAnalyticsApiRoutes);
    app.use('/api/campaigns', campaignRoutes);
    // app.use('/', clickRoutes); // Mount click routes at root level for /c/:campaignId - DISABLED FOR NOW
    
    console.log('✅ All routes registered successfully');
  } catch (error) {
    console.error('❌ Failed to import routes:', error instanceof Error ? error.message : 'Unknown error');
    console.log('⚠️ Server will start with health checks only');
  }
  
  // Simple tracker link handler - directly in main server
  app.get('/c/:campaignId', async (req, res) => {
    const { campaignId } = req.params;
    console.log(`🔗 Tracker link clicked: ${campaignId}`);
    
    try {
      // Make internal request to campaigns API
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      console.log(`📡 Fetching campaigns from: ${baseUrl}/api/campaigns`);
      
      // Use node-fetch or built-in fetch (Node 18+)
      const response = await fetch(`${baseUrl}/api/campaigns`);
      
      if (!response.ok) {
        console.error(`❌ API request failed: ${response.status}`);
        return res.status(404).send('Campaign service unavailable');
      }
      
      const campaigns = await response.json();
      console.log(`📊 Found ${campaigns.length} campaigns`);
      
      const campaign = campaigns.find((c: any) => c.id === campaignId);
      
      if (!campaign) {
        console.log(`❌ Campaign not found: ${campaignId}`);
        return res.status(404).send('Campaign not found');
      }
      
      if (campaign.status !== 'active') {
        console.log(`❌ Campaign not active: ${campaignId} (status: ${campaign.status})`);
        return res.status(410).send('Campaign is not active');
      }
      
      // Track the click - initialize clickId outside try block
      let clickId = 'unknown';
      
      try {
        // Import database and click service
        let clickDb;
        try {
          clickDb = (await import('./services/database')).default;
          console.log('✅ Database imported for click tracking');
        } catch (dbImportError) {
          console.error('❌ Failed to import database for clicks:', dbImportError);
        }
        
        // Ensure clicks table exists
        if (clickDb) {
          try {
            // Disable foreign key constraints temporarily
            clickDb.pragma('foreign_keys = OFF');
            
            clickDb.exec(`
              CREATE TABLE IF NOT EXISTS clicks (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                ip_hash TEXT NOT NULL,
                user_agent TEXT,
                utm_source TEXT,
                utm_medium TEXT,
                utm_campaign TEXT,
                utm_content TEXT,
                utm_term TEXT,
                referrer TEXT,
                clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
              )
            `);
            console.log('✅ Clicks table ensured (FK constraints disabled)');
          } catch (tableError) {
            console.error('❌ Failed to create clicks table:', tableError);
          }
        }
        
        // Direct click tracking without foreign key constraints
        const { v4: uuidv4 } = await import('uuid');
        const crypto = await import('crypto');
        
        // Extract client information
        const clientIP = req.ip || 
                        req.connection?.remoteAddress || 
                        req.socket?.remoteAddress ||
                        '127.0.0.1';
        const userAgent = req.get('User-Agent') || '';
        const referrer = req.get('Referer') || '';
        
        // Generate click ID and hash IP
        clickId = uuidv4();
        const ipHash = crypto.createHash('sha256').update(clientIP + 'salt').digest('hex');
        
        // Extract UTM parameters
        const utmSource = req.query.utm_source as string || null;
        const utmMedium = req.query.utm_medium as string || null;
        const utmCampaign = req.query.utm_campaign as string || null;
        const utmContent = req.query.utm_content as string || null;
        const utmTerm = req.query.utm_term as string || null;
        
        // Insert click directly
        if (clickDb) {
          const insertClick = clickDb.prepare(`
            INSERT INTO clicks (
              id, campaign_id, ip_hash, user_agent, utm_source, utm_medium, 
              utm_campaign, utm_content, utm_term, referrer
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          insertClick.run(
            clickId,
            campaignId,
            ipHash,
            userAgent,
            utmSource,
            utmMedium,
            utmCampaign,
            utmContent,
            utmTerm,
            referrer
          );
          
          console.log(`📊 Click tracked: ${clickId} for campaign ${campaignId}`);
          
          // Set click_id cookie for attribution (expires in 40 days)
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 40);
          
          res.cookie('click_id', clickId, {
            expires: expiryDate,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
          });
        }
        
      } catch (clickError) {
        console.error('❌ Failed to track click:', clickError);
        // Continue with redirect even if click tracking fails
      }
      
      // ALWAYS redirect to Spotify OAuth for authorization and analytics
      // This ensures every click is tracked with user consent
      console.log(`🎵 Initiating Spotify OAuth flow for campaign ${campaignId} (mandatory authorization)`);
      
      try {
        const spotifyService = (await import('./services/spotify')).default;
        
        // Create state parameter with campaign info and destination URL
        const state = JSON.stringify({
          campaignId: campaignId,
          clickId: clickId,
          destinationUrl: campaign.destination_url,
          returnTo: 'destination' // After auth, go to destination
        });
        
        const authUrl = spotifyService.getAuthUrl(Buffer.from(state).toString('base64'));
        console.log(`🔗 Redirecting to Spotify OAuth: ${authUrl}`);
        
        return res.redirect(302, authUrl);
      } catch (spotifyError) {
        console.error('❌ Failed to initiate Spotify OAuth:', spotifyError);
        // Fall back to direct redirect if OAuth fails
        console.log(`⚠️ OAuth failed, redirecting directly to: ${campaign.destination_url}`);
        res.redirect(302, campaign.destination_url);
      }
      
    } catch (error) {
      console.error('❌ Error in tracker link handler:', error);
      res.status(500).send('Internal server error');
    }
  });
  
  // Debug endpoint to test click tracking
  app.get('/debug-click/:campaignId', async (req, res) => {
    const { campaignId } = req.params;
    try {
      console.log(`🔍 Debug click tracking for campaign: ${campaignId}`);
      
      // Import database and click service
      const clickDb = (await import('./services/database')).default;
      const clickService = (await import('./services/clicks')).default;
      
      // Disable foreign key constraints temporarily
      clickDb.pragma('foreign_keys = OFF');
      
      // Ensure clicks table exists (without foreign key constraints for now)
      clickDb.exec(`
        CREATE TABLE IF NOT EXISTS clicks (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          ip_hash TEXT NOT NULL,
          user_agent TEXT,
          utm_source TEXT,
          utm_medium TEXT,
          utm_campaign TEXT,
          utm_content TEXT,
          utm_term TEXT,
          referrer TEXT,
          clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
        )
      `);
      
      // Test click tracking directly
      const { v4: uuidv4 } = await import('uuid');
      const crypto = await import('crypto');
      
      const clickId = uuidv4();
      const ipHash = crypto.createHash('sha256').update('127.0.0.1' + 'salt').digest('hex');
      
      const insertClick = clickDb.prepare(`
        INSERT INTO clicks (
          id, campaign_id, ip_hash, user_agent, utm_source, utm_medium, 
          utm_campaign, utm_content, utm_term, referrer
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertClick.run(
        clickId,
        campaignId,
        ipHash,
        'Debug-Test',
        null, null, null, null, null,
        'debug'
      );
      
      // Get click count
      const getClickCount = clickDb.prepare('SELECT COUNT(*) as count FROM clicks WHERE campaign_id = ?');
      const result = getClickCount.get(campaignId) as { count: number } | undefined;
      
      res.json({
        success: true,
        clickId: clickId,
        campaignId: campaignId,
        totalClicks: result ? result.count : 0,
        message: 'Click tracking test successful'
      });
      
    } catch (error) {
      console.error('Debug click tracking error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack'
      });
    }
  });
  
  console.log('✅ Minimal routes registered - server will continue to start');

  // Add error handling middleware at the end
  app.use(errorLogger);

  // 404 handler - catch any missed requests
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path, method: req.method });
  });

  // Final error middleware - catch any unhandled errors
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[error]", err instanceof Error ? err.message : err);
    
    if (res.headersSent) {
      return next(err);
    }
    
    res.status(err.status || 500).json({ 
      message: err.message || "Server error",
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    });
  });
  
  const server = app.listen(PORT, "0.0.0.0", () => {
    // Railway-specific logging
    console.log(`🚀 Bulletproof Railway Deployment Ready`);
    console.log(`📡 Server listening on port ${PORT}`);
    console.log(`🌐 Binding to 0.0.0.0 (all interfaces)`);
    console.log(`🏥 Health check available at /health`);
    console.log(`🗄️ Database initialized: ${dbInitialized ? '✅' : '❌'}`);
    
    // Print Spotify OAuth configuration
    console.log('🎵 Spotify OAuth Configuration:');
    console.log(`📱 Client ID: ${process.env.SPOTIFY_CLIENT_ID ? process.env.SPOTIFY_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET'}`);
    console.log(`🔗 Redirect URI: ${process.env.SPOTIFY_REDIRECT_URI || 'NOT SET'}`);
    console.log(`🔐 Client Secret: ${process.env.SPOTIFY_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);
    console.log(`🔧 Base path "/auth" mounted for OAuth flow`);
    
    // Log all registered routes
    logRegisteredRoutes();
    
    logger.info(`Bulletproof Sunday Link server started successfully`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      host: "0.0.0.0",
      railway: process.env.RAILWAY_ENVIRONMENT || 'local',
      databaseInitialized: dbInitialized
    });
    
    logger.info(`Server endpoints available`, {
      dashboard: `http://localhost:${PORT}/dashboard`,
      login: `http://localhost:${PORT}/auth/login`,
      health: `http://localhost:${PORT}/health`,
      analytics: `http://localhost:${PORT}/advanced-analytics`,
      callback: `http://localhost:${PORT}/auth/spotify/callback`
    });
    
    // Start background services only if database is ready and not on Railway
    if (dbInitialized) {
      console.log('🔄 Starting background services...');
      setTimeout(async () => {
        try {
          // Import services only after database is ready
          try {
            const pollingService = (await import('./services/polling')).default;
            console.log('✅ Polling service imported successfully');
  pollingService.start();
            console.log('✅ Polling service started');
          } catch (pollingError) {
            console.error('❌ Failed to start polling service:', pollingError);
          }
          
          try {
            const cleanupService = (await import('./services/cleanup')).default;
  cleanupService.start();
            console.log('✅ Cleanup service started');
          } catch (cleanupError) {
            console.error('❌ Failed to start cleanup service:', cleanupError);
          }
          logManager.scheduleLogManagement();
          
          logger.info('All background services started successfully!');
          console.log(`✅ All services ready`);
        } catch (error) {
          logger.error('Some background services failed to start, but server is still running', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.log(`⚠️ Some services failed, but server is still running`);
        }
      }, 2000);
    } else if (IS_RAILWAY) {
      console.log(`🚂 Railway detected - skipping background services for health check reliability`);
      console.log(`✅ Railway deployment ready - health checks should pass`);
      console.log(`🏥 Health endpoints: /health, /healthz, /ping`);
    }
  });

  // Handle EADDRINUSE gracefully
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use`, {
        port: PORT,
        error: err.message,
        suggestion: `Run: lsof -ti:${PORT} | xargs kill -9`
      });
      process.exit(1);
    } else {
      logger.error('Server error occurred', {
        error: err.message,
        code: err.code
      }, err);
      process.exit(1);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    server.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });
  });
  
  return server;
}

// Debug endpoint to test Spotify token exchange
app.get('/debug-spotify-token-test', async (req, res) => {
  try {
    const { default: spotifyService } = await import('./services/spotify');
    
    if (!spotifyService) {
      return res.status(503).json({ error: 'Spotify service not available' });
    }

    // Test with a fake code to see what error we get
    try {
      await spotifyService.exchangeCodeForTokens('fake-code-123');
      res.json({ success: true, message: 'Token exchange succeeded (unexpected)' });
    } catch (tokenError) {
      res.json({
        error: 'Token exchange failed as expected',
        details: tokenError instanceof Error ? tokenError.message : tokenError,
        spotify_config: {
          client_id: process.env.SPOTIFY_CLIENT_ID ? 'Set' : 'Missing',
          client_secret: process.env.SPOTIFY_CLIENT_SECRET ? 'Set' : 'Missing',
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'Not set'
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Test failed', details: error instanceof Error ? error.message : error });
  }
});

// Debug endpoint to check Spotify app configuration
app.get('/debug-spotify-config', async (req, res) => {
  try {
    const { default: spotifyService } = await import('./services/spotify');
    
    const currentDomain = req.get('host');
    const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const fullCurrentUrl = `${protocol}://${currentDomain}`;
    const recommendedRedirectUri = `${fullCurrentUrl}/auth/spotify/callback`;
    
    res.json({
      spotify_service_available: !!spotifyService,
      current_request_info: {
        domain: currentDomain,
        protocol: protocol,
        full_url: fullCurrentUrl,
        timestamp: new Date().toISOString()
      },
      configuration: {
        client_id: process.env.SPOTIFY_CLIENT_ID ? `${process.env.SPOTIFY_CLIENT_ID.substring(0, 8)}...` : 'Missing',
        client_secret: process.env.SPOTIFY_CLIENT_SECRET ? 'Set' : 'Missing',
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'Not set',
        recommended_redirect_uri: recommendedRedirectUri,
        redirect_uri_matches: process.env.SPOTIFY_REDIRECT_URI === recommendedRedirectUri
      },
      instructions: {
        spotify_app_settings: 'Go to https://developer.spotify.com/dashboard/applications',
        redirect_uri_setting: `Make sure the redirect URI is EXACTLY: ${recommendedRedirectUri}`,
        note: 'The redirect URI must match exactly - no trailing slashes, no http vs https differences',
        fix_redirect_uri: `Set SPOTIFY_REDIRECT_URI=${recommendedRedirectUri} in your Railway environment variables`
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check config', details: error instanceof Error ? error.message : error });
  }
});

// Debug endpoint to test OAuth flow and check for issues
app.get('/debug-oauth-flow', async (req, res) => {
  try {
    const { default: spotifyService } = await import('./services/spotify');
    
    // Generate a test auth URL
    const testState = 'debug_test_' + Date.now();
    const authUrl = spotifyService.getAuthUrl(testState);
    
    res.json({
      test_auth_url: authUrl,
      test_state: testState,
      instructions: {
        step1: 'Copy the test_auth_url and paste it in your browser',
        step2: 'Complete the Spotify authorization',
        step3: 'Check the callback URL for any errors',
        step4: 'If you get "invalid_grant", the code was already used - this is normal for testing',
        note: 'This is a test flow - use it to verify your redirect URI is correct'
      },
      troubleshooting: {
        invalid_grant: 'This means the authorization code was already used (normal for testing)',
        redirect_uri_mismatch: 'Check that your Spotify app redirect URI matches your current domain',
        code_expired: 'Authorization codes expire in ~10 minutes'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate test OAuth flow', details: error instanceof Error ? error.message : error });
  }
});

// Debug endpoint to clear playlist cache
app.get('/debug-clear-playlist-cache/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { default: playlistCache } = await import('./services/playlist-cache');
    
    await playlistCache.clearCache(playlistId);
    
    res.json({
      message: `Cleared cache for playlist ${playlistId}`,
      playlistId: playlistId
    });
  } catch (error) {
    console.error('Error clearing playlist cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear playlist cache', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Debug endpoint to clear all playlist cache
app.get('/debug-clear-playlist-cache', async (req, res) => {
  try {
    const { default: playlistCache } = await import('./services/playlist-cache');
    
    await playlistCache.clearCache();
    
    res.json({
      message: 'Cleared all playlist cache',
      playlistId: 'all'
    });
  } catch (error) {
    console.error('Error clearing playlist cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear playlist cache', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Debug endpoint to show detailed play data for campaigns
app.get('/debug-play-data/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { default: database } = await import('./services/database');
    
    // Get detailed play data for this campaign
    const plays = database.prepare(`
      SELECT 
        a.id as attribution_id,
        a.created_at as attribution_date,
        p.spotify_track_id,
        p.track_name,
        p.artist_name,
        p.album_name,
        p.duration_ms,
        u.display_name as user_name,
        u.email as user_email,
        s.created_at as session_date
      FROM attributions a
      JOIN plays p ON a.play_id = p.id
      JOIN sessions s ON a.click_id = s.click_id
      JOIN users u ON s.user_id = u.id
      WHERE a.campaign_id = ? 
      AND a.expires_at > datetime('now')
      ORDER BY a.created_at DESC
    `).all(campaignId);
    
    // Get campaign info
    const campaign = database.prepare(`
      SELECT name, destination_url, created_at 
      FROM campaigns 
      WHERE id = ? AND expires_at > datetime('now')
    `).get(campaignId);
    
    // Get summary stats
    const summary = database.prepare(`
      SELECT 
        COUNT(DISTINCT a.id) as total_streams,
        COUNT(DISTINCT p.spotify_track_id) as unique_songs,
        COUNT(DISTINCT s.user_id) as unique_listeners
      FROM attributions a
      JOIN plays p ON a.play_id = p.id
      JOIN sessions s ON a.click_id = s.click_id
      WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
    `).get(campaignId);
    
    res.json({
      campaign: campaign,
      summary: summary,
      plays: plays,
      play_count: plays.length,
      message: `Found ${plays.length} plays for campaign ${campaignId}`
    });
  } catch (error) {
    console.error('Error getting play data:', error);
    res.status(500).json({ 
      error: 'Failed to get play data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Start the bulletproof server
startServer().catch((error) => {
  logger.error('Failed to start bulletproof server', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  console.error('💥 BULLETPROOF SERVER FAILED TO START:', error);
  process.exit(1);
});

export default app;
// Railway deployment trigger 1758542167
// Analytics deployment Mon Sep 22 14:52:35 CEST 2025
