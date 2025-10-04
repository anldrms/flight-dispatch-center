/* ===================================================================
   FLIGHT OPERATIONS DISPATCH CENTER - CLIENT APPLICATION
   Professional Aviation Dispatch System
   =================================================================== */

// Global State
const state = {
    map: null,
    markers: {
        departure: null,
        arrival: null
    },
    routeLine: null,
    waypointMarkers: [],
    selectedAirports: {
        departure: null,
        arrival: null
    },
    aircraftDatabase: {},
    selectedAircraft: null,
    currentFlightPlan: null,
    searchTimeout: null,
    exportSettings: {
        pmdg: { includeSID: true, includeSTAR: true, includeApproach: false },
        xplane: { includeAltitude: false, airacCycle: '2401' },
        pdf: { includeWeather: true, includeNotam: true, includeCharts: false, includePerformance: false }
    }
};

/* ===================================================================
   INITIALIZATION
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🛫 Flight Dispatch System initializing...');
    initializeSystem();
});

async function initializeSystem() {
    try {
        // Initialize UI components
        initializeClocks();
        initializeMap();
        initializeEventListeners();
        
        // Load data
        await loadAircraftDatabase();
        
        // Set initial date
        document.getElementById('flight-date').value = new Date().toISOString().split('T')[0];
        
        showToast('System Ready', 'Flight Dispatch System is operational', 'success');
        console.log('✅ System initialized successfully');
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showToast('System Error', 'Failed to initialize system', 'error');
    }
}

/* ===================================================================
   CLOCK & TIME
   =================================================================== */

function initializeClocks() {
    updateClocks();
    setInterval(updateClocks, 1000);
}

function updateClocks() {
    const now = new Date();
    
    // Zulu time (UTC)
    const zuluTime = now.toISOString().substr(11, 8);
    document.getElementById('zulu-time').textContent = zuluTime;
    
    // Local time
    const localTime = now.toLocaleTimeString('en-US', { hour12: false });
    document.getElementById('local-time').textContent = localTime;
}

/* ===================================================================
   MAP INITIALIZATION
   =================================================================== */

function initializeMap() {
    // Initialize Leaflet map
    state.map = L.map('map', {
        center: [40, 0],
        zoom: 3,
        zoomControl: true,
        minZoom: 2,
        maxZoom: 18
    });

    // Add dark tile layer for professional look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(state.map);

    // Add scale control
    L.control.scale({
        metric: true,
        imperial: true,
        position: 'bottomright'
    }).addTo(state.map);

    console.log('🗺️  Map initialized');
}

function resetMapView() {
    if (state.selectedAirports.departure && state.selectedAirports.arrival) {
        const bounds = L.latLngBounds([
            [state.selectedAirports.departure.lat, state.selectedAirports.departure.lon],
            [state.selectedAirports.arrival.lat, state.selectedAirports.arrival.lon]
        ]);
        state.map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        state.map.setView([40, 0], 3);
    }
}

function toggleMapLayer() {
    // Toggle between different map layers
    showToast('Map Layer', 'Layer switching coming soon', 'info');
}

/* ===================================================================
   EVENT LISTENERS
   =================================================================== */

function initializeEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // Airport search
    setupAirportSearch('departure');
    setupAirportSearch('arrival');

    // Aircraft selection
    document.getElementById('aircraft-category').addEventListener('change', (e) => {
        loadAircraftCategory(e.target.value);
    });

    document.getElementById('aircraft-type').addEventListener('change', (e) => {
        selectAircraft(e.target.value);
    });

    // Auto-fill cruise parameters when aircraft is selected
    document.getElementById('aircraft-type').addEventListener('change', autoFillCruiseParams);

    console.log('🎯 Event listeners initialized');
}

/* ===================================================================
   TAB SWITCHING
   =================================================================== */

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // Update panel content
    document.querySelectorAll('.panel-content').forEach(panel => {
        panel.classList.add('hidden');
    });
    document.getElementById(`panel-${tabName}`).classList.remove('hidden');

    // Load content based on tab
    if (tabName === 'weather') {
        loadWeatherData();
    } else if (tabName === 'notam') {
        loadNotamData();
    }
}

/* ===================================================================
   AIRPORT SEARCH
   =================================================================== */

function setupAirportSearch(type) {
    const searchInput = document.getElementById(`${type}-search`);
    const resultsDiv = document.getElementById(`${type}-results`);

    searchInput.addEventListener('input', (e) => {
        clearTimeout(state.searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            resultsDiv.classList.remove('show');
            return;
        }

        state.searchTimeout = setTimeout(() => {
            searchAirports(query, type);
        }, 300);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.airport-search-group')) {
            resultsDiv.classList.remove('show');
        }
    });
}

