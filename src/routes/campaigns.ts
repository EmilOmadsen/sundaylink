import express from 'express';

const router = express.Router();

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

// Placeholder for campaign creation (returns mock data for now)
router.post('/', (req, res) => {
  console.log('🎯 POST /api/campaigns - Mock endpoint');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  
  const { name, destination_url } = req.body;
  
  if (!name || !destination_url) {
    return res.status(400).json({ error: 'Name and destination_url are required' });
  }
  
  // Return mock campaign data
  const mockCampaign = {
    id: 'mock-' + Date.now(),
    name: name,
    destination_url: destination_url,
    smart_link_url: `${req.protocol}://${req.get('host')}/c/mock-${Date.now()}`,
    status: 'active',
    created_at: new Date().toISOString()
  };
  
  console.log('✅ Mock campaign created:', mockCampaign);
  res.status(201).json(mockCampaign);
});

export default router;