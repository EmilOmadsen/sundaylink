import express from 'express';
import crypto from 'crypto';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const router = express.Router();

// Import services with fallback
let authService: any = null;
let spotifyService: any = null;
let sessionService: any = null;
let userService: any = null; // For Spotify OAuth users

try {
  authService = require('../services/auth').default;
  spotifyService = require('../services/spotify').default;
  sessionService = require('../services/sessions').default;
  userService = require('../services/users').default;
  console.log('✅ Auth services imported successfully');
} catch (error) {
  console.error('❌ Failed to import auth services:', error);
}

// Log Spotify configuration at startup
console.log('🎵 Spotify OAuth Configuration:');
console.log(`📱 Client ID: ${process.env.SPOTIFY_CLIENT_ID ? process.env.SPOTIFY_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET'}`);
console.log(`🔗 Redirect URI: ${process.env.SPOTIFY_REDIRECT_URI || 'NOT SET'}`);
console.log(`🔐 Client Secret: ${process.env.SPOTIFY_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);

// Spotify OAuth login - redirect to Spotify authorization
router.get('/login', (req, res) => {
  console.log('🔐 GET /auth/login - Redirecting to Spotify OAuth...');
  
  // Generate random state for security
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state in session/cookie for verification
  res.cookie('oauth_state', state, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });
  
  // Store click_id if present
  const clickId = req.query.click_id || req.cookies.click_id;
  if (clickId) {
    res.cookie('click_id', clickId, { 
      httpOnly: true, 
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }
  
  // Build Spotify authorization URL
  const scopes = [
    'user-read-private',
    'user-read-email', 
    'user-read-playback-state',
    'user-read-currently-playing',
    'user-read-recently-played',
    'user-follow-read',
    'playlist-read-private'
  ].join(' ');
  
  const spotifyAuthUrl = new URL('https://accounts.spotify.com/authorize');
  spotifyAuthUrl.searchParams.set('response_type', 'code');
  spotifyAuthUrl.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID || '');
  spotifyAuthUrl.searchParams.set('scope', scopes);
  spotifyAuthUrl.searchParams.set('redirect_uri', process.env.SPOTIFY_REDIRECT_URI || '');
  spotifyAuthUrl.searchParams.set('state', state);
  
  console.log(`🚀 Redirecting to Spotify: ${spotifyAuthUrl.toString()}`);
  res.redirect(spotifyAuthUrl.toString());
});

// Spotify OAuth callback
router.get('/spotify/callback', async (req, res) => {
  console.log('🔄 GET /auth/spotify/callback - Processing OAuth callback...');
  console.log('📋 Query params:', req.query);
  
  const { code, state, error } = req.query;
  
  // Handle OAuth error
  if (error) {
    console.error('❌ Spotify OAuth error:', error);
    return res.status(400).json({
      error: 'Spotify authorization failed',
      details: error,
      message: 'Please try logging in again'
    });
  }
  
  // Verify state parameter
  const storedState = req.cookies.oauth_state;
  if (!state || state !== storedState) {
    console.error('❌ Invalid state parameter:', { received: state, expected: storedState });
    return res.status(400).json({
      error: 'Invalid state parameter',
      message: 'Security validation failed. Please try again.'
    });
  }
  
  // Exchange code for access token
  if (!code) {
    console.error('❌ No authorization code received');
    return res.status(400).json({
      error: 'No authorization code',
      message: 'Authorization code is required'
    });
  }
  
  try {
    console.log('🔄 Exchanging code for tokens...');
    
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || '',
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenResponse.status, errorData);
      return res.status(400).json({
        error: 'Token exchange failed',
        details: errorData,
        message: 'Failed to authenticate with Spotify'
      });
    }
    
    const tokens = await tokenResponse.json();
    console.log('✅ Tokens received successfully');
    
    // Get user profile from Spotify
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    if (!profileResponse.ok) {
      console.error('❌ Failed to get user profile');
      return res.status(400).json({
        error: 'Failed to get user profile',
        message: 'Could not retrieve user information from Spotify'
      });
    }
    
    const profile = await profileResponse.json();
    console.log('👤 User profile:', { id: profile.id, email: profile.email });
    
    // Register or login user
    let user = authService.getByEmail(profile.email);
    if (!user) {
      console.log('👤 Creating new user...');
      user = await authService.register({
        email: profile.email,
        password: 'spotify-oauth', // Placeholder for OAuth users
        display_name: profile.display_name
      });
    }
    
    // Connect Spotify account
    if (user) {
      await authService.connectSpotify({
        user_id: user.id,
        spotify_id: profile.id,
        access_token: tokens.access_token,
        encrypted_refresh_token: tokens.refresh_token, // This will be encrypted by the service
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000)
      });
    }
    
    // Generate JWT token
    const token = authService.generateToken(user!);
    
    // Set auth cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Clear OAuth state cookie
    res.clearCookie('oauth_state');
    
    console.log('✅ User authenticated successfully');
    
    // Redirect to dashboard
    res.redirect('/dashboard');
    
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong during authentication'
    });
  }
});

// Legacy login page (for testing/fallback)
router.get('/legacy-login', (req, res) => {
  const clickId = req.cookies.click_id;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            .container {
                text-align: center;
                background: rgba(0,0,0,0.8);
                padding: 40px;
                border-radius: 12px;
                max-width: 400px;
                width: 100%;
            }
            .form {
                margin-top: 20px;
                display: none;
            }
            .form.active {
                display: block;
            }
            .form-group {
                margin-bottom: 20px;
                text-align: left;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            input[type="email"], input[type="password"], input[type="text"] {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 16px;
                box-sizing: border-box;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
                margin-top: 10px;
                transition: background 0.2s;
            }
            .btn:hover {
                background: #5a6fd8;
            }
            .toggle {
                margin-top: 20px;
                font-size: 14px;
            }
            .toggle a {
                color: #667eea;
                cursor: pointer;
                text-decoration: underline;
                font-weight: bold;
                padding: 2px 4px;
                border-radius: 3px;
                transition: background 0.2s;
            }
            .toggle a:hover {
                background: rgba(102, 126, 234, 0.1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔗 Sundaylink</h1>
            <p>Track your music and create smart links</p>
            
            <!-- Login Form -->
            <form id="loginForm" class="form active" action="/auth/login" method="POST">
                <div class="form-group">
                    <label for="loginEmail">Email</label>
                    <input type="email" id="loginEmail" name="email" required>
                </div>
                <div class="form-group">
                    <label for="loginPassword">Password</label>
                    <input type="password" id="loginPassword" name="password" required>
                </div>
                <input type="hidden" name="click_id" value="${clickId || ''}">
                <button type="submit" class="btn">Login</button>
            </form>

            <!-- Register Form -->
            <form id="registerForm" class="form" action="/auth/register" method="POST">
                <div class="form-group">
                    <label for="registerEmail">Email</label>
                    <input type="email" id="registerEmail" name="email" required>
                </div>
                <div class="form-group">
                    <label for="registerPassword">Password</label>
                    <input type="password" id="registerPassword" name="password" required minlength="6">
                </div>
                <div class="form-group">
                    <label for="displayName">Display Name (Optional)</label>
                    <input type="text" id="displayName" name="display_name">
                </div>
                <input type="hidden" name="click_id" value="${clickId || ''}">
                <button type="submit" class="btn">Create Account</button>
            </form>

            <div class="toggle">
                <span id="toggleText">Don't have an account? <a href="/auth/register">Sign up</a></span>
            </div>
        </div>

        <script>
            let isLogin = true;
            
            function toggleForm() {
                console.log('toggleForm called, isLogin:', isLogin);
                const loginForm = document.getElementById('loginForm');
                const registerForm = document.getElementById('registerForm');
                const toggleText = document.getElementById('toggleText');
                
                if (isLogin) {
                    loginForm.classList.remove('active');
                    registerForm.classList.add('active');
                    toggleText.innerHTML = 'Already have an account? <a href="#" onclick="toggleForm(); return false;">Login</a>';
                    isLogin = false;
                } else {
                    registerForm.classList.remove('active');
                    loginForm.classList.add('active');
                    toggleText.innerHTML = 'Don\\'t have an account? <a href="#" onclick="toggleForm(); return false;">Sign up</a>';
                    isLogin = true;
                }
            }
            
            // Also add event listener when page loads
            document.addEventListener('DOMContentLoaded', function() {
                const toggleText = document.getElementById('toggleText');
                if (toggleText) {
                    toggleText.addEventListener('click', function(e) {
                        if (e.target.tagName === 'A') {
                            e.preventDefault();
                            toggleForm();
                        }
                    });
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Register page
router.get('/register', (req, res) => {
  const clickId = req.cookies.click_id;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Sign Up - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            .container {
                text-align: center;
                background: rgba(0,0,0,0.8);
                padding: 40px;
                border-radius: 12px;
                max-width: 400px;
                width: 100%;
            }
            .form-group {
                margin-bottom: 20px;
                text-align: left;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            input[type="email"], input[type="password"], input[type="text"] {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 16px;
                box-sizing: border-box;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
                margin-top: 10px;
                transition: background 0.2s;
            }
            .btn:hover {
                background: #5a6fd8;
            }
            .toggle {
                margin-top: 20px;
                font-size: 14px;
            }
            .toggle a {
                color: #667eea;
                cursor: pointer;
                text-decoration: underline;
                font-weight: bold;
                padding: 2px 4px;
                border-radius: 3px;
                transition: background 0.2s;
            }
            .toggle a:hover {
                background: rgba(102, 126, 234, 0.1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔗 Sundaylink</h1>
            <p>Create your account to track music and create smart links</p>
            
            <form action="/auth/register" method="POST">
                <div class="form-group">
                    <label for="registerEmail">Email</label>
                    <input type="email" id="registerEmail" name="email" required>
                </div>
                <div class="form-group">
                    <label for="registerPassword">Password</label>
                    <input type="password" id="registerPassword" name="password" required minlength="6">
                </div>
                <div class="form-group">
                    <label for="displayName">Display Name (Optional)</label>
                    <input type="text" id="displayName" name="display_name">
                </div>
                <input type="hidden" name="click_id" value="${clickId || ''}">
                <button type="submit" class="btn">Create Account</button>
            </form>

            <div class="toggle">
                <span>Already have an account? <a href="/auth/login">Login</a></span>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Handle login POST
router.post('/login', async (req, res) => {
  try {
    const { email, password, click_id } = req.body;

    if (!email || !password) {
      return res.status(400).send('Email and password are required');
    }

    const { user, token } = await authService.login({ email, password });

    // Set JWT token as cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // If there's a click_id (from form or cookie), create a session
    const clickIdToUse = click_id || req.cookies.click_id;
    if (clickIdToUse) {
      try {
        sessionService.create({
          click_id: clickIdToUse,
          user_id: user.id
        });
        console.log(`Created session linking user ${user.id} to click ${clickIdToUse}`);
      } catch (error) {
        console.log('Session creation failed or already exists:', error);
      }
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Login Successful - Sundaylink</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea, #764ba2);
                  color: white;
              }
              .container {
                  text-align: center;
                  background: rgba(0,0,0,0.8);
                  padding: 40px;
                  border-radius: 12px;
                  max-width: 400px;
              }
              .btn {
                  background: #667eea;
                  color: white;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 6px;
                  font-size: 16px;
                  text-decoration: none;
                  display: inline-block;
                  margin: 10px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>✅ Welcome back!</h1>
              <p>Hi ${user.display_name || user.email}, you've successfully logged in.</p>
              ${!user.is_spotify_connected ? 
                '<p><a href="/auth/spotify" class="btn">Connect Spotify</a></p>' : 
                '<p>✅ Spotify Connected</p>'
              }
              <p><a href="/dashboard" class="btn">View Dashboard</a></p>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Login error:', error);
    res.status(400).send(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Handle register POST
router.post('/register', async (req, res) => {
  try {
    const { email, password, display_name, click_id } = req.body;

    if (!email || !password) {
      return res.status(400).send('Email and password are required');
    }

    const user = await authService.register({ email, password, display_name });
    const token = authService.generateToken(user);

    // Set JWT token as cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // If there's a click_id (from form or cookie), create a session
    const clickIdToUse = click_id || req.cookies.click_id;
    if (clickIdToUse) {
      try {
        sessionService.create({
          click_id: clickIdToUse,
          user_id: user.id
        });
        console.log(`Created session linking user ${user.id} to click ${clickIdToUse}`);
      } catch (error) {
        console.log('Session creation failed or already exists:', error);
      }
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Account Created - Sundaylink</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea, #764ba2);
                  color: white;
              }
              .container {
                  text-align: center;
                  background: rgba(0,0,0,0.8);
                  padding: 40px;
                  border-radius: 12px;
                  max-width: 400px;
              }
              .btn {
                  background: #667eea;
                  color: white;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 6px;
                  font-size: 16px;
                  text-decoration: none;
                  display: inline-block;
                  margin: 10px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🎉 Welcome to Sundaylink!</h1>
              <p>Hi ${user.display_name || user.email}, your account has been created successfully.</p>
              <p>Connect your Spotify account to start tracking your music.</p>
              <p><a href="/auth/spotify" class="btn">Connect Spotify</a></p>
              <p><a href="/dashboard" class="btn">View Dashboard</a></p>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).send(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Spotify OAuth routes
router.get('/spotify', (req, res) => {
  try {
    // Get auth token from cookies
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).send('Authentication required. Please login first.');
    }

    // Verify token
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).send('Invalid or expired token. Please login again.');
    }

    // Generate auth URL with user ID as state
    const authUrl = spotifyService.getAuthUrl(decoded.userId.toString());
    res.redirect(authUrl);
  } catch (error) {
    console.error('Spotify auth error:', error);
    res.status(500).send('Failed to initialize Spotify authentication');
  }
});

router.get('/spotify/callback', async (req, res) => {
  try {
    console.log('🎵 Spotify callback received');
    console.log('📝 Full URL:', req.url);
    console.log('📝 Query params:', JSON.stringify(req.query, null, 2));
    console.log('📝 Headers:', JSON.stringify(req.headers, null, 2));
    
    const { code, state, error } = req.query;

    if (error) {
      console.log('❌ Spotify authorization error:', error);
      return res.status(400).json({
        error: 'Spotify authorization failed',
        spotify_error: error,
        message: 'User denied authorization or there was an error with Spotify',
        redirect_to: '/dashboard'
      });
    }

    if (!code) {
      console.log('❌ Missing authorization code');
      console.log('📝 Available query params:', Object.keys(req.query));
      return res.status(400).json({
        error: 'Missing authorization code',
        message: 'Spotify did not provide an authorization code',
        query_params: req.query,
        redirect_to: '/dashboard'
      });
    }

    if (!state) {
      console.log('❌ Missing state parameter');
      return res.status(400).json({
        error: 'Missing state parameter',
        message: 'Security state parameter is missing',
        redirect_to: '/dashboard'
      });
    }

    // Parse state parameter - could be either userId or campaign info
    let userId: number | undefined;
    let campaignInfo: any = null;
    
    console.log('🔍 Parsing state parameter:', state);
    
    try {
      // Try to decode base64 campaign state first
      const decodedState = Buffer.from(state as string, 'base64').toString('utf-8');
      console.log('🔍 Decoded state string:', decodedState);
      campaignInfo = JSON.parse(decodedState);
      console.log('🎯 Campaign state decoded:', campaignInfo);
      
      // For campaign flows, we need to create a new user or find existing one
      // We'll use the Spotify profile email for this
    } catch (decodeError) {
      console.log('⚠️ Could not decode campaign state, trying legacy format:', decodeError instanceof Error ? decodeError.message : decodeError);
      // Fallback: treat as userId (legacy behavior)
      try {
        userId = parseInt(state as string);
        console.log('👤 Legacy state - connecting Spotify for user ID:', userId);
      } catch (parseError) {
        console.log('❌ Could not parse state as userId either:', parseError);
        return res.status(400).json({
          error: 'Invalid state parameter',
          message: 'Could not parse state parameter',
          state_received: state,
          redirect_to: '/dashboard'
        });
      }
    }
    
    // Exchange code for tokens
    console.log('🔄 Exchanging code for tokens...');
    const tokens = await spotifyService.exchangeCodeForTokens(code as string);
    console.log('✅ Tokens received:', { access_token: 'present', refresh_token: tokens.refresh_token ? 'present' : 'missing' });
    
    // Get user profile
    console.log('👤 Getting Spotify user profile...');
    const spotifyUser = await spotifyService.getUserProfile(tokens.access_token);
    console.log('✅ Spotify user:', { id: spotifyUser.id, display_name: spotifyUser.display_name });
    
    // Encrypt refresh token
    console.log('🔐 Encrypting refresh token...');
    const encryptedRefreshToken = spotifyService.encryptAndStoreRefreshToken(tokens.refresh_token);
    console.log('✅ Refresh token encrypted');
    
    // Handle campaign flow vs legacy flow
    let finalUserId: number;
    let updatedUser: any;
    
    if (campaignInfo) {
      // Campaign flow - create or find user using Spotify user service
      console.log('🎯 Processing campaign flow...');
      
      // Check if userService is available
      if (!userService) {
        console.log('❌ User service not available, falling back to basic response');
        return res.status(500).json({
          error: 'User service unavailable',
          message: 'Cannot process Spotify authentication at this time',
          redirect_to: '/dashboard'
        });
      }
      
      // Use the Spotify user service for OAuth users
      try {
        updatedUser = userService.createOrUpdate({
          spotify_user_id: spotifyUser.id,
          email: spotifyUser.email || `${spotifyUser.id}@spotify.local`,
          display_name: spotifyUser.display_name || spotifyUser.id,
          refresh_token: tokens.refresh_token
        });
        
        finalUserId = updatedUser.id;
        console.log('✅ Spotify user created/updated:', { user_id: finalUserId, spotify_id: spotifyUser.id });
      } catch (userError) {
        console.log('❌ Failed to create/update user:', userError instanceof Error ? userError.message : userError);
        return res.status(500).json({
          error: 'Failed to create user account',
          message: 'Could not save your Spotify account information',
          redirect_to: '/dashboard'
        });
      }
      
      // Create session linking this user to the campaign click
      if (campaignInfo.clickId) {
        try {
          const session = sessionService.create({
            click_id: campaignInfo.clickId,
            user_id: finalUserId
          });
          console.log('✅ Campaign session created:', { click_id: campaignInfo.clickId, user_id: finalUserId, campaign_id: campaignInfo.campaignId });
        } catch (error) {
          console.log('⚠️ Could not create campaign session:', error instanceof Error ? error.message : error);
        }
      }
      
      // Set auth cookie for the user (create a simple JWT token)
      const jwt = require('jsonwebtoken');
      const authToken = jwt.sign(
        { 
          userId: finalUserId, 
          spotifyId: spotifyUser.id,
          email: updatedUser.email 
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );
      
      res.cookie('auth_token', authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Set Spotify cookies for quick access
      res.cookie('spotify_user_id', spotifyUser.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      console.log(`🎯 Campaign flow complete - redirecting to: ${campaignInfo.destinationUrl}`);
      return res.redirect(302, campaignInfo.destinationUrl);
      
    } else {
      // Legacy flow - existing user connecting Spotify
      if (!userId) {
        console.error('❌ No userId found for legacy flow');
        return res.status(400).send('Invalid state parameter');
      }
      
      finalUserId = userId;
      updatedUser = await authService.connectSpotify({
        user_id: finalUserId,
        spotify_id: spotifyUser.id,
        access_token: tokens.access_token,
        encrypted_refresh_token: encryptedRefreshToken,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000)
      });
      
      // Create sessions for any recent clicks (within last 48 hours)
      console.log('🔗 Creating sessions for recent clicks...');
      const clickId = req.cookies.click_id;
      if (clickId) {
        try {
          const session = sessionService.create({
            click_id: clickId,
            user_id: finalUserId
          });
          console.log('✅ Session created linking click to user:', { click_id: clickId, user_id: finalUserId });
        } catch (error) {
          console.log('⚠️ Could not create session (click may already be linked):', error instanceof Error ? error.message : error);
        }
      }
      
      // Redirect to dashboard with success message
      console.log('🎯 Redirecting to dashboard with success message');
      return res.redirect('/dashboard?spotify_connected=true');
    }
    
    console.log('✅ User updated with Spotify connection:', { user_id: updatedUser.id, email: updatedUser.email });

  } catch (error) {
    console.error('❌ Spotify callback error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Provide a user-friendly error page instead of just JSON
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Spotify Connection Error - Sundaylink</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea, #764ba2);
                  color: white;
              }
              .container {
                  text-align: center;
                  background: rgba(0,0,0,0.8);
                  padding: 40px;
                  border-radius: 12px;
                  max-width: 500px;
                  width: 100%;
              }
              .btn {
                  background: #667eea;
                  color: white;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 6px;
                  font-size: 16px;
                  text-decoration: none;
                  display: inline-block;
                  margin: 10px;
                  transition: background 0.2s;
              }
              .btn:hover {
                  background: #5a6fd8;
              }
              .error {
                  background: rgba(220, 53, 69, 0.1);
                  border: 2px solid #dc3545;
                  border-radius: 8px;
                  padding: 20px;
                  margin: 20px 0;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>❌ Spotify Connection Failed</h1>
              <div class="error">
                  <p><strong>There was an error connecting your Spotify account:</strong></p>
                  <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
              </div>
              
              <p>Don't worry! You can try again:</p>
              
              <div>
                  <a href="/debug-test-oauth" class="btn">🎵 Try Spotify OAuth Again</a>
                  <a href="/dashboard" class="btn">📊 Back to Dashboard</a>
                  <a href="/create-campaign" class="btn">➕ Create Campaign</a>
              </div>
              
              <div style="margin-top: 30px; font-size: 14px; opacity: 0.8;">
                  <p>If this problem persists, please check that:</p>
                  <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                      <li>Your Spotify app is properly configured</li>
                      <li>The redirect URI matches your Railway domain</li>
                      <li>Your Spotify credentials are valid</li>
                  </ul>
              </div>
          </div>
      </body>
      </html>
    `);
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  console.log('🚪 POST /auth/logout - Logging out user');
  
  // Clear all auth-related cookies
  res.clearCookie('auth_token');
  res.clearCookie('spotify_user_id');
  res.clearCookie('spotify_access_token');
  res.clearCookie('oauth_state');
  res.clearCookie('click_id'); // Optional: keep click tracking or clear it
  
  console.log('✅ User logged out successfully');
  
  res.json({
    message: 'Logged out successfully',
    timestamp: new Date().toISOString()
  });
});

