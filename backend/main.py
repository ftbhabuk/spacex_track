from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from html import unescape
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


def _fetch_text_lines(url: str) -> list[str]:
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    html = resp.text
    html = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", html)
    html = re.sub(r"(?i)</(p|div|li|h1|h2|h3|h4|h5|h6|tr|td|section|article|br)>", "\n", html)
    text = re.sub(r"(?is)<[^>]+>", " ", html)
    text = unescape(text)
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return [line for line in lines if line]


def _parse_metric_pair(value: str) -> tuple[Optional[int], Optional[int]]:
    m = re.search(r"([0-9,]+)\s*/\s*([0-9,]+)", value)
    if not m:
        return None, None
    return int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))


def _extract_first_int(value: str) -> Optional[int]:
    m = re.search(r"([0-9,]+)", value)
    if not m:
        return None
    return int(m.group(1).replace(",", ""))


def _fetch_spacexnow_stats() -> dict:
    url = "https://spacexnow.com/stats"
    lines = _fetch_text_lines(url)
    text = " ".join(lines)

    f9_success, f9_total = _parse_metric_pair(
        next((line for line in lines if line.startswith("Falcon 9 ")), "")
    )
    landed_success, landed_attempts = _parse_metric_pair(
        next((line for line in lines if line.startswith("Landed ")), "")
    )
    reflown_total = _extract_first_int(
        next((line for line in lines if line.startswith("Reflown ")), "")
    )
    block5_reflown_total = _extract_first_int(
        next((line for line in lines if "Block 5 reflown" in line), "")
    )

    # Robust fallback on full-page text when heading-based line parse changes.
    if f9_success is None:
        m = re.search(r"Falcon 9\s+([0-9,]+)\s*/\s*([0-9,]+)", text, flags=re.IGNORECASE)
        if m:
            f9_success = int(m.group(1).replace(",", ""))
            f9_total = int(m.group(2).replace(",", ""))
    if landed_success is None:
        m = re.search(r"Landed\s+([0-9,]+)\s*/\s*([0-9,]+)", text, flags=re.IGNORECASE)
        if m:
            landed_success = int(m.group(1).replace(",", ""))
            landed_attempts = int(m.group(2).replace(",", ""))
    if reflown_total is None:
        m = re.search(r"Reflown\s+([0-9,]+)\s+booster reuses", text, flags=re.IGNORECASE)
        if m:
            reflown_total = int(m.group(1).replace(",", ""))

    return {
        "source": "spacexnow.com/stats",
        "source_url": url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "falcon9_successful_missions": f9_success,
        "falcon9_total_missions": f9_total,
        "booster_landed_successes": landed_success,
        "booster_landed_attempts": landed_attempts,
        "booster_reflights": reflown_total,
        "block5_reflights": block5_reflown_total,
    }


def _parse_spacexnow_missions(url: str, limit: int = 200, source_label: str = "spacexnow") -> list[dict]:
    lines = _fetch_text_lines(url)
    missions = []
    ignore_titles = {
        "SpaceXNow",
        "Home",
        "Past",
        "Upcoming",
        "Boosters",
        "Capsules",
        "Stats",
        "Projects",
        "Calendar",
        "Settings",
        "Notifications",
        "Support us",
        "Like this app?",
        "Download for Android",
        "Download for iOS",
    }
    orbit_tokens = {"LEO", "GTO", "SSO", "MEO", "GEO", "HEO", "Polar", "Suborbital", "TBD"}
    landing_tokens = {"ASOG", "JRTI", "OCISLY", "LZ-1", "LZ-2", "LZ-4", "LZ-40", "ASDS", "TBD"}

    idx = 0
    while idx < len(lines):
        line = lines[idx]
        if not line.startswith("By "):
            idx += 1
            continue

        title = lines[idx - 1] if idx > 0 else None
        if not title or title in ignore_titles or title.startswith("Updated"):
            idx += 1
            continue

        rocket_line = lines[idx + 1] if idx + 1 < len(lines) else None
        location_line = lines[idx + 2] if idx + 2 < len(lines) else None
        extra = []
        for j in range(idx + 3, min(idx + 8, len(lines))):
            candidate = lines[j]
            if candidate.startswith("By "):
                break
            extra.append(candidate)

        booster_serial = None
        if rocket_line:
            m = re.search(r"(B[0-9]{4}\.[0-9]+)", rocket_line)
            if m:
                booster_serial = m.group(1)

        orbit = next((x for x in extra if x in orbit_tokens), None)
        landing_site = next((x for x in extra if x in landing_tokens), None)
        reused = any(x.lower() == "reused" for x in extra)

        missions.append(
            {
                "name": title,
                "date_utc": None,
                "provider": line.replace("By ", "").strip(),
                "rocket_line": rocket_line,
                "location": location_line,
                "orbit": orbit,
                "landing_site": landing_site,
                "reused": reused,
                "booster_serial": booster_serial,
                "source": source_label,
                "source_url": url,
            }
        )
        if len(missions) >= limit:
            break
        idx += 1
    return missions


