# Soundlink API Documentation

## Overview

The Soundlink API provides endpoints for campaign management, analytics tracking, and user authentication. All API responses are in JSON format.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

## Authentication

### Spotify OAuth Flow

1. **Initiate OAuth**
   ```
   GET /auth/spotify?campaignId={id}&clickId={id}
   ```

2. **Handle Callback**
   ```
   GET /auth/spotify/callback?code={code}&state={state}
   ```

## Campaign Management

### Create Campaign
Creates a new campaign with a tracker link.

**Endpoint**: `POST /campaigns`

**Request Body**:
```json
{
  "name": "Summer Playlist 2024",
  "destination_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**Response**:
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

### Get Campaign
Retrieves campaign details and basic metrics.

**Endpoint**: `GET /campaigns/:id`

**Response**:
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

### Delete Campaign
Deletes a campaign and all associated data.

**Endpoint**: `DELETE /campaigns/:id`

**Response**:
```json
{
  "message": "Campaign deleted successfully",
  "campaign_id": "camp_1234567890_abcdef123"
}
```

## Analytics

### Campaign Overview
Get comprehensive metrics for a specific campaign.

**Endpoint**: `GET /api/campaign-analytics/:id/overview`

**Response**:
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

### Campaign Trends
Get time-based analytics showing daily trends.

**Endpoint**: `GET /api/campaign-analytics/:id/trends`

**Response**:
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

### Campaign Countries
Get geographic distribution of listeners.

**Endpoint**: `GET /api/campaign-analytics/:id/countries`

**Response**:
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

### Campaign Growth
Get weekly growth metrics.

**Endpoint**: `GET /api/campaign-analytics/:id/growth`

**Response**:
```json
{
  "growth": [
    {
      "week": "2024-W03",
      "streams": 234,
      "listeners": 45
    },
    {
      "week": "2024-W04",
      "streams": 312,
      "listeners": 52
    }
  ]
}
```

## Click Tracking

### Track Click
Records a click event for analytics.

**Endpoint**: `POST /api/clicks`

**Request Body**:
```json
{
  "campaign_id": "camp_1234567890_abcdef123",
  "user_agent": "Mozilla/5.0...",
  "ip_address": "192.168.1.1",
  "referrer": "https://example.com"
}
```

**Response**:
```json
{
  "click_id": "click_1234567890_abcdef123",
  "tracker_url": "https://yourdomain.com/c/camp_1234567890_abcdef123",
  "redirect_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
}
```

### Get Click Details
Retrieve details about a specific click.

**Endpoint**: `GET /api/clicks/:id`

**Response**:
```json
{
  "id": "click_1234567890_abcdef123",
  "campaign_id": "camp_1234567890_abcdef123",
  "user_agent": "Mozilla/5.0...",
  "ip_address": "192.168.1.1",
  "referrer": "https://example.com",
  "created_at": "2024-01-15T10:30:00Z",
  "has_session": true,
  "session_id": "session_1234567890_abcdef123"
}
```

## User Management

### Get User Profile
Get user profile information.

**Endpoint**: `GET /api/users/profile`

**Headers**: `Authorization: Bearer {session_token}`

**Response**:
```json
{
  "id": "user_1234567890_abcdef123",
  "email": "user@example.com",
  "display_name": "John Doe",
  "spotify_user_id": "spotify_user_123",
  "auth_type": "spotify",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Update User Profile
Update user profile information.

**Endpoint**: `PUT /api/users/profile`

**Headers**: `Authorization: Bearer {session_token}`

**Request Body**:
```json
{
  "display_name": "John Smith",
  "email": "johnsmith@example.com"
}
```

**Response**:
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "user_1234567890_abcdef123",
    "email": "johnsmith@example.com",
    "display_name": "John Smith",
    "spotify_user_id": "spotify_user_123",
    "auth_type": "spotify",
    "updated_at": "2024-01-15T11:30:00Z"
  }
}
```

## Dashboard

### Get Dashboard Data
Get overview data for the dashboard.

**Endpoint**: `GET /api/dashboard`

**Headers**: `Authorization: Bearer {session_token}`

**Response**:
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

## Authentication & Sessions

### Login with Email/Password
Authenticate with email and password.

**Endpoint**: `POST /auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "message": "Login successful",
  "session_token": "session_1234567890_abcdef123",
  "user": {
    "id": "user_1234567890_abcdef123",
    "email": "user@example.com",
    "display_name": "John Doe",
    "auth_type": "email"
  }
}
```

### Register New User
Create a new user account.

**Endpoint**: `POST /auth/register`

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "display_name": "Jane Doe"
}
```

