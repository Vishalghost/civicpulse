# CivicPulse UP 🏥
## Community Civic-Health Platform
**Lucknow · Varanasi · Gorakhpur — Hackathon Demo**

---

## 🚀 Quick Start

### Option 1: Run Frontend + Backend separately (Recommended for demo)

**Frontend**
```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:5173
```

**Backend**
```bash
cd backend
npm install
npm run dev
# Runs at http://localhost:3001
# Needs PostgreSQL running (see Docker below)
```

**ML Engine (Python)**
```bash
cd ml-engine
pip install fastapi uvicorn pydantic httpx python-dotenv
uvicorn main:app --reload --port 8000
# Runs at http://localhost:8000
```

### Option 2: Docker Compose (Full stack)
```bash
docker-compose up --build
# Frontend:  http://localhost:5173
# Backend:   http://localhost:3001
# ML Engine: http://localhost:8000
```

---

## 🗄️ Database Setup

```bash
# Start PostgreSQL (Docker)
docker run -e POSTGRES_USER=civicpulse -e POSTGRES_PASSWORD=civicpulse123 -e POSTGRES_DB=civicpulse -p 5432:5432 -d postgres:15-alpine

# Run migrations
psql postgresql://civicpulse:civicpulse123@localhost:5432/civicpulse -f backend/src/db/migrations/001_init.sql
```

---

## 🎯 Demo Credentials

| Role | Phone | OTP |
|------|-------|-----|
| Citizen | Any 10-digit | 123456 |
| Field Worker | Any 10-digit | 123456 |
| District Official | Any 10-digit | 123456 |

---

## 📱 Demo Scenario

### 1. Citizen Flow
- Login → Select "नागरिक" → Submit drain report
- Get Query ID (e.g., `LKO-2024-00123`)
- Check status → Chat with AI bot
- Type "bahut tez bukhaar" → Emergency detected!

### 2. Worker (Bhojpuri) Flow  
- Login → Select "कर्मचारी"
- Switch language to Bhojpuri (🌾)
- Tap drain pictogram → Voice prompt plays
- Photo → Submit → Success! (Offline works too)

### 3. Official Dashboard
- Login → Select "अधिकारी"
- Ward Map → Red ward (CRITICAL risk)
- SLA Tracker → See breached reports
- Click "Demo: False Closure" → See 400 rejection ✅
- Fill all 4 fields → Successful closure ✅

---

## 🏗️ Architecture

```
Frontend (React + Vite PWA)
    ↓ REST API
Backend (Node.js + Express)
    ↓ SQL
PostgreSQL + Redis
    ↕
Python FastAPI (ML Engine)
```

## ✅ Mandatory Challenges Addressed

| Challenge | Implementation |
|-----------|---------------|
| Anti-Gaming | 4-field evidence validation, rate limit, GPS check, supervisor review |
| AI Outbreak Model | XGBoost + rule-based fallback, ward risk scores, CMO brief |
| Voice Zero-Literacy | Pictogram grid, TTS audio prompts, MediaRecorder, draft save |
| WhatsApp Continuity | Emergency detection → wa.me deep-link + DB session log |
| Community Participation | Impact loop, Ward Watchdog badge, ASHA feedback interface |

## 📊 Key Features

- **6 languages**: Hindi, Bhojpuri, Urdu (i18n)
- **Offline-first**: IndexedDB sync queue, 72h resilience
- **SLA Engine**: 4h → T1 → T2(8h) → T3/CMO(24h) auto-escalation
- **Deduplication**: Cluster reports by ward+category+location
- **Leaflet Maps**: Choropleth risk coloring for 3 districts

---

*CivicPulse UP v1.0 — 24-Hour Social Innovation Hackathon*  
*Smart Cities Mission Directorate × National Health Mission*
