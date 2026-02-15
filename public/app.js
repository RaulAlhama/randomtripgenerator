// Random Trip Generator - Frontend Application

// Configuration - Auth0 credentials
const AUTH0_DOMAIN = 'dev-1ehj4jve7hms4ryl.us.auth0.com';
const AUTH0_CLIENT_ID = 'l4hQxIsh9HvUTCxbUVILpI5dpb6GutHJ';
const AUTH0_AUDIENCE = '';
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
const loadingStatus = document.getElementById('loading-status');

// Initialize Auth0
async function initAuth0() {
  console.log('Initializing Auth0...');

  if (typeof auth0 === 'undefined') {
    console.error('Auth0 SDK not loaded');
    loadingStatus.textContent = 'Error: Auth0 SDK not loaded. Please refresh.';
    loadingStatus.className = 'status-message error';
    return;
  }

  try {
    auth0Client = await auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID
    });

    console.log('Auth0 client created');
    loadingStatus.classList.add('hidden');

    // Check if already authenticated (from session)
    isAuthenticated = await auth0Client.isAuthenticated();
    console.log('Is authenticated:', isAuthenticated);

    if (isAuthenticated) {
      await updateAuthUI();
      loadTripHistory();
    }
  } catch (error) {
    console.error('Error initializing Auth0:', error);
    loadingStatus.textContent = 'Error: ' + error.message;
    loadingStatus.className = 'status-message error';
  }
}

// Update UI based on auth status
async function updateAuthUI() {
  if (isAuthenticated) {
    auth0LoginDiv.classList.add('hidden');
    userProfileDiv.classList.remove('hidden');
    generateBtn.disabled = false;

    try {
      const user = await auth0Client.getUser();
      if (user) {
        userName.textContent = user.name || user.email || 'User';
        userAvatar.src = user.picture || 'https://via.placeholder.com/36';
      }
    } catch (e) {
      console.error('Error getting user:', e);
    }
  } else {
    auth0LoginDiv.classList.remove('hidden');
    userProfileDiv.classList.add('hidden');
    generateBtn.disabled = true;
  }
}

// Login using popup
async function login() {
  if (!auth0Client) {
    showStatus('Authentication not ready. Please wait.', 'error');
    return;
  }

  try {
    showStatus('Opening login...', 'info');

    await auth0Client.loginWithPopup({
      authorizationParams: {
        scope: 'openid profile email'
      }
    });

    console.log('Login successful');
    isAuthenticated = true;
    await updateAuthUI();
    loadTripHistory();
    showStatus('Login successful!', 'success');
  } catch (error) {
    console.error('Login error:', error);
    showStatus('Login error: ' + (error.message || 'Unknown'), 'error');
  }
}

// Logout
async function logout() {
  if (!auth0Client) return;

  try {
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
    isAuthenticated = false;
    updateAuthUI();
    showStatus('Logged out successfully', 'success');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Get user's location
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// Generate random trip
async function generateRandomTrip() {
  if (!isAuthenticated) {
    showStatus('Please log in first', 'error');
    return;
  }

  try {
    showStatus('Getting your location...', 'info');
    await getUserLocation();

    if (!userLocation) {
      showStatus('Could not get location', 'error');
      return;
    }

    generateBtn.classList.add('loading');
    generateBtn.disabled = true;

    // Get token for API calls
    const token = await auth0Client.getTokenSilently();

    const response = await fetch(
      `${API_BASE}/api/random-destination?lat=${userLocation.lat}&lng=${userLocation.lng}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate destination');
    }

    const tripData = await response.json();
    currentTrip = {
      ...tripData,
      origin_lat: userLocation.lat,
      origin_lng: userLocation.lng
    };

    displayTrip(currentTrip);
    await saveTrip(currentTrip);
    await loadTripHistory();
    showStatus('Trip generated!', 'success');

  } catch (error) {
    console.error('Error generating trip:', error);
    showStatus(error.message || 'Failed to generate trip', 'error');
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
    const token = await auth0Client.getTokenSilently();

    await fetch(`${API_BASE}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(trip)
    });
  } catch (error) {
    console.error('Error saving trip:', error);
  }
}

// Load trip history
async function loadTripHistory() {
  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch(`${API_BASE}/api/trips`, {
      headers: {
        'Authorization': `Bearer ${token}`
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
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 5000);
}

// Event Listeners
loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
generateBtn.addEventListener('click', generateRandomTrip);

// Initialize
window.addEventListener('load', initAuth0);
