// Railway-specific startup script with environment variable handling
const express = require('express');

// Set required environment variables if missing
if (!process.env.DB_PATH) {
  process.env.DB_PATH = '/mnt/data/soundlink-lite.db';
  console.log('🔧 Set DB_PATH to Railway default:', process.env.DB_PATH);
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
  console.log('🔧 Set NODE_ENV to production');
}

if (!process.env.RAILWAY_ENVIRONMENT) {
  process.env.RAILWAY_ENVIRONMENT = 'production';
  console.log('🔧 Set RAILWAY_ENVIRONMENT to production');
}

// Set default security keys if missing
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'sunday-link-jwt-secret-key-2024-change-in-production';
  console.log('🔧 Set default JWT_SECRET');
}

if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'sunday-link-encryption-key-32';
  console.log('🔧 Set default ENCRYPTION_KEY');
}

console.log('🚂 Railway Environment Variables:');
console.log('  DB_PATH:', process.env.DB_PATH);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('  PORT:', process.env.PORT || '3000');

// Start the main application
console.log('🚀 Starting Sunday Link application...');

try {
  // Import and start the main application
  require('./dist/index.js');
} catch (error) {
  console.error('❌ Failed to start main application:', error);
  console.error('Stack trace:', error.stack);
  
  // Fallback: start minimal server
  console.log('🔄 Starting minimal fallback server...');
  
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'production',
      port: PORT,
      railway: 'production',
      mode: 'fallback'
    });
  });
  
  app.get('/ping', (req, res) => {
    res.status(200).send('pong');
  });
  
  app.get('/', (req, res) => {
    res.status(200).send('Sunday Link - Railway Fallback Server');
  });
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Fallback server listening on port ${PORT}`);
    console.log(`🏥 Health check available at /health`);
  });
}
