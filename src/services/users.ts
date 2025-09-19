import db from './database';
import { encryptRefreshToken } from '../utils/encryption';

export interface User {
  id: number;
  spotify_user_id: string;
  email?: string;
  display_name?: string;
  refresh_token_encrypted: string;
  auth_type: 'email' | 'spotify';
  created_at: string;
  last_polled_at?: string;
  expires_at: string;
}

export interface CreateUserData {
  spotify_user_id: string;
  email?: string;
  display_name?: string;
  refresh_token: string;
}

class UserService {
  private insertUser = db.prepare(`
    INSERT INTO users (spotify_user_id, email, display_name, refresh_token_encrypted, auth_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  private getUserBySpotifyId = db.prepare(`
    SELECT * FROM users WHERE spotify_user_id = ? AND expires_at > datetime('now')
  `);

  private getUserById = db.prepare(`
    SELECT * FROM users WHERE id = ? AND expires_at > datetime('now')
  `);

  private updateUserRefreshToken = db.prepare(`
    UPDATE users 
    SET refresh_token_encrypted = ?, last_polled_at = datetime('now')
    WHERE id = ?
  `);

  private updateLastPolledStmt = db.prepare(`
    UPDATE users SET last_polled_at = datetime('now') WHERE id = ?
  `);

  private deleteUserDataStmt = db.prepare(`
    DELETE FROM users WHERE spotify_user_id = ?
  `);

  private getAllUsersForPolling = db.prepare(`
    SELECT * FROM users WHERE expires_at > datetime('now')
  `);

  createOrUpdate(data: CreateUserData): User {
    const encryptedRefreshToken = encryptRefreshToken(data.refresh_token);
    
    // Check if user already exists by Spotify ID
    const existingUser = this.getUserBySpotifyId.get(data.spotify_user_id) as User;
    
    if (existingUser) {
      // Update existing user's refresh token
      this.updateUserRefreshToken.run(encryptedRefreshToken, existingUser.id);
      return this.getUserById.get(existingUser.id) as User;
    }
    
    // Check if user exists by email (for email/password users connecting Spotify)
    const getUserByEmail = db.prepare(`
      SELECT * FROM users WHERE email = ? AND expires_at > datetime('now')
    `);
    const existingEmailUser = getUserByEmail.get(data.email || `${data.spotify_user_id}@spotify.local`) as User;
    
    if (existingEmailUser) {
      console.log('🔄 User with email already exists, updating with Spotify info...');
      
      // Update existing email user with Spotify info
      const updateUserWithSpotify = db.prepare(`
        UPDATE users 
        SET spotify_user_id = ?, refresh_token_encrypted = ?, is_spotify_connected = 1, auth_type = 'spotify'
        WHERE email = ?
      `);
      
      updateUserWithSpotify.run(
        data.spotify_user_id,
        encryptedRefreshToken,
        data.email || `${data.spotify_user_id}@spotify.local`
      );
      
      // Return the updated user
      const updatedUser = this.getUserBySpotifyId.get(data.spotify_user_id) as User;
      if (!updatedUser) {
        throw new Error('Failed to update user with Spotify info');
      }
      
      return updatedUser;
    }
    
    // Create completely new user
    try {
      this.insertUser.run(
        data.spotify_user_id,
        data.email || null,
        data.display_name || null,
        encryptedRefreshToken,
        'spotify'
      );

      const newUser = this.getUserBySpotifyId.get(data.spotify_user_id) as User;
      if (!newUser) {
        throw new Error('Failed to create user');
      }

      return newUser;
    } catch (error) {
      // If insert fails due to email constraint, try to find and update existing user
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
        console.log('🔄 Email constraint failed, attempting to find and update existing user...');
        
        const existingEmailUser = getUserByEmail.get(data.email || `${data.spotify_user_id}@spotify.local`) as User;
        if (existingEmailUser) {
          const updateUserWithSpotify = db.prepare(`
            UPDATE users 
            SET spotify_user_id = ?, refresh_token_encrypted = ?, is_spotify_connected = 1, auth_type = 'spotify'
            WHERE email = ?
          `);
          
          updateUserWithSpotify.run(
            data.spotify_user_id,
            encryptedRefreshToken,
            data.email || `${data.spotify_user_id}@spotify.local`
          );
          
          const updatedUser = this.getUserBySpotifyId.get(data.spotify_user_id) as User;
          if (updatedUser) {
            return updatedUser;
          }
        }
      }
      
      throw error;
    }
  }

  getBySpotifyId(spotifyUserId: string): User | null {
    return this.getUserBySpotifyId.get(spotifyUserId) as User || null;
  }

  getById(id: number): User | null {
    return this.getUserById.get(id) as User || null;
  }

  updateLastPolled(userId: number): void {
    this.updateLastPolledStmt.run(userId);
  }

  getAllForPolling(): User[] {
    return this.getAllUsersForPolling.all() as User[];
  }

  deleteUserData(spotifyUserId: string): boolean {
    // This will cascade delete all related data due to foreign key constraints
    const result = this.deleteUserDataStmt.run(spotifyUserId);
    return result.changes > 0;
  }
}

export default new UserService();