async function searchAirports(query, type) {
    const resultsDiv = document.getElementById(`${type}-results`);
    
    try {
        showLoader();
        const response = await fetch(`/api/airports/search?q=${encodeURIComponent(query)}`);
        const airports = await response.json();
        
        hideLoader();

        if (airports.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item"><div class="result-name">No airports found</div></div>';
        } else {
            resultsDiv.innerHTML = airports.map(airport => `
                <div class="search-result-item" onclick="selectAirport('${type}', ${JSON.stringify(airport).replace(/"/g, '&quot;')})">
                    <div class="result-icao">${airport.icao}${airport.iata ? ` / ${airport.iata}` : ''}</div>
                    <div class="result-name">${airport.name}</div>
                    <div class="result-location">${airport.city}, ${airport.country}</div>
                </div>
            `).join('');
        }
        
        resultsDiv.classList.add('show');
    } catch (error) {
        hideLoader();
        console.error('Airport search error:', error);
        showToast('Search Error', 'Failed to search airports', 'error');
    }
}

function selectAirport(type, airport) {
    // Parse airport if it's a string (from onclick HTML)
    if (typeof airport === 'string') {
        airport = JSON.parse(airport.replace(/&quot;/g, '"'));
    }

    state.selectedAirports[type] = airport;

    // Hide results
    document.getElementById(`${type}-results`).classList.remove('show');

    // Clear search input
    document.getElementById(`${type}-search`).value = '';

    // Show selected airport
    const selectedDiv = document.getElementById(`${type}-selected`);
    selectedDiv.innerHTML = `
        <div class="selected-header">
            <div class="selected-icao">${airport.icao}</div>
            <button class="remove-btn" onclick="removeAirport('${type}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="selected-name">${airport.name}</div>
        <div class="selected-details">
            <div class="detail-item">
                <div class="detail-label">City</div>
                <div class="detail-value">${airport.city || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Country</div>
                <div class="detail-value">${airport.country || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Latitude</div>
                <div class="detail-value">${airport.lat?.toFixed(4) || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Longitude</div>
                <div class="detail-value">${airport.lon?.toFixed(4) || 'N/A'}</div>
            </div>
        </div>
    `;
    selectedDiv.classList.add('show');

    // Update map
    updateMapMarkers();

    console.log(`✈️  Selected ${type}: ${airport.icao}`);
}

function removeAirport(type) {
    state.selectedAirports[type] = null;
    document.getElementById(`${type}-selected`).classList.remove('show');
    
    // Remove map marker
    if (state.markers[type]) {
        state.map.removeLayer(state.markers[type]);
        state.markers[type] = null;
    }
    
    updateMapMarkers();
}

function updateMapMarkers() {
    // Clear existing route line
    if (state.routeLine) {
        state.map.removeLayer(state.routeLine);
        state.routeLine = null;
    }

    // Update departure marker
    if (state.selectedAirports.departure) {
        if (state.markers.departure) {
            state.map.removeLayer(state.markers.departure);
        }
        
        const dep = state.selectedAirports.departure;
        state.markers.departure = L.marker([dep.lat, dep.lon], {
            icon: L.divIcon({
                html: `<div style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${dep.icao}</div>`,
                className: 'custom-marker',
                iconSize: [60, 30],
                iconAnchor: [30, 15]
            })
        }).addTo(state.map).bindPopup(`<strong>${dep.icao}</strong><br>${dep.name}`);
    }

    // Update arrival marker
    if (state.selectedAirports.arrival) {
        if (state.markers.arrival) {
            state.map.removeLayer(state.markers.arrival);
        }
        
        const arr = state.selectedAirports.arrival;
        state.markers.arrival = L.marker([arr.lat, arr.lon], {
            icon: L.divIcon({
                html: `<div style="background: #f44336; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${arr.icao}</div>`,
                className: 'custom-marker',
                iconSize: [60, 30],
                iconAnchor: [30, 15]
            })
        }).addTo(state.map).bindPopup(`<strong>${arr.icao}</strong><br>${arr.name}`);
    }

    // Draw route line if both airports are selected
    if (state.selectedAirports.departure && state.selectedAirports.arrival) {
        const dep = state.selectedAirports.departure;
        const arr = state.selectedAirports.arrival;
        
        state.routeLine = L.polyline([
            [dep.lat, dep.lon],
            [arr.lat, arr.lon]
        ], {
            color: '#2196f3',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10'
        }).addTo(state.map);

        // Fit bounds to show both airports
        const bounds = L.latLngBounds([[dep.lat, dep.lon], [arr.lat, arr.lon]]);
        state.map.fitBounds(bounds, { padding: [50, 50] });

        // Calculate and display distance
        const distance = calculateDistance(dep.lat, dep.lon, arr.lat, arr.lon);
        const heading = calculateBearing(dep.lat, dep.lon, arr.lat, arr.lon);
        
        document.getElementById('route-distance').textContent = `${Math.round(distance)} NM`;
        document.getElementById('route-heading').textContent = `${Math.round(heading)}°`;
    }
}

