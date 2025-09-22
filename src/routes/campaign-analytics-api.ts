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
    
    // Get country data from plays (using user IP or other geographic data)
    // For now, we'll use a simplified approach based on user data
    const countries = database.prepare(`
      SELECT 
        'Unknown' as country,
        COUNT(DISTINCT s.user_id) as listeners,
        COUNT(DISTINCT a.play_id) as streams
      FROM attributions a
      JOIN sessions s ON a.click_id = s.click_id
      WHERE a.campaign_id = ? 
      AND a.expires_at > datetime('now')
    `).get(campaignId) as { country: string, listeners: number, streams: number };
    
    // Calculate S/L ratio and format data
    const countryData = [{
      name: countries.country,
      flag: '🌍', // Default flag
      listeners: countries.listeners,
      streams: countries.streams,
      spl: countries.listeners > 0 ? countries.streams / countries.listeners : 0
    }];
    
    res.json(countryData);
  } catch (error) {
    console.error('Error getting countries data:', error);
    res.status(500).json({ error: 'Failed to get countries data' });
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
