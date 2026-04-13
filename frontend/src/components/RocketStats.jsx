function pct(value) {
  return value == null ? "—" : `${value}%`;
}

function dateOnly(value) {
  return value ? value.slice(0, 10) : "—";
}

export default function RocketStats({ data, loading }) {
  if (loading) return <div className="rocket-panel skeleton" />;
  if (!data) return <div className="rocket-panel">SpaceX rocket data unavailable.</div>;

  const overall = data.overall || {};
  const rockets = data.rockets || [];
  const sourceType = data?.falcon9?.source?.source_type || "api";
  const launchesListSource = data?.data_sources?.launches_list?.source || "unknown";
  const rocketsApi = data?.data_sources?.rockets_api;
  const rocketsStale = Boolean(rocketsApi?.is_stale);
  const falconImage = data?.vehicle_images?.falcon9 || "/spacex-fallback.svg";
  const FALCON_9_HERO_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/F9_and_Heavy_visu.png/1920px-F9_and_Heavy_visu.png";

  const cards = [
    { label: "Completed Missions (F9)", value: overall.total_launches?.toLocaleString() },
    { label: "Total Landings (F9)", value: overall.booster_landings?.toLocaleString() },
    { label: "Total Reflights (F9)", value: overall.reused_core_flights?.toLocaleString() },
    { label: "Reflight Rate (F9)", value: pct(overall.reusability_rate) },
  ];

  return (
    <section className="rocket-section">
      <div className="section-head">
        <h2>SpaceX Rocket Intelligence</h2>
        <span className="mono dim">Generated: {dateOnly(data.generated_at)} · F9 source: {sourceType}</span>
      </div>
      <div className={`source-note ${rocketsStale ? "warn" : ""}`}>
        <span className="mono">
          Launch list source: {launchesListSource} · Provider: {rocketsApi?.source || "unknown"} · Latest launch: {dateOnly(rocketsApi?.latest_launch_date_utc)}
        </span>
      </div>
      {falconImage && (
        <div className="hero-image-wrap">
        <img 
          className="hero-image" 
          src={falconImage || FALCON_9_HERO_IMAGE} 
          alt="Falcon 9" 
          loading="lazy" 
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/spacex-fallback.svg";
          }}
          align="center"
          style={{
            width: "100%",
            height: "auto",           // important: let it keep natural height
            objectFit: "contain",     // shows full image instead of cropping
            maxHeight: "550px",       // adjust this number as needed (try 500-650px)
            objectPosition: "center",  // keeps it centered
            filter: "brightness(1.05) contrast(1.1)"
          }}
        />
      </div>
      )}

      <div className="stats-bar">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div>
              <div className="stat-value">{c.value ?? "—"}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table className="sat-table">
          <thead>
            <tr>
              <th>Rocket</th>
              <th>Missions</th>
              <th>Successful</th>
              <th>Booster Landings</th>
              <th>Reusability</th>
              <th>First Flight</th>
              <th>Latest Mission</th>
            </tr>
          </thead>
          <tbody>
            {rockets.map((rocket) => (
              <tr key={rocket.rocket_id}>
                <td className="name-cell">{rocket.rocket_name}</td>
                <td className="mono">{rocket.mission_count ?? "—"}</td>
                <td className="mono">{pct(rocket.launch_success_rate)}</td>
                <td className="mono">{rocket.booster_landings ?? "—"}</td>
                <td className="mono">{pct(rocket.reusability_rate)}</td>
                <td className="mono dim">{dateOnly(rocket.first_flight)}</td>
                <td className="mono dim">{rocket.recent_missions?.[0]?.name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
