import cron from 'node-cron';
import db from './database';

class CleanupService {
  private isRunning = false;

  start() {
    if (this.isRunning) {
      console.log('Cleanup service is already running');
      return;
    }

    console.log('Starting automatic data cleanup service (runs daily at 2 AM)');
    
    // Schedule daily cleanup at 2 AM
    cron.schedule('0 2 * * *', () => {
      this.cleanupExpiredData();
    });

    // Also run cleanup on startup
    this.cleanupExpiredData();

    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;
    console.log('Cleanup service stopped');
  }

  cleanupExpiredData(): {
    campaigns: number;
    clicks: number;
    users: number;
    sessions: number;
    plays: number;
    attributions: number;
    followers_snapshots: number;
    total_deleted: number;
  } {
    try {
      console.log('🧹 Starting automatic data cleanup...');

      const results = {
        campaigns: 0,
        clicks: 0,
        users: 0,
        sessions: 0,
        plays: 0,
        attributions: 0,
        followers_snapshots: 0,
        total_deleted: 0
      };

      // Delete expired data from each table
      // The database schema already has expires_at columns with 40-day expiration

      // Delete expired campaigns
      const campaignsDeleted = db.prepare(`
        DELETE FROM campaigns WHERE expires_at <= datetime('now')
      `).run();
      results.campaigns = campaignsDeleted.changes;

      // Delete expired clicks
      const clicksDeleted = db.prepare(`
        DELETE FROM clicks WHERE expires_at <= datetime('now')
      `).run();
      results.clicks = clicksDeleted.changes;

      // Delete expired users
      const usersDeleted = db.prepare(`
        DELETE FROM users WHERE expires_at <= datetime('now')
      `).run();
      results.users = usersDeleted.changes;

      // Delete expired sessions
      const sessionsDeleted = db.prepare(`
        DELETE FROM sessions WHERE expires_at <= datetime('now')
      `).run();
      results.sessions = sessionsDeleted.changes;

      // Delete expired plays
      const playsDeleted = db.prepare(`
        DELETE FROM plays WHERE expires_at <= datetime('now')
      `).run();
      results.plays = playsDeleted.changes;

      // Delete expired attributions
      const attributionsDeleted = db.prepare(`
        DELETE FROM attributions WHERE expires_at <= datetime('now')
      `).run();
      results.attributions = attributionsDeleted.changes;

      // Delete expired followers snapshots
      const snapshotsDeleted = db.prepare(`
        DELETE FROM followers_snapshots WHERE expires_at <= datetime('now')
      `).run();
      results.followers_snapshots = snapshotsDeleted.changes;

      results.total_deleted = results.campaigns + results.clicks + results.users + 
                             results.sessions + results.plays + results.attributions + 
                             results.followers_snapshots;

      if (results.total_deleted > 0) {
        console.log(`✅ Cleanup complete: deleted ${results.total_deleted} expired records`);
        console.log(`   - Campaigns: ${results.campaigns}`);
        console.log(`   - Clicks: ${results.clicks}`);
        console.log(`   - Users: ${results.users}`);
        console.log(`   - Sessions: ${results.sessions}`);
        console.log(`   - Plays: ${results.plays}`);
        console.log(`   - Attributions: ${results.attributions}`);
        console.log(`   - Followers snapshots: ${results.followers_snapshots}`);
      } else {
        console.log('✅ Cleanup complete: no expired records found');
      }

      // Also run VACUUM to reclaim disk space
      this.vacuumDatabase();

      return results;

    } catch (error) {
      console.error('Error in data cleanup:', error);
      throw error;
    }
  }

  private vacuumDatabase() {
    try {
      console.log('🗜️  Running database VACUUM to reclaim space...');
      db.exec('VACUUM');
      console.log('✅ Database VACUUM completed');
    } catch (error) {
      console.error('Error running VACUUM:', error);
    }
  }

