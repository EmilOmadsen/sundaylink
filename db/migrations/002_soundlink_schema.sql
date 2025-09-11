-- Drop the example users table from initial migration
DROP TABLE IF EXISTS users;

-- Campaigns table - stores smart link campaigns
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  spotify_track_id TEXT,
  spotify_artist_id TEXT,
  spotify_playlist_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
);

-- Clicks table - tracks each click on smart links
CREATE TABLE clicks (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  referrer TEXT,
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Users table - stores Spotify users who authenticated
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spotify_user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT,
  refresh_token_encrypted TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_polled_at DATETIME,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days'))
);

-- Sessions table - links users to clicks for attribution
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  click_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days')),
  FOREIGN KEY (click_id) REFERENCES clicks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(click_id, user_id)
);

-- Plays table - stores recently played tracks from Spotify
CREATE TABLE plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  spotify_track_id TEXT NOT NULL,
  spotify_artist_id TEXT,
  played_at DATETIME NOT NULL,
  track_name TEXT,
  artist_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attributions table - links plays to clicks with confidence scores
CREATE TABLE attributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  play_id INTEGER NOT NULL,
  click_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  time_diff_hours REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days')),
  FOREIGN KEY (play_id) REFERENCES plays(id) ON DELETE CASCADE,
  FOREIGN KEY (click_id) REFERENCES clicks(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Followers snapshots table - tracks follower counts over time
CREATE TABLE followers_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spotify_id TEXT NOT NULL,
  spotify_type TEXT NOT NULL CHECK (spotify_type IN ('artist', 'playlist')),
  follower_count INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+40 days')),
  UNIQUE(spotify_id, spotify_type, snapshot_date)
);

-- Indexes for performance
CREATE INDEX idx_clicks_campaign_id ON clicks(campaign_id);
CREATE INDEX idx_clicks_clicked_at ON clicks(clicked_at);
CREATE INDEX idx_clicks_expires_at ON clicks(expires_at);

CREATE INDEX idx_users_spotify_user_id ON users(spotify_user_id);
CREATE INDEX idx_users_expires_at ON users(expires_at);

CREATE INDEX idx_sessions_click_id ON sessions(click_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX idx_plays_user_id ON plays(user_id);
CREATE INDEX idx_plays_played_at ON plays(played_at);
CREATE INDEX idx_plays_spotify_track_id ON plays(spotify_track_id);
CREATE INDEX idx_plays_expires_at ON plays(expires_at);

CREATE INDEX idx_attributions_play_id ON attributions(play_id);
CREATE INDEX idx_attributions_click_id ON attributions(click_id);
CREATE INDEX idx_attributions_campaign_id ON attributions(campaign_id);
CREATE INDEX idx_attributions_expires_at ON attributions(expires_at);

CREATE INDEX idx_followers_spotify_id ON followers_snapshots(spotify_id);
CREATE INDEX idx_followers_snapshot_date ON followers_snapshots(snapshot_date);
CREATE INDEX idx_followers_expires_at ON followers_snapshots(expires_at);

CREATE INDEX idx_campaigns_expires_at ON campaigns(expires_at);