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
app.use(express.json());
app.use(express.static('public'));

// Cache for airports data
let airportsCache = null;
let airportsCacheTime = null;

// Aviation weather API endpoints
const WEATHER_API = 'https://aviationweather.gov/api/data';
const CHECKWX_API = 'https://api.checkwx.com';

// Load comprehensive airports database
async function loadAirportsDatabase() {
    if (airportsCache && airportsCacheTime && (Date.now() - airportsCacheTime < 3600000)) {
        return airportsCache;
    }
    
    try {
        // Using CSV from OurAirports - comprehensive worldwide database
        const response = await fetch('https://davidmegginson.github.io/ourairports-data/airports.csv');
        const csvText = await response.text();
        
        const airports = [];
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            const values = parseCSVLine(line);
            const airport = {};
            headers.forEach((header, index) => {
                airport[header] = values[index] ? values[index].replace(/"/g, '') : '';
            });
            
            // Filter for significant airports
            if (airport.type && (airport.type === 'large_airport' || 
                airport.type === 'medium_airport' || 
                airport.type === 'small_airport')) {
                airports.push({
                    icao: airport.ident || airport.gps_code,
                    iata: airport.iata_code,
                    name: airport.name,
                    city: airport.municipality,
                    country: airport.iso_country,
                    lat: parseFloat(airport.latitude_deg),
                    lon: parseFloat(airport.longitude_deg),
                    elevation: parseInt(airport.elevation_ft) || 0,
                    type: airport.type
                });
            }
        }
        
        airportsCache = airports;
        airportsCacheTime = Date.now();
        console.log(`Loaded ${airports.length} airports into database`);
        return airports;
    } catch (error) {
        console.error('Failed to load airports database:', error);
        return getBuiltInAirports();
    }
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

// Search airports with fuzzy matching
app.get('/api/airports/search', async (req, res) => {
    try {
        const query = req.query.q?.toUpperCase() || '';
        if (query.length < 2) {
            return res.json([]);
        }
        
        const airports = await loadAirportsDatabase();
        
        const results = airports
            .filter(apt => {
                const icaoMatch = apt.icao?.toUpperCase().includes(query);
                const iataMatch = apt.iata?.toUpperCase().includes(query);
                const nameMatch = apt.name?.toUpperCase().includes(query);
                const cityMatch = apt.city?.toUpperCase().includes(query);
                return icaoMatch || iataMatch || nameMatch || cityMatch;
            })
            .slice(0, 50)
            .map(apt => ({
                icao: apt.icao,
                iata: apt.iata,
                name: apt.name,
                city: apt.city,
                country: apt.country,
                displayText: `${apt.icao} - ${apt.name} (${apt.city}, ${apt.country})`
            }));
        
        res.json(results);
    } catch (error) {
        console.error('Airport search error:', error);
        res.status(500).json({ error: 'Failed to search airports' });
    }
});

// Get specific airport details
app.get('/api/airports/:icao', async (req, res) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const airports = await loadAirportsDatabase();
        const airport = airports.find(apt => apt.icao?.toUpperCase() === icao);
        
        if (airport) {
            res.json(airport);
        } else {
            // Fallback to built-in data
            const builtIn = getAirportData(icao);
            res.json(builtIn);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch airport data' });
    }
});

