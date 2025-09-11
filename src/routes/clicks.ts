import express from 'express';
import campaignService from '../services/campaigns';
import clickService from '../services/clicks';

const router = express.Router();

// Smart link click handler - /c/:campaignId
router.get('/c/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // Check if campaign exists and is active
    const campaign = campaignService.getById(campaignId);
    if (!campaign) {
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
    res.redirect(campaign.destination_url);
  } catch (error) {
    console.error('Error handling click:', error);
    res.status(500).send('Internal server error');
  }
});

// Get clicks for a campaign (for analytics)
router.get('/campaign/:campaignId', (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // Verify campaign exists
    const campaign = campaignService.getById(campaignId);
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