import express from 'express';

const router = express.Router();

// In-memory storage for campaigns (Railway-compatible fallback)
let campaignStorage: any[] = [];

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
  
  // Save to in-memory storage
  campaignStorage.push(campaign);
  
  console.log('✅ Campaign created and saved:', campaign);
  console.log(`📊 Total campaigns: ${campaignStorage.length}`);
  
  res.status(201).json(campaign);
});

// Get all campaigns
router.get('/', (req, res) => {
  console.log('📋 GET /api/campaigns - Fetching campaigns');
  console.log(`📊 Total campaigns: ${campaignStorage.length}`);
  
  const campaignsWithUrls = campaignStorage.map(campaign => ({
    ...campaign,
    smart_link_url: `${req.protocol}://${req.get('host')}/c/${campaign.id}`
  }));
  
  res.json(campaignsWithUrls);
});

export default router;