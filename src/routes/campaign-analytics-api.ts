import express from 'express';

const router = express.Router();

// Get overview data for a campaign
router.get('/:campaignId/overview', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { default: database } = await import('../services/database');
    
    // Get basic campaign stats
    const campaign = database.prepare(`
      SELECT name FROM campaigns WHERE id = ? AND expires_at > datetime('now')
    `).get(campaignId) as { name: string } | undefined;
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get total clicks
    const clicks = database.prepare(`
      SELECT COUNT(*) as count FROM clicks WHERE campaign_id = ? AND expires_at > datetime('now')
    `).get(campaignId) as { count: number };
    
    // Get total streams (attributions)
    const streams = database.prepare(`
      SELECT COUNT(DISTINCT a.play_id) as count FROM attributions a 
      WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
    `).get(campaignId) as { count: number };
    
    // Get unique listeners
    const listeners = database.prepare(`
      SELECT COUNT(DISTINCT s.user_id) as count FROM attributions a
      JOIN sessions s ON a.click_id = s.click_id
      WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
    `).get(campaignId) as { count: number };
    
    // Get unique songs
    const songs = database.prepare(`
      SELECT COUNT(DISTINCT p.spotify_track_id) as count FROM attributions a
      JOIN plays p ON a.play_id = p.id
      WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
    `).get(campaignId) as { count: number };
    
    const overview = {
      campaign_name: campaign.name,
      total_clicks: clicks.count,
      total_streams: streams.count,
      unique_listeners: listeners.count,
      unique_songs: songs.count,
      streams_per_listener: listeners.count > 0 ? (streams.count / listeners.count).toFixed(1) : '0.0',
      followers_gained: 0 // TODO: Implement follower tracking
    };
    
    res.json(overview);
  } catch (error) {
    console.error('Error getting overview data:', error);
    res.status(500).json({ error: 'Failed to get overview data' });
  }
});

// Get trends data for a campaign
router.get('/:campaignId/trends', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { default: database } = await import('../services/database');
    
    // Get daily trends for the last 30 days
    const trends = database.prepare(`
      SELECT 
        DATE(a.created_at) as date,
        COUNT(DISTINCT a.play_id) as streams,
        COUNT(DISTINCT s.user_id) as listeners
      FROM attributions a
      JOIN sessions s ON a.click_id = s.click_id
      WHERE a.campaign_id = ? 
      AND a.created_at >= datetime('now', '-30 days')
      AND a.expires_at > datetime('now')
      GROUP BY DATE(a.created_at)
      ORDER BY date ASC
    `).all(campaignId) as Array<{date: string, streams: number, listeners: number}>;
    
    // Generate date range
    const dates = [];
    const streamsData = [];
    const listenersData = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);
      
      const dayData = trends.find(t => t.date === dateStr);
      streamsData.push(dayData?.streams || 0);
      listenersData.push(dayData?.listeners || 0);
    }
    
    res.json({
      dates,
      streams: streamsData,
      listeners: listenersData
    });
  } catch (error) {
    console.error('Error getting trends data:', error);
    res.status(500).json({ error: 'Failed to get trends data' });
  }
});

// Get countries data for a campaign
router.get('/:campaignId/countries', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { default: database } = await import('../services/database');
    
    // Get total stats for the campaign first
    const totalStats = database.prepare(`
      SELECT 
        COUNT(DISTINCT s.user_id) as total_listeners,
        COUNT(DISTINCT a.play_id) as total_streams
      FROM attributions a
      JOIN sessions s ON a.click_id = s.click_id
      WHERE a.campaign_id = ? 
      AND a.expires_at > datetime('now')
    `).get(campaignId) as { total_listeners: number, total_streams: number } | undefined;
    
    // Handle case where no data is found
    if (!totalStats || totalStats.total_listeners === 0) {
      return res.json({
        countries: [{
          name: 'No data available',
          flag: '🌍',
          listeners: 0,
          streams: 0,
          spl: 0
        }]
      });
    }
    
    // For now, show all data as "Unknown" country since we don't have geographic data
    // In a real implementation, you'd use IP geolocation or user location data
    const countryData = [{
      name: 'Unknown',
      flag: '🌍',
      listeners: totalStats.total_listeners,
      streams: totalStats.total_streams,
      spl: totalStats.total_listeners > 0 ? totalStats.total_streams / totalStats.total_listeners : 0
    }];
    
    res.json({
      countries: countryData
    });
  } catch (error) {
    console.error('Error getting countries data for campaign', campaignId, ':', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ 
      error: 'Failed to get countries data',
      campaignId: campaignId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get growth data for a campaign
router.get('/:campaignId/growth', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { default: database } = await import('../services/database');
    
    // Get weekly growth data for the last 8 weeks
    const growth = database.prepare(`
      SELECT 
        strftime('%Y-%W', a.created_at) as week,
        COUNT(DISTINCT a.play_id) as streams,
        COUNT(DISTINCT s.user_id) as listeners
      FROM attributions a
      JOIN sessions s ON a.click_id = s.click_id
      WHERE a.campaign_id = ? 
      AND a.created_at >= datetime('now', '-8 weeks')
      AND a.expires_at > datetime('now')
      GROUP BY strftime('%Y-%W', a.created_at)
      ORDER BY week ASC
    `).all(campaignId) as Array<{week: string, streams: number, listeners: number}>;
    
    // Generate week labels
    const labels = [];
    const followersData = [];
    const listenersData = [];
    
    for (let i = 7; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7));
      const weekLabel = `Week ${i + 1}`;
      labels.push(weekLabel);
      
      // For now, we don't have follower data, so we'll use streams as a proxy
      const weekData = growth[i];
      listenersData.push(weekData?.listeners || 0);
      followersData.push(Math.floor((weekData?.streams || 0) * 0.3)); // Estimate followers as 30% of streams
    }
    
    res.json({
      labels,
      followers: followersData,
      listeners: listenersData
    });
  } catch (error) {
    console.error('Error getting growth data:', error);
    res.status(500).json({ error: 'Failed to get growth data' });
  }
});

export default router;
