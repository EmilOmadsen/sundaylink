// Ultra-simple Railway server - guaranteed to work
const express = require('express');
const app = express();

// Set Railway environment variables
process.env.DB_PATH = '/mnt/data/soundlink-lite.db';
process.env.NODE_ENV = 'production';
process.env.RAILWAY_ENVIRONMENT = 'production';

console.log('🚂 Railway Simple Server Starting...');
console.log('🗄️ DB_PATH:', process.env.DB_PATH);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('📊 Railway PORT:', process.env.PORT);
console.log('📊 Using PORT:', process.env.PORT || '8080');

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.status(200).send('Sunday Link - Railway Simple Server');
});

// Start server
const PORT = process.env.PORT || 8080;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'production',
    railway_port: process.env.PORT,
    actual_port: PORT,
    railway: 'production',
    mode: 'simple'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple server listening on port ${PORT}`);
  console.log(`🏥 Health check available at /health`);
  console.log(`✅ Railway deployment ready`);
});

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('UnhandledRejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});
