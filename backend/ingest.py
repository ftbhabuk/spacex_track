"""
ingest.py — Daily ingestion script for Starlink satellite data.

Data sources:
  - Space-Track GP: TLE + orbital elements for active satellites
  - Space-Track SATCAT: launch/decay catalog for all satellites
    Register at: https://www.space-track.org/auth/createAccount

Run manually:  python ingest.py
Run via cron:  GitHub Actions workflow calls this daily
"""

import requests
import os
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from database import executemany

load_dotenv()

SPACETRACK_LOGIN_URL = "https://www.space-track.org/ajaxauth/login"
SPACETRACK_GP_URL = (
    "https://www.space-track.org/basicspacedata/query/class/gp/OBJECT_NAME/"
    "STARLINK~~/decay_date/null-val/orderby/NORAD_CAT_ID/format/json"
)
SPACETRACK_SATCAT_URL = (
    "https://www.space-track.org/basicspacedata/query/class/satcat/OBJECT_NAME/"
    "STARLINK~~/orderby/NORAD_CAT_ID/format/json"
)


def _to_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_date_str(value):
    if not value:
        return None
    value = str(value).strip()
    return value or None


def fetch_spacetrack() -> list[dict]:
    """Fetch and merge Starlink GP + SATCAT data from Space-Track."""
    user = os.environ.get("SPACETRACK_USER")
    password = os.environ.get("SPACETRACK_PASS")

    if not user or not password:
        print("  ⚠ Missing Space-Track credentials in .env")
        print("    Required: SPACETRACK_USER, SPACETRACK_PASS")
        raise SystemExit(1)

    try:
        session = requests.Session()
        login_resp = session.post(
            SPACETRACK_LOGIN_URL,
            data={"identity": user, "password": password},
            timeout=20,
        )
        if login_resp.status_code != 200:
            print(f"  ✖ Space-Track login failed (HTTP {login_resp.status_code})")
            raise SystemExit(1)
        print("  ✓ Space-Track login successful")

        gp_resp = session.get(SPACETRACK_GP_URL, timeout=60)
        if gp_resp.status_code != 200:
            print(f"  ✖ GP request failed (HTTP {gp_resp.status_code})")
            raise SystemExit(1)
        gp_data = gp_resp.json()
        print(f"  → GP records fetched: {len(gp_data)}")

        time.sleep(2)

        satcat_resp = session.get(SPACETRACK_SATCAT_URL, timeout=60)
        if satcat_resp.status_code != 200:
            print(f"  ✖ SATCAT request failed (HTTP {satcat_resp.status_code})")
            raise SystemExit(1)
        satcat_data = satcat_resp.json()
        print(f"  → SATCAT records fetched: {len(satcat_data)}")

        gp_by_norad = {}
        for gp in gp_data:
            norad_raw = gp.get("NORAD_CAT_ID")
            if not norad_raw:
                continue
            gp_by_norad[int(norad_raw)] = gp

        merged = []
        for sat in satcat_data:
            norad_raw = sat.get("NORAD_CAT_ID")
            if not norad_raw:
                continue
            norad_id = int(norad_raw)
            gp = gp_by_norad.get(norad_id)

            decay_date = _to_date_str(sat.get("DECAY") or (gp.get("DECAY_DATE") if gp else None))
            perigee_km = _to_float((gp.get("PERIAPSIS") or gp.get("PERIGEE")) if gp else None)
            apogee_km = _to_float((gp.get("APOAPSIS") or gp.get("APOGEE")) if gp else None)
            mean_motion = _to_float(gp.get("MEAN_MOTION") if gp else None)

            if gp is None:
                status = "decayed"
            elif perigee_km is not None and perigee_km < 200:
                status = "decaying"
            elif not decay_date:
                status = "active"
            else:
                status = "decayed"

            altitude_km = None
            if apogee_km is not None and perigee_km is not None:
                altitude_km = round((apogee_km + perigee_km) / 2, 1)

            merged.append(
                {
                    "norad_id": norad_id,
                    "name": (sat.get("OBJECT_NAME") or (gp.get("OBJECT_NAME") if gp else "") or "").strip(),
                    "intl_designator": sat.get("INTLDES") or (gp.get("OBJECT_ID") if gp else ""),
                    "launch_date": _to_date_str(sat.get("LAUNCH")),
                    "decay_date": decay_date,
                    "country": sat.get("COUNTRY"),
                    "status": status,
                    "shell": infer_shell(altitude_km),
                    "altitude_km": altitude_km,
                    "apogee_km": apogee_km,
                    "perigee_km": perigee_km,
                    "inclination": _to_float(gp.get("INCLINATION") if gp else None),
                    "mean_motion": mean_motion,
                    "eccentricity": _to_float(gp.get("ECCENTRICITY") if gp else None),
                    "period_min": _to_float(gp.get("PERIOD") if gp else None),
                    "tle_line1": gp.get("TLE_LINE1") if gp else "",
                    "tle_line2": gp.get("TLE_LINE2") if gp else "",
                }
            )

        return merged
    except SystemExit:
        raise
    except Exception as e:
        print(f"  ✖ Space-Track fetch failed: {e}")
        raise SystemExit(1)


