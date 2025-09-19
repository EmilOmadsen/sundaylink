#!/usr/bin/env node

/**
 * Automated Railway Analytics Checker
 * 
 * This script will automatically check your Railway deployment and identify
 * exactly what's preventing the analytics from working.
 */

const https = require('https');

// Your Railway app URL - update this
const RAILWAY_URL = 'https://sundaylink-production.up.railway.app';

console.log('🔍 AUTOMATED RAILWAY ANALYTICS DIAGNOSTICS');
console.log('==========================================\n');

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

async function checkSystemStatus() {
  console.log('📊 Step 1: Checking system status...');
  
  try {
    const response = await makeRequest(`${RAILWAY_URL}/debug-analytics`);
    
    if (response.status !== 200) {
      console.log('❌ App is not responding properly');
      console.log(`   Status: ${response.status}`);
      console.log('   Make sure your Railway app is deployed and running');
      return false;
    }
    
    const data = response.data;
    console.log('✅ App is responding\n');
    
    // Check Spotify configuration
    console.log('🎵 Spotify Configuration:');
    console.log(`   Client ID: ${data.spotify_config.client_id}`);
    console.log(`   Client Secret: ${data.spotify_config.client_secret}`);
    console.log(`   Redirect URI: ${data.spotify_config.redirect_uri}`);
    
    const spotifyConfigured = data.spotify_config.client_id !== 'NOT_SET' && 
                             data.spotify_config.client_secret === 'SET' &&
                             data.spotify_config.redirect_uri !== 'NOT_SET';
    
    if (!spotifyConfigured) {
      console.log('❌ SPOTIFY NOT CONFIGURED!');
      console.log('\n🔧 REQUIRED FIXES:');
      console.log('   1. Go to Railway project dashboard');
      console.log('   2. Click your service → Variables tab');
      console.log('   3. Add these environment variables:');
      console.log(`      SPOTIFY_CLIENT_ID=your_client_id`);
      console.log(`      SPOTIFY_CLIENT_SECRET=your_client_secret`);
      console.log(`      SPOTIFY_REDIRECT_URI=${RAILWAY_URL}/auth/spotify/callback`);
      console.log('\n   Get credentials from: https://developer.spotify.com/dashboard');
      return false;
    } else {
      console.log('✅ Spotify credentials are configured\n');
    }
    
    // Check database
    console.log('💾 Database Status:');
    console.log(`   Database exists: ${data.database_config.exists}`);
    console.log(`   Path: ${data.database_config.path}`);
    
    if (!data.database_config.exists) {
      console.log('❌ Database connection failed');
      return false;
    } else {
      console.log('✅ Database is connected\n');
    }
    
    // Check services
    console.log('⚙️ Service Status:');
    console.log(`   Polling service: ${data.services_status.polling_service}`);
    
    if (data.services_status.polling_service !== 'RUNNING') {
      console.log('❌ Polling service is not running - this is critical!');
      return false;
    } else {
      console.log('✅ Polling service is running\n');
    }
    
    // Check data counts
    console.log('📈 Data Analysis:');
    console.log(`   Campaigns: ${data.database_stats.campaigns_count}`);
    console.log(`   Clicks: ${data.database_stats.clicks_count}`);
    console.log(`   Users: ${data.database_stats.users_count}`);
    console.log(`   Plays: ${data.database_stats.plays_count}`);
    console.log(`   Attributions: ${data.database_stats.attributions_count}`);
    
    // Analyze the problem
    console.log('\n🔍 PROBLEM ANALYSIS:');
    
    if (data.database_stats.clicks_count > 0 && data.database_stats.users_count === 0) {
      console.log('❌ ISSUE FOUND: People are clicking links but not authenticating with Spotify');
      console.log('   → Users click tracker links (✅ working)');
      console.log('   → But they don\'t complete Spotify OAuth (❌ broken)');
      console.log('\n💡 LIKELY CAUSES:');
      console.log('   1. Spotify OAuth redirect URI mismatch');
      console.log('   2. Spotify app not configured properly');
      console.log('   3. OAuth flow is broken or confusing');
      return 'oauth_broken';
    }
    
    if (data.database_stats.users_count > 0 && data.database_stats.plays_count === 0) {
      console.log('❌ ISSUE FOUND: Users authenticate but no play data is collected');
      console.log('   → Users complete Spotify OAuth (✅ working)');
      console.log('   → But polling service doesn\'t collect play data (❌ broken)');
      console.log('\n💡 LIKELY CAUSES:');
      console.log('   1. Spotify API credentials invalid');
      console.log('   2. Refresh token encryption issues');
      console.log('   3. Polling service errors');
      return 'polling_broken';
    }
    
    if (data.database_stats.plays_count > 0 && data.database_stats.attributions_count === 0) {
      console.log('❌ ISSUE FOUND: Play data collected but not attributed to campaigns');
      console.log('   → Play data is collected (✅ working)');
      console.log('   → But attribution system isn\'t linking plays to campaigns (❌ broken)');
      return 'attribution_broken';
    }
    
    if (data.database_stats.clicks_count === 0) {
      console.log('❌ ISSUE FOUND: No clicks recorded');
      console.log('   → Basic click tracking is broken');
      return 'clicks_broken';
    }
    
    if (data.database_stats.attributions_count > 0) {
      console.log('✅ SYSTEM APPEARS TO BE WORKING!');
      console.log('   → All components are functional');
      console.log('   → Data should appear in dashboard shortly');
      return 'working';
    }
    
    console.log('⚠️ UNCLEAR ISSUE - Need more investigation');
    return 'unclear';
    
  } catch (error) {
    console.log('❌ Failed to check system status');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testOAuthFlow() {
  console.log('\n🧪 Step 2: Testing OAuth flow...');
  
  try {
    // Create a test campaign first
    const createResponse = await makeRequest(`${RAILWAY_URL}/debug-create-test-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (createResponse.status !== 200) {
      console.log('❌ Failed to create test campaign');
      return false;
    }
    
    const campaign = createResponse.data.campaign;
    console.log(`✅ Test campaign created: ${campaign.name}`);
    console.log(`🔗 Test link: ${campaign.smart_link_url}`);
    
    // Check the campaign details
    const debugResponse = await makeRequest(`${RAILWAY_URL}/debug-spotify-flow/${campaign.id}`);
    
    if (debugResponse.status !== 200) {
      console.log('❌ Failed to debug campaign flow');
      return false;
    }
    
    const debug = debugResponse.data;
    
    console.log('\n📋 Campaign Analysis:');
    console.log(`   Campaign found: ${debug.campaign_check.found}`);
    console.log(`   Has Spotify track: ${!!debug.campaign_check.campaign_details?.spotify_track_id}`);
    console.log(`   Campaign clicks: ${debug.campaign_check.campaign_details?.clicks || 0}`);
    
    console.log('\n🔗 OAuth URL Analysis:');
    console.log(`   Generated auth URL: ${debug.auth_url ? 'YES' : 'NO'}`);
    if (debug.auth_url) {
      console.log(`   Auth URL: ${debug.auth_url.substring(0, 100)}...`);
    }
    
    console.log('\n👥 User Analysis:');
    console.log(`   Total users in database: ${debug.database_users.total_users}`);
    console.log(`   Campaign clicks recorded: ${debug.database_users.campaign_clicks}`);
    
    return true;
    
  } catch (error) {
    console.log('❌ OAuth flow test failed');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function triggerPolling() {
  console.log('\n🔄 Step 3: Testing polling service...');
  
  try {
    const response = await makeRequest(`${RAILWAY_URL}/debug-trigger-polling`);
    
    if (response.status !== 200) {
      console.log('❌ Failed to trigger polling');
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return false;
    }
    
    console.log('✅ Polling triggered successfully');
    console.log(`   Status: ${response.data.message}`);
    return true;
    
  } catch (error) {
    console.log('❌ Polling test failed');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    const systemStatus = await checkSystemStatus();
    
    if (systemStatus === false) {
      console.log('\n🚨 CRITICAL SYSTEM ISSUES FOUND');
      console.log('   Fix the issues above before proceeding');
      return;
    }
    
    if (systemStatus === 'working') {
      console.log('\n🎉 SYSTEM IS WORKING!');
      console.log('   Check your dashboard - analytics should be appearing');
      return;
    }
    
    await testOAuthFlow();
    await triggerPolling();
    
    console.log('\n📋 NEXT STEPS:');
    
    if (systemStatus === 'oauth_broken') {
      console.log('🔧 Fix OAuth Issues:');
      console.log('   1. Verify Spotify app redirect URI matches Railway URL');
      console.log('   2. Test the OAuth flow manually');
      console.log(`   3. Visit: ${RAILWAY_URL}/debug-test-oauth`);
      console.log('   4. Click through the Spotify authentication');
    } else if (systemStatus === 'polling_broken') {
      console.log('🔧 Fix Polling Issues:');
      console.log('   1. Check Railway logs for polling errors');
      console.log('   2. Verify Spotify API credentials are valid');
      console.log('   3. Test manual polling trigger');
    } else {
      console.log('🔧 General Debugging:');
      console.log(`   1. Check detailed diagnostics: ${RAILWAY_URL}/debug-analytics`);
      console.log(`   2. Test OAuth flow: ${RAILWAY_URL}/debug-test-oauth`);
      console.log('   3. Monitor Railway logs for errors');
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log(`   Railway URL: ${RAILWAY_URL}`);
    console.log(`   System Status: ${systemStatus}`);
    console.log('   Next: Fix the identified issues and test again');
    
  } catch (error) {
    console.error('❌ Diagnostic script failed:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
