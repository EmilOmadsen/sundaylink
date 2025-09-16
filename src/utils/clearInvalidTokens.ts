import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import db from '../services/database';
import logger from './logger';

/**
 * Clear invalid Spotify tokens from the database
 * This should be run when the encryption key changes
 */
function clearInvalidTokens() {
  try {
    logger.info('Clearing invalid Spotify tokens from database...');
    
    // Clear refresh tokens for all users
    const result = db.prepare(`
      UPDATE users 
      SET refresh_token_encrypted = NULL, 
          is_spotify_connected = 0,
          updated_at = datetime('now')
      WHERE refresh_token_encrypted IS NOT NULL
    `).run();
    
    logger.info(`Cleared Spotify tokens for ${result.changes} users`, {
      usersAffected: result.changes,
      action: 'Users will need to reconnect their Spotify accounts'
    });
    
    return result.changes;
  } catch (error) {
    logger.error('Failed to clear invalid tokens', {
      error: error instanceof Error ? error.message : 'Unknown error'
    }, error instanceof Error ? error : undefined);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  clearInvalidTokens();
}

export default clearInvalidTokens;
