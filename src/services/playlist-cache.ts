import db from './database';

interface PlaylistCache {
  playlist_id: string;
  track_ids: string;
  cached_at: string;
  expires_at: string;
}

class PlaylistCacheService {
  constructor() {
    // Create cache table if it doesn't exist
    this.ensureCacheTable();
  }

  private ensureCacheTable() {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS playlist_cache (
          playlist_id TEXT PRIMARY KEY,
          track_ids TEXT NOT NULL,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME DEFAULT (datetime('now', '+1 hour'))
        )
      `);
      
      // Clean up expired cache entries
      db.exec(`DELETE FROM playlist_cache WHERE expires_at < datetime('now')`);
    } catch (error) {
      console.error('Error creating playlist cache table:', error);
    }
  }

  async getPlaylistTracks(playlistId: string): Promise<string[] | null> {
    try {
      const cached = db.prepare(`
        SELECT track_ids FROM playlist_cache 
        WHERE playlist_id = ? AND expires_at > datetime('now')
      `).get(playlistId) as { track_ids: string } | undefined;

      if (cached) {
        console.log(`📋 Using cached playlist tracks for ${playlistId}`);
        return JSON.parse(cached.track_ids);
      }

      return null;
    } catch (error) {
      console.error('Error getting cached playlist tracks:', error);
      return null;
    }
  }

  async cachePlaylistTracks(playlistId: string, trackIds: string[]): Promise<void> {
    try {
      const insertOrUpdate = db.prepare(`
        INSERT OR REPLACE INTO playlist_cache (playlist_id, track_ids, cached_at, expires_at)
        VALUES (?, ?, datetime('now'), datetime('now', '+1 hour'))
      `);
      
      insertOrUpdate.run(playlistId, JSON.stringify(trackIds));
      console.log(`💾 Cached ${trackIds.length} tracks for playlist ${playlistId}`);
    } catch (error) {
      console.error('Error caching playlist tracks:', error);
    }
  }

  async clearCache(playlistId?: string): Promise<void> {
    try {
      if (playlistId) {
        db.prepare(`DELETE FROM playlist_cache WHERE playlist_id = ?`).run(playlistId);
        console.log(`🗑️ Cleared cache for playlist ${playlistId}`);
      } else {
        db.exec(`DELETE FROM playlist_cache`);
        console.log(`🗑️ Cleared all playlist cache`);
      }
    } catch (error) {
      console.error('Error clearing playlist cache:', error);
    }
  }
}

export default new PlaylistCacheService();
