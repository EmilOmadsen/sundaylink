import dotenv from 'dotenv';

// MUST load environment variables FIRST before any other imports
dotenv.config();

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

// Import services
import pollingService from './services/polling';
import cleanupService from './services/cleanup';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for getting real IP addresses
app.set('trust proxy', true);

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
      // XHR/Fetch to same-origin APIs
      "connect-src": ["'self'"]
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Click tracking routes (no /api prefix for clean URLs)
app.use('/', clickRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Sundaylink server is running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🔐 Login: http://localhost:${PORT}/auth/login`);
  
  // Start background services
  console.log('🎵 Starting background services...');
  pollingService.start();
  cleanupService.start();
  
  console.log('✅ All services started successfully!');
});

export default app;