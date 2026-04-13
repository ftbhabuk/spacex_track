import { neon } from "@neondatabase/serverless";
import { Hono } from "hono";
import { cors } from "hono/cors";

interface Env {
  DATABASE_URL: string;
}

type Dict = Record<string, unknown>;

type LaunchItem = {
  id: string;
  name: string;
  date_utc: string | null;
  rocket_name: string;
  success: boolean | null;
  image_url: string | null;
  site_summary: string | null;
  launch_description: string | null;
  weather_summary: string | null;
  tags: string[];
  site_url: string | null;
  source: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

const ROCKETLAUNCH_LIVE_API = "https://fdo.rocketlaunch.live/json/launches";
const CACHE_TTL_MS = 30 * 60 * 1000;

const VEHICLE_IMAGES = {
  falcon9: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/F9_and_Heavy_visu.png/1920px-F9_and_Heavy_visu.png",
  dragon: "https://wallpaperaccess.com/full/1094574.jpg",
  starship: "https://wallpaperaccess.com/full/1094611.jpg",
  starlink: "https://images.hdqwalls.com/download/starlink-fe-2048x2048.jpg",
};

let rocketsCache: { expiresAt: number; data: Dict } | null = null;
let boosterCache: { expiresAt: number; data: Dict } | null = null;

app.get("/", (c) => {
  return c.json({ message: "SpaceX Tracker SX API", docs: "Cloudflare Worker" });
});

app.get("/stats", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const rows = await sql<Dict[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE status = 'decayed')::int AS decayed,
      COUNT(*) FILTER (WHERE status = 'decaying')::int AS decaying,
      COUNT(*) FILTER (WHERE status = 'unknown')::int AS unknown,
      ROUND(AVG(altitude_km) FILTER (
        WHERE status = 'active' AND altitude_km IS NOT NULL
      )::numeric, 1) AS avg_altitude_km
    FROM satellites
  `;

  return c.json(rows[0] || {});
});

app.get("/satellites", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const status = cleanNullable(c.req.query("status"));
  const search = cleanNullable(c.req.query("search"));
  const searchLike = search ? `%${search}%` : null;
  const shell = parseNullableInt(c.req.query("shell"));

  const sortByRaw = c.req.query("sort_by") || "launch_date";
  const sortDirRaw = c.req.query("sort_dir") || "desc";
  const sortBy = ["launch_date", "norad_id", "name"].includes(sortByRaw)
    ? sortByRaw
    : "launch_date";
  const sortDir = sortDirRaw === "asc" ? "asc" : "desc";

  const limit = clampInt(c.req.query("limit"), 1, 500, 100);
  const offset = clampInt(c.req.query("offset"), 0, 5_000_000, 0);

  const rows = await sql<Dict[]>`
    SELECT *
    FROM satellites
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${shell}::int IS NULL OR shell = ${shell})
      AND (
        ${search}::text IS NULL
        OR name ILIKE ${searchLike}
        OR CAST(norad_id AS TEXT) = ${search}
      )
    ORDER BY
      CASE WHEN ${sortBy} = 'launch_date' AND ${sortDir} = 'asc' THEN launch_date END ASC NULLS LAST,
      CASE WHEN ${sortBy} = 'launch_date' AND ${sortDir} = 'desc' THEN launch_date END DESC NULLS LAST,
      CASE WHEN ${sortBy} = 'norad_id' AND ${sortDir} = 'asc' THEN norad_id END ASC,
      CASE WHEN ${sortBy} = 'norad_id' AND ${sortDir} = 'desc' THEN norad_id END DESC,
      CASE WHEN ${sortBy} = 'name' AND ${sortDir} = 'asc' THEN name END ASC,
      CASE WHEN ${sortBy} = 'name' AND ${sortDir} = 'desc' THEN name END DESC,
      norad_id DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const countRows = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total
    FROM satellites
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${shell}::int IS NULL OR shell = ${shell})
      AND (
        ${search}::text IS NULL
        OR name ILIKE ${searchLike}
        OR CAST(norad_id AS TEXT) = ${search}
      )
  `;

  return c.json({
    total: countRows[0]?.total || 0,
    limit,
    offset,
    data: rows,
  });
});

app.get("/satellites/:noradId", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const noradId = Number.parseInt(c.req.param("noradId"), 10);
  if (!Number.isFinite(noradId)) {
    return c.json({ detail: "Invalid NORAD id" }, 400);
  }

  const rows = await sql<Dict[]>`
    SELECT * FROM satellites WHERE norad_id = ${noradId}
  `;

  if (!rows[0]) {
    return c.json({ detail: "Satellite not found" }, 404);
  }
  return c.json(rows[0]);
});

app.get("/satellites/:noradId/history", async (c) => {
  const sql = neon(c.env.DATABASE_URL);
  const noradId = Number.parseInt(c.req.param("noradId"), 10);
  if (!Number.isFinite(noradId)) {
    return c.json({ detail: "Invalid NORAD id" }, 400);
  }

  const rows = await sql<Dict[]>`
    SELECT altitude_km, perigee_km, apogee_km, recorded_at
    FROM satellite_history
    WHERE norad_id = ${noradId}
    ORDER BY recorded_at DESC
    LIMIT 90
  `;

  return c.json(rows);
});

app.get("/spacex/rockets/stats", async (c) => {
  const refresh = c.req.query("refresh") === "true";
  const now = Date.now();
  if (!refresh && rocketsCache && rocketsCache.expiresAt > now) {
    return c.json(rocketsCache.data);
  }

  const data = await buildRocketStats();
  rocketsCache = { expiresAt: now + CACHE_TTL_MS, data };
  return c.json(data);
});

app.get("/spacex/boosters/intel", async (c) => {
  const refresh = c.req.query("refresh") === "true";
  const now = Date.now();
  if (!refresh && boosterCache && boosterCache.expiresAt > now) {
    return c.json(boosterCache.data);
  }

  const sql = neon(c.env.DATABASE_URL);

  const boostersRows = await sql<Dict[]>`
    SELECT serial, vehicle, booster_type, version, status, flights, comment,
           landings_success, landings_attempts, updated_at
    FROM spacex_boosters
    ORDER BY flights DESC
  `;

  const boosterMissionRows = await sql<Dict[]>`
    SELECT booster_serial, mission_name, mission_date, landing_site
    FROM spacex_booster_missions
    ORDER BY mission_date DESC NULLS LAST, id DESC
  `;

  const capsulesRows = await sql<Dict[]>`
    SELECT capsule_id, version, status, flights, comment
    FROM spacex_capsules
    ORDER BY flights DESC
  `;

  const capsuleMissionRows = await sql<Dict[]>`
    SELECT capsule_id, mission_name, mission_date
    FROM spacex_capsule_missions
    ORDER BY mission_date DESC NULLS LAST, id DESC
  `;

  const asdsSites = new Set(["ASOG", "JRTI", "OCISLY", "ASDS"]);
  const rtlsSites = new Set(["LZ-1", "LZ-2", "LZ-4", "LZ-40"]);

  const missionsByBooster = new Map<string, Dict[]>();
  for (const row of boosterMissionRows) {
    const serial = String(row.booster_serial || "");
    if (!serial) continue;
    const current = missionsByBooster.get(serial) || [];
    current.push(row);
    missionsByBooster.set(serial, current);
  }

  const missionsByCapsule = new Map<string, Dict[]>();
  for (const row of capsuleMissionRows) {
    const capsuleId = String(row.capsule_id || "");
    if (!capsuleId) continue;
    const current = missionsByCapsule.get(capsuleId) || [];
    current.push(row);
    missionsByCapsule.set(capsuleId, current);
  }

  const boosters = boostersRows.map((row) => {
    const serial = String(row.serial || "");
    const flights = toInt(row.flights);
    const missions = missionsByBooster.get(serial) || [];

    let asds = 0;
    let rtls = 0;

    for (const mission of missions) {
      const site = String(mission.landing_site || "").toUpperCase();
      if (asdsSites.has(site)) asds += 1;
      if (rtlsSites.has(site)) rtls += 1;
    }

    const reportedLandings = toInt(row.landings_success);
    const reportedAttempts = toInt(row.landings_attempts);
    let derivedLandings = asds + rtls;

    if (derivedLandings === 0 && reportedLandings > 0) {
      asds = reportedLandings;
      rtls = 0;
      derivedLandings = reportedLandings;
    }

    const landings = reportedLandings > 0 ? reportedLandings : derivedLandings;
    let attempts = reportedAttempts > 0 ? reportedAttempts : flights;

    const recentMissions = missions.slice(0, 12).map((mission, idx) => ({
      mission_name: mission.mission_name || null,
      date_utc: toIso(mission.mission_date),
      flight_number: null,
      core_flight_number: null,
      landing_type: mission.landing_site || null,
      landing_success: mission.landing_site != null,
      launch_success: null,
      rocket_name: "Falcon 9",
      ordinal: idx + 1,
    }));

    const reuseMissions = recentMissions.slice(1);
    const status = String(row.status || "unknown").toLowerCase();
    const isRetired = ["retired", "lost", "destroyed", "expended", "inactive"].includes(status);

    return {
      core_id: serial,
      serial,
      display_name: serial,
      status,
      type: row.booster_type || row.vehicle || "Falcon Booster",
      block: row.version || null,
      reuse_count: Math.max(flights - 1, 0),
      rtls_attempts: rtls,
      rtls_landings: rtls,
      asds_attempts: attempts,
      asds_landings: asds,
      last_update: toIso(row.updated_at),
      launch_count: flights,
      landing_success_count: landings,
      mission_count: flights,
      missions_reused: Math.max(flights - 1, 0),
      is_retired: isRetired,
      landing_rate: attempts > 0 ? round1((landings / attempts) * 100) : null,
      recent_missions: recentMissions,
      reuse_missions: reuseMissions,
      source_lines: null,
      image_url: VEHICLE_IMAGES.falcon9,
      comment: row.comment || null,
    };
  });

  const capsules = capsulesRows.map((row) => {
    const capsuleId = String(row.capsule_id || "");
    const flights = toInt(row.flights);
    const capsuleMissions = missionsByCapsule.get(capsuleId) || [];

    return {
      capsule_id: capsuleId,
      name: capsuleId,
      status: row.status || "unknown",
      missions_reported: flights,
      reuses_reported: Math.max(flights - 1, 0),
      water_landings_reported: null,
      raw_lines: capsuleMissions
        .map((m) => String(m.mission_name || ""))
        .filter(Boolean)
        .slice(0, 5),
      source: "spacex_boosters/capsules tables",
      image_url: VEHICLE_IMAGES.dragon,
      comment: row.comment || null,
    };
  });

  const totalBoosters = boosters.length;
  const retiredBoosters = boosters.filter((b) => b.is_retired).length;
  const totalMissions = boosters.reduce((sum, b) => sum + toInt(b.mission_count), 0);
  const totalLandings = boosters.reduce(
    (sum, b) => sum + toInt(b.landing_success_count),
    0,
  );
  const reusedAtLeastOnce = boosters.filter((b) => toInt(b.reuse_count) > 0).length;
  const maxReuse = boosters.reduce((max, b) => Math.max(max, toInt(b.reuse_count)), 0);

  const data = {
    generated_at: new Date().toISOString(),
    overall: {
      total_boosters: totalBoosters,
      retired_boosters: retiredBoosters,
      active_boosters: Math.max(totalBoosters - retiredBoosters, 0),
      boosters_reused_at_least_once: reusedAtLeastOnce,
      reuse_adoption_rate: pct(reusedAtLeastOnce, totalBoosters),
      total_booster_missions: totalMissions,
      total_booster_landings: totalLandings,
      max_reuse_count: maxReuse,
      total_capsules: capsules.length,
    },
    boosters,
    capsules,
    landpads: [
      { landpad_id: "LZ-1", name: "LZ-1", full_name: "Landing Zone 1", type: "RTLS", region: "Florida", landing_attempts: 0, landing_successes: 0, landing_success_rate: null },
      { landpad_id: "LZ-2", name: "LZ-2", full_name: "Landing Zone 2", type: "RTLS", region: "Florida", landing_attempts: 0, landing_successes: 0, landing_success_rate: null },
      { landpad_id: "LZ-4", name: "LZ-4", full_name: "Landing Zone 4", type: "RTLS", region: "California", landing_attempts: 0, landing_successes: 0, landing_success_rate: null },
      { landpad_id: "LZ-40", name: "LZ-40", full_name: "Landing Zone 40", type: "RTLS", region: "Florida", landing_attempts: 0, landing_successes: 0, landing_success_rate: null },
    ],
    droneships: [
      { ship_id: "ASOG", name: "A Shortfall Of Gravitas", active: true, home_port: "Port Canaveral", year_built: null },
      { ship_id: "JRTI", name: "Just Read The Instructions", active: true, home_port: "Port Canaveral", year_built: null },
      { ship_id: "OCISLY", name: "Of Course I Still Love You", active: true, home_port: "Port Canaveral", year_built: null },
    ],
    data_sources: {
      boosters_api: {
        source: "spacex_boosters/capsules tables",
        latest_launch_date_utc: null,
        days_since_latest_launch: null,
        is_stale: false,
      },
      capsules: {
        source: "spacex_capsules tables",
      },
      confidence_note: "Booster/capsule data is maintained by scheduled sync scripts.",
    },
    vehicle_images: VEHICLE_IMAGES,
  };

  boosterCache = { expiresAt: now + CACHE_TTL_MS, data };
  return c.json(data);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ detail: "Internal server error" }, 500);
});

export default app;

async function buildRocketStats(): Promise<Dict> {
  const stats = await fetchSpacexNowStats();
  const recent = await fetchRocketLaunchLive("previous", 12);
  const upcoming = await fetchRocketLaunchLive("next", 10);

  const f9Completed = stats.falcon9_successful_missions;
  const f9Total = stats.falcon9_total_missions;
  const boosterLandings = stats.booster_landed_successes;
  const landingAttempts = stats.booster_landed_attempts;
  const reflights = stats.booster_reflights;

  return {
    generated_at: new Date().toISOString(),
    overall: {
      scope: "spacexnow",
      total_launches: f9Completed,
      successful_launches: f9Completed,
      launch_success_rate: pct(f9Completed || 0, f9Total || 0),
      booster_landings: boosterLandings,
      landing_rate: pct(boosterLandings, landingAttempts),
      total_core_flights: f9Total,
      reused_core_flights: reflights,
      reusability_rate: pct(reflights || 0, f9Total || 0),
      upcoming_missions: upcoming.length,
    },
    falcon9: {
      completed_missions: f9Completed,
      total_missions: f9Total,
      total_landings: boosterLandings,
      landing_attempts: landingAttempts,
      total_reflights: reflights,
      source: {
        source_type: "spacexnow.com",
        source_url: "https://spacexnow.com/stats",
      },
    },
    data_sources: {
      launches_list: {
        source: "fdo.rocketlaunch.live/json/launches/previous/12",
        fetched_at: new Date().toISOString(),
      },
      rockets_api: {
        source: "spacexnow.com/stats",
        latest_launch_date_utc: recent[0]?.date_utc || null,
        days_since_latest_launch: null,
        is_stale: false,
      },
      upcoming_launches: {
        source: "fdo.rocketlaunch.live/json/launches/next/10",
        fetched_at: new Date().toISOString(),
      },
    },
    recent_launches: recent,
    upcoming_launches: upcoming,
    rockets: [
      {
        rocket_id: "falcon9",
        rocket_name: "Falcon 9",
        mission_count: f9Total,
        successful_launches: f9Completed,
        booster_landings: boosterLandings,
        reused_core_flights: reflights,
        launch_success_rate: pct(f9Completed || 0, f9Total || 0),
        landing_rate: pct(boosterLandings, landingAttempts),
        reusability_rate: pct(reflights || 0, f9Total || 0),
        first_flight: null,
        recent_missions: recent.slice(0, 8).map((l) => ({ name: l.name, date_utc: l.date_utc })),
        image_url: VEHICLE_IMAGES.falcon9,
      },
    ],
    vehicle_images: {
      ...VEHICLE_IMAGES,
    },
  };
}

async function fetchSpacexNowStats(): Promise<{
  falcon9_successful_missions: number | null;
  falcon9_total_missions: number | null;
  booster_landed_successes: number | null;
  booster_landed_attempts: number | null;
  booster_reflights: number | null;
}> {
  const url = "https://spacexnow.com/stats";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch SpaceXNow stats (${res.status})`);
  }
  const html = await res.text();
  const lines = htmlToTextLines(html);
  const text = lines.join(" ");

  let [f9Success, f9Total] = parseMetricPair(
    lines.find((line) => line.startsWith("Falcon 9 ")) || "",
  );
  let [landedSuccess, landedAttempts] = parseMetricPair(
    lines.find((line) => line.startsWith("Landed ")) || "",
  );
  let reflownTotal = extractFirstInt(
    lines.find((line) => line.startsWith("Reflown ")) || "",
  );

  if (f9Success == null) {
    const m = text.match(/Falcon 9\s+([0-9,]+)\s*\/\s*([0-9,]+)/i);
    if (m) {
      f9Success = parseInt(m[1].replaceAll(",", ""), 10);
      f9Total = parseInt(m[2].replaceAll(",", ""), 10);
    }
  }
  if (landedSuccess == null) {
    const m = text.match(/Landed\s+([0-9,]+)\s*\/\s*([0-9,]+)/i);
    if (m) {
      landedSuccess = parseInt(m[1].replaceAll(",", ""), 10);
      landedAttempts = parseInt(m[2].replaceAll(",", ""), 10);
    }
  }
  if (reflownTotal == null) {
    const m = text.match(/Reflown\s+([0-9,]+)\s+booster reuses/i);
    if (m) {
      reflownTotal = parseInt(m[1].replaceAll(",", ""), 10);
    }
  }

  return {
    falcon9_successful_missions: f9Success,
    falcon9_total_missions: f9Total,
    booster_landed_successes: landedSuccess,
    booster_landed_attempts: landedAttempts,
    booster_reflights: reflownTotal,
  };
}

