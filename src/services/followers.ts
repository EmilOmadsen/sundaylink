import db from './database';
import spotifyService from './spotify';
import authService from './auth';

export interface FollowersSnapshot {
  id: number;
  spotify_id: string;
  spotify_type: 'artist' | 'playlist';
  follower_count: number;
  snapshot_date: string;
  created_at: string;
  expires_at: string;
}

export interface CreateSnapshotData {
  spotify_id: string;
  spotify_type: 'artist' | 'playlist';
  follower_count: number;
  snapshot_date: string;
}

class FollowersService {
  private insertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO followers_snapshots (spotify_id, spotify_type, follower_count, snapshot_date)
    VALUES (?, ?, ?, ?)
  `);

  private getLatestSnapshot = db.prepare(`
    SELECT * FROM followers_snapshots 
    WHERE spotify_id = ? AND spotify_type = ? AND expires_at > datetime('now')
    ORDER BY snapshot_date DESC 
    LIMIT 1
  `);

  private getTodaysSnapshot = db.prepare(`
    SELECT * FROM followers_snapshots 
    WHERE spotify_id = ? 
    AND spotify_type = ? 
    AND snapshot_date = date('now')
    AND expires_at > datetime('now')
  `);

  createSnapshot(data: CreateSnapshotData): FollowersSnapshot {
    this.insertSnapshot.run(
      data.spotify_id,
      data.spotify_type,
      data.follower_count,
      data.snapshot_date
    );

    const snapshot = this.getLatestSnapshot.get(data.spotify_id, data.spotify_type) as FollowersSnapshot;
    if (!snapshot) {
      throw new Error('Failed to create snapshot');
    }

    return snapshot;
  }

  async trackArtistFollowers(spotifyArtistId: string): Promise<FollowersSnapshot | null> {
    try {
      // Check if we already have today's snapshot
      const todaysSnapshot = this.getTodaysSnapshot.get(spotifyArtistId, 'artist');
      if (todaysSnapshot) {
        console.log(`Already have today's snapshot for artist ${spotifyArtistId}`);
        return todaysSnapshot as FollowersSnapshot;
      }

      // Get a user with Spotify connection to make the API call
      const users = authService.getAllForPolling();
      if (users.length === 0) {
        console.log('No users with Spotify connection available for followers tracking');
        return null;
      }

      const user = users[0]; // Use first available user
      
      // Get fresh access token
      const { access_token } = await spotifyService.refreshAccessToken(user.refresh_token_encrypted!);
      
      // Fetch artist followers
      const followerCount = await spotifyService.getArtistFollowers(access_token, spotifyArtistId);
      
      // Create snapshot
      const snapshot = this.createSnapshot({
        spotify_id: spotifyArtistId,
        spotify_type: 'artist',
        follower_count: followerCount,
        snapshot_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
      });

      console.log(`📈 Tracked artist ${spotifyArtistId}: ${followerCount} followers`);
      return snapshot;

    } catch (error) {
      console.error(`Error tracking artist ${spotifyArtistId}:`, error);
      return null;
    }
  }

  async trackPlaylistFollowers(spotifyPlaylistId: string): Promise<FollowersSnapshot | null> {
    try {
      // Check if we already have today's snapshot
      const todaysSnapshot = this.getTodaysSnapshot.get(spotifyPlaylistId, 'playlist');
      if (todaysSnapshot) {
        console.log(`Already have today's snapshot for playlist ${spotifyPlaylistId}`);
        return todaysSnapshot as FollowersSnapshot;
      }

      // Get a user with Spotify connection to make the API call
      const users = authService.getAllForPolling();
      if (users.length === 0) {
        console.log('No users with Spotify connection available for followers tracking');
        return null;
      }

      const user = users[0]; // Use first available user
      
      // Get fresh access token
      const { access_token } = await spotifyService.refreshAccessToken(user.refresh_token_encrypted!);
      
      // Fetch playlist followers
      const followerCount = await spotifyService.getPlaylistFollowers(access_token, spotifyPlaylistId);
      
      // Create snapshot
      const snapshot = this.createSnapshot({
        spotify_id: spotifyPlaylistId,
        spotify_type: 'playlist',
        follower_count: followerCount,
        snapshot_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
      });

      console.log(`📈 Tracked playlist ${spotifyPlaylistId}: ${followerCount} followers`);
      return snapshot;

    } catch (error) {
      console.error(`Error tracking playlist ${spotifyPlaylistId}:`, error);
      return null;
    }
  }

  async trackAllCampaignFollowers(): Promise<{ artists_tracked: number; playlists_tracked: number }> {
    try {
      console.log('📊 Starting followers tracking for all campaigns...');

      // Get all active campaigns with Spotify IDs
      const campaigns = db.prepare(`
        SELECT DISTINCT spotify_artist_id, spotify_playlist_id 
        FROM campaigns 
        WHERE status = 'active' AND expires_at > datetime('now')
      `).all() as Array<{ spotify_artist_id?: string; spotify_playlist_id?: string }>;

      let artistsTracked = 0;
      let playlistsTracked = 0;

      // Track unique artist IDs
      const artistIds = new Set<string>();
      const playlistIds = new Set<string>();

      for (const campaign of campaigns) {
        if (campaign.spotify_artist_id) {
          artistIds.add(campaign.spotify_artist_id);
        }
        if (campaign.spotify_playlist_id) {
          playlistIds.add(campaign.spotify_playlist_id);
        }
      }

      // Track artists
      for (const artistId of artistIds) {
        try {
          const snapshot = await this.trackArtistFollowers(artistId);
          if (snapshot) {
            artistsTracked++;
          }
          // Small delay to avoid rate limiting
          await this.sleep(500);
        } catch (error) {
          console.error(`Error tracking artist ${artistId}:`, error);
        }
      }

      // Track playlists  
      for (const playlistId of playlistIds) {
        try {
          const snapshot = await this.trackPlaylistFollowers(playlistId);
          if (snapshot) {
            playlistsTracked++;
          }
          // Small delay to avoid rate limiting
          await this.sleep(500);
        } catch (error) {
          console.error(`Error tracking playlist ${playlistId}:`, error);
        }
      }

      console.log(`✅ Followers tracking complete: ${artistsTracked} artists, ${playlistsTracked} playlists`);

      return {
        artists_tracked: artistsTracked,
        playlists_tracked: playlistsTracked
      };

    } catch (error) {
      console.error('Error in followers tracking:', error);
      throw error;
    }
  }

  getSnapshots(spotifyId: string, type: 'artist' | 'playlist', limit: number = 30): FollowersSnapshot[] {
    const query = db.prepare(`
      SELECT * FROM followers_snapshots 
      WHERE spotify_id = ? AND spotify_type = ? AND expires_at > datetime('now')
      ORDER BY snapshot_date DESC 
      LIMIT ?
    `);
    
    return query.all(spotifyId, type, limit) as FollowersSnapshot[];
  }

  getFollowersDelta(spotifyId: string, type: 'artist' | 'playlist', days: number = 7): {
    current_followers: number;
    previous_followers: number;
    delta: number;
    percentage_change: number;
    days_compared: number;
  } | null {
    const snapshots = this.getSnapshots(spotifyId, type, days + 1);
    
    if (snapshots.length < 2) {
      return null; // Need at least 2 snapshots
    }

    const current = snapshots[0];
    const previous = snapshots[snapshots.length - 1];
    
    const delta = current.follower_count - previous.follower_count;
    const percentageChange = previous.follower_count > 0 
      ? (delta / previous.follower_count) * 100 
      : 0;

    return {
      current_followers: current.follower_count,
      previous_followers: previous.follower_count,
      delta: delta,
      percentage_change: Math.round(percentageChange * 100) / 100,
      days_compared: Math.floor((new Date(current.snapshot_date).getTime() - new Date(previous.snapshot_date).getTime()) / (1000 * 60 * 60 * 24))
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new FollowersService();