// Export PMDG .rte format
app.post('/api/export/pmdg', (req, res) => {
    try {
        const { flightPlan } = req.body;
        
        // PMDG RTE format
        let rteContent = `PMDG RTE FORMAT\n`;
        rteContent += `1\n`; // Version
        rteContent += `${flightPlan.departure.icao}\n`;
        rteContent += `${flightPlan.arrival.icao}\n`;
        
        // Add waypoints
        flightPlan.waypoints.forEach(wp => {
            rteContent += `${wp.name} ${wp.lat.toFixed(6)} ${wp.lon.toFixed(6)}\n`;
        });
        
        rteContent += `-----\n`;
        rteContent += `Cruise: FL${Math.floor(flightPlan.cruiseAltitude / 100)}\n`;
        rteContent += `Aircraft: ${flightPlan.aircraft.name}\n`;
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=${flightPlan.departure.icao}${flightPlan.arrival.icao}.rte`);
        res.send(rteContent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export PMDG route' });
    }
});

// Export FSX/P3D .pln format
app.post('/api/export/fsx', (req, res) => {
    try {
        const { flightPlan } = req.body;
        
        let plnContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        plnContent += `<SimBase.Document Type="AceXML" version="1,0">\n`;
        plnContent += `  <Descr>AceXML Document</Descr>\n`;
        plnContent += `  <FlightPlan.FlightPlan>\n`;
        plnContent += `    <Title>${flightPlan.departure.icao} to ${flightPlan.arrival.icao}</Title>\n`;
        plnContent += `    <FPType>IFR</FPType>\n`;
        plnContent += `    <CruisingAlt>${flightPlan.cruiseAltitude}</CruisingAlt>\n`;
        plnContent += `    <DepartureID>${flightPlan.departure.icao}</DepartureID>\n`;
        plnContent += `    <DepartureName>${flightPlan.departure.name}</DepartureName>\n`;
        plnContent += `    <DestinationID>${flightPlan.arrival.icao}</DestinationID>\n`;
        plnContent += `    <DestinationName>${flightPlan.arrival.name}</DestinationName>\n`;
        plnContent += `    <Descr>${flightPlan.aircraft.name}</Descr>\n`;
        
        // Add waypoints
        flightPlan.waypoints.forEach((wp, idx) => {
            plnContent += `    <ATCWaypoint id="${wp.name}">\n`;
            plnContent += `      <ATCWaypointType>Intersection</ATCWaypointType>\n`;
            plnContent += `      <WorldPosition>N${Math.abs(wp.lat).toFixed(6)}°,${wp.lon >= 0 ? 'E' : 'W'}${Math.abs(wp.lon).toFixed(6)}°,+${flightPlan.cruiseAltitude.toFixed(2)}</WorldPosition>\n`;
            plnContent += `      <ICAO><ICAOIdent>${wp.name}</ICAOIdent></ICAO>\n`;
            plnContent += `    </ATCWaypoint>\n`;
        });
        
        plnContent += `  </FlightPlan.FlightPlan>\n`;
        plnContent += `</SimBase.Document>\n`;
        
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename=${flightPlan.departure.icao}${flightPlan.arrival.icao}.pln`);
        res.send(plnContent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export FSX/P3D plan' });
    }
});