/* ===================================================================
   AIRCRAFT DATABASE
   =================================================================== */

async function loadAircraftDatabase() {
    try {
        const response = await fetch('/api/aircraft');
        state.aircraftDatabase = await response.json();
        console.log('✈️  Aircraft database loaded:', Object.keys(state.aircraftDatabase));
    } catch (error) {
        console.error('Failed to load aircraft database:', error);
        showToast('Database Error', 'Failed to load aircraft database', 'error');
    }
}

function loadAircraftCategory(category) {
    const aircraftSelect = document.getElementById('aircraft-type');
    aircraftSelect.innerHTML = '<option value="">Select Aircraft</option>';
    
    const specsDiv = document.getElementById('aircraft-specs');
    specsDiv.classList.remove('show');

    if (!category || !state.aircraftDatabase[category]) {
        return;
    }

    state.aircraftDatabase[category].forEach(aircraft => {
        const option = document.createElement('option');
        option.value = JSON.stringify(aircraft);
        option.textContent = `${aircraft.name} (${aircraft.icao})`;
        aircraftSelect.appendChild(option);
    });
}

function selectAircraft(aircraftJSON) {
    if (!aircraftJSON) {
        document.getElementById('aircraft-specs').classList.remove('show');
        state.selectedAircraft = null;
        return;
    }

    state.selectedAircraft = JSON.parse(aircraftJSON);
    const aircraft = state.selectedAircraft;

    // Display aircraft specs
    const specsDiv = document.getElementById('aircraft-specs');
    specsDiv.innerHTML = `
        <div class="specs-grid">
            <div class="spec-item">
                <span class="spec-label">Cruise Speed</span>
                <span class="spec-value">${aircraft.cruiseSpeed} kts</span>
            </div>
            <div class="spec-item">
                <span class="spec-label">Fuel Burn</span>
                <span class="spec-value">${aircraft.fuelBurn} lbs/hr</span>
            </div>
            <div class="spec-item">
                <span class="spec-label">Max Altitude</span>
                <span class="spec-value">FL${Math.floor(aircraft.maxAltitude / 100)}</span>
            </div>
            <div class="spec-item">
                <span class="spec-label">ICAO Code</span>
                <span class="spec-value">${aircraft.icao}</span>
            </div>
        </div>
    `;
    specsDiv.classList.add('show');

    console.log('✈️  Selected aircraft:', aircraft.name);
}

function autoFillCruiseParams() {
    if (state.selectedAircraft) {
        // Auto-fill cruise speed
        const speedInput = document.getElementById('cruise-speed');
        if (!speedInput.value) {
            speedInput.value = state.selectedAircraft.cruiseSpeed;
        }

        // Suggest optimal cruise altitude
        const altInput = document.getElementById('cruise-altitude');
        if (!altInput.value) {
            const optimalFL = Math.floor(state.selectedAircraft.maxAltitude / 100) - 20;
            altInput.value = optimalFL * 100;
        }
    }
}

/* ===================================================================
   ROUTE CALCULATION
   =================================================================== */

