#!/usr/bin/env node

// NUCLEAR OPTION - RAILWAY SERVER THAT CANNOT FAIL
// This is the most basic server possible

console.log('🚀 NUCLEAR RAILWAY SERVER STARTING...');

// Force port 3000
process.env.PORT = '3000';
const PORT = 3000;

console.log('📊 PORT:', PORT);
console.log('🎯 NUCLEAR MODE ACTIVATED');

// Create server with absolute minimal code
const http = require('http');

const server = http.createServer((req, res) => {
  // Log every request
  console.log(`📡 ${req.method} ${req.url}`);
  
  // Set basic headers
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  
  // Handle ALL requests the same way
  res.statusCode = 200;
  res.end('OK');
  
  console.log(`✅ Response sent for ${req.url}`);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ NUCLEAR server listening on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 NUCLEAR DEPLOYMENT SUCCESS!`);
});

// Error handling
server.on('error', (err) => {
  console.error('❌ NUCLEAR server error:', err);
  process.exit(1);
});

// Keep alive
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM - NUCLEAR shutdown');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT - NUCLEAR shutdown');
  server.close(() => process.exit(0));
});

console.log('🚀 NUCLEAR SERVER READY!');
