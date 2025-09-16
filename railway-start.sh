#!/bin/bash

# Railway startup script - bulletproof deployment
echo "🚀 Railway BULLETPROOF Startup Script"
echo "📊 PORT: $PORT"
echo "🗄️ DB_PATH: $DB_PATH"
echo "🌍 NODE_ENV: $NODE_ENV"

# Set Railway environment variables
export DB_PATH="/mnt/data/soundlink-lite.db"
export NODE_ENV="production"
export RAILWAY_ENVIRONMENT="production"
export PORT="8080"

echo "✅ Environment variables set"
echo "🚀 Starting bulletproof server..."

# Start the server
node server.js