def _base_booster_serial(serial: Optional[str]) -> Optional[str]:
    if not serial:
        return None
    m = re.search(r"(B[0-9]{4})", serial.upper())
    return m.group(1) if m else None


def _status_from_block_text(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ["destroyed", "lost", "expended"]):
        return "lost"
    if "retired" in lowered:
        return "retired"
    if "inactive" in lowered:
        return "inactive"
    if "active" in lowered:
        return "active"
    return "tracked"


def _collect_entity_blocks(lines: list[str], id_pattern: str, max_block_lines: int = 14) -> dict[str, list[str]]:
    blocks = {}
    current_id = None
    current_lines = []
    regex = re.compile(id_pattern, re.IGNORECASE)
    for line in lines:
        m = regex.search(line)
        if m:
            if current_id and current_lines:
                blocks[current_id] = current_lines
            current_id = m.group(1).upper()
            current_lines = [line]
            continue
        if current_id and len(current_lines) < max_block_lines:
            current_lines.append(line)
    if current_id and current_lines:
        blocks[current_id] = current_lines
    return blocks


def _parse_spacexnow_boosters(url: str = "https://spacexnow.com/boosters") -> list[dict]:
    lines = _fetch_text_lines(url)
    blocks = _collect_entity_blocks(lines, r"\b(B[0-9]{4}(?:\.[0-9]+)?)\b")
    boosters = []
    for serial_raw, block_lines in blocks.items():
        block_text = " ".join(block_lines)
        base_serial = _base_booster_serial(serial_raw)
        launches = _extract_first_int(next((l for l in block_lines if "launch" in l.lower()), ""))
        landings = _extract_first_int(next((l for l in block_lines if "landing" in l.lower()), ""))
        reflights = _extract_first_int(next((l for l in block_lines if "reflight" in l.lower() or "reuse" in l.lower()), ""))
        boosters.append(
            {
                "serial": serial_raw,
                "base_serial": base_serial,
                "display_name": base_serial or serial_raw,
                "status": _status_from_block_text(block_text),
                "launches_reported": launches,
                "landings_reported": landings,
                "reflights_reported": reflights,
                "raw_lines": block_lines[:10],
                "source": "spacexnow.com/boosters",
                "source_url": url,
            }
        )
    return boosters


def _parse_spacexnow_capsules(url: str = "https://spacexnow.com/capsules") -> list[dict]:
    lines = _fetch_text_lines(url)
    blocks = _collect_entity_blocks(lines, r"\b(C[0-9]{3})\b")
    capsules = []
    for capsule_id, block_lines in blocks.items():
        block_text = " ".join(block_lines)
        capsules.append(
            {
                "capsule_id": capsule_id,
                "name": next((l for l in block_lines if "dragon" in l.lower()), capsule_id),
                "status": _status_from_block_text(block_text),
                "type": "Dragon Capsule",
                "missions_reported": _extract_first_int(next((l for l in block_lines if "mission" in l.lower()), "")),
                "reuses_reported": _extract_first_int(next((l for l in block_lines if "reuse" in l.lower() or "reflight" in l.lower()), "")),
                "water_landings_reported": _extract_first_int(next((l for l in block_lines if "water landing" in l.lower()), "")),
                "raw_lines": block_lines[:10],
                "source": "spacexnow.com/capsules",
                "source_url": url,
            }
        )
    return capsules


