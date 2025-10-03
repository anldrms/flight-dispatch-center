# Installation Guide - Flight Planner Pro

## Quick Start (5 minutes)

### Step 1: Install Node.js
Download and install Node.js from https://nodejs.org/ (v14 or higher)

### Step 2: Download Flight Planner Pro
```bash
# Option A: Clone from Git
git clone <repository-url>
cd flight-planner

# Option B: Download ZIP
# Extract the ZIP file
# Open terminal/command prompt in the extracted folder
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Start the Server
```bash
npm start
```

### Step 5: Open in Browser
Navigate to: http://localhost:3000

## Detailed Installation

### Windows

1. **Download Node.js**
   - Visit https://nodejs.org/
   - Download the Windows installer (LTS version)
   - Run the installer and follow the wizard
   - Keep all default settings

2. **Verify Installation**
   - Open Command Prompt (Win + R, type "cmd")
   - Type: `node --version`
   - Type: `npm --version`
   - Both should show version numbers

3. **Install Flight Planner Pro**
   - Extract the downloaded ZIP to a folder
   - Open Command Prompt in that folder
   - Run: `npm install`
   - Run: `npm start`

4. **Access the Application**
   - Open your browser
   - Go to: http://localhost:3000

### macOS

1. **Install Node.js**
   ```bash
   # Option A: Download from https://nodejs.org/
   
   # Option B: Using Homebrew
   brew install node
   ```

2. **Verify Installation**
   ```bash
   node --version
   npm --version
   ```

3. **Install Flight Planner Pro**
   ```bash
   cd path/to/flight-planner
   npm install
   npm start
   ```

4. **Access the Application**
   - Open Safari, Chrome, or Firefox
   - Navigate to: http://localhost:3000

### Linux (Ubuntu/Debian)

1. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Verify Installation**
   ```bash
   node --version
   npm --version
   ```

3. **Install Flight Planner Pro**
   ```bash
   cd path/to/flight-planner
   npm install
   npm start
   ```

4. **Access the Application**
   - Open your browser
   - Navigate to: http://localhost:3000

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
1. Edit `server.js`
2. Change `const PORT = 3000;` to another port (e.g., 3001)
3. Restart the server

### Cannot Find Module Errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Permission Errors (Linux/macOS)
```bash
# Fix npm permissions
sudo chown -R $USER:$GROUP ~/.npm
sudo chown -R $USER:$GROUP ~/.config
```

### Windows Firewall Blocking
1. Allow Node.js through Windows Firewall
2. Or temporarily disable firewall for testing

## Running on Different Port

Edit `server.js` and change:
```javascript
const PORT = 3000; // Change to your desired port
```

Or set environment variable:
```bash
# Windows
set PORT=8080 && npm start

# macOS/Linux
PORT=8080 npm start
```

## Accessing from Other Devices

To access from other devices on your network:

1. Find your local IP address:
   - Windows: `ipconfig`
   - macOS/Linux: `ifconfig` or `ip addr`

2. In server.js, modify the listen function:
   ```javascript
   app.listen(PORT, '0.0.0.0', () => {
       console.log(`Server running on http://0.0.0.0:${PORT}`);
   });
   ```

3. Access from other devices using: `http://YOUR-IP:3000`

## Production Deployment

For production use, consider:

1. **Use a process manager (PM2)**
   ```bash
   npm install -g pm2
   pm2 start server.js --name flight-planner
   pm2 startup
   pm2 save
   ```

2. **Use a reverse proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Enable HTTPS with Let's Encrypt**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## Support

If you encounter issues:
1. Check this installation guide
2. Review the main README.md
3. Check the console for error messages
4. Open an issue on GitHub with details

## System Requirements

- **Minimum:**
  - 2GB RAM
  - 500MB disk space
  - Any modern browser (Chrome, Firefox, Safari, Edge)

- **Recommended:**
  - 4GB+ RAM
  - 1GB disk space
  - Chrome or Firefox (latest version)
  - Stable internet connection (for weather data)
