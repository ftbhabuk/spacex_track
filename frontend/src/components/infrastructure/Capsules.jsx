import React from "react";

function Capsules({ data }) {
  return (
    <section className="infra-panel">
      <h3>Dragon Capsules</h3>
      
      {/* Educational content about capsules */}
      <div className="capsules-info">
        <div className="info-section">
          <h4>What are Dragon Capsules?</h4>
          <p>
            Dragon is a series of reusable spacecraft developed by SpaceX, designed to transport 
            humans and cargo to orbiting destinations. The spacecraft consists of a pressurized 
            capsule and an unpressurized trunk used for transporting cargo to and from orbit.
          </p>
        </div>
        
        <div className="info-section">
          <h4>Dragon Variants</h4>
          <p>
            SpaceX operates two main variants of the Dragon spacecraft:<br/>
            • <strong>Dragon 1</strong>: The original cargo version that flew missions to the 
              International Space Station (ISS) from 2010-2020.<br/>
            • <strong>Dragon 2</strong>: The current version in two configurations:<br/>
              &nbsp;&nbsp;– <em>Crew Dragon</em>: Transports astronauts to and from the ISS<br/>
              &nbsp;&nbsp;– <em>Cargo Dragon</em>: Transports supplies, equipment, and experiments
          </p>
        </div>
        
        <div className="info-section">
          <h4>Reusability and Flight Heritage</h4>
          <p>
            Dragon capsules are designed for multiple flights, with heat shields, avionics, and 
            other systems refurbished between missions. This reusability significantly reduces 
            the cost of access to space. Each capsule receives a serial number and flight history 
            tracking its missions and refurbishments.
          </p>
        </div>
      </div>
      
      {/* Actual capsule data from API */}
      <div className="info-section">
        <h4>Active Capsule Fleet</h4>
        <p>Current status of SpaceX Dragon capsules:</p>
        <div className="data-list">
          {(data?.capsules || []).slice(0, 6).map((capsule) => (
            <div key={capsule.capsule_id} className="data-item">
              <div className="capsule-info">
                <div>{capsule.name || capsule.capsule_id}</div>
                <div className="mono dim">
                  {capsule.capsule_id} ·{" "}
                  <span 
                    className="status-badge" 
                    style={{ 
                      "--c": (capsule.status || "").toLowerCase() === "active" ? "#2ea043" : 
                             (capsule.status || "").toLowerCase() === "retired" ? "#da3633" : 
                             "#8f8f8f"
                    }}
                  >
                    {(capsule.status || "").toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="capsule-stats mono">
                <div className="capsule-stat">
                  <span className="capsule-stat-label">Missions</span>
                  <span>{capsule.missions_reported ?? "—"}</span>
                </div>
                <div className="capsule-stat">
                  <span className="capsule-stat-label">Reuses</span>
                  <span>{capsule.reuses_reported ?? "—"}</span>
                </div>
              </div>
            </div>
          ))}
          {(data?.capsules || []).length > 6 && (
            <div className="data-item">
              <div>And {(data.capsules || []).length - 6} more capsules...</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Notable achievements */}
      <div className="info-section">
        <h4>Notable Achievements</h4>
        <ul className="achievements-list">
          <li>First private spacecraft to reach orbit (Dragon C101, 2010)</li>
          <li>First private spacecraft to berth with the ISS (Dragon C101, 2012)</li>
          <li>First reflight of an orbital spacecraft (Dragon C106, 2017)</li>
          <li>First private spacecraft to transport humans to orbit (Crew Dragon Demo-2, 2020)</li>
          <li>First splashdown of a commercial crew spacecraft (Crew Dragon Demo-2, 2020)</li>
        </ul>
      </div>
    </section>
  );
}

export default Capsules;
