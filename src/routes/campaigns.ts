import express from 'express';

const router = express.Router();

// Import types
interface CreateCampaignData {
  name: string;
  destination_url: string;
  spotify_track_id?: string;
  spotify_artist_id?: string;
  spotify_playlist_id?: string;
  user_id?: number;
}

// Simple test route to verify route registration is working
router.get('/test', (req, res) => {
  console.log('🧪 GET /api/campaigns/test - Simple test route');
  res.json({ 
    message: 'Campaigns route is working!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import services after router is created to avoid circular dependencies
let campaignService: any = null;
let authService: any = null;

try {
  campaignService = require('../services/campaigns').default;
  authService = require('../services/auth').default;
  console.log('✅ Campaign services imported successfully');
} catch (error) {
  console.error('❌ Failed to import campaign services:', error);
}

// Debug route to check authentication status (no auth required)
router.get('/auth-status', (req, res) => {
  console.log('🔍 GET /api/campaigns/auth-status - Debug route');
  console.log('🍪 Cookies received:', req.cookies);
  
  if (!authService) {
    return res.json({ 
      authenticated: false, 
      message: 'Auth service not available - service import failed',
      serviceStatus: 'failed'
    });
  }
  
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.json({ 
      authenticated: false, 
      message: 'No auth_token cookie found',
      cookies: Object.keys(req.cookies),
      serviceStatus: 'ok'
    });
  }
  
  try {
    const decoded = authService.verifyToken(token);
    if (decoded) {
      const user = authService.getById(decoded.userId);
      return res.json({ 
        authenticated: true, 
        user: user ? { id: user.id, email: user.email } : null,
        message: 'Token valid',
        serviceStatus: 'ok'
      });
    } else {
      return res.json({ 
        authenticated: false, 
        message: 'Token invalid or expired',
        serviceStatus: 'ok'
      });
    }
  } catch (error) {
    return res.json({ 
      authenticated: false, 
      message: 'Token verification failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      serviceStatus: 'error'
    });
  }
});

// Create a new campaign (requires authentication)
router.post('/', (req, res, next) => {
  if (!authService) {
    return res.status(500).json({ error: 'Auth service not available' });
  }
  authService.authenticate(req, res, next);
}, (req, res) => {
  try {
    console.log('🎯 POST /api/campaigns - Request received');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔐 User from token:', (req as any).user);
    console.log('🍪 Cookies:', req.cookies);
    
    const { name, destination_url, spotify_track_id, spotify_artist_id, spotify_playlist_id } = req.body;

    if (!name || !destination_url) {
      console.log('❌ Missing required fields - name or destination_url');
      return res.status(400).json({ error: 'Name and destination_url are required' });
    }

    const campaignData: CreateCampaignData = {
      name,
      destination_url,
      spotify_track_id,
      spotify_artist_id,
      spotify_playlist_id,
      user_id: (req as any).user.id
    };

    console.log('💾 Creating campaign with data:', campaignData);
    const campaign = campaignService.create(campaignData);
    console.log('✅ Campaign created successfully:', campaign);
    
    // Generate smart link URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const smartLinkUrl = campaignService.getSmartLinkUrl(campaign.id, baseUrl);
    console.log('🔗 Generated smart link:', smartLinkUrl);

    const response = {
      ...(campaign as any),
      smart_link_url: smartLinkUrl
    };
    
    console.log('📤 Sending response:', response);
    res.status(201).json(response);
  } catch (error) {
    console.error('❌ Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Get campaigns for authenticated user
router.get('/', (req, res, next) => authService.authenticate(req, res, next), (req, res) => {
  try {
    const userId = (req as any).user.id;
    const campaigns = campaignService.getByUserId(userId);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const campaignsWithUrls = campaigns.map((campaign: any) => ({
      ...(campaign as any),
      smart_link_url: campaignService.getSmartLinkUrl(campaign.id, baseUrl)
    }));

    res.json(campaignsWithUrls);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get campaign by ID
router.get('/:id', (req, res) => {
  try {
    const campaign = campaignService.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const smartLinkUrl = campaignService.getSmartLinkUrl(campaign.id, baseUrl);

    res.json({
      ...(campaign as any),
      smart_link_url: smartLinkUrl
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// Update campaign status (requires authentication)
router.patch('/:id/status', (req, res, next) => authService.authenticate(req, res, next), (req, res) => {
  try {
    const { status } = req.body;
    const campaignId = req.params.id;
    const userId = (req as any).user.id;
    
    if (!status || !['active', 'paused', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (active, paused, archived)' });
    }

    // Check if campaign exists and belongs to the user
    const campaign = campaignService.getById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (campaign.user_id !== userId) {
      return res.status(403).json({ error: 'You can only modify your own campaigns' });
    }

    const updated = campaignService.updateStatus(campaignId, status);
    
    if (!updated) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ message: 'Campaign status updated successfully' });
  } catch (error) {
    console.error('Error updating campaign status:', error);
    res.status(500).json({ error: 'Failed to update campaign status' });
  }
});

// Delete campaign (requires authentication)
router.delete('/:id', (req, res, next) => authService.authenticate(req, res, next), (req, res) => {
  try {
    const campaignId = req.params.id;
    const userId = (req as any).user.id;
    
    // Check if campaign exists and belongs to the user
    const campaign = campaignService.getById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (campaign.user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own campaigns' });
    }

    const deleted = campaignService.delete(campaignId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// TEMPORARY TEST ENDPOINT - REMOVE IN PRODUCTION
router.post('/test', (req, res) => {
  try {
    console.log('🧪 TEST POST /api/campaigns/test - Request received');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    
    const { name, destination_url, spotify_track_id, spotify_artist_id, spotify_playlist_id } = req.body;

    if (!name || !destination_url) {
      console.log('❌ Missing required fields - name or destination_url');
      return res.status(400).json({ error: 'Name and destination_url are required' });
    }

    // Check if user ID 3 exists, otherwise use null
    const testUserId = 3;
    const campaignData: CreateCampaignData = {
      name,
      destination_url,
      spotify_track_id,
      spotify_artist_id,
      spotify_playlist_id,
      user_id: testUserId // Hardcoded for testing - should be replaced with proper auth
    };

    console.log('💾 Creating campaign with data:', campaignData);
    const campaign = campaignService.create(campaignData);
    console.log('✅ Campaign created successfully:', campaign);
    
    // Generate smart link URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const smartLinkUrl = campaignService.getSmartLinkUrl(campaign.id, baseUrl);
    console.log('🔗 Generated smart link:', smartLinkUrl);

    const response = {
      ...(campaign as any),
      smart_link_url: smartLinkUrl
    };
    
    console.log('📤 Sending response:', response);
    console.log('🔔 NOTIFICATION: Campaign created successfully! Smart link ready for sharing.');
    res.status(201).json(response);
  } catch (error) {
    console.error('❌ Error creating test campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign: ' + (error instanceof Error ? error.message : String(error)) });
  }
});

export default router;