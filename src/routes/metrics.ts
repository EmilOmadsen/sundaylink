import express from 'express';
import campaignService from '../services/campaigns';
import clickService from '../services/clicks';
import attributionService from '../services/attribution';
import followersService from '../services/followers';
import pollingService from '../services/polling';
import db from '../services/database';

const router = express.Router();

// Get campaign metrics
router.get('/campaigns/:campaignId', (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaign = campaignService.getById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get click metrics
    const clicks = clickService.getByCampaign(campaignId);

    // Helper to group counts
    const countBy = (arr: any[], key: string) => arr.reduce((acc: Record<string, number>, item: any) => {
      const k = (item[key] || 'unknown') as string;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Lightweight user-agent parsing for analytics readability
    const parsedClicks = clicks.map(c => {
      const ua = (c.user_agent || '').toLowerCase();
      let browser = 'other';
      if (ua.includes('edg/')) browser = 'edge';
      else if (ua.includes('chrome/')) browser = 'chrome';
      else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'safari';
      else if (ua.includes('firefox/')) browser = 'firefox';

      let os = 'other';
      if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'ios';
      else if (ua.includes('android')) os = 'android';
      else if (ua.includes('mac os x') || ua.includes('macintosh')) os = 'macos';
      else if (ua.includes('windows')) os = 'windows';
      else if (ua.includes('linux')) os = 'linux';

      const device = (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) ? 'mobile' : 'desktop';

      const hour = new Date(c.clicked_at).getHours();

      return { ...c, browser, os, device, hour };
    });

    const byBrowser = countBy(parsedClicks, 'browser');
    const byOS = countBy(parsedClicks, 'os');
    const byDevice = countBy(parsedClicks, 'device');
    const byReferrer = countBy(parsedClicks, 'referrer');
    const byUtmMedium = countBy(parsedClicks, 'utm_medium');
    const byUtmCampaign = countBy(parsedClicks, 'utm_campaign');
    const hoursHistogram = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: parsedClicks.filter(c => c.hour === h).length }));
    
    // Get attribution metrics
    const attributionStats = attributionService.getCampaignStats(campaignId);
    const attributions = attributionService.getByCampaign(campaignId);

    // Get followers metrics if available
    let followersMetrics = null;
    if (campaign.spotify_artist_id || campaign.spotify_playlist_id) {
      if (campaign.spotify_artist_id) {
        followersMetrics = {
          type: 'artist',
          id: campaign.spotify_artist_id,
          delta: followersService.getFollowersDelta(campaign.spotify_artist_id, 'artist', 7),
          snapshots: followersService.getSnapshots(campaign.spotify_artist_id, 'artist', 7)
        };
      } else if (campaign.spotify_playlist_id) {
        followersMetrics = {
          type: 'playlist',
          id: campaign.spotify_playlist_id,
          delta: followersService.getFollowersDelta(campaign.spotify_playlist_id, 'playlist', 7),
          snapshots: followersService.getSnapshots(campaign.spotify_playlist_id, 'playlist', 7)
        };
      }
    }

    // Calculate time since creation
    const createdDate = new Date(campaign.created_at);
    const now = new Date();
    const daysActive = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    const metrics = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        created_at: campaign.created_at,
        days_active: daysActive,
        destination_url: campaign.destination_url,
        spotify_track_id: campaign.spotify_track_id,
        spotify_artist_id: campaign.spotify_artist_id,
        spotify_playlist_id: campaign.spotify_playlist_id
      },
      clicks: {
        total: clicks.length,
        unique_ips: new Set(clicks.map(c => c.ip_hash)).size,
        by_utm_source: groupBy(clicks.filter(c => c.utm_source), 'utm_source'),
        by_utm_medium: byUtmMedium,
        by_utm_campaign: byUtmCampaign,
        by_browser: byBrowser,
        by_os: byOS,
        by_device: byDevice,
        by_referrer: byReferrer,
        hours_histogram: hoursHistogram,
        recent: parsedClicks.slice(0, 10)
      },
      streams: {
        total: attributionStats.total_attributions,
        listeners: attributionStats.unique_listeners,
        streams_per_listener: attributionStats.streams_per_listener,
        confidence_breakdown: attributionStats.confidence_breakdown
      },
      followers: followersMetrics,
      attributions: {
        total: attributions.length,
        recent: attributions.slice(0, 10)
      }
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching campaign metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get all campaigns summary
router.get('/campaigns', (req, res) => {
  try {
    const campaigns = campaignService.getAll();
    
    const campaignsWithMetrics = campaigns.map(campaign => {
      const clicks = clickService.getByCampaign(campaign.id);
      const attributionStats = attributionService.getCampaignStats(campaign.id);
      
      // Calculate followers delta if available
      let followersDelta = null;
      if (campaign.spotify_artist_id) {
        followersDelta = followersService.getFollowersDelta(campaign.spotify_artist_id, 'artist', 7);
      } else if (campaign.spotify_playlist_id) {
        followersDelta = followersService.getFollowersDelta(campaign.spotify_playlist_id, 'playlist', 7);
      }

      // Get unique songs count for this campaign
      let uniqueSongs = 0;
      if (campaign.spotify_playlist_id) {
        const uniqueSongsResult = db.prepare(`
          SELECT COUNT(DISTINCT p.spotify_track_id) as unique_songs
          FROM attributions a
          JOIN plays p ON a.play_id = p.id
          WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
        `).get(campaign.id) as { unique_songs: number };
        uniqueSongs = uniqueSongsResult?.unique_songs || 0;
      }

      const createdDate = new Date(campaign.created_at);
      const now = new Date();
      const daysActive = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...campaign,
        days_active: daysActive,
        metrics: {
          clicks: clicks.length,
          streams: attributionStats.total_attributions,
          listeners: attributionStats.unique_listeners,
          streams_per_listener: attributionStats.streams_per_listener,
          followers_delta: followersDelta?.delta || 0,
          unique_songs: uniqueSongs
        }
      };
    });

    res.json({
      campaigns: campaignsWithMetrics,
      summary: {
        total_campaigns: campaigns.length,
        active_campaigns: campaigns.filter(c => c.status === 'active').length,
        total_clicks: campaignsWithMetrics.reduce((sum, c) => sum + c.metrics.clicks, 0),
        total_streams: campaignsWithMetrics.reduce((sum, c) => sum + c.metrics.streams, 0),
        total_listeners: campaignsWithMetrics.reduce((sum, c) => sum + c.metrics.listeners, 0),
        total_unique_songs: campaignsWithMetrics.reduce((sum, c) => sum + c.metrics.unique_songs, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching campaigns summary:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns summary' });
  }
});

// Get click details for a campaign
router.get('/campaigns/:campaignId/clicks', (req, res) => {
  try {
    const { campaignId } = req.params;
    const clicks = clickService.getByCampaign(campaignId);
    
    const clicksWithAttribution = clicks.map(click => {
      const attributions = attributionService.getByClick(click.id);
      return {
        ...click,
        attributions: attributions
      };
    });

    res.json(clicksWithAttribution);
  } catch (error) {
    console.error('Error fetching campaign clicks:', error);
    res.status(500).json({ error: 'Failed to fetch campaign clicks' });
  }
});

// Daily time series for a campaign (clicks and streams)
router.get('/campaigns/:campaignId/timeseries', (req, res) => {
  try {
    const { campaignId } = req.params;
    const days = Math.max(1, Math.min(parseInt((req.query.days as string) || '30', 10), 365));

    const clicksByDay = (require('../services/database').default.prepare(`
      SELECT date(clicked_at) as day, COUNT(*) as clicks
      FROM clicks
      WHERE campaign_id = ? AND clicked_at >= date('now', '-' || ? || ' days') AND expires_at > datetime('now')
      GROUP BY date(clicked_at)
      ORDER BY day ASC
    `).all(campaignId, days) as Array<{ day: string; clicks: number }>);

    const streamsByDay = (require('../services/database').default.prepare(`
      SELECT date(created_at) as day, COUNT(*) as streams
      FROM attributions
      WHERE campaign_id = ? AND created_at >= date('now', '-' || ? || ' days') AND expires_at > datetime('now')
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all(campaignId, days) as Array<{ day: string; streams: number }>);

    res.json({ days, clicksByDay, streamsByDay });
  } catch (error) {
    console.error('Error fetching campaign timeseries:', error);
    res.status(500).json({ error: 'Failed to fetch campaign timeseries' });
  }
});

// Get attribution details for a campaign
router.get('/campaigns/:campaignId/attributions', (req, res) => {
  try {
    const { campaignId } = req.params;
    const attributions = attributionService.getByCampaign(campaignId);
    res.json(attributions);
  } catch (error) {
    console.error('Error fetching campaign attributions:', error);
    res.status(500).json({ error: 'Failed to fetch campaign attributions' });
  }
});

// Trigger manual polling for debugging
router.post('/admin/poll', async (req, res) => {
  try {
    await pollingService.pollAllUsers();
    res.json({ message: 'Polling completed' });
  } catch (error) {
    console.error('Error in manual polling:', error);
    res.status(500).json({ error: 'Polling failed' });
  }
});

// Trigger manual attribution for debugging  
router.post('/admin/attribute', async (req, res) => {
  try {
    const result = await attributionService.attributeNewPlays();
    res.json(result);
  } catch (error) {
    console.error('Error in manual attribution:', error);
    res.status(500).json({ error: 'Attribution failed' });
  }
});

// Trigger manual followers tracking
router.post('/admin/followers', async (req, res) => {
  try {
    const result = await followersService.trackAllCampaignFollowers();
    res.json(result);
  } catch (error) {
    console.error('Error in manual followers tracking:', error);
    res.status(500).json({ error: 'Followers tracking failed' });
  }
});

// Get system status
router.get('/admin/status', (req, res) => {
  try {
    const pollingStatus = pollingService.getStatus();
    
    res.json({
      polling: pollingStatus,
      database: {
        connected: true // We know it's connected if we got this far
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({ error: 'Failed to fetch system status' });
  }
});

// Helper function to group array by field
function groupBy(array: any[], field: string): Record<string, number> {
  return array.reduce((groups, item) => {
    const key = item[field] || 'unknown';
    groups[key] = (groups[key] || 0) + 1;
    return groups;
  }, {});
}

// Get songs listened to per campaign (only from the specific playlist after clicking)
router.get('/campaigns/:campaignId/songs', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // Get campaign info to ensure we have a playlist
    const campaign = campaignService.getById(campaignId);
    if (!campaign || !campaign.spotify_playlist_id) {
      return res.json({ songs: [], message: 'Campaign has no associated playlist' });
    }
    
    // Get all songs played that are attributed to this campaign
    // These are songs that were played AFTER clicking the tracking link
    const songs = db.prepare(`
      SELECT 
        p.spotify_track_id,
        p.track_name,
        p.artist_name,
        COUNT(*) as play_count,
        COUNT(DISTINCT p.user_id) as unique_listeners,
        MIN(p.played_at) as first_played,
        MAX(p.played_at) as last_played,
        AVG(a.confidence) as avg_confidence,
        COUNT(DISTINCT a.click_id) as unique_clicks_attributed
      FROM plays p
      INNER JOIN attributions a ON p.id = a.play_id
      WHERE a.campaign_id = ? AND p.expires_at > datetime('now')
      GROUP BY p.spotify_track_id, p.track_name, p.artist_name
      ORDER BY play_count DESC, unique_listeners DESC
    `).all(campaignId);

    // Add Spotify links and artwork
    const songsWithLinks = songs.map((song: any) => ({
      ...song,
      spotify_url: song.spotify_track_id ? `https://open.spotify.com/track/${song.spotify_track_id}` : null,
      artwork_url: song.spotify_track_id ? `https://via.placeholder.com/50x50/1db954/ffffff?text=🎵` : null
    }));

    res.json({ 
      songs: songsWithLinks,
      playlist_id: campaign.spotify_playlist_id,
      playlist_url: campaign.destination_url,
      total_songs_from_playlist: songsWithLinks.length
    });
  } catch (error) {
    console.error('Error fetching campaign songs:', error);
    res.status(500).json({ error: 'Failed to fetch campaign songs' });
  }
});

// Get playlist-specific songs summary across all campaigns
router.get('/songs-summary', async (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        c.id as campaign_id,
        c.name as campaign_name,
        c.spotify_playlist_id,
        c.destination_url,
        COUNT(DISTINCT p.spotify_track_id) as unique_songs_from_playlist,
        COUNT(p.id) as total_plays_from_playlist,
        COUNT(DISTINCT p.user_id) as unique_listeners,
        COUNT(DISTINCT a.click_id) as unique_clicks_attributed
      FROM campaigns c
      LEFT JOIN attributions a ON c.id = a.campaign_id
      LEFT JOIN plays p ON a.play_id = p.id
      WHERE c.expires_at > datetime('now') AND c.spotify_playlist_id IS NOT NULL
      GROUP BY c.id, c.name, c.spotify_playlist_id, c.destination_url
      ORDER BY total_plays_from_playlist DESC
    `).all();

    res.json({ 
      campaigns: summary,
      message: 'Songs played from specific playlists after clicking tracking links'
    });
  } catch (error) {
    console.error('Error fetching songs summary:', error);
    res.status(500).json({ error: 'Failed to fetch songs summary' });
  }
});

// Get recent plays with campaign attribution (keeping for backward compatibility)
router.get('/recent-plays', async (req, res) => {
  try {
    const plays = db.prepare(`
      SELECT 
        p.id,
        p.track_name,
        p.artist_name,
        p.played_at,
        p.spotify_track_id,
        c.name as campaign_name,
        a.confidence
      FROM plays p
      LEFT JOIN attributions a ON p.id = a.play_id
      LEFT JOIN campaigns c ON a.campaign_id = c.id
      WHERE p.user_id = 3
      ORDER BY p.played_at DESC
      LIMIT 20
    `).all();

    // Add Spotify links and artwork
    const playsWithLinks = plays.map((play: any) => ({
      ...play,
      spotify_url: play.spotify_track_id ? `https://open.spotify.com/track/${play.spotify_track_id}` : null,
      // For now, we'll use a placeholder. In production, you'd fetch real artwork from Spotify API
      artwork_url: play.spotify_track_id ? `https://via.placeholder.com/50x50/1db954/ffffff?text=🎵` : null
    }));

    res.json({ plays: playsWithLinks });
  } catch (error) {
    console.error('Error fetching recent plays:', error);
    res.status(500).json({ error: 'Failed to fetch recent plays' });
  }
});

// Helper function is exported above

export default router;