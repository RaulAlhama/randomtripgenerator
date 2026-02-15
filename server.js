require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, prepare } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth0 JWT validation middleware
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');

// Auth0 configuration
const authenticate = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256'
});

// Pre-defined list of interesting destinations worldwide
const DESTINATIONS = [
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522 },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
  { name: 'Barcelona, Spain', lat: 41.3851, lng: 2.1734 },
  { name: 'Rome, Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
  { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708 },
  { name: 'Amsterdam, Netherlands', lat: 52.3676, lng: 4.9041 },
  { name: 'Prague, Czech Republic', lat: 50.0755, lng: 14.4378 },
  { name: 'Vienna, Austria', lat: 48.2082, lng: 16.3738 },
  { name: 'Lisbon, Portugal', lat: 38.7223, lng: -9.1393 },
  { name: 'Athens, Greece', lat: 37.9838, lng: 23.7275 },
  { name: 'Copenhagen, Denmark', lat: 55.6761, lng: 12.5683 },
  { name: 'Stockholm, Sweden', lat: 59.3293, lng: 18.0686 },
  { name: 'Berlin, Germany', lat: 52.5200, lng: 13.4050 },
  { name: 'Madrid, Spain', lat: 40.4168, lng: -3.7038 },
  { name: 'Istanbul, Turkey', lat: 41.0082, lng: 28.9784 },
  { name: 'Bangkok, Thailand', lat: 13.7563, lng: 100.5018 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Seoul, South Korea', lat: 37.5665, lng: 126.9780 },
  { name: 'Milan, Italy', lat: 45.4642, lng: 9.1900 },
  { name: 'Munich, Germany', lat: 48.1351, lng: 11.5820 },
  { name: 'Brussels, Belgium', lat: 50.8503, lng: 4.3517 },
  { name: 'Edinburgh, UK', lat: 55.9533, lng: -3.1883 }
];

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// API Routes

// Get user's trip history
app.get('/api/trips', authenticate, (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const trips = prepare(`
      SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);
    res.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// Save a new trip
app.post('/api/trips', authenticate, (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const { destination, origin_lat, origin_lng, destination_lat, destination_lng, distance } = req.body;

    const result = prepare(`
      INSERT INTO trips (user_id, destination, origin_lat, origin_lng, destination_lat, destination_lng, distance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, destination, origin_lat, origin_lng, destination_lat, destination_lng, distance);

    res.json({ id: result.lastInsertRowid, message: 'Trip saved successfully' });
  } catch (error) {
    console.error('Error saving trip:', error);
    res.status(500).json({ error: 'Failed to save trip' });
  }
});

// Generate random destination
app.get('/api/random-destination', authenticate, async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    // Select a random destination from the list
    const randomIndex = Math.floor(Math.random() * DESTINATIONS.length);
    const destination = DESTINATIONS[randomIndex];

    // Calculate distance from user to destination
    const distance = calculateDistance(userLat, userLng, destination.lat, destination.lng);

    res.json({
      destination: destination.name,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      distance: Math.round(distance)
    });
  } catch (error) {
    console.error('Error generating random destination:', error);
    res.status(500).json({ error: 'Failed to generate destination' });
  }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
