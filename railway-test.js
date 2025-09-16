// Ultra-minimal Railway test server
const express = require('express');
const app = express();

console.log('🚀 Railway Test Server Starting...');
console.log('📊 PORT from Railway:', process.env.PORT);

// Immediate health check
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.status(200).json({ status: 'ok', port: process.env.PORT, time: new Date().toISOString() });
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get('/', (req, res) => {
  res.status(200).send('Railway Test Server OK');
});

// Start immediately
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Handle errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
});
