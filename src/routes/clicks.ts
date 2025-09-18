import express from 'express';
import clickService from '../services/clicks';

const router = express.Router();

// Database connection (same as campaigns route)
let db: any = null;
let campaignStorage: any[] = [];

try {
  db = require('../services/database').default;
  console.log('✅ Database imported in clicks route');
} catch (error) {
  console.error('❌ Failed to import database in clicks route:', error);
}

// Function to get campaign by ID - fetch from campaigns API
async function getCampaignById(campaignId: string, req: any) {
  try {
    // Make internal API call to get campaigns
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = await fetch(`${baseUrl}/api/campaigns`);
    
    if (!response.ok) {
      console.error('Failed to fetch campaigns from API:', response.status);
      return null;
    }
    
    const campaigns = await response.json();
    const campaign = campaigns.find((c: any) => c.id === campaignId);
    
    if (campaign) {
      console.log(`✅ Found campaign: ${campaign.name}`);
      return campaign;
    } else {
      console.log(`❌ Campaign ${campaignId} not found in ${campaigns.length} campaigns`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return null;
  }
}

// Smart link click handler - /c/:campaignId
router.get('/c/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    console.log(`🔗 Click tracking: ${campaignId}`);
    
    // Check if campaign exists and is active
    const campaign = await getCampaignById(campaignId, req);
    if (!campaign) {
      console.log(`❌ Campaign not found: ${campaignId}`);
      return res.status(404).send('Campaign not found');
    }

    if (campaign.status !== 'active') {
      return res.status(410).send('Campaign is not active');
    }

    // Extract UTM parameters and other tracking data
    const utmParams = clickService.extractUTMParams(req.query);
    const clientIP = clickService.getClientIP(req);
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referer');

    // Track the click
    const click = clickService.track({
      campaign_id: campaignId,
      ip: clientIP,
      user_agent: userAgent,
      referrer: referrer,
      ...utmParams
    });

    // Set click_id cookie (expires in 40 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 40);
    
    res.cookie('click_id', click.id, {
      expires: expiryDate,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Redirect to destination
    console.log(`✅ Redirecting to: ${campaign.destination_url}`);
    res.redirect(campaign.destination_url);
  } catch (error) {
    console.error('Error handling click:', error);
    res.status(500).send('Internal server error');
  }
});

// Get clicks for a campaign (for analytics)
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // Verify campaign exists
    const campaign = await getCampaignById(campaignId, req);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const clicks = clickService.getByCampaign(campaignId);
    res.json(clicks);
  } catch (error) {
    console.error('Error fetching clicks:', error);
    res.status(500).json({ error: 'Failed to fetch clicks' });
  }
});

export default router;