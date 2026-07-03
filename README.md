# SpaceX Tracker SX

A multi-surface SpaceX dashboard for following Starlink satellites, Falcon booster reuse, Dragon capsules, launch activity, and recovery infrastructure from one place.

<table>
  <tr>
    <td align="center" width="50%">
      <img src="Screenshots/260703_20h57m32s_screenshot.png" alt="Home dashboard" width="100%"/>
      <br/><sub>Home</sub>
    </td>
    <td align="center" width="50%">
      <img src="Screenshots/260703_20h58m08s_screenshot.png" alt="Falcon boosters" width="100%"/>
      <br/><sub>Boosters</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="Screenshots/260703_20h58m41s_screenshot.png" alt="Launches timeline" width="100%"/>
      <br/><sub>Launches</sub>
    </td>
    <td align="center" width="50%">
      <img src="Screenshots/260703_20h59m07s_screenshot.png" alt="Starlink satellites" width="100%"/>
      <br/><sub>Starlink</sub>
    </td>
  </tr>
</table>

*Live view of Starlink constellation health, booster reuse stats, launch cadence, and recovery ops.*

## What This Project Is

SpaceX Tracker SX is a personal tracking dashboard backed by a small data pipeline. It combines:

- a React dashboard for browsing the data
- a FastAPI backend for ingest jobs and local development
- a Cloudflare Worker API for production delivery
- a PostgreSQL schema shared across the whole system

## Explore Here

### Starlink

- browse tracked Starlink satellites with search, filtering, sorting, and pagination
- inspect per-satellite records with orbital history snapshots
- view constellation-level stats such as active, decayed, and decaying objects

### Falcon Boosters

- compare boosters by missions, reuse count, landing record, and current status
- open detailed booster views with reuse missions and landing profile
- track fleet-level metrics such as total landings, reuse adoption, and max reuse depth

### Launches

- follow recent and upcoming missions from the same interface
- inspect launch summaries, launch windows, tags, and mission links
- keep booster and Starlink activity grounded in current launch cadence

### Dragon And Ground Infrastructure

- review Dragon capsule status and mission counts
- track landing zones and autonomous drone ships alongside the booster fleet
- keep recovery infrastructure in the same operational picture as the vehicles that depend on it


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
