const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('🚀 STARTING WORKING SERVER ON PORT', PORT);

const server = http.createServer((req, res) => {
  console.log(req.method, req.url);
  
  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      port: PORT
    }));
    return;
  }
  
  // Root
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Sundaylink</title></head>
      <body>
        <h1>🔗 Sundaylink</h1>
        <p>✅ Server is working!</p>
        <p><a href="/create-campaign">Create Campaign</a></p>
      </body>
      </html>
    `);
    return;
  }
  
  // Create campaign page
  if (req.url.startsWith('/create-campaign')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Create Campaign</title>
      </head>
      <body>
        <h1>🔗 Create Campaign</h1>
        <form id="form">
          <div style="margin: 10px 0;">
            <label>Campaign Name:</label><br>
            <input type="text" name="name" required style="width: 300px; padding: 5px;">
          </div>
          <div style="margin: 10px 0;">
            <label>Destination URL:</label><br>
            <input type="url" name="destination_url" required style="width: 300px; padding: 5px;">
          </div>
          <button type="submit">Create Campaign</button>
          <button type="button" onclick="testHealth()">Test Health</button>
        </form>
        
        <div id="result" style="margin-top: 20px; padding: 10px; border: 1px solid #ccc;"></div>
        
        <script>
          console.log("API_BASE: https://sundaylink-production.up.railway.app");
          
          function testHealth() {
            fetch('/health')
              .then(r => r.json())
              .then(data => {
                document.getElementById('result').innerHTML = 
                  '<h3>✅ Health Check Success:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
              })
              .catch(err => {
                document.getElementById('result').innerHTML = '<h3>❌ Health Failed:</h3>' + err.message;
              });
          }
          
          document.getElementById('form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            document.getElementById('result').innerHTML = '<h3>✅ Form Submitted Successfully!</h3>' +
              '<p>Name: ' + data.name + '</p>' +
              '<p>URL: ' + data.destination_url + '</p>' +
              '<p>No page reload occurred!</p>';
          });
        </script>
      </body>
      </html>
    `);
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', url: req.url }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ SERVER LISTENING ON PORT', PORT);
});

setInterval(() => {
  console.log('💓 ALIVE:', new Date().toISOString());
}, 30000);