// Logout page (GET version for direct browser access)
router.get('/logout', (req, res) => {
  console.log('🚪 GET /auth/logout - Logging out user via GET');
  
  // Clear all auth-related cookies
  res.clearCookie('auth_token');
  res.clearCookie('spotify_user_id');
  res.clearCookie('spotify_access_token');
  res.clearCookie('oauth_state');
  
  console.log('✅ User logged out successfully');
  
  // Redirect to home page or show logout confirmation
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Logged Out - Sundaylink</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            .container {
                text-align: center;
                background: rgba(0,0,0,0.8);
                padding: 40px;
                border-radius: 12px;
                max-width: 400px;
                width: 100%;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                text-decoration: none;
                display: inline-block;
                margin: 10px;
                transition: background 0.2s;
            }
            .btn:hover {
                background: #5a6fd8;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>👋 Logged Out</h1>
            <p>You have been successfully logged out of Sundaylink.</p>
            <p>Thank you for using our music analytics platform!</p>
            <a href="/dashboard" class="btn">Back to Dashboard</a>
            <a href="/create-campaign" class="btn">Create Campaign</a>
        </div>
    </body>
    </html>
  `);
});

// User data deletion endpoint (GDPR compliance)
router.delete('/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const deleted = await authService.deleteUserData(email);
    
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'All user data deleted successfully',
      email: email
    });
  } catch (error) {
    console.error('Error deleting user data:', error);
    res.status(500).json({ error: 'Failed to delete user data' });
  }
});

export default router;