function htmlToTextLines(html: string): string[] {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withBreaks = noStyle.replace(
    /<\/(p|div|li|h1|h2|h3|h4|h5|h6|tr|td|section|article|br)>/gi,
    "\n",
  );
  const text = withBreaks.replace(/<[^>]+>/g, " ");
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines;
}

function parseMetricPair(value: string): [number | null, number | null] {
  const m = value.match(/([0-9,]+)\s*\/\s*([0-9,]+)/);
  if (!m) return [null, null];
  return [
    parseInt(m[1].replaceAll(",", ""), 10),
    parseInt(m[2].replaceAll(",", ""), 10),
  ];
}

function extractFirstInt(value: string): number | null {
  const m = value.match(/([0-9,]+)/);
  if (!m) return null;
  return parseInt(m[1].replaceAll(",", ""), 10);
}

async function fetchRocketLaunchLive(kind: "next" | "previous", limit: number): Promise<LaunchItem[]> {
  const url = `${ROCKETLAUNCH_LIVE_API}/${kind}/${limit}`;
  const data = await fetchJson<{ result?: Dict[] }>(url);
  const rows = Array.isArray(data.result) ? data.result : [];
  return rows.map((item) => normalizeRocketLaunchLiveItem(item, kind)).filter((item) => Boolean(item.name));
}

