-- ============================================================
-- Starlink Tracker — Local PostgreSQL Schema
-- Run this once:
--   psql -U starlink_user -d starlink_tracker -h localhost -f schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS satellites (
    norad_id          INTEGER PRIMARY KEY,
    name              TEXT NOT NULL,
    intl_designator   TEXT,
    launch_date       DATE,
    decay_date        DATE,
    status            TEXT DEFAULT 'unknown'
                      CHECK (status IN ('active', 'decayed', 'decaying', 'unknown')),
    shell             INTEGER DEFAULT 0,

    -- Orbital elements (updated daily by ingest.py)
    altitude_km       NUMERIC(8,1),
    apogee_km         NUMERIC(8,1),
    perigee_km        NUMERIC(8,1),
    inclination       NUMERIC(7,4),
    mean_motion       NUMERIC(12,8),
    eccentricity      NUMERIC(10,7),
    period_min        NUMERIC(8,2),

    -- Raw TLE strings
    tle_line1         TEXT,
    tle_line2         TEXT,
    tle_updated_at    TIMESTAMPTZ,

    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Daily altitude snapshots per satellite (for trend charts)
CREATE TABLE IF NOT EXISTS satellite_history (
    id          BIGSERIAL PRIMARY KEY,
    norad_id    INTEGER NOT NULL REFERENCES satellites(norad_id) ON DELETE CASCADE,
    altitude_km NUMERIC(8,1),
    perigee_km  NUMERIC(8,1),
    apogee_km   NUMERIC(8,1),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_satellites_status  ON satellites(status);
CREATE INDEX IF NOT EXISTS idx_satellites_shell   ON satellites(shell);
CREATE INDEX IF NOT EXISTS idx_satellites_name    ON satellites USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_history_norad      ON satellite_history(norad_id);
CREATE INDEX IF NOT EXISTS idx_history_recorded   ON satellite_history(recorded_at DESC);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS satellites_updated_at ON satellites;
CREATE TRIGGER satellites_updated_at
    BEFORE UPDATE ON satellites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==============================
-- SpaceX assets (no scraping)
-- ==============================
CREATE TABLE IF NOT EXISTS spacex_boosters (
    serial               TEXT PRIMARY KEY,
    vehicle              TEXT NOT NULL,
    version              TEXT,
    status               TEXT NOT NULL,
    flights              INTEGER NOT NULL DEFAULT 0,
    comment              TEXT,
    landings_success     INTEGER NOT NULL DEFAULT 0,
    landings_attempts    INTEGER NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spacex_booster_missions (
    id                   BIGSERIAL PRIMARY KEY,
    booster_serial       TEXT NOT NULL REFERENCES spacex_boosters(serial) ON DELETE CASCADE,
    mission_name         TEXT NOT NULL,
    mission_date         DATE,
    landing_site         TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spacex_booster_missions_serial
ON spacex_booster_missions(booster_serial);

CREATE TABLE IF NOT EXISTS spacex_capsules (
    capsule_id           TEXT PRIMARY KEY,
    version              TEXT,
    status               TEXT NOT NULL,
    flights              INTEGER NOT NULL DEFAULT 0,
    comment              TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spacex_capsule_missions (
    id                   BIGSERIAL PRIMARY KEY,
    capsule_id           TEXT NOT NULL REFERENCES spacex_capsules(capsule_id) ON DELETE CASCADE,
    mission_name         TEXT NOT NULL,
    mission_date         DATE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spacex_capsule_missions_capsule
ON spacex_capsule_missions(capsule_id);

CREATE TABLE IF NOT EXISTS spacex_landing_sites (
    site_id              TEXT PRIMARY KEY,
    display_name         TEXT NOT NULL,
    landings_success     INTEGER NOT NULL DEFAULT 0,
    landings_attempts    INTEGER NOT NULL DEFAULT 0,
    additional_info      TEXT
);

-- Quick sanity check
SELECT 'Schema created successfully ✓' AS status;
