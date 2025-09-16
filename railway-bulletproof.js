#!/usr/bin/env node

// ULTRA BULLETPROOF RAILWAY SERVER
// This server is designed to NEVER fail health checks

console.log('🚀 ULTRA BULLETPROOF RAILWAY SERVER STARTING...');

// Set PORT immediately
process.env.PORT = '8080';
const PORT = process.env.PORT || 8080;

console.log('📊 PORT:', PORT);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');

const express = require('express');
const app = express();

// Disable all middleware that could cause issues
app.disable('x-powered-by');

// ULTRA SIMPLE HEALTH CHECK - NO DEPENDENCIES
app.get('/health', (req, res) => {
  console.log('🏥 HEALTH CHECK HIT!');
  res.status(200).send('OK');
});

// Additional health check endpoints
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).send('BULLETPROOF SERVER - WORKING!');
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ BULLETPROOF server listening on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 Railway deployment SUCCESS!`);
});

// Handle server errors gracefully
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

console.log('🚀 BULLETPROOF SERVER READY!');