function normalizeRocketLaunchLiveItem(item: Dict, kind: "next" | "previous"): LaunchItem {
  const provider = asObj(item.provider);
  const vehicle = asObj(item.vehicle);
  const pad = asObj(item.pad);
  const location = asObj(pad.location);

  const launchName =
    typeof item.name === "string" && item.name
      ? item.name
      : typeof item.sort_name === "string" && item.sort_name
        ? item.sort_name
        : "Unknown mission";

  const padName = typeof pad.name === "string" ? pad.name : null;
  const locationName = typeof location.name === "string" ? location.name : null;
  const state = typeof location.statename === "string" ? location.statename : null;
  const country = typeof location.country === "string" ? location.country : null;
  const summaryParts = [padName, locationName, state, country].filter(Boolean);

  const launchDescription =
    (typeof item.launch_description === "string" && item.launch_description) ||
    (typeof item.mission_description === "string" && item.mission_description) ||
    null;

  const rawResult = typeof item.result === "number" ? item.result : null;
  const success = rawResult == null ? null : rawResult > 0;

  const tags = [];
  if (typeof provider.name === "string" && provider.name) tags.push(provider.name);
  if (typeof vehicle.name === "string" && vehicle.name) tags.push(vehicle.name);

  const imageUrl =
    (typeof item.launch_image === "string" && item.launch_image) ||
    (typeof item.quicktext === "string" && item.quicktext.startsWith("http") ? item.quicktext : null) ||
    null;

  const siteUrl =
    (typeof item.quicktext === "string" && item.quicktext.startsWith("http") && item.quicktext) ||
    (typeof item.slug === "string" && item.slug ? `https://rocketlaunch.live/launch/${item.slug}` : null);

  return {
    id: String(item.id || item.sort_date || item.t0 || launchName),
    name: launchName,
    date_utc: toIso(item.t0 || item.win_open || item.sort_date),
    rocket_name: typeof vehicle.name === "string" ? vehicle.name : "Unknown rocket",
    success,
    image_url: imageUrl,
    site_summary: summaryParts.length > 0 ? summaryParts.join(" · ") : null,
    launch_description: launchDescription,
    weather_summary: null,
    tags,
    site_url: siteUrl,
    source: `${ROCKETLAUNCH_LIVE_API}/${kind}`,
  };
}

async function fetchJson<T>(url: string, payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: payload ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${url}`);
  }
  return (await res.json()) as T;
}

function cleanNullable(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return v === "" ? null : v;
}

function parseNullableInt(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function pct(part: number, total: number): number | null {
  if (!total) return null;
  return round1((part / total) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asObj(value: unknown): Dict {
  if (value && typeof value === "object") return value as Dict;
  return {};
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString();
  }
  return null;
}