  forceCleanupAllData(): {
    campaigns: number;
    clicks: number;
    users: number;
    sessions: number;
    plays: number;
    attributions: number;
    followers_snapshots: number;
    total_deleted: number;
  } {
    try {
      console.log('⚠️  FORCE CLEANUP: Deleting ALL data regardless of expiration...');

      const results = {
        campaigns: 0,
        clicks: 0,
        users: 0,
        sessions: 0,
        plays: 0,
        attributions: 0,
        followers_snapshots: 0,
        total_deleted: 0
      };

      // Delete all data from each table (except migrations)
      
      results.attributions = db.prepare('DELETE FROM attributions').run().changes;
      results.plays = db.prepare('DELETE FROM plays').run().changes;
      results.sessions = db.prepare('DELETE FROM sessions').run().changes;
      results.followers_snapshots = db.prepare('DELETE FROM followers_snapshots').run().changes;
      results.clicks = db.prepare('DELETE FROM clicks').run().changes;
      results.users = db.prepare('DELETE FROM users').run().changes;
      results.campaigns = db.prepare('DELETE FROM campaigns').run().changes;

      results.total_deleted = results.campaigns + results.clicks + results.users + 
                             results.sessions + results.plays + results.attributions + 
                             results.followers_snapshots;

      console.log(`⚠️  FORCE CLEANUP COMPLETE: deleted ${results.total_deleted} total records`);
      
      this.vacuumDatabase();

      return results;

    } catch (error) {
      console.error('Error in force cleanup:', error);
      throw error;
    }
  }

  getDataStats(): {
    campaigns: number;
    clicks: number;
    users: number;
    sessions: number;
    plays: number;
    attributions: number;
    followers_snapshots: number;
    total_records: number;
    expired_records: number;
  } {
    try {
      const stats = {
        campaigns: 0,
        clicks: 0,
        users: 0,
        sessions: 0,
        plays: 0,
        attributions: 0,
        followers_snapshots: 0,
        total_records: 0,
        expired_records: 0
      };

      // Count current records
      stats.campaigns = (db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as any).count;
      stats.clicks = (db.prepare('SELECT COUNT(*) as count FROM clicks').get() as any).count;
      stats.users = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
      stats.sessions = (db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any).count;
      stats.plays = (db.prepare('SELECT COUNT(*) as count FROM plays').get() as any).count;
      stats.attributions = (db.prepare('SELECT COUNT(*) as count FROM attributions').get() as any).count;
      stats.followers_snapshots = (db.prepare('SELECT COUNT(*) as count FROM followers_snapshots').get() as any).count;

      stats.total_records = stats.campaigns + stats.clicks + stats.users + 
                           stats.sessions + stats.plays + stats.attributions + 
                           stats.followers_snapshots;

      // Count expired records
      const expiredQueries = [
        'SELECT COUNT(*) as count FROM campaigns WHERE expires_at <= datetime("now")',
        'SELECT COUNT(*) as count FROM clicks WHERE expires_at <= datetime("now")',
        'SELECT COUNT(*) as count FROM users WHERE expires_at <= datetime("now")',
        'SELECT COUNT(*) as count FROM sessions WHERE expires_at <= datetime("now")',
        'SELECT COUNT(*) as count FROM plays WHERE expires_at <= datetime("now")',
        'SELECT COUNT(*) as count FROM attributions WHERE expires_at <= datetime("now")',
        'SELECT COUNT(*) as count FROM followers_snapshots WHERE expires_at <= datetime("now")'
      ];

      stats.expired_records = expiredQueries.reduce((total, query) => {
        const result = (db.prepare(query).get() as any).count;
        return total + result;
      }, 0);

      return stats;

    } catch (error) {
      console.error('Error getting data stats:', error);
      throw error;
    }
  }

  getStatus(): {
    is_running: boolean;
    last_cleanup: string;
    next_cleanup: string;
    data_stats: ReturnType<CleanupService['getDataStats']>;
  } {
    const now = new Date();
    const nextCleanup = new Date(now);
    nextCleanup.setDate(nextCleanup.getDate() + 1);
    nextCleanup.setHours(2, 0, 0, 0); // Next 2 AM

    return {
      is_running: this.isRunning,
      last_cleanup: 'Not available', // Could be stored in database
      next_cleanup: nextCleanup.toISOString(),
      data_stats: this.getDataStats()
    };
  }
}

export default new CleanupService();