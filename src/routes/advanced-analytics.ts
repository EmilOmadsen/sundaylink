import express from 'express';

const router = express.Router();

// Advanced Analytics page
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Advanced Analytics - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f7fa;
                color: #333;
                line-height: 1.6;
                margin: 0;
                padding: 20px;
            }
            .header {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                margin-bottom: 30px;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            .card {
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                margin-bottom: 20px;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                text-decoration: none;
                display: inline-block;
                margin: 5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📊 Advanced Analytics</h1>
                <p>Deep insights into your campaign performance</p>
            </div>
            
            <div class="card">
                <h2>🚧 Coming Soon</h2>
                <p>Advanced analytics features are currently in development. Check back soon for detailed insights including:</p>
                <ul>
                    <li>📈 Click-through rates over time</li>
                    <li>🌍 Geographic distribution</li>
                    <li>📱 Device and browser analytics</li>
                    <li>🎵 Spotify streaming correlations</li>
                </ul>
                <a href="/dashboard" class="btn">Back to Dashboard</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

export default router;


