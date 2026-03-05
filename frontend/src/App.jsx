import { useState, useEffect, useCallback } from "react";
import SatelliteTable from "./components/SatelliteTable";
import SatelliteDetail from "./components/SatelliteDetail";
import StatsBar from "./components/StatsBar";
import RocketStats from "./components/RocketStats";
import "./index.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [satellites, setSatellites] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rocketStats, setRocketStats] = useState(null);
  const [rocketLoading, setRocketLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PER_PAGE = 100;

  const fetchSatellites = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: PER_PAGE,
        offset: page * PER_PAGE,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`${API}/satellites?${params}`);
      const json = await res.json();
      setSatellites(json.data || []);
      setTotal(json.total || 0);
    } catch (e) {
      console.error("Failed to fetch satellites:", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats`);
      setStats(await res.json());
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, []);

  const fetchRocketStats = useCallback(async () => {
    setRocketLoading(true);
    try {
      const res = await fetch(`${API}/spacex/rockets/stats`);
      setRocketStats(await res.json());
    } catch (e) {
      console.error("Failed to fetch SpaceX rocket stats:", e);
      setRocketStats(null);
    } finally {
      setRocketLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRocketStats(); }, [fetchRocketStats]);
  useEffect(() => {
    const timeout = setTimeout(fetchSatellites, search ? 400 : 0);
    return () => clearTimeout(timeout);
  }, [fetchSatellites, search]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🛰</span>
            <div>
              <h1>STARLINK TRACKER</h1>
              <p className="tagline">Live constellation database · Updated daily</p>
            </div>
          </div>
          <div className="header-meta">
            <span className="dot active" /> {stats?.active?.toLocaleString() ?? "—"} active
            <span className="dot decayed" /> {stats?.decayed?.toLocaleString() ?? "—"} decayed
          </div>
        </div>
      </header>

      <main className="main">
        <StatsBar stats={stats} />
        <RocketStats data={rocketStats} loading={rocketLoading} />

        <div className="controls">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="search"
              type="text"
              placeholder="Search by name or NORAD ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
            {search && (
              <button className="clear-btn" onClick={() => { setSearch(""); setPage(0); }}>✕</button>
            )}
          </div>

          <div className="filter-group">
            {["", "active", "decayed", "decaying"].map((s) => (
              <button
                key={s}
                className={`filter-btn ${statusFilter === s ? "active" : ""}`}
                onClick={() => { setStatusFilter(s); setPage(0); }}
              >
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="result-count">
            {loading ? "Loading…" : `${total.toLocaleString()} satellites`}
          </div>
        </div>

        <SatelliteTable
          satellites={satellites}
          loading={loading}
          onSelect={setSelected}
          selected={selected}
        />

        {total > PER_PAGE && (
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span>Page {page + 1} of {Math.ceil(total / PER_PAGE)}</span>
            <button disabled={(page + 1) * PER_PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
      </main>

      {selected && (
        <SatelliteDetail
          satellite={selected}
          apiBase={API}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
