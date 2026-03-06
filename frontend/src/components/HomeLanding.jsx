import { useState } from "react";

const DRAGON_BOOSTER_IMAGE = "https://wallpaperaccess.com/full/1094574.jpg";
const HERO_SPACEX_IMAGE = "https://wallpaperaccess.com/full/1094610.jpg";
const STARLINK_IMAGE_WEB = "https://images.hdqwalls.com/download/starlink-fe-2048x2048.jpg";
const FALCON_FLEET_IMAGE = "https://wallpaperaccess.com/full/1094566.jpg";
const STARSHIP_IMAGE_WEB = "https://wallpaperaccess.com/full/1094611.jpg";

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
  onOpenLaunches,
}) {
  const launches = rocketStats?.overall?.total_launches;
  const landings = rocketStats?.overall?.booster_landings;
  const reuse = rocketStats?.overall?.reusability_rate;
  const boosters = boosterIntel?.overall?.total_boosters;
  const maxReuse = boosterIntel?.overall?.max_reuse_count;
  const capsules = boosterIntel?.overall?.total_capsules;
  const activeStarlink = stats?.active;
  const totalSatellites = stats?.total;

  const images = {
    hero: HERO_SPACEX_IMAGE,
    falcon9: FALCON_FLEET_IMAGE,
    falconheavy: FALCON_FLEET_IMAGE,
    dragon: DRAGON_BOOSTER_IMAGE,
    starship: STARSHIP_IMAGE_WEB,
    starlink: STARLINK_IMAGE_WEB,
  };

  const quickStats = [
    { label: "Falcon 9 Launches", value: num(launches) },
    { label: "Booster Landings", value: num(landings) },
    { label: "Booster Reuse", value: pct(reuse) },
    { label: "Active Starlink", value: num(activeStarlink) },
  ];

  const starterFlow = [
    {
      badge: "[STARLINK]",
      title: "Starlink Constellation",
      text: "Delivering high-speed internet from space. Track active satellites, orbit shells, and constellation health.",
      metric: `${num(totalSatellites)} tracked · ${num(activeStarlink)} active`,
      metricHref: "https://satellitemap.space/vis/constellation/starlink",
      metricActionLabel: "Visual Map",
      action: onOpenStarlink,
      actionLabel: "Open Starlink",
      image: images.starlink,
    },
    {
      badge: "[FALCON]",
      title: "Falcon Booster Fleet",
      text: "Core-level booster tracking focused on reuse depth, landing outcomes, and current fleet status.",
      metric: `${num(boosters)} boosters · Max reuse ${num(maxReuse)}`,
      tallMedia: true,
      action: onOpenBoosters,
      actionLabel: "Open Boosters",
      image: images.falconheavy,
    },
    {
      badge: "[DRAGON]",
      title: "Dragon Vehicle",
      text: "Advancing human spaceflight with reusable crew and cargo missions to orbit.",
      metric: `${num(capsules)} capsules tracked`,
      metricActionLabel: "Booster Capsules Area",
      metricAction: onOpenBoosters,
      tallMedia: true,
      action: null,
      actionLabel: "",
      image: images.dragon,
    },
    {
      badge: "[STARSHIP]",
      title: "Starship Program",
      text: "Next-generation heavy-lift system designed for deep-space transport and high-mass deployment.",
      metric: "In development",
      metricActionLabel: "Tracking Soon",
      metricDisabled: true,
      tallMedia: true,
      action: null,
      actionLabel: "",
      image: images.starship,
    },
  ];

  return (
    <section className="home-landing">
      <div className="hero hero-z reveal-up">
        <div className="hero-copy">
          <p className="kicker">Mission Orientation</p>
          <h2>Get In Sync With The Current SpaceX Fleet State.</h2>
          <p className="hero-sub">
            Track Falcon booster performance and Starlink constellation state,
            launch cadence, and mission outcomes with Dragon and Starship context in the same view.
          </p>
          <div className="hero-actions">
            <button className="cta-btn" onClick={onOpenBoosters}>Start With Boosters</button>
            <button className="ghost-btn" onClick={onOpenLaunches}>View Launches</button>
            <button className="ghost-btn" onClick={onOpenStarlink}>Start With Starlink</button>
          </div>
        </div>

        <div className="hero-orbit-card">
          <SmartImage
            className="hero-orbit-image"
            srcs={[images.hero, images.falcon9, DRAGON_BOOSTER_IMAGE]}
            alt="SpaceX"
          />
          <div className="hero-orbit-overlay">
            {quickStats.map((item) => (
              <div key={item.label} className="orbit-stat">
                <div className="orbit-stat-value">{loading ? "..." : item.value}</div>
                <div className="orbit-stat-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="starter-z-grid">
        {starterFlow.map((item, idx) => (
          <article key={item.title} className={`starter-z-panel reveal-up delay-${idx + 1} ${idx % 2 === 1 ? "reverse" : ""} ${item.tallMedia ? "tall-media" : ""}`}>
            <div className="starter-z-media">
              <SmartImage
                srcs={[item.image, images.starlink, images.starship, DRAGON_BOOSTER_IMAGE]}
                alt={item.title}
              />
            </div>
            <div className="starter-z-copy">
              <p className="kicker">{item.badge}</p>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <div className="starter-z-metric-row">
                <div className="starter-z-metric mono">{item.metric}</div>
                {item.metricHref && (
                  <a className="panel-link-btn mono" href={item.metricHref} target="_blank" rel="noreferrer">
                    {item.metricActionLabel}
                  </a>
                )}
                {item.metricAction && (
                  <button className="panel-link-btn mono" onClick={item.metricAction}>
                    {item.metricActionLabel}
                  </button>
                )}
                {item.metricDisabled && (
                  <button className="panel-link-btn mono disabled" type="button" disabled>
                    {item.metricActionLabel}
                  </button>
                )}
              </div>
              {item.action && (
                <button className="ghost-btn" onClick={item.action}>{item.actionLabel}</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SmartImage({ srcs, alt, className = "" }) {
  const filtered = (srcs || []).filter(Boolean);
  const [index, setIndex] = useState(0);
  const current = filtered[index] || DRAGON_BOOSTER_IMAGE;

  return (
    <img
      className={className}
      src={current}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (index < filtered.length - 1) setIndex(index + 1);
      }}
    />
  );
}
