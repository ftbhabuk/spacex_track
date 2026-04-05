# SpaceX Tracker SX

Track Starlink satellites, SpaceX launches, Falcon boosters, and Dragon capsules from one dashboard.


https://github.com/user-attachments/assets/b16dcfcf-9b2b-4d32-a72c-1219decd4f1e


![Dashboard Preview](Screenshots/image.png)

## Architecture

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `frontend/` | Vite + React | Dashboard UI |
| `worker/` | Hono + Cloudflare Workers | Edge API (production) |
| `backend/` | FastAPI (Python) | Ingest/sync jobs + local dev API |

`backend/Schema.sql` defines the PostgreSQL schema used by both the worker and backend.

## Local Run

### 1. Database

```bash
psql "<DATABASE_URL>" -f backend/Schema.sql
```

### 2. Backend API (Python)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Run data jobs when needed:

```bash
source .venv/bin/activate
python ingest.py              # Starlink satellite data from Space-Track
python sync_spacex_assets.py  # Booster/capsule data from spacexnow.com
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Worker (Cloudflare Workers local dev)

```bash
cd worker
npm install
npm run dev
```

## Environment Variables

### `backend/.env`

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SPACETRACK_USER=your_username
SPACETRACK_PASS=your_password
```

### `worker/.dev.vars` (local dev only — use Cloudflare dashboard for production secrets)

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
```

### Frontend

`VITE_API_URL` is set at build time. Defaults to `http://localhost:8000` if unset.

For Cloudflare Pages, set it in the dashboard under **Settings → Environment variables**:

```env
VITE_API_URL=https://<your-worker>.workers.dev
```

## Deployment (Cloudflare)

Prerequisites:

```bash
npx wrangler login
```

### Worker (Cloudflare Workers)

```bash
cd worker
npx wrangler deploy
```

Set `DATABASE_URL` as a secret in the Cloudflare dashboard (Workers → Settings → Variables) or via CLI:

```bash
npx wrangler secret put DATABASE_URL
```

### Frontend (Cloudflare Pages)

```bash
cd frontend
VITE_API_URL=https://<your-worker>.workers.dev npm run build
npx wrangler pages deploy dist --project-name starlink-tracker
```

## Data Sources

| Source | Used By | Purpose |
|--------|---------|---------|
| [space-track.org](https://www.space-track.org) | `ingest.py` | GP + SATCAT feeds for Starlink satellites |
| [spacexnow.com/stats](https://spacexnow.com/stats) | Worker + FastAPI | Falcon 9 mission/landing/reflight stats |
| [spacexnow.com/boosters](https://spacexnow.com/boosters) | `sync_spacex_assets.py` | Per-booster flight/landing data |
| [spacexnow.com/capsules](https://spacexnow.com/capsules) | `sync_spacex_assets.py` | Per-capsule mission data |
| [rocketlaunch.live](https://fdo.rocketlaunch.live/json/launches) | Worker + FastAPI | Recent + upcoming launches |
| [spacex.com/launches](https://www.spacex.com/launches/) | FastAPI (local) | Launch listing enrichment |

## GitHub Actions

Two scheduled workflows keep the database current:

- **Sync SpaceX Assets** — runs `sync_spacex_assets.py` to update boosters/capsules.
- **Ingest Starlink Data** — runs `ingest.py` to refresh satellite catalog and history.

Requires `DATABASE_URL`, `SPACETRACK_USER`, and `SPACETRACK_PASS` as repository secrets.
