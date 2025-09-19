import express from 'express';

const router = express.Router();

// Fallback in-memory storage for campaigns
let campaignStorage: any[] = [];

// Database connection with error handling
let db: any = null;
async function getDatabase() {
  if (!db) {
    try {
      db = require('../services/database').default;
      console.log('✅ Database imported successfully');
      // Ensure FK constraints are disabled for compatibility
      db.pragma('foreign_keys = OFF');
    } catch (error) {
      console.error('❌ Failed to import database:', error);
      console.log('⚠️ Using in-memory storage as fallback');
    }
  }
  return db;
}

// Database storage for campaigns
function initializeCampaignsTable() {
  if (!db) {
    console.error('❌ Database not available - cannot initialize campaigns table');
    return false;
  }
  
  try {
    // Create campaigns table if it doesn't exist
    const createTable = `
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        destination_url TEXT NOT NULL,
        spotify_track_id TEXT,
        spotify_artist_id TEXT, 
        spotify_playlist_id TEXT,
        smart_link_url TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT,
        clicks INTEGER DEFAULT 0,
        user_id INTEGER DEFAULT 1
      )
    `;
    db.exec(createTable);
    console.log('✅ Campaigns table initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize campaigns table:', error);
    return false;
  }
}

// Initialize table on startup
initializeCampaignsTable();

// Helper function to get unique songs for a campaign
async function getUniqueSongs(campaignId: string, database: any): Promise<number> {
  if (!database) return 0;
  
  try {
    const query = database.prepare(`
      SELECT COUNT(DISTINCT p.spotify_track_id) as count
      FROM attributions a
      JOIN plays p ON a.play_id = p.id
      WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
    `);
    
    const result = query.get(campaignId) as { count: number } | undefined;
    return result ? result.count : 0;
  } catch (error) {
    console.error(`Failed to get unique songs for campaign ${campaignId}:`, error);
    return 0;
  }
}

// Helper function to get followers gained for a campaign
async function getFollowersGained(campaignId: string, database: any): Promise<number> {
  if (!database) return 0;
  
  try {
    // Get campaign details to find the Spotify artist/playlist
    const getCampaign = database.prepare('SELECT spotify_artist_id, spotify_playlist_id FROM campaigns WHERE id = ?');
    const campaign = getCampaign.get(campaignId) as { spotify_artist_id?: string; spotify_playlist_id?: string } | undefined;
    
    if (!campaign || (!campaign.spotify_artist_id && !campaign.spotify_playlist_id)) {
      return 0;
    }
    
    // Calculate followers gained since campaign started
    const spotifyId = campaign.spotify_artist_id || campaign.spotify_playlist_id;
    const spotifyType = campaign.spotify_artist_id ? 'artist' : 'playlist';
    
    const query = database.prepare(`
      SELECT 
        MAX(follower_count) - MIN(follower_count) as gained
      FROM followers_snapshots 
      WHERE spotify_id = ? 
      AND spotify_type = ? 
      AND snapshot_date >= (
        SELECT DATE(created_at) 
        FROM campaigns 
        WHERE id = ?
      )
      AND expires_at > datetime('now')
    `);
    
    const result = query.get(spotifyId, spotifyType, campaignId) as { gained: number } | undefined;
    return result && result.gained > 0 ? result.gained : 0;
  } catch (error) {
    console.error(`Failed to get followers gained for campaign ${campaignId}:`, error);
    return 0;
  }
}

// Simple test route
router.get('/test', (req, res) => {
  console.log('🧪 GET /api/campaigns/test');
  res.json({ 
    message: 'Campaigns route working!', 
    timestamp: new Date().toISOString(),
    status: 'success'
  });
});

// Auth status route
router.get('/auth-status', (req, res) => {
  console.log('🔍 GET /api/campaigns/auth-status');
  const token = req.cookies.auth_token;
  
  res.json({ 
    hasAuthToken: !!token,
    cookieCount: Object.keys(req.cookies).length,
    cookies: Object.keys(req.cookies),
    timestamp: new Date().toISOString(),
    message: token ? 'Auth token found' : 'No auth token found'
  });
});

