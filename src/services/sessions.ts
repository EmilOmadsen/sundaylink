import db from './database';

export interface Session {
  id: number;
  click_id: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

export interface CreateSessionData {
  click_id: string;
  user_id: number;
}

class SessionService {
  private insertSession = db.prepare(`
    INSERT INTO sessions (click_id, user_id)
    VALUES (?, ?)
  `);

  private getSessionByClickAndUser = db.prepare(`
    SELECT * FROM sessions 
    WHERE click_id = ? AND user_id = ? AND expires_at > datetime('now')
  `);

  private getSessionsByUser = db.prepare(`
    SELECT * FROM sessions 
    WHERE user_id = ? AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `);

  private getSessionsByClick = db.prepare(`
    SELECT s.*, u.spotify_user_id, u.display_name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.click_id = ? AND s.expires_at > datetime('now')
    ORDER BY s.created_at DESC
  `);

  create(data: CreateSessionData): Session {
    // Check if session already exists
    const existing = this.getSessionByClickAndUser.get(data.click_id, data.user_id) as Session;
    if (existing) {
      return existing;
    }

    this.insertSession.run(data.click_id, data.user_id);

    const session = this.getSessionByClickAndUser.get(data.click_id, data.user_id) as Session;
    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }

  getByClickAndUser(clickId: string, userId: number): Session | null {
    return this.getSessionByClickAndUser.get(clickId, userId) as Session || null;
  }

  getByUser(userId: number): Session[] {
    return this.getSessionsByUser.all(userId) as Session[];
  }

  getByClick(clickId: string): any[] {
    return this.getSessionsByClick.all(clickId);
  }

  // Get all user IDs that have sessions for attribution processing
  getUsersWithRecentSessions(hoursBack: number = 48): number[] {
    const query = db.prepare(`
      SELECT DISTINCT user_id 
      FROM sessions 
      WHERE created_at > datetime('now', '-${hoursBack} hours')
      AND expires_at > datetime('now')
    `);
    
    const results = query.all() as { user_id: number }[];
    return results.map(r => r.user_id);
  }

  // Get recent clicks for a user within time window for attribution
  getRecentClicksForUser(userId: number, hoursBack: number = 48): Array<{
    click_id: string;
    campaign_id: string;
    clicked_at: string;
    hours_ago: number;
  }> {
    const query = db.prepare(`
      SELECT s.click_id, c.campaign_id, c.clicked_at,
             CAST((julianday('now') - julianday(c.clicked_at)) * 24 AS REAL) as hours_ago
      FROM sessions s
      JOIN clicks c ON s.click_id = c.id
      WHERE s.user_id = ?
      AND c.clicked_at > datetime('now', '-${hoursBack} hours')
      AND s.expires_at > datetime('now')
      AND c.expires_at > datetime('now')
      ORDER BY c.clicked_at DESC
    `);

    return query.all(userId) as Array<{
      click_id: string;
      campaign_id: string;
      clicked_at: string;
      hours_ago: number;
    }>;
  }
}

export default new SessionService();