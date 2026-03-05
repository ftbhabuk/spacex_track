function num(v) {
  return v == null ? "—" : v.toLocaleString();
}

function pct(v) {
  return v == null ? "—" : `${v}%`;
}

export default function HomeLanding({
  stats,
  rocketStats,
  boosterIntel,
  loading,
  onOpenBoosters,
  onOpenStarlink,
}) {
  const launches = rocketStats?.overall?.total_launches;
  const landings = rocketStats?.overall?.booster_landings;
  const reuse = rocketStats?.overall?.reusability_rate;
  const boosters = boosterIntel?.overall?.total_boosters;
  const maxReuse = boosterIntel?.overall?.max_reuse_count;
  const retired = boosterIntel?.overall?.retired_boosters;
  const activeStarlink = stats?.active;
  const recent = rocketStats?.recent_launches || [];

  return (
    <section className="home-landing">
      <div className="hero">
        <div className="hero-copy">
          <p className="kicker">SpaceX-Inspired Dashboard</p>
          <h2>Launches, boosters, and Starlink in one place.</h2>
          <p className="hero-sub">
            Track booster reuse performance, landing results, launch timelines,
            landing pads, droneships, and Starlink constellation health.
          </p>
          <div className="hero-actions">
            <button className="cta-btn" onClick={onOpenBoosters}>Open Booster Data</button>
            <button className="ghost-btn" onClick={onOpenStarlink}>Open Starlink Data</button>
          </div>
        </div>
        <div className="hero-metrics">
          <div className="hero-card">
            <div className="hero-value">{loading ? "..." : num(launches)}</div>
            <div className="hero-label">Historic Launches</div>
          </div>
          <div className="hero-card">
            <div className="hero-value">{loading ? "..." : num(landings)}</div>
            <div className="hero-label">Booster Landings</div>
          </div>
          <div className="hero-card">
            <div className="hero-value">{loading ? "..." : pct(reuse)}</div>
            <div className="hero-label">Core Reuse Rate</div>
          </div>
          <div className="hero-card">
            <div className="hero-value">{loading ? "..." : num(boosters)}</div>
            <div className="hero-label">Tracked Boosters</div>
          </div>
          <div className="hero-card">
            <div className="hero-value">{stats ? num(activeStarlink) : "..."}</div>
            <div className="hero-label">Active Starlink Sats</div>
          </div>
          <div className="hero-card">
            <div className="hero-value">{loading ? "..." : num(maxReuse)}</div>
            <div className="hero-label">Highest Booster Reuse</div>
          </div>
          <div className="hero-card">
            <div className="hero-value">{loading ? "..." : num(retired)}</div>
            <div className="hero-label">Retired/Lost Boosters</div>
          </div>
        </div>
      </div>

      <div className="infra-grid home-grid">
        <section className="infra-panel">
          <h3>Latest Launches</h3>
          <div className="infra-list">
            {recent.slice(0, 6).map((l) => (
              <div key={`${l.name}-${l.date_utc}`} className="infra-item">
                <div className="name-cell">{l.name}</div>
                <div className="mono dim">
                  {l.date_utc?.slice(0, 10)} · {l.rocket_name || "Unknown rocket"} ·{" "}
                  {l.success ? "Success" : "Failure/Unknown"}
                </div>
                {l.site_summary && <div className="home-summary">{l.site_summary}</div>}
                {l.site_url && (
                  <a className="home-link mono" href={l.site_url} target="_blank" rel="noreferrer">
                    spacex.com launch page
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
