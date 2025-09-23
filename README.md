# Soundlink - Spotify Campaign Analytics Platform

A web application that generates tracker links for Spotify playlists, enabling marketers to track listening analytics when external users authorize with their Spotify accounts and engage with campaign playlists.

## 🎯 Overview

Soundlink allows you to:
- **Create Campaigns**: Generate unique tracker links for Spotify playlists
- **Track Analytics**: Monitor streams, listeners, and engagement metrics
- **OAuth Integration**: External users authorize with their Spotify accounts
- **Real-time Dashboard**: View campaign performance with detailed analytics

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Spotify Developer Account
- Railway account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/EmilOmadsen/sundaylink.git
   cd soundlink-lite
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=https://yourdomain.com/auth/spotify/callback
   ENCRYPTION_KEY=your_32_character_encryption_key
   DATABASE_PATH=./db/soundlink-lite.db
   NODE_ENV=development
   PORT=3000
   ```

4. **Run database migrations**
   ```bash
   npm run migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## 📁 Project Structure

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

## 🔧 Configuration

### Spotify Developer Setup

1. **Create a Spotify App**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Note your `Client ID` and `Client Secret`

2. **Configure Redirect URIs**
   - Add redirect URIs for your environments:
     - Development: `http://localhost:3000/auth/spotify/callback`
     - Production: `https://yourdomain.com/auth/spotify/callback`

3. **Required Scopes**
   - `user-read-recently-played`
   - `user-read-private`
   - `user-read-email`

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID | Yes | `abc123...` |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret | Yes | `def456...` |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL | Yes | `https://domain.com/auth/spotify/callback` |
| `ENCRYPTION_KEY` | 32-character encryption key | Yes | `my32characterencryptionkey123` |
| `DATABASE_PATH` | SQLite database file path | No | `./db/soundlink-lite.db` |
| `NODE_ENV` | Environment mode | No | `development` or `production` |
| `PORT` | Server port | No | `3000` |

## 📊 Usage

### Creating a Campaign

1. **Access Dashboard**
   - Navigate to `/dashboard`
   - Click "Create New Campaign"

2. **Configure Campaign**
   - Enter campaign name
   - Add Spotify playlist URL
   - Set expiration date (optional)

3. **Get Tracker Link**
   - Copy the generated tracker link
   - Share with your audience

### Analytics Dashboard

1. **View Campaign Metrics**
   - Total streams from playlist
   - Unique listeners
   - Streams per Listener (S/L) ratio
   - Unique songs played
   - Followers gained

2. **Detailed Analytics**
   - Click "Analytics" button for individual campaigns
   - View trends, countries, and growth data
   - Export data as needed

### User Flow

1. **User Clicks Tracker Link**
   - Link redirects to Spotify authorization
   - User grants permissions to the app

2. **Data Collection**
   - System tracks user's recently played tracks
   - Attributes plays to campaign playlist
   - Updates analytics in real-time

3. **Analytics Display**
   - Campaign owner sees updated metrics
   - Data refreshes automatically

## 🔌 API Endpoints

### Campaign Management
- `GET /dashboard` - Campaign dashboard
- `POST /campaigns` - Create new campaign
- `GET /campaigns/:id` - Get campaign details
- `DELETE /campaigns/:id` - Delete campaign

### Analytics
- `GET /campaign-analytics/:id` - Campaign analytics page
- `GET /api/campaign-analytics/:id/overview` - Campaign metrics
- `GET /api/campaign-analytics/:id/trends` - Time-based trends
- `GET /api/campaign-analytics/:id/countries` - Geographic data
- `GET /api/campaign-analytics/:id/growth` - Growth metrics

### Authentication
- `GET /auth/spotify` - Start Spotify OAuth
- `GET /auth/spotify/callback` - OAuth callback handler

### Tracking
- `GET /c/:campaignId` - Tracker link handler
- `POST /api/clicks` - Record click events

See [API Documentation](docs/API.md) for detailed endpoint specifications.

## 🗄️ Database Schema

The application uses SQLite with the following main tables:

- **campaigns** - Campaign information and metadata
- **users** - User accounts (email/password and Spotify OAuth)
- **sessions** - User sessions linked to campaign clicks
- **clicks** - Tracker link click events
- **plays** - Spotify track play data
- **attributions** - Links between plays and campaigns

See [Database Documentation](docs/DATABASE.md) for complete schema details.

## 🚀 Deployment

### Railway Deployment

1. **Connect Repository**
   - Link your GitHub repository to Railway
   - Railway will auto-detect Node.js project

2. **Configure Environment**
   - Add all required environment variables in Railway dashboard
   - Set `NODE_ENV=production`

3. **Deploy**
   - Railway will automatically build and deploy
   - Monitor logs for any issues

### Manual Deployment

1. **Build Application**
   ```bash
   npm run build
   ```

2. **Start Production Server**
   ```bash
   npm start
   ```

3. **Configure Reverse Proxy** (if needed)
   - Use nginx or similar for SSL and routing

See [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

## 🧪 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run lint` - Run ESLint

### Debug Endpoints

The application includes several debug endpoints for development:

- `GET /debug-play-data/:campaignId` - View detailed play data
- `GET /debug-clear-playlist-cache` - Clear playlist cache
- `GET /debug-clear-playlist-cache/:playlistId` - Clear specific playlist cache

### Adding New Features

1. **Create Service Layer**
   - Add business logic in `src/services/`
   - Follow existing patterns for database operations

2. **Add API Routes**
   - Create route handlers in `src/routes/`
   - Register routes in `src/index.ts`

3. **Update Frontend**
   - Modify dashboard templates in route files
   - Add JavaScript for new functionality

## 🔒 Security

### Data Protection
- All sensitive data encrypted with AES-256
- Spotify tokens encrypted before database storage
- Input validation on all API endpoints

### Authentication
- Secure OAuth 2.0 flow with Spotify
- Session-based authentication for dashboard access
- Proper token refresh handling

### Best Practices
- Use HTTPS in production
- Regular security updates
- Monitor for suspicious activity

## 📈 Monitoring

### Logs
- Application logs to console
- Error tracking for debugging
- Performance monitoring

### Health Checks
- Database connectivity
- Spotify API status
- System resource usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues

**"Illegal redirect_uri" Error**
- Ensure redirect URI in Spotify app matches exactly
- Check that protocol (https/http) is correct

**"Failed to create user account" Error**
- Verify database schema is up to date
- Check that all required fields are populated

**Analytics Not Updating**
- Check if polling service is running
- Verify Spotify API credentials
- Use manual sync button as fallback

### Getting Help

- Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- Review [API Documentation](docs/API.md)
- Open an issue on GitHub

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Campaign creation and tracking
- Spotify OAuth integration
- Analytics dashboard
- Real-time data collection

---

**Built with ❤️ for music marketers and playlist promoters**