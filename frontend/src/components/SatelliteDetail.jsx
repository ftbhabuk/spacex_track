import { useEffect, useState } from "react";

export default function SatelliteDetail({ satellite: sat, apiBase, onClose }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch(`${apiBase}/satellites/${sat.norad_id}/history`)
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [sat.norad_id, apiBase]);

  const field = (label, value, mono = false) => (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? "mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );

  const statusColors = { active: "#f2f2f2", decayed: "#bdbdbd", decaying: "#d9d9d9", unknown: "#8f8f8f" };
  const color = statusColors[sat.status] || "#8f8f8f";

  return (
    <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="detail-panel">
        <div className="detail-header">
          <div>
            <div className="detail-title">{sat.name}</div>
            <div className="detail-subtitle">NORAD #{sat.norad_id} · {sat.intl_designator || "No intl. designator"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="status-badge large" style={{ "--c": color }}>{sat.status}</span>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="detail-grid">
          <section className="detail-section">
            <h3>Mission Info</h3>
            {field("Launch Date", sat.launch_date?.slice(0, 10))}
            {field("Decay / Reentry", sat.decay_date?.slice(0, 10) ?? (sat.status === "active" ? "In orbit" : "Unknown"))}
            {field("Int'l Designator", sat.intl_designator, true)}
            {field("Orbital Shell", sat.shell ? `Shell ${sat.shell}` : null)}
          </section>

          <section className="detail-section">
            <h3>Orbital Elements</h3>
            {field("Mean Altitude", sat.altitude_km != null ? `${sat.altitude_km} km` : null, true)}
            {field("Apogee", sat.apogee_km != null ? `${sat.apogee_km} km` : null, true)}
            {field("Perigee", sat.perigee_km != null ? `${sat.perigee_km} km` : null, true)}
            {field("Inclination", sat.inclination != null ? `${sat.inclination}°` : null, true)}
            {field("Period", sat.period_min != null ? `${sat.period_min} min` : null, true)}
            {field("Eccentricity", sat.eccentricity, true)}
            {field("Mean Motion", sat.mean_motion != null ? `${sat.mean_motion} rev/day` : null, true)}
          </section>
        </div>

        <section className="detail-section tle-section">
          <h3>TLE Data <span className="tle-date">Updated: {sat.tle_updated_at?.slice(0, 10) ?? "—"}</span></h3>
          <pre className="tle-block">{sat.tle_line1}{"\n"}{sat.tle_line2}</pre>
        </section>

        {history.length > 0 && (
          <section className="detail-section">
            <h3>Altitude History <span className="tle-date">(last {history.length} records)</span></h3>
            <div className="history-chart">
              <MiniChart data={history} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MiniChart({ data }) {
  const sorted = [...data].reverse();
  const alts = sorted.map((d) => d.altitude_km).filter(Boolean);
  if (!alts.length) return <div className="dim">No history data</div>;

  const min = Math.min(...alts);
  const max = Math.max(...alts);
  const range = max - min || 1;
  const W = 600, H = 80;
  const pad = 8;

  const points = alts.map((a, i) => {
    const x = pad + (i / (alts.length - 1 || 1)) * (W - pad * 2);
    const y = H - pad - ((a - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="history-svg">
        <defs>
          <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2f2f2" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f2f2f2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={`${points.split(" ")[0].split(",")[0]},${H} ${points} ${points.split(" ").at(-1).split(",")[0]},${H}`}
          fill="url(#altGrad)"
          stroke="none"
        />
        <polyline points={points} fill="none" stroke="#f2f2f2" strokeWidth="1.5" />
      </svg>
      <div className="chart-labels">
        <span>{min.toFixed(0)} km</span>
        <span>{sorted[0]?.recorded_at?.slice(0, 10)}</span>
        <span>{max.toFixed(0)} km</span>
      </div>
    </div>
  );
}
