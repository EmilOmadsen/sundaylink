# Soundlink - Complete Developer Guide

**Spotify Campaign Analytics Platform**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start Guide](#quick-start-guide)
3. [Technical Architecture](#technical-architecture)
4. [API Documentation](#api-documentation)
5. [Database Schema](#database-schema)
6. [Deployment Guide](#deployment-guide)
7. [Troubleshooting](#troubleshooting)
8. [Development Guidelines](#development-guidelines)

---

## Project Overview

Soundlink is a web application that generates tracker links for Spotify playlists, enabling marketers to track listening analytics when external users authorize with their Spotify accounts and engage with campaign playlists.

### Core Features

- **Campaign Management**: Create campaigns with unique tracker links
- **Spotify OAuth Integration**: External users authorize with their Spotify accounts
- **Analytics Dashboard**: Real-time metrics (streams, listeners, engagement)
- **Data Attribution**: Links user plays to specific campaigns
- **Background Processing**: Automated data collection and polling

### Technology Stack

- **Backend**: Node.js + TypeScript + Express.js
- **Database**: SQLite with migrations
- **Frontend**: Vanilla JavaScript + Chart.js
- **Deployment**: Railway platform
- **Authentication**: Spotify OAuth 2.0
- **Security**: AES-256 encryption

---

## Quick Start Guide

### Prerequisites

- Node.js 18+
- npm or yarn
- Spotify Developer Account
- Railway account (for deployment)

### Installation

1. **Clone and Setup**
   ```bash
   git clone https://github.com/EmilOmadsen/sundaylink.git
   cd soundlink-lite
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Configure `.env`:
   ```env
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=https://yourdomain.com/auth/spotify/callback
   ENCRYPTION_KEY=your_32_character_encryption_key
   DATABASE_PATH=./db/soundlink-lite.db
   NODE_ENV=development
   PORT=3000
   ```

3. **Database Setup**
   ```bash
   npm run migrate
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

### Spotify App Setup

1. Create app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add redirect URIs:
   - Development: `http://localhost:3000/auth/spotify/callback`
   - Production: `https://yourdomain.com/auth/spotify/callback`
3. Required scopes: `user-read-recently-played`, `user-read-private`, `user-read-email`

---

## Technical Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Browser  │    │  Campaign Owner │    │ Spotify Web API │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Soundlink Application                        │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Frontend  │  │   Backend   │  │  Services   │            │
│  │   (HTML/JS) │  │ (Express)   │  │   Layer     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Database   │  │  Polling    │  │ Attribution │            │
│  │  (SQLite)   │  │  Service    │  │   Engine    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
soundlink-lite/
├── src/
│   ├── index.ts                 # Main server file
│   ├── routes/                  # Express route handlers
│   │   ├── auth.ts             # Spotify OAuth handling
│   │   ├── campaigns.ts        # Campaign management
│   │   ├── dashboard.ts        # Dashboard UI
│   │   ├── clicks.ts           # Click tracking
│   │   ├── metrics.ts          # Analytics endpoints
│   │   └── campaign-analytics.ts # Individual campaign analytics
│   ├── services/               # Business logic services
│   │   ├── attribution.ts      # Data attribution logic
│   │   ├── spotify.ts          # Spotify API integration
│   │   ├── polling.ts          # Background data collection
│   │   ├── database.ts         # Database operations
│   │   └── users.ts            # User management
│   └── utils/                  # Utility functions
│       ├── encryption.ts       # Data encryption
│       └── id.ts              # ID generation
├── db/
│   ├── migrations/             # Database schema migrations
│   └── soundlink-lite.db       # SQLite database
├── dist/                       # Compiled TypeScript
└── package.json
```

### Data Flow

1. **Campaign Creation**: User creates campaign → Database → Tracker link generated
2. **User Interaction**: External user clicks link → OAuth → Spotify → Play data collected
3. **Analytics**: Campaign owner views dashboard → API queries → Aggregated data → Charts

---

## API Documentation

### Base URL
- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

### Authentication

#### Spotify OAuth Flow
```
GET /auth/spotify?campaignId={id}&clickId={id}
GET /auth/spotify/callback?code={code}&state={state}
```

### Campaign Management

#### Create Campaign
```http
POST /campaigns
Content-Type: application/json

{
  "name": "Summer Playlist 2024",
  "destination_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "camp_1234567890_abcdef123",
  "name": "Summer Playlist 2024",
  "tracker_url": "https://yourdomain.com/c/camp_1234567890_abcdef123",
  "destination_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
  "created_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### Get Campaign
```http
GET /campaigns/:id
```

**Response:**
```json
{
  "id": "camp_1234567890_abcdef123",
  "name": "Summer Playlist 2024",
  "tracker_url": "https://yourdomain.com/c/camp_1234567890_abcdef123",
  "destination_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
  "created_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-12-31T23:59:59Z",
  "metrics": {
    "total_clicks": 150,
    "total_streams": 1250,
    "unique_listeners": 89,
    "unique_songs": 45,
    "sl_ratio": 14.04,
    "followers_gained": 12
  }
}
```

### Analytics

#### Campaign Overview
```http
GET /api/campaign-analytics/:id/overview
```

**Response:**
```json
{
  "campaign": {
    "name": "Summer Playlist 2024",
    "destination_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "metrics": {
    "total_clicks": 150,
    "total_streams": 1250,
    "unique_listeners": 89,
    "unique_songs": 45,
    "sl_ratio": 14.04,
    "followers_gained": 12
  }
}
```

#### Campaign Trends
```http
GET /api/campaign-analytics/:id/trends
```

**Response:**
```json
{
  "trends": [
    {
      "date": "2024-01-15",
      "streams": 45,
      "listeners": 12
    },
    {
      "date": "2024-01-16",
      "streams": 67,
      "listeners": 18
    }
  ]
}
```

#### Campaign Countries
```http
GET /api/campaign-analytics/:id/countries
```

**Response:**
```json
{
  "countries": [
    {
      "country": "United States",
      "listeners": 34,
      "percentage": 38.2
    },
    {
      "country": "United Kingdom",
      "listeners": 23,
      "percentage": 25.8
    }
  ]
}
```

### Click Tracking

#### Track Click
```http
POST /api/clicks
Content-Type: application/json

{
  "campaign_id": "camp_1234567890_abcdef123",
  "user_agent": "Mozilla/5.0...",
  "ip_address": "192.168.1.1",
  "referrer": "https://example.com"
}
```

### Dashboard

#### Get Dashboard Data
```http
GET /api/dashboard
Authorization: Bearer {session_token}
```

**Response:**
```json
{
  "user": {
    "id": "user_1234567890_abcdef123",
    "email": "user@example.com",
    "display_name": "John Doe"
  },
  "campaigns": [
    {
      "id": "camp_1234567890_abcdef123",
      "name": "Summer Playlist 2024",
      "tracker_url": "https://yourdomain.com/c/camp_1234567890_abcdef123",
      "created_at": "2024-01-15T10:30:00Z",
      "expires_at": "2024-12-31T23:59:59Z",
      "metrics": {
        "total_clicks": 150,
        "total_streams": 1250,
        "unique_listeners": 89,
        "unique_songs": 45,
        "sl_ratio": 14.04,
        "followers_gained": 12
      }
    }
  ],
  "summary": {
    "total_campaigns": 5,
    "total_clicks": 1250,
    "total_streams": 8750,
    "total_listeners": 450
  }
}
```

### Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `INVALID_REQUEST` (400) - Invalid request parameters
- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `SPOTIFY_API_ERROR` (502) - Spotify API error
- `INTERNAL_ERROR` (500) - Internal server error

---

## Database Schema

### Overview

SQLite database with 6 main tables:
- **campaigns** - Campaign information and metadata
- **users** - User accounts (email/password and Spotify OAuth)
- **sessions** - User sessions linked to campaign interactions
- **clicks** - Tracker link click events
- **plays** - Spotify track play data
- **attributions** - Links between plays and campaigns

### Table Schemas

#### campaigns
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
```

#### users
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
```

#### sessions
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
```

#### clicks
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
```

#### plays
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
```

#### attributions
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
```

### Common Queries

#### Campaign Analytics
```sql
-- Total streams for a campaign
SELECT COUNT(DISTINCT a.id) as total_streams
FROM attributions a
WHERE a.campaign_id = ? AND a.expires_at > datetime('now');

-- Unique listeners for a campaign
SELECT COUNT(DISTINCT s.user_id) as unique_listeners
FROM attributions a
JOIN sessions s ON a.click_id = s.click_id
WHERE a.campaign_id = ? AND a.expires_at > datetime('now');

-- Unique songs for a campaign
SELECT COUNT(DISTINCT p.spotify_track_id) as unique_songs
FROM attributions a
JOIN plays p ON a.play_id = p.id
WHERE a.campaign_id = ? AND a.expires_at > datetime('now');
```

---

## Deployment Guide

### Railway Deployment

#### Step 1: Connect Repository
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Create new project from GitHub repo
4. Railway auto-detects Node.js

#### Step 2: Environment Variables
Configure in Railway dashboard:

| Variable | Description | Example |
|----------|-------------|---------|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID | `abc123...` |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret | `def456...` |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL | `https://your-app.railway.app/auth/spotify/callback` |
| `ENCRYPTION_KEY` | 32-character encryption key | `my32characterencryptionkey123` |
| `DATABASE_PATH` | Database file path | `/app/db/soundlink-lite.db` |
| `NODE_ENV` | Environment mode | `production` |

#### Step 3: Spotify App Configuration
1. Update redirect URIs in Spotify Developer Dashboard
2. Add production URL: `https://your-app.railway.app/auth/spotify/callback`
3. Ensure app is not in "Development Mode" for public access

#### Step 4: Deploy
- Railway automatically builds and deploys
- Monitor logs for any issues
- Database migrations run automatically

### Build Configuration

#### package.json Scripts
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon src/index.ts",
    "migrate": "node dist/utils/migrate.js"
  }
}
```

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Troubleshooting

### Common Issues

#### "Illegal redirect_uri" Error
**Cause**: Redirect URI mismatch between code and Spotify app
**Solution**: 
1. Check Spotify app settings
2. Verify redirect URIs match exactly
3. Ensure correct protocol (https/http)

#### "NOT NULL constraint failed" Error
**Cause**: Database schema mismatch
**Solution**:
1. Run database migrations: `npm run migrate`
2. Check schema: `PRAGMA table_info(users);`
3. Verify user creation logic

#### Analytics Showing 0 Values
**Cause**: Polling service not running or attribution issues
**Solution**:
1. Check polling service status
2. Use manual sync button
3. Verify session linking
4. Check debug endpoint: `/debug-play-data/{campaignId}`

#### Railway Build Failures
**Cause**: TypeScript compilation errors
**Solution**:
1. Check TypeScript errors: `npm run build`
2. Verify dependencies: `npm install`
3. Review Railway build logs

### Debug Endpoints

Available for development:
- `GET /debug-play-data/:campaignId` - View detailed play data
- `GET /debug-clear-playlist-cache` - Clear all playlist cache
- `GET /debug-clear-playlist-cache/:playlistId` - Clear specific playlist cache
- `GET /health` - System health check

### Logging

Enable detailed logging:
```typescript
process.env.LOG_LEVEL = 'debug';
```

---

## Development Guidelines

### Code Organization

#### Modular Structure
```
src/
├── index.ts          # Application entry point
├── routes/           # HTTP route handlers
├── services/         # Business logic
├── utils/            # Utility functions
└── types/            # TypeScript type definitions
```

#### Design Patterns
- Service-oriented architecture
- Repository pattern for data access
- Factory pattern for object creation
- Observer pattern for events

### Adding New Features

#### 1. Create Service Layer
```typescript
// src/services/new-feature.ts
export class NewFeatureService {
  async doSomething(): Promise<Result> {
    // Implementation
  }
}
```

#### 2. Add API Routes
```typescript
// src/routes/new-feature.ts
app.get('/api/new-feature', async (req, res) => {
  try {
    const result = await newFeatureService.doSomething();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 3. Register Routes
```typescript
// src/index.ts
import newFeatureRoutes from './routes/new-feature';
app.use('/api', newFeatureRoutes);
```

### Testing Strategy

#### Unit Tests
```typescript
// tests/services/attribution.test.ts
describe('AttributionService', () => {
  it('should attribute plays to campaigns', async () => {
    // Test implementation
  });
});
```

#### Integration Tests
```typescript
// tests/api/campaigns.test.ts
describe('Campaigns API', () => {
  it('should create campaign', async () => {
    const response = await request(app)
      .post('/campaigns')
      .send({ name: 'Test Campaign' });
    
    expect(response.status).toBe(201);
  });
});
```

### Performance Optimization

#### Database Optimization
```sql
-- Add indexes for performance
CREATE INDEX idx_attributions_campaign_created ON attributions(campaign_id, created_at);
CREATE INDEX idx_plays_user_played ON plays(user_id, played_at);
```

#### Caching Strategy
```typescript
// Cache frequently accessed data
const cache = new Map();
const cachedData = cache.get(`key`);
if (cachedData) return cachedData;
```

### Security Best Practices

#### Input Validation
```typescript
// Validate all inputs
const { error, value } = schema.validate(req.body);
if (error) return res.status(400).json({ error: error.message });
```

#### SQL Injection Prevention
```typescript
// Use prepared statements
const result = database.prepare(`
  SELECT * FROM campaigns WHERE id = ?
`).get(campaignId);
```

#### Rate Limiting
```typescript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);
```

---

## Key Technical Requirements

### Must-Have Skills for Developers

1. **Node.js + TypeScript** - Core server development
2. **Express.js** - REST API and routing
3. **SQLite** - Database management with migrations
4. **Spotify Web API** - OAuth 2.0 integration, token management
5. **Background Services** - Polling services for data collection
6. **Vanilla JavaScript** - Frontend without frameworks
7. **Chart.js** - Data visualization
8. **Railway Deployment** - Cloud deployment platform

### Critical Technical Challenges

1. **Spotify API Integration** - OAuth flows, rate limits, token management
2. **Data Attribution** - Linking user plays to campaigns accurately
3. **Real-time Analytics** - Background polling, data aggregation, caching
4. **Database Architecture** - Complex relationships and query optimization
5. **Playlist Verification** - Only count streams from specific playlists

### Current Status

✅ **Completed:**
- Core functionality (campaigns, OAuth, analytics)
- Click tracking and attribution system
- Real-time dashboard with charts
- Railway deployment configuration
- Comprehensive documentation

🔧 **Needs Improvement:**
- Playlist verification accuracy
- Error handling and monitoring
- Performance optimization
- Mobile responsiveness
- Advanced analytics features

---

## Support and Resources

### Documentation
- **README.md** - Project overview and setup
- **API Documentation** - Complete endpoint reference
- **Database Schema** - Table structures and queries
- **Architecture Guide** - System design and data flow
- **Troubleshooting** - Common issues and solutions

### Getting Help
1. Check troubleshooting guide for common issues
2. Review API documentation for endpoint details
3. Check GitHub issues for known problems
4. Contact development team for complex issues

### Project Repository
- **GitHub**: https://github.com/EmilOmadsen/sundaylink.git
- **Live Demo**: https://your-domain.railway.app
- **Documentation**: Available in `/docs` folder

---

**Developer Guide Version**: 1.0  
**Last Updated**: January 2025  
**Project Version**: 1.0.0

---

*This comprehensive guide provides everything needed to understand, develop, and maintain the Soundlink platform.*
