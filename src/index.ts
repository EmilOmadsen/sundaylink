import dotenv from 'dotenv';

// MUST load environment variables FIRST before any other imports
dotenv.config();

// Import logger after env is loaded
import logger from './utils/logger';
import logManager from './utils/logManager';
import { requestLogger, errorLogger } from './middleware/requestLogger';

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

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// Import routes
import campaignRoutes from './routes/campaigns';
import clickRoutes from './routes/clicks';
import authRoutes from './routes/auth';
import simpleAuthRoutes from './routes/simple-auth';
import metricsRoutes from './routes/metrics';
import dashboardRoutes from './routes/dashboard';
import createCampaignRoutes from './routes/create-campaign';
import advancedAnalyticsRoutes from './routes/advanced-analytics';

// Import services
import pollingService from './services/polling';
import cleanupService from './services/cleanup';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for getting real IP addresses
app.set('trust proxy', true);

// Add request logging middleware
app.use(requestLogger);

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
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from root directory and public directory
app.use(express.static('.'));
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    logStats: logger.getLogStats(),
    logManagerStats: logManager.getLogStats()
  };
  
  logger.debug('Health check requested', { 
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.json(healthData);
});

// Root route - redirect to login
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// API routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/metrics', metricsRoutes);

// Auth routes
app.use('/auth', authRoutes);
app.use('/simple-auth', simpleAuthRoutes);

// Dashboard route
app.use('/dashboard', dashboardRoutes);

// Create campaign route
app.use('/create-campaign', createCampaignRoutes);

// Advanced Analytics route
app.use('/advanced-analytics', advancedAnalyticsRoutes);

// Click tracking routes (no /api prefix for clean URLs)
app.use('/', clickRoutes);

const server = app.listen(PORT, () => {
  logger.info(`Sunday Link server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform
  });
  
  logger.info(`Server endpoints available`, {
    dashboard: `http://localhost:${PORT}/dashboard`,
    login: `http://localhost:${PORT}/auth/login`,
    health: `http://localhost:${PORT}/health`,
    analytics: `http://localhost:${PORT}/advanced-analytics`
  });
  
  // Start background services
  logger.info('Starting background services...');
  pollingService.start();
  cleanupService.start();
  
  // Start log management
  logManager.scheduleLogManagement();
  
  logger.info('All services started successfully!');
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

// Add error handling middleware at the end
app.use(errorLogger);

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

export default app;