def infer_shell(altitude_km: float) -> int:
    """
    Map altitude to Starlink shell number (approximate).
    SpaceX uses several orbital shells at different altitudes.
    """
    if altitude_km is None:
        return 0
    if altitude_km < 340:
        return 1   # Gen 2 mini
    elif altitude_km < 370:
        return 2   # Shell 1
    elif altitude_km < 410:
        return 3   # Shell 2
    elif altitude_km < 480:
        return 4   # Shell 3
    elif altitude_km < 560:
        return 5   # Main shell (original)
    elif altitude_km < 600:
        return 6   # Shell 4
    else:
        return 7   # Higher shells / Polar


def upsert_satellites(satellites: list):
    """Upsert satellite records into local PostgreSQL."""
    now = datetime.now(timezone.utc)
    params_list = []

    for sat in satellites:
        params_list.append(
            (
                sat.get("norad_id"),
                sat.get("name", "").strip(),
                sat.get("intl_designator"),
                sat.get("launch_date"),
                sat.get("decay_date"),
                sat.get("status"),
                sat.get("shell", 0),
                sat.get("altitude_km"),
                sat.get("apogee_km"),
                sat.get("perigee_km"),
                sat.get("inclination"),
                sat.get("mean_motion"),
                sat.get("eccentricity"),
                sat.get("period_min"),
                sat.get("tle_line1", ""),
                sat.get("tle_line2", ""),
                now,
            )
        )

    # Upsert in chunks of 200
    print(f"Upserting {len(params_list)} records to PostgreSQL...")
    chunk_size = 200
    sql = """
        INSERT INTO satellites (
            norad_id, name, intl_designator, launch_date, decay_date, status, shell,
            altitude_km, apogee_km, perigee_km, inclination, mean_motion, eccentricity,
            period_min, tle_line1, tle_line2, tle_updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (norad_id) DO UPDATE SET
            name = EXCLUDED.name,
            intl_designator = EXCLUDED.intl_designator,
            launch_date = EXCLUDED.launch_date,
            decay_date = EXCLUDED.decay_date,
            status = EXCLUDED.status,
            shell = EXCLUDED.shell,
            altitude_km = EXCLUDED.altitude_km,
            apogee_km = EXCLUDED.apogee_km,
            perigee_km = EXCLUDED.perigee_km,
            inclination = EXCLUDED.inclination,
            mean_motion = EXCLUDED.mean_motion,
            eccentricity = EXCLUDED.eccentricity,
            period_min = EXCLUDED.period_min,
            tle_line1 = EXCLUDED.tle_line1,
            tle_line2 = EXCLUDED.tle_line2,
            tle_updated_at = EXCLUDED.tle_updated_at
    """
    for i in range(0, len(params_list), chunk_size):
        chunk = params_list[i : i + chunk_size]
        executemany(sql, chunk)
        print(f"  ✓ Upserted records {i+1}–{i+len(chunk)}")

    print(f"✅ Done. Total upserted: {len(params_list)}")


def save_history_snapshot(satellites: list):
    """Save a daily snapshot of orbital elements for trend tracking."""
    now = datetime.now(timezone.utc)
    params_list = []

    for sat in satellites:
        if sat.get("apogee_km") is None and sat.get("perigee_km") is None:
            continue
        altitude_km = sat.get("altitude_km")
        if altitude_km is None and sat.get("apogee_km") is not None and sat.get("perigee_km") is not None:
            altitude_km = round((sat.get("apogee_km") + sat.get("perigee_km")) / 2, 1)
        params_list.append(
            (
                sat.get("norad_id"),
                altitude_km,
                sat.get("perigee_km"),
                sat.get("apogee_km"),
                now,
            )
        )

    if params_list:
        chunk_size = 200
        sql = """
            INSERT INTO satellite_history (
                norad_id, altitude_km, perigee_km, apogee_km, recorded_at
            ) VALUES (%s, %s, %s, %s, %s)
        """
        for i in range(0, len(params_list), chunk_size):
            executemany(sql, params_list[i:i+chunk_size])
        print(f"  → Saved {len(params_list)} history snapshots")


def run():
    print(f"\n🛰  Starlink Tracker Ingestion — {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}\n")

    # 1. Fetch + merge GP and SATCAT from Space-Track
    satellites = fetch_spacetrack()

    # 2. Upsert into PostgreSQL
    upsert_satellites(satellites)

    # 3. Save daily history snapshot
    save_history_snapshot(satellites)

    print("\n🎉 Ingestion complete!\n")


if __name__ == "__main__":
    run()
