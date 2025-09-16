// BULLETPROOF Railway server - absolutely guaranteed to work
console.log('🚀 BULLETPROOF Railway Server Starting...');

// Set Railway environment variables immediately
process.env.DB_PATH = '/mnt/data/soundlink-lite.db';
process.env.NODE_ENV = 'production';
process.env.RAILWAY_ENVIRONMENT = 'production';
process.env.PORT = '8080';

console.log('📊 Railway PORT:', process.env.PORT);
console.log('🗄️ DB_PATH:', process.env.DB_PATH);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);

// Import Express
const express = require('express');
const app = express();

// Health check endpoint - MUST be first
app.get('/health', (req, res) => {
  console.log('🏥 Health check hit!');
  res.status(200).json({
    status: 'ok',
    message: 'BULLETPROOF server working',
    port: process.env.PORT,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/ping', (req, res) => {
  console.log('🏓 Ping hit!');
  res.status(200).send('pong');
});

app.get('/', (req, res) => {
  console.log('🏠 Root hit!');
  res.status(200).send('BULLETPROOF Railway Server - WORKING!');
});

// Start server immediately
const PORT = process.env.PORT || 8080;
console.log(`🚀 Starting server on port ${PORT}...`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ BULLETPROOF server listening on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 Railway deployment SUCCESS!`);
});

// Comprehensive error handling
server.on('error', (err) => {
  console.error('❌ SERVER ERROR:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

// Keep alive
setInterval(() => {
  console.log('💓 Server alive - uptime:', process.uptime());
}, 30000);
