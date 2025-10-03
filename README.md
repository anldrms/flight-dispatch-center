# ✈️ Flight Planner Pro

A comprehensive, professional flight planning tool for all major flight simulators. Plan your flights with real-time weather, interactive maps, detailed aircraft data, and PDF export capabilities.

## 🎮 Supported Simulators

- **Microsoft Flight Simulator 2020** (MSFS 2020)
- **X-Plane 12**
- **X-Plane 11**
- **Prepar3D v5/v6**
- **FSX** (Flight Simulator X)
- **DCS World**
- **PMDG Boeing & Airbus Series**
- **FlyByWire A32NX**
- **iniBuilds**

## ✨ Features

### 🗺️ Route Planning
- Calculate great circle routes between any airports
- Automatic waypoint generation
- Distance and bearing calculations
- Flight time estimates
- Fuel consumption calculations

### 🛩️ Aircraft Database
Extensive aircraft database including:
- **Boeing Family**: 737-800/900, 737 MAX, 747-8, 777-300ER, 787 Dreamliner series
- **Airbus Family**: A320/A321 (neo), A330 series, A350 series, A380-800
- **Regional Jets**: CRJ-900, Embraer E170/E190/E195, Q400
- **Cargo Aircraft**: 747F, MD-11F, 767F
- **General Aviation**: Cessna 172/208, Pilatus PC-12, TBM 930

Each aircraft includes:
- Cruise speed
- Fuel burn rates
- Maximum altitude
- Compatible simulators

### 🌤️ Real-Time Weather
- Live METAR reports for departure and arrival airports
- TAF (Terminal Aerodrome Forecast) data
- Decoded weather information
- Weather sourced from Aviation Weather Center

### 🗺️ Interactive Map
- High-quality OpenStreetMap integration
- Route visualization with waypoints
- Departure and arrival airport markers
- Automatic map bounds adjustment
- Scale and distance measurements

### 📊 Flight Brief
Comprehensive flight briefing including:
- Route information
- Flight profile (climb, cruise, descent)
- Fuel planning with reserves
- Top of climb/descent calculations
- Cardinal direction headings

### 📄 Export Capabilities
- **PDF Export**: Professional flight plan documents
- **Copy Route**: Quick route string for FMC/MCDU entry
- Includes all flight details, weather, and waypoints

### 📍 Airport Charts
Direct links to:
- ChartFox
- SkyVector
- AirNav

### 📚 Quick Reference
Built-in quick reference for:
- Common cruise altitudes
- Standard climb/descent rates
- Flight planning tips

## 🚀 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup

1. Clone or download this repository:
```bash
git clone <repository-url>
cd flight-planner
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## 📖 Usage

### Basic Flight Planning

1. **Select Simulator Platform**
   - Choose your primary flight simulator from the dropdown

2. **Enter Airports**
   - Input 4-letter ICAO codes for departure and arrival
   - Examples: KJFK, EGLL, LFPG, EDDF, LTFM, OMDB

3. **Choose Aircraft**
   - Select aircraft category (Boeing, Airbus, Regional, etc.)
   - Pick specific aircraft model
   - Cruise parameters auto-populate

4. **Adjust Parameters** (optional)
   - Cruise altitude (feet)
   - Cruise speed (knots)

5. **Calculate Route**
   - Click "Calculate Route" button
   - View route on interactive map
   - Review flight brief and weather

6. **Export or Copy**
   - Export complete flight plan to PDF
   - Copy route string for FMC entry

### Example Routes

**Transatlantic**
```
KJFK → EGLL (New York to London)
Aircraft: Boeing 787-9
Altitude: FL390
```

**European Short Haul**
```
EDDF → LFPG (Frankfurt to Paris)
Aircraft: Airbus A320neo
Altitude: FL350
```

**Long Haul**
```
OMDB → KLAX (Dubai to Los Angeles)
Aircraft: Airbus A380-800
Altitude: FL410
```

## 🛠️ Technical Details

### Backend (Node.js/Express)
- RESTful API architecture
- Real-time weather data integration
- Great circle distance calculations
- PDF generation with PDFKit
- Airport database

### Frontend (HTML/CSS/JavaScript)
- Responsive design
- Leaflet.js for mapping
- Modern UI with Font Awesome icons
- Real-time form validation
- Async data loading

### APIs Used
- Aviation Weather Center (METAR/TAF)
- OurAirports (Airport data)
- OpenStreetMap (Mapping)

## 📋 API Endpoints

### Weather
- `GET /api/weather/metar/:icao` - Get METAR for airport
- `GET /api/weather/taf/:icao` - Get TAF for airport

### Airports
- `GET /api/airports/search/:query` - Search airports
- `GET /api/airports/:icao` - Get airport details

### Route Planning
- `POST /api/route/calculate` - Calculate flight route
- `POST /api/route/pdf` - Generate PDF flight plan

### Aircraft
- `GET /api/aircraft` - Get aircraft database

## 🎨 Customization

### Adding New Aircraft
Edit `server.js` and add to the aircraft database:
```javascript
{
  icao: 'B738',
  name: 'Boeing 737-800',
  cruiseSpeed: 450,
  fuelBurn: 5000,
  maxAltitude: 41000,
  simulator: ['MSFS2020', 'X-Plane 12', 'PMDG']
}
```

### Modifying Colors
Edit `style.css` and adjust CSS variables:
```css
:root {
  --primary-color: #2563eb;
  --secondary-color: #1e40af;
  /* ... more colors */
}
```

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Add more aircraft
- Improve route calculations
- Enhance UI/UX
- Fix bugs
- Add new features

## 📝 License

MIT License - Feel free to use for personal or commercial flight simulation purposes.

## ⚠️ Disclaimer

**FOR FLIGHT SIMULATION USE ONLY**

This tool is designed for flight simulation purposes only. Do not use for real-world flight planning or navigation. Always use official sources and approved methods for actual flight operations.

## 🆘 Support

For issues, questions, or feature requests:
1. Check the built-in help (click "Help" in the footer)
2. Review this README
3. Open an issue on GitHub

## 🙏 Acknowledgments

- Aviation Weather Center for weather data
- OpenStreetMap contributors
- All flight simulator developers and communities
- PMDG, FlyByWire, and other aircraft developers

## �� Future Enhancements

- [ ] NOTAM integration
- [ ] Alternate airport suggestions
- [ ] SID/STAR procedures
- [ ] Wind optimization
- [ ] Fuel burn optimization
- [ ] Multi-leg flight plans
- [ ] Flight plan filing
- [ ] VATSIM/IVAO integration
- [ ] Custom waypoint editor
- [ ] Save/load flight plans
- [ ] User accounts
- [ ] Flight history

---

**Happy Flying! ✈️**

Built with ❤️ for the flight simulation community
