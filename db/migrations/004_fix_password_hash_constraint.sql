-- Fix password_hash constraint to support Spotify OAuth users
-- This migration makes password_hash nullable to support both email/password and Spotify OAuth users

-- First, let's check if we need to update the existing users table
-- We'll add a new column for auth_type to distinguish between auth methods

-- Add auth_type column to distinguish authentication methods
ALTER TABLE users ADD COLUMN auth_type TEXT DEFAULT 'spotify' CHECK (auth_type IN ('email', 'spotify'));

-- Make password_hash nullable (SQLite doesn't support ALTER COLUMN, so we'll recreate the table)
-- First, create a backup table with the new schema
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,  -- Made nullable
  display_name TEXT,
  spotify_user_id TEXT,
  refresh_token_encrypted TEXT,
  is_spotify_connected BOOLEAN DEFAULT 0,
  auth_type TEXT DEFAULT 'spotify' CHECK (auth_type IN ('email', 'spotify')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_polled_at DATETIME,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
);

-- Copy existing data to the new table
INSERT INTO users_new (
  id, email, password_hash, display_name, spotify_user_id, 
  refresh_token_encrypted, is_spotify_connected, auth_type, 
  created_at, last_polled_at, expires_at
)
SELECT 
  id, email, password_hash, display_name, spotify_user_id,
  refresh_token_encrypted, is_spotify_connected, 
  CASE 
    WHEN password_hash IS NOT NULL THEN 'email'
    ELSE 'spotify'
  END as auth_type,
  created_at, last_polled_at, expires_at
FROM users;

-- Drop the old table and rename the new one
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_spotify_user_id ON users(spotify_user_id);
CREATE INDEX idx_users_expires_at ON users(expires_at);
CREATE INDEX idx_users_auth_type ON users(auth_type);
