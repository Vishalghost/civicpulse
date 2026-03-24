const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '../../data/civicpulse.db')

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

// Enable WAL for better performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id          TEXT PRIMARY KEY,
    query_id    TEXT UNIQUE NOT NULL,
    citizen_id  TEXT,
    citizen_phone TEXT,
    ward_id     INTEGER DEFAULT 1,
    district    TEXT DEFAULT 'lucknow',
    category    TEXT NOT NULL,
    description TEXT NOT NULL,
    photo_path  TEXT,
    lat         REAL,
    lng         REAL,
    address     TEXT,
    lang        TEXT DEFAULT 'hi',
    status      TEXT DEFAULT 'open',
    sla_deadline TEXT,
    duplicate_count INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chatbot_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_id  TEXT,
    phone       TEXT,
    message     TEXT NOT NULL,
    reply       TEXT,
    lang        TEXT DEFAULT 'hi',
    emergency   INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS voice_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_id  TEXT,
    phone       TEXT,
    lang        TEXT,
    transcript  TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`)

console.log('[SQLite] Database ready at', DB_PATH)

module.exports = db