def _extract_og_image(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, timeout=12)
        if resp.status_code != 200:
            return None
        m = re.search(
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            resp.text,
            flags=re.IGNORECASE,
        )
        return m.group(1).strip() if m else None
    except requests.RequestException:
        return None


def _fetch_vehicle_images() -> dict:
    pages = {
        "falcon9": "https://www.spacex.com/vehicles/falcon-9/",
        "falconheavy": "https://www.spacex.com/vehicles/falcon-heavy/",
        "dragon": "https://www.spacex.com/vehicles/dragon/",
        "starship": "https://www.spacex.com/vehicles/starship/",
    }
    return {k: _extract_og_image(v) for k, v in pages.items()}


def _parse_date_utc(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _days_since(value: Optional[datetime]) -> Optional[int]:
    if not value:
        return None
    now = datetime.now(timezone.utc)
    return max((now - value).days, 0)


def _fetch_spacex_launches_listing(limit: int = 10) -> list[dict]:
    url = "https://www.spacex.com/launches/"
    try:
        resp = requests.get(url, timeout=12)
        if resp.status_code != 200:
            return []
        hrefs = re.findall(r'href=["\'](/launches/[^"\']+)["\']', resp.text, flags=re.IGNORECASE)
        items = []
        seen = set()
        for href in hrefs:
            if href in {"/launches", "/launches/"}:
                continue
            normalized = href.split("?")[0]
            if normalized.endswith("/"):
                normalized = normalized[:-1]
            if normalized in seen:
                continue
            seen.add(normalized)
            full_url = f"https://www.spacex.com{normalized}/"
            slug = normalized.rsplit("/", 1)[-1]
            title = slug.replace("-", " ").title()
            items.append(
                {
                    "name": title,
                    "date_utc": None,
                    "success": None,
                    "rocket_name": None,
                    "site_url": full_url,
                    "site_summary": _fetch_launch_page_summary(full_url),
                    "source": "spacex.com/launches",
                }
            )
            if len(items) >= limit:
                break
        return items
    except requests.RequestException:
        return []


def _fetch_falcon9_vehicle_page_stats() -> Optional[dict]:
    url = "https://www.spacex.com/vehicles/falcon-9/"
    try:
        resp = requests.get(url, timeout=12)
        if resp.status_code != 200:
            return None
        text = re.sub(r"<[^>]+>", " ", resp.text)
        text = re.sub(r"\s+", " ", text).strip()

        def extract(label: str) -> Optional[int]:
            patterns = [
                rf"([0-9]{{1,3}}(?:,[0-9]{{3}})*)\s+{label}",
                rf"{label}\s+([0-9]{{1,3}}(?:,[0-9]{{3}})*)",
            ]
            for pattern in patterns:
                m = re.search(pattern, text, flags=re.IGNORECASE)
                if m:
                    return int(m.group(1).replace(",", ""))
            return None

        completed = extract("Completed missions")
        landings = extract("Total landings")
        reflights = extract("Total reflights")

        if completed is None and landings is None and reflights is None:
            return None

        return {
            "completed_missions": completed,
            "total_landings": landings,
            "total_reflights": reflights,
            "source_url": url,
            "source_type": "spacex.com",
        }
    except requests.RequestException:
        return None


def _fetch_spacex_rocket_stats():
    stats = _fetch_spacexnow_stats()
    past = _parse_spacexnow_missions("https://spacexnow.com/past", limit=120, source_label="spacexnow/past")
    upcoming = _parse_spacexnow_missions(
        "https://spacexnow.com/upcoming", limit=40, source_label="spacexnow/upcoming"
    )
    vehicle_images = _fetch_vehicle_images()

    f9_completed = stats.get("falcon9_successful_missions")
    f9_total = stats.get("falcon9_total_missions")
    total_landings = stats.get("booster_landed_successes")
    landed_attempts = stats.get("booster_landed_attempts")
    total_reflights = stats.get("booster_reflights")

    recent_launches = []
    for mission in past[:10]:
        rocket_line = (mission.get("rocket_line") or "").upper()
        image_url = (
            vehicle_images.get("falconheavy")
            if "FH" in rocket_line or "FALCON HEAVY" in rocket_line
            else vehicle_images.get("starship")
            if "STARSHIP" in rocket_line
            else vehicle_images.get("dragon")
            if "DRAGON" in rocket_line
            else vehicle_images.get("falcon9")
        )
        recent_launches.append(
            {
                "name": mission.get("name"),
                "date_utc": None,
                "success": None,
                "rocket_name": mission.get("rocket_line"),
                "site_url": mission.get("source_url"),
                "site_summary": f'Landing: {mission.get("landing_site") or "Unknown"} · Orbit: {mission.get("orbit") or "Unknown"}',
                "source": mission.get("source"),
                "image_url": image_url,
            }
        )

    rockets = [
        {
            "rocket_id": "falcon9",
            "rocket_name": "Falcon 9",
            "mission_count": f9_total,
            "successful_launches": f9_completed,
            "booster_landings": total_landings,
            "reused_core_flights": total_reflights,
            "launch_success_rate": _pct(f9_completed or 0, f9_total or 0),
            "landing_rate": _pct(total_landings or 0, landed_attempts or 0),
            "reusability_rate": _pct(total_reflights or 0, f9_total or 0),
            "recent_missions": recent_launches[:8],
            "image_url": vehicle_images.get("falcon9"),
        }
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall": {
            "scope": "spacexnow",
            "total_launches": f9_completed,
            "successful_launches": f9_completed,
            "launch_success_rate": _pct(f9_completed or 0, f9_total or 0),
            "booster_landings": total_landings,
            "landing_rate": _pct(total_landings or 0, landed_attempts or 0),
            "total_core_flights": f9_total,
            "reused_core_flights": total_reflights,
            "reusability_rate": _pct(total_reflights or 0, f9_total or 0),
            "upcoming_missions": len(upcoming),
        },
        "falcon9": {
            "completed_missions": f9_completed,
            "total_missions": f9_total,
            "total_landings": total_landings,
            "landing_attempts": landed_attempts,
            "total_reflights": total_reflights,
            "source": {
                "source_type": "spacexnow.com",
                "source_url": "https://spacexnow.com/stats",
            },
        },
        "data_sources": {
            "launches_list": {
                "source": "spacexnow.com/past",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            },
            "rockets_api": {
                "source": "spacexnow.com/stats",
                "latest_launch_date_utc": None,
                "days_since_latest_launch": None,
                "is_stale": False,
            },
        },
        "recent_launches": recent_launches,
        "upcoming_launches": upcoming[:10],
        "rockets": rockets,
        "vehicle_images": vehicle_images,
    }


