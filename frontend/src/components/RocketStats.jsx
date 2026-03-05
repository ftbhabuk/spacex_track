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
        <span className="mono dim">Generated: {dateOnly(data.generated_at)} · Source: {sourceType}</span>
      </div>

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
