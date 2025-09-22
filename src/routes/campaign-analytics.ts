import express from 'express';

const router = express.Router();

// Campaign analytics page
router.get('/:campaignId', async (req, res) => {
  const { campaignId } = req.params;
  
  try {
    // Get database connection
    const { default: database } = await import('../services/database');
    
    // Get campaign details
    const campaign = database.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) as any;
    
    if (!campaign) {
      return res.status(404).send('Campaign not found');
    }

    // Get comprehensive analytics data
    const analytics = await getCampaignAnalytics(campaignId, database);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Campaign Analytics - ${campaign.name} - Sundaylink</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  color: #333;
                  line-height: 1.6;
              }
              
              .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 20px 0;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              
              .container {
                  max-width: 1200px;
                  margin: 0 auto;
                  padding: 0 20px;
              }
              
              .header-content {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
              }
              
              .campaign-title {
                  font-size: 24px;
                  font-weight: 600;
                  margin-bottom: 5px;
              }
              
              .campaign-url {
                  font-size: 14px;
                  opacity: 0.9;
                  word-break: break-all;
              }
              
              .nav-tabs {
                  display: flex;
                  background: white;
                  border-radius: 8px;
                  padding: 4px;
                  margin: 20px 0;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              
              .nav-tab {
                  flex: 1;
                  padding: 12px 20px;
                  text-align: center;
                  border-radius: 6px;
                  cursor: pointer;
                  transition: all 0.2s;
                  font-weight: 500;
                  background: transparent;
                  border: none;
                  color: #666;
              }
              
              .nav-tab.active {
                  background: #667eea;
                  color: white;
                  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
              }
              
              .analytics-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 20px;
                  margin: 20px 0;
              }
              
              .metric-card {
                  background: white;
                  border-radius: 12px;
                  padding: 24px;
                  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
                  border-left: 4px solid #667eea;
              }
              
              .metric-value {
                  font-size: 32px;
                  font-weight: 700;
                  color: #333;
                  margin-bottom: 8px;
              }
              
              .metric-label {
                  font-size: 14px;
                  color: #666;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
              }
              
              .chart-container {
                  background: white;
                  border-radius: 12px;
                  padding: 24px;
                  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
                  margin: 20px 0;
              }
              
              .chart-title {
                  font-size: 18px;
                  font-weight: 600;
                  margin-bottom: 20px;
                  color: #333;
              }
              
              .countries-table {
                  background: white;
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
                  margin: 20px 0;
              }
              
              .table {
                  width: 100%;
                  border-collapse: collapse;
              }
              
              .table th {
                  background: #f8f9fa;
                  padding: 16px;
                  text-align: left;
                  font-weight: 600;
                  color: #333;
                  border-bottom: 2px solid #e9ecef;
              }
              
              .table td {
                  padding: 16px;
                  border-bottom: 1px solid #e9ecef;
              }
              
              .table tr:hover {
                  background: #f8f9fa;
              }
              
              .country-flag {
                  width: 24px;
                  height: 16px;
                  margin-right: 8px;
                  border-radius: 2px;
              }
              
              .btn {
                  background: #667eea;
                  color: white;
                  padding: 10px 20px;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  text-decoration: none;
                  display: inline-block;
                  font-weight: 500;
                  transition: all 0.2s;
              }
              
              .btn:hover {
                  background: #5a6fd8;
                  transform: translateY(-1px);
              }
              
              .btn-secondary {
                  background: #6c757d;
              }
              
              .btn-secondary:hover {
                  background: #5a6268;
              }
              
              .loading {
                  text-align: center;
                  padding: 40px;
                  color: #666;
              }
              
              .hidden {
                  display: none;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="container">
                  <div class="header-content">
                      <div>
                          <div class="campaign-title">${campaign.name}</div>
                          <div class="campaign-url">${campaign.destination_url}</div>
                      </div>
                      <div>
                          <a href="/dashboard" class="btn btn-secondary">← Back to Dashboard</a>
                      </div>
                  </div>
              </div>
          </div>
          
          <div class="container">
              <div class="nav-tabs">
                  <button class="nav-tab active" onclick="showTab('overview')">Overview</button>
                  <button class="nav-tab" onclick="showTab('trends')">Trends</button>
                  <button class="nav-tab" onclick="showTab('countries')">Countries</button>
                  <button class="nav-tab" onclick="showTab('growth')">Growth</button>
              </div>
              
              <!-- Overview Tab -->
              <div id="overview-tab" class="tab-content">
                  <div class="analytics-grid">
                      <div class="metric-card">
                          <div class="metric-value">${analytics.totalClicks}</div>
                          <div class="metric-label">Total Clicks</div>
                      </div>
                      <div class="metric-card">
                          <div class="metric-value">${analytics.totalStreams}</div>
                          <div class="metric-label">Total Streams</div>
                      </div>
                      <div class="metric-card">
                          <div class="metric-value">${analytics.uniqueListeners}</div>
                          <div class="metric-label">Unique Listeners</div>
                      </div>
                      <div class="metric-card">
                          <div class="metric-value">${analytics.uniqueSongs}</div>
                          <div class="metric-label">Unique Songs</div>
                      </div>
                      <div class="metric-card">
                          <div class="metric-value">${analytics.streamsPerListener}</div>
                          <div class="metric-label">Streams/Listener</div>
                      </div>
                      <div class="metric-card">
                          <div class="metric-value">${analytics.followersGained}</div>
                          <div class="metric-label">Followers Gained</div>
                      </div>
                  </div>
              </div>
              
              <!-- Trends Tab -->
              <div id="trends-tab" class="tab-content hidden">
                  <div class="chart-container">
                      <div class="chart-title">Streams Over Time</div>
                      <canvas id="streamsChart" width="400" height="200"></canvas>
                  </div>
                  <div class="chart-container">
                      <div class="chart-title">Listeners Over Time</div>
                      <canvas id="listenersChart" width="400" height="200"></canvas>
                  </div>
              </div>
              
              <!-- Countries Tab -->
              <div id="countries-tab" class="tab-content hidden">
                  <div class="countries-table">
                      <table class="table">
                          <thead>
                              <tr>
                                  <th>Country</th>
                                  <th>Listeners</th>
                                  <th>Streams</th>
                                  <th>S/L</th>
                              </tr>
                          </thead>
                          <tbody id="countriesTableBody">
                              <tr>
                                  <td colspan="4" class="loading">Loading country data...</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </div>
              
              <!-- Growth Tab -->
              <div id="growth-tab" class="tab-content hidden">
                  <div class="chart-container">
                      <div class="chart-title">Growth Metrics</div>
                      <canvas id="growthChart" width="400" height="200"></canvas>
                  </div>
              </div>
          </div>
          
          <script>
              const campaignId = '${campaignId}';
              const API_BASE = window.location.origin;
              
              function showTab(tabName) {
                  // Hide all tabs
                  document.querySelectorAll('.tab-content').forEach(tab => {
                      tab.classList.add('hidden');
                  });
                  
                  // Remove active class from all nav tabs
                  document.querySelectorAll('.nav-tab').forEach(tab => {
                      tab.classList.remove('active');
                  });
                  
                  // Show selected tab
                  document.getElementById(tabName + '-tab').classList.remove('hidden');
                  event.target.classList.add('active');
                  
                  // Load tab-specific data
                  if (tabName === 'trends') {
                      loadTrendsData();
                  } else if (tabName === 'countries') {
                      loadCountriesData();
                  } else if (tabName === 'growth') {
                      loadGrowthData();
                  }
              }
              
              async function loadTrendsData() {
                  try {
                      const response = await fetch(\`\${API_BASE}/api/campaigns/\${campaignId}/trends\`);
                      const data = await response.json();
                      
                      // Create streams chart
                      const streamsCtx = document.getElementById('streamsChart').getContext('2d');
                      new Chart(streamsCtx, {
                          type: 'line',
                          data: {
                              labels: data.dates,
                              datasets: [{
                                  label: 'Streams',
                                  data: data.streams,
                                  borderColor: '#667eea',
                                  backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                  fill: true,
                                  tension: 0.4
                              }]
                          },
                          options: {
                              responsive: true,
                              plugins: {
                                  legend: {
                                      display: false
                                  }
                              },
                              scales: {
                                  y: {
                                      beginAtZero: true
                                  }
                              }
                          }
                      });
                      
                      // Create listeners chart
                      const listenersCtx = document.getElementById('listenersChart').getContext('2d');
                      new Chart(listenersCtx, {
                          type: 'line',
                          data: {
                              labels: data.dates,
                              datasets: [{
                                  label: 'Listeners',
                                  data: data.listeners,
                                  borderColor: '#28a745',
                                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                                  fill: true,
                                  tension: 0.4
                              }]
                          },
                          options: {
                              responsive: true,
                              plugins: {
                                  legend: {
                                      display: false
                                  }
                              },
                              scales: {
                                  y: {
                                      beginAtZero: true
                                  }
                              }
                          }
                      });
                  } catch (error) {
                      console.error('Error loading trends data:', error);
                  }
              }
              
              async function loadCountriesData() {
                  try {
                      const response = await fetch(\`\${API_BASE}/api/campaigns/\${campaignId}/countries\`);
                      const data = await response.json();
                      
                      const tbody = document.getElementById('countriesTableBody');
                      tbody.innerHTML = '';
                      
                      data.countries.forEach(country => {
                          const row = document.createElement('tr');
                          row.innerHTML = \`
                              <td>
                                  <span class="country-flag">\${country.flag}</span>
                                  \${country.name}
                              </td>
                              <td>\${country.listeners}</td>
                              <td>\${country.streams}</td>
                              <td>\${country.spl.toFixed(2)}</td>
                          \`;
                          tbody.appendChild(row);
                      });
                  } catch (error) {
                      console.error('Error loading countries data:', error);
                      document.getElementById('countriesTableBody').innerHTML = 
                          '<tr><td colspan="4">Error loading country data</td></tr>';
                  }
              }
              
              async function loadGrowthData() {
                  try {
                      const response = await fetch(\`\${API_BASE}/api/campaigns/\${campaignId}/growth\`);
                      const data = await response.json();
                      
                      const growthCtx = document.getElementById('growthChart').getContext('2d');
                      new Chart(growthCtx, {
                          type: 'bar',
                          data: {
                              labels: data.labels,
                              datasets: [
                                  {
                                      label: 'Followers',
                                      data: data.followers,
                                      backgroundColor: 'rgba(102, 126, 234, 0.8)',
                                      borderColor: '#667eea',
                                      borderWidth: 1
                                  },
                                  {
                                      label: 'Listeners',
                                      data: data.listeners,
                                      backgroundColor: 'rgba(40, 167, 69, 0.8)',
                                      borderColor: '#28a745',
                                      borderWidth: 1
                                  }
                              ]
                          },
                          options: {
                              responsive: true,
                              scales: {
                                  y: {
                                      beginAtZero: true
                                  }
                              }
                          }
                      });
                  } catch (error) {
                      console.error('Error loading growth data:', error);
                  }
              }
          </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error loading campaign analytics:', error);
    res.status(500).send('Error loading campaign analytics');
  }
});

// Helper function to get comprehensive campaign analytics
async function getCampaignAnalytics(campaignId: string, database: any) {
  try {
    // Get attribution service
    const { default: attributionService } = await import('../services/attribution');
    
    // Get basic campaign stats
    const campaignStats = attributionService.getCampaignStats(campaignId);
    
    // Get unique songs count
    const uniqueSongs = database.prepare(`
      SELECT COUNT(DISTINCT p.spotify_track_id) as count
      FROM attributions a
      JOIN plays p ON a.play_id = p.id
      WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
    `).get(campaignId) as { count: number } | undefined;
    
    // Get followers gained
    const followersGained = database.prepare(`
      SELECT 
        MAX(follower_count) - MIN(follower_count) as gained
      FROM followers_snapshots 
      WHERE spotify_id IN (
        SELECT DISTINCT c.spotify_playlist_id 
        FROM campaigns c 
        WHERE c.id = ? AND c.spotify_playlist_id IS NOT NULL
      )
      AND spotify_type = 'playlist'
      AND snapshot_date >= (
        SELECT DATE(created_at) 
        FROM campaigns 
        WHERE id = ?
      )
      AND expires_at > datetime('now')
    `).get(campaignId, campaignId) as { gained: number } | undefined;
    
    // Get click count
    const clickCount = database.prepare(`
      SELECT COUNT(*) as count 
      FROM clicks 
      WHERE campaign_id = ? AND expires_at > datetime('now')
    `).get(campaignId) as { count: number } | undefined;
    
    return {
      totalClicks: clickCount?.count || 0,
      totalStreams: campaignStats.total_attributions,
      uniqueListeners: campaignStats.unique_listeners,
      uniqueSongs: uniqueSongs?.count || 0,
      streamsPerListener: campaignStats.streams_per_listener,
      followersGained: followersGained?.gained || 0
    };
  } catch (error) {
    console.error('Error getting campaign analytics:', error);
    return {
      totalClicks: 0,
      totalStreams: 0,
      uniqueListeners: 0,
      uniqueSongs: 0,
      streamsPerListener: 0,
      followersGained: 0
    };
  }
}

export default router;
