from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
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
        "rockets": rocket_list,
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
