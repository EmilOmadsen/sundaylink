import db from './database';
import { generateCampaignId } from '../utils/id';

export interface Campaign {
  id: string;
  name: string;
  destination_url: string;
  spotify_track_id?: string;
  spotify_artist_id?: string;
  spotify_playlist_id?: string;
  user_id?: number;
  status: 'active' | 'paused' | 'archived';
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface CreateCampaignData {
  name: string;
  destination_url: string;
  spotify_track_id?: string;
  spotify_artist_id?: string;
  spotify_playlist_id?: string;
  user_id?: number;
}

class CampaignService {
  private insertCampaign = db.prepare(`
    INSERT INTO campaigns (id, name, destination_url, spotify_track_id, spotify_artist_id, spotify_playlist_id, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  private getCampaignById = db.prepare(`
    SELECT * FROM campaigns WHERE id = ? AND expires_at > datetime('now')
  `);

  private getCampaignsByUserId = db.prepare(`
    SELECT * FROM campaigns WHERE user_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC
  `);

  private getAllCampaigns = db.prepare(`
    SELECT * FROM campaigns WHERE expires_at > datetime('now') ORDER BY created_at DESC
  `);

  private updateCampaignStatus = db.prepare(`
    UPDATE campaigns 
    SET status = ?, updated_at = datetime('now') 
    WHERE id = ? AND expires_at > datetime('now')
  `);

  private deleteCampaign = db.prepare(`
    DELETE FROM campaigns WHERE id = ?
  `);

  create(data: CreateCampaignData): Campaign {
    const id = generateCampaignId();
    
    this.insertCampaign.run(
      id,
      data.name,
      data.destination_url,
      data.spotify_track_id || null,
      data.spotify_artist_id || null,
      data.spotify_playlist_id || null,
      data.user_id || null
    );

    const campaign = this.getCampaignById.get(id) as Campaign;
    if (!campaign) {
      throw new Error('Failed to create campaign');
    }

    return campaign;
  }

  getById(id: string): Campaign | null {
    return this.getCampaignById.get(id) as Campaign || null;
  }

  getAll(): Campaign[] {
    return this.getAllCampaigns.all() as Campaign[];
  }

  getByUserId(userId: number): Campaign[] {
    return this.getCampaignsByUserId.all(userId) as Campaign[];
  }

  updateStatus(id: string, status: Campaign['status']): boolean {
    const result = this.updateCampaignStatus.run(status, id);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const result = this.deleteCampaign.run(id);
    return result.changes > 0;
  }

  getSmartLinkUrl(campaignId: string, baseUrl: string): string {
    return `${baseUrl}/c/${campaignId}`;
  }
}

export default new CampaignService();