# 🚀 Flight Dispatch Center - Startup Guide

## Quick Start Commands

### Development Mode (Auto-Restart) ✅ RECOMMENDED
```bash
npm run dev
# veya
nodemon server.js
```
**✨ Özellikler:**
- ✅ Dosya değişikliklerinde otomatik restart
- ✅ server.js, HTML, CSS, JS değişikliklerini izler
- ✅ Development için ideal
- ⚡ Hızlı geliştirme döngüsü

---

### Production Mode
```bash
npm start
# veya
node server.js
```
**📊 Özellikler:**
- Production ortamı için
- Manuel restart gerekli
- Daha hafif resource kullanımı

---

### PM2 ile Production (Advanced) 🔥

#### Install PM2 (one time)
```bash
npm install -g pm2
```

#### Start with PM2
```bash
npm run pm2:start
```

#### PM2 Commands
```bash
npm run pm2:status    # Durumu kontrol et
npm run pm2:logs      # Logları görüntüle
npm run pm2:restart   # Restart
npm run pm2:stop      # Durdur
npm run pm2:delete    # PM2'den kaldır
```

**🚀 PM2 Avantajları:**
- ✅ Otomatik restart on crash
- ✅ Load balancing (multiple instances)
- ✅ Log management
- ✅ Process monitoring
- ✅ Startup script (boot time)

#### PM2 Startup on Boot
```bash
pm2 startup
pm2 save
```

---

## Server Management Commands

### Stop Server
```bash
npm run stop
```

### Restart Server (Kill + Start Dev)
```bash
npm run restart
```

### Quick Start (Auto-detect best method)
```bash
npm run quick
# veya
./start.sh
```

---

## Development Workflow

### 1. İlk Kurulum
```bash
cd ~/flight-planner
npm install
```

### 2. Development Başlat
```bash
npm run dev
```

### 3. Kod Değiştir
- `server.js` - Backend değişiklikleri
- `public/app.js` - Frontend JavaScript
- `public/style.css` - Styling
- `public/index.html` - HTML structure

**Nodemon otomatik olarak restart yapar!** ✨

### 4. Test Et
- Browser: http://localhost:3000
- Console: F12 (debug logs)
- Server logs: Terminal'de görünür

---

## File Watching

Nodemon şu dosyaları izler:
- ✅ `server.js`
- ✅ `public/**/*.js`
- ✅ `public/**/*.html`
- ✅ `public/**/*.css`

Ignore edilen:
- ❌ `node_modules/`
- ❌ `data/`
- ❌ `backup/`
- ❌ `.git/`

---

## Troubleshooting

### Server başlamıyor
```bash
# Port 3000'i kontrol et
lsof -ti:3000

# Port'u temizle
npm run stop

# Tekrar başlat
npm run dev
```

### Nodemon çalışmıyor
```bash
# Global install
npm install -g nodemon

# veya npx kullan
npx nodemon server.js
```

### Changes algılanmıyor
```bash
# Nodemon config kontrol
cat nodemon.json

# Manuel restart (nodemon içinde)
rs
```

---

## Port Configuration

Default port: **3000**

Değiştirmek için:
```javascript
// server.js
const PORT = 3000; // Bu satırı değiştir
```

veya environment variable:
```bash
PORT=8080 npm run dev
```

---

## Logs

### Development Logs
Terminal'de görünür (stdout)

### PM2 Logs
```bash
pm2 logs flight-dispatch
pm2 logs flight-dispatch --lines 100
pm2 logs flight-dispatch --err  # Sadece errors
```

Log dosyaları:
- `logs/out.log` - Standard output
- `logs/err.log` - Errors
- `logs/combined.log` - Combined

---

## Performance Tips

### Development
- ✅ `npm run dev` kullan
- ✅ Browser DevTools aç
- ✅ React DevTools (eğer kullanılıyorsa)

### Production
- ✅ `pm2` kullan
- ✅ Load balancing için multiple instances
- ✅ Memory limit: 1GB (ecosystem.config.js)
- ✅ Automatic restart on crash

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | ⚡ Development (auto-restart) |
| `npm start` | 📦 Production (manual) |
| `npm run restart` | 🔄 Kill + Restart dev |
| `npm run stop` | ⛔ Stop server |
| `npm run quick` | 🚀 Smart start |
| `npm run pm2:start` | 🔥 PM2 production |
| `npm run pm2:logs` | 📋 View PM2 logs |

---

## Current Status

✅ **Nodemon installed and configured**  
✅ **Auto-restart enabled**  
✅ **PM2 config ready**  
✅ **Smart startup script created**  

**Server is running with auto-restart!** 🎉

Access: **http://localhost:3000**

---

*Last updated: $(date)*
