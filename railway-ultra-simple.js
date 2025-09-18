const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/health' || req.url === '/ping' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      port: PORT,
      mode: 'ultra-simple'
    }));
    return;
  }
  
  if (req.url === '/') {
    res.writeHead(302, { 'Location': '/create-campaign' });
    res.end();
    return;
  }
  
  if (req.url.startsWith('/create-campaign')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sundaylink - Create Campaign</title>
        <script>
          window.ENV = { VITE_API_URL: "${req.headers.host ? 'https://' + req.headers.host : 'http://localhost:3000'}" };
          const API_BASE = window.ENV.VITE_API_URL;
          console.log("API_BASE:", API_BASE);
        </script>
      </head>
      <body>
        <h1>🔗 Create Campaign</h1>
        <form id="form">
          <div>
            <label>Name:</label>
            <input type="text" name="name" required>
          </div>
          <div>
            <label>URL:</label>
            <input type="url" name="destination_url" required>
          </div>
          <button type="submit">Create</button>
          <button type="button" onclick="test()">Test API</button>
        </form>
        <div id="result"></div>
        
        <script>
          function test() {
            fetch(API_BASE + '/api/test')
              .then(r => r.json())
              .then(d => document.getElementById('result').innerHTML = 
                '<h3>✅ API Works:</h3>' + JSON.stringify(d))
              .catch(e => document.getElementById('result').innerHTML = 
                '<h3>❌ API Failed:</h3>' + e.message);
          }
          
          document.getElementById('form').onsubmit = async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            
            try {
              const r = await fetch(API_BASE + '/api/campaigns', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
              });
              const result = await r.json();
              
              if (r.ok) {
                document.getElementById('result').innerHTML = 
                  '<h3>✅ Campaign Created:</h3>' +
                  '<p>Name: ' + result.name + '</p>' +
                  '<p>Link: <a href="' + result.smart_link_url + '">' + result.smart_link_url + '</a></p>';
              } else {
                throw new Error(result.error);
              }
            } catch (e) {
              document.getElementById('result').innerHTML = '<h3>❌ Error:</h3>' + e.message;
            }
          };
        </script>
      </body>
      </html>
    `);
    return;
  }
  
  if (req.url === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Ultra simple API working!',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  if (req.url === '/api/campaigns' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const campaign = {
          id: 'simple_' + Date.now(),
          name: data.name,
          destination_url: data.destination_url,
          smart_link_url: \`https://\${req.headers.host}/c/simple_\${Date.now()}\`,
          status: 'active',
          created_at: new Date().toISOString()
        };
        
        console.log('✅ Campaign created:', campaign);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(campaign));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path: req.url }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚨 ULTRA SIMPLE SERVER RUNNING ON PORT \${PORT}\`);
  console.log(\`🏥 Health: http://localhost:\${PORT}/health\`);
  console.log(\`🔗 App: http://localhost:\${PORT}/create-campaign\`);
});

// Heartbeat to keep Railway happy
setInterval(() => {
  console.log(\`💓 Heartbeat - \${new Date().toISOString()}\`);
}, 30000);
