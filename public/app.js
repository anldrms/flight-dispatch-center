// Global variables
let map;
let routeLine;
let departureMarker;
let arrivalMarker;
let waypointMarkers = [];
let aircraftDatabase = {};
let currentFlightPlan = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await loadAircraftDatabase();
    setupEventListeners();
    console.log('Flight Planner Pro initialized');
});

// Initialize Leaflet map
function initMap() {
    map = L.map('map').setView([40, 0], 3);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add scale
    L.control.scale().addTo(map);
}

// Load aircraft database
async function loadAircraftDatabase() {
    try {
        const response = await fetch('/api/aircraft');
        aircraftDatabase = await response.json();
        console.log('Aircraft database loaded:', aircraftDatabase);
    } catch (error) {
        console.error('Failed to load aircraft database:', error);
        showAlert('Failed to load aircraft database', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Aircraft category change
    document.getElementById('aircraft-category').addEventListener('change', (e) => {
        updateAircraftList(e.target.value);
    });
    
    // Aircraft selection
    document.getElementById('aircraft').addEventListener('change', (e) => {
        updateAircraftInfo(e.target.value);
    });
    
    // Airport inputs
    document.getElementById('departure').addEventListener('input', debounce(async (e) => {
        const icao = e.target.value.toUpperCase();
        if (icao.length === 4) {
            await updateAirportInfo('departure', icao);
        }
    }, 500));
    
    document.getElementById('arrival').addEventListener('input', debounce(async (e) => {
        const icao = e.target.value.toUpperCase();
        if (icao.length === 4) {
            await updateAirportInfo('arrival', icao);
        }
    }, 500));
    
    // Calculate button
    document.getElementById('calculate-btn').addEventListener('click', calculateRoute);
    
    // Clear button
    document.getElementById('clear-btn').addEventListener('click', clearAll);
    
    // Export PDF button
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
    
    // Copy route button
    document.getElementById('copy-route-btn').addEventListener('click', copyRoute);
}

// Update aircraft list based on category
function updateAircraftList(category) {
    const aircraftSelect = document.getElementById('aircraft');
    aircraftSelect.innerHTML = '<option value="">Select an aircraft</option>';
    
    if (!category || !aircraftDatabase[category]) {
        return;
    }
    
    aircraftDatabase[category].forEach(aircraft => {
        const option = document.createElement('option');
        option.value = JSON.stringify(aircraft);
        option.textContent = `${aircraft.name} (${aircraft.icao})`;
        aircraftSelect.appendChild(option);
    });
}

// Update aircraft information display
function updateAircraftInfo(aircraftJson) {
    const infoDiv = document.getElementById('aircraft-info');
    
    if (!aircraftJson) {
        infoDiv.classList.remove('show');
        return;
    }
    
    const aircraft = JSON.parse(aircraftJson);
    
    // Update cruise parameters
    document.getElementById('altitude').value = aircraft.maxAltitude - 2000;
    document.getElementById('speed').value = aircraft.cruiseSpeed;
    
    infoDiv.innerHTML = `
        <strong>${aircraft.name}</strong><br>
        <i class="fas fa-tachometer-alt"></i> Cruise: ${aircraft.cruiseSpeed} kts<br>
        <i class="fas fa-arrow-up"></i> Max Alt: ${aircraft.maxAltitude} ft<br>
        <i class="fas fa-gas-pump"></i> Fuel Burn: ${aircraft.fuelBurn} lbs/hr<br>
        <i class="fas fa-gamepad"></i> ${aircraft.simulator.join(', ')}
    `;
    infoDiv.classList.add('show');
}

// Update airport information
async function updateAirportInfo(type, icao) {
    try {
        const response = await fetch(`/api/airports/${icao}`);
        const airport = await response.json();
        
        const infoDiv = document.getElementById(`${type}-info`);
        infoDiv.innerHTML = `
            <strong>${airport.name}</strong><br>
            <i class="fas fa-map-marker-alt"></i> ${airport.lat.toFixed(4)}°, ${airport.lon.toFixed(4)}°<br>
            <i class="fas fa-mountain"></i> Elevation: ${airport.elevation} ft
        `;
        infoDiv.classList.add('show');
        
        // Update map marker
        if (type === 'departure') {
            if (departureMarker) map.removeLayer(departureMarker);
            departureMarker = L.marker([airport.lat, airport.lon], {
                icon: createIcon('green')
            }).addTo(map).bindPopup(`<b>${airport.icao}</b><br>${airport.name}`);
        } else {
            if (arrivalMarker) map.removeLayer(arrivalMarker);
            arrivalMarker = L.marker([airport.lat, airport.lon], {
                icon: createIcon('red')
            }).addTo(map).bindPopup(`<b>${airport.icao}</b><br>${airport.name}`);
        }
        
        // Adjust map view if both airports are set
        if (departureMarker && arrivalMarker) {
            const bounds = L.latLngBounds([departureMarker.getLatLng(), arrivalMarker.getLatLng()]);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
    } catch (error) {
        console.error(`Failed to load ${type} airport info:`, error);
    }
}

// Calculate route
async function calculateRoute() {
    const departure = document.getElementById('departure').value.toUpperCase();
    const arrival = document.getElementById('arrival').value.toUpperCase();
    const altitude = document.getElementById('altitude').value;
    const speed = document.getElementById('speed').value;
    const aircraftJson = document.getElementById('aircraft').value;
    const simulator = document.getElementById('simulator').value;
    
    if (!departure || !arrival || !aircraftJson) {
        showAlert('Please fill in all required fields', 'warning');
        return;
    }
    
    const aircraft = JSON.parse(aircraftJson);
    
    showLoading(true);
    
    try {
        // Calculate route
        const routeResponse = await fetch('/api/route/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                departure,
                arrival,
                cruiseAltitude: altitude,
                cruiseSpeed: speed,
                aircraft
            })
        });
        
        const route = await routeResponse.json();
        
        // Fetch weather
        const [departureWeather, arrivalWeather] = await Promise.all([
            fetch(`/api/weather/metar/${departure}`).then(r => r.json()).catch(() => null),
            fetch(`/api/weather/metar/${arrival}`).then(r => r.json()).catch(() => null)
        ]);
        
        route.weather = {
            departure: departureWeather,
            arrival: arrivalWeather
        };
        route.simulator = simulator;
        
        currentFlightPlan = route;
        
        // Display results
        displayRoute(route);
        displayWeather(route.weather);
        displayFlightBrief(route);
        drawRouteOnMap(route);
        
        showAlert('Route calculated successfully!', 'success');
        
    } catch (error) {
        console.error('Route calculation failed:', error);
        showAlert('Failed to calculate route: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Display route details
function displayRoute(route) {
    const routeCard = document.getElementById('route-card');
    const routeDetails = document.getElementById('route-details');
    
    const hours = Math.floor(route.flightTime / 60);
    const minutes = Math.round(route.flightTime % 60);
    
    routeDetails.innerHTML = `
        <div class="route-summary">
            <div class="route-item">
                <div class="label"><i class="fas fa-ruler"></i> Distance</div>
                <div class="value">${Math.round(route.distance)} NM</div>
            </div>
            <div class="route-item">
                <div class="label"><i class="fas fa-compass"></i> Heading</div>
                <div class="value">${Math.round(route.heading)}°</div>
            </div>
            <div class="route-item">
                <div class="label"><i class="fas fa-clock"></i> Flight Time</div>
                <div class="value">${hours}h ${minutes}m</div>
            </div>
            <div class="route-item">
                <div class="label"><i class="fas fa-gas-pump"></i> Fuel Required</div>
                <div class="value">${Math.round(route.fuelRequired)} lbs</div>
            </div>
        </div>
        
        <h3 style="margin-top: 20px; color: var(--primary-color);">
            <i class="fas fa-map-signs"></i> Waypoints
        </h3>
        <table class="waypoints-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                </tr>
            </thead>
            <tbody>
                ${route.waypoints.map((wp, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${wp.name}</strong></td>
                        <td>${wp.lat.toFixed(4)}°</td>
                        <td>${wp.lon.toFixed(4)}°</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    routeCard.style.display = 'block';
}

// Display weather information
function displayWeather(weather) {
    const weatherCard = document.getElementById('weather-card');
    const weatherContent = document.getElementById('weather-content');
    
    let html = '';
    
    if (weather.departure && weather.departure.length > 0) {
        const metar = weather.departure[0];
        html += `
            <div class="weather-section">
                <h3><i class="fas fa-plane-departure"></i> Departure Weather</h3>
                <div class="metar-display">${metar.rawOb || 'No METAR available'}</div>
            </div>
        `;
    }
    
    if (weather.arrival && weather.arrival.length > 0) {
        const metar = weather.arrival[0];
        html += `
            <div class="weather-section">
                <h3><i class="fas fa-plane-arrival"></i> Arrival Weather</h3>
                <div class="metar-display">${metar.rawOb || 'No METAR available'}</div>
            </div>
        `;
    }
    
    if (html) {
        weatherContent.innerHTML = html;
        weatherCard.style.display = 'block';
    }
}

// Display flight brief
function displayFlightBrief(route) {
    const briefCard = document.getElementById('flight-brief-card');
    const briefContent = document.getElementById('flight-brief');
    
    const hours = Math.floor(route.flightTime / 60);
    const minutes = Math.round(route.flightTime % 60);
    const fuelReserve = Math.round(route.fuelRequired * 1.1); // 10% extra reserve
    
    briefContent.innerHTML = `
        <div class="brief-section">
            <h3><i class="fas fa-plane"></i> Aircraft & Route</h3>
            <p><strong>Aircraft:</strong> ${route.aircraft.name} (${route.aircraft.icao})</p>
            <p><strong>Simulator:</strong> ${route.simulator || 'All Platforms'}</p>
            <p><strong>Route:</strong> ${route.departure.icao} → ${route.arrival.icao}</p>
            <p><strong>Distance:</strong> ${Math.round(route.distance)} NM</p>
            <p><strong>Initial Heading:</strong> ${Math.round(route.heading)}° (${getCardinalDirection(route.heading)})</p>
        </div>
        
        <div class="brief-section">
            <h3><i class="fas fa-chart-line"></i> Flight Profile</h3>
            <p><strong>Cruise Altitude:</strong> FL${Math.floor(route.cruiseAltitude / 100)}</p>
            <p><strong>Cruise Speed:</strong> ${route.cruiseSpeed} kts</p>
            <p><strong>Estimated Flight Time:</strong> ${hours}h ${minutes}m</p>
            <p><strong>Top of Climb:</strong> ~${Math.round(route.cruiseAltitude / 1000 * 3)} NM</p>
            <p><strong>Top of Descent:</strong> ~${Math.round((route.distance - (route.cruiseAltitude / 1000 * 3)))} NM</p>
        </div>
        
        <div class="brief-section">
            <h3><i class="fas fa-gas-pump"></i> Fuel Planning</h3>
            <p><strong>Trip Fuel:</strong> ${Math.round(route.fuelRequired)} lbs</p>
            <p><strong>Reserve Fuel:</strong> ${Math.round(route.fuelRequired * 0.1)} lbs (10%)</p>
            <p><strong>Total Fuel Required:</strong> ${fuelReserve} lbs</p>
            <p><strong>Recommended Load:</strong> ${fuelReserve + Math.round(route.fuelRequired * 0.1)} lbs (with contingency)</p>
        </div>
    `;
    
    briefCard.style.display = 'block';
    document.getElementById('charts-card').style.display = 'block';
}

// Draw route on map
function drawRouteOnMap(route) {
    // Clear existing route
    if (routeLine) map.removeLayer(routeLine);
    waypointMarkers.forEach(marker => map.removeLayer(marker));
    waypointMarkers = [];
    
    // Create route line
    const routeCoords = [
        [route.departure.lat, route.departure.lon],
        ...route.waypoints.map(wp => [wp.lat, wp.lon]),
        [route.arrival.lat, route.arrival.lon]
    ];
    
    routeLine = L.polyline(routeCoords, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(map);
    
    // Add waypoint markers
    route.waypoints.forEach((wp, idx) => {
        const marker = L.circleMarker([wp.lat, wp.lon], {
            radius: 6,
            fillColor: '#fbbf24',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map).bindPopup(`<b>${wp.name}</b><br>${wp.lat.toFixed(4)}°, ${wp.lon.toFixed(4)}°`);
        
        waypointMarkers.push(marker);
    });
    
    // Fit map to route
    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

// Export to PDF
async function exportToPDF() {
    if (!currentFlightPlan) {
        showAlert('No flight plan to export', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/route/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flightPlan: currentFlightPlan })
        });
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flight-plan-${currentFlightPlan.departure.icao}-${currentFlightPlan.arrival.icao}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showAlert('PDF exported successfully!', 'success');
    } catch (error) {
        console.error('PDF export failed:', error);
        showAlert('Failed to export PDF', 'error');
    } finally {
        showLoading(false);
    }
}

// Copy route to clipboard
function copyRoute() {
    if (!currentFlightPlan) {
        showAlert('No route to copy', 'warning');
        return;
    }
    
    const routeString = `${currentFlightPlan.departure.icao} ${currentFlightPlan.waypoints.map(wp => wp.name).join(' ')} ${currentFlightPlan.arrival.icao}`;
    
    navigator.clipboard.writeText(routeString).then(() => {
        showAlert('Route copied to clipboard!', 'success');
    }).catch(err => {
        showAlert('Failed to copy route', 'error');
    });
}

// Clear all
function clearAll() {
    // Clear form
    document.getElementById('departure').value = '';
    document.getElementById('arrival').value = '';
    document.getElementById('aircraft-category').value = '';
    document.getElementById('aircraft').value = '';
    document.getElementById('altitude').value = '35000';
    document.getElementById('speed').value = '450';
    
    // Clear displays
    document.getElementById('departure-info').classList.remove('show');
    document.getElementById('arrival-info').classList.remove('show');
    document.getElementById('aircraft-info').classList.remove('show');
    document.getElementById('route-card').style.display = 'none';
    document.getElementById('weather-card').style.display = 'none';
    document.getElementById('flight-brief-card').style.display = 'none';
    document.getElementById('charts-card').style.display = 'none';
    
    // Clear map
    if (routeLine) map.removeLayer(routeLine);
    if (departureMarker) map.removeLayer(departureMarker);
    if (arrivalMarker) map.removeLayer(arrivalMarker);
    waypointMarkers.forEach(marker => map.removeLayer(marker));
    waypointMarkers = [];
    departureMarker = null;
    arrivalMarker = null;
    routeLine = null;
    
    map.setView([40, 0], 3);
    
    currentFlightPlan = null;
}

// Helper functions
function createIcon(color) {
    return L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function getCardinalDirection(heading) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(heading / 22.5) % 16;
    return directions[index];
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    
    document.querySelector('.main-content').insertBefore(alertDiv, document.querySelector('.main-content').firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function showAbout() {
    alert('Flight Planner Pro v1.0\n\nA comprehensive flight planning tool for all major flight simulators.\n\nSupports: MSFS2020, X-Plane 12, Prepar3D, FSX, and more!\n\nFeatures:\n- Route calculation\n- Real-time weather (METAR/TAF)\n- Aircraft database\n- Interactive map\n- PDF export\n- Airport charts links');
}

function showHelp() {
    alert('How to use Flight Planner Pro:\n\n1. Select your simulator platform\n2. Enter departure and arrival airport ICAO codes\n3. Choose aircraft category and type\n4. Adjust cruise altitude and speed if needed\n5. Click "Calculate Route"\n6. View route on map, weather, and flight brief\n7. Export to PDF or copy route\n\nTips:\n- Airport codes are 4-letter ICAO codes (e.g., KJFK, EGLL)\n- Altitude is in feet (e.g., 35000)\n- Speed is in knots (e.g., 450)');
}
