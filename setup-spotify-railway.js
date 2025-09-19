#!/usr/bin/env node

/**
 * Spotify Analytics Setup Script for Railway
 * 
 * This script helps configure your Soundlink app with proper Spotify credentials
 * and tests the complete analytics flow.
 */

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🎵 SOUNDLINK SPOTIFY ANALYTICS SETUP');
console.log('=====================================\n');

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function main() {
  try {
    console.log('Step 1: Get your Railway app URL');
    const railwayUrl = await question('Enter your Railway app URL (e.g., https://your-app.up.railway.app): ');
    
    if (!railwayUrl.startsWith('https://')) {
      console.log('❌ Please provide a valid HTTPS URL');
      process.exit(1);
    }
    
    console.log('\nStep 2: Check current system status...');
    
    try {
      const diagnostics = await makeRequest(`${railwayUrl}/debug-analytics`);
      
      if (diagnostics.status === 200) {
        console.log('✅ App is responding');
        console.log('\n📊 Current Status:');
        console.log(`- Spotify Client ID: ${diagnostics.data.spotify_config.client_id}`);
        console.log(`- Spotify Client Secret: ${diagnostics.data.spotify_config.client_secret}`);
        console.log(`- Spotify Redirect URI: ${diagnostics.data.spotify_config.redirect_uri}`);
        console.log(`- Database exists: ${diagnostics.data.database_config.exists}`);
        console.log(`- Polling service: ${diagnostics.data.services_status.polling_service}`);
        console.log('\n📈 Data Counts:');
        console.log(`- Campaigns: ${diagnostics.data.database_stats.campaigns_count}`);
        console.log(`- Clicks: ${diagnostics.data.database_stats.clicks_count}`);
        console.log(`- Users: ${diagnostics.data.database_stats.users_count}`);
        console.log(`- Plays: ${diagnostics.data.database_stats.plays_count}`);
        console.log(`- Attributions: ${diagnostics.data.database_stats.attributions_count}`);
        
        // Check if Spotify is properly configured
        const spotifyConfigured = diagnostics.data.spotify_config.client_id !== 'NOT_SET' && 
                                 diagnostics.data.spotify_config.client_secret === 'SET' &&
                                 diagnostics.data.spotify_config.redirect_uri !== 'NOT_SET';
        
        if (!spotifyConfigured) {
          console.log('\n❌ SPOTIFY NOT CONFIGURED');
          console.log('\nYou need to set these environment variables in Railway:');
          console.log('1. SPOTIFY_CLIENT_ID=your_spotify_client_id');
          console.log('2. SPOTIFY_CLIENT_SECRET=your_spotify_client_secret');
          console.log(`3. SPOTIFY_REDIRECT_URI=${railwayUrl}/auth/spotify/callback`);
          console.log('\nGet these credentials from: https://developer.spotify.com/dashboard');
          
          const configure = await question('\nWould you like help getting these credentials? (y/n): ');
          if (configure.toLowerCase() === 'y') {
            console.log('\n🔧 SPOTIFY SETUP INSTRUCTIONS:');
            console.log('1. Go to https://developer.spotify.com/dashboard');
            console.log('2. Log in with your Spotify account');
            console.log('3. Click "Create App"');
            console.log('4. Fill in app details:');
            console.log('   - App name: Soundlink Analytics');
            console.log('   - App description: Music marketing analytics platform');
            console.log('   - Website: Your website or ' + railwayUrl);
            console.log(`   - Redirect URI: ${railwayUrl}/auth/spotify/callback`);
            console.log('5. Accept terms and create app');
            console.log('6. Copy Client ID and Client Secret');
            console.log('7. Add them to Railway environment variables');
            console.log('\n🚂 RAILWAY ENVIRONMENT SETUP:');
            console.log('1. Go to your Railway project dashboard');
            console.log('2. Click on your service');
            console.log('3. Go to "Variables" tab');
            console.log('4. Add these variables:');
            console.log('   SPOTIFY_CLIENT_ID=your_client_id_here');
            console.log('   SPOTIFY_CLIENT_SECRET=your_client_secret_here');
            console.log(`   SPOTIFY_REDIRECT_URI=${railwayUrl}/auth/spotify/callback`);
            console.log('5. Deploy your app');
          }
        } else {
          console.log('\n✅ SPOTIFY CONFIGURED CORRECTLY');
          
          // Test creating a campaign
          console.log('\nStep 3: Testing campaign creation...');
          const createTest = await makeRequest(`${railwayUrl}/debug-create-test-campaign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (createTest.status === 200) {
            console.log('✅ Test campaign created successfully');
            console.log(`🔗 Test link: ${createTest.data.test_link}`);
            console.log('\n🧪 TESTING INSTRUCTIONS:');
            console.log('1. Click the test link above');
            console.log('2. You should be redirected to Spotify OAuth');
            console.log('3. Authorize the app');
            console.log('4. Listen to the track on Spotify');
            console.log('5. Wait 5-10 minutes');
            console.log('6. Check your dashboard for analytics data');
            console.log('\n📊 Monitor progress:');
            console.log(`- Analytics: ${railwayUrl}/debug-analytics`);
            console.log(`- Dashboard: ${railwayUrl}/dashboard`);
          } else {
            console.log('❌ Failed to create test campaign');
            console.log('Response:', createTest.data);
          }
        }
      } else {
        console.log('❌ App is not responding properly');
        console.log('Status:', diagnostics.status);
        console.log('Response:', diagnostics.data);
      }
    } catch (error) {
      console.log('❌ Failed to connect to your app');
      console.log('Error:', error.message);
      console.log('\nMake sure your Railway app is deployed and accessible');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
