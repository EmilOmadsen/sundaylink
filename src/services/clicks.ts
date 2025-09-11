import db from './database';
import { generateClickId } from '../utils/id';
import { hashIP } from '../utils/encryption';

export interface Click {
  id: string;
  campaign_id: string;
  ip_hash: string;
  user_agent?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  clicked_at: string;
  expires_at: string;
}

export interface CreateClickData {
  campaign_id: string;
  ip: string;
  user_agent?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
}

class ClickService {
  private insertClick = db.prepare(`
    INSERT INTO clicks (
      id, campaign_id, ip_hash, user_agent, utm_source, utm_medium, 
      utm_campaign, utm_content, utm_term, referrer
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  private getClickById = db.prepare(`
    SELECT * FROM clicks WHERE id = ? AND expires_at > datetime('now')
  `);

  private getClicksByCampaign = db.prepare(`
    SELECT * FROM clicks 
    WHERE campaign_id = ? AND expires_at > datetime('now')
    ORDER BY clicked_at DESC
  `);

  track(data: CreateClickData): Click {
    const clickId = generateClickId();
    const ipHash = hashIP(data.ip);
    
    this.insertClick.run(
      clickId,
      data.campaign_id,
      ipHash,
      data.user_agent || null,
      data.utm_source || null,
      data.utm_medium || null,
      data.utm_campaign || null,
      data.utm_content || null,
      data.utm_term || null,
      data.referrer || null
    );

    const click = this.getClickById.get(clickId) as Click;
    if (!click) {
      throw new Error('Failed to create click');
    }

    return click;
  }

  getById(id: string): Click | null {
    return this.getClickById.get(id) as Click || null;
  }

  getByCampaign(campaignId: string): Click[] {
    return this.getClicksByCampaign.all(campaignId) as Click[];
  }

  extractUTMParams(query: any): {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  } {
    return {
      utm_source: query.utm_source,
      utm_medium: query.utm_medium,
      utm_campaign: query.utm_campaign,
      utm_content: query.utm_content,
      utm_term: query.utm_term
    };
  }

  getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
  }
}

export default new ClickService();