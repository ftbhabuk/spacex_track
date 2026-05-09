import React from "react";

function DroneShipTable({ data }) {
  // Static droneship data based on the requirements
  const droneShips = [
    {
      vessel: "Just Read The Instructions (I)",
      homePort: "N/A",
      status: "Scrapped"
    },
    {
      vessel: "Of Course I Still Love You",
      homePort: "Long Beach",
      status: "Active"
    },
    {
      vessel: "Just Read The Instructions (II)",
      homePort: "Port Canaveral",
      status: "Active"
    },
    {
      vessel: "A Shortfall of Gravitas",
      homePort: "Port Canaveral",
      status: "Active"
    }
  ];

  return (
    <section className="infra-panel">
      <h3>Autonomous Spaceport Drone Ships (ASDS)</h3>
      
      {/* Educational content about droneships */}
      <div className="droneship-info">
        <div className="info-section">
          <h4>What are Autonomous Spaceport Drone Ships?</h4>
          <p>
            Autonomous Spaceport Drone Ships (ASDS) are seagoing vessels that serve as mobile landing 
            platforms for SpaceX's Falcon 9 and Falcon Heavy boosters. These ships enable landings for 
            missions that don't have enough fuel to return to the launch site, such as geostationary 
            transfers or high-inclination orbits.
          </p>
        </div>
        
        <div className="info-section">
          <h4>ASDS Fleet & Operations</h4>
          <p>
            SpaceX operates several droneships including "Just Read the Instructions" (JRTI) in 
            California, "A Shortfall of Gravitas" (ASOG) and "Of Course I Still Love You" (OCISLY) in 
            the Atlantic. These ships are equipped with thrusters to maintain position and capture 
            landing boosters.
          </p>
          <div className="media-content">
            <div className="video-wrapper">
              <iframe 
                width="100%" 
                height="150" 
                src="https://www.youtube.com/embed/sYmQQn_ZSys" 
                title="Falcon 9 Landing on Droneship" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      </div>
      
      {/* Droneship table */}
      <div className="table-container">
        <table className="droneship-table">
          <thead>
            <tr>
              <th>Vessel</th>
              <th>Home Port</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {droneShips.map((ship) => (
              <tr key={ship.vessel}>
                <td data-label="Vessel">{ship.vessel}</td>
                <td data-label="Home Port">{ship.homePort}</td>
                <td data-label="Status">
                  <span 
                    className={`status-badge ${ship.status.toLowerCase()}`}
                    style={{ 
                      "--c": ship.status.toLowerCase() === "active" ? "#2ea043" : 
                             ship.status.toLowerCase() === "scrapped" ? "#da3633" : 
                             "#8f8f8f"
                    }}
                  >
                    {ship.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      

    </section>
  );
}

export default DroneShipTable;
