# Soundlink Database Documentation

## Overview

Soundlink uses SQLite as its database system, providing a lightweight, file-based solution that's perfect for the application's requirements. The database stores all campaign data, user information, tracking events, and analytics.

## Database File

- **Location**: `./db/soundlink-lite.db`
- **Type**: SQLite 3
- **Backup Files**: `.db-shm` and `.db-wal` (WAL mode)

## Schema Overview

The database consists of 6 main tables:

1. **campaigns** - Campaign information and metadata
2. **users** - User accounts and authentication data
3. **sessions** - User sessions linked to campaign interactions
4. **clicks** - Tracker link click events
5. **plays** - Spotify track play data
6. **attributions** - Links between plays and campaigns

## Table Schemas

### campaigns

Stores campaign information and metadata.

```sql
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    destination_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    owner_id TEXT,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX idx_campaigns_expires_at ON campaigns(expires_at);
CREATE INDEX idx_campaigns_owner_id ON campaigns(owner_id);
```

**Columns**:
- `id` (TEXT, PRIMARY KEY) - Unique campaign identifier (format: `camp_{timestamp}_{random}`)
- `name` (TEXT, NOT NULL) - Campaign display name
- `destination_url` (TEXT, NOT NULL) - Spotify playlist URL
- `created_at` (DATETIME) - Campaign creation timestamp
- `expires_at` (DATETIME) - Campaign expiration date (optional)
- `owner_id` (TEXT, FOREIGN KEY) - ID of campaign owner

### users

