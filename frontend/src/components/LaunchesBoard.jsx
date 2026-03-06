function dateOnly(v) {
  return v ? v.slice(0, 10) : "—";
}

export default function LaunchesBoard({ data, loading }) {
  if (loading) return <div className="rocket-panel skeleton" />;
  if (!data) return <div className="rocket-panel">Launch data unavailable.</div>;

  const recent = data?.recent_launches || [];
  const upcoming = data?.upcoming_launches || [];
  const launchesSource = data?.data_sources?.launches_list?.source || "unknown";
  const upcomingSource = data?.data_sources?.upcoming_launches?.source || "unknown";

  return (
    <section className="rocket-section">
      <div className="section-head">
        <h2>Launches</h2>
        <span className="mono dim">Upcoming + Recent mission timeline</span>
      </div>
      <div className="source-note warn launch-note">
        <div className="mono launch-note-title">Operational Notes</div>
        <ul className="launch-note-list">
          <li>Private, classified, or defense payload details (for example Starshield/DoD missions) may be partially hidden.</li>
          <li>Livestream links can be delayed, geo-restricted, or unavailable for some launches.</li>
          <li>Launch windows are fluid and often revised in the final hours before T-0.</li>
        </ul>
      </div>

      <div className="infra-grid home-grid">
        <section className="infra-panel">
          <h3>Next Launches</h3>
          <div className="source-note">
            <span className="mono">Source: {upcomingSource}</span>
          </div>
          <div className="infra-list">
            {upcoming.slice(0, 10).map((l) => (
              <div key={`${l.name}-${l.date_utc}-up`} className="infra-item">
                {l.image_url && (
                  <img className="launch-thumb" src={l.image_url} alt={l.name || "Launch"} loading="lazy" />
                )}
                <div className="name-cell">{l.name}</div>
                <div className="mono dim">{dateOnly(l.date_utc)} · {l.rocket_name || "Unknown rocket"}</div>
                {l.site_summary && <div className="home-summary">{l.site_summary}</div>}
                {l.launch_description && <div className="home-summary">{l.launch_description}</div>}
                {l.weather_summary && (
                  <div className="mono dim">Weather: {l.weather_summary}</div>
                )}
                {Array.isArray(l.tags) && l.tags.length > 0 && (
                  <div className="mono dim">Tags: {l.tags.join(", ")}</div>
                )}
                {l.site_url && (
                  <a className="home-link mono" href={l.site_url} target="_blank" rel="noreferrer">
                    Mission Details
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="infra-panel">
          <h3>Latest Launches</h3>
          <div className="source-note">
            <span className="mono">Source: {launchesSource} · Cross-check: spacex.com · x.com/SpaceX</span>
          </div>
          <div className="infra-list">
            {recent.slice(0, 12).map((l) => (
              <div key={`${l.name}-${l.date_utc}-recent`} className="infra-item">
                {l.image_url && (
                  <img className="launch-thumb" src={l.image_url} alt={l.name || "Launch"} loading="lazy" />
                )}
                <div className="name-cell">{l.name}</div>
                <div className="mono dim">
                  {dateOnly(l.date_utc)} · {l.rocket_name || "Unknown rocket"} · {l.success ? "Success" : "Failure/Unknown"}
                </div>
                {l.site_summary && <div className="home-summary">{l.site_summary}</div>}
                {l.site_url && (
                  <a className="home-link mono" href={l.site_url} target="_blank" rel="noreferrer">
                    Launch Page
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
