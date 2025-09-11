-- Update user authentication system from Spotify OAuth to email/password

-- Drop the existing users table and recreate with email/password fields
DROP TABLE IF EXISTS users;

-- Create new users table for email/password authentication
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  spotify_user_id TEXT,
  refresh_token_encrypted TEXT,
  is_spotify_connected BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_polled_at DATETIME,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
);

-- Create indexes for the new users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_spotify_user_id ON users(spotify_user_id);
CREATE INDEX idx_users_expires_at ON users(expires_at);