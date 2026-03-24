-- ============================================================
-- CivicPulse UP — Database Migrations (All-in-one for hackathon)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Wards
CREATE TABLE IF NOT EXISTS wards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  district VARCHAR(50) NOT NULL,
  geojson TEXT,
  population INTEGER DEFAULT 0,
  risk_score DECIMAL(4,3) DEFAULT 0.0,
  risk_level VARCHAR(20) DEFAULT 'LOW',
  risk_updated_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(15) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('citizen','worker','official')),
  name VARCHAR(100),
  ward_id INTEGER REFERENCES wards(id),
  district VARCHAR(50) DEFAULT 'lucknow',
  preferred_language VARCHAR(10) DEFAULT 'hi',
  aadhaar_hash VARCHAR(64),
  consent_gps BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id VARCHAR(20) UNIQUE NOT NULL,
  citizen_id UUID REFERENCES users(id),
  ward_id INTEGER REFERENCES wards(id),
  category VARCHAR(30) NOT NULL,
  description TEXT,
  photo_url TEXT,
  voice_note_url TEXT,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted','assigned','in_progress','closed','rejected')),
  sla_deadline TIMESTAMP,
  assigned_worker_id UUID REFERENCES users(id),
  assigned_official_id UUID REFERENCES users(id),
  duplicate_of UUID REFERENCES reports(id),
  duplicate_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- SLA Records
CREATE TABLE IF NOT EXISTS sla_records (
  id SERIAL PRIMARY KEY,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  breach_level INTEGER DEFAULT 0,
  breach_at TIMESTAMP,
  notified_citizen BOOLEAN DEFAULT FALSE,
  notified_official BOOLEAN DEFAULT FALSE,
  escalated_to UUID REFERENCES users(id)
);

-- Evidence Submissions
CREATE TABLE IF NOT EXISTS evidence_submissions (
  id SERIAL PRIMARY KEY,
  report_id UUID UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES users(id),
  photo_before TEXT NOT NULL,
  photo_after TEXT NOT NULL,
  geo_lat DECIMAL(9,6) NOT NULL,
  geo_lng DECIMAL(9,6) NOT NULL,
  action_taken TEXT NOT NULL,
  supervisor_review VARCHAR(20) DEFAULT 'pending',
  citizen_rating INTEGER CHECK (citizen_rating BETWEEN 1 AND 5),
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- Worker Logs
CREATE TABLE IF NOT EXISTS worker_logs (
  id SERIAL PRIMARY KEY,
  worker_id UUID REFERENCES users(id),
  activity_type VARCHAR(50),
  voice_transcript TEXT,
  language VARCHAR(10),
  audio_url TEXT,
  geo_lat DECIMAL(9,6),
  geo_lng DECIMAL(9,6),
  photo_url TEXT,
  ward_id INTEGER REFERENCES wards(id),
  synced BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Symptom Reports
CREATE TABLE IF NOT EXISTS symptom_reports (
  id SERIAL PRIMARY KEY,
  worker_log_id INTEGER REFERENCES worker_logs(id),
  ward_id INTEGER REFERENCES wards(id),
  symptom_type VARCHAR(50),
  case_count INTEGER DEFAULT 1,
  age_group VARCHAR(20),
  reported_at TIMESTAMP DEFAULT NOW()
);

-- Ward Risk History
CREATE TABLE IF NOT EXISTS ward_risk_history (
  id SERIAL PRIMARY KEY,
  ward_id INTEGER REFERENCES wards(id),
  risk_score DECIMAL(4,3),
  predicted_diseases TEXT[],
  confidence DECIMAL(4,3),
  feature_snapshot JSONB,
  model_version VARCHAR(20) DEFAULT '1.0',
  predicted_at TIMESTAMP DEFAULT NOW()
);

-- Chatbot Sessions
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  channel VARCHAR(20) DEFAULT 'in_app',
  whatsapp_number VARCHAR(15),
  messages JSONB DEFAULT '[]',
  emergency_flagged BOOLEAN DEFAULT FALSE,
  emergency_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Deduplication clusters
CREATE TABLE IF NOT EXISTS report_clusters (
  cluster_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_report_id UUID REFERENCES reports(id),
  total_reports INTEGER DEFAULT 1,
  urgency_score INTEGER DEFAULT 1,
  ward_id INTEGER REFERENCES wards(id),
  category VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_ward ON reports(ward_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_citizen ON reports(citizen_id);
CREATE INDEX IF NOT EXISTS idx_reports_sla ON reports(sla_deadline) WHERE status NOT IN ('closed','rejected');
CREATE INDEX IF NOT EXISTS idx_worker_logs_worker ON worker_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_sla_records_report ON sla_records(report_id);

-- Seed: Wards
INSERT INTO wards (name, district, population, risk_score, risk_level) VALUES
  ('Ward 12 Aminabad', 'lucknow', 45000, 0.78, 'HIGH'),
  ('Ward 7 Chowk', 'lucknow', 38000, 0.45, 'MEDIUM'),
  ('Ward 3 Sigra', 'varanasi', 29000, 0.20, 'LOW'),
  ('Ward 9 Raptipur', 'gorakhpur', 52000, 0.91, 'CRITICAL'),
  ('Ward 5 Lanka', 'varanasi', 33000, 0.55, 'MEDIUM')
ON CONFLICT DO NOTHING;
