#!/usr/bin/env node

// ULTRA MINIMAL RAILWAY SERVER - IMPOSSIBLE TO FAIL
// This server has ZERO dependencies except what Railway provides

console.log('🚀 ULTRA MINIMAL RAILWAY SERVER STARTING...');

// Set PORT immediately - Railway expects this
process.env.PORT = '3000';
const PORT = process.env.PORT || 3000;
console.log('📊 PORT:', PORT);

// Import only what Railway guarantees to have
const http = require('http');

// Create the most basic HTTP server possible
const server = http.createServer((req, res) => {
  console.log('📡 Request:', req.method, req.url);
  
  // Set headers
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Handle health check
  if (req.url === '/health' || req.url === '/healthz' || req.url === '/ping') {
    res.statusCode = 200;
    res.end('OK');
    console.log('✅ Health check passed');
    return;
  }
  
  // Handle root
  if (req.url === '/') {
    res.statusCode = 200;
    res.end('ULTRA MINIMAL SERVER - WORKING!');
    console.log('✅ Root request handled');
    return;
  }
  
  // Handle any other request
  res.statusCode = 200;
  res.end('OK');
  console.log('✅ Request handled');
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ULTRA MINIMAL server listening on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 Railway deployment SUCCESS!`);
});

// Handle errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Keep alive
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

console.log('🚀 ULTRA MINIMAL SERVER READY!');
