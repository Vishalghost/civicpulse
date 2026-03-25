-- ═══════════════════════════════════════════════════════════════════════════
-- AGENT 2: PostGIS Production Schema — CivicPulse UP
-- DPDPA 2023 Compliant | Anti-Gaming Hardened
-- Run order: 00_extensions → 01_schema → 02_indexes → 03_triggers → 04_policies
-- ═══════════════════════════════════════════════════════════════════════════

-- ── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy text search on descriptions

-- ── ENUM TYPES ───────────────────────────────────────────────────────────────
CREATE TYPE role_type       AS ENUM ('citizen', 'worker', 'official');
CREATE TYPE report_status   AS ENUM ('submitted', 'assigned', 'in_progress', 'closed', 'rejected', 'escalated');
CREATE TYPE breach_level    AS ENUM ('none', 'warning', 'breach', 'critical');
CREATE TYPE hazard_category AS ENUM ('drain', 'garbage', 'water', 'mosquito', 'sanitation', 'other');
CREATE TYPE risk_level_type AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- ── TABLE: users ─────────────────────────────────────────────────────────────
-- DPDPA 2023: phone stored as SHA256 hash in audit logs; PII minimized
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_hash   TEXT UNIQUE NOT NULL,           -- SHA256(phone) — PII pseudonymized
  role         role_type NOT NULL,
  name         TEXT,                           -- optional; not required for citizens
  ward_id      INTEGER NOT NULL DEFAULT 1,
  district     TEXT NOT NULL DEFAULT 'lucknow',
  lang         TEXT NOT NULL DEFAULT 'hi',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login   TIMESTAMPTZ,
  is_active    BOOLEAN DEFAULT TRUE,
  -- Anti-gaming: tracks closure velocity per worker
  closures_last_hour  INTEGER DEFAULT 0,
  closures_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABLE: reports (PostGIS enabled) ─────────────────────────────────────────
CREATE TABLE reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id          TEXT UNIQUE NOT NULL,              -- LKO-2026-00042
  citizen_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  ward_id           INTEGER NOT NULL,
  district          TEXT NOT NULL,
  category          hazard_category NOT NULL,
  description       TEXT,
  location          GEOGRAPHY(POINT, 4326),            -- PostGIS spatial column
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  address           TEXT,
  photo_url         TEXT,
  voice_note_url    TEXT,
  status            report_status NOT NULL DEFAULT 'submitted',
  duplicate_count   INTEGER NOT NULL DEFAULT 1,
  canonical_id      UUID REFERENCES reports(id),       -- points to original if duplicate
  ai_severity       TEXT,                              -- Gemini-assigned: LOW/MEDIUM/HIGH/CRITICAL
  ai_disease_risk   TEXT[],                            -- ['dengue','typhoid']
  ai_sla_priority   INTEGER DEFAULT 3,
  sla_deadline      TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  closed_by         UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-sync location column from lat/lng
CREATE OR REPLACE FUNCTION sync_report_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sync_report_location
  BEFORE INSERT OR UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION sync_report_location();

-- ── TABLE: sla_records ────────────────────────────────────────────────────────
CREATE TABLE sla_records (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id     UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  breach_level  breach_level NOT NULL DEFAULT 'none',
  escalated_at  TIMESTAMPTZ,
  escalated_to  TEXT,                                  -- official_id or 'CMO'
  notified_via  TEXT[],                                -- ['whatsapp','sms','email']
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id)
);

-- ── TABLE: worker_logs ────────────────────────────────────────────────────────
CREATE TABLE worker_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id      UUID NOT NULL REFERENCES users(id),
  report_id      UUID REFERENCES reports(id),
  action         TEXT NOT NULL,                        -- 'cleanup','inspection','fogging'
  voice_note_url TEXT,
  transcript     TEXT,
  before_photo   TEXT,
  after_photo    TEXT,
  location       GEOGRAPHY(POINT, 4326),
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at      TIMESTAMPTZ,                          -- NULL = pending offline sync
  device_id      TEXT,
  -- Anti-gaming fields
  supervisor_flagged BOOLEAN DEFAULT FALSE,
  flag_reason        TEXT
);

-- ── TABLE: evidence_submissions ──────────────────────────────────────────────
-- Anti-Gaming: evidence linked to report + worker with GPS + timestamp
CREATE TABLE evidence_submissions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id        UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  worker_id        UUID NOT NULL REFERENCES users(id),
  before_photo_url TEXT,
  after_photo_url  TEXT,
  evidence_location GEOGRAPHY(POINT, 4326),
  evidence_lat     DOUBLE PRECISION,
  evidence_lng     DOUBLE PRECISION,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_time      TIMESTAMPTZ,                        -- device-reported timestamp
  time_drift_secs  INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (submitted_at - device_time))::INTEGER
  ) STORED,                                            -- anti-spoofing: flag if > 300
  geofence_valid   BOOLEAN,                            -- set by trigger
  geofence_dist_m  DOUBLE PRECISION                    -- distance from report pin
);

-- Trigger: validate that evidence was captured within 100m of the report pin
CREATE OR REPLACE FUNCTION validate_evidence_geofence()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  report_loc GEOGRAPHY;
  dist_m     DOUBLE PRECISION;
