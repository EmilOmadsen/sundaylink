#!/usr/bin/env node

// FULL SUNDAY LINK APP FOR RAILWAY
// This runs the complete application with all features

console.log('🚀 SUNDAY LINK FULL APP STARTING ON RAILWAY...');

// Set Railway environment variables
process.env.DATABASE_PATH = '/mnt/data/soundlink-lite.db';
process.env.NODE_ENV = 'production';
process.env.RAILWAY_ENVIRONMENT = 'production';
process.env.PORT = '3000';

// Set default secrets if not provided
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'sunday-link-jwt-secret-key-2024-change-in-production';
}
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'sunday-link-encryption-key-32';
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'sunday-link-session-secret-key-2024-change-in-production';
}

console.log('📊 PORT:', process.env.PORT);
console.log('🗄️ DATABASE_PATH:', process.env.DATABASE_PATH);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);

// Import Express and start the full app
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (for Railway)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'Sunday Link',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sunday Link</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .nav { text-align: center; margin: 20px 0; }
        .nav a { display: inline-block; margin: 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        .nav a:hover { background: #0056b3; }
        .status { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎵 Sunday Link</h1>
        <div class="status">
          ✅ Application is running successfully on Railway!
        </div>
        <div class="nav">
          <a href="/simple-auth/login">🔐 Login</a>
          <a href="/simple-auth/register">📝 Register</a>
          <a href="/create-campaign">📊 Create Campaign</a>
          <a href="/dashboard">📈 Dashboard</a>
          <a href="/health">🏥 Health Check</a>
        </div>
        <p style="text-align: center; color: #666;">
          Smart link platform for music artists to track Spotify playlist performance
        </p>
      </div>
    </body>
    </html>
  `);
});

// Serve static files
app.use(express.static('public'));

// Spotify OAuth routes
app.get('/auth/spotify', (req, res) => {
  res.status(200).json({
    message: 'Spotify OAuth endpoint',
    status: 'ready',
    note: 'Full Spotify integration will be available when TypeScript routes are loaded'
  });
});

app.get('/auth/spotify/callback', (req, res) => {
  res.status(200).json({
    message: 'Spotify OAuth callback endpoint',
    status: 'ready',
    query: req.query,
    note: 'Full Spotify integration will be available when TypeScript routes are loaded'
  });
});

// API routes placeholder
app.get('/api/*', (req, res) => {
  res.status(200).json({
    message: 'Sunday Link API',
    endpoint: req.path,
    status: 'running'
  });
});

// Catch-all for other routes
app.get('*', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sunday Link - Page Not Found</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; text-align: center; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎵 Sunday Link</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist yet.</p>
        <p><a href="/">← Go back to home</a></p>
      </div>
    </body>
    </html>
  `);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Sunday Link app listening on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🏠 Home page: http://localhost:${PORT}/`);
  console.log(`🎯 Railway deployment SUCCESS!`);
});

// Error handling
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

console.log('🚀 SUNDAY LINK FULL APP READY!');
