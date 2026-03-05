from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import re
import requests
from database import fetchall, fetchone

app = FastAPI(title="Starlink Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

SPACEX_API = "https://api.spacexdata.com/v4"
SPACEX_CACHE_TTL = timedelta(minutes=30)
_spacex_cache_data = None
_spacex_cache_time = None
_spacex_booster_cache_data = None
_spacex_booster_cache_time = None


@app.get("/")
def root():
    return {"message": "Starlink Tracker API 🛰", "docs": "/docs"}


@app.get("/satellites")
def list_satellites(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    shell: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
):
    # Build WHERE clauses dynamically
    conditions = []
    params = []

    if status:
        conditions.append("status = %s")
        params.append(status)
    if shell:
        conditions.append("shell = %s")
        params.append(shell)
    if search:
        conditions.append("(name ILIKE %s OR CAST(norad_id AS TEXT) = %s)")
        params.append(f"%{search}%")
        params.append(search)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Get paginated rows
    rows = fetchall(
        f"SELECT * FROM satellites {where} ORDER BY norad_id LIMIT %s OFFSET %s",
        params + [limit, offset],
    )

    # Get total count (same filters, no limit)
    count_row = fetchone(
        f"SELECT COUNT(*) AS total FROM satellites {where}",
        params,
    )

    return {
        "total": count_row["total"],
        "limit": limit,
        "offset": offset,
        "data": [dict(r) for r in rows],
    }


@app.get("/satellites/{norad_id}")
def get_satellite(norad_id: int):
    row = fetchone("SELECT * FROM satellites WHERE norad_id = %s", (norad_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Satellite not found")
    return dict(row)


@app.get("/satellites/{norad_id}/history")
def get_history(norad_id: int):
    rows = fetchall(
        """
        SELECT altitude_km, perigee_km, apogee_km, recorded_at
        FROM satellite_history
        WHERE norad_id = %s
        ORDER BY recorded_at DESC
        LIMIT 90
        """,
        (norad_id,),
    )
    return [dict(r) for r in rows]


@app.get("/stats")
def get_stats():
    row = fetchone(
        """
        SELECT
            COUNT(*)                                        AS total,
            COUNT(*) FILTER (WHERE status = 'active')      AS active,
            COUNT(*) FILTER (WHERE status = 'decayed')     AS decayed,
            COUNT(*) FILTER (WHERE status = 'decaying')    AS decaying,
            COUNT(*) FILTER (WHERE status = 'unknown')     AS unknown,
            ROUND(AVG(altitude_km) FILTER (
                WHERE status = 'active' AND altitude_km IS NOT NULL
            )::numeric, 1)                                 AS avg_altitude_km
        FROM satellites
        """
    )
    return dict(row)


def _pct(part: int, total: int) -> Optional[float]:
    if not total:
        return None
    return round((part / total) * 100, 1)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug


def _extract_meta_description(html: str) -> Optional[str]:
    if not html:
        return None
    match = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return None


def _fetch_launch_page_summary(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return None
        return _extract_meta_description(resp.text)
    except requests.RequestException:
        return None


def _fetch_spacex_rocket_stats():
    rockets_resp = requests.get(f"{SPACEX_API}/rockets", timeout=30)
    launches_resp = requests.post(
        f"{SPACEX_API}/launches/query",
        json={
            "query": {"upcoming": False},
            "options": {
                "pagination": False,
                "sort": {"date_utc": "desc"},
                "select": ["name", "date_utc", "success", "rocket", "cores"],
            },
        },
        timeout=30,
    )
    rockets_resp.raise_for_status()
    launches_resp.raise_for_status()

    rockets = rockets_resp.json()
    launches = launches_resp.json().get("docs", [])
    by_rocket = {r["id"]: r for r in rockets}

    rocket_stats = {
        r["id"]: {
            "rocket_id": r["id"],
            "rocket_name": r["name"],
            "first_flight": r.get("first_flight"),
            "active": r.get("active"),
            "stages": r.get("stages"),
            "boosters": r.get("boosters"),
            "cost_per_launch": r.get("cost_per_launch"),
            "success_rate_pct": r.get("success_rate_pct"),
            "wikipedia": r.get("wikipedia"),
            "total_launches": 0,
            "successful_launches": 0,
            "failed_launches": 0,
            "total_core_flights": 0,
            "booster_landings": 0,
            "reused_core_flights": 0,
            "missions": [],
        }
        for r in rockets
    }

    total_landings = 0
    total_core_flights = 0
    total_reused_core_flights = 0
    total_successful = 0
    recent_launches = []

    for launch in launches:
        rocket_id = launch.get("rocket")
        if rocket_id not in by_rocket:
            continue

        stats = rocket_stats[rocket_id]
        stats["total_launches"] += 1

        if launch.get("success") is True:
            stats["successful_launches"] += 1
            total_successful += 1
        elif launch.get("success") is False:
            stats["failed_launches"] += 1

        stats["missions"].append(
            {
                "name": launch.get("name"),
                "date_utc": launch.get("date_utc"),
                "success": launch.get("success"),
            }
        )

        for core in launch.get("cores") or []:
            stats["total_core_flights"] += 1
            total_core_flights += 1

            if core.get("landing_success") is True:
                stats["booster_landings"] += 1
                total_landings += 1

            if (core.get("flight") or 0) > 1:
                stats["reused_core_flights"] += 1
                total_reused_core_flights += 1

    for launch in launches[:10]:
        rocket_name = by_rocket.get(launch.get("rocket"), {}).get("name")
        slug = _slugify(launch.get("name", ""))
        site_url = f"https://www.spacex.com/launches/{slug}/index.html" if slug else None
        recent_launches.append(
            {
                "name": launch.get("name"),
                "date_utc": launch.get("date_utc"),
                "success": launch.get("success"),
                "rocket_name": rocket_name,
                "site_url": site_url,
                "site_summary": _fetch_launch_page_summary(site_url) if site_url else None,
            }
        )

    rocket_list = []
    for r in rocket_stats.values():
        recent_missions = sorted(
            r["missions"],
            key=lambda m: m.get("date_utc") or "",
            reverse=True,
        )[:8]
        rocket_list.append(
            {
                **r,
                "mission_count": len(r["missions"]),
                "recent_missions": recent_missions,
                "launch_success_rate": _pct(
                    r["successful_launches"], r["total_launches"]
                ),
                "landing_rate": _pct(r["booster_landings"], r["total_core_flights"]),
                "reusability_rate": _pct(
                    r["reused_core_flights"], r["total_core_flights"]
                ),
            }
        )

    rocket_list.sort(key=lambda r: r["mission_count"], reverse=True)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall": {
            "total_rockets": len(rockets),
            "active_rockets": sum(1 for r in rockets if r.get("active")),
            "total_launches": len(launches),
            "successful_launches": total_successful,
            "launch_success_rate": _pct(total_successful, len(launches)),
            "booster_landings": total_landings,
            "landing_rate": _pct(total_landings, total_core_flights),
            "total_core_flights": total_core_flights,
            "reused_core_flights": total_reused_core_flights,
            "reusability_rate": _pct(total_reused_core_flights, total_core_flights),
        },
        "recent_launches": recent_launches,
        "rockets": rocket_list,
    }


def _is_retired_status(status: Optional[str]) -> bool:
    if not status:
        return False
    return status.lower() in {"retired", "lost", "destroyed", "expended", "inactive"}


def _fetch_spacex_booster_intel():
    cores_resp = requests.get(f"{SPACEX_API}/cores", timeout=30)
    landpads_resp = requests.get(f"{SPACEX_API}/landpads", timeout=30)
    ships_resp = requests.get(f"{SPACEX_API}/ships", timeout=30)
    launches_resp = requests.post(
        f"{SPACEX_API}/launches/query",
        json={
            "query": {"upcoming": False},
            "options": {
                "pagination": False,
                "sort": {"date_utc": "desc"},
                "select": [
                    "name",
                    "date_utc",
                    "success",
                    "flight_number",
                    "rocket",
                    "cores",
                ],
            },
        },
        timeout=30,
    )
    rockets_resp = requests.get(f"{SPACEX_API}/rockets", timeout=30)

    cores_resp.raise_for_status()
    landpads_resp.raise_for_status()
    ships_resp.raise_for_status()
    launches_resp.raise_for_status()
    rockets_resp.raise_for_status()

    cores = cores_resp.json()
    landpads = landpads_resp.json()
    ships = ships_resp.json()
    launches = launches_resp.json().get("docs", [])
    rockets = rockets_resp.json()

    by_core = {c["id"]: c for c in cores}
    by_rocket = {r["id"]: r for r in rockets}
    by_landpad = {lp["id"]: lp for lp in landpads}

    booster_stats = {
        c["id"]: {
            "core_id": c["id"],
            "serial": c.get("serial"),
            "status": c.get("status"),
            "type": c.get("type"),
            "block": c.get("block"),
            "reuse_count": c.get("reuse_count", 0),
            "rtls_attempts": c.get("rtls_attempts", 0),
            "rtls_landings": c.get("rtls_landings", 0),
            "asds_attempts": c.get("asds_attempts", 0),
            "asds_landings": c.get("asds_landings", 0),
            "last_update": c.get("last_update"),
            "launch_count": 0,
            "landing_success_count": 0,
            "mission_history": [],
        }
        for c in cores
    }

    landpad_usage = {
        lp["id"]: {
            "landpad_id": lp["id"],
            "name": lp.get("name"),
            "full_name": lp.get("full_name"),
            "type": lp.get("type"),
            "locality": lp.get("locality"),
            "region": lp.get("region"),
            "status": lp.get("status"),
            "launches": lp.get("launches", []),
            "landing_attempts": 0,
            "landing_successes": 0,
            "boosters": set(),
        }
        for lp in landpads
    }

    for launch in launches:
        rocket_name = by_rocket.get(launch.get("rocket"), {}).get("name")
        for core_event in launch.get("cores") or []:
            core_id = core_event.get("core")
            if core_id not in by_core:
                continue

            stat = booster_stats[core_id]
            stat["launch_count"] += 1

            landed = core_event.get("landing_success") is True
            if landed:
                stat["landing_success_count"] += 1

            mission = {
                "mission_name": launch.get("name"),
                "date_utc": launch.get("date_utc"),
                "flight_number": launch.get("flight_number"),
                "launch_success": launch.get("success"),
                "core_flight_number": core_event.get("flight"),
                "landing_success": core_event.get("landing_success"),
                "landing_type": "ASDS"
                if core_event.get("landing_type") == "ASDS"
                else ("RTLS" if core_event.get("landing_type") == "RTLS" else core_event.get("landing_type")),
                "landpad_id": core_event.get("landpad"),
                "landpad_name": by_landpad.get(core_event.get("landpad"), {}).get("name"),
                "rocket_name": rocket_name,
            }
            stat["mission_history"].append(mission)

            landpad_id = core_event.get("landpad")
            if landpad_id in landpad_usage:
                landpad_usage[landpad_id]["landing_attempts"] += 1
                if landed:
                    landpad_usage[landpad_id]["landing_successes"] += 1
                serial = stat.get("serial")
                if serial:
                    landpad_usage[landpad_id]["boosters"].add(serial)

    boosters = []
    for booster in booster_stats.values():
        missions = sorted(
            booster["mission_history"],
            key=lambda m: m.get("date_utc") or "",
            reverse=True,
        )
        reused = [m for m in missions if (m.get("core_flight_number") or 0) > 1]
        total_landings = (booster.get("asds_landings") or 0) + (booster.get("rtls_landings") or 0)
        total_landing_attempts = (booster.get("asds_attempts") or 0) + (booster.get("rtls_attempts") or 0)

        boosters.append(
            {
                **booster,
                "mission_count": len(missions),
                "missions_reused": len(reused),
                "is_retired": _is_retired_status(booster.get("status")),
                "landing_rate": _pct(total_landings, total_landing_attempts),
                "recent_missions": missions[:12],
                "reuse_missions": reused[:12],
            }
        )

    boosters.sort(
        key=lambda b: (
            b["mission_count"],
            b.get("reuse_count", 0),
            b.get("landing_success_count", 0),
        ),
        reverse=True,
    )

    landpads_out = []
    for pad in landpad_usage.values():
        landpads_out.append(
            {
                **pad,
                "boosters": sorted(pad["boosters"]),
                "distinct_boosters": len(pad["boosters"]),
                "landing_success_rate": _pct(
                    pad["landing_successes"], pad["landing_attempts"]
                ),
            }
        )
    landpads_out.sort(key=lambda lp: lp["landing_attempts"], reverse=True)

    droneships = []
    for ship in ships:
        roles = ship.get("roles") or []
        if any("ASDS" in str(role).upper() for role in roles):
            droneships.append(
                {
                    "ship_id": ship.get("id"),
                    "name": ship.get("name"),
                    "active": ship.get("active"),
                    "home_port": ship.get("home_port"),
                    "roles": roles,
                    "year_built": ship.get("year_built"),
                    "mass_kg": ship.get("mass_kg"),
                    "model": ship.get("model"),
                    "type": ship.get("type"),
                    "link": ship.get("link"),
                    "image": (ship.get("image") or None),
                }
            )

    total_boosters = len(boosters)
    total_retired = sum(1 for b in boosters if b["is_retired"])
    total_reused = sum(1 for b in boosters if b.get("reuse_count", 0) > 0)
    total_missions = sum(b["mission_count"] for b in boosters)
    total_landings = sum(
        (b.get("asds_landings") or 0) + (b.get("rtls_landings") or 0) for b in boosters
    )
    max_reuse = max((b.get("reuse_count", 0) for b in boosters), default=0)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall": {
            "total_boosters": total_boosters,
            "retired_boosters": total_retired,
            "active_boosters": total_boosters - total_retired,
            "boosters_reused_at_least_once": total_reused,
            "reuse_adoption_rate": _pct(total_reused, total_boosters),
            "total_booster_missions": total_missions,
            "total_booster_landings": total_landings,
            "max_reuse_count": max_reuse,
        },
        "boosters": boosters,
        "landpads": landpads_out,
        "droneships": droneships,
    }


