# 🛰 Starlink Tracker

A live, auto-updating database of all Starlink satellites — tracking active/decayed status, orbital elements, launch dates, and altitude history.

**Stack:** React · FastAPI · PostgreSQL (local) · Python

> 🚧 Currently running locally. Deployment to Cloudflare planned later.

---

## 📁 Project Structure

```
starlink-tracker/
├── backend/
│   ├── main.py          # FastAPI REST API
│   ├── ingest.py        # Data ingestion from CelesTrak + Space-Track
│   ├── database.py      # PostgreSQL connection + query helpers
│   ├── schema.sql       # Local Postgres table definitions
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── SatelliteTable.jsx
│           ├── SatelliteDetail.jsx
│           └── StatsBar.jsx
└── .github/
    └── workflows/
        └── daily-ingest.yml   # Cron (for future use when deployed)
```

---

## 🚀 Local Setup Guide

### 1. PostgreSQL

Make sure PostgreSQL is installed and running on your machine. Then create the database and user:

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE starlink_tracker;
CREATE USER starlink_user WITH PASSWORD 'starlink123';
GRANT ALL PRIVILEGES ON DATABASE starlink_tracker TO starlink_user;
\q
```

Apply the schema:

```bash
psql -U starlink_user -d starlink_tracker -h localhost -f backend/schema.sql
```

### 2. Backend environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://starlink_user:starlink123@localhost:5432/starlink_tracker

# Optional — for launch/decay date enrichment
# Register free at https://www.space-track.org/auth/createAccount
SPACETRACK_USER=your@email.com
SPACETRACK_PASS=yourpassword
```

### 3. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Run the ingestion (first time)

```bash
python ingest.py
```

Pulls all ~7,000+ Starlink satellites from CelesTrak, parses orbital elements from TLE data, and loads everything into your local Postgres. Takes about 1–2 minutes.

### 5. Start the API

```bash
source .venv/bin/activate
uvicorn main:app --reload
```

Or from backend directory with venv already activated:
```bash
uvicorn main:app --reload
```

Interactive API docs at: http://localhost:8000/docs

### 6. Frontend setup

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## 🏃 Running the App

You'll need **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

---

## 🔌 API Endpoints

| Endpoint | Description |
|---|---|
| `GET /satellites` | List all satellites (filterable, paginated) |
| `GET /satellites?search=STARLINK-1234` | Search by name or NORAD ID |
| `GET /satellites?status=active` | Filter: `active` · `decayed` · `decaying` · `unknown` |
| `GET /satellites/{norad_id}` | Single satellite full detail |
| `GET /satellites/{norad_id}/history` | Altitude history (last 90 records) |
| `GET /stats` | Aggregate counts + avg altitude |
| `GET /spacex/rockets/stats` | SpaceX rocket analytics: launches, landings, reusability, missions |

---

## 📊 Data Sources

| Source | Data | Auth |
|---|---|---|
| [CelesTrak](https://celestrak.org) | TLE data, orbital elements | None — free |
| [Space-Track](https://space-track.org) | Launch dates, decay/reentry info | Free account |

---

## 🗺 Roadmap

- [ ] Live 3D position map using `satellite.js` + Three.js
- [ ] Deorbit prediction tracker (perigee trend → estimated reentry date)
- [ ] Launch history grouped by mission
- [ ] Constellation health dashboard (% active by orbital shell)
- [ ] Deploy backend + frontend to Cloudflare
- [ ] GitHub Actions cron for daily auto-update (post-deployment)
- [ ] Email/webhook alerts for mass deorbit events
