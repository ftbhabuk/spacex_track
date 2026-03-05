import { useMemo, useState } from "react";

function pct(v) {
  return v == null ? "—" : `${v}%`;
}

function dateOnly(v) {
  return v ? v.slice(0, 10) : "—";
}

function count(v) {
  return v == null ? "—" : v.toLocaleString();
}

export default function BoosterDashboard({ data, loading }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);

  const boosters = data?.boosters || [];
  const overall = data?.overall || {};

  const filtered = useMemo(() => {
    return boosters.filter((b) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        String(b.serial || "").toLowerCase().includes(q) ||
        String(b.status || "").toLowerCase().includes(q) ||
        String(b.type || "").toLowerCase().includes(q);

      const matchStatus =
        !status ||
        (status === "retired" ? b.is_retired : String(b.status || "").toLowerCase() === status);

      return matchSearch && matchStatus;
    });
  }, [boosters, search, status]);

  if (loading) return <div className="rocket-panel skeleton" />;
  if (!data) return <div className="rocket-panel">Booster intel unavailable.</div>;

  const cards = [
    { label: "Tracked Boosters", value: count(overall.total_boosters) },
    { label: "Total Booster Missions", value: count(overall.total_booster_missions) },
    { label: "Total Booster Landings", value: count(overall.total_booster_landings) },
    { label: "Reuse Adoption", value: pct(overall.reuse_adoption_rate) },
    { label: "Max Reuse Count", value: count(overall.max_reuse_count) },
  ];

  return (
    <section className="rocket-section">
      <div className="section-head">
        <h2>Booster Intelligence</h2>
        <span className="mono dim">Updated: {dateOnly(data.generated_at)}</span>
      </div>

      <div className="stats-bar">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="controls">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="search"
            type="text"
            placeholder="Search booster by serial / status / type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-btn" onClick={() => setSearch("")}>✕</button>
          )}
        </div>
        <div className="filter-group">
          {["", "active", "inactive", "lost", "retired"].map((s) => (
            <button
              key={s}
              className={`filter-btn ${status === s ? "active" : ""}`}
              onClick={() => setStatus(s)}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="sat-table">
          <thead>
            <tr>
              <th>Booster</th>
              <th>Status</th>
              <th>Missions</th>
              <th>Reuse Count</th>
              <th>Successful Landings</th>
              <th>Landing Rate</th>
              <th>Last Mission</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.core_id} className="sat-row" onClick={() => setSelected(b)}>
                <td className="name-cell">{b.serial || "Unknown"}</td>
                <td className="mono dim">{b.status || "unknown"}</td>
                <td className="mono">{b.mission_count}</td>
                <td className="mono">{b.reuse_count ?? 0}</td>
                <td className="mono">{(b.asds_landings || 0) + (b.rtls_landings || 0)}</td>
                <td className="mono">{pct(b.landing_rate)}</td>
                <td className="mono dim">{b.recent_missions?.[0]?.mission_name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="infra-grid">
        <section className="infra-panel">
          <h3>Landing Pads</h3>
          <div className="infra-list">
            {(data.landpads || []).slice(0, 8).map((pad) => (
              <div key={pad.landpad_id} className="infra-item">
                <div className="name-cell">{pad.full_name || pad.name}</div>
                <div className="mono dim">{pad.type} · {pad.region}</div>
                <div className="mono">{pad.landing_successes}/{pad.landing_attempts} landings ({pct(pad.landing_success_rate)})</div>
              </div>
            ))}
          </div>
        </section>

        <section className="infra-panel">
          <h3>Droneships (ASDS)</h3>
          <div className="infra-list">
            {(data.droneships || []).map((ship) => (
              <div key={ship.ship_id} className="infra-item">
                <div className="name-cell">{ship.name || "Unknown ship"}</div>
                <div className="mono dim">{ship.home_port || "Unknown home port"}</div>
                <div className="mono">{ship.active ? "Active" : "Inactive"} · {ship.year_built || "—"}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {selected && (
        <BoosterDetail booster={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

function BoosterDetail({ booster, onClose }) {
  const landings = (booster.asds_landings || 0) + (booster.rtls_landings || 0);

  return (
    <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="detail-panel">
        <div className="detail-header">
          <div>
            <div className="detail-title">Booster {booster.serial || "Unknown"}</div>
            <div className="detail-subtitle">
              Status: {booster.status || "unknown"} · {booster.is_retired ? "Retired" : "Operational/Tracked"}
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="detail-grid">
          <section className="detail-section">
            <h3>Core Metrics</h3>
            <Field label="Type" value={booster.type} />
            <Field label="Block" value={booster.block} mono />
            <Field label="Missions" value={booster.mission_count} mono />
            <Field label="Reuse Count" value={booster.reuse_count} mono />
            <Field label="Total Landings" value={landings} mono />
            <Field label="Landing Rate" value={pct(booster.landing_rate)} mono />
          </section>

          <section className="detail-section">
            <h3>Landing Profile</h3>
            <Field label="ASDS Landings" value={booster.asds_landings} mono />
            <Field label="ASDS Attempts" value={booster.asds_attempts} mono />
            <Field label="RTLS Landings" value={booster.rtls_landings} mono />
            <Field label="RTLS Attempts" value={booster.rtls_attempts} mono />
            <Field label="Reused Missions" value={booster.missions_reused} mono />
            <Field label="Last Update" value={booster.last_update} />
          </section>
        </div>

        <section className="detail-section">
          <h3>Reuse Missions</h3>
          <div className="mission-list">
            {(booster.reuse_missions || []).length === 0 && <div className="mono dim">No reuse missions recorded.</div>}
            {(booster.reuse_missions || []).map((m) => (
              <div key={`${booster.core_id}-${m.flight_number}-${m.mission_name}`} className="mission-item">
                <div className="name-cell">{m.mission_name}</div>
                <div className="mono dim">{dateOnly(m.date_utc)} · Flight #{m.core_flight_number || "—"}</div>
                <div className="mono">{m.landing_type || "Unknown"} · {m.landing_success ? "Landed" : "No landing"}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <h3>All Missions</h3>
          <div className="mission-list">
            {(booster.recent_missions || []).map((m) => (
              <div key={`${booster.core_id}-${m.flight_number}-${m.mission_name}-all`} className="mission-item">
                <div className="name-cell">{m.mission_name}</div>
                <div className="mono dim">{dateOnly(m.date_utc)} · {m.rocket_name || "Unknown rocket"}</div>
                <div className="mono">
                  Launch: {m.launch_success ? "Success" : "Failure/Unknown"} ·
                  Landing: {m.landing_success ? "Success" : "Failure/Unknown"}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, mono = false }) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? "mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}
