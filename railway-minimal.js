// Ultra-minimal Railway health check server
const express = require('express');
const app = express();

// Health check endpoints - NO dependencies, NO middleware, NO imports
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get('/test', (req, res) => {
  res.status(200).send('Railway test endpoint working');
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).send('Sunday Link - Railway Minimal Server');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Minimal Railway server listening on port ${PORT}`);
  console.log(`🏥 Health check available at /health`);
  console.log(`🏥 Health check available at /ping`);
});

// Handle errors gracefully
process.on('unhandledRejection', (err) => {
  console.error('UnhandledRejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});
