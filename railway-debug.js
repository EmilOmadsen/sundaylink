console.log('STARTING RAILWAY DEBUG SERVER...');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PWD:', process.cwd());

const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('Creating server on port:', PORT);

const server = http.createServer((req, res) => {
  console.log('REQUEST:', req.method, req.url);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  
  if (req.url === '/health') {
    res.end('{"status":"ok"}');
  } else {
    res.end('{"message":"debug server working","url":"' + req.url + '"}');
  }
});

server.on('error', (err) => {
  console.error('SERVER ERROR:', err);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ DEBUG SERVER LISTENING ON PORT', PORT);
  console.log('✅ Health check available at /health');
});

console.log('Server setup complete');

// Keep alive
setInterval(() => {
  console.log('ALIVE:', new Date().toISOString());
}, 10000);
