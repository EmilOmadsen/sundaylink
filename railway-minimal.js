const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log(req.method + ' ' + req.url);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/health' || req.url === '/ping') {
    res.writeHead(200);
    res.end('{"status":"ok","timestamp":"' + new Date().toISOString() + '"}');
    return;
  }
  
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Sundaylink Works!</h1><p><a href="/create-campaign">Create Campaign</a></p>');
    return;
  }
  
  if (req.url === '/create-campaign') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
      <head><title>Create Campaign</title></head>
      <body>
        <h1>Create Campaign</h1>
        <form id="f">
          <input name="name" placeholder="Name" required>
          <input name="destination_url" placeholder="URL" required>
          <button type="submit">Create</button>
        </form>
        <div id="r"></div>
        <script>
          console.log("API_BASE: https://sundaylink-production.up.railway.app");
          document.getElementById('f').onsubmit = async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            try {
              const res = await fetch('/api/campaigns', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
              });
              const result = await res.json();
              document.getElementById('r').innerHTML = res.ok ? 
                'SUCCESS: ' + result.name + ' - ' + result.smart_link_url :
                'ERROR: ' + (result.error || 'Failed');
            } catch (e) {
              document.getElementById('r').innerHTML = 'ERROR: ' + e.message;
            }
          };
        </script>
      </body>
      </html>
    `);
    return;
  }
  
  if (req.url === '/api/campaigns' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const result = {
          id: 'camp_' + Date.now(),
          name: data.name,
          destination_url: data.destination_url,
          smart_link_url: 'https://' + req.headers.host + '/c/' + Date.now(),
          status: 'active',
          created_at: new Date().toISOString()
        };
        res.writeHead(201);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400);
        res.end('{"error":"Invalid JSON"}');
      }
    });
    return;
  }
  
  res.writeHead(404);
  res.end('{"error":"Not found"}');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('SERVER RUNNING ON PORT ' + PORT);
});

setInterval(() => console.log('HEARTBEAT'), 30000);