BEGIN
  SELECT location INTO report_loc FROM reports WHERE id = NEW.report_id;
  IF report_loc IS NOT NULL AND NEW.evidence_location IS NOT NULL THEN
    dist_m := ST_Distance(report_loc, NEW.evidence_location);
    NEW.geofence_dist_m := dist_m;
    NEW.geofence_valid := (dist_m <= 100);
  ELSE
    NEW.geofence_valid := FALSE;
    NEW.geofence_dist_m := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_evidence_geofence
  BEFORE INSERT ON evidence_submissions
  FOR EACH ROW EXECUTE FUNCTION validate_evidence_geofence();

-- ── TABLE: ward_risk_scores (ML output) ──────────────────────────────────────
CREATE TABLE ward_risk_scores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_id       INTEGER NOT NULL,
  district      TEXT NOT NULL,
  risk_score    DOUBLE PRECISION NOT NULL,              -- 0.0–1.0
  risk_level    risk_level_type NOT NULL,
  disease_flags TEXT[],                                 -- ['dengue','cholera']
  model_version TEXT DEFAULT 'v1.0',
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- ── TABLE: asha_symptom_logs ──────────────────────────────────────────────────
CREATE TABLE asha_symptom_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ward_id       INTEGER NOT NULL,
  reporter_id   UUID REFERENCES users(id),
  symptom       TEXT NOT NULL,
  severity      TEXT,
  case_count    INTEGER DEFAULT 1,
  household_id  TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLE: chat_sessions ─────────────────────────────────────────────────────
CREATE TABLE chat_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  citizen_id      UUID REFERENCES users(id),
  channel         TEXT DEFAULT 'app',                  -- 'app' | 'whatsapp'
  ward_id         INTEGER,
  history         JSONB DEFAULT '[]',                  -- full message array
  emergency       BOOLEAN DEFAULT FALSE,
  escalated_at    TIMESTAMPTZ,
  whatsapp_thread TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLE: audit_log (DPDPA 2023 Compliance) ─────────────────────────────────
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   UUID,
  action      TEXT NOT NULL,                           -- INSERT/UPDATE/DELETE
  actor_id    UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLE: blockchain_seva_points ─────────────────────────────────────────────
CREATE TABLE blockchain_seva_points (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  citizen_id      UUID NOT NULL REFERENCES users(id),
  report_id       UUID REFERENCES reports(id),
  points_awarded  INTEGER NOT NULL DEFAULT 0,
  tx_hash         TEXT,                                -- on-chain transaction hash
  chain           TEXT DEFAULT 'polygon_mumbai',
  minted_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- SPATIAL INDEXES (critical for map query performance)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_reports_location    ON reports       USING GIST(location);
CREATE INDEX idx_reports_ward_status ON reports       (ward_id, status);
CREATE INDEX idx_reports_created     ON reports       (created_at DESC);
CREATE INDEX idx_worker_log_location ON worker_logs   USING GIST(location);
CREATE INDEX idx_evidence_location   ON evidence_submissions USING GIST(evidence_location);
CREATE INDEX idx_risk_ward           ON ward_risk_scores (ward_id, computed_at DESC);
CREATE INDEX idx_symptom_ward        ON asha_symptom_logs (ward_id, logged_at DESC);
CREATE INDEX idx_reports_desc_trgm   ON reports       USING GIN(description gin_trgm_ops);

-- ══════════════════════════════════════════════════════════════════════════════
-- ANTI-GAMING: Stored Procedures
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Close-rate limiter: max 5 closures / worker / hour
CREATE OR REPLACE FUNCTION check_closure_rate_limit(p_worker_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  recent_closures INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_closures
  FROM worker_logs
  WHERE worker_id = p_worker_id
    AND action = 'close'
    AND logged_at > NOW() - INTERVAL '1 hour';
  RETURN recent_closures < 5;
END;
$$;

-- 2. Timestamp spoofing detector: flag if device_time > 5 min from server
CREATE OR REPLACE FUNCTION flag_timestamp_spoofing()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.device_time IS NOT NULL AND ABS(EXTRACT(EPOCH FROM (NOW() - NEW.device_time))) > 300 THEN
    NEW.supervisor_flagged := TRUE;
    NEW.flag_reason := 'TIMESTAMP_DRIFT: ' || ROUND(EXTRACT(EPOCH FROM (NOW() - NEW.device_time))) || 's';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_timestamp_spoofing
  BEFORE INSERT ON worker_logs
  FOR EACH ROW EXECUTE FUNCTION flag_timestamp_spoofing();

-- 3. Duplicate report deduplication: 50m radius + same category in 24h
CREATE OR REPLACE FUNCTION find_duplicate_report(
  p_ward_id INTEGER, p_category hazard_category,
  p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  existing_id UUID;
BEGIN
  SELECT r.id INTO existing_id
  FROM reports r
  WHERE r.ward_id = p_ward_id
    AND r.category = p_category
    AND r.status NOT IN ('closed', 'rejected')
    AND r.created_at > NOW() - INTERVAL '24 hours'
    AND ST_DWithin(
      r.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      50   -- 50 metre dedup radius
    )
  ORDER BY r.created_at ASC
  LIMIT 1;
  RETURN existing_id;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (DPDPA 2023)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Citizens can only see their own reports
CREATE POLICY citizen_own_reports ON reports
  FOR SELECT USING (
    citizen_id = current_setting('app.user_id', TRUE)::UUID
    OR status NOT IN ('submitted')  -- public board shows non-draft
  );

-- Workers see only their ward
CREATE POLICY worker_ward_reports ON reports
  FOR SELECT USING (
    ward_id::TEXT = current_setting('app.user_ward_id', TRUE)
  );
