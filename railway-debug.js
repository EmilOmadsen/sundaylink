#!/usr/bin/env node

// Simple Railway debug server to test deployment
console.log('🚂 Railway Debug Server Starting...');
console.log('📅 Build Time:', new Date().toISOString());
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('📊 Port:', process.env.PORT || '3000');

const express = require('express');
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: 'debug-v3.0',
    deployment: 'latest'
  });
});

// Debug routes
app.get('/debug/routes', (req, res) => {
  res.json({
    message: 'Debug server is running',
    timestamp: new Date().toISOString(),
    version: 'debug-v3.0',
    routes_working: true
  });
});

// Test campaigns endpoint
app.post('/api/campaigns', (req, res) => {
  console.log('📝 POST /api/campaigns received:', req.body);
  res.json({
    success: true,
    message: 'Campaign API is working',
    received_data: req.body,
    smart_link_url: `https://sundaylink-production.up.railway.app/c/test123`,
    version: 'debug-v3.0'
  });
});

app.get('/api/campaigns', (req, res) => {
  res.json({
    campaigns: [],
    message: 'Campaigns API is working',
    version: 'debug-v3.0'
  });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/debug/routes');
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Path not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method,
    version: 'debug-v3.0'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Railway Debug Server Ready!');
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔗 Debug: http://localhost:${PORT}/debug/routes`);
  console.log(`🔗 Campaigns: http://localhost:${PORT}/api/campaigns`);
  console.log('✅ This should fix the Not found errors!');
});