**Response**:
```json
{
  "message": "Registration successful",
  "session_token": "session_1234567890_abcdef123",
  "user": {
    "id": "user_1234567890_abcdef123",
    "email": "newuser@example.com",
    "display_name": "Jane Doe",
    "auth_type": "email"
  }
}
```

### Logout
Invalidate current session.

**Endpoint**: `POST /auth/logout`

**Headers**: `Authorization: Bearer {session_token}`

**Response**:
```json
{
  "message": "Logout successful"
}
```

## Data Polling

### Trigger Manual Polling
Manually trigger data collection for all active campaigns.

**Endpoint**: `POST /api/polling/sync`

**Headers**: `Authorization: Bearer {session_token}`

**Response**:
```json
{
  "message": "Polling started",
  "timestamp": "2024-01-15T10:30:00Z",
  "campaigns_queued": 5
}
```

### Get Polling Status
Get current status of the polling service.

**Endpoint**: `GET /api/polling/status`

**Response**:
```json
{
  "status": "active",
  "last_run": "2024-01-15T10:25:00Z",
  "next_run": "2024-01-15T10:30:00Z",
  "active_campaigns": 5,
  "users_polled": 89
}
```

## Debug Endpoints

### Get Play Data
Get detailed play data for debugging.

**Endpoint**: `GET /debug-play-data/:campaignId`

**Response**:
```json
{
  "campaign": {
    "name": "Summer Playlist 2024",
    "destination_url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "summary": {
    "total_streams": 1250,
    "unique_songs": 45,
    "unique_listeners": 89
  },
  "plays": [
    {
      "attribution_id": "attr_1234567890_abcdef123",
      "attribution_date": "2024-01-15T10:30:00Z",
      "spotify_track_id": "4iV5W9uYEdYUVa79Axb7Rh",
      "track_name": "Blinding Lights",
      "artist_name": "The Weeknd",
      "album_name": "After Hours",
      "duration_ms": 200040,
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "session_date": "2024-01-15T10:25:00Z"
    }
  ],
  "play_count": 1250,
  "message": "Found 1250 plays for campaign camp_1234567890_abcdef123"
}
```

### Clear Playlist Cache
Clear cached playlist data.

**Endpoint**: `GET /debug-clear-playlist-cache`

**Response**:
```json
{
  "message": "Cleared all playlist cache",
  "playlistId": "all"
}
```

**Endpoint**: `GET /debug-clear-playlist-cache/:playlistId`

**Response**:
```json
{
  "message": "Cleared cache for playlist 37i9dQZF1DXcBWIGoYBM5M",
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M"
}
```

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `SPOTIFY_API_ERROR` | 502 | Spotify API error |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Example Error Response

```json
{
  "error": "Campaign not found",
  "message": "The requested campaign does not exist or has expired",
  "details": "Campaign ID: camp_1234567890_abcdef123",
  "code": "NOT_FOUND"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General endpoints**: 100 requests per minute
- **Analytics endpoints**: 50 requests per minute
- **Authentication endpoints**: 20 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination:

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Response Headers**:
```
X-Total-Count: 150
X-Page: 1
X-Per-Page: 20
X-Total-Pages: 8
```

**Response Body**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

## Webhooks

Webhook support for real-time notifications (coming soon):

**Campaign Events**:
- `campaign.created`
- `campaign.updated`
- `campaign.deleted`

**Analytics Events**:
- `click.recorded`
- `play.attributed`
- `metrics.updated`

---

**API Version**: 1.0  
**Last Updated**: January 2025
