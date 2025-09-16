#!/usr/bin/env node

/**
 * Spotify Setup Helper
 * This script helps you configure Spotify credentials for Sunday Link
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🎵 Sunday Link - Spotify Setup Helper\n');
console.log('This script will help you configure Spotify API credentials.\n');

console.log('📋 Steps to get Spotify credentials:');
console.log('1. Go to https://developer.spotify.com/dashboard');
console.log('2. Log in with your Spotify account');
console.log('3. Click "Create App"');
console.log('4. Fill in the app details:');
console.log('   - App name: Sunday Link (or any name you prefer)');
console.log('   - App description: Music campaign tracking platform');
console.log('5. Click "Create"');
console.log('6. Go to "Settings" tab');
console.log('7. Add redirect URI: http://localhost:3000/auth/spotify/callback');
console.log('8. Copy the Client ID and Client Secret\n');

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupSpotify() {
  try {
    const clientId = await askQuestion('Enter your Spotify Client ID: ');
    const clientSecret = await askQuestion('Enter your Spotify Client Secret: ');
    
    if (!clientId || !clientSecret) {
      console.log('❌ Both Client ID and Client Secret are required!');
      process.exit(1);
    }
    
    // Create .env file if it doesn't exist
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      // Create basic .env template
      envContent = `# Server Configuration
NODE_ENV=development
PORT=3000

# Database
DB_PATH=./db/soundlink-lite.db

# JWT Authentication
JWT_SECRET=sunday-link-jwt-secret-key-2024-change-in-production

# Encryption Key (MUST be exactly 32 characters)
ENCRYPTION_KEY=sunday-link-encryption-key-32

# Logging Configuration
LOG_LEVEL=INFO

# Spotify API Configuration
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/spotify/callback
`;
    }
    
    // Update Spotify credentials
    envContent = envContent.replace(
      /SPOTIFY_CLIENT_ID=.*/,
      `SPOTIFY_CLIENT_ID=${clientId}`
    );
    envContent = envContent.replace(
      /SPOTIFY_CLIENT_SECRET=.*/,
      `SPOTIFY_CLIENT_SECRET=${clientSecret}`
    );
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Spotify credentials configured successfully!');
    console.log('📁 Credentials saved to .env file');
    console.log('\n🚀 You can now restart your server with: npm run dev');
    console.log('🔗 Spotify login will be available at: http://localhost:3000/auth/login');
    
  } catch (error) {
    console.error('❌ Error setting up Spotify credentials:', error.message);
  } finally {
    rl.close();
  }
}

setupSpotify();
