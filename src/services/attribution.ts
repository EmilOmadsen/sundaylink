import db from './database';
import sessionService from './sessions';
import playsService from './plays';
import campaignService from './campaigns';

export interface Attribution {
  id: number;
  play_id: number;
  click_id: string;
  campaign_id: string;
  confidence: number;
  time_diff_hours: number;
  created_at: string;
  expires_at: string;
}

export interface CreateAttributionData {
  play_id: number;
  click_id: string;
  campaign_id: string;
  confidence: number;
  time_diff_hours: number;
}

class AttributionService {
  private insertAttribution = db.prepare(`
    INSERT INTO attributions (play_id, click_id, campaign_id, confidence, time_diff_hours)
    VALUES (?, ?, ?, ?, ?)
  `);

  private getAttributionByPlay = db.prepare(`
    SELECT * FROM attributions WHERE play_id = ? AND expires_at > datetime('now')
  `);

  private getAttributionsByCampaign = db.prepare(`
    SELECT a.*, p.track_name, p.artist_name, p.played_at, u.email, u.display_name
    FROM attributions a
    JOIN plays p ON a.play_id = p.id
    JOIN sessions s ON a.click_id = s.click_id
    JOIN users u ON s.user_id = u.id
    WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
    ORDER BY a.created_at DESC
  `);

  private getAttributionsByClick = db.prepare(`
    SELECT a.*, p.track_name, p.artist_name, p.played_at
    FROM attributions a
    JOIN plays p ON a.play_id = p.id
    WHERE a.click_id = ? AND a.expires_at > datetime('now')
    ORDER BY a.created_at DESC
  `);

  create(data: CreateAttributionData): Attribution {
    // Check if attribution already exists
    const existing = this.getAttributionByPlay.get(data.play_id) as Attribution;
    if (existing) {
      return existing;
    }

    this.insertAttribution.run(
      data.play_id,
      data.click_id,
      data.campaign_id,
      data.confidence,
      data.time_diff_hours
    );

    const created = this.getAttributionByPlay.get(data.play_id) as Attribution;
    if (!created) {
      throw new Error('Failed to create attribution');
    }

    return created;
  }

  calculateConfidence(hoursAfterClick: number): number {
    // Confidence scoring based on time since click
    if (hoursAfterClick <= 12) {
      return 1.0; // ≤ 12h = confidence 1.0
    } else if (hoursAfterClick <= 24) {
      return 0.6; // ≤ 24h = confidence 0.6  
    } else if (hoursAfterClick <= 48) {
      return 0.3; // ≤ 48h = confidence 0.3
    } else {
      return 0.0; // > 48h = no attribution
    }
  }

  private async isPlayFromCampaignPlaylist(play: any, campaignId: string): Promise<boolean> {
    try {
      // Get the campaign to check its playlist
      const campaign = campaignService.getById(campaignId);
      if (!campaign || !campaign.spotify_playlist_id) {
        console.log(`❌ Campaign ${campaignId} has no playlist ID`);
        return false; // No playlist to check against
      }

      if (!play.spotify_track_id) {
        console.log(`❌ Play ${play.id} has no Spotify track ID`);
        return false;
      }

      // Import services
      const { default: playlistCache } = await import('./playlist-cache');
      const { default: spotifyService } = await import('./spotify');

      // Try to get cached playlist tracks first
      let playlistTracks = await playlistCache.getPlaylistTracks(campaign.spotify_playlist_id);
      
      if (!playlistTracks) {
        console.log(`🔄 Cache miss for playlist ${campaign.spotify_playlist_id}, fetching from Spotify...`);
        
        // We need an access token to fetch playlist tracks
        // For now, we'll use a fallback approach - get any user's token
        const { default: userService } = await import('./users');
        const users = userService.getAllForPolling();
        
        if (users.length === 0) {
          console.log(`❌ No users available to fetch playlist tracks`);
          return false;
        }

        // Use the first available user's token
        const user = users[0];
        if (!user.refresh_token_encrypted) {
          console.log(`❌ User ${user.id} has no refresh token`);
          return false;
        }

        try {
          // Get fresh access token
          const { decryptRefreshToken } = await import('../utils/encryption');
          const refreshToken = decryptRefreshToken(user.refresh_token_encrypted);
          const tokens = await spotifyService.refreshAccessToken(refreshToken);
          
          // Fetch playlist tracks
          playlistTracks = await spotifyService.getPlaylistTracks(campaign.spotify_playlist_id, tokens.access_token);
          
          // Cache the tracks
          await playlistCache.cachePlaylistTracks(campaign.spotify_playlist_id, playlistTracks);
          
        } catch (tokenError) {
          console.error(`❌ Failed to get access token for playlist fetch:`, tokenError);
          return false;
        }
      }

      // Check if the played track is in the campaign's playlist
      const isInPlaylist = playlistTracks.includes(play.spotify_track_id);
      
      console.log(`${isInPlaylist ? '✅' : '❌'} Track ${play.spotify_track_id} ${isInPlaylist ? 'IS' : 'IS NOT'} in playlist ${campaign.spotify_playlist_id}`);
      
      return isInPlaylist;
      
    } catch (error) {
      console.error('Error checking if play is from campaign playlist:', error);
      return false;
    }
  }

