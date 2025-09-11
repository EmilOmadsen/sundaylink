import cron from 'node-cron';
import authService from './auth';
import spotifyService from './spotify';
import playsService, { CreatePlayData } from './plays';
import attributionService from './attribution';
import followersService from './followers';

class PollingService {
  private isRunning = false;
  private intervalMinutes = 5; // Poll every 5 minutes
  
  start() {
    if (this.isRunning) {
      console.log('Polling service is already running');
      return;
    }

    console.log(`Starting background polling service (every ${this.intervalMinutes} minutes)`);
    
    // Run immediately on startup
    this.pollAllUsers();
    
    // Schedule recurring polling
    cron.schedule(`*/${this.intervalMinutes} * * * *`, () => {
      this.pollAllUsers();
    });

    // Schedule daily followers snapshots at 02:15 AM server time
    cron.schedule('15 2 * * *', async () => {
      try {
        console.log('📆 Running scheduled followers tracking (daily at 02:15)');
        await followersService.trackAllCampaignFollowers();
      } catch (error) {
        console.error('Error during scheduled followers tracking:', error);
      }
    });

    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;
    console.log('Polling service stopped');
  }

  async pollAllUsers() {
    try {
      console.log('🎵 Starting polling cycle...');
      
      const users = authService.getAllForPolling();
      console.log(`Found ${users.length} users with Spotify connected`);

      if (users.length === 0) {
        console.log('No users to poll');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const user of users) {
        try {
          await this.pollUserPlays(user);
          successCount++;
        } catch (error) {
          console.error(`Error polling user ${user.id} (${user.email}):`, error);
          errorCount++;
        }

        // Add small delay between users to avoid rate limiting
        await this.sleep(200);
      }

      console.log(`✅ Polling cycle complete: ${successCount} success, ${errorCount} errors`);

      // Immediately run attribution after polling finishes to link new plays to recent clicks
      try {
        const attributionResult = await attributionService.attributeNewPlays();
        console.log(`🔎 Attribution after polling: ${attributionResult.attributions_created} new attributions across ${attributionResult.plays_processed} plays`);
      } catch (error) {
        console.error('Error running attribution after polling:', error);
      }
    } catch (error) {
      console.error('Error in polling cycle:', error);
    }
  }

  async pollUserPlays(user: any) {
    try {
      if (!user.refresh_token_encrypted) {
        console.log(`User ${user.id} has no refresh token`);
        return;
      }

      // Get fresh access token
      const { access_token } = await spotifyService.refreshAccessToken(user.refresh_token_encrypted);
      
      // Fetch recently played tracks
      const recentlyPlayed = await spotifyService.getRecentlyPlayed(access_token, 50);
      
      if (!recentlyPlayed.items || recentlyPlayed.items.length === 0) {
        console.log(`No recent plays for user ${user.id}`);
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
      
      if (createdCount > 0) {
        console.log(`📀 User ${user.id}: saved ${createdCount} new plays (${plays.length} total fetched)`);
      } else {
        console.log(`📀 User ${user.id}: no new plays (${plays.length} fetched, all duplicates)`);
      }

      // Update last polled timestamp
      authService.updateLastPolled(user.id);

    } catch (error) {
      console.error(`Failed to poll user ${user.id}:`, error);
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