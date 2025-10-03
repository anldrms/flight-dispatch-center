const express = require('express');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// =====================================================
// AIRPORTS DATABASE WITH CACHING
// =====================================================
let airportsCache = null;
let airportsCacheTime = null;
const CACHE_DURATION = 3600000; // 1 hour

async function loadAirportsDatabase() {
    if (airportsCache && airportsCacheTime && (Date.now() - airportsCacheTime < CACHE_DURATION)) {
        return airportsCache;
    }
    
    try {
        console.log('Loading worldwide airports database...');
        const response = await fetch('https://davidmegginson.github.io/ourairports-data/airports.csv');
        const csvText = await response.text();
        
        const airports = [];
        const lines = csvText.split('\n');
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
            if (!parts || parts.length < 10) continue;
            
            const clean = (str) => str ? str.replace(/^"|"$/g, '').trim() : '';
            
            const type = clean(parts[2]);
            if (type === 'large_airport' || type === 'medium_airport' || type === 'small_airport') {
                const icao = clean(parts[1]) || clean(parts[12]);
                if (icao && icao.length >= 3) {
                    airports.push({
                        icao: icao,
                        iata: clean(parts[13]),
                        name: clean(parts[3]),
                        city: clean(parts[10]),
                        country: clean(parts[8]),
                        lat: parseFloat(clean(parts[4])) || 0,
                        lon: parseFloat(clean(parts[5])) || 0,
                        elevation: parseInt(clean(parts[6])) || 0,
                        type: type
                    });
                }
            }
        }
        
        airportsCache = airports;
        airportsCacheTime = Date.now();
        console.log(`✓ Loaded ${airports.length} airports into database`);
        return airports;
    } catch (error) {
        console.error('Failed to load airports database:', error);
        return getBuiltInAirports();
    }
}

