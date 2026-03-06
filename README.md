# SpaceX Tracker SX

Track SpaceX launches, Falcon booster reuse, Dragon capsules, and Starlink constellation state in one dashboard.

## Architecture

- `frontend/`: Vite + React UI (deploy to Cloudflare Pages)
- `worker/`: Cloudflare Worker API (TypeScript + Hono)
- `backend/`: Python ingestion/sync scripts for Postgres data maintenance
- `backend/Schema.sql`: PostgreSQL schema (satellites + SpaceX asset tables)

## Runtime Model

- Public API is served from Cloudflare Worker.
- UI is served from Cloudflare Pages.
- Postgres is hosted on Neon.
- Scheduled data refresh runs via GitHub Actions:
  - `backend/ingest.py` (Starlink from Space-Track)
  - `backend/sync_spacex_assets.py` (SpaceX assets)

## Important Security Note

If a database connection string was ever shared publicly, rotate it immediately in Neon and replace all secrets.

## 1) Neon Setup

1. Create a Neon project.
2. Run schema:
   - `psql "<NEON_DATABASE_URL>" -f backend/Schema.sql`
3. Keep your connection URL as a secret only.

## 2) Deploy Worker API (Cloudflare)

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put DATABASE_URL
npx wrangler deploy
```

After deploy, note the Worker URL, for example:
- `https://spacex-tracker-api.<account>.workers.dev`

### Worker routes implemented

- `GET /`
- `GET /stats`
- `GET /satellites`
- `GET /satellites/:noradId`
- `GET /satellites/:noradId/history`
- `GET /spacex/rockets/stats`
- `GET /spacex/boosters/intel`

## 3) Deploy Frontend (Cloudflare Pages)

Build settings:
- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

Environment variable:
- `VITE_API_URL=https://<your-worker-url>`

## 4) GitHub Actions Secrets

Set these in your GitHub repo settings:

- `DATABASE_URL`
- `SPACETRACK_USER`
- `SPACETRACK_PASS`

## 5) Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Worker API (local)

```bash
cd worker
cp .dev.vars.example .dev.vars
# edit .dev.vars with your local/Neon DATABASE_URL
npm install
npm run dev
```

### Python ingest/sync scripts

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python ingest.py
python sync_spacex_assets.py
```

## Current Deployment Recommendation

- Frontend: Cloudflare Pages
- Backend: Cloudflare Workers (`worker/`)
- Database: Neon Postgres
- Scheduled jobs: GitHub Actions
