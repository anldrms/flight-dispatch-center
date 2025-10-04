# 🚀 GitHub Deployment Guide

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `flight-dispatch-center` (or your choice)
3. Description: "Professional Flight Operations Dispatch System"
4. Public/Private: Your choice
5. **DO NOT** initialize with README (we already have one)
6. Click "Create repository"

## Step 2: Push to GitHub

```bash
cd ~/flight-planner

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/flight-dispatch-center.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy Options

### Option A: Render.com (FREE)

1. Go to https://render.com
2. Sign up with GitHub
3. New > Web Service
4. Connect your repository
5. Settings:
   - Name: flight-dispatch-center
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Port: 3000 (auto-detected)
6. Click "Create Web Service"
7. Wait ~5 minutes
8. Your app: `https://flight-dispatch-center.onrender.com`

### Option B: Railway.app (FREE $5 credit)

1. Go to https://railway.app
2. Sign up with GitHub
3. New Project > Deploy from GitHub repo
4. Select your repository
5. Railway auto-detects Node.js
6. Click "Deploy"
7. Get public URL from Settings

### Option C: Heroku (Paid)

```bash
# Install Heroku CLI first
brew install heroku/brew/heroku

# Login
heroku login

# Create app
heroku create flight-dispatch-center

# Push
git push heroku main

# Open
heroku open
```

### Option D: Vercel (FREE)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Step 4: Environment Variables (If needed)

Most deployment platforms:
```
PORT=3000
NODE_ENV=production
```

## Step 5: Custom Domain (Optional)

Once deployed, you can add custom domain:
- Render: Settings > Custom Domains
- Railway: Settings > Networking
- Vercel: Settings > Domains

## 🎉 That's it!

Your flight dispatch system is now live and accessible worldwide!

---

**Recommended:** Render.com for FREE deployment with good performance
