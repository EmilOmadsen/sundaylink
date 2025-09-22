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
    
    // Auto-generate redirect URI if not set, or ensure it has proper protocol
    this.redirectUri = this.buildRedirectUri();
    
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn('⚠️ Spotify credentials not fully configured. Some features may not work.');
      console.warn('📝 Please set the following environment variables:');
      console.warn('   - SPOTIFY_CLIENT_ID');
      console.warn('   - SPOTIFY_CLIENT_SECRET');
      console.warn('   - SPOTIFY_REDIRECT_URI (optional - will auto-generate)');
      console.warn('🔗 Get credentials from: https://developer.spotify.com/dashboard');
    }
    
    console.log('🎵 Spotify Service initialized:', {
      client_id: this.clientId ? `${this.clientId.substring(0, 8)}...` : 'NOT_SET',
      client_secret: this.clientSecret ? 'SET' : 'NOT_SET',
      redirect_uri: this.redirectUri
    });
  }
  
  private buildRedirectUri(): string {
    // If explicitly set, use it (but ensure it has protocol)
    if (process.env.SPOTIFY_REDIRECT_URI) {
      const uri = process.env.SPOTIFY_REDIRECT_URI;
      // Add https:// if missing protocol
      if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
        return `https://${uri}`;
      }
      return uri;
    }
    
    // Auto-generate based on environment
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
    
    if (isProduction) {
      // For Railway production, use the Railway domain
      const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || 'sundaylink-production.up.railway.app';
      return `https://${railwayDomain}/auth/spotify/callback`;
    } else {
      // For local development
      const port = process.env.PORT || '3000';
      return `http://localhost:${port}/auth/spotify/callback`;
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
      console.log('🔧 Token exchange request details:', {
        code_length: code.length,
        code_preview: code.substring(0, 10) + '...',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        has_client_secret: !!this.clientSecret,
        timestamp: new Date().toISOString()
      });

      // Validate credentials before making request
      if (!this.clientId || !this.clientSecret || !this.redirectUri) {
        throw new Error('Spotify credentials not properly configured. Please check your environment variables.');
      }

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
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Soundlink-App/1.0'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('✅ Token exchange successful:', {
        access_token_length: response.data.access_token?.length || 0,
        refresh_token_length: response.data.refresh_token?.length || 0,
        expires_in: response.data.expires_in,
        scope: response.data.scope
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error);
      
      // Enhanced error logging with more details
      if (axios.isAxiosError(error)) {
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          code: error.code,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            timeout: error.config?.timeout
          }
        };
        
        console.error('❌ Axios error details:', errorDetails);
        
        // Provide more specific error messages
        if (error.response?.status === 400) {
          const errorData = error.response?.data;
          console.error('❌ 400 Error Data:', errorData);
          
          if (errorData?.error === 'invalid_grant') {
            throw new Error(`Authorization code expired or invalid. This usually happens when:
1. The code has already been used (Spotify codes can only be used once)
2. The code has expired (Spotify codes expire in ~10 minutes)
3. There's a redirect URI mismatch between your app and Spotify dashboard
Please try the OAuth flow again from the beginning.`);
          } else if (errorData?.error === 'invalid_request') {
            throw new Error(`Invalid request: ${errorData?.error_description || 'Check your client credentials and redirect URI'}`);
          }
          throw new Error(`Bad request: ${errorData?.error_description || errorData?.error || 'Invalid authorization code'}`);
        } else if (error.response?.status === 401) {
          throw new Error(`Unauthorized: ${error.response?.data?.error_description || 'Invalid client credentials - check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET'}`);
        } else if (error.response?.status === 403) {
          throw new Error(`Forbidden: ${error.response?.data?.error_description || 'Access denied - check your Spotify app permissions'}`);
        }
      }
      
      throw new Error(`Failed to exchange authorization code: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async getPlaylistTracks(playlistId: string, accessToken: string): Promise<string[]> {
    try {
      console.log(`🎵 Fetching tracks for playlist: ${playlistId}`);
      
      const tracks: string[] = [];
      let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
      
      while (url) {
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        // Extract track IDs from the response
        const playlistTracks = response.data.items
          .filter((item: any) => item.track && item.track.id)
          .map((item: any) => item.track.id);
        
        tracks.push(...playlistTracks);
        
        // Check if there are more pages
        url = response.data.next;
        
        if (tracks.length > 1000) {
          console.log('⚠️ Playlist has more than 1000 tracks, limiting to first 1000');
          break;
        }
      }
      
      console.log(`✅ Found ${tracks.length} tracks in playlist ${playlistId}`);
      return tracks;
    } catch (error) {
      console.error(`❌ Error fetching playlist tracks for ${playlistId}:`, error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Playlist ${playlistId} not found or not accessible`);
        } else if (error.response?.status === 401) {
          throw new Error('Invalid access token for playlist access');
        }
      }
      throw new Error(`Failed to fetch playlist tracks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new SpotifyService();