function getBuiltInAirports() {
    return [
        { icao: 'KJFK', iata: 'JFK', name: 'John F Kennedy Intl', city: 'New York', country: 'US', lat: 40.6398, lon: -73.7789, elevation: 13, type: 'large_airport' },
        { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow', city: 'London', country: 'GB', lat: 51.4706, lon: -0.4619, elevation: 83, type: 'large_airport' },
        { icao: 'LFPG', iata: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'FR', lat: 49.0097, lon: 2.5479, elevation: 392, type: 'large_airport' },
        { icao: 'EDDF', iata: 'FRA', name: 'Frankfurt am Main', city: 'Frankfurt', country: 'DE', lat: 50.0333, lon: 8.5706, elevation: 364, type: 'large_airport' },
        { icao: 'LTFM', iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'TR', lat: 41.2619, lon: 28.7414, elevation: 325, type: 'large_airport' },
        { icao: 'LTBA', iata: 'ISL', name: 'Istanbul Ataturk', city: 'Istanbul', country: 'TR', lat: 40.9769, lon: 28.8146, elevation: 163, type: 'large_airport' },
        { icao: 'OMDB', iata: 'DXB', name: 'Dubai Intl', city: 'Dubai', country: 'AE', lat: 25.2528, lon: 55.3644, elevation: 62, type: 'large_airport' },
        { icao: 'KLAX', iata: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', country: 'US', lat: 33.9425, lon: -118.408, elevation: 125, type: 'large_airport' }
    ];
}

// =====================================================
// API ENDPOINTS
// =====================================================

// Search airports
app.get('/api/airports/search', async (req, res) => {
    try {
        const query = req.query.q?.toUpperCase() || '';
        if (query.length < 2) {
            return res.json([]);
        }
        
        const airports = await loadAirportsDatabase();
        
        const results = airports
            .filter(apt => {
                const searchStr = `${apt.icao} ${apt.iata} ${apt.name} ${apt.city}`.toUpperCase();
                return searchStr.includes(query);
            })
            .slice(0, 100)
            .map(apt => ({
                ...apt,
                label: `${apt.icao}${apt.iata ? ' / ' + apt.iata : ''} - ${apt.name}`,
                sublabel: `${apt.city}, ${apt.country}`
            }));
        
        res.json(results);
    } catch (error) {
        console.error('Airport search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get airport details
app.get('/api/airports/:icao', async (req, res) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const airports = await loadAirportsDatabase();
        const airport = airports.find(apt => apt.icao === icao);
        
        if (airport) {
            res.json(airport);
        } else {
            res.status(404).json({ error: 'Airport not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch airport' });
    }
});

// Weather - METAR
app.get('/api/weather/metar/:icao', async (req, res) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const response = await axios.get(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`, { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        res.json([{ rawOb: `No METAR available for ${req.params.icao}` }]);
    }
});

// Weather - TAF
app.get('/api/weather/taf/:icao', async (req, res) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const response = await axios.get(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`, { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        res.json([]);
    }
});

// Calculate route
app.post('/api/route/calculate', async (req, res) => {
    try {
        const { departure, arrival, cruiseAltitude, cruiseSpeed, aircraft } = req.body;
        
        const airports = await loadAirportsDatabase();
        const depAirport = airports.find(a => a.icao === departure);
        const arrAirport = airports.find(a => a.icao === arrival);
        
        if (!depAirport || !arrAirport) {
            return res.status(400).json({ error: 'Airport not found' });
        }
        
        const distance = calculateGreatCircleDistance(
            depAirport.lat, depAirport.lon,
            arrAirport.lat, arrAirport.lon
        );
        
        const heading = calculateBearing(
            depAirport.lat, depAirport.lon,
            arrAirport.lat, arrAirport.lon
        );
        
        const waypoints = generateWaypoints(
            depAirport.lat, depAirport.lon,
            arrAirport.lat, arrAirport.lon,
            Math.min(Math.floor(distance / 200), 10)
        );
        
        const flightTime = (distance / cruiseSpeed) * 60;
        const fuelRequired = calculateFuel(aircraft, distance, cruiseAltitude);
        
        res.json({
            departure: depAirport,
            arrival: arrAirport,
            distance,
            heading,
            cruiseAltitude,
            cruiseSpeed,
            aircraft,
            flightTime,
            fuelRequired,
            waypoints
        });
    } catch (error) {
        console.error('Route calculation error:', error);
        res.status(500).json({ error: 'Calculation failed' });
    }
});

// Export formats
app.post('/api/export/pmdg', (req, res) => {
    const { flightPlan } = req.body;
    let content = `${flightPlan.departure.icao} ${flightPlan.waypoints.map(w => w.name).join(' ')} ${flightPlan.arrival.icao}\n`;
    content += `FL${Math.floor(flightPlan.cruiseAltitude / 100)} ${flightPlan.aircraft.icao}\n`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${flightPlan.departure.icao}${flightPlan.arrival.icao}.rte`);
    res.send(content);
});

app.post('/api/export/msfs', (req, res) => {
    const { flightPlan } = req.body;
    let xml = `<?xml version="1.0"?>\n<SimBase.Document Type="AceXML" version="1,0">\n<FlightPlan.FlightPlan>\n`;
    xml += `<Title>${flightPlan.departure.icao} to ${flightPlan.arrival.icao}</Title>\n`;
    xml += `<FPType>IFR</FPType>\n`;
    xml += `<CruisingAlt>${flightPlan.cruiseAltitude}</CruisingAlt>\n`;
    xml += `<DepartureID>${flightPlan.departure.icao}</DepartureID>\n`;
    xml += `<DestinationID>${flightPlan.arrival.icao}</DestinationID>\n`;
    xml += `</FlightPlan.FlightPlan>\n</SimBase.Document>`;
    
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=${flightPlan.departure.icao}${flightPlan.arrival.icao}.pln`);
    res.send(xml);
});

app.post('/api/export/xplane', (req, res) => {
    const { flightPlan } = req.body;
    let content = `I\n1100 Version\nCYCLE 2401\n`;
    content += `ADEP ${flightPlan.departure.icao}\nADES ${flightPlan.arrival.icao}\n`;
    content += `NUMENR ${flightPlan.waypoints.length + 2}\n`;
    content += `1 ${flightPlan.departure.icao} 0 ${flightPlan.departure.lat} ${flightPlan.departure.lon}\n`;
    flightPlan.waypoints.forEach(wp => {
        content += `11 ${wp.name} 0 ${wp.lat} ${wp.lon}\n`;
    });
    content += `1 ${flightPlan.arrival.icao} 0 ${flightPlan.arrival.lat} ${flightPlan.arrival.lon}\n`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${flightPlan.departure.icao}${flightPlan.arrival.icao}.fms`);
    res.send(content);
});

// PDF Export - Enhanced
app.post('/api/export/pdf', async (req, res) => {
    const { flightPlan } = req.body;
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=OFP-${flightPlan.departure.icao}${flightPlan.arrival.icao}.pdf`);
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('OPERATIONAL FLIGHT PLAN', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Flight Planner Pro - ${new Date().toUTCString()}`, { align: 'center' });
    doc.moveDown(2);
    
    // Flight Info
    doc.fontSize(14).font('Helvetica-Bold').text('FLIGHT INFORMATION');
    doc.fontSize(10).font('Helvetica');
    doc.text(`From: ${flightPlan.departure.icao} - ${flightPlan.departure.name}`);
    doc.text(`To: ${flightPlan.arrival.icao} - ${flightPlan.arrival.name}`);
    doc.text(`Aircraft: ${flightPlan.aircraft.name} (${flightPlan.aircraft.icao})`);
    doc.text(`Distance: ${Math.round(flightPlan.distance)} NM`);
    doc.text(`Cruise: FL${Math.floor(flightPlan.cruiseAltitude / 100)} / ${flightPlan.cruiseSpeed} kts`);
    doc.text(`ETE: ${Math.floor(flightPlan.flightTime / 60)}:${String(Math.round(flightPlan.flightTime % 60)).padStart(2, '0')}`);
    doc.text(`Fuel: ${Math.round(flightPlan.fuelRequired)} lbs`);
    doc.moveDown();
    
    // Weather
    if (flightPlan.weather) {
        doc.fontSize(14).font('Helvetica-Bold').text('WEATHER');
        doc.fontSize(9).font('Courier');
        if (flightPlan.weather.departure && flightPlan.weather.departure[0]) {
            doc.text(`DEP: ${flightPlan.weather.departure[0].rawOb || 'N/A'}`);
        }
        if (flightPlan.weather.arrival && flightPlan.weather.arrival[0]) {
            doc.text(`ARR: ${flightPlan.weather.arrival[0].rawOb || 'N/A'}`);
        }
        doc.moveDown();
    }
    
    // Route
    doc.fontSize(14).font('Helvetica-Bold').text('ROUTE');
    doc.fontSize(10).font('Helvetica');
    const route = [flightPlan.departure.icao, ...flightPlan.waypoints.map(w => w.name), flightPlan.arrival.icao].join(' ');
    doc.text(route);
    
    doc.end();
});

// Aircraft database
app.get('/api/aircraft', (req, res) => {
    res.json(getAircraftDatabase());
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function calculateGreatCircleDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function generateWaypoints(lat1, lon1, lat2, lon2, count) {
    const waypoints = [];
    for (let i = 1; i <= count; i++) {
        const f = i / (count + 1);
        waypoints.push({
            name: `WP${String(i).padStart(2, '0')}`,
            lat: lat1 + (lat2 - lat1) * f,
            lon: lon1 + (lon2 - lon1) * f
        });
    }
    return waypoints;
}

function calculateFuel(aircraft, distance, altitude) {
    const hours = distance / (aircraft.cruiseSpeed || 450);
    return (aircraft.fuelBurn || 5000) * hours * 1.15;
}

function getAircraftDatabase() {
    return {
        boeing: [
            { icao: 'B738', name: 'Boeing 737-800', cruiseSpeed: 450, fuelBurn: 5000, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'FSX', 'PMDG'] },
            { icao: 'B789', name: 'Boeing 787-9 Dreamliner', cruiseSpeed: 490, fuelBurn: 8500, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'PMDG'] },
            { icao: 'B77W', name: 'Boeing 777-300ER', cruiseSpeed: 490, fuelBurn: 10000, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'PMDG'] },
        ],
        airbus: [
            { icao: 'A20N', name: 'Airbus A320neo', cruiseSpeed: 450, fuelBurn: 4300, maxAltitude: 39800, simulator: ['MSFS2020', 'X-Plane 12', 'FlyByWire'] },
            { icao: 'A359', name: 'Airbus A350-900', cruiseSpeed: 490, fuelBurn: 8500, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12'] },
            { icao: 'A388', name: 'Airbus A380-800', cruiseSpeed: 490, fuelBurn: 14000, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12'] },
        ]
    };
}

// Start server
app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════════╗`);
    console.log(`║   Flight Planner Pro - Dispatch Office v2.0   ║`);
    console.log(`╚════════════════════════════════════════════════╝`);
    console.log(`\n🌐 Server: http://localhost:${PORT}`);
    console.log(`📊 Status: ONLINE`);
    console.log(`\nInitializing airports database...`);
    loadAirportsDatabase().then(() => {
        console.log(`✓ Ready for flight planning!\n`);
    });
});