async function calculateRoute() {
    console.log('🔄 Calculate route called');
    
    // Validation
    if (!state.selectedAirports.departure) {
        console.error('❌ No departure airport selected');
        showToast('Validation Error', 'Please select a departure airport', 'error');
        return;
    }

    if (!state.selectedAirports.arrival) {
        console.error('❌ No arrival airport selected');
        showToast('Validation Error', 'Please select an arrival airport', 'error');
        return;
    }

    if (!state.selectedAircraft) {
        console.error('❌ No aircraft selected');
        showToast('Validation Error', 'Please select an aircraft', 'error');
        return;
    }

    console.log('✅ Validation passed');
    console.log('Departure:', state.selectedAirports.departure);
    console.log('Arrival:', state.selectedAirports.arrival);
    console.log('Aircraft:', state.selectedAircraft);

    const cruiseAltitude = parseInt(document.getElementById('cruise-altitude').value) || state.selectedAircraft.maxAltitude - 2000;
    const cruiseSpeed = parseInt(document.getElementById('cruise-speed').value) || state.selectedAircraft.cruiseSpeed;
    const callsign = document.getElementById('callsign').value || 'N/A';
    const flightDate = document.getElementById('flight-date').value;
    const passengers = parseInt(document.getElementById('passengers').value) || 0;
    const cargo = parseInt(document.getElementById('cargo').value) || 0;
    const routeType = document.getElementById('route-type').value;
    const simulator = document.querySelector('input[name="simulator"]:checked').value;

    console.log('Flight parameters:', { cruiseAltitude, cruiseSpeed, callsign, simulator });

    showLoader();

    try {
        const flightPlan = {
            callsign,
            flightDate,
            departure: state.selectedAirports.departure,
            arrival: state.selectedAirports.arrival,
            aircraft: state.selectedAircraft,
            cruiseAltitude,
            cruiseSpeed,
            passengers,
            cargo,
            routeType,
            simulator
        };

        // Validate coordinates
        if (!flightPlan.departure.lat || !flightPlan.departure.lon) {
            throw new Error('Departure airport coordinates missing');
        }
        if (!flightPlan.arrival.lat || !flightPlan.arrival.lon) {
            throw new Error('Arrival airport coordinates missing');
        }

        console.log('🧮 Calculating distance...');
        
        // Calculate distance and bearing
        const distance = calculateDistance(
            flightPlan.departure.lat,
            flightPlan.departure.lon,
            flightPlan.arrival.lat,
            flightPlan.arrival.lon
        );

        console.log('📏 Distance calculated:', distance, 'NM');

        const heading = calculateBearing(
            flightPlan.departure.lat,
            flightPlan.departure.lon,
            flightPlan.arrival.lat,
            flightPlan.arrival.lon
        );

        console.log('🧭 Heading calculated:', heading, '°');

        // Calculate flight time
        const flightTimeHours = distance / cruiseSpeed;
        const hours = Math.floor(flightTimeHours);
        const minutes = Math.round((flightTimeHours - hours) * 60);

        // Calculate fuel
        const fuelRequired = (state.selectedAircraft.fuelBurn * flightTimeHours * 1.15); // 15% reserve

        // Generate waypoints
        const waypoints = generateWaypoints(
            flightPlan.departure.lat,
            flightPlan.departure.lon,
            flightPlan.arrival.lat,
            flightPlan.arrival.lon
        );

        flightPlan.distance = distance;
        flightPlan.heading = heading;
        flightPlan.flightTime = `${hours}:${minutes.toString().padStart(2, '0')}`;
        flightPlan.fuelRequired = Math.round(fuelRequired);
        flightPlan.waypoints = waypoints;

        state.currentFlightPlan = flightPlan;

        // Update UI
        displayFlightPlan(flightPlan);
        drawRouteOnMap(flightPlan);
        
        // Update map overlay
        document.getElementById('route-distance').textContent = `${Math.round(distance)} NM`;
        document.getElementById('route-heading').textContent = `${Math.round(heading)}°`;
        document.getElementById('route-ete').textContent = flightPlan.flightTime;

        hideLoader();
        showToast('Route Calculated', 'Flight plan generated successfully', 'success');

    } catch (error) {
        hideLoader();
        console.error('Route calculation error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);
        showToast('Calculation Error', `Failed to calculate route: ${error.message}`, 'error');
    }
}

function displayFlightPlan(plan) {
    const displayDiv = document.getElementById('flight-plan-display');
    
    displayDiv.innerHTML = `
        <div class="flight-plan-summary">
            <div class="plan-route">
                <div class="plan-airport">
                    <div class="plan-icao">${plan.departure.icao}</div>
                    <div class="plan-name">${plan.departure.name}</div>
                </div>
                <div class="plan-arrow">
                    <i class="fas fa-long-arrow-alt-right"></i>
                </div>
                <div class="plan-airport">
                    <div class="plan-icao">${plan.arrival.icao}</div>
                    <div class="plan-name">${plan.arrival.name}</div>
                </div>
            </div>
            <div class="plan-stats">
                <div class="stat-item">
                    <div class="stat-label">Distance</div>
                    <div class="stat-value">${Math.round(plan.distance)} NM</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Heading</div>
                    <div class="stat-value">${Math.round(plan.heading)}°</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Flight Time</div>
                    <div class="stat-value">${plan.flightTime}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Fuel Required</div>
                    <div class="stat-value">${plan.fuelRequired.toLocaleString()} lbs</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Cruise FL</div>
                    <div class="stat-value">FL${Math.floor(plan.cruiseAltitude / 100)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Cruise Speed</div>
                    <div class="stat-value">${plan.cruiseSpeed} kts</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Aircraft</div>
                    <div class="stat-value">${plan.aircraft.icao}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Simulator</div>
                    <div class="stat-value">${plan.simulator}</div>
                </div>
            </div>
        </div>
    `;

    // Show export section
    document.getElementById('export-section').classList.remove('hidden');
}

function drawRouteOnMap(plan) {
    // Clear existing waypoint markers
    state.waypointMarkers.forEach(marker => state.map.removeLayer(marker));
    state.waypointMarkers = [];

    // Clear existing route line
    if (state.routeLine) {
        state.map.removeLayer(state.routeLine);
    }

    // Create route points
    const routePoints = [
        [plan.departure.lat, plan.departure.lon],
        ...plan.waypoints.map(wp => [wp.lat, wp.lon]),
        [plan.arrival.lat, plan.arrival.lon]
    ];

    // Draw route line
    state.routeLine = L.polyline(routePoints, {
        color: '#2196f3',
        weight: 3,
        opacity: 0.8
    }).addTo(state.map);

    // Add waypoint markers
    plan.waypoints.forEach((wp, index) => {
        const marker = L.circleMarker([wp.lat, wp.lon], {
            radius: 6,
            fillColor: '#00bcd4',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(state.map).bindPopup(`<strong>WP${index + 1}</strong><br>${wp.name}`);
        
        state.waypointMarkers.push(marker);
    });

    // Fit map to route
    state.map.fitBounds(state.routeLine.getBounds(), { padding: [50, 50] });
}

function generateWaypoints(lat1, lon1, lat2, lon2) {
    const waypoints = [];
    const numWaypoints = 5;
    
    // Waypoint name generation (realistic 5-letter names)
    const consonants = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'];
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    
    function generateWaypointName(lat, lon, index) {
        const latInt = Math.abs(Math.floor(lat * 10));
        const lonInt = Math.abs(Math.floor(lon * 10));
        const seed = (latInt + lonInt + index * 17) % consonants.length;
        
        let name = '';
        for (let i = 0; i < 5; i++) {
            if (i % 2 === 0) {
                const idx = (seed + i * 7) % consonants.length;
                name += consonants[idx];
            } else {
                const idx = (seed + i * 3) % vowels.length;
                name += vowels[idx];
            }
        }
        return name;
    }
    
    for (let i = 1; i <= numWaypoints; i++) {
        const fraction = i / (numWaypoints + 1);
        const lat = lat1 + (lat2 - lat1) * fraction;
        const lon = lon1 + (lon2 - lon1) * fraction;
        
        waypoints.push({
            name: generateWaypointName(lat, lon, i),
            lat: lat,
            lon: lon,
            type: 'waypoint'
        });
    }
    
    return waypoints;
}

/* ===================================================================
   NAVIGATION CALCULATIONS
   =================================================================== */

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    const brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

function toDeg(radians) {
    return radians * 180 / Math.PI;
}

/* ===================================================================
   EXPORT FUNCTIONS
   =================================================================== */

async function exportPMDG() {
    if (!state.currentFlightPlan) {
        showToast('Export Error', 'No flight plan to export', 'error');
        return;
    }

    try {
        showLoader();
        const response = await fetch('/api/export/pmdg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flightPlan: state.currentFlightPlan })
        });

        const blob = await response.blob();
        downloadFile(blob, `${state.currentFlightPlan.departure.icao}${state.currentFlightPlan.arrival.icao}.rte`);
        
        hideLoader();
        showToast('Export Success', 'PMDG route file downloaded', 'success');
    } catch (error) {
        hideLoader();
        console.error('PMDG export error:', error);
        showToast('Export Error', 'Failed to export PMDG route', 'error');
    }
}

async function exportMSFS() {
    if (!state.currentFlightPlan) {
        showToast('Export Error', 'No flight plan to export', 'error');
        return;
    }

    try {
        showLoader();
        const response = await fetch('/api/export/msfs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flightPlan: state.currentFlightPlan })
        });

        const blob = await response.blob();
        downloadFile(blob, `${state.currentFlightPlan.departure.icao}${state.currentFlightPlan.arrival.icao}.pln`);
        
        hideLoader();
        showToast('Export Success', 'MSFS flight plan downloaded', 'success');
    } catch (error) {
        hideLoader();
        console.error('MSFS export error:', error);
        showToast('Export Error', 'Failed to export MSFS plan', 'error');
    }
}

async function exportXPlane() {
    if (!state.currentFlightPlan) {
        showToast('Export Error', 'No flight plan to export', 'error');
        return;
    }

    try {
        showLoader();
        const response = await fetch('/api/export/xplane', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flightPlan: state.currentFlightPlan })
        });

        const blob = await response.blob();
        downloadFile(blob, `${state.currentFlightPlan.departure.icao}${state.currentFlightPlan.arrival.icao}.fms`);
        
        hideLoader();
        showToast('Export Success', 'X-Plane FMS file downloaded', 'success');
    } catch (error) {
        hideLoader();
        console.error('X-Plane export error:', error);
        showToast('Export Error', 'Failed to export X-Plane FMS', 'error');
    }
}

