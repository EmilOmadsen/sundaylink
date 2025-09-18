import express from 'express';

const router = express.Router();

// In-memory storage for campaigns (since database might not be available)
let campaignStorage: any[] = [];

// Simple test route to verify route registration is working
router.get('/test', (req, res) => {
  console.log('🧪 GET /api/campaigns/test - Simple test route');
  res.json({ 
    message: 'Campaigns route is working!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    status: 'success'
  });
});

// Simple auth status route (no services required)
router.get('/auth-status', (req, res) => {
  console.log('🔍 GET /api/campaigns/auth-status - Debug route');
  console.log('🍪 Cookies received:', req.cookies);
  
  const token = req.cookies.auth_token;
  
  res.json({ 
    hasAuthToken: !!token,
    cookieCount: Object.keys(req.cookies).length,
    cookies: Object.keys(req.cookies),
    timestamp: new Date().toISOString(),
    message: token ? 'Auth token found' : 'No auth token found'
  });
});

// Campaign creation endpoint (saves to in-memory storage)
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
    user_id: 1 // Default user for now
  };
  
  // Save to in-memory storage
  campaignStorage.push(campaign);
  
  console.log('✅ Campaign created and saved:', campaign);
  console.log(`📊 Total campaigns in storage: ${campaignStorage.length}`);
  
  res.status(201).json(campaign);
});

// Get all campaigns
router.get('/', (req, res) => {
  console.log('📋 GET /api/campaigns - Fetching all campaigns');
  console.log(`📊 Total campaigns in storage: ${campaignStorage.length}`);
  
  // Return all campaigns with smart link URLs
  const campaignsWithUrls = campaignStorage.map(campaign => ({
    ...campaign,
    smart_link_url: `${req.protocol}://${req.get('host')}/c/${campaign.id}`
  }));
  
  res.json(campaignsWithUrls);
});

// Get specific campaign by ID
router.get('/:id', (req, res) => {
  const campaignId = req.params.id;
  console.log(`🔍 GET /api/campaigns/${campaignId} - Fetching specific campaign`);
  
  const campaign = campaignStorage.find(c => c.id === campaignId);
  
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  
  const campaignWithUrl = {
    ...campaign,
    smart_link_url: `${req.protocol}://${req.get('host')}/c/${campaign.id}`
  };
  
  res.json(campaignWithUrl);
});

export default router;