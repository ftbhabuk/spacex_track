import { useState, useEffect, useCallback } from "react";
import SatelliteTable from "./components/SatelliteTable";
import SatelliteDetail from "./components/SatelliteDetail";
import StatsBar from "./components/StatsBar";
import RocketStats from "./components/RocketStats";
import BoosterDashboard from "./components/BoosterDashboard";
import HomeLanding from "./components/HomeLanding";
import LaunchesBoard from "./components/LaunchesBoard";
import "./index.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [view, setView] = useState("home");
  const [satellites, setSatellites] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rocketStats, setRocketStats] = useState(null);
  const [rocketLoading, setRocketLoading] = useState(true);
  const [boosterIntel, setBoosterIntel] = useState(null);
  const [boosterLoading, setBoosterLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("launch_date");
  const [sortDir, setSortDir] = useState("desc");
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
        sort_by: sortBy,
        sort_dir: sortDir,
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
  }, [search, statusFilter, sortBy, sortDir, page]);

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

  const fetchBoosterIntel = useCallback(async () => {
    setBoosterLoading(true);
    try {
      const res = await fetch(`${API}/spacex/boosters/intel`);
      setBoosterIntel(await res.json());
    } catch (e) {
      console.error("Failed to fetch SpaceX booster intel:", e);
      setBoosterIntel(null);
    } finally {
      setBoosterLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchRocketStats(); }, [fetchRocketStats]);
  useEffect(() => { fetchBoosterIntel(); }, [fetchBoosterIntel]);
  useEffect(() => {
    const timeout = setTimeout(fetchSatellites, search ? 400 : 0);
    return () => clearTimeout(timeout);
  }, [fetchSatellites, search]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <button className="logo logo-btn" onClick={() => setView("home")}>
            <span className="logo-icon">SX</span>
            <div>
              <h1>SPACEX TRACKER SX</h1>
              <p className="tagline">SpaceX boosters, launches, Starlink, Dragon, and Starship context</p>
            </div>
          </button>
          <div className="header-meta">
            <button
              className={`nav-btn ${view === "home" ? "active" : ""}`}
              onClick={() => setView("home")}
            >
              Home
            </button>
            <button
              className={`nav-btn ${view === "boosters" ? "active" : ""}`}
              onClick={() => setView("boosters")}
            >
              Boosters
            </button>
            <button
              className={`nav-btn ${view === "launches" ? "active" : ""}`}
              onClick={() => setView("launches")}
            >
              Launches
            </button>
            <button
              className={`nav-btn ${view === "starlink" ? "active" : ""}`}
              onClick={() => setView("starlink")}
            >
              Starlink
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {view === "home" && (
          <HomeLanding
            stats={stats}
            rocketStats={rocketStats}
            boosterIntel={boosterIntel}
            loading={rocketLoading || boosterLoading}
            onOpenBoosters={() => setView("boosters")}
            onOpenStarlink={() => setView("starlink")}
            onOpenLaunches={() => setView("launches")}
          />
        )}

        {view === "boosters" && (
          <>
            <RocketStats data={rocketStats} loading={rocketLoading} />
            <BoosterDashboard data={boosterIntel} loading={boosterLoading} />
          </>
        )}

        {view === "launches" && (
          <LaunchesBoard data={rocketStats} loading={rocketLoading} />
        )}

        {view === "starlink" && (
          <>
            <StatsBar stats={stats} />

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

              <div className="sort-wrap">
                <label className="sort-label" htmlFor="sat-sort">Sort</label>
                <select
                  id="sat-sort"
                  className="sort-select"
                  value={`${sortBy}:${sortDir}`}
                  onChange={(e) => {
                    const [nextBy, nextDir] = e.target.value.split(":");
                    setSortBy(nextBy);
                    setSortDir(nextDir);
                    setPage(0);
                  }}
                >
                  <option value="launch_date:desc">Latest Launch Date</option>
                  <option value="norad_id:desc">Latest NORAD ID</option>
                  <option value="name:asc">Name A-Z</option>
                  <option value="name:desc">Name Z-A</option>
                </select>
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
          </>
        )}
      </main>

      {selected && (
        <SatelliteDetail
          satellite={selected}
          apiBase={API}
          onClose={() => setSelected(null)}
        />
      )}

      <footer className="app-footer">
        <div className="app-footer-inner">
          <div>
            <div className="app-footer-title mono">SPACEX TRACKER SX</div>
            <p className="app-footer-copy">
              Personal project built from public databases and open mission feeds.
              Coverage is expanding and many features are still to be added.
            </p>
          </div>
          <div className="app-footer-meta mono">
            <span>Launch + booster + constellation watch</span>
            <span>To be continued...</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
