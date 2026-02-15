// Random Trip Generator - Frontend Application

// Configuration - Auth0 credentials
const AUTH0_DOMAIN = 'dev-1ehj4jve7hms4ryl.us.auth0.com';
const AUTH0_CLIENT_ID = 'l4hQxIsh9HvUTCxbUVILpI5dpb6GutHJ';
const AUTH0_AUDIENCE = 'https://dev-1ehj4jve7hms4ryl.us.auth0.com/api/v2/';
const API_BASE = '';

// State
let auth0Client = null;
let isAuthenticated = false;
let userLocation = null;
let currentTrip = null;

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const generateBtn = document.getElementById('generate-btn');
const auth0LoginDiv = document.getElementById('auth0-login');
const userProfileDiv = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const tripDisplay = document.getElementById('trip-display');
const destinationName = document.getElementById('destination-name');
const distanceValue = document.getElementById('distance-value');
const coordinatesValue = document.getElementById('coordinates-value');
const statusMessage = document.getElementById('status-message');
const historySection = document.getElementById('history-section');
const tripsList = document.getElementById('trips-list');

// Initialize Auth0
async function initAuth0() {
  auth0Client = await auth0.createAuth0Client({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: AUTH0_AUDIENCE
    }
  });

  // Check if user is returning from redirect
  if (window.location.search.includes('code=')) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Check authentication status
  isAuthenticated = await auth0Client.isAuthenticated();
  updateAuthUI();

  if (isAuthenticated) {
    loadTripHistory();
  }
}

// Update UI based on auth status
function updateAuthUI() {
  if (isAuthenticated) {
    auth0LoginDiv.classList.add('hidden');
    userProfileDiv.classList.remove('hidden');
    generateBtn.disabled = false;

    // Get user info
    auth0Client.getUser().then(user => {
      if (user) {
        userName.textContent = user.name || user.email;
        userAvatar.src = user.picture || 'https://via.placeholder.com/36';
      }
    });
  } else {
    auth0LoginDiv.classList.remove('hidden');
    userProfileDiv.classList.add('hidden');
    generateBtn.disabled = true;
  }
}

// Get user's location
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        resolve(userLocation);
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// Generate random trip
async function generateRandomTrip() {
  if (!isAuthenticated) {
    showStatus('Please log in to generate a trip', 'error');
    return;
  }

  try {
    // Get user location
    showStatus('Getting your location...', 'info');
    await getUserLocation();

    if (!userLocation) {
      showStatus('Could not get your location. Please enable geolocation.', 'error');
      return;
    }

    // Generate random destination
    generateBtn.classList.add('loading');
    generateBtn.disabled = true;

    const response = await fetch(
      `${API_BASE}/api/random-destination?lat=${userLocation.lat}&lng=${userLocation.lng}`,
      {
        headers: {
          'Authorization': `Bearer ${await auth0Client.getToken()}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to generate destination');
    }

    const tripData = await response.json();
    currentTrip = {
      ...tripData,
      origin_lat: userLocation.lat,
      origin_lng: userLocation.lng
    };

    // Display trip
    displayTrip(currentTrip);

    // Save trip to history
    await saveTrip(currentTrip);

    // Reload history
    await loadTripHistory();

    showStatus('Trip generated successfully!', 'success');

  } catch (error) {
    console.error('Error generating trip:', error);
    showStatus(error.message || 'Failed to generate trip. Please try again.', 'error');
  } finally {
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;
  }
}

// Display trip data
function displayTrip(trip) {
  destinationName.textContent = trip.destination;
  distanceValue.textContent = trip.distance.toLocaleString();
  coordinatesValue.textContent = `${trip.destination_lat.toFixed(4)}, ${trip.destination_lng.toFixed(4)}`;
  tripDisplay.classList.remove('hidden');
}

// Save trip to server
async function saveTrip(trip) {
  try {
    const response = await fetch(`${API_BASE}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth0Client.getToken()}`
      },
      body: JSON.stringify(trip)
    });

    if (!response.ok) {
      throw new Error('Failed to save trip');
    }
  } catch (error) {
    console.error('Error saving trip:', error);
  }
}

// Load trip history
async function loadTripHistory() {
  try {
    const response = await fetch(`${API_BASE}/api/trips`, {
      headers: {
        'Authorization': `Bearer ${await auth0Client.getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load trip history');
    }

    const trips = await response.json();
    displayTripHistory(trips);

  } catch (error) {
    console.error('Error loading trip history:', error);
  }
}

// Display trip history
function displayTripHistory(trips) {
  if (!trips || trips.length === 0) {
    historySection.classList.add('hidden');
    return;
  }

  historySection.classList.remove('hidden');
  tripsList.innerHTML = trips.map(trip => `
    <div class="trip-item">
      <div>
        <div class="trip-item-destination">${trip.destination}</div>
        <div class="trip-item-distance">${Math.round(trip.distance).toLocaleString()} km</div>
      </div>
      <div class="trip-item-date">${new Date(trip.created_at).toLocaleDateString()}</div>
    </div>
  `).join('');
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 5000);
}

// Event Listeners
loginBtn.addEventListener('click', () => {
  auth0Client.loginWithRedirect();
});

logoutBtn.addEventListener('click', () => {
  auth0Client.logout({
    logoutParams: {
      returnTo: window.location.origin
    }
  });
});

generateBtn.addEventListener('click', generateRandomTrip);

// Initialize on page load
document.addEventListener('DOMContentLoaded', initAuth0);
