import express from 'express';

const router = express.Router();

// Campaign creation form page
router.get('/', (req, res) => {
  console.log('📝 GET /create-campaign - Request received');
  console.log('🍪 Request cookies:', req.cookies);
  
  // Check if user is authenticated
  const token = req.cookies.auth_token;
  let user = null;
  
  if (token) {
    const authService = require('../services/auth').default;
    const decoded = authService.verifyToken(token);
    if (decoded) {
      user = authService.getById(decoded.userId);
      console.log('👤 Authenticated user:', user ? user.email : 'not found');
    } else {
      console.log('🎫 Token verification failed');
    }
  } else {
    console.log('❌ No auth token found');
  }
  
  if (!user) {
    console.log('🚫 Redirecting to login - user not authenticated');
    return res.redirect('/auth/login?redirect=/create-campaign');
  }
  
  console.log('✅ User authenticated, showing create campaign form');
  
  // Get API URL for frontend injection
  const apiUrl = process.env.VITE_API_URL || '';
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Create Campaign - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script>
            // Inject environment variables for frontend
            window.ENV = {
                VITE_API_URL: "${apiUrl}"
            };
        </script>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f7fa;
                color: #333;
                line-height: 1.6;
            }
            .header {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 20px 0;
                text-align: center;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .container {
                max-width: 600px;
                margin: 20px auto;
                padding: 20px;
            }
            .form-card {
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
                color: #555;
            }
            input[type="text"], input[type="url"], textarea {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 16px;
                box-sizing: border-box;
                font-family: inherit;
            }
            textarea {
                resize: vertical;
                height: 80px;
            }
            .form-hint {
                font-size: 12px;
                color: #666;
                margin-top: 3px;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                margin: 5px;
                transition: background 0.2s;
            }
            .btn:hover {
                background: #5a6fd8;
            }
            .btn:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            .btn-secondary {
                background: #6c757d;
            }
            .btn-secondary:hover {
                background: #5a6268;
            }
            .actions {
                text-align: center;
                margin-top: 30px;
            }
            .spotify-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin-top: 20px;
            }
            .spotify-section h3 {
                margin-top: 0;
                color: #1db954;
            }
            .success-message {
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                display: none;
                font-size: 16px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .success-message strong {
                font-size: 18px;
                display: block;
                margin-bottom: 8px;
            }
            .error-message {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 20px;
                display: none;
            }
            .smart-link-result {
                background: #f1f3f4;
                padding: 15px;
                border-radius: 6px;
                margin-top: 15px;
                display: none;
            }
            .smart-link {
                font-family: monospace;
                word-break: break-all;
                background: white;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid #ddd;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🔗 Create New Campaign</h1>
            <p>Generate smart tracking links for your content</p>
        </div>

        <div class="container">
            <div class="form-card">
                <div class="success-message" id="success-message"></div>
                <div class="error-message" id="error-message"></div>
                
                <form id="campaign-form">
                    <div class="form-group">
                        <label for="name">Campaign Name *</label>
                        <input type="text" id="name" name="name" required placeholder="e.g., New Track Launch">
                        <div class="form-hint">Give your campaign a memorable name</div>
                    </div>

                    <div class="form-group">
                        <label for="destination_url">Destination URL *</label>
                        <input type="url" id="destination_url" name="destination_url" required 
                               placeholder="https://open.spotify.com/track/...">
                        <div class="form-hint">Where people go when they click your smart link</div>
                    </div>

                    <div class="spotify-section">
                        <h3>🎵 Spotify Tracking (Optional)</h3>
                        <p>Add Spotify IDs to track streams and followers growth</p>
                        
                        <div class="form-group">
                            <label for="spotify_track_id">Spotify Track ID</label>
                            <input type="text" id="spotify_track_id" name="spotify_track_id" 
                                   placeholder="4iV5W9uYEdYUVa79Axb7Rh">
                            <div class="form-hint">Right-click track → Share → Copy link → paste ID after last /</div>
                        </div>

                        <div class="form-group">
                            <label for="spotify_artist_id">Spotify Artist ID</label>
                            <input type="text" id="spotify_artist_id" name="spotify_artist_id" 
                                   placeholder="1vCWHaC5f2uS3yhpwWbIA6">
                            <div class="form-hint">For tracking artist follower growth</div>
                        </div>

                        <div class="form-group">
                            <label for="spotify_playlist_id">Spotify Playlist ID</label>
                            <input type="text" id="spotify_playlist_id" name="spotify_playlist_id" 
                                   placeholder="37i9dQZF1DXcBWIGoYBM5M">
                            <div class="form-hint">For tracking playlist follower growth</div>
                        </div>
                    </div>

                    <div class="actions">
                        <button type="submit" class="btn">Create Campaign</button>
                        <button type="button" class="btn" style="background: #28a745; margin-left: 10px;" onclick="checkAuthStatus()">🔍 Check Auth</button>
                        <a href="/dashboard" class="btn btn-secondary">Cancel</a>
                    </div>
                </form>

                <div class="smart-link-result" id="smart-link-result">
                    <h3>✅ Campaign Created Successfully!</h3>
                    <p>Your smart tracking link:</p>
                    <div class="smart-link" id="generated-link"></div>
                    <button onclick="copyLink()" class="btn">Copy Link</button>
                    <a href="/dashboard" class="btn btn-secondary">Back to Dashboard</a>
                </div>
            </div>
        </div>

        <script>
            // API Configuration - get from environment or fall back to same origin
            const API_BASE = window.ENV?.VITE_API_URL?.replace(/\/+$/, "") || "";
            if (!API_BASE) {
                console.warn("VITE_API_URL is not set. Using same-origin API calls.");
            }

            // Safe fetch wrapper
            async function safeFetch(input, init = {}) {
                const url = input.startsWith("http") ? input : input;
                const res = await fetch(url, {
                    credentials: "include", // safe for cookie-based auth
                    ...init,
                    headers: {
                        "Content-Type": "application/json",
                        ...(init.headers || {}),
                    },
                });

                const text = await res.text();
                let data;
                try { 
                    data = text ? JSON.parse(text) : undefined; 
                } catch { 
                    data = text; 
                }

                if (!res.ok) {
                    const msg = res.status + " " + res.statusText + " – " + (typeof data === "string" ? data : (data && data.message) || "");
                    throw new Error(msg.trim());
                }
                return data;
            }

            let generatedLinkUrl = '';

            document.getElementById('campaign-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('🚀 Form submitted - creating campaign...');
                
                // Show loading state
                const submitBtn = e.target.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = '⏳ Creating Campaign...';
                submitBtn.disabled = true;
                
                // Clear previous messages
                document.getElementById('success-message').style.display = 'none';
                document.getElementById('error-message').style.display = 'none';
                
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                
                // Remove empty optional fields
                Object.keys(data).forEach(key => {
                    if (!data[key]) {
                        delete data[key];
                    }
                });

                try {
                    // Build the correct absolute URL
                    const createCampaignUrl = API_BASE ? API_BASE + "/api/campaigns" : "/api/campaigns";
                    console.log('📡 Making request to:', createCampaignUrl);
                    console.log('🍪 Document cookies:', document.cookie);
                    console.log('📋 Request data:', data);
                    
                    const result = await safeFetch(createCampaignUrl, {
                        method: 'POST',
                        body: JSON.stringify(data)
                    });
                    
                    console.log('✅ Response received successfully');
                    console.log('📄 Response data:', result);

                    if (result) {
                        // SUCCESS! Show multiple confirmations
                        console.log('✅ Campaign created successfully:', result);
                        
                        generatedLinkUrl = result.smart_link_url;
                        document.getElementById('generated-link').textContent = generatedLinkUrl;
                        document.getElementById('smart-link-result').style.display = 'block';
                        document.getElementById('campaign-form').style.display = 'none';
                        
                        // Set success message
                        const successMsg = document.getElementById('success-message');
                        successMsg.innerHTML = '<strong>🎉 Campaign "' + result.name + '" created successfully!</strong><br>✅ Status: ACTIVE<br>🔗 Smart Link: Ready to share<br>📊 Tracking: All clicks will be monitored';
                        successMsg.style.display = 'block';
                        
                        // Scroll to the success section
                        document.getElementById('smart-link-result').scrollIntoView({ behavior: 'smooth' });
                        
                        // Show alert as backup notification
                        alert('🎉 SUCCESS! Campaign "' + result.name + '" is now ACTIVE and ready to track clicks!');
                        
                        // Try to show browser notification
                        if ('Notification' in window) {
                            if (Notification.permission === 'granted') {
                                new Notification('🎉 Campaign Active!', {
                                    body: 'Smart link for "' + result.name + '" is ready to share',
                                    icon: '🔗'
                                });
                            } else if (Notification.permission !== 'denied') {
                                Notification.requestPermission().then(permission => {
                                    if (permission === 'granted') {
                                        new Notification('🎉 Campaign Active!', {
                                            body: 'Smart link for "' + result.name + '" is ready to share'
                                        });
                                    }
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ Error creating campaign:', error);
                    
                    // Never crash the app; show a friendly message instead
                    let message = error instanceof Error ? error.message : "Unknown error";
                    
                    // Show helpful error messages based on the error
                    if (message.includes('401') || message.includes('Authentication')) {
                        message = 'Authentication required. Please log in first.';
                    } else if (message.includes('404') || message.includes('Not found')) {
                        message = 'Could not connect to API. Please check your connection.';
                    } else if (message.includes('500')) {
                        message = 'Server error. Please try again later.';
                    } else if (message.includes('CORS') || message.includes('fetch')) {
                        message = 'Connection error. Please check your network.';
                    }
                    
                    // Set user-friendly error message
                    document.getElementById('error-message').textContent = 'Could not create campaign: ' + message;
                    document.getElementById('error-message').style.display = 'block';
                    console.error("Create campaign failed:", message);
                    
                    // Reset button state on error
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            });

            function copyLink() {
                navigator.clipboard.writeText(generatedLinkUrl).then(() => {
                    // Show better feedback instead of alert
                    const copyBtn = document.querySelector('button[onclick="copyLink()"]');
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✅ Copied!';
                    copyBtn.style.background = '#28a745';
                    
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = '#667eea';
                    }, 2000);
                }).catch(() => {
                    alert('❌ Failed to copy link. Please copy it manually.');
                });
            }

            // Check authentication status (debug function)
            async function checkAuthStatus() {
                console.log('🔍 Checking authentication status...');
                try {
                    const authStatusUrl = API_BASE ? API_BASE + "/api/campaigns/auth-status" : "/api/campaigns/auth-status";
                    const result = await safeFetch(authStatusUrl, {
                        method: 'GET'
                    });
                    console.log('🔐 Auth status result:', result);
                    alert('Auth Status: ' + JSON.stringify(result, null, 2));
                } catch (error) {
                    console.error('❌ Error checking auth status:', error);
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    alert('Error checking auth: ' + message);
                }
            }
        </script>
    </body>
    </html>
  `);
});

export default router;