# SpaceX Tracker SX

Track Starlink satellites, SpaceX launches, Falcon boosters, and Dragon capsules from one dashboard.

## Architecture

- `frontend/`: Vite + React client.
- `worker/`: Hono API for edge/runtime deployment.
- `backend/`: FastAPI + ingestion/sync jobs for data collection and DB maintenance.
- `backend/Schema.sql`: PostgreSQL schema.

## Local Run

### 1) Database

```bash
psql "<DATABASE_URL>" -f backend/Schema.sql
```

### 2) Backend API + ingest jobs

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Run data jobs when needed:

```bash
cd backend
source .venv/bin/activate
python ingest.py
python sync_spacex_assets.py
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4) Worker (optional in local dev)

```bash
cd worker
npm install
npm run dev
```

## Environment Variables (`.env`)

### `backend/.env`

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SPACETRACK_USER=your_spacetrack_username
SPACETRACK_PASS=your_spacetrack_password
```



### `worker/.dev.vars` (Wrangler local/dev secrets)

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SPACETRACK_USER=your_spacetrack_username
SPACETRACK_PASS=your_spacetrack_password
```

## Deployment

Deploy the 3 parts independently:

1. `frontend/` static build (`npm run build`).
2. `worker/` edge API (`npx wrangler deploy`) if using Worker runtime.
3. PostgreSQL instance with `backend/Schema.sql` applied.

If you run scheduled refresh jobs in CI, provide:

- `DATABASE_URL`
- `SPACETRACK_USER`
- `SPACETRACK_PASS`

## API Endpoints

### Worker API (`worker/src/index.ts`)

- `GET /`
- `GET /stats`
- `GET /satellites`
- `GET /satellites/:noradId`
- `GET /satellites/:noradId/history`
- `GET /spacex/rockets/stats`
- `GET /spacex/boosters/intel`

### Backend API (`backend/main.py`)

- `GET /`
- `GET /satellites`
- `GET /satellites/{norad_id}`
- `GET /satellites/{norad_id}/history`
- `GET /stats`
- `GET /spacex/rockets/stats`
- `GET /spacex/boosters/intel`
- `GET /boosters`
- `GET /boosters/{serial}`
- `GET /capsules`
- `GET /capsules/{serial}`

## Scraping / Data Middleware

### Starlink ingest (`backend/ingest.py`)

- Authenticates with Space-Track.
- Pulls GP + SATCAT feeds.
- Merges and normalizes orbit/status fields.
- Writes satellites and altitude history into Postgres.

Source site:

- `https://www.space-track.org`

### SpaceX assets sync (`backend/sync_spacex_assets.py`)

- Scrapes embedded JSON from boosters and capsules pages.
- Normalizes status/type/flight/landing fields.
- Upserts into `spacex_boosters` and `spacex_capsules`.

Source sites:

- `https://spacexnow.com/boosters`
- `https://spacexnow.com/capsules`

### API-side enrichment (`backend/main.py` and `worker/src/index.ts`)

- Rocket/launch context pulls from SpaceX API and launch/news sources used by the API layer.

Source sites/APIs used:

- `https://api.spacexdata.com/v4`
- `https://spacexnow.com/stats`
- `https://www.spacex.com/launches/`
- `https://fdo.rocketlaunch.live/json/launches/`

### Github actions for daily ingest/ updating db

- name: Sync SpaceX Assets
- name: Ingest Starlink Data