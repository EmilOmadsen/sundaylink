import cron from 'node-cron';
import authService from './auth';
import spotifyService from './spotify';
import playsService, { CreatePlayData } from './plays';
import attributionService from './attribution';
import followersService from './followers';
import logger from '../utils/logger';

class PollingService {
  private isRunning = false;
  private intervalMinutes = 5; // Poll every 5 minutes
  
  start() {
    if (this.isRunning) {
      logger.warn('Polling service is already running');
      return;
    }

    logger.info(`Starting background polling service`, {
      intervalMinutes: this.intervalMinutes,
      schedule: `every ${this.intervalMinutes} minutes`
    });
    
    // Run immediately on startup
    this.pollAllUsers();
    
    // Schedule recurring polling
    cron.schedule(`*/${this.intervalMinutes} * * * *`, () => {
      this.pollAllUsers();
    });

    // Schedule daily followers snapshots at 02:15 AM server time
    cron.schedule('15 2 * * *', async () => {
      try {
        logger.info('Running scheduled followers tracking', {
          schedule: 'daily at 02:15',
          timezone: 'server time'
        });
        await followersService.trackAllCampaignFollowers();
      } catch (error) {
        logger.error('Error during scheduled followers tracking', {
          error: error instanceof Error ? error.message : 'Unknown error'
        }, error instanceof Error ? error : undefined);
      }
    });

    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;
    logger.info('Polling service stopped');
  }

  async pollAllUsers() {
    const startTime = Date.now();
    try {
      logger.polling('Starting polling cycle');
      
      const users = authService.getAllForPolling();
      logger.polling('Found users for polling', {
        userCount: users.length,
        users: users.map(u => ({ id: u.id, email: u.email }))
      });

      if (users.length === 0) {
        logger.polling('No users to poll');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const user of users) {
        try {
          await this.pollUserPlays(user);
          successCount++;
        } catch (error) {
          logger.error(`Error polling user ${user.id}`, {
            userId: user.id,
            email: user.email,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, error instanceof Error ? error : undefined);
          errorCount++;
        }

        // Add small delay between users to avoid rate limiting
        await this.sleep(200);
      }

      const duration = Date.now() - startTime;
      logger.polling('Polling cycle complete', {
        successCount,
        errorCount,
        duration: `${duration}ms`,
        averageTimePerUser: `${Math.round(duration / users.length)}ms`
      });

      // Immediately run attribution after polling finishes to link new plays to recent clicks
      try {
        const attributionResult = await attributionService.attributeNewPlays();
        logger.polling('Attribution completed after polling', {
          attributionsCreated: attributionResult.attributions_created,
          playsProcessed: attributionResult.plays_processed
        });
      } catch (error) {
        logger.error('Error running attribution after polling', {
          error: error instanceof Error ? error.message : 'Unknown error'
        }, error instanceof Error ? error : undefined);
      }
    } catch (error) {
      logger.error('Error in polling cycle', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${Date.now() - startTime}ms`
      }, error instanceof Error ? error : undefined);
    }
  }

  async pollUserPlays(user: any) {
    const startTime = Date.now();
    try {
      if (!user.refresh_token_encrypted) {
        logger.warn(`User has no refresh token`, {
          userId: user.id,
          email: user.email
        });
        return;
      }

      // Get fresh access token
      const { access_token } = await spotifyService.refreshAccessToken(user.refresh_token_encrypted);
      
      // Fetch recently played tracks
      const recentlyPlayed = await spotifyService.getRecentlyPlayed(access_token, 50);
      
      if (!recentlyPlayed.items || recentlyPlayed.items.length === 0) {
        logger.debug(`No recent plays for user`, {
          userId: user.id,
          email: user.email
        });
        authService.updateLastPolled(user.id);
        return;
      }

      // Convert to our format
      const plays: CreatePlayData[] = recentlyPlayed.items.map(item => ({
        user_id: user.id,
        spotify_track_id: item.track.id,
        spotify_artist_id: item.track.artists[0]?.id || undefined,
        played_at: item.played_at,
        track_name: item.track.name,
        artist_name: item.track.artists.map(a => a.name).join(', ')
      }));

      // Save plays to database (bulk insert)
      const createdCount = playsService.createBulk(plays);
      
      const duration = Date.now() - startTime;
      if (createdCount > 0) {
        logger.polling('User plays saved successfully', {
          userId: user.id,
          email: user.email,
          newPlays: createdCount,
          totalFetched: plays.length,
          duration: `${duration}ms`
        });
      } else {
        logger.debug(`No new plays for user`, {
          userId: user.id,
          email: user.email,
          totalFetched: plays.length,
          duration: `${duration}ms`
        });
      }

      // Update last polled timestamp
      authService.updateLastPolled(user.id);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's a Spotify credential error
      if (errorMessage.includes('Spotify credentials not configured') || 
          errorMessage.includes('Invalid Spotify client credentials')) {
        logger.error(`Spotify credentials not configured - skipping user polling`, {
          userId: user.id,
          email: user.email,
          error: errorMessage,
          duration: `${Date.now() - startTime}ms`,
          action: 'Please configure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables'
        });
        // Don't throw error for credential issues, just skip this user
        return;
      }
      
      logger.error(`Failed to poll user`, {
        userId: user.id,
        email: user.email,
        error: errorMessage,
        duration: `${Date.now() - startTime}ms`
      }, error instanceof Error ? error : undefined);
      throw error;
    }
  }

  async pollSingleUser(userId: number): Promise<{ success: boolean; plays_added: number; error?: string }> {
    try {
      const user = authService.getById(userId);
      if (!user) {
        return { success: false, plays_added: 0, error: 'User not found' };
      }

      if (!user.is_spotify_connected || !user.refresh_token_encrypted) {
        return { success: false, plays_added: 0, error: 'User has no Spotify connection' };
      }

      const beforeCount = playsService.getByUser(userId, 1).length;
      await this.pollUserPlays(user);
      const afterCount = playsService.getByUser(userId, 1000).length;

      return { 
        success: true, 
        plays_added: Math.max(0, afterCount - beforeCount)
      };

    } catch (error) {
      return { 
        success: false, 
        plays_added: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  getStatus(): {
    is_running: boolean;
    interval_minutes: number;
    connected_users: number;
  } {
    const connectedUsers = authService.getAllForPolling();
    
    return {
      is_running: this.isRunning,
      interval_minutes: this.intervalMinutes,
      connected_users: connectedUsers.length
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new PollingService();