const { Pool } = require('pg');

let pool = null;

async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;
  const useSSL = connectionString && connectionString.includes('neon.tech');

  pool = new Pool({
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: true } : false,
  });

  // Test connection
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        city TEXT,
        country TEXT DEFAULT '',
        theme TEXT DEFAULT 'classic',
        transport_mode TEXT DEFAULT 'driving',
        origin_lat DOUBLE PRECISION,
        origin_lng DOUBLE PRECISION,
        places TEXT,
        route_distance DOUBLE PRECISION,
        route_duration DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)
    `);

    console.log('Database connected and initialized');
  } finally {
    client.release();
  }

  return pool;
}

function getPool() {
  return pool;
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

module.exports = { initDatabase, getPool, query };
