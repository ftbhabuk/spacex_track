import React from "react";

function LandingZoneTable({ data }) {
  // Static landing zone data based on the requirements
  const landingZones = [
    {
      zone: "LZ-1",
      status: "Retired",
      firstLanding: "December 21, 2015",
      lastLanding: "August 1, 2025",
      totalLandings: "54 (53 successful, 1 failure)",
      notableUse: "Used for Falcon 9 and Falcon Heavy"
    },
    {
      zone: "LZ-2",
      status: "Retired",
      firstLanding: "February 6, 2018",
      lastLanding: "December 9, 2025",
      totalLandings: "16 (all successful)",
      notableUse: "Primarily for Falcon Heavy side boosters"
    }
  ];

  // New landing zones under construction
  const newLandingZones = [
    {
      zone: "LZ-3",
      status: "Under Construction",
      firstLanding: "N/A",
      lastLanding: "N/A",
      totalLandings: "0",
      notableUse: "Future landing zone at Cape Canaveral"
    },
    {
      zone: "LZ-4",
      status: "Under Construction",
      firstLanding: "N/A",
      lastLanding: "N/A",
      totalLandings: "0",
      notableUse: "Future landing zone at Vandenberg SFB"
    }
  ];

  return (
    <section className="infra-panel">
      <h3>Landing Zones</h3>
      
      {/* Educational content about landing zones */}
      <div className="landing-zones-info">
        <div className="info-section">
          <h4>What are Landing Zones?</h4>
          <p>
            Landing Zones (LZ) are SpaceX's ground-based landing facilities at Cape Canaveral 
            Space Force Station and Vandenberg Space Force Base. These concrete pads enable 
            Falcon 9 and Falcon Heavy boosters to return and land vertically after launch, 
            making rocket reusability possible.
          </p>
        </div>
        
        <div className="info-section">
          <h4>Landing Zone 1 (LZ-1) & Landing Zone 2 (LZ-2)</h4>
          <p>
            Located at Cape Canaveral Space Force Station in Florida, LZ-1 and LZ-2 are SpaceX's primary
            landing sites for return-to-launch-site (RTLS) missions. LZ-1 was used for the first successful
            booster landing in December 2015.
          </p>
          <div className="media-content">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Landing_Zones_1_and_2.jpg/800px-Landing_Zones_1_and_2.jpg" 
              alt="Landing Zones 1 and 2 at Cape Canaveral"
              className="info-image"
            />
            <div className="video-wrapper">
              <iframe 
                width="100%" 
                height="150" 
                src="https://www.youtube.com/embed/ackZ-Ei4JB8?start=3" 
                title="Falcon 9 Landing at LZ-1" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
        
        <div className="info-section">
          <h4>Current Status</h4>
          <p>
            As of 2026, LZ-1 and LZ-2 have been retired from active service after supporting 
            numerous missions. New landing zones are under construction to support increased 
            launch frequency.
          </p>
        </div>
      </div>
      
      {/* Landing zones table */}
      <div className="table-container">
        <table className="landing-zones-table">
          <thead>
            <tr>
              <th>Landing Zone</th>
              <th>Status</th>
              <th>First Landing</th>
              <th>Last Landing</th>
              <th>Total Landings</th>
              <th>Notable Use</th>
            </tr>
          </thead>
          <tbody>
            {landingZones.map((zone) => (
              <tr key={zone.zone}>
                <td data-label="Landing Zone">{zone.zone}</td>
                <td data-label="Status">{zone.status}</td>
                <td data-label="First Landing">{zone.firstLanding}</td>
                <td data-label="Last Landing">{zone.lastLanding}</td>
                <td data-label="Total Landings">{zone.totalLandings}</td>
                <td data-label="Notable Use">{zone.notableUse}</td>
              </tr>
            ))}
            {newLandingZones.map((zone) => (
              <tr key={zone.zone} className="under-construction">
                <td data-label="Landing Zone">{zone.zone}</td>
                <td data-label="Status">{zone.status}</td>
                <td data-label="First Landing">{zone.firstLanding}</td>
                <td data-label="Last Landing">{zone.lastLanding}</td>
                <td data-label="Total Landings">{zone.totalLandings}</td>
                <td data-label="Notable Use">{zone.notableUse}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default LandingZoneTable;