async function exportFSX() {
    if (!state.currentFlightPlan) {
        showToast('Export Error', 'No flight plan to export', 'error');
        return;
    }

    try {
        showLoader();
        const response = await fetch('/api/export/fsx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flightPlan: state.currentFlightPlan })
        });

        const blob = await response.blob();
        downloadFile(blob, `${state.currentFlightPlan.departure.icao}${state.currentFlightPlan.arrival.icao}.pln`);
        
        hideLoader();
        showToast('Export Success', 'FSX/P3D flight plan downloaded', 'success');
    } catch (error) {
        hideLoader();
        console.error('FSX export error:', error);
        showToast('Export Error', 'Failed to export FSX/P3D plan', 'error');
    }
}

async function exportPDF() {
    if (!state.currentFlightPlan) {
        showToast('Export Error', 'No flight plan to export', 'error');
        return;
    }

    try {
        showLoader();
        const response = await fetch('/api/route/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flightPlan: state.currentFlightPlan })
        });

        const blob = await response.blob();
        downloadFile(blob, `FlightBrief_${state.currentFlightPlan.departure.icao}_${state.currentFlightPlan.arrival.icao}.pdf`);
        
        hideLoader();
        showToast('Export Success', 'PDF briefing downloaded', 'success');
    } catch (error) {
        hideLoader();
        console.error('PDF export error:', error);
        showToast('Export Error', 'Failed to export PDF', 'error');
    }
}

