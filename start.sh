#!/bin/bash

# Flight Operations Dispatch Center - Startup Script
# ===================================================

echo "🛫 Starting Flight Operations Dispatch Center..."
echo ""

# Kill any existing node processes on port 3000
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
pkill -9 -f "node server.js" 2>/dev/null || true
sleep 1

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    echo "🚀 Starting with PM2 (production mode)..."
    pm2 start ecosystem.config.js
    pm2 logs flight-dispatch --lines 20
else
    # Check if nodemon is available
    if [ -f "node_modules/.bin/nodemon" ]; then
        echo "🔄 Starting with Nodemon (auto-restart)..."
        npm run dev
    else
        echo "📦 Starting with Node.js..."
        npm start
    fi
fi
