export default function SatelliteTable({ satellites, loading, onSelect, selected }) {
  const statusColor = (s) => ({ active: "#2ea043", decayed: "#da3633", decaying: "#d29922", unknown: "#8f8f8f" }[s] || "#8f8f8f");

  if (loading) {
    return (
      <div className="table-wrap">
        <div className="loading-rows">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!satellites.length) {
    return <div className="empty-state">No satellites found matching your filters.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="sat-table">
        <thead>
          <tr>
            <th>NORAD ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Altitude (km)</th>
            <th>Apogee (km)</th>
            <th>Perigee (km)</th>
            <th>Inclination (°)</th>
            <th>Period (min)</th>
            <th>Launch Date</th>
            <th>Shell</th>
          </tr>
        </thead>
        <tbody>
          {satellites.map((sat) => (
            <tr
              key={sat.norad_id}
              className={`sat-row ${selected?.norad_id === sat.norad_id ? "selected" : ""}`}
              onClick={() => onSelect(sat)}
            >
              <td className="mono dim" data-label="NORAD ID">{sat.norad_id}</td>
              <td className="name-cell" data-label="Name">{sat.name}</td>
              <td data-label="Status">
                <span className="status-badge" style={{ "--c": statusColor(sat.status) }}>
                  {sat.status ?? "unknown"}
                </span>
              </td>
              <td className="mono" data-label="Altitude (km)">{sat.altitude_km ?? "—"}</td>
              <td className="mono" data-label="Apogee (km)">{sat.apogee_km ?? "—"}</td>
              <td className="mono" data-label="Perigee (km)">{sat.perigee_km ?? "—"}</td>
              <td className="mono" data-label="Inclination (°)">{sat.inclination ?? "—"}</td>
              <td className="mono" data-label="Period (min)">{sat.period_min ?? "—"}</td>
              <td className="mono dim" data-label="Launch Date">{sat.launch_date ? sat.launch_date.slice(0, 10) : "—"}</td>
              <td className="mono dim" data-label="Shell">{sat.shell || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