Stores user accounts for both email/password and Spotify OAuth authentication.

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    display_name TEXT,
    spotify_user_id TEXT UNIQUE,
    refresh_token_encrypted TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    auth_type TEXT DEFAULT 'spotify' CHECK (auth_type IN ('email', 'spotify'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_spotify_user_id ON users(spotify_user_id);
CREATE INDEX idx_users_auth_type ON users(auth_type);
```

**Columns**:
- `id` (TEXT, PRIMARY KEY) - Unique user identifier (format: `user_{timestamp}_{random}`)
- `email` (TEXT, UNIQUE) - User email address
- `password_hash` (TEXT) - Hashed password (nullable for Spotify users)
- `display_name` (TEXT) - User's display name
- `spotify_user_id` (TEXT, UNIQUE) - Spotify user ID (nullable for email users)
- `refresh_token_encrypted` (TEXT) - Encrypted Spotify refresh token
- `created_at` (DATETIME) - Account creation timestamp
- `updated_at` (DATETIME) - Last update timestamp
- `auth_type` (TEXT) - Authentication type: 'email' or 'spotify'

### sessions

Links user sessions to campaign clicks for attribution tracking.

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    click_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (click_id) REFERENCES clicks(id)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_click_id ON sessions(click_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

**Columns**:
- `id` (TEXT, PRIMARY KEY) - Unique session identifier
- `user_id` (TEXT, NOT NULL) - Reference to users table
- `click_id` (TEXT, NOT NULL) - Reference to clicks table
- `created_at` (DATETIME) - Session creation timestamp
- `expires_at` (DATETIME) - Session expiration timestamp

### clicks

Records all tracker link click events with metadata.

```sql
CREATE TABLE clicks (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    referrer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX idx_clicks_campaign_id ON clicks(campaign_id);
CREATE INDEX idx_clicks_created_at ON clicks(created_at);
```

**Columns**:
- `id` (TEXT, PRIMARY KEY) - Unique click identifier
- `campaign_id` (TEXT, NOT NULL) - Reference to campaigns table
- `user_agent` (TEXT) - Browser user agent string
- `ip_address` (TEXT) - IP address of clicker
- `referrer` (TEXT) - Referring page URL
- `created_at` (DATETIME) - Click timestamp

### plays

Stores Spotify track play data collected from users.

```sql
CREATE TABLE plays (
    id TEXT PRIMARY KEY,
    spotify_track_id TEXT NOT NULL,
    track_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_name TEXT,
    duration_ms INTEGER,
    played_at DATETIME NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_plays_user_id ON plays(user_id);
CREATE INDEX idx_plays_spotify_track_id ON plays(spotify_track_id);
CREATE INDEX idx_plays_played_at ON plays(played_at);
```

**Columns**:
- `id` (TEXT, PRIMARY KEY) - Unique play identifier
- `spotify_track_id` (TEXT, NOT NULL) - Spotify track ID
- `track_name` (TEXT, NOT NULL) - Track name
- `artist_name` (TEXT, NOT NULL) - Artist name
- `album_name` (TEXT) - Album name (optional)
- `duration_ms` (INTEGER) - Track duration in milliseconds
- `played_at` (DATETIME, NOT NULL) - When the track was played
- `user_id` (TEXT, NOT NULL) - Reference to users table
- `created_at` (DATETIME) - Record creation timestamp

### attributions

Links user plays to campaigns for analytics and attribution scoring.

```sql
CREATE TABLE attributions (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    play_id TEXT NOT NULL,
    click_id TEXT NOT NULL,
    confidence_score REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (play_id) REFERENCES plays(id),
    FOREIGN KEY (click_id) REFERENCES clicks(id)
);

CREATE INDEX idx_attributions_campaign_id ON attributions(campaign_id);
CREATE INDEX idx_attributions_play_id ON attributions(play_id);
CREATE INDEX idx_attributions_click_id ON attributions(click_id);
CREATE INDEX idx_attributions_expires_at ON attributions(expires_at);
```

**Columns**:
- `id` (TEXT, PRIMARY KEY) - Unique attribution identifier
- `campaign_id` (TEXT, NOT NULL) - Reference to campaigns table
- `play_id` (TEXT, NOT NULL) - Reference to plays table
- `click_id` (TEXT, NOT NULL) - Reference to clicks table
- `confidence_score` (REAL) - Attribution confidence (0.0-1.0)
- `created_at` (DATETIME) - Attribution creation timestamp
- `expires_at` (DATETIME) - Attribution expiration timestamp

## Database Migrations

The application uses a migration system to manage schema changes over time.

### Migration Files

Located in `db/migrations/`:

1. **001_initial_schema.sql** - Initial database setup
2. **002_soundlink_schema.sql** - Core application tables
3. **003_auth_system_update.sql** - Authentication system updates
4. **004_fix_password_hash_constraint.sql** - Fix password hash constraints

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Or manually
node dist/utils/migrate.js
```

### Migration Format

Each migration file should:

1. Have a unique filename with incrementing number
2. Include `-- Migration: {description}` comment
3. Use `BEGIN TRANSACTION` and `COMMIT` for atomicity
4. Include rollback instructions in comments

Example migration:
```sql
-- Migration: Add user authentication fields
BEGIN TRANSACTION;

-- Add new columns
ALTER TABLE users ADD COLUMN auth_type TEXT DEFAULT 'spotify' CHECK (auth_type IN ('email', 'spotify'));
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Create indexes
CREATE INDEX idx_users_auth_type ON users(auth_type);

COMMIT;

-- Rollback:
-- DROP INDEX idx_users_auth_type;
-- ALTER TABLE users DROP COLUMN auth_type;
-- ALTER TABLE users DROP COLUMN password_hash;
```

## Data Relationships

### Entity Relationship Diagram

```
campaigns (1) -----> (many) clicks
   |
   v
attributions (many) <----- (1) plays
   |
   v
sessions (many) -----> (1) users
```

### Key Relationships

1. **Campaign → Clicks**: One campaign can have many clicks
2. **Clicks → Sessions**: Each click can create one session
3. **Sessions → Users**: Each session belongs to one user
4. **Users → Plays**: One user can have many plays
5. **Plays → Attributions**: Each play can be attributed to campaigns
6. **Clicks → Attributions**: Each click can generate multiple attributions

## Common Queries

### Campaign Analytics

**Total streams for a campaign**:
```sql
SELECT COUNT(DISTINCT a.id) as total_streams
FROM attributions a
WHERE a.campaign_id = ? AND a.expires_at > datetime('now');
```

**Unique listeners for a campaign**:
```sql
SELECT COUNT(DISTINCT s.user_id) as unique_listeners
FROM attributions a
JOIN sessions s ON a.click_id = s.click_id
WHERE a.campaign_id = ? AND a.expires_at > datetime('now');
```

**Unique songs for a campaign**:
```sql
SELECT COUNT(DISTINCT p.spotify_track_id) as unique_songs
FROM attributions a
JOIN plays p ON a.play_id = p.id
WHERE a.campaign_id = ? AND a.expires_at > datetime('now');
```

### User Play Data

**Recent plays for a user**:
```sql
SELECT p.*, a.campaign_id, a.confidence_score
FROM plays p
LEFT JOIN attributions a ON p.id = a.play_id
WHERE p.user_id = ?
ORDER BY p.played_at DESC
LIMIT 50;
```

### Attribution Queries

**Plays attributed to campaigns**:
```sql
SELECT 
    c.name as campaign_name,
    p.track_name,
    p.artist_name,
    u.display_name as user_name,
    a.confidence_score,
    a.created_at as attributed_at
FROM attributions a
JOIN campaigns c ON a.campaign_id = c.id
JOIN plays p ON a.play_id = p.id
JOIN sessions s ON a.click_id = s.click_id
JOIN users u ON s.user_id = u.id
WHERE a.expires_at > datetime('now')
ORDER BY a.created_at DESC;
```

## Performance Optimization

### Indexes

The database includes strategic indexes for optimal query performance:

- **Primary Keys**: All tables have TEXT primary keys for uniqueness
- **Foreign Keys**: Indexed for JOIN performance
- **Date Columns**: Indexed for time-based queries
- **Lookup Columns**: Email, Spotify ID, campaign ID indexed

### Query Optimization Tips

1. **Use EXPLAIN QUERY PLAN** to analyze query performance
2. **Limit result sets** with appropriate WHERE clauses
3. **Use JOINs efficiently** to avoid N+1 queries
4. **Index frequently queried columns**
5. **Use prepared statements** for parameterized queries

### Example Optimized Query

```sql
-- Get campaign metrics efficiently
EXPLAIN QUERY PLAN
SELECT 
    c.name,
    COUNT(DISTINCT cl.id) as total_clicks,
    COUNT(DISTINCT a.id) as total_streams,
    COUNT(DISTINCT s.user_id) as unique_listeners,
    COUNT(DISTINCT p.spotify_track_id) as unique_songs
FROM campaigns c
LEFT JOIN clicks cl ON c.id = cl.campaign_id
LEFT JOIN attributions a ON c.id = a.campaign_id AND a.expires_at > datetime('now')
LEFT JOIN sessions s ON a.click_id = s.click_id
LEFT JOIN plays p ON a.play_id = p.id
WHERE c.id = ?
GROUP BY c.id, c.name;
```

## Data Cleanup

### Expired Data Cleanup

The application should periodically clean up expired data:

```sql
-- Delete expired attributions
DELETE FROM attributions WHERE expires_at < datetime('now');

-- Delete expired sessions
DELETE FROM sessions WHERE expires_at < datetime('now');

-- Delete old clicks (older than 1 year)
DELETE FROM clicks WHERE created_at < datetime('now', '-1 year');

-- Delete old plays (older than 1 year)
DELETE FROM plays WHERE created_at < datetime('now', '-1 year');
```

### Maintenance Script

Create a maintenance script to run cleanup operations:

```javascript
// cleanup.js
const { default: database } = require('./services/database');

async function cleanupExpiredData() {
  console.log('Starting database cleanup...');
  
  // Clean expired attributions
  const expiredAttributions = database.prepare(`
    DELETE FROM attributions WHERE expires_at < datetime('now')
  `).run();
  
  // Clean expired sessions
  const expiredSessions = database.prepare(`
    DELETE FROM sessions WHERE expires_at < datetime('now')
  `).run();
  
  console.log(`Cleaned ${expiredAttributions.changes} expired attributions`);
  console.log(`Cleaned ${expiredSessions.changes} expired sessions`);
}

cleanupExpiredData();
```

## Backup and Recovery

### Backup Strategy

1. **Regular Backups**: Daily automated backups
2. **WAL Files**: Include `.db-shm` and `.db-wal` files
3. **Compression**: Compress backup files
4. **Retention**: Keep backups for 30 days

### Backup Script

```bash
#!/bin/bash
# backup.sh

DB_PATH="./db/soundlink-lite.db"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
cp $DB_PATH $BACKUP_DIR/soundlink-lite_$DATE.db
cp $DB_PATH-shm $BACKUP_DIR/soundlink-lite_$DATE.db-shm
cp $DB_PATH-wal $BACKUP_DIR/soundlink-lite_$DATE.db-wal

# Compress backup
gzip $BACKUP_DIR/soundlink-lite_$DATE.db*

echo "Backup created: soundlink-lite_$DATE.db.gz"
```

### Recovery Process

1. **Stop Application**: Ensure no writes to database
2. **Restore Files**: Copy backup files to database location
3. **Verify Integrity**: Run `PRAGMA integrity_check`
4. **Restart Application**: Resume normal operations

## Security Considerations

### Data Encryption

- **Sensitive Data**: Refresh tokens encrypted with AES-256
- **Password Hashing**: Passwords hashed with bcrypt
- **Database File**: Consider filesystem-level encryption

### Access Control

- **File Permissions**: Restrict database file access
- **Connection Limits**: Limit concurrent connections
- **Query Validation**: Validate all user inputs

### Audit Trail

Consider adding audit tables for sensitive operations:

```sql
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    user_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Monitoring and Maintenance

### Health Checks

```sql
-- Check database integrity
PRAGMA integrity_check;

-- Check foreign key constraints
PRAGMA foreign_key_check;

-- Get database statistics
SELECT name, page_count, page_size FROM pragma_page_count(), pragma_page_size();
```

### Performance Monitoring

```sql
-- Monitor query performance
EXPLAIN QUERY PLAN [your query];

-- Check index usage
SELECT name FROM sqlite_master WHERE type='index';
```

---

**Database Version**: 1.0  
**Last Updated**: January 2025  
**SQLite Version**: 3.x
