// LaunchesBoard.jsx — refined

const SPACE_PLACEHOLDER = "https://wallpaperaccess.com/full/1420557.jpg";

function dateOnly(v) {
  return v ? v.slice(0, 10) : "—";
}

function timeOnly(v) {
  if (!v) return null;
  const match = v.match(/T(\d{2}:\d{2})/);
  return match ? match[1] + " UTC" : null;
}

function parseWeather(raw) {
  if (!raw) return null;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const condition = lines[0] || null;
  const temp = lines.find((l) => l.startsWith("Temp:"))?.replace("Temp:", "").trim() || null;
  const wind = lines.find((l) => l.startsWith("Wind:"))?.replace("Wind:", "").trim() || null;
  return { condition, temp, wind };
}

function WeatherChip({ summary }) {
  const w = parseWeather(summary);
  if (!w) return null;
  return (
    <div className="weather-chip">
      <span className="weather-cond">{w.condition}</span>
      {w.temp && <span className="weather-stat">🌡 {w.temp}°F</span>}
      {w.wind && <span className="weather-stat">💨 {w.wind} mph</span>}
    </div>
  );
}

function StatusBadge({ success }) {
  if (success === null || success === undefined) return null;
  return (
    <span className={`launch-status-badge ${success ? "launch-status-success" : "launch-status-fail"}`}>
      {success ? "✓ Success" : "✗ Failed"}
    </span>
  );
}

function LaunchCard({ l, showStatus }) {
  const time = timeOnly(l.date_utc);
  const [rocketProvider, rocketVehicle] = l.rocket_name?.includes(" - ")
    ? l.rocket_name.split(" - ")
    : [null, l.rocket_name];

  return (
    <div className="launch-card">
      <div className="launch-card-img-wrap">
        <img
          className="launch-card-img"
          src={l.image_url || SPACE_PLACEHOLDER}
          alt={l.name || "Launch"}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = SPACE_PLACEHOLDER;
          }}
        />
        <div className="launch-card-img-overlay" />
        {showStatus && <StatusBadge success={l.success} />}
      </div>

      <div className="launch-card-body">
        <div className="launch-card-header">
          <span className="launch-card-name">{l.name}</span>
          <div className="launch-card-meta">
            <span className="mono dim">{dateOnly(l.date_utc)}</span>
            {time && <span className="mono dim launch-time">{time}</span>}
          </div>
        </div>

        <div className="launch-rocket-row">
          {rocketProvider && (
            <span className="rocket-chip provider-chip">{rocketProvider}</span>
          )}
          {rocketVehicle && (
            <span className="rocket-chip vehicle-chip">{rocketVehicle}</span>
          )}
        </div>

        {l.site_summary && (
          <div className="launch-site-row mono dim">
            <span className="site-icon">📍</span>
            {l.site_summary}
          </div>
        )}

        {l.launch_description && (
          <p className="launch-desc-text">{l.launch_description}</p>
        )}

        {l.weather_summary && (
          <WeatherChip summary={l.weather_summary} />
        )}

        {Array.isArray(l.tags) && l.tags.length > 0 && (
          <div className="tags-container">
            {l.tags.map((tag, i) => (
              <span key={i} className="tag-pill">{tag}</span>
            ))}
          </div>
        )}

        {l.site_url && (
          <a
            className="launch-ext-link mono"
            href={l.site_url}
            target="_blank"
            rel="noreferrer"
          >
            Mission Details →
          </a>
        )}
      </div>
    </div>
  );
}

const TRACK_SOURCES = [
  { label: "SpaceX Launches", href: "https://spacex.com/launches", tag: "official" },
  { label: "𝕏 @SpaceX", href: "https://x.com/SpaceX", tag: "live updates" },
  { label: "Space-Track.org", href: "https://www.space-track.org", tag: "orbital data" },
  { label: "RocketLaunch.live", href: "https://rocketlaunch.live", tag: "schedule" },
  { label: "NASA Launches", href: "https://www.nasa.gov/launches-and-landings/", tag: "nasa" },
];

function TrackSourcesPanel() {
  return (
    <div className="track-sources-panel">
      <div className="track-sources-header">
        <span className="track-sources-icon">📡</span>
        <div>
          <div className="track-sources-title">Stay in the loop</div>
          <div className="track-sources-sub mono dim">Follow live coverage &amp; official data</div>
        </div>
      </div>
      <div className="track-sources-list">
        {TRACK_SOURCES.map((s) => (
          <a
            key={s.href}
            className="track-source-item"
            href={s.href}
            target="_blank"
            rel="noreferrer"
          >
            <span className="track-source-label">{s.label}</span>
            <span className="track-source-tag mono">{s.tag}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function LaunchesBoard({ data, loading }) {
  if (loading) return <div className="rocket-panel skeleton" />;
  if (!data) return <div className="rocket-panel">Launch data unavailable.</div>;

  const recent = data?.recent_launches || [];
  const upcoming = data?.upcoming_launches || [];
  const upcomingSource = data?.data_sources?.upcoming_launches?.source || "rocketlaunch.live";

  return (
    <section className="rocket-section">
      <div className="section-head">
        <h2>Launches</h2>
        <span className="mono dim">Upcoming + Recent mission timeline</span>
      </div>

      <div className="source-note warn launch-note">
        <div className="mono launch-note-title">Operational Notes</div>
        <ul className="launch-note-list">
          <li>Private, classified, or defense payload details (e.g. Starshield/DoD) may be partially redacted.</li>
          <li>Livestream links can be delayed, geo-restricted, or unavailable for some launches.</li>
          <li>Launch windows are fluid and often revised in the final hours before T-0.</li>
        </ul>
      </div>

      <div className="infra-grid home-grid">
        {/* Upcoming */}
        <section className="infra-panel">
          <div className="panel-head-row">
            <h3>Next Launches</h3>
            <span className="source-pill mono">via {upcomingSource}</span>
          </div>
          <div className="launch-card-list">
            {upcoming.slice(0, 10).map((l) => (
              <LaunchCard key={`${l.name}-${l.date_utc}-up`} l={l} showStatus={false} />
            ))}
          </div>
        </section>

        {/* Recent */}
        <section className="infra-panel">
          <div className="panel-head-row">
            <h3>Latest Launches</h3>
          </div>
          <TrackSourcesPanel />
          <div className="launch-card-list">
            {recent.slice(0, 12).map((l) => (
              <LaunchCard key={`${l.name}-${l.date_utc}-recent`} l={l} showStatus={true} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}