// Create campaign (in-memory storage)
router.post('/', (req, res) => {
  console.log('🎯 POST /api/campaigns - Creating campaign');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  
  const { name, destination_url, spotify_track_id, spotify_artist_id, spotify_playlist_id } = req.body;
  
  if (!name || !destination_url) {
    console.log('❌ Missing required fields');
    return res.status(400).json({ error: 'Name and destination_url are required' });
  }
  
  // Create campaign with unique ID
  const campaignId = 'camp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const campaign = {
    id: campaignId,
    name: name,
    destination_url: destination_url,
    spotify_track_id: spotify_track_id || null,
    spotify_artist_id: spotify_artist_id || null,
    spotify_playlist_id: spotify_playlist_id || null,
    smart_link_url: `${req.protocol}://${req.get('host')}/c/${campaignId}`,
    status: 'active',
    created_at: new Date().toISOString(),
    clicks: 0,
    user_id: 1
  };
  
  // Save to database (with in-memory fallback)
  let savedToDatabase = false;
  
  if (db) {
    try {
      console.log('💾 Attempting to save campaign to database...');
      
      // Ensure campaigns table exists with correct schema
      db.exec(`
        CREATE TABLE IF NOT EXISTS campaigns (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          destination_url TEXT NOT NULL,
          spotify_track_id TEXT,
          spotify_artist_id TEXT,
          spotify_playlist_id TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
        )
      `);
      
      const insertCampaign = db.prepare(`
        INSERT INTO campaigns (id, name, destination_url, spotify_track_id, spotify_artist_id, spotify_playlist_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = insertCampaign.run(
        campaign.id,
        campaign.name,
        campaign.destination_url,
        campaign.spotify_track_id,
        campaign.spotify_artist_id,
        campaign.spotify_playlist_id,
        campaign.status,
        campaign.created_at
      );
      
      console.log('✅ Campaign saved to database. Insert result:', result);
      savedToDatabase = true;
      
    } catch (dbError) {
      console.error('❌ Failed to save campaign to database:', dbError);
      console.log('⚠️ Falling back to in-memory storage');
    }
  }
  
  if (!savedToDatabase) {
    console.log('💾 Saving campaign to in-memory storage...');
    campaignStorage.push(campaign);
    console.log(`✅ Campaign saved to memory. Total campaigns: ${campaignStorage.length}`);
  }
  
  res.status(201).json(campaign);
});

// Get all campaigns
router.get('/', async (req, res) => {
  console.log('📋 GET /api/campaigns - Fetching campaigns');
  
  let campaigns: any[] = [];
  
  // Get database connection
  const database = await getDatabase();
  
  // Try to get from database first
  if (database) {
    try {
      console.log('📊 Attempting to fetch from database...');
      const tableCheck = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaigns'");
      const tableExists = tableCheck.get();
      console.log('🔍 Campaigns table exists:', tableExists ? 'YES' : 'NO');
      
      if (!tableExists) {
        console.log('⚠️ Campaigns table does not exist, initializing...');
        initializeCampaignsTable();
      }
      
      const getCampaigns = database.prepare('SELECT * FROM campaigns ORDER BY created_at DESC');
      campaigns = getCampaigns.all();
      console.log(`📊 Found ${campaigns.length} campaigns in database`);
      
    } catch (error) {
      console.error('❌ Failed to fetch campaigns from database:', error);
      console.log('⚠️ Falling back to in-memory storage');
      campaigns = [];
    }
  }
  
  // If no campaigns from database, use in-memory storage
  if (campaigns.length === 0 && campaignStorage.length > 0) {
    console.log(`📊 Using ${campaignStorage.length} campaigns from memory`);
    campaigns = campaignStorage;
  }
  
  // Add smart link URLs and comprehensive analytics
  const campaignsWithUrls = await Promise.all(campaigns.map(async (campaign: any) => {
    let clickCount = 0;
    let analytics = {
      streams: 0,
      unique_listeners: 0,
      unique_songs: 0,
      streams_per_listener: 0.0,
      followers_gained: 0
    };
    
    // Get click count from database if available
    try {
      if (database) {
        // Ensure clicks table exists
        database.exec(`
          CREATE TABLE IF NOT EXISTS clicks (
            id TEXT PRIMARY KEY,
            campaign_id TEXT NOT NULL,
            ip_hash TEXT NOT NULL,
            user_agent TEXT,
            utm_source TEXT,
            utm_medium TEXT,
            utm_campaign TEXT,
            utm_content TEXT,
            utm_term TEXT,
            referrer TEXT,
            clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
          )
        `);
        
        const getClickCount = database.prepare('SELECT COUNT(*) as count FROM clicks WHERE campaign_id = ?');
        const result = getClickCount.get(campaign.id) as { count: number } | undefined;
        clickCount = result ? result.count : 0;
        console.log(`📊 Campaign ${campaign.id} has ${clickCount} clicks`);
      }
    } catch (error) {
      console.error(`Failed to get click count for campaign ${campaign.id}:`, error);
    }
    
    // Get comprehensive analytics from attribution service
    try {
      const { default: attributionService } = await import('../services/attribution');
      const campaignStats = attributionService.getCampaignStats(campaign.id);
      
      analytics = {
        streams: campaignStats.total_attributions,
        unique_listeners: campaignStats.unique_listeners,
        unique_songs: await getUniqueSongs(campaign.id, database),
        streams_per_listener: campaignStats.streams_per_listener,
        followers_gained: await getFollowersGained(campaign.id, database)
      };
      
      console.log(`🎵 Campaign ${campaign.id} analytics:`, analytics);
    } catch (error) {
      console.error(`Failed to get analytics for campaign ${campaign.id}:`, error);
    }
    
    return {
      ...campaign,
      smart_link_url: `${req.protocol}://${req.get('host')}/c/${campaign.id}`,
      clicks: clickCount,
      streams: analytics.streams,
      unique_listeners: analytics.unique_listeners,
      unique_songs: analytics.unique_songs,
      streams_per_listener: analytics.streams_per_listener,
      followers_gained: analytics.followers_gained
    };
  }));
  
  console.log(`✅ Returning ${campaignsWithUrls.length} campaigns total`);
  res.json(campaignsWithUrls);
});

export default router;