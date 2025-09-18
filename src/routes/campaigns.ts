import express from 'express';

// In-memory storage for campaigns (since database might not be available)
let campaignStorage: any[] = [];

// Factory function that creates router with injected services
export function createCampaignsRouter(services: {
  campaignService?: any;
  authService?: any;
} = {}) {
  const router = express.Router();
  const { campaignService, authService } = services;

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
      message: token ? 'Auth token found' : 'No auth token found',
      authServiceAvailable: !!authService,
      campaignServiceAvailable: !!campaignService
    });
  });

  // Campaign creation endpoint (saves to in-memory storage)
  router.post('/', (req, res) => {
    console.log('🎯 POST /api/campaigns - Creating campaign');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    
    // Check if campaign service is available for database operations
    if (campaignService) {
      console.log('📊 Campaign service available - attempting database save');
      try {
        // Try to use the real campaign service
        const result = campaignService.create(req.body);
        console.log('✅ Campaign saved to database:', result);
        return res.status(201).json(result);
      } catch (error) {
        console.error('❌ Database save failed, falling back to in-memory:', error);
      }
    }
    
    // Fallback to in-memory storage
    console.log('💾 Using in-memory storage fallback');
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
    
    console.log('✅ Campaign created and saved to memory:', campaign);
    console.log(`📊 Total campaigns in storage: ${campaignStorage.length}`);
    
    res.status(201).json(campaign);
  });

  // Get all campaigns
  router.get('/', (req, res) => {
    console.log('📋 GET /api/campaigns - Fetching all campaigns');
    
    // Try database first if service available
    if (campaignService) {
      try {
        console.log('📊 Using campaign service to fetch campaigns');
        const campaigns = campaignService.getAll();
        return res.json(campaigns);
      } catch (error) {
        console.error('❌ Database fetch failed, falling back to in-memory:', error);
      }
    }
    
    // Fallback to in-memory storage
    console.log(`📊 Using in-memory storage: ${campaignStorage.length} campaigns`);
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
    
    // Try database first if service available
    if (campaignService) {
      try {
        const campaign = campaignService.getById(campaignId);
        if (campaign) {
          return res.json(campaign);
        }
      } catch (error) {
        console.error('❌ Database fetch failed, checking in-memory:', error);
      }
    }
    
    // Fallback to in-memory storage
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

  return router;
}

// Default export for backward compatibility
export default function createDefaultCampaignsRouter() {
  return createCampaignsRouter();
}