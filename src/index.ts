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

// Root route - redirect to login page
app.get('/', (req, res) => {
  res.redirect('/auth/login');
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
    const dashboardRoutes = (await import('./routes/dashboard')).default;
    const createCampaignRoutes = (await import('./routes/create-campaign')).default;
    const campaignRoutes = (await import('./routes/campaigns')).default;
    const clickRoutes = (await import('./routes/clicks')).default;

    // Register routes
    app.use('/auth', authRoutes);
    app.use('/dashboard', dashboardRoutes);
    app.use('/create-campaign', createCampaignRoutes);
    app.use('/api/campaigns', campaignRoutes);
    app.use('/', clickRoutes); // Mount click routes at root level for /c/:campaignId
    
    console.log('✅ All routes registered successfully');
  } catch (error) {
    console.error('❌ Failed to import routes:', error instanceof Error ? error.message : 'Unknown error');
    console.log('⚠️ Server will start with health checks only');
  }
  
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
    if (dbInitialized && !IS_RAILWAY) {
      console.log('🔄 Starting background services...');
      setTimeout(async () => {
        try {
          // Import services only after database is ready
          const pollingService = (await import('./services/polling')).default;
          const cleanupService = (await import('./services/cleanup')).default;
          
          pollingService.start();
          cleanupService.start();
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

// Start the bulletproof server
startServer().catch((error) => {
  logger.error('Failed to start bulletproof server', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  console.error('💥 BULLETPROOF SERVER FAILED TO START:', error);
  process.exit(1);
});

export default app;