def _is_retired_status(status: Optional[str]) -> bool:
    if not status:
        return False
    return status.lower() in {"retired", "lost", "destroyed", "expended", "inactive"}


def _fetch_spacex_booster_intel():
    past = _parse_spacexnow_missions("https://spacexnow.com/past", limit=220, source_label="spacexnow/past")
    boosters_catalog = _parse_spacexnow_boosters("https://spacexnow.com/boosters")
    capsules_catalog = _parse_spacexnow_capsules("https://spacexnow.com/capsules")
    vehicle_images = _fetch_vehicle_images()
    asds_sites = {"ASOG", "JRTI", "OCISLY", "ASDS"}
    rtls_sites = {"LZ-1", "LZ-2", "LZ-4", "LZ-40"}
    known_landing_sites = asds_sites | rtls_sites

    boosters_catalog_by_base = {b["base_serial"]: b for b in boosters_catalog if b.get("base_serial")}
    boosters_by_serial = {}
    pad_usage = {}

    for mission in past:
        serial = mission.get("booster_serial")
        landing_site = mission.get("landing_site")
        rocket_line = mission.get("rocket_line") or ""
        landing_type = (
            "ASDS"
            if landing_site in asds_sites
            else "RTLS"
            if landing_site in rtls_sites
            else "Unknown"
        )

        if serial:
            parts = serial.split(".")
            flight_no = int(parts[1]) if len(parts) == 2 and parts[1].isdigit() else None
            base_serial = _base_booster_serial(serial)
            meta = boosters_catalog_by_base.get(base_serial)
            block = (
                5
                if "F9 B5" in rocket_line.upper() or "FALCON 9 BLOCK 5" in rocket_line.upper()
                else None
            )
            stat = boosters_by_serial.setdefault(
                serial,
                {
                    "core_id": serial,
                    "serial": serial,
                    "display_name": meta.get("display_name") if meta else base_serial or serial,
                    "status": meta.get("status") if meta else "tracked",
                    "type": "Falcon 9 Booster",
                    "block": block,
                    "reuse_count": max((flight_no or 1) - 1, 0),
                    "rtls_attempts": 0,
                    "rtls_landings": 0,
                    "asds_attempts": 0,
                    "asds_landings": 0,
                    "last_update": datetime.now(timezone.utc).isoformat(),
                    "launch_count": 0,
                    "landing_success_count": 0,
                    "mission_history": [],
                    "image_url": vehicle_images.get("falcon9"),
                    "catalog_meta": meta,
                },
            )
            stat["launch_count"] += 1
            if flight_no:
                stat["reuse_count"] = max(stat["reuse_count"], flight_no - 1)

            if landing_type == "ASDS":
                stat["asds_attempts"] += 1
                if landing_site in known_landing_sites:
                    stat["asds_landings"] += 1
            elif landing_type == "RTLS":
                stat["rtls_attempts"] += 1
                if landing_site in known_landing_sites:
                    stat["rtls_landings"] += 1

            if landing_site in known_landing_sites:
                stat["landing_success_count"] += 1

            stat["mission_history"].append(
                {
                    "mission_name": mission.get("name"),
                    "date_utc": None,
                    "flight_number": None,
                    "launch_success": None,
                    "core_flight_number": flight_no,
                    "landing_success": landing_site in known_landing_sites,
                    "landing_type": landing_type,
                    "landpad_id": landing_site,
                    "landpad_name": landing_site,
                    "rocket_name": mission.get("rocket_line"),
                }
            )

    # Include boosters that exist on spacexnow/boosters even if not found in parsed mission feed.
    for meta in boosters_catalog:
        base_serial = meta.get("base_serial")
        if not base_serial:
            continue
        exists = any(_base_booster_serial(s) == base_serial for s in boosters_by_serial.keys())
        if exists:
            continue
        boosters_by_serial[base_serial] = {
            "core_id": base_serial,
            "serial": base_serial,
            "display_name": meta.get("display_name") or base_serial,
            "status": meta.get("status") or "tracked",
            "type": "Falcon 9 Booster",
            "block": None,
            "reuse_count": meta.get("reflights_reported") or 0,
            "rtls_attempts": 0,
            "rtls_landings": 0,
            "asds_attempts": 0,
            "asds_landings": 0,
            "last_update": datetime.now(timezone.utc).isoformat(),
            "launch_count": meta.get("launches_reported") or 0,
            "landing_success_count": meta.get("landings_reported") or 0,
            "mission_history": [],
            "image_url": vehicle_images.get("falcon9"),
            "catalog_meta": meta,
        }

        if landing_site and landing_site not in {"TBD", "Unknown"}:
            pad = pad_usage.setdefault(
                landing_site,
                {
                    "landpad_id": landing_site,
                    "name": landing_site,
                    "full_name": landing_site,
                    "type": "ASDS" if landing_site in asds_sites else "RTLS" if landing_site in rtls_sites else "Other",
                    "locality": None,
                    "region": None,
                    "status": "active",
                    "launches": [],
                    "landing_attempts": 0,
                    "landing_successes": 0,
                    "boosters": set(),
                },
            )
            pad["landing_attempts"] += 1
            if landing_site in known_landing_sites:
                pad["landing_successes"] += 1
            if serial:
                pad["boosters"].add(serial)

    boosters = []
    for booster in boosters_by_serial.values():
        missions = booster["mission_history"]
        reused = [m for m in missions if (m.get("core_flight_number") or 0) > 1]
        total_landings = (booster.get("asds_landings") or 0) + (booster.get("rtls_landings") or 0)
        total_attempts = (booster.get("asds_attempts") or 0) + (booster.get("rtls_attempts") or 0)

        boosters.append(
            {
                **booster,
                "mission_count": len(missions),
                "missions_reused": len(reused),
                "is_retired": str(booster.get("status") or "").lower() in {"retired", "lost", "destroyed"},
                "landing_rate": _pct(total_landings, total_attempts),
                "recent_missions": missions[:12],
                "reuse_missions": reused[:12],
                "source_lines": (booster.get("catalog_meta") or {}).get("raw_lines"),
            }
        )

    boosters.sort(
        key=lambda b: (b["mission_count"], b.get("reuse_count", 0), b.get("landing_success_count", 0)),
        reverse=True,
    )

    landpads_out = []
    for pad in pad_usage.values():
        landpads_out.append(
            {
                **pad,
                "boosters": sorted(pad["boosters"]),
                "distinct_boosters": len(pad["boosters"]),
                "landing_success_rate": _pct(pad["landing_successes"], pad["landing_attempts"]),
            }
        )
    landpads_out.sort(key=lambda p: p["landing_attempts"], reverse=True)

    droneships = [
        {"ship_id": "ASOG", "name": "A Shortfall Of Gravitas", "active": True, "home_port": None, "roles": ["ASDS"], "year_built": None, "mass_kg": None, "model": None, "type": "ASDS", "link": None, "image": None},
        {"ship_id": "JRTI", "name": "Just Read The Instructions", "active": True, "home_port": None, "roles": ["ASDS"], "year_built": None, "mass_kg": None, "model": None, "type": "ASDS", "link": None, "image": None},
        {"ship_id": "OCISLY", "name": "Of Course I Still Love You", "active": True, "home_port": None, "roles": ["ASDS"], "year_built": None, "mass_kg": None, "model": None, "type": "ASDS", "link": None, "image": None},
    ]

    total_boosters = len(boosters)
    total_reused = sum(1 for b in boosters if b.get("reuse_count", 0) > 0)
    total_missions = sum(b["mission_count"] for b in boosters)
    total_landings = sum((b.get("asds_landings") or 0) + (b.get("rtls_landings") or 0) for b in boosters)
    max_reuse = max((b.get("reuse_count", 0) for b in boosters), default=0)
    capsules = []
    for capsule in capsules_catalog:
        capsules.append(
            {
                **capsule,
                "image_url": vehicle_images.get("dragon"),
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall": {
            "total_boosters": total_boosters,
            "retired_boosters": 0,
            "active_boosters": total_boosters,
            "boosters_reused_at_least_once": total_reused,
            "reuse_adoption_rate": _pct(total_reused, total_boosters),
            "total_booster_missions": total_missions,
            "total_booster_landings": total_landings,
            "max_reuse_count": max_reuse,
            "total_capsules": len(capsules),
        },
        "boosters": boosters,
        "capsules": capsules,
        "landpads": landpads_out,
        "droneships": droneships,
        "data_sources": {
            "boosters_api": {
                "source": "spacexnow.com/boosters + spacexnow.com/past",
                "latest_launch_date_utc": None,
                "days_since_latest_launch": None,
                "is_stale": False,
            },
            "capsules": {
                "source": "spacexnow.com/capsules",
            },
            "confidence_note": "Booster lifecycle metrics are merged from spacexnow boosters + mission text feed and may omit hidden fields.",
        },
        "vehicle_images": vehicle_images,
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
