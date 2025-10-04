# 🚀 Render.com Deployment Guide

## Quick Deploy (5 minutes)

### Step 1: Sign Up
1. Go to https://render.com
2. Sign up with GitHub account
3. Authorize Render to access your repositories

### Step 2: Create Web Service
1. Click "New +" → "Web Service"
2. Select repository: **anldrms/flight-dispatch-center**
3. Settings:
   ```
   Name: flight-dispatch-center
   Region: Choose closest to you
   Branch: main
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

### Step 3: Set Environment Variables
In "Environment" section, add:
```
AEROAPI_KEY = ZGJoTrYptpF11kxbI8jhLNvLk0QC50fx
NODE_ENV = production
```

### Step 4: Deploy
1. Click "Create Web Service"
2. Wait 3-5 minutes for build
3. Your app will be live at:
   ```
   https://flight-dispatch-center.onrender.com
   ```

## 🎯 Auto-Deploy
- Every push to `main` branch auto-deploys
- No manual intervention needed
- Render monitors your GitHub repo

## 🔧 Custom Domain (Optional)
1. Settings → Custom Domain
2. Add your domain
3. Update DNS records

## 💰 Free Tier Limits
- 750 hours/month (enough for 24/7)
- Spins down after 15 min of inactivity
- First request after sleep: ~30 seconds
- Upgrade to paid: Always-on, no sleep

## 🐛 Troubleshooting
- Check logs: Dashboard → Logs
- Rebuild: Manual Deploy → Deploy latest commit
- Environment vars: Environment tab

## ✅ Done!
Your flight dispatch system is now live worldwide! 🌍✈️
