# Sunday Link

A smart link platform for music artists to track Spotify playlist performance and attribution. Built with Node.js, TypeScript, Express, and SQLite.

## 🎵 Features

- **Smart Link Generation**: Create trackable links for Spotify playlists, tracks, and artists
- **Campaign Management**: Organize and manage multiple campaigns with pause/resume functionality
- **Real-time Analytics**: Track clicks, streams, unique listeners, and follower growth
- **Spotify Integration**: Automatic data fetching from Spotify API
- **Attribution Tracking**: Link clicks to actual Spotify plays
- **Advanced Analytics**: Comprehensive dashboards with charts and insights
- **User Authentication**: Secure JWT-based authentication system

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
./start-server.sh
```

### Option 2: Manual Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run database migrations:**
   ```bash
   npm run migrate
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## 🌐 Access Points

Once the server is running on `http://localhost:3000`:

- **📊 Dashboard:** http://localhost:3000/dashboard
- **🔐 Login:** http://localhost:3000/simple-auth/login  
- **📝 Register:** http://localhost:3000/simple-auth/register
- **🔗 Create Campaign:** http://localhost:3000/create-campaign
- **🧪 Test Campaign:** http://localhost:3000/test-campaign.html

## 👤 Test Account

- **Email:** test@example.com
- **Password:** test123

## 🔧 What Was Fixed

The following issues have been resolved:

1. **✅ Environment Configuration:** Created `.env` file with required variables
2. **✅ Database Schema:** Added missing `user_id` column to campaigns table
3. **✅ Campaign Creation:** Fixed test endpoint to properly associate campaigns with users
4. **✅ Authentication:** Ensured proper user authentication flow
5. **✅ Smart Links:** Verified smart link generation and routing works
6. **✅ Spotify Integration:** Configured with your Spotify app credentials

## 📋 How to Create Campaigns

### Method 1: Web Interface
1. Go to http://localhost:3000/simple-auth/login
2. Login with test account (test@example.com / test123)
3. Go to http://localhost:3000/create-campaign
4. Fill out the form and create your campaign
5. Copy the generated smart link

### Method 2: Test Endpoint
1. Go to http://localhost:3000/test-campaign.html
2. Click "Create Test Campaign" button
3. View the generated smart link

### Method 3: API Direct
```bash
curl -X POST http://localhost:3000/api/campaigns/test \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Campaign",
    "destination_url": "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh",
    "spotify_track_id": "4iV5W9uYEdYUVa79Axb7Rh"
  }'
```

## 🔗 Smart Link Format

Smart links are generated in the format:
```
http://localhost:3000/c/{campaign_id}
```

When clicked, they:
1. Track the click with analytics
2. Set a click tracking cookie
3. Redirect to the destination URL

## 📊 Features

- ✅ **Campaign Creation:** Create smart tracking links
- ✅ **Click Tracking:** Track all clicks with analytics
- ✅ **User Authentication:** Email/password login system
- ✅ **Dashboard:** View campaigns and analytics
- ✅ **Smart Links:** Automatic redirect with tracking
- ✅ **Spotify Integration:** Track Spotify track/artist/playlist IDs
- ✅ **UTM Parameters:** Support for marketing campaign tracking

## 🎵 Spotify Integration

Your Spotify app is now configured and ready to use! The system can:

- **Connect Spotify Accounts:** Users can link their Spotify accounts
- **Track Recently Played:** Monitor what users listen to after clicking links
- **Attribution Analysis:** Connect clicks to actual music plays
- **Follower Growth:** Track artist/playlist follower increases

### How to Use Spotify Integration:

1. **Login to your account** at http://localhost:3000/simple-auth/login
2. **Connect Spotify** by clicking "Connect Spotify" in the dashboard
3. **Authorize the app** when redirected to Spotify
4. **Create campaigns** with Spotify track/artist/playlist IDs
5. **View analytics** to see attribution between clicks and plays

### Spotify App Details:
- **Client ID:** `cab1f7c20e1343b2a252848cc52c0de9`
- **Redirect URI:** `http://127.0.0.1:3000/auth/spotify/callback`
- **Scopes:** `user-read-recently-played`, `user-read-email`

## 🗄️ Database

The system uses SQLite with the following main tables:
- `campaigns` - Stores campaign data and smart links
- `users` - User accounts and authentication
- `clicks` - Click tracking and analytics
- `sessions` - Links users to clicks for attribution

## 🛠️ Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the TypeScript code to JavaScript
- `npm run start` - Start the production server
- `npm run migrate` - Run database migrations

## 🔍 Troubleshooting

### Server won't start
- Make sure Node.js is installed: `node --version`
- Check if port 3000 is available
- Run `npm install` to ensure dependencies are installed

### Campaign creation fails
- Make sure you're logged in (check cookies)
- Verify the database is properly migrated
- Check server logs for error messages

### Smart links don't work
- Ensure the server is running
- Check that the campaign exists and is active
- Verify the campaign ID in the URL is correct

## 📁 Project Structure

```
src/
├── routes/     # Express route handlers
│   ├── campaigns.ts    # Campaign CRUD operations
│   ├── clicks.ts       # Smart link click handling
│   ├── auth.ts         # Authentication routes
│   ├── dashboard.ts    # Dashboard interface
│   └── create-campaign.ts # Campaign creation form
├── services/   # Business logic
│   ├── campaigns.ts    # Campaign service
│   ├── auth.ts         # Authentication service
│   ├── clicks.ts       # Click tracking service
│   └── database.ts     # Database connection
├── utils/      # Utility functions
└── index.ts    # Main application entry point

db/
├── migrations/ # SQL migration files
└── soundlink-lite.db # SQLite database
```