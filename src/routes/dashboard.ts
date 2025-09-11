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
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dashboard - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
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
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .stat-card {
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                border-left: 4px solid #667eea;
            }
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: #667eea;
                margin-bottom: 5px;
            }
            .stat-label {
                font-size: 14px;
                color: #666;
            }
            .campaigns-section {
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                margin-bottom: 30px;
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
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 20px;
                color: #333;
            }
            .campaigns-table {
                width: 100%;
                border-collapse: collapse;
            }
            .campaigns-table th,
            .campaigns-table td {
                text-align: left;
                padding: 12px;
                border-bottom: 1px solid #eee;
            }
            .campaigns-table th {
                background: #f8f9fa;
                font-weight: 600;
                color: #555;
            }
            .status-badge {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
            }
            .status-active {
                background: #d4edda;
                color: #155724;
            }
            .status-paused {
                background: #fff3cd;
                color: #856404;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 10px 15px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                margin: 5px;
                transition: background 0.2s;
            }
            .btn:hover {
                background: #5a6fd8;
            }
            .btn-small {
                padding: 5px 10px;
                font-size: 12px;
            }
            .btn-danger {
                background: #dc2626;
                color: white;
            }
            .btn-danger:hover {
                background: #b91c1c;
            }
            .loading {
                text-align: center;
                color: #666;
                font-style: italic;
            }
            .actions {
                margin-bottom: 20px;
                text-align: center;
            }
            .smart-link {
                font-family: monospace;
                background: #f1f3f4;
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 12px;
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
                    ${!spotifyConnected ? `<a href="/auth/spotify" class="btn btn-small">Connect Spotify</a>` : ''}
                </div>
            </div>
            
            <div class="actions">
                <a href="/create-campaign" class="btn">+ New Campaign</a>
                <button onclick="refreshData()" class="btn">🔄 Refresh</button>
                <button onclick="runPolling()" class="btn">📊 Sync Data</button>
                <a href="/analytics.html" target="_blank" class="btn btn-small" aria-label="Open analytics page">📈 Advanced Analytics</a>
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

            <div class="campaigns-section" id="recentPlaysSection">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h2 class="section-title">Recent Plays</h2>
                    <button onclick="loadRecentPlays()" class="btn btn-small">🔄 Refresh</button>
                </div>
                <div id="recent-plays-list" class="loading">Loading recent plays...</div>
            </div>

            <div class="campaigns-section" id="analyticsSection">
                <h2 class="section-title">Analytics</h2>
                <div class="loading" id="chart-hint">Select a campaign and click View to see charts</div>
                <div style="text-align:center; margin-bottom:10px;">
                    <button class="btn btn-small" onclick="setRange(1)">24h</button>
                    <button class="btn btn-small" onclick="setRange(7)">7d</button>
                    <button class="btn btn-small" onclick="setRange(14)">14d</button>
                    <button class="btn btn-small" onclick="setRange(30)">30d</button>
                    <button class="btn btn-small" onclick="setRange(60)">60d</button>
                    <button class="btn btn-small" onclick="setRange(180)">6m</button>
                    <button class="btn btn-small" onclick="setRange(365)">1y</button>
                </div>
                <canvas id="clicksChart" height="120"></canvas>
                <canvas id="streamsChart" height="120" style="margin-top:20px"></canvas>
            </div>
            
            <!-- Modal removed per request: analytics stays inline only -->
        </div>

        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
        <script>
            let campaignsData = [];

            async function loadDashboard() {
                try {
                    const response = await fetch('/api/metrics/campaigns');
                    const data = await response.json();
                    
                    // Update stats
                    document.getElementById('total-campaigns').textContent = data.summary.total_campaigns;
                    document.getElementById('total-clicks').textContent = data.summary.total_clicks;
                    document.getElementById('total-streams').textContent = data.summary.total_streams;
                    document.getElementById('total-listeners').textContent = data.summary.total_listeners;

                    // Update campaigns table
                    campaignsData = data.campaigns;
                    renderCampaignsTable();

                    document.getElementById('campaigns-loading').style.display = 'none';
                    document.getElementById('campaigns-table').style.display = 'table';
                } catch (error) {
                    console.error('Error loading dashboard:', error);
                    document.getElementById('campaigns-loading').textContent = 'Error loading campaigns';
                }
            }

            function renderCampaignsTable() {
                const tbody = document.getElementById('campaigns-tbody');
                tbody.innerHTML = '';

                campaignsData.forEach(campaign => {
                    const row = document.createElement('tr');
                    
                    const smartLink = window.location.origin + '/c/' + campaign.id;
                    const createdDate = new Date(campaign.created_at).toLocaleDateString();
                    
                    row.innerHTML = \`
                        <td>
                            <strong>\${campaign.name}</strong>
                            <br><small>\${campaign.destination_url}</small>
                        </td>
                        <td>
                            <span class="status-badge status-\${campaign.status}">\${campaign.status}</span>
                        </td>
                        <td>
                            <div class="smart-link">\${smartLink}</div>
                            <button onclick="copyToClipboard('\${smartLink}')" class="btn btn-small">Copy</button>
                        </td>
                        <td>\${campaign.metrics.clicks}</td>
                        <td>\${campaign.metrics.streams}</td>
                        <td>\${campaign.metrics.streams_per_listener.toFixed(1)}</td>
                        <td>\${campaign.metrics.followers_delta > 0 ? '+' : ''}\${campaign.metrics.followers_delta}</td>
                        <td>\${createdDate}</td>
                        <td>
                            <button onclick="viewCampaign('\${campaign.id}')" class="btn btn-small">View</button>
                            <button onclick="pauseCampaign('\${campaign.id}')" class="btn btn-small">Pause</button>
                            <button onclick="deleteCampaign('\${campaign.id}')" class="btn btn-small btn-danger">Delete</button>
                        </td>
                    \`;
                    
                    tbody.appendChild(row);
                });
            }

            function createCampaign() {
                const name = prompt('Campaign name:');
                if (!name) return;
                
                const destinationUrl = prompt('Destination URL:');
                if (!destinationUrl) return;
                
                const spotifyTrackId = prompt('Spotify Track ID (optional):') || '';

                fetch('/api/campaigns', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
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

            function viewCampaign(campaignId) {
                // Load in-page charts and scroll to analytics section (no modal)
                loadCharts(campaignId).then(() => {
                    const section = document.getElementById('analyticsSection');
                    if (section && section.scrollIntoView) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }

            let clicksChart, streamsChart, analyticsRangeDays = 30;
            function setRange(days){ analyticsRangeDays = days; if(window._currentCampaignId){ loadCharts(window._currentCampaignId); } }
            async function loadCharts(campaignId) {
                try {
                    window._currentCampaignId = campaignId;
                    const res = await fetch('/api/metrics/campaigns/' + campaignId + '/timeseries?days=' + analyticsRangeDays);
                    const data = await res.json();
                    const labels = Array.from(new Set([
                        ...data.clicksByDay.map(d => d.day),
                        ...data.streamsByDay.map(d => d.day)
                    ])).sort();

                    const clicksMap = Object.fromEntries(data.clicksByDay.map(d => [d.day, d.clicks]));
                    const streamsMap = Object.fromEntries(data.streamsByDay.map(d => [d.day, d.streams]));
                    const clicks = labels.map(l => clicksMap[l] || 0);
                    const streams = labels.map(l => streamsMap[l] || 0);

                    document.getElementById('chart-hint').style.display = 'none';

                    const ctx1 = document.getElementById('clicksChart');
                    const ctx2 = document.getElementById('streamsChart');

                    if (clicksChart) clicksChart.destroy();
                    if (streamsChart) streamsChart.destroy();

                    clicksChart = new Chart(ctx1, {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{
                                label: 'Clicks (last ' + analyticsRangeDays + ' days)',
                                data: clicks,
                                borderColor: '#667eea',
                                backgroundColor: 'rgba(102,126,234,0.15)',
                                tension: 0.25,
                                fill: true
                            }]
                        },
                        options: { scales: { y: { beginAtZero: true } } }
                    });

                    streamsChart = new Chart(ctx2, {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{
                                label: 'Streams (last ' + analyticsRangeDays + ' days)',
                                data: streams,
                                borderColor: '#22c55e',
                                backgroundColor: 'rgba(34,197,94,0.15)',
                                tension: 0.25,
                                fill: true
                            }]
                        },
                        options: { scales: { y: { beginAtZero: true } } }
                    });
                } catch (e) {
                    console.error('Failed to load charts', e);
                }
            }

            // Modal logic removed

            function pauseCampaign(campaignId) {
                if (!confirm('Pause this campaign?')) return;
                
                fetch('/api/campaigns/' + campaignId + '/status', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'paused' })
                })
                .then(() => {
                    refreshData();
                })
                .catch(error => {
                    console.error('Error pausing campaign:', error);
                    alert('Error pausing campaign');
                });
            }

            function deleteCampaign(campaignId) {
                if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone and will permanently remove all tracking data.')) return;
                
                fetch('/api/campaigns/' + campaignId, {
                    method: 'DELETE'
                })
                .then(response => {
                    if (response.ok) {
                        refreshData();
                        alert('Campaign deleted successfully');
                    } else {
                        return response.json().then(data => {
                            throw new Error(data.error || 'Failed to delete campaign');
                        });
                    }
                })
                .catch(error => {
                    console.error('Error deleting campaign:', error);
                    alert('Error deleting campaign: ' + error.message);
                });
            }

            function refreshData() {
                document.getElementById('campaigns-loading').style.display = 'block';
                document.getElementById('campaigns-table').style.display = 'none';
                loadDashboard();
                loadRecentPlays(); // Also refresh recent plays
            }

            function runPolling() {
                if (!confirm('Manually sync data from Spotify? This may take a few minutes.')) return;
                
                fetch('/api/metrics/admin/poll', { method: 'POST' })
                .then(() => fetch('/api/metrics/admin/attribute', { method: 'POST' }))
                .then(() => fetch('/api/metrics/admin/followers', { method: 'POST' }))
                .then(() => {
                    alert('Data sync completed!');
                    refreshData();
                })
                .catch(error => {
                    console.error('Error syncing data:', error);
                    alert('Error syncing data');
                });
            }

            // Load recent plays
            async function loadRecentPlays() {
                const container = document.getElementById('recent-plays-list');
                container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Loading recent plays...</div>';
                
                try {
                    const response = await fetch('/api/metrics/recent-plays');
                    const data = await response.json();
                    if (data.plays && data.plays.length > 0) {
                        container.innerHTML = data.plays.map(play => \`
                            <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 12px;">
                                <div style="flex-shrink: 0;">
                                    \${play.spotify_track_id ? \`
                                        <img src="\${play.artwork_url}" 
                                             style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover;"
                                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                                             alt="Track artwork">
                                        <div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 4px; display: none; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">🎵</div>
                                    \` : \`
                                        <div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">🎵</div>
                                    \`}
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                        <strong style="font-size: 14px; color: #333;">\${play.track_name}</strong>
                                        \${play.spotify_url ? \`<a href="\${play.spotify_url}" target="_blank" style="color: #1db954; text-decoration: none; font-size: 12px;">🔗</a>\` : ''}
                                    </div>
                                    <small style="color: #666; font-size: 12px;">\${play.artist_name}</small>
                                </div>
                                <div style="text-align: right; font-size: 11px; color: #666; flex-shrink: 0;">
                                    \${new Date(play.played_at).toLocaleString()}<br>
                                    \${play.campaign_name ? \`<span style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px; font-size: 10px; color: #1976d2;">\${play.campaign_name}</span>\` : ''}
                                </div>
                            </div>
                        \`).join('');
                    } else {
                        container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No recent plays found. Click a tracking link and stream some music!</div>';
                    }
                } catch (error) {
                    console.error('Error loading recent plays:', error);
                    document.getElementById('recent-plays-list').innerHTML = '<div style="text-align: center; color: #d32f2f; padding: 20px;">Error loading recent plays</div>';
                }
            }

            // Auto-refresh recent plays every 30 seconds
            function startRecentPlaysRefresh() {
                setInterval(loadRecentPlays, 30000); // Refresh every 30 seconds
            }

            // Load dashboard on page load
            loadDashboard();
            loadRecentPlays();
            startRecentPlaysRefresh();
        </script>
    </body>
    </html>
  `);
});

export default router;