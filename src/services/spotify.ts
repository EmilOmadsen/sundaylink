import axios from 'axios';
import { encryptRefreshToken, decryptRefreshToken } from '../utils/encryption';

export interface SpotifyUser {
  id: string;
  email?: string;
  display_name?: string;
}

export interface SpotifyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface SpotifyRecentlyPlayed {
  items: {
    track: {
      id: string;
      name: string;
      artists: Array<{
        id: string;
        name: string;
      }>;
    };
    played_at: string;
  }[];
}

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';
    
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn('⚠️ Spotify credentials not fully configured. Some features may not work.');
      console.warn('📝 Please set the following environment variables:');
      console.warn('   - SPOTIFY_CLIENT_ID');
      console.warn('   - SPOTIFY_CLIENT_SECRET');
      console.warn('   - SPOTIFY_REDIRECT_URI');
      console.warn('🔗 Get credentials from: https://developer.spotify.com/dashboard');
    }
  }


  getAuthUrl(state?: string): string {
    const scopes = [
      'user-read-recently-played',
      'user-read-email'
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: scopes,
      redirect_uri: this.redirectUri,
      show_dialog: 'true', // Force manual login each time
      ...(state && { state })
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  async refreshAccessToken(encryptedRefreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    try {
      // Check if credentials are configured
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Spotify credentials not configured. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
      }

      const refreshToken = decryptRefreshToken(encryptedRefreshToken);
      
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in
      };
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        console.error('Spotify API Error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          clientId: this.clientId ? `${this.clientId.substring(0, 8)}...` : 'NOT_SET',
          hasClientSecret: !!this.clientSecret
        });
        
        if (error.response.data?.error === 'invalid_client') {
          throw new Error('Invalid Spotify client credentials. Please check your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
        }
      } else {
        console.error('Network error refreshing access token:', error.message);
      }
      
      throw new Error('Failed to refresh access token');
    }
  }

  async getUserProfile(accessToken: string): Promise<SpotifyUser> {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return {
        id: response.data.id,
        email: response.data.email,
        display_name: response.data.display_name
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  async getRecentlyPlayed(accessToken: string, limit: number = 50): Promise<SpotifyRecentlyPlayed> {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          limit: Math.min(limit, 50) // Spotify API limit
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching recently played:', error);
      throw new Error('Failed to fetch recently played tracks');
    }
  }

  encryptAndStoreRefreshToken(refreshToken: string): string {
    return encryptRefreshToken(refreshToken);
  }

  async getArtistFollowers(accessToken: string, artistId: string): Promise<number> {
    try {
      const response = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.followers.total;
    } catch (error) {
      console.error('Error fetching artist followers:', error);
      throw new Error('Failed to fetch artist followers');
    }
  }

  async getPlaylistFollowers(accessToken: string, playlistId: string): Promise<number> {
    try {
      const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.followers.total;
    } catch (error) {
      console.error('Error fetching playlist followers:', error);
      throw new Error('Failed to fetch playlist followers');
    }
  }

  // Obtain an app-only access token using Client Credentials flow
  async getClientCredentialsAccessToken(): Promise<{ access_token: string; expires_in: number }> {
    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        access_token: response.data.access_token,
        expires_in: response.data.expires_in
      };
    } catch (error) {
      console.error('Error fetching client credentials token:', error);
      throw new Error('Failed to get client credentials access token');
    }
  }
}

export default new SpotifyService();