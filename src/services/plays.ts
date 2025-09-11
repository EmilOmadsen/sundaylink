import db from './database';

export interface Play {
  id: number;
  user_id: number;
  spotify_track_id: string;
  spotify_artist_id?: string;
  played_at: string;
  track_name?: string;
  artist_name?: string;
  created_at: string;
  expires_at: string;
}

export interface CreatePlayData {
  user_id: number;
  spotify_track_id: string;
  spotify_artist_id?: string;
  played_at: string;
  track_name?: string;
  artist_name?: string;
}

class PlaysService {
  private insertPlay = db.prepare(`
    INSERT INTO plays (user_id, spotify_track_id, spotify_artist_id, played_at, track_name, artist_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  private getPlaysByUser = db.prepare(`
    SELECT * FROM plays 
    WHERE user_id = ? AND expires_at > datetime('now')
    ORDER BY played_at DESC
  `);

  private getRecentPlaysForAttribution = db.prepare(`
    SELECT * FROM plays 
    WHERE user_id = ? 
    AND played_at > ? 
    AND expires_at > datetime('now')
    ORDER BY played_at DESC
  `);

  private checkPlayExists = db.prepare(`
    SELECT id FROM plays 
    WHERE user_id = ? 
    AND spotify_track_id = ? 
    AND played_at = ?
    AND expires_at > datetime('now')
  `);

  private getPlaysByTrack = db.prepare(`
    SELECT * FROM plays 
    WHERE spotify_track_id = ? 
    AND expires_at > datetime('now')
    ORDER BY played_at DESC
  `);

  create(data: CreatePlayData): Play {
    // Check if this exact play already exists (avoid duplicates)
    const existing = this.checkPlayExists.get(
      data.user_id, 
      data.spotify_track_id, 
      data.played_at
    );
    
    if (existing) {
      return existing as Play;
    }

    this.insertPlay.run(
      data.user_id,
      data.spotify_track_id,
      data.spotify_artist_id || null,
      data.played_at,
      data.track_name || null,
      data.artist_name || null
    );

    // Return the created play
    const createdPlay = this.checkPlayExists.get(
      data.user_id,
      data.spotify_track_id,
      data.played_at
    );

    if (!createdPlay) {
      throw new Error('Failed to create play');
    }

    return this.getPlaysByUser.all(data.user_id)[0] as Play;
  }

  createBulk(plays: CreatePlayData[]): number {
    let created = 0;
    
    for (const play of plays) {
      try {
        // Check if play already exists
        const existing = this.checkPlayExists.get(
          play.user_id,
          play.spotify_track_id,
          play.played_at
        );
        
        if (!existing) {
          this.insertPlay.run(
            play.user_id,
            play.spotify_track_id,
            play.spotify_artist_id || null,
            play.played_at,
            play.track_name || null,
            play.artist_name || null
          );
          created++;
        }
      } catch (error) {
        console.error('Error creating play:', error, play);
      }
    }

    return created;
  }

  getByUser(userId: number, limit: number = 50): Play[] {
    const query = db.prepare(`
      SELECT * FROM plays 
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY played_at DESC 
      LIMIT ?
    `);
    
    return query.all(userId, limit) as Play[];
  }

  getByTrack(spotifyTrackId: string, limit: number = 100): Play[] {
    const query = db.prepare(`
      SELECT * FROM plays 
      WHERE spotify_track_id = ? AND expires_at > datetime('now')
      ORDER BY played_at DESC 
      LIMIT ?
    `);
    
    return query.all(spotifyTrackId, limit) as Play[];
  }

  getRecentForAttribution(userId: number, hoursBack: number = 48): Play[] {
    const sinceDate = new Date();
    sinceDate.setHours(sinceDate.getHours() - hoursBack);
    const sinceDateStr = sinceDate.toISOString();

    return this.getRecentPlaysForAttribution.all(userId, sinceDateStr) as Play[];
  }

  getPlayStats(userId: number): {
    total_plays: number;
    unique_tracks: number;
    top_artists: Array<{ artist_name: string; play_count: number }>;
    recent_tracks: Play[];
  } {
    const totalPlays = db.prepare(`
      SELECT COUNT(*) as count 
      FROM plays 
      WHERE user_id = ? AND expires_at > datetime('now')
    `).get(userId) as { count: number };

    const uniqueTracks = db.prepare(`
      SELECT COUNT(DISTINCT spotify_track_id) as count 
      FROM plays 
      WHERE user_id = ? AND expires_at > datetime('now')
    `).get(userId) as { count: number };

    const topArtists = db.prepare(`
      SELECT artist_name, COUNT(*) as play_count
      FROM plays 
      WHERE user_id = ? 
      AND artist_name IS NOT NULL 
      AND expires_at > datetime('now')
      GROUP BY artist_name 
      ORDER BY play_count DESC 
      LIMIT 5
    `).all(userId) as Array<{ artist_name: string; play_count: number }>;

    const recentTracks = this.getByUser(userId, 10);

    return {
      total_plays: totalPlays.count,
      unique_tracks: uniqueTracks.count,
      top_artists: topArtists,
      recent_tracks: recentTracks
    };
  }
}

export default new PlaysService();