  async attributeNewPlays(): Promise<{ attributions_created: number; plays_processed: number }> {
    try {
      console.log('🔗 Starting attribution process...');

      // Get all users who have recent sessions (clicks) within 48 hours
      const usersWithRecentSessions = sessionService.getUsersWithRecentSessions(48);
      console.log(`Found ${usersWithRecentSessions.length} users with recent sessions`);

      let attributionsCreated = 0;
      let playsProcessed = 0;

      for (const userId of usersWithRecentSessions) {
        try {
          const result = await this.attributeUserPlays(userId);
          attributionsCreated += result.attributions_created;
          playsProcessed += result.plays_processed;
        } catch (error) {
          console.error(`Error attributing plays for user ${userId}:`, error);
        }
      }

      console.log(`✅ Attribution complete: ${attributionsCreated} new attributions, ${playsProcessed} plays processed`);

      return {
        attributions_created: attributionsCreated,
        plays_processed: playsProcessed
      };
    } catch (error) {
      console.error('Error in attribution process:', error);
      throw error;
    }
  }

  async attributeUserPlays(userId: number): Promise<{ attributions_created: number; plays_processed: number }> {
    // Get recent clicks for this user (within 48 hours)
    const recentClicks = sessionService.getRecentClicksForUser(userId, 48);
    
    if (recentClicks.length === 0) {
      return { attributions_created: 0, plays_processed: 0 };
    }

    // Get recent plays for this user (within 48 hours)  
    const recentPlays = playsService.getRecentForAttribution(userId, 48);
    
    if (recentPlays.length === 0) {
      return { attributions_created: 0, plays_processed: 0 };
    }

    let attributionsCreated = 0;

    // For each play, find the best matching click
    for (const play of recentPlays) {
      try {
        // Check if this play is already attributed
        const existingAttribution = this.getAttributionByPlay.get(play.id);
        if (existingAttribution) {
          continue; // Skip already attributed plays
        }

        const playTime = new Date(play.played_at);
        let bestAttribution: {
          click_id: string;
          campaign_id: string;
          confidence: number;
          time_diff_hours: number;
        } | null = null;

        // Find the best click to attribute this play to
        for (const click of recentClicks) {
          const clickTime = new Date(click.clicked_at);
          
          // Only attribute if play happened AFTER click
          if (playTime <= clickTime) {
            continue;
          }

          // Check if this play is from the campaign's playlist
          const isFromPlaylist = await this.isPlayFromCampaignPlaylist(play, click.campaign_id);
          if (!isFromPlaylist) {
            continue; // Skip plays that are not from the campaign's playlist
          }

          const timeDiffMs = playTime.getTime() - clickTime.getTime();
          const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

          // Calculate confidence based on time difference
          const confidence = this.calculateConfidence(timeDiffHours);
          
          if (confidence === 0) {
            continue; // Too old to attribute
          }

          // If this is the first potential attribution, or has higher confidence, or is more recent
          if (!bestAttribution || 
              confidence > bestAttribution.confidence || 
              (confidence === bestAttribution.confidence && timeDiffHours < bestAttribution.time_diff_hours)) {
            
            bestAttribution = {
              click_id: click.click_id,
              campaign_id: click.campaign_id,
              confidence: confidence,
              time_diff_hours: timeDiffHours
            };
          }
        }

        // Create attribution if we found a good match
        if (bestAttribution) {
          this.create({
            play_id: play.id,
            click_id: bestAttribution.click_id,
            campaign_id: bestAttribution.campaign_id,
            confidence: bestAttribution.confidence,
            time_diff_hours: bestAttribution.time_diff_hours
          });

          attributionsCreated++;
          
          console.log(`🎯 Attributed play ${play.id} (${play.track_name}) to campaign ${bestAttribution.campaign_id} (confidence: ${bestAttribution.confidence})`);
        }
      } catch (error) {
        console.error(`Error attributing play ${play.id}:`, error);
      }
    }

    return {
      attributions_created: attributionsCreated,
      plays_processed: recentPlays.length
    };
  }

  getByCampaign(campaignId: string): any[] {
    return this.getAttributionsByCampaign.all(campaignId);
  }

  getByClick(clickId: string): any[] {
    return this.getAttributionsByClick.all(clickId);
  }

  getCampaignStats(campaignId: string): {
    total_attributions: number;
    unique_listeners: number;
    total_plays: number;
    confidence_breakdown: {
      high: number; // 1.0 confidence
      medium: number; // 0.6 confidence  
      low: number; // 0.3 confidence
    };
    streams_per_listener: number;
  } {
    const totalAttributions = db.prepare(`
      SELECT COUNT(*) as count 
      FROM attributions 
      WHERE campaign_id = ? AND expires_at > datetime('now')
    `).get(campaignId) as { count: number };

    const uniqueListeners = db.prepare(`
      SELECT COUNT(DISTINCT s.user_id) as count
      FROM attributions a
      JOIN sessions s ON a.click_id = s.click_id
      WHERE a.campaign_id = ? AND a.expires_at > datetime('now')
    `).get(campaignId) as { count: number };

    const confidenceBreakdown = db.prepare(`
      SELECT 
        SUM(CASE WHEN confidence = 1.0 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN confidence = 0.6 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN confidence = 0.3 THEN 1 ELSE 0 END) as low
      FROM attributions 
      WHERE campaign_id = ? AND expires_at > datetime('now')
    `).get(campaignId) as { high: number; medium: number; low: number };

    const streamsPerListener = uniqueListeners.count > 0 
      ? totalAttributions.count / uniqueListeners.count 
      : 0;

    return {
      total_attributions: totalAttributions.count,
      unique_listeners: uniqueListeners.count,
      total_plays: totalAttributions.count, // Same as total attributions
      confidence_breakdown: confidenceBreakdown,
      streams_per_listener: Math.round(streamsPerListener * 100) / 100
    };
  }
}

export default new AttributionService();