# 🚀 Quick Start Guide - Flight Planner Pro

## Get Started in 60 Seconds!

### 1. Start the Server
```bash
cd ~/flight-planner
npm start
```

### 2. Open Your Browser
Navigate to: **http://localhost:3000**

### 3. Plan Your First Flight

**Example: New York to London**

1. **Select Simulator**: "Microsoft Flight Simulator 2020"
2. **Departure**: `KJFK` (JFK International)
3. **Arrival**: `EGLL` (London Heathrow)
4. **Aircraft Category**: `Boeing`
5. **Aircraft**: `Boeing 787-9 Dreamliner`
6. **Click "Calculate Route"**

That's it! 🎉

---

## 🎯 Popular Routes to Try

### Transatlantic
- `KJFK → EGLL` (New York to London) - 3,000 NM
- `KLAX → LFPG` (Los Angeles to Paris) - 5,500 NM

### European
- `EDDF → LFPG` (Frankfurt to Paris) - 250 NM
- `EGLL → LTFM` (London to Istanbul) - 1,500 NM

### Middle East
- `OMDB → LTFM` (Dubai to Istanbul) - 1,800 NM
- `OMDB → KJFK` (Dubai to New York) - 6,800 NM

---

## 💡 Pro Tips

### Aircraft Selection
- **Short (< 500nm)**: A320/737
- **Medium (500-2500nm)**: 787/A350
- **Long (> 2500nm)**: 777/A380

### Altitude
- **< 500nm**: FL280-FL330
- **500-1500nm**: FL330-FL370
- **> 1500nm**: FL370-FL430

### Weather
- Always check METAR before takeoff
- Look for winds and visibility
- Plan alternates if needed

---

## 🛠️ Troubleshooting

### Server Won't Start?
```bash
npm install  # Reinstall dependencies
npm start    # Try again
```

### Can't Connect?
- Check server is running
- Try: http://127.0.0.1:3000
- Clear browser cache

---

## 📱 Access from Mobile

1. Find your computer's IP:
   ```bash
   ifconfig | grep "inet "  # macOS/Linux
   ipconfig                 # Windows
   ```

2. On mobile, open: `http://YOUR-IP:3000`

---

## 🎓 Learn More

- **README.md** - Full documentation
- **FEATURES.md** - All features
- **INSTALLATION.md** - Setup guide

---

**Ready to Fly? ✈️**

Open http://localhost:3000 and start planning your first flight!