// Export X-Plane .fms format
app.post('/api/export/xplane', (req, res) => {
    try {
        const { flightPlan } = req.body;
        
        let fmsContent = `I\n`; // Version identifier
        fmsContent += `1100 Version\n`;
        fmsContent += `CYCLE 2401\n`;
        fmsContent += `ADEP ${flightPlan.departure.icao}\n`;
        fmsContent += `ADES ${flightPlan.arrival.icao}\n`;
        fmsContent += `NUMENR ${flightPlan.waypoints.length + 2}\n`;
        
        // Departure
        fmsContent += `1 ${flightPlan.departure.icao} ADEP 0.000000 ${flightPlan.departure.lat.toFixed(6)} ${flightPlan.departure.lon.toFixed(6)}\n`;
        
        // Waypoints
        flightPlan.waypoints.forEach((wp, idx) => {
            fmsContent += `11 ${wp.name} DRCT 0.000000 ${wp.lat.toFixed(6)} ${wp.lon.toFixed(6)}\n`;
        });
        
        // Arrival
        fmsContent += `1 ${flightPlan.arrival.icao} ADES 0.000000 ${flightPlan.arrival.lat.toFixed(6)} ${flightPlan.arrival.lon.toFixed(6)}\n`;
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=${flightPlan.departure.icao}${flightPlan.arrival.icao}.fms`);
        res.send(fmsContent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export X-Plane route' });
    }
});

// Export MSFS2020 .pln format (enhanced)
app.post('/api/export/msfs', (req, res) => {
    try {
        const { flightPlan } = req.body;
        
        let plnContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        plnContent += `<SimBase.Document Type="AceXML" version="1,0">\n`;
        plnContent += `  <Descr>AceXML Document</Descr>\n`;
        plnContent += `  <FlightPlan.FlightPlan>\n`;
        plnContent += `    <Title>${flightPlan.departure.icao} to ${flightPlan.arrival.icao}</Title>\n`;
        plnContent += `    <FPType>IFR</FPType>\n`;
        plnContent += `    <RouteType>HighAlt</RouteType>\n`;
        plnContent += `    <CruisingAlt>${flightPlan.cruiseAltitude}</CruisingAlt>\n`;
        plnContent += `    <DepartureID>${flightPlan.departure.icao}</DepartureID>\n`;
        plnContent += `    <DepartureLLA>N${Math.abs(flightPlan.departure.lat).toFixed(6)}°,${flightPlan.departure.lon >= 0 ? 'E' : 'W'}${Math.abs(flightPlan.departure.lon).toFixed(6)}°,+${flightPlan.departure.elevation.toFixed(2)}</DepartureLLA>\n`;
        plnContent += `    <DestinationID>${flightPlan.arrival.icao}</DestinationID>\n`;
        plnContent += `    <DestinationLLA>N${Math.abs(flightPlan.arrival.lat).toFixed(6)}°,${flightPlan.arrival.lon >= 0 ? 'E' : 'W'}${Math.abs(flightPlan.arrival.lon).toFixed(6)}°,+${flightPlan.arrival.elevation.toFixed(2)}</DestinationLLA>\n`;
        plnContent += `    <Descr>Generated by Flight Planner Pro - ${flightPlan.aircraft.name}</Descr>\n`;
        plnContent += `    <DeparturePosition>${flightPlan.departure.icao}</DeparturePosition>\n`;
        plnContent += `    <DepartureName>${flightPlan.departure.name}</DepartureName>\n`;
        plnContent += `    <DestinationName>${flightPlan.arrival.name}</DestinationName>\n`;
        plnContent += `    <AppVersion>\n`;
        plnContent += `      <AppVersionMajor>11</AppVersionMajor>\n`;
        plnContent += `      <AppVersionBuild>282174</AppVersionBuild>\n`;
        plnContent += `    </AppVersion>\n`;
        
        // Departure waypoint
        plnContent += `    <ATCWaypoint id="${flightPlan.departure.icao}">\n`;
        plnContent += `      <ATCWaypointType>Airport</ATCWaypointType>\n`;
        plnContent += `      <WorldPosition>N${Math.abs(flightPlan.departure.lat).toFixed(6)}°,${flightPlan.departure.lon >= 0 ? 'E' : 'W'}${Math.abs(flightPlan.departure.lon).toFixed(6)}°,+${flightPlan.departure.elevation.toFixed(2)}</WorldPosition>\n`;
        plnContent += `      <ICAO>\n`;
        plnContent += `        <ICAOIdent>${flightPlan.departure.icao}</ICAOIdent>\n`;
        plnContent += `      </ICAO>\n`;
        plnContent += `    </ATCWaypoint>\n`;
        
        // Waypoints
        flightPlan.waypoints.forEach(wp => {
            plnContent += `    <ATCWaypoint id="${wp.name}">\n`;
            plnContent += `      <ATCWaypointType>User</ATCWaypointType>\n`;
            plnContent += `      <WorldPosition>N${Math.abs(wp.lat).toFixed(6)}°,${wp.lon >= 0 ? 'E' : 'W'}${Math.abs(wp.lon).toFixed(6)}°,+${flightPlan.cruiseAltitude.toFixed(2)}</WorldPosition>\n`;
            plnContent += `    </ATCWaypoint>\n`;
        });
        
        // Arrival waypoint
        plnContent += `    <ATCWaypoint id="${flightPlan.arrival.icao}">\n`;
        plnContent += `      <ATCWaypointType>Airport</ATCWaypointType>\n`;
        plnContent += `      <WorldPosition>N${Math.abs(flightPlan.arrival.lat).toFixed(6)}°,${flightPlan.arrival.lon >= 0 ? 'E' : 'W'}${Math.abs(flightPlan.arrival.lon).toFixed(6)}°,+${flightPlan.arrival.elevation.toFixed(2)}</WorldPosition>\n`;
        plnContent += `      <ICAO>\n`;
        plnContent += `        <ICAOIdent>${flightPlan.arrival.icao}</ICAOIdent>\n`;
        plnContent += `      </ICAO>\n`;
        plnContent += `    </ATCWaypoint>\n`;
        
        plnContent += `  </FlightPlan.FlightPlan>\n`;
        plnContent += `</SimBase.Document>\n`;
        
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename=${flightPlan.departure.icao}${flightPlan.arrival.icao}.pln`);
        res.send(plnContent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export MSFS2020 plan' });
    }
});

