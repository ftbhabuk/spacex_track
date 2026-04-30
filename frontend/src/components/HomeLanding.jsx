import { useState, useEffect } from "react";

const FALLBACK_IMAGE = "/spacex-fallback.svg";
const DRAGON_BOOSTER_IMAGE = "https://wallpaperaccess.com/full/1094574.jpg";
const HERO_SPACEX_IMAGE   = "https://wallpaperaccess.com/full/1420557.jpg";
const STARLINK_IMAGE_WEB  = "https://images.hdqwalls.com/download/starlink-fe-2048x2048.jpg";
const FALCON_FLEET_IMAGE  = "https://wallpaperaccess.com/full/1094566.jpg";
const STARSHIP_IMAGE_WEB  = "https://wallpaperaccess.com/full/1094611.jpg";
const FALCON_9_IMAGE      = "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/F9_and_Heavy_visu.png/1920px-F9_and_Heavy_visu.png";

function num(v) { return v == null ? "—" : v.toLocaleString(); }
function pct(v) { return v == null ? "—" : `${v}%`; }

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate) - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      setTimeLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return timeLeft;
}

export default function HomeLanding({
  stats,
  rocketStats,
  boosterIntel,
  loading,
  onOpenBoosters,
  onOpenStarlink,
  onOpenLaunches,
  nextLaunch,
}) {
  const launches        = rocketStats?.overall?.total_launches;
  const landings        = rocketStats?.overall?.booster_landings;
  const reuse           = rocketStats?.overall?.reusability_rate;
  const boosters        = boosterIntel?.overall?.total_boosters;
  const maxReuse        = boosterIntel?.overall?.max_reuse_count;
  const capsules        = boosterIntel?.overall?.total_capsules;
  const activeStarlink  = stats?.active;
  const totalSatellites = stats?.total;

  const countdown = useCountdown(nextLaunch?.date);

  const images = {
    hero:        HERO_SPACEX_IMAGE,
    falcon9:     FALCON_FLEET_IMAGE,
    falconheavy: FALCON_FLEET_IMAGE,
    dragon:      DRAGON_BOOSTER_IMAGE,
    starship:    STARSHIP_IMAGE_WEB,
    starlink:    STARLINK_IMAGE_WEB,
  };

  // Back to 4 stats — no Starship flights
  const quickStats = [
    { label: "Falcon 9 Launches", value: num(launches) },
    { label: "Booster Landings",  value: num(landings) },
    { label: "Reuse Rate",        value: pct(reuse) },
    { label: "Active Starlink",   value: num(activeStarlink) },
  ];

  const starterFlow = [
    {
      badge: "[STARLINK]",
      title: "Starlink Constellation",
      text: "Delivering high-speed internet from low Earth orbit. Track active satellites, orbital shells, and constellation health.",
      metric: `${num(totalSatellites)} tracked · ${num(activeStarlink)} active`,
      metricHref: "https://satellitemap.space/vis/constellation/starlink",
      metricActionLabel: "Visual Map ↗",
      action: onOpenStarlink,
      actionLabel: "Open Starlink",
      image: images.starlink,
    },
    {
      badge: "[FALCON]",
      title: "Falcon Booster Fleet",
      text: "Core-level booster tracking — reuse depth, landing outcomes, and current fleet status across the entire Falcon family.",
      metric: `${num(boosters)} boosters · Max reuse ×${num(maxReuse)}`,
      tallMedia: true,
      action: onOpenBoosters,
      actionLabel: "Open Boosters",
      image: images.falconheavy,
    },
    {
      badge: "[DRAGON]",
      title: "Dragon Vehicle",
      text: "Reusable crew and cargo missions to the ISS and beyond. The only American spacecraft currently flying humans to orbit.",
      metric: `${num(capsules)} capsules tracked`,
      metricActionLabel: "View Capsules →",
      metricAction: onOpenBoosters,
      tallMedia: true,
      action: null,
      image: images.dragon,
    },
    {
      badge: "[STARSHIP]",
      title: "Starship Program",
      text: "The most powerful launch system ever built. Fully reusable, designed for deep space. Integrated Flight Tests ongoing from Boca Chica.",
      metric: "In development",
      metricActionLabel: "Tracking Soon",
      metricDisabled: true,
      tallMedia: true,
      action: null,
      image: images.starship,
    },
  ];

  return (
    <section className="home-landing">
      {/* ── HERO ── */}
      <div className="hero hero-z reveal-up">
        <div className="hero-copy">
          <p className="kicker">Mission Orientation</p>
          <h2>Get In Sync With The Current SpaceX Fleet State.</h2>
          <p className="hero-sub">
            Track Falcon booster performance and Starlink constellation health,
            launch cadence, and mission outcomes — with Dragon and Starship context in the same view.
          </p>

          {nextLaunch && (
            <div className="hl-countdown">
              <div className="hl-countdown-label">
                <span className="hl-countdown-dot" />
                <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "#9c9c9c", textTransform: "uppercase" }}>
                  Next Launch{nextLaunch.name ? ` · ${nextLaunch.name}` : ""}
                </span>
              </div>
              <div className="hl-countdown-ticker">
                {countdown ? (
                  <>
                    <CDUnit v={countdown.d} u="D" />
                    <span className="hl-cd-sep">:</span>
                    <CDUnit v={countdown.h} u="H" />
                    <span className="hl-cd-sep">:</span>
                    <CDUnit v={countdown.m} u="M" />
                    <span className="hl-cd-sep">:</span>
                    <CDUnit v={countdown.s} u="S" />
                  </>
                ) : (
                  <span className="mono" style={{ fontSize: 14, letterSpacing: "0.18em", color: "#e9e9e9" }}>LIVE NOW</span>
                )}
              </div>
            </div>
          )}

          <div className="hero-actions">
            <button className="cta-btn" onClick={onOpenBoosters}>Start With Boosters</button>
            <button className="ghost-btn" onClick={onOpenStarlink}>Start With Starlink</button>
            {onOpenLaunches && (
              <button className="ghost-btn" onClick={onOpenLaunches}>Launch History</button>
            )}
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
                <div className="orbit-stat-value">
                  {loading ? <span style={{ opacity: 0.35 }}>···</span> : item.value}
                </div>
                <div className="orbit-stat-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div className="hl-section-divider">
        <span className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "#555", textTransform: "uppercase" }}>
          Program Overview
        </span>
      </div>

      {/* ── PROGRAM PANELS ── */}
      <div className="starter-z-grid">
        {starterFlow.map((item, idx) => (
          <article
            key={item.title}
            className={[
              "starter-z-panel reveal-up",
              `delay-${idx + 1}`,
              idx % 2 === 1 ? "reverse" : "",
              item.tallMedia ? "tall-media" : "",
            ].filter(Boolean).join(" ")}
          >
            <div className="starter-z-media" style={{ position: "relative" }}>
              <SmartImage
                srcs={[item.image, images.starlink, images.starship, DRAGON_BOOSTER_IMAGE]}
                alt={item.title}
              />
              {/* Plain text badge — no box */}
              <span className="hl-panel-badge mono">{item.badge}</span>
            </div>

            <div className="starter-z-copy">
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
                <div style={{ marginTop: 6 }}>
                  <button className="ghost-btn" onClick={item.action}>{item.actionLabel}</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

    </section>
  );
}

function CDUnit({ v, u }) {
  return (
    <div className="hl-cd-unit">
      <span className="hl-cd-num">{String(v).padStart(2, "0")}</span>
      <span className="hl-cd-lbl">{u}</span>
    </div>
  );
}

function SmartImage({ srcs, alt, className = "" }) {
  const filtered = (srcs || []).filter(Boolean);
  const [index, setIndex] = useState(0);
  const current = filtered[index] || FALLBACK_IMAGE;
  return (
    <img
      className={className}
      src={current}
      alt={alt}
      loading="lazy"
      onError={() => {
        setIndex((currentIndex) => (
          currentIndex < filtered.length ? currentIndex + 1 : currentIndex
        ));
      }}
    />
  );
}
