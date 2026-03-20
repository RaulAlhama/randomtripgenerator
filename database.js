const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'trips.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Check if we need to migrate from old schema
  const tableInfo = db.exec("PRAGMA table_info(trips)");
  const columns = tableInfo.length > 0 ? tableInfo[0].values.map(row => row[1]) : [];

  if (columns.length > 0 && !columns.includes('places')) {
    // Old schema detected - drop and recreate
    db.run("DROP TABLE IF EXISTS trips");
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      city TEXT,
      country TEXT DEFAULT '',
      theme TEXT DEFAULT 'classic',
      transport_mode TEXT DEFAULT 'driving',
      origin_lat REAL,
      origin_lng REAL,
      places TEXT,
      route_distance REAL,
      route_duration REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)`);

  saveDatabase();
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDatabase() {
  return db;
}

function prepare(sql) {
  return {
    run: (...params) => {
      db.run(sql, params);
      saveDatabase();
      return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
    },
    all: (...params) => {
      const stmt = db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
}

module.exports = { initDatabase, getDatabase, prepare, saveDatabase };
