# 🛰 Starlink Tracker

A live, auto-updating database of all Starlink satellites — tracking active/decayed status, orbital elements, launch dates, and altitude history.

**Stack:** React · FastAPI · Supabase (Postgres) · Deployed on Vercel (free)

---

## 📁 Project Structure

```
starlink-tracker/
├── backend/
│   ├── main.py          # FastAPI REST API
│   ├── ingest.py        # Daily data ingestion (CelesTrak + Space-Track)
│   ├── schema.sql       # Supabase table definitions
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
        └── daily-ingest.yml   # Cron: runs ingestion every day at 6am UTC
```

---

## 🚀 Setup Guide

### 1. Supabase (Database)

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `backend/schema.sql`
3. Copy your **Project URL** and **service_role key** from Settings → API

### 2. Space-Track (for launch/decay dates)

1. Register free at [space-track.org](https://www.space-track.org/auth/createAccount)
2. You'll need your username and password for the env vars

### 3. Backend environment

Create `backend/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SPACETRACK_USER=your@email.com
SPACETRACK_PASS=yourpassword
```

### 4. Run the ingestion (first time)

```bash
cd backend
pip install -r requirements.txt
python ingest.py
```

This will fetch all ~7,000+ Starlink satellites and populate your database. Takes ~1-2 minutes.

### 5. Run the backend locally

```bash
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

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

---

## 🌐 Deployment (Free)

### Backend → Vercel Serverless

1. Create `backend/api/index.py`:
```python
from main import app
```

2. Create `backend/vercel.json`:
```json
{
  "builds": [{ "src": "main.py", "use": "@vercel/python" }],
  "routes": [{ "src": "/(.*)", "dest": "main.py" }]
}
```

3. Deploy: `vercel --prod` from `backend/`
4. Add env vars in Vercel dashboard (Settings → Environment Variables)

### Frontend → Vercel

1. Update `frontend/.env.production`: `VITE_API_URL=https://your-backend.vercel.app`
2. Deploy: `vercel --prod` from `frontend/`

### Auto-update → GitHub Actions

Add these secrets to your GitHub repo (Settings → Secrets → Actions):
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SPACETRACK_USER`
- `SPACETRACK_PASS`

The workflow in `.github/workflows/daily-ingest.yml` will run at 6am UTC every day automatically.

---

## 🔌 API Endpoints

| Endpoint | Description |
|---|---|
| `GET /satellites` | List all satellites (filterable, paginated) |
| `GET /satellites?search=STARLINK-1234` | Search by name or NORAD ID |
| `GET /satellites?status=active` | Filter by status |
| `GET /satellites/{norad_id}` | Single satellite detail |
| `GET /satellites/{norad_id}/history` | Altitude history (up to 90 records) |
| `GET /stats` | Aggregate stats |

---

## 📊 Data Sources

| Source | Data | Auth |
|---|---|---|
| [CelesTrak](https://celestrak.org) | TLE data, orbital elements | None (free) |
| [Space-Track](https://space-track.org) | Launch dates, decay/reentry | Free account |

---

## 🗺 Roadmap (future features)

- [ ] Live 3D position map using `satellite.js` + Three.js
- [ ] Deorbit prediction tracker (altitude trend → estimated reentry)
- [ ] Launch history grouped by mission
- [ ] Constellation health dashboard (% active by shell)
- [ ] Email/webhook alerts for notable events (mass deorbits, new launches)
