import { ActiveStatIcon } from "./StatIcons";

export default function StatsBar({ stats }) {
  if (!stats) return <div className="stats-bar skeleton" />;

  const cards = [
    { label: "Total Tracked", value: stats.total?.toLocaleString(), icon: "📡" },
    { label: "Active", value: stats.active?.toLocaleString(), svg: true, highlight: true },
    { label: "Decayed / Reentered", value: stats.decayed?.toLocaleString(), icon: "🔴" },
    { label: "Avg Altitude", value: stats.avg_altitude_km ? `${stats.avg_altitude_km} km` : "—", icon: "📈" },
    { label: "Unknown Status", value: stats.unknown?.toLocaleString(), icon: "⚪" },
  ];

  return (
    <div className="stats-bar">
      {cards.map((c) => (
        <div key={c.label} className={`stat-card ${c.highlight ? "highlight" : ""}`}>
          {c.svg ? <ActiveStatIcon /> : <span className="stat-icon">{c.icon}</span>}
          <div>
            <div className="stat-value">{c.value ?? "—"}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