// Route calculation helper
function calculateGreatCircleDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in nautical miles
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
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

// Get METAR weather data
app.get('/api/weather/metar/:icao', async (req, res) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const response = await axios.get(`${WEATHER_API}/metar?ids=${icao}&format=json`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch METAR data', details: error.message });
    }
});

// Get TAF weather data
app.get('/api/weather/taf/:icao', async (req, res) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const response = await axios.get(`${WEATHER_API}/taf?ids=${icao}&format=json`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch TAF data', details: error.message });
    }
});

// Search airports
app.get('/api/airports/search/:query', async (req, res) => {
    try {
        const query = req.params.query.toUpperCase();
        // Using OurAirports data API
        const response = await axios.get(`https://ourairports.com/airports.json`);
        const airports = response.data.filter(apt => 
            apt.ident?.includes(query) || 
            apt.name?.toUpperCase().includes(query) ||
            apt.municipality?.toUpperCase().includes(query)
        ).slice(0, 20);
        res.json(airports);
    } catch (error) {
        // Fallback to mock data if API fails
        res.json(getMockAirports(req.params.query));
    }
});

// Get airport information
app.get('/api/airports/:icao', async (req, res) => {
    try {
        const icao = req.params.icao.toUpperCase();
        const airportData = getAirportData(icao);
        res.json(airportData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch airport data' });
    }
});

// Calculate route
app.post('/api/route/calculate', async (req, res) => {
    try {
        const { departure, arrival, cruiseAltitude, cruiseSpeed, aircraft } = req.body;
        
        const route = {
            departure: getAirportData(departure),
            arrival: getAirportData(arrival),
            distance: calculateGreatCircleDistance(
                getAirportData(departure).lat,
                getAirportData(departure).lon,
                getAirportData(arrival).lat,
                getAirportData(arrival).lon
            ),
            heading: calculateBearing(
                getAirportData(departure).lat,
                getAirportData(departure).lon,
                getAirportData(arrival).lat,
                getAirportData(arrival).lon
            ),
            cruiseAltitude,
            cruiseSpeed,
            aircraft,
            flightTime: 0,
            fuelRequired: 0,
            waypoints: []
        };

        // Calculate flight time
        route.flightTime = (route.distance / cruiseSpeed) * 60; // minutes
        
        // Generate waypoints
        route.waypoints = generateWaypoints(
            getAirportData(departure).lat,
            getAirportData(departure).lon,
            getAirportData(arrival).lat,
            getAirportData(arrival).lon
        );

        // Calculate fuel based on aircraft type
        route.fuelRequired = calculateFuel(aircraft, route.distance, cruiseAltitude);

        res.json(route);
    } catch (error) {
        res.status(500).json({ error: 'Failed to calculate route', details: error.message });
    }
});

// Generate PDF flight plan
app.post('/api/route/pdf', async (req, res) => {
    try {
        const { flightPlan } = req.body;
        
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=flight-plan-${flightPlan.departure.icao}-${flightPlan.arrival.icao}.pdf`);
        
        doc.pipe(res);

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('FLIGHT PLAN', { align: 'center' });
        doc.moveDown();

        // Flight Information
        doc.fontSize(14).font('Helvetica-Bold').text('Flight Information');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Aircraft: ${flightPlan.aircraft.name} (${flightPlan.aircraft.icao})`);
        doc.text(`Simulator: ${flightPlan.simulator || 'All Platforms'}`);
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        // Route Information
        doc.fontSize(14).font('Helvetica-Bold').text('Route');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Departure: ${flightPlan.departure.icao} - ${flightPlan.departure.name}`);
        doc.text(`Arrival: ${flightPlan.arrival.icao} - ${flightPlan.arrival.name}`);
        doc.text(`Distance: ${Math.round(flightPlan.distance)} NM`);
        doc.text(`Heading: ${Math.round(flightPlan.heading)}°`);
        doc.text(`Cruise Altitude: ${flightPlan.cruiseAltitude} ft`);
        doc.text(`Cruise Speed: ${flightPlan.cruiseSpeed} kts`);
        doc.text(`Flight Time: ${Math.floor(flightPlan.flightTime / 60)}h ${Math.round(flightPlan.flightTime % 60)}m`);
        doc.text(`Fuel Required: ${Math.round(flightPlan.fuelRequired)} lbs`);
        doc.moveDown();

        // Waypoints
        if (flightPlan.waypoints && flightPlan.waypoints.length > 0) {
            doc.fontSize(14).font('Helvetica-Bold').text('Waypoints');
            doc.fontSize(9).font('Helvetica');
            flightPlan.waypoints.forEach((wp, idx) => {
                doc.text(`${idx + 1}. ${wp.name} - ${wp.lat.toFixed(4)}°, ${wp.lon.toFixed(4)}°`);
            });
            doc.moveDown();
        }

        // Weather Information
        if (flightPlan.weather) {
            doc.fontSize(14).font('Helvetica-Bold').text('Weather Information');
            doc.fontSize(9).font('Helvetica');
            if (flightPlan.weather.departure) {
                doc.text(`Departure METAR: ${flightPlan.weather.departure}`);
            }
            if (flightPlan.weather.arrival) {
                doc.text(`Arrival METAR: ${flightPlan.weather.arrival}`);
            }
            doc.moveDown();
        }

        // Footer
        doc.fontSize(8).text('Generated by Flight Planner Pro', { align: 'center' });
        doc.text('For flight simulation use only', { align: 'center' });

        doc.end();
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
});

// Get aircraft database
app.get('/api/aircraft', (req, res) => {
    res.json(getAircraftDatabase());
});

// Helper functions
function getMockAirports(query) {
    const airports = [
        { ident: 'KJFK', name: 'John F Kennedy Intl', municipality: 'New York', lat: 40.6398, lon: -73.7789 },
        { ident: 'EGLL', name: 'London Heathrow', municipality: 'London', lat: 51.4706, lon: -0.4619 },
        { ident: 'LFPG', name: 'Paris Charles de Gaulle', municipality: 'Paris', lat: 49.0097, lon: 2.5479 },
        { ident: 'EDDF', name: 'Frankfurt am Main', municipality: 'Frankfurt', lat: 50.0333, lon: 8.5706 },
        { ident: 'LTFM', name: 'Istanbul Airport', municipality: 'Istanbul', lat: 41.2619, lon: 28.7414 },
        { ident: 'LTBA', name: 'Istanbul Ataturk', municipality: 'Istanbul', lat: 40.9769, lon: 28.8146 },
        { ident: 'OMDB', name: 'Dubai Intl', municipality: 'Dubai', lat: 25.2528, lon: 55.3644 },
        { ident: 'KLAX', name: 'Los Angeles Intl', municipality: 'Los Angeles', lat: 33.9425, lon: -118.408 }
    ];
    return airports.filter(a => a.ident.includes(query.toUpperCase()) || a.name.toUpperCase().includes(query.toUpperCase()));
}

function getAirportData(icao) {
    const airports = {
        'KJFK': { icao: 'KJFK', name: 'John F Kennedy Intl', lat: 40.6398, lon: -73.7789, elevation: 13 },
        'EGLL': { icao: 'EGLL', name: 'London Heathrow', lat: 51.4706, lon: -0.4619, elevation: 83 },
        'LFPG': { icao: 'LFPG', name: 'Paris Charles de Gaulle', lat: 49.0097, lon: 2.5479, elevation: 392 },
        'EDDF': { icao: 'EDDF', name: 'Frankfurt am Main', lat: 50.0333, lon: 8.5706, elevation: 364 },
        'LTFM': { icao: 'LTFM', name: 'Istanbul Airport', lat: 41.2619, lon: 28.7414, elevation: 325 },
        'LTBA': { icao: 'LTBA', name: 'Istanbul Ataturk', lat: 40.9769, lon: 28.8146, elevation: 163 },
        'OMDB': { icao: 'OMDB', name: 'Dubai Intl', lat: 25.2528, lon: 55.3644, elevation: 62 },
        'KLAX': { icao: 'KLAX', name: 'Los Angeles Intl', lat: 33.9425, lon: -118.408, elevation: 125 }
    };
    return airports[icao.toUpperCase()] || { icao, name: 'Unknown', lat: 0, lon: 0, elevation: 0 };
}

function generateWaypoints(lat1, lon1, lat2, lon2) {
    const waypoints = [];
    const numWaypoints = 5;
    
    for (let i = 1; i <= numWaypoints; i++) {
        const fraction = i / (numWaypoints + 1);
        const lat = lat1 + (lat2 - lat1) * fraction;
        const lon = lon1 + (lon2 - lon1) * fraction;
        waypoints.push({
            name: `WP${i}`,
            lat: lat,
            lon: lon
        });
    }
    
    return waypoints;
}

function calculateFuel(aircraft, distance, altitude) {
    // Simplified fuel calculation
    const baseFuelBurn = aircraft.fuelBurn || 2000; // lbs per hour
    const flightTime = distance / (aircraft.cruiseSpeed || 450); // hours
    return baseFuelBurn * flightTime * 1.2; // 20% reserve
}

function getAircraftDatabase() {
    return {
        boeing: [
            { icao: 'B738', name: 'Boeing 737-800', cruiseSpeed: 450, fuelBurn: 5000, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'FSX', 'PMDG'] },
            { icao: 'B739', name: 'Boeing 737-900', cruiseSpeed: 450, fuelBurn: 5200, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12', 'PMDG'] },
            { icao: 'B37M', name: 'Boeing 737 MAX 8', cruiseSpeed: 453, fuelBurn: 4500, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12', 'PMDG'] },
            { icao: 'B748', name: 'Boeing 747-8', cruiseSpeed: 490, fuelBurn: 12000, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'PMDG'] },
            { icao: 'B77W', name: 'Boeing 777-300ER', cruiseSpeed: 490, fuelBurn: 10000, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'PMDG'] },
            { icao: 'B77L', name: 'Boeing 777F', cruiseSpeed: 490, fuelBurn: 10500, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'PMDG'] },
            { icao: 'B788', name: 'Boeing 787-8 Dreamliner', cruiseSpeed: 490, fuelBurn: 8000, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'PMDG'] },
            { icao: 'B789', name: 'Boeing 787-9 Dreamliner', cruiseSpeed: 490, fuelBurn: 8500, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'PMDG'] },
            { icao: 'B78X', name: 'Boeing 787-10 Dreamliner', cruiseSpeed: 490, fuelBurn: 9000, maxAltitude: 43000, simulator: ['MSFS2020', 'PMDG'] }
        ],
        airbus: [
            { icao: 'A20N', name: 'Airbus A320neo', cruiseSpeed: 450, fuelBurn: 4300, maxAltitude: 39800, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'FlyByWire A32NX'] },
            { icao: 'A321', name: 'Airbus A321', cruiseSpeed: 450, fuelBurn: 5000, maxAltitude: 39800, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'FSX'] },
            { icao: 'A21N', name: 'Airbus A321neo', cruiseSpeed: 450, fuelBurn: 4500, maxAltitude: 39800, simulator: ['MSFS2020', 'X-Plane 12', 'FlyByWire'] },
            { icao: 'A319', name: 'Airbus A319', cruiseSpeed: 450, fuelBurn: 4500, maxAltitude: 39800, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'FSX'] },
            { icao: 'A320', name: 'Airbus A320', cruiseSpeed: 450, fuelBurn: 4800, maxAltitude: 39800, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'FSX'] },
            { icao: 'A332', name: 'Airbus A330-200', cruiseSpeed: 470, fuelBurn: 8000, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D'] },
            { icao: 'A333', name: 'Airbus A330-300', cruiseSpeed: 470, fuelBurn: 8500, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D'] },
            { icao: 'A339', name: 'Airbus A330-900neo', cruiseSpeed: 470, fuelBurn: 7500, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12'] },
            { icao: 'A359', name: 'Airbus A350-900', cruiseSpeed: 490, fuelBurn: 8500, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D'] },
            { icao: 'A35K', name: 'Airbus A350-1000', cruiseSpeed: 490, fuelBurn: 9000, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12'] },
            { icao: 'A388', name: 'Airbus A380-800', cruiseSpeed: 490, fuelBurn: 14000, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D'] }
        ],
        regional: [
            { icao: 'CRJ9', name: 'Bombardier CRJ-900', cruiseSpeed: 430, fuelBurn: 2500, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D'] },
            { icao: 'E170', name: 'Embraer E170', cruiseSpeed: 440, fuelBurn: 2800, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12'] },
            { icao: 'E190', name: 'Embraer E190', cruiseSpeed: 440, fuelBurn: 3200, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12'] },
            { icao: 'E195', name: 'Embraer E195', cruiseSpeed: 440, fuelBurn: 3400, maxAltitude: 41000, simulator: ['MSFS2020', 'X-Plane 12'] },
            { icao: 'DH8D', name: 'Bombardier Dash 8 Q400', cruiseSpeed: 360, fuelBurn: 1800, maxAltitude: 27000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D'] }
        ],
        cargo: [
            { icao: 'B74F', name: 'Boeing 747-400F', cruiseSpeed: 490, fuelBurn: 13000, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D'] },
            { icao: 'MD11', name: 'McDonnell Douglas MD-11F', cruiseSpeed: 470, fuelBurn: 11000, maxAltitude: 42000, simulator: ['X-Plane 12', 'Prepar3D'] },
            { icao: 'B763', name: 'Boeing 767-300F', cruiseSpeed: 470, fuelBurn: 8500, maxAltitude: 43000, simulator: ['MSFS2020', 'X-Plane 12'] }
        ],
        general: [
            { icao: 'C172', name: 'Cessna 172 Skyhawk', cruiseSpeed: 120, fuelBurn: 30, maxAltitude: 14000, simulator: ['MSFS2020', 'X-Plane 12', 'Prepar3D', 'FSX'] },
            { icao: 'C208', name: 'Cessna 208 Caravan', cruiseSpeed: 180, fuelBurn: 200, maxAltitude: 25000, simulator: ['MSFS2020', 'X-Plane 12'] },
            { icao: 'PC12', name: 'Pilatus PC-12', cruiseSpeed: 280, fuelBurn: 300, maxAltitude: 30000, simulator: ['MSFS2020', 'X-Plane 12'] },
            { icao: 'TBM9', name: 'TBM 930', cruiseSpeed: 330, fuelBurn: 280, maxAltitude: 31000, simulator: ['MSFS2020', 'X-Plane 12'] }
        ]
    };
}

app.listen(PORT, () => {
    console.log(`Flight Planner Pro server running on http://localhost:${PORT}`);
});
