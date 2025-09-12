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
                    <div class="stat-value">\${spotifyConnected ? '✅ Connected' : '❌ Not Connected'}</div>
                    <div class="stat-label">Spotify Connection</div>
                    \${!spotifyConnected ? '<a href="/auth/spotify" class="btn btn-small">Connect Spotify</a>' : ''}
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

            <div class="campaigns-section" id="songAnalyticsSection" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h2 class="section-title" id="songAnalyticsTitle">Song Analytics</h2>
                    <button onclick="hideSongAnalytics()" class="btn btn-small">✕ Close</button>
                </div>
                <div id="song-analytics-content" class="loading">Loading song analytics...</div>
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
                <canvas id="clicksChart" width="800" height="120" style="width: 100%; max-width: 800px;"></canvas>
                <canvas id="streamsChart" width="800" height="120" style="width: 100%; max-width: 800px; margin-top:20px;"></canvas>
            </div>
            
            <!-- Modal removed per request: analytics stays inline only -->
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
                    const response = await fetch('/api/metrics/campaigns');
                    console.log('Response status:', response.status);
                    
                    if (!response.ok) {
                        throw new Error('Failed to fetch campaigns: ' + response.status);
                    }
                    
                    const data = await response.json();
                    console.log('Dashboard data received:', data);
                    
                    // Update stats
                    document.getElementById('total-campaigns').textContent = data.summary.total_campaigns;
                    document.getElementById('total-clicks').textContent = data.summary.total_clicks;
                    document.getElementById('total-streams').textContent = data.summary.total_streams;
                    document.getElementById('total-listeners').textContent = data.summary.total_listeners;
                    document.getElementById('total-unique-songs').textContent = data.summary.total_unique_songs;

                    // Update campaigns table
                    campaignsData = data.campaigns;
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
                        '<button onclick="copyToClipboard(\'' + smartLink + '\')" class="btn btn-small">Copy</button>' +
                        '</td>' +
                        '<td>' + campaign.metrics.clicks + '</td>' +
                        '<td>' + campaign.metrics.streams + '</td>' +
                        '<td>' + (campaign.metrics.unique_songs || 0) + '</td>' +
                        '<td>' + campaign.metrics.streams_per_listener.toFixed(1) + '</td>' +
                        '<td>' + (campaign.metrics.followers_delta > 0 ? '+' : '') + campaign.metrics.followers_delta + '</td>' +
                        '<td>' + createdDate + '</td>' +
                        '<td>' +
                        '<button onclick="viewCampaign(\'' + campaign.id + '\')" class="btn btn-small">View</button>' +
                        '<button onclick="pauseCampaign(\'' + campaign.id + '\')" class="btn btn-small">Pause</button>' +
                        '<button onclick="deleteCampaign(\'' + campaign.id + '\')" class="btn btn-small btn-danger">Delete</button>' +
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
                console.log('viewCampaign called with ID:', campaignId);
                
                // Hide the hint message
                document.getElementById('chart-hint').style.display = 'none';
                
                // Show loading message
                const analyticsSection = document.getElementById('analyticsSection');
                const loadingDiv = document.createElement('div');
                loadingDiv.id = 'chart-loading';
                loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Loading charts...</div>';
                analyticsSection.appendChild(loadingDiv);
                
                // Load charts
                loadCharts(campaignId).then(() => {
                    console.log('Charts loaded successfully');
                    // Remove loading message
                    const loadingEl = document.getElementById('chart-loading');
                    if (loadingEl) loadingEl.remove();
                    
                    // Scroll to analytics section
                    if (analyticsSection && analyticsSection.scrollIntoView) {
                        analyticsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }).catch(error => {
                    console.error('Error in viewCampaign:', error);
                    // Remove loading message
                    const loadingEl = document.getElementById('chart-loading');
                    if (loadingEl) loadingEl.remove();
                    
                    // Show error message
                    const errorDiv = document.createElement('div');
                    errorDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #d32f2f;">Error loading charts. Please try again.</div>';
                    analyticsSection.appendChild(errorDiv);
                });
            }

            let clicksChart, streamsChart, analyticsRangeDays = 30;
            function setRange(days){ analyticsRangeDays = days; if(window._currentCampaignId){ loadCharts(window._currentCampaignId); } }
            async function loadCharts(campaignId) {
                try {
                    console.log('Loading charts for campaign:', campaignId);
                    window._currentCampaignId = campaignId;
                    
                    // Fetch data
                    const res = await fetch('/api/metrics/campaigns/' + campaignId + '/timeseries?days=' + analyticsRangeDays);
                    if (!res.ok) {
                        throw new Error('Failed to fetch chart data: ' + res.status);
                    }
                    const data = await res.json();
                    console.log('Chart data received:', data);
                    
                    // Process data
                    const labels = Array.from(new Set([
                        ...data.clicksByDay.map(d => d.day),
                        ...data.streamsByDay.map(d => d.day)
                    ])).sort();

                    const clicksMap = Object.fromEntries(data.clicksByDay.map(d => [d.day, d.clicks]));
                    const streamsMap = Object.fromEntries(data.streamsByDay.map(d => [d.day, d.streams]));
                    const clicks = labels.map(l => clicksMap[l] || 0);
                    const streams = labels.map(l => streamsMap[l] || 0);

                    console.log('Chart labels:', labels);
                    console.log('Chart clicks data:', clicks);
                    console.log('Chart streams data:', streams);

                    // Get canvas elements
                    const ctx1 = document.getElementById('clicksChart');
                    const ctx2 = document.getElementById('streamsChart');
                    
                    if (!ctx1 || !ctx2) {
                        throw new Error('Canvas elements not found');
                    }
                    
                    console.log('Canvas elements found:', { ctx1: !!ctx1, ctx2: !!ctx2 });

                    // Destroy existing charts
                    if (clicksChart) {
                        clicksChart.destroy();
                        clicksChart = null;
                    }
                    if (streamsChart) {
                        streamsChart.destroy();
                        streamsChart = null;
                    }

                    // Check if Chart.js is available, if not create simple HTML charts
                    if (typeof Chart === 'undefined') {
                        console.log('Chart.js not available, creating simple HTML charts');
                        createSimpleCharts(labels, clicks, streams);
                        return;
                    }

                    // Create charts
                    console.log('Creating clicks chart...');
                    clicksChart = new Chart(ctx1, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Clicks (last ' + analyticsRangeDays + ' days)',
                                data: clicks,
                                borderColor: '#667eea',
                                backgroundColor: 'rgba(102,126,234,0.15)',
                                tension: 0.25,
                                fill: true,
                                pointRadius: 4,
                                pointHoverRadius: 6
                            }]
                        },
                        options: { 
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { 
                                y: { 
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1
                                    }
                                } 
                            },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top'
                                }
                            }
                        }
                    });
                    console.log('Clicks chart created successfully');

                    console.log('Creating streams chart...');
                    streamsChart = new Chart(ctx2, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Streams (last ' + analyticsRangeDays + ' days)',
                                data: streams,
                                borderColor: '#22c55e',
                                backgroundColor: 'rgba(34,197,94,0.15)',
                                tension: 0.25,
                                fill: true,
                                pointRadius: 4,
                                pointHoverRadius: 6
                            }]
                        },
                        options: { 
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { 
                                y: { 
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1
                                    }
                                } 
                            },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top'
                                }
                            }
                        }
                    });
                    console.log('Streams chart created successfully');
                    
                } catch (e) {
                    console.error('Failed to load charts:', e);
                    throw e; // Re-throw to be caught by viewCampaign
                }
            }

            // Simple HTML charts as fallback
            function createSimpleCharts(labels: string[], clicks: number[], streams: number[]) {
                const ctx1 = document.getElementById('clicksChart');
                const ctx2 = document.getElementById('streamsChart');
                
                if (!ctx1 || !ctx2) return;
                
                // Create simple bar chart for clicks
                let clicksHtml = '';
                for (let i = 0; i < labels.length; i++) {
                    const height = Math.max(20, (clicks[i] / Math.max(...clicks)) * 80);
                    clicksHtml += '<div style="display: flex; flex-direction: column; align-items: center; flex: 1;">';
                    clicksHtml += '<div style="background: #667eea; width: 100%; height: ' + height + 'px; border-radius: 4px 4px 0 0; margin-bottom: 5px;"></div>';
                    clicksHtml += '<div style="font-size: 12px; color: #666;">' + clicks[i] + '</div>';
                    clicksHtml += '<div style="font-size: 10px; color: #999;">' + labels[i] + '</div>';
                    clicksHtml += '</div>';
                }
                
                ctx1.innerHTML = '<div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin-bottom: 20px;">' +
                    '<h3 style="margin: 0 0 15px 0; color: #667eea;">Clicks (last ' + analyticsRangeDays + ' days)</h3>' +
                    '<div style="display: flex; align-items: end; gap: 10px; height: 100px;">' +
                    clicksHtml +
                    '</div></div>';
                
                // Create simple bar chart for streams
                let streamsHtml = '';
                for (let i = 0; i < labels.length; i++) {
                    const height = Math.max(20, (streams[i] / Math.max(...streams)) * 80);
                    streamsHtml += '<div style="display: flex; flex-direction: column; align-items: center; flex: 1;">';
                    streamsHtml += '<div style="background: #22c55e; width: 100%; height: ' + height + 'px; border-radius: 4px 4px 0 0; margin-bottom: 5px;"></div>';
                    streamsHtml += '<div style="font-size: 12px; color: #666;">' + streams[i] + '</div>';
                    streamsHtml += '<div style="font-size: 10px; color: #999;">' + labels[i] + '</div>';
                    streamsHtml += '</div>';
                }
                
                ctx2.innerHTML = '<div style="padding: 20px; background: #f8f9fa; border-radius: 8px;">' +
                    '<h3 style="margin: 0 0 15px 0; color: #22c55e;">Streams (last ' + analyticsRangeDays + ' days)</h3>' +
                    '<div style="display: flex; align-items: end; gap: 10px; height: 100px;">' +
                    streamsHtml +
                    '</div></div>';
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
                    alert('Error deleting campaign: ' + (error instanceof Error ? error.message : error));
                });
            }

            function refreshData() {
                document.getElementById('campaigns-loading').style.display = 'block';
                document.getElementById('campaigns-table').style.display = 'none';
                loadDashboard();
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


            // Show song analytics for a specific campaign
            async function showSongAnalytics(campaignId, campaignName) {
                const section = document.getElementById('songAnalyticsSection');
                const title = document.getElementById('songAnalyticsTitle');
                const content = document.getElementById('song-analytics-content');
                
                title.textContent = 'Song Analytics - ' + campaignName;
                section.style.display = 'block';
                content.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Loading song analytics...</div>';
                
                // Scroll to the analytics section
                section.scrollIntoView({ behavior: 'smooth' });
                
                try {
                    const response = await fetch('/api/metrics/campaigns/' + campaignId + '/songs');
                    const data = await response.json();
                    
                    if (data.songs && data.songs.length > 0) {
                        let songsHtml = '<div style="margin-bottom: 15px; font-size: 14px; color: #666;">' +
                            'Showing ' + data.songs.length + ' songs ranked by play count' +
                            '</div>';
                        
                        data.songs.forEach((song, index) => {
                            songsHtml += '<div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 12px;">';
                            songsHtml += '<div style="flex-shrink: 0; text-align: center; min-width: 30px;">';
                            songsHtml += '<div style="font-weight: bold; color: #1db954; font-size: 16px;">#' + (index + 1) + '</div>';
                            songsHtml += '</div>';
                            songsHtml += '<div style="flex-shrink: 0;">';
                            
                            if (song.spotify_track_id) {
                                songsHtml += '<img src="' + song.artwork_url + '" ' +
                                    'style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover;" ' +
                                    'onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';" ' +
                                    'alt="Track artwork">';
                                songsHtml += '<div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 4px; display: none; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">🎵</div>';
                            } else {
                                songsHtml += '<div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">🎵</div>';
                            }
                            
                            songsHtml += '</div>';
                            songsHtml += '<div style="flex: 1; min-width: 0;">';
                            songsHtml += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">';
                            songsHtml += '<strong style="font-size: 14px; color: #333;">' + song.track_name + '</strong>';
                            
                            if (song.spotify_url) {
                                songsHtml += '<a href="' + song.spotify_url + '" target="_blank" style="color: #1db954; text-decoration: none; font-size: 12px;">🔗</a>';
                            }
                            
                            songsHtml += '</div>';
                            songsHtml += '<small style="color: #666; font-size: 12px;">' + song.artist_name + '</small>';
                            songsHtml += '</div>';
                            songsHtml += '<div style="text-align: right; font-size: 11px; color: #666; flex-shrink: 0;">';
                            songsHtml += '<div style="font-weight: bold; color: #1db954;">' + song.play_count + ' plays</div>';
                            songsHtml += '<div>' + song.unique_listeners + ' listeners</div>';
                            songsHtml += '<div style="font-size: 10px;">Avg: ' + (song.avg_confidence * 100).toFixed(0) + '% confidence</div>';
                            songsHtml += '</div>';
                            songsHtml += '</div>';
                        });
                        
                        content.innerHTML = songsHtml;
                    } else {
                        content.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No songs found for this campaign yet. Click the tracking link and stream some music!</div>';
                    }
                } catch (error) {
                    console.error('Error loading song analytics:', error);
                    content.innerHTML = '<div style="text-align: center; color: #d32f2f; padding: 20px;">Error loading song analytics</div>';
                }
            }

            // Hide song analytics section
            function hideSongAnalytics() {
                document.getElementById('songAnalyticsSection').style.display = 'none';
            }


            // Load dashboard on page load
            loadDashboard();
        </script>
    </body>
    </html>
  `);
});

export default router;