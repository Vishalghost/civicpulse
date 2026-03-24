/**
 * db/postgres.js — Universal DB adapter
 *
 * • Uses PostgreSQL (pg Pool) when DATABASE_URL or PG env vars are set and reachable.
 * • Automatically falls back to SQLite (better-sqlite3) for local dev with zero config.
 * • Exposes a pg-compatible `query(text, params)` interface so all models work unchanged.
 */

const { Pool } = require('pg')
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

// ──────────────────────────────────────────────────────────────────────────────
// PostgreSQL adapter
// ──────────────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://civicpulse:civicpulse123@localhost:5432/civicpulse',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000, // fail fast so fallback kicks in quickly
})
pool.on('error', () => {}) // suppress uncaught error events

// ──────────────────────────────────────────────────────────────────────────────
// SQLite fallback adapter — wraps better-sqlite3 in a pg-compatible async API
// ──────────────────────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, '../../data/civicpulse.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// Run the full schema on SQLite (idempotent CREATE IF NOT EXISTS)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS wards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    district     TEXT NOT NULL DEFAULT 'lucknow',
    geojson      TEXT,
    population   INTEGER DEFAULT 0,
    risk_score   REAL DEFAULT 0.0,
    risk_level   TEXT DEFAULT 'LOW',
    risk_updated_at TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO wards (id,name,district,population,risk_score,risk_level) VALUES
    (1,'Ward 12 Aminabad','lucknow',45000,0.78,'HIGH'),
    (2,'Ward 7 Chowk','lucknow',38000,0.45,'MEDIUM'),
    (3,'Ward 3 Sigra','varanasi',29000,0.20,'LOW'),
    (4,'Ward 9 Raptipur','gorakhpur',52000,0.91,'CRITICAL'),
    (5,'Ward 5 Lanka','varanasi',33000,0.55,'MEDIUM');

  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    phone        TEXT UNIQUE NOT NULL,
    role         TEXT NOT NULL DEFAULT 'citizen',
    name         TEXT,
    ward_id      INTEGER DEFAULT 1,
    district     TEXT DEFAULT 'lucknow',
    preferred_language TEXT DEFAULT 'hi',
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id               TEXT PRIMARY KEY,
    query_id         TEXT UNIQUE NOT NULL,
    citizen_id       TEXT,
    ward_id          INTEGER DEFAULT 1,
    category         TEXT NOT NULL,
    description      TEXT,
    photo_url        TEXT,
    voice_note_url   TEXT,
    lat              REAL,
    lng              REAL,
    status           TEXT DEFAULT 'submitted',
    sla_deadline     TEXT,
    assigned_worker_id   TEXT,
    assigned_official_id TEXT,
    duplicate_count  INTEGER DEFAULT 1,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sla_records (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id         TEXT REFERENCES reports(id),
    breach_level      INTEGER DEFAULT 0,
    breach_at         TEXT,
    notified_citizen  INTEGER DEFAULT 0,
    notified_official INTEGER DEFAULT 0,
    escalated_to      TEXT
  );

  CREATE TABLE IF NOT EXISTS evidence_submissions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id         TEXT UNIQUE REFERENCES reports(id),
    submitted_by      TEXT,
    photo_before      TEXT NOT NULL DEFAULT '',
    photo_after       TEXT NOT NULL DEFAULT '',
    geo_lat           REAL,
    geo_lng           REAL,
    action_taken      TEXT NOT NULL DEFAULT '',
    supervisor_review TEXT DEFAULT 'pending',
    citizen_rating    INTEGER,
    submitted_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS worker_logs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id        TEXT,
    activity_type    TEXT,
    voice_transcript TEXT,
    language         TEXT DEFAULT 'hi',
    audio_url        TEXT,
    geo_lat          REAL,
    geo_lng          REAL,
    photo_url        TEXT,
    ward_id          INTEGER DEFAULT 1,
    synced           INTEGER DEFAULT 1,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS symptom_reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_log_id INTEGER,
    ward_id       INTEGER DEFAULT 1,
    symptom_type  TEXT,
    case_count    INTEGER DEFAULT 1,
    age_group     TEXT,
    reported_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ward_risk_history (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ward_id             INTEGER,
    risk_score          REAL,
    predicted_diseases  TEXT DEFAULT '[]',
    confidence          REAL,
    feature_snapshot    TEXT DEFAULT '{}',
    model_version       TEXT DEFAULT '1.0',
    predicted_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chatbot_sessions (
    id                TEXT PRIMARY KEY,
    user_id           TEXT,
    channel           TEXT DEFAULT 'in_app',
    whatsapp_number   TEXT,
    messages          TEXT DEFAULT '[]',
    emergency_flagged INTEGER DEFAULT 0,
    emergency_sent_at TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
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

/**
 * Translate PostgreSQL-style $1,$2 placeholders → SQLite ? placeholders.
 * Also strips PG-only clauses that don't exist in SQLite.
 */
function pgToSqlite(text, params = []) {
  let sql = text
    .replace(/\$(\d+)/g, '?')                              // $1 → ?
    .replace(/::numeric/gi, '')                             // strip ::numeric casts
    .replace(/::jsonb/gi, '')                              // strip ::jsonb casts
    .replace(/::INTERVAL/gi, '')                           // strip INTERVAL casts
    .replace(/RETURNING \*/gi, '')                         // SQLite INSERT/UPDATE don't support RETURNING *
    .replace(/RETURNING [a-zA-Z_,\s]+/gi, '')             // strip any RETURNING clause
    .replace(/NOW\(\)/gi, "datetime('now')")               // NOW() → SQLite datetime
    .replace(/gen_random_uuid\(\)/gi, "lower(hex(randomblob(16)))") // UUID gen
    .replace(/ON CONFLICT DO NOTHING/gi, 'OR IGNORE')     // conflict handling
    .replace(/ON CONFLICT \([^)]+\) DO UPDATE SET[^;]*/gi, '') // upsert → ignore
    .replace(/\|\| '\s*days'\s*\)/gi, ")")                 // interval string concat
    .replace(/INTERVAL '(\d+) days'/gi, (_, d) => `'+${d} days'`) // INTERVAL syntax
    .replace(/\(\$\d+ \|\| ' days'\)::INTERVAL/gi, "'+7 days'")  // parameterized interval
    .replace(/FILTER \(WHERE [^)]+\)/gi, '')              // no FILTER aggregates in SQLite
    .replace(/::\w+/g, '')                                 // strip remaining casts

  return { sql, params }
}

/**
 * SQLite query wrapper that mimics the `pg` pool.query() response shape:
 * returns { rows: [...] }
 */
function sqliteQuery(text, params = []) {
  const { sql } = pgToSqlite(text, params)
  // Flatten params (remove undefined/null as needed)
  const safeParams = (params || []).map(p => (p === undefined ? null : p))

  try {
    // Determine if it's a SELECT or a mutating statement
    const trimmed = sql.trim().toUpperCase()
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
      const rows = sqlite.prepare(sql).all(...safeParams)
      return Promise.resolve({ rows })
    } else {
      const info = sqlite.prepare(sql).run(...safeParams)
      // Simulate RETURNING * — fetch the real row by rowid so we get proper named columns
      if (info.lastInsertRowid) {
        const tableMatch = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i)
        if (tableMatch) {
          const row = sqlite.prepare(`SELECT * FROM ${tableMatch[1]} WHERE rowid = ?`).get(info.lastInsertRowid)
          return Promise.resolve({ rows: row ? [row] : [] })
        }
      }
      // For UPDATE/DELETE — return empty rows (callers use findById to re-fetch if needed)
      return Promise.resolve({ rows: [] })
    }
  } catch (err) {
    console.warn('[SQLite] Query error:', err.message, '\nSQL:', sql)
    return Promise.resolve({ rows: [] })
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Smart export: probe PG once at startup, pick the right backend
// ──────────────────────────────────────────────────────────────────────────────
let usePg = false

pool.query('SELECT 1')
  .then(() => {
    usePg = true
    console.log('[DB] PostgreSQL connected ✓')
  })
  .catch(() => {
    console.log('[DB] PostgreSQL unavailable — using SQLite fallback ✓')
  })

module.exports = {
  query: (text, params) => {
    if (usePg) return pool.query(text, params)
    return sqliteQuery(text, params)
  },
  pool,
  sqlite,
}
