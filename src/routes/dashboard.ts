import express from 'express';
import authService from '../services/auth';

const router = express.Router();

// Simple dashboard page
router.get('/', (req, res) => {
  // Check if user is authenticated
  const token = req.cookies.auth_token;
  let user = null;
  let spotifyConnected = false;
  let spotifyConnectionSuccess = false;

  if (token) {
    const decoded = authService.verifyToken(token);
    if (decoded) {
      user = authService.getById(decoded.userId);
      if (user) {
        spotifyConnected = user.is_spotify_connected;
        spotifyConnectionSuccess = req.query.spotify_connected === 'true';
      }
    }
  }

  // Get API URL for frontend injection (safely JSON-encoded)
  const envConfig = {
    VITE_API_URL: process.env.VITE_API_URL || `${req.protocol}://${req.get('host')}`
  };

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dashboard - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script>
            // Inject environment variables for frontend (safe JSON encoding)
            window.ENV = ${JSON.stringify(envConfig)};
            
            // API Configuration - get from environment or fall back to same origin
            let API_BASE = "";
            if (window.ENV && window.ENV.VITE_API_URL) {
                API_BASE = window.ENV.VITE_API_URL;
                // Remove trailing slashes
                while (API_BASE.endsWith("/")) {
                    API_BASE = API_BASE.slice(0, -1);
                }
            }
            if (!API_BASE) {
                console.warn("VITE_API_URL ikke sat – API-kald kan fejle i prod.");
            }
            console.log("API_BASE:", API_BASE);
        </script>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: white;
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
                max-width: 1400px;
                margin: 0 auto;
                padding: 40px;
                background: white;
                min-height: 100vh;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 24px;
                margin-bottom: 40px;
            }
            .stat-card {
                background: white;
                padding: 24px;
                border-radius: 16px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                border: 1px solid #f1f5f9;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .stat-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(135deg, #667eea, #764ba2);
            }
            .stat-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }
            .stat-value {
                font-size: 32px;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 8px;
                line-height: 1;
            }
            .stat-label {
                color: #64748b;
                font-size: 14px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .campaigns-section {
                background: white;
                padding: 0;
                border-radius: 20px;
                box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -2px rgba(0, 0, 0, 0.05);
                margin-bottom: 50px;
                border: 1px solid #f1f5f9;
                overflow: hidden;
            }
            .modal-overlay { 
                position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
                display: none; align-items: center; justify-content: center; z-index: 1000; 
            }
            .modal { background: #fff; border-radius: 12px; width: 90%; max-width: 1000px; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; }
            .modal-header { display:flex; align-items:center; justify-content: space-between; 
                padding: 16px 20px; border-bottom: 1px solid #eee; }
            .modal-body { padding: 16px 20px; }
            .close-btn { background:#eee; border:none; border-radius:6px; padding:8px 10px; cursor:pointer; }
            .section-title {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 32px;
                color: #1e293b;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                padding: 40px 40px 0 40px;
            }
            .campaigns-table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                border-radius: 0;
                overflow: hidden;
                box-shadow: none;
                margin-top: 0;
                table-layout: fixed;
            }
            .campaigns-table th,
            .campaigns-table td {
                text-align: left;
                padding: 16px 12px;
                border-bottom: 1px solid #f1f5f9;
                vertical-align: top;
                font-size: 13px;
                line-height: 1.5;
            }
            .campaigns-table th:nth-child(1),
            .campaigns-table td:nth-child(1) {
                width: 25%;
                padding-right: 16px;
            }
            .campaigns-table td:nth-child(1) strong {
                display: block;
                margin-bottom: 4px;
            }
            .campaigns-table td:nth-child(1) small {
                display: block;
                color: #64748b;
                font-size: 11px;
                line-height: 1.3;
                word-break: break-all;
            }
            .campaigns-table th:nth-child(2),
            .campaigns-table td:nth-child(2) {
                width: 8%;
            }
            .campaigns-table th:nth-child(3),
            .campaigns-table td:nth-child(3) {
                width: 20%;
            }
            .campaigns-table th:nth-child(4),
            .campaigns-table td:nth-child(4),
            .campaigns-table th:nth-child(5),
            .campaigns-table td:nth-child(5),
            .campaigns-table th:nth-child(6),
            .campaigns-table td:nth-child(6),
            .campaigns-table th:nth-child(7),
            .campaigns-table td:nth-child(7) {
                width: 7%;
            }
            
            .campaigns-table th:nth-child(9),
            .campaigns-table td:nth-child(9) {
                width: 10%;
                min-width: 120px;
                white-space: nowrap;
            }
            .campaigns-table th:nth-child(10),
            .campaigns-table td:nth-child(10) {
                width: 8%;
            }
            .campaigns-table th:nth-child(11),
            .campaigns-table td:nth-child(11) {
                width: 15%;
            }
            .campaigns-table th {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                font-weight: 600;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            /* FORCE S/L column to be exactly like other columns - AFTER general rules */
            .campaigns-table th:nth-child(8),
            .campaigns-table td:nth-child(8) {
                width: 7% !important;
                font-size: 13px !important;
                line-height: 1.5 !important;
                padding: 16px 12px !important;
                vertical-align: top !important;
                text-align: center !important;
            }
            
            /* FORCE S/L header to match other headers - AFTER general rules */
            .campaigns-table th:nth-child(8) {
                font-weight: 600 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                background: linear-gradient(135deg, #667eea, #764ba2) !important;
                color: white !important;
            }
            .campaigns-table tbody tr {
                height: 85px;
            }
            .campaigns-table tbody tr:hover {
                background: #f8fafc;
                transition: background 0.2s ease;
            }
            .campaigns-table tbody tr:last-child td {
                border-bottom: none;
            }
            .status-badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .status-active {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
            }
            .status-paused {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
                box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
            }
            .btn {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 12px 20px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                margin: 5px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            }
            .btn-small {
                padding: 6px 12px;
                font-size: 11px;
                font-weight: 500;
                margin: 2px 3px 2px 0;
                display: block;
                width: fit-content;
            }
            .btn-danger {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
            }
            .btn-danger:hover {
                background: linear-gradient(135deg, #dc2626, #b91c1c);
            }
            .btn-secondary {
                background: linear-gradient(135deg, #6b7280, #4b5563);
                color: white;
            }
            .btn-secondary:hover {
                background: linear-gradient(135deg, #4b5563, #374151);
            }
            .loading {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 32px;
            }
            .actions {
                margin-bottom: 32px;
                text-align: center;
                padding: 24px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                border: 1px solid #f1f5f9;
            }
            .smart-link {
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 11px;
                border: 1px solid #e2e8f0;
                display: block;
                margin: 6px 0;
                transition: all 0.2s ease;
                line-height: 1.4;
                word-break: break-all;
            }
            .smart-link:hover {
                background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
                transform: translateY(-1px);
            }
            .copy-btn {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
                border: none;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 4px;
                transition: all 0.2s ease;
                display: block;
            }
            .copy-btn:hover {
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                transform: scale(1.05);
            }
            .success-banner {
                background: #d4edda;
                color: #155724;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: center;
                border: 1px solid #c3e6cb;
            }
            .spotify-status {
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🔗 Sundaylink Dashboard</h1>
            <p>Smart link analytics and campaign management</p>
        </div>

        <div class="container">
            ${spotifyConnectionSuccess ? `
            <div class="success-banner">
                🎵 Spotify successfully connected! You can now track listening data.
            </div>
            ` : ''}
            
            <div class="spotify-status">
                <div class="stat-card">
                    <div class="stat-value">${spotifyConnected ? '✅ Connected' : '❌ Not Connected'}</div>
                    <div class="stat-label">Spotify Connection</div>
                    ${!spotifyConnected ? '<a href="/auth/spotify" class="btn btn-small">Connect Spotify</a>' : ''}
                </div>
            </div>
            
            <div class="actions">
                <a href="/create-campaign" class="btn">+ New Campaign</a>
                <button onclick="refreshData()" class="btn">🔄 Refresh</button>
                <button onclick="runPolling()" class="btn">📊 Sync Data</button>
                <a href="/advanced-analytics" class="btn btn-small" aria-label="Open analytics page">📈 Advanced Analytics</a>
            </div>

            <div id="stats" class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="total-campaigns">-</div>
                    <div class="stat-label">Total Campaigns</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="total-clicks">-</div>
                    <div class="stat-label">Total Clicks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="total-streams">-</div>
                    <div class="stat-label">Total Streams</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="total-listeners">-</div>
                    <div class="stat-label">Unique Listeners</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="total-unique-songs">-</div>
                    <div class="stat-label">Unique Songs</div>
                </div>
            </div>

            <div class="campaigns-section">
                <h2 class="section-title">Campaigns</h2>
                <div id="campaigns-loading" class="loading">Loading campaigns...</div>
                <table id="campaigns-table" class="campaigns-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Smart Link</th>
                            <th>Clicks</th>
                            <th>Streams</th>
                            <th>Unique Songs</th>
                            <th>Unique Listener</th>
                            <th>S/L</th>
                            <th>Followers Δ</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="campaigns-tbody">
                    </tbody>
                </table>
            </div>


            
        </div>

        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
        <script>
            // Wait for Chart.js to load
            window.addEventListener('load', function() {
                console.log('Chart.js loaded:', typeof Chart !== 'undefined');
            });
            
            let campaignsData = [];

            async function loadDashboard() {
                try {
                    console.log('Loading dashboard data...');
                    console.log('API_BASE:', API_BASE);
                    console.log('Full URL:', API_BASE + "/api/campaigns");
                    
                    const response = await fetch(API_BASE + "/api/campaigns", {
                        method: 'GET',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log('Response status:', response.status);
                    console.log('Response headers:', [...response.headers.entries()]);
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API Error Response:', errorText);
                        throw new Error('Failed to fetch campaigns: ' + response.status + ' - ' + errorText);
                    }
                    
                    const campaigns = await response.json();
                    console.log('Campaigns data received:', campaigns);
                    
                    // Calculate statistics from campaigns array
                    const totalCampaigns = campaigns.length;
                    const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
                    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
                    
                    // Update stats
                    document.getElementById('total-campaigns').textContent = totalCampaigns;
                    document.getElementById('total-clicks').textContent = totalClicks;
                    document.getElementById('total-streams').textContent = '0'; // Will be updated when we have plays data
                    document.getElementById('total-listeners').textContent = '0'; // Will be updated when we have user data
                    document.getElementById('total-unique-songs').textContent = activeCampaigns;

                    // Update campaigns table
                    campaignsData = campaigns;
                    console.log('Campaigns data:', campaignsData);
                    renderCampaignsTable();

                    document.getElementById('campaigns-loading').style.display = 'none';
                    document.getElementById('campaigns-table').style.display = 'table';
                    console.log('Dashboard loaded successfully');
                } catch (error) {
                    console.error('Error loading dashboard:', error);
                    document.getElementById('campaigns-loading').textContent = 'Error loading campaigns: ' + (error instanceof Error ? error.message : error);
                }
            }

            function renderCampaignsTable() {
                const tbody = document.getElementById('campaigns-tbody');
                tbody.innerHTML = '';

                campaignsData.forEach(campaign => {
                    const row = document.createElement('tr');
                    
                    const smartLink = window.location.origin + '/c/' + campaign.id;
                    const createdDate = new Date(campaign.created_at).toLocaleDateString();
                    
                    row.innerHTML = '<td>' +
                        '<strong>' + campaign.name + '</strong>' +
                        '<br><small>' + campaign.destination_url + '</small>' +
                        '</td>' +
                        '<td>' +
                        '<span class="status-badge status-' + campaign.status + '">' + campaign.status + '</span>' +
                        '</td>' +
                        '<td>' +
                        '<div class="smart-link">' + smartLink + '</div>' +
                        '<button onclick="copyToClipboard(\"' + smartLink + '\")" class="copy-btn">Copy</button>' +
                        '</td>' +
                        '<td>' + campaign.metrics.clicks + '</td>' +
                        '<td>' + campaign.metrics.streams + '</td>' +
                        '<td>' + (campaign.metrics.unique_songs || 0) + '</td>' +
                        '<td>' + (campaign.metrics.listeners || 0) + '</td>' +
                        '<td>' + campaign.metrics.streams_per_listener.toFixed(1) + '</td>' +
                        '<td>' + (campaign.metrics.followers_delta > 0 ? '+' : '') + campaign.metrics.followers_delta + '</td>' +
                        '<td>' + createdDate + '</td>' +
                        '<td>' +
                        '<button onclick="toggleCampaign(\\'' + campaign.id + '\\')" class="btn btn-small btn-secondary">' + (campaign.status === 'active' ? 'Pause' : 'Resume') + '</button>' +
                        '<button onclick="deleteCampaign(\\'' + campaign.id + '\\')" class="btn btn-small btn-danger">Delete</button>' +
                        '</td>';
                    
                    tbody.appendChild(row);
                });
            }

            function createCampaign() {
                const name = prompt('Campaign name:');
                if (!name) return;
                
                const destinationUrl = prompt('Destination URL:');
                if (!destinationUrl) return;
                
                const spotifyTrackId = prompt('Spotify Track ID (optional):') || '';

                fetch(API_BASE + "/api/campaigns", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        name: name,
                        destination_url: destinationUrl,
                        spotify_track_id: spotifyTrackId || undefined
                    })
                })
                .then(response => response.json())
                .then(data => {
                    alert('Campaign created! Smart link: ' + data.smart_link_url);
                    refreshData();
                })
                .catch(error => {
                    console.error('Error creating campaign:', error);
                    alert('Error creating campaign');
                });
            }

            function copyToClipboard(text) {
                navigator.clipboard.writeText(text).then(() => {
                    alert('Link copied to clipboard!');
                });
            }

            async function toggleCampaign(campaignId) {
                try {
                    const campaign = campaignsData.find(c => c.id === campaignId);
                    if (!campaign) {
                        alert('Campaign not found');
                        return;
                    }

                    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
                    const action = newStatus === 'active' ? 'resume' : 'pause';
                    
                    if (!confirm('Are you sure you want to ' + action + ' this campaign?')) {
                        return;
                    }

                    const response = await fetch(API_BASE + "/api/campaigns/" + campaignId + "/status", {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({ status: newStatus })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update campaign status');
                    }

                    // Update the campaign status in our local data
                    campaign.status = newStatus;
                    
                    // Re-render the table to update the button text and status badge
                    renderCampaignsTable();
                    
                    alert('Campaign ' + action + 'd successfully!');
                } catch (error) {
                    console.error('Error toggling campaign:', error);
                    alert('Error updating campaign status');
                }
            }

            async function deleteCampaign(campaignId) {
                try {
                    const campaign = campaignsData.find(c => c.id === campaignId);
                    if (!campaign) {
                        alert('Campaign not found');
                        return;
                    }

                    if (!confirm('Are you sure you want to delete "' + campaign.name + '"? This action cannot be undone.')) {
                        return;
                    }

                    const response = await fetch(API_BASE + "/api/campaigns/" + campaignId, {
                        method: 'DELETE',
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete campaign');
                    }

                    // Remove the campaign from our local data
                    campaignsData = campaignsData.filter(c => c.id !== campaignId);
                    
                    // Re-render the table
                    renderCampaignsTable();
                    
                    // Update the total campaigns count
                    document.getElementById('total-campaigns').textContent = campaignsData.length;
                    
                    alert('Campaign deleted successfully!');
                } catch (error) {
                    console.error('Error deleting campaign:', error);
                    alert('Error deleting campaign');
                }
            }

            function refreshData() {
                loadDashboard();
            }

            
            // Initialize dashboard
            loadDashboard();
        </script>
    </body>
</html>
  `);
});

export default router;