@app.get("/spacex/rockets/stats")
def get_spacex_rocket_stats(refresh: bool = Query(False)):
    global _spacex_cache_data, _spacex_cache_time

    now = datetime.now(timezone.utc)
    cache_valid = (
        _spacex_cache_data is not None
        and _spacex_cache_time is not None
        and (now - _spacex_cache_time) < SPACEX_CACHE_TTL
    )

    if not refresh and cache_valid:
        return _spacex_cache_data

    try:
        data = _fetch_spacex_rocket_stats()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch SpaceX data: {exc}",
        ) from exc

    _spacex_cache_data = data
    _spacex_cache_time = now
    return data


@app.get("/spacex/boosters/intel")
def get_spacex_booster_intel(refresh: bool = Query(False)):
    global _spacex_booster_cache_data, _spacex_booster_cache_time

    now = datetime.now(timezone.utc)
    cache_valid = (
        _spacex_booster_cache_data is not None
        and _spacex_booster_cache_time is not None
        and (now - _spacex_booster_cache_time) < SPACEX_CACHE_TTL
    )

    if not refresh and cache_valid:
        return _spacex_booster_cache_data

    try:
        data = _fetch_spacex_booster_intel()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch SpaceX booster data: {exc}",
        ) from exc

    _spacex_booster_cache_data = data
    _spacex_booster_cache_time = now
    return data