function exportJSON() {
    if (!state.currentFlightPlan) {
        showToast('Export Error', 'No flight plan to export', 'error');
        return;
    }

    const json = JSON.stringify(state.currentFlightPlan, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadFile(blob, `FlightPlan_${state.currentFlightPlan.departure.icao}_${state.currentFlightPlan.arrival.icao}.json`);
    
    showToast('Export Success', 'JSON data downloaded', 'success');
}

function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/* ===================================================================
   WEATHER & NOTAM
   =================================================================== */

async function loadWeatherData() {
    const depWeatherDiv = document.getElementById('departure-weather');
    const arrWeatherDiv = document.getElementById('arrival-weather');

    if (!state.selectedAirports.departure && !state.selectedAirports.arrival) {
        return;
    }

    try {
        if (state.selectedAirports.departure) {
            depWeatherDiv.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i> Loading weather data...</div>';
            const weather = await fetchDetailedWeather(state.selectedAirports.departure.icao);
            depWeatherDiv.innerHTML = formatWeatherDisplay(weather);
        }

        if (state.selectedAirports.arrival) {
            arrWeatherDiv.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i> Loading weather data...</div>';
            const weather = await fetchDetailedWeather(state.selectedAirports.arrival.icao);
            arrWeatherDiv.innerHTML = formatWeatherDisplay(weather);
        }
    } catch (error) {
        console.error('Weather fetch error:', error);
        showToast('Weather Error', 'Failed to fetch weather data', 'error');
    }
}

async function fetchDetailedWeather(icao) {
    try {
        // Fetch METAR
        const metarResponse = await fetch(`/api/weather/metar/${icao}`);
        const metarData = await metarResponse.json();
        const metar = metarData[0] || null;
        
        // Fetch TAF
        let taf = null;
        try {
            const tafResponse = await fetch(`/api/weather/taf/${icao}`);
            const tafData = await tafResponse.json();
            taf = tafData[0] || null;
        } catch (e) {
            console.log('TAF not available');
        }
        
        return { metar, taf };
    } catch (error) {
        return { metar: null, taf: null };
    }
}

function formatWeatherDisplay(weather) {
    let html = '';
    
    // METAR Section
    if (weather.metar) {
        const m = weather.metar;
        html += '<div class="weather-block">';
        html += '<div class="weather-header"><i class="fas fa-cloud"></i> METAR</div>';
        html += `<div class="weather-raw">${m.raw_text || 'N/A'}</div>`;
        
        if (m.temp !== undefined || m.wind_speed !== undefined) {
            html += '<div class="weather-decoded">';
            
            if (m.wind_dir && m.wind_speed) {
                html += `<div class="weather-item">`;
                html += `<i class="fas fa-wind"></i> Wind: ${m.wind_dir}° at ${m.wind_speed} kts`;
                if (m.wind_gust) html += ` gusting ${m.wind_gust} kts`;
                html += `</div>`;
            }
            
            if (m.visibility) {
                html += `<div class="weather-item">`;
                html += `<i class="fas fa-eye"></i> Visibility: ${m.visibility >= 9999 ? '10+ km' : (m.visibility / 1000).toFixed(1) + ' km'}`;
                html += `</div>`;
            }
            
            if (m.temp !== undefined && m.dewpoint !== undefined) {
                html += `<div class="weather-item">`;
                html += `<i class="fas fa-temperature-high"></i> Temp: ${m.temp}°C / Dewpoint: ${m.dewpoint}°C`;
                html += `</div>`;
            }
            
            if (m.altimeter) {
                html += `<div class="weather-item">`;
                html += `<i class="fas fa-tachometer-alt"></i> QNH: ${m.altimeter} hPa`;
                html += `</div>`;
            }
            
            if (m.flight_category) {
                const categoryColors = {
                    'VFR': '#4caf50',
                    'MVFR': '#2196f3',
                    'IFR': '#ff9800',
                    'LIFR': '#f44336'
                };
                html += `<div class="weather-item">`;
                html += `<i class="fas fa-flag"></i> Category: <span style="color: ${categoryColors[m.flight_category] || '#fff'}; font-weight: bold;">${m.flight_category}</span>`;
                html += `</div>`;
            }
            
            html += '</div>';
        }
        html += '</div>';
    } else {
        html += '<div class="weather-block">';
        html += '<div class="weather-header"><i class="fas fa-cloud"></i> METAR</div>';
        html += '<div class="no-data">METAR not available</div>';
        html += '</div>';
    }
    
    // TAF Section
    if (weather.taf) {
        html += '<div class="weather-block">';
        html += '<div class="weather-header"><i class="fas fa-cloud-sun"></i> TAF (Forecast)</div>';
        html += `<div class="weather-raw">${weather.taf.raw_text || 'N/A'}</div>`;
        html += '</div>';
    }
    
    return html;
}

async function loadNotamData() {
    const notamDiv = document.getElementById('notam-display');
    
    if (!state.selectedAirports.departure && !state.selectedAirports.arrival) {
        notamDiv.innerHTML = '<div class="no-data">Select airports to view NOTAMs</div>';
        return;
    }

    try {
        notamDiv.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i> Loading NOTAMs...</div>';
        
        let notamsHTML = '';
        
        // Fetch departure NOTAMs
        if (state.selectedAirports.departure) {
            const depNotams = await fetchNotams(state.selectedAirports.departure.icao);
            if (depNotams.length > 0) {
                notamsHTML += `<div class="notam-section">`;
                notamsHTML += `<div class="notam-header"><i class="fas fa-plane-departure"></i> ${state.selectedAirports.departure.icao} - DEPARTURE</div>`;
                depNotams.forEach(notam => {
                    notamsHTML += formatNotam(notam);
                });
                notamsHTML += `</div>`;
            }
        }
        
        // Fetch arrival NOTAMs
        if (state.selectedAirports.arrival) {
            const arrNotams = await fetchNotams(state.selectedAirports.arrival.icao);
            if (arrNotams.length > 0) {
                notamsHTML += `<div class="notam-section">`;
                notamsHTML += `<div class="notam-header"><i class="fas fa-plane-arrival"></i> ${state.selectedAirports.arrival.icao} - ARRIVAL</div>`;
                arrNotams.forEach(notam => {
                    notamsHTML += formatNotam(notam);
                });
                notamsHTML += `</div>`;
            }
        }
        
        if (notamsHTML) {
            notamDiv.innerHTML = notamsHTML;
        } else {
            notamDiv.innerHTML = '<div class="no-data">No NOTAMs available</div>';
        }
        
    } catch (error) {
        console.error('NOTAM fetch error:', error);
        notamDiv.innerHTML = '<div class="no-data">Failed to load NOTAMs</div>';
    }
}

async function fetchNotams(icao) {
    try {
        const response = await fetch(`/api/notam/${icao}`);
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('NOTAM fetch error:', error);
        return [];
    }
}

function formatNotam(notam) {
    return `
        <div class="notam-item">
            <div class="notam-id">${notam.id}</div>
            <div class="notam-message">${notam.message.replace(/\n/g, '<br>')}</div>
            <div class="notam-dates">
                <i class="far fa-calendar"></i> 
                Valid: ${new Date(notam.startDate).toLocaleString()} - ${new Date(notam.endDate).toLocaleString()}
            </div>
        </div>
    `;
}

/* ===================================================================
   UI HELPERS
   =================================================================== */

function clearAll() {
    // Clear airports
    state.selectedAirports.departure = null;
    state.selectedAirports.arrival = null;
    state.selectedAircraft = null;
    state.currentFlightPlan = null;

    // Clear UI
    document.getElementById('departure-selected').classList.remove('show');
    document.getElementById('arrival-selected').classList.remove('show');
    document.getElementById('aircraft-specs').classList.remove('show');
    document.getElementById('flight-plan-display').innerHTML = `
        <div class="no-plan">
            <i class="fas fa-route"></i>
            <p>No route calculated</p>
            <p class="hint">Complete the form and calculate route</p>
        </div>
    `;
    document.getElementById('export-section').classList.add('hidden');

    // Clear form
    document.getElementById('callsign').value = '';
    document.getElementById('departure-search').value = '';
    document.getElementById('arrival-search').value = '';
    document.getElementById('aircraft-category').value = '';
    document.getElementById('aircraft-type').innerHTML = '<option value="">Select Aircraft</option>';
    document.getElementById('cruise-altitude').value = '';
    document.getElementById('cruise-speed').value = '';
    document.getElementById('passengers').value = '';
    document.getElementById('cargo').value = '';

    // Clear map
    if (state.markers.departure) {
        state.map.removeLayer(state.markers.departure);
        state.markers.departure = null;
    }
    if (state.markers.arrival) {
        state.map.removeLayer(state.markers.arrival);
        state.markers.arrival = null;
    }
    if (state.routeLine) {
        state.map.removeLayer(state.routeLine);
        state.routeLine = null;
    }
    state.waypointMarkers.forEach(marker => state.map.removeLayer(marker));
    state.waypointMarkers = [];

    // Reset map view
    state.map.setView([40, 0], 3);

    // Reset map overlay
    document.getElementById('route-distance').textContent = '--- NM';
    document.getElementById('route-heading').textContent = '---°';
    document.getElementById('route-ete').textContent = '--:--';

    showToast('Cleared', 'All data cleared', 'success');
}

function showAdvancedExport() {
    document.getElementById('advanced-export-modal').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function saveExportSettings() {
    // Save settings from modal
    state.exportSettings.pmdg.includeSID = document.getElementById('pmdg-include-sid').checked;
    state.exportSettings.pmdg.includeSTAR = document.getElementById('pmdg-include-star').checked;
    state.exportSettings.pmdg.includeApproach = document.getElementById('pmdg-include-approach').checked;
    
    state.exportSettings.xplane.includeAltitude = document.getElementById('xplane-include-altitude').checked;
    state.exportSettings.xplane.airacCycle = document.getElementById('airac-cycle').value || '2401';
    
    state.exportSettings.pdf.includeWeather = document.getElementById('pdf-include-weather').checked;
    state.exportSettings.pdf.includeNotam = document.getElementById('pdf-include-notam').checked;
    state.exportSettings.pdf.includeCharts = document.getElementById('pdf-include-charts').checked;
    state.exportSettings.pdf.includePerformance = document.getElementById('pdf-include-performance').checked;

    closeModal('advanced-export-modal');
    showToast('Settings Saved', 'Export settings updated', 'success');
}

function toggleRightPanel() {
    const panel = document.querySelector('.panel-right');
    panel.classList.toggle('collapsed');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function showLoader() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icons[type]}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

console.log('✈️  Flight Dispatch System loaded');
