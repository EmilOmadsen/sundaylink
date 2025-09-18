import express from 'express';

const router = express.Router();

// Database connection with error handling
let db: any = null;
try {
  db = require('../services/database').default;
  console.log('✅ Database imported successfully');
} catch (error) {
  console.error('❌ Failed to import database:', error);
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
  
  // Save to database
  if (!db) {
    console.error('❌ Database not available - cannot save campaign');
    return res.status(500).json({ error: 'Database not available' });
  }
  
  try {
    console.log('💾 Attempting to save campaign to database...');
    const insertCampaign = db.prepare(`
      INSERT INTO campaigns (id, name, destination_url, spotify_track_id, spotify_artist_id, spotify_playlist_id, smart_link_url, status, created_at, clicks, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertCampaign.run(
      campaign.id,
      campaign.name,
      campaign.destination_url,
      campaign.spotify_track_id,
      campaign.spotify_artist_id,
      campaign.spotify_playlist_id,
      campaign.smart_link_url,
      campaign.status,
      campaign.created_at,
      campaign.clicks,
      campaign.user_id
    );
    
    console.log('✅ Campaign saved to database. Insert result:', result);
    
    // Verify it was saved by reading it back
    const verifyCampaign = db.prepare('SELECT * FROM campaigns WHERE id = ?');
    const savedCampaign = verifyCampaign.get(campaign.id);
    console.log('🔍 Verification - Campaign in database:', savedCampaign ? 'FOUND' : 'NOT FOUND');
    
  } catch (dbError) {
    console.error('❌ Failed to save campaign to database:', dbError);
    console.error('Stack trace:', dbError instanceof Error ? dbError.stack : 'No stack');
    return res.status(500).json({ error: 'Failed to save campaign to database' });
  }
  
  res.status(201).json(campaign);
});

// Get all campaigns
router.get('/', (req, res) => {
  console.log('📋 GET /api/campaigns - Fetching campaigns from database');
  
  if (!db) {
    console.error('❌ Database not available - cannot fetch campaigns');
    return res.status(500).json({ error: 'Database not available' });
  }
  
  try {
    // First check if table exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaigns'");
    const tableExists = tableCheck.get();
    console.log('🔍 Campaigns table exists:', tableExists ? 'YES' : 'NO');
    
    if (!tableExists) {
      console.log('⚠️ Campaigns table does not exist, initializing...');
      initializeCampaignsTable();
    }
    
    const getCampaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC');
    const campaigns = getCampaigns.all();
    
    console.log(`📊 Total campaigns in database: ${campaigns.length}`);
    if (campaigns.length > 0) {
      console.log('🔍 First campaign:', campaigns[0]);
    }
    
    const campaignsWithUrls = campaigns.map((campaign: any) => ({
      ...campaign,
      smart_link_url: `${req.protocol}://${req.get('host')}/c/${campaign.id}`
    }));
    
    res.json(campaignsWithUrls);
  } catch (error) {
    console.error('❌ Failed to fetch campaigns from database:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

export default router;