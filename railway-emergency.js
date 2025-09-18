const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(cors({
  origin: ["https://sundaylink-production.up.railway.app", "http://localhost:3000"],
  credentials: true
}));

// Health check - ALWAYS works
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: 'emergency-mode'
  });
});

app.get('/ping', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.send('OK'));

// Basic routes
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

app.get('/auth/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Sundaylink - Login</title></head>
    <body>
      <h1>🔗 Sundaylink</h1>
      <p>Emergency mode - service is starting up</p>
      <a href="/create-campaign">Create Campaign</a> | 
      <a href="/dashboard">Dashboard</a>
    </body>
    </html>
  `);
});

app.get('/create-campaign', (req, res) => {
  // Remove query parameters
  if (Object.keys(req.query || {}).length > 0) {
    return res.redirect(303, "/create-campaign");
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Create Campaign</title>
      <script>
        window.ENV = { VITE_API_URL: "${req.protocol}://${req.get('host')}" };
        const API_BASE = window.ENV.VITE_API_URL;
        console.log("API_BASE:", API_BASE);
      </script>
    </head>
    <body>
      <h1>🔗 Create Campaign</h1>
      <form id="campaign-form">
        <div>
          <label>Campaign Name:</label>
          <input type="text" name="name" required placeholder="My Campaign">
        </div>
        <div>
          <label>Destination URL:</label>
          <input type="url" name="destination_url" required placeholder="https://open.spotify.com/track/...">
        </div>
        <button type="submit">Create Campaign</button>
        <button type="button" onclick="testAPI()">Test API</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        function testAPI() {
          fetch(API_BASE + '/api/campaigns/test')
            .then(r => r.json())
            .then(data => {
              document.getElementById('result').innerHTML = 
                '<h3>✅ API Test Success:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            })
            .catch(err => {
              document.getElementById('result').innerHTML = 
                '<h3>❌ API Test Failed:</h3>' + err.message;
            });
        }
        
        document.getElementById('campaign-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          
          try {
            const response = await fetch(API_BASE + '/api/campaigns', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              document.getElementById('result').innerHTML = 
                '<h3>✅ Campaign Created:</h3>' +
                '<p><strong>Name:</strong> ' + result.name + '</p>' +
                '<p><strong>Smart Link:</strong> <a href="' + result.smart_link_url + '">' + result.smart_link_url + '</a></p>';
            } else {
              throw new Error(result.error || 'Failed to create campaign');
            }
          } catch (error) {
            document.getElementById('result').innerHTML = 
              '<h3>❌ Error:</h3>' + error.message;
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Dashboard</title></head>
    <body>
      <h1>📊 Dashboard</h1>
      <p>Emergency mode - basic functionality</p>
      <a href="/create-campaign">Create Campaign</a>
    </body>
    </html>
  `);
});

// API routes
app.get('/api/campaigns/test', (req, res) => {
  res.json({
    message: 'Emergency API working!',
    timestamp: new Date().toISOString(),
    mode: 'emergency'
  });
});

app.post('/api/campaigns', (req, res) => {
  const { name, destination_url } = req.body;
  
  if (!name || !destination_url) {
    return res.status(400).json({ error: 'Name and destination_url required' });
  }
  
  const campaign = {
    id: 'emergency_' + Date.now(),
    name,
    destination_url,
    smart_link_url: `${req.protocol}://${req.get('host')}/c/emergency_${Date.now()}`,
    status: 'active',
    created_at: new Date().toISOString()
  };
  
  console.log('✅ Emergency campaign created:', campaign);
  res.status(201).json(campaign);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚨 EMERGENCY SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});
