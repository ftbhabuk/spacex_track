"""
Seed local PostgreSQL with SpaceX booster/capsule/landing-site data.

Run:
  python seed_spacex_assets.py
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from database import execute, executemany


DDL_SQL = """
CREATE TABLE IF NOT EXISTS spacex_boosters (
    serial               TEXT PRIMARY KEY,
    vehicle              TEXT NOT NULL,
    version              TEXT,
    status               TEXT NOT NULL,
    flights              INTEGER NOT NULL DEFAULT 0,
    comment              TEXT,
    landings_success     INTEGER NOT NULL DEFAULT 0,
    landings_attempts    INTEGER NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spacex_booster_missions (
    id                   BIGSERIAL PRIMARY KEY,
    booster_serial       TEXT NOT NULL REFERENCES spacex_boosters(serial) ON DELETE CASCADE,
    mission_name         TEXT NOT NULL,
    mission_date         DATE,
    landing_site         TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spacex_booster_missions_serial
ON spacex_booster_missions(booster_serial);

CREATE TABLE IF NOT EXISTS spacex_capsules (
    capsule_id           TEXT PRIMARY KEY,
    version              TEXT,
    status               TEXT NOT NULL,
    flights              INTEGER NOT NULL DEFAULT 0,
    comment              TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spacex_capsule_missions (
    id                   BIGSERIAL PRIMARY KEY,
    capsule_id           TEXT NOT NULL REFERENCES spacex_capsules(capsule_id) ON DELETE CASCADE,
    mission_name         TEXT NOT NULL,
    mission_date         DATE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spacex_capsule_missions_capsule
ON spacex_capsule_missions(capsule_id);

CREATE TABLE IF NOT EXISTS spacex_landing_sites (
    site_id              TEXT PRIMARY KEY,
    display_name         TEXT NOT NULL,
    landings_success     INTEGER NOT NULL DEFAULT 0,
    landings_attempts    INTEGER NOT NULL DEFAULT 0,
    additional_info      TEXT
);
"""


# Compact curated subset from the dataset provided by the user.
BOOSTERS = [
    {"serial": "B1103", "vehicle": "Falcon", "version": "Block 5", "status": "new", "flights": 0, "comment": "Undergoing testing at McGregor."},
    {"serial": "B1102", "vehicle": "Falcon", "version": "Block 5", "status": "new", "flights": 0, "comment": "Completed testing at McGregor."},
    {"serial": "B1101", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 2, "comment": "In operation in FL."},
    {"serial": "B1100", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 3, "comment": "In operation in CA."},
    {"serial": "B1099", "vehicle": "Falcon", "version": "Block 5", "status": "new", "flights": 0, "comment": "Converted Falcon Heavy Center Core."},
    {"serial": "B1098", "vehicle": "Falcon", "version": "Block 5", "status": "new", "flights": 0, "comment": "Falcon Heavy Center Core."},
    {"serial": "B1097", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 7, "comment": "In operation in CA."},
    {"serial": "B1096", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 5, "comment": "In operation in FL."},
    {"serial": "B1095", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 6, "comment": "In operation in FL."},
    {"serial": "B1094", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 6, "comment": "In operation in FL."},
    {"serial": "B1093", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 11, "comment": "In operation in CA."},
    {"serial": "B1092", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 10, "comment": "In operation in FL."},
    {"serial": "B1091", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 3, "comment": "Converted Falcon Heavy center core."},
    {"serial": "B1090", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 11, "comment": "In operation in FL."},
    {"serial": "B1089", "vehicle": "Falcon", "version": "Block 5", "status": "destroyed", "flights": 1, "comment": "Falcon Heavy center core. Intentionally expended on Europa Clipper."},
    {"serial": "B1088", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 14, "comment": "In operation in CA."},
    {"serial": "B1087", "vehicle": "Falcon", "version": "Block 5", "status": "destroyed", "flights": 1, "comment": "Falcon Heavy center core. Intentionally expended on GOES-U."},
    {"serial": "B1086", "vehicle": "Falcon", "version": "Block 5", "status": "destroyed", "flights": 5, "comment": "Lost in fire after JRTI landing on 2025-03-03."},
    {"serial": "B1085", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 14, "comment": "In operation in FL. Flew Crew-9."},
    {"serial": "B1083", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 16, "comment": "In operation in FL. Flew Crew-8 and Polaris Dawn."},
    {"serial": "B1082", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 20, "comment": "In operation in CA."},
    {"serial": "B1081", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 22, "comment": "In operation in CA. Flew Crew-7."},
    {"serial": "B1080", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 25, "comment": "In operation in FL. Flew AX-2, Euclid and AX-3."},
    {"serial": "B1078", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 26, "comment": "In operation in FL. Flew Crew-6."},
    {"serial": "B1077", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 26, "comment": "In operation in FL. Flew Crew-5."},
    {"serial": "B1076", "vehicle": "Falcon", "version": "Block 5", "status": "destroyed", "flights": 22, "comment": "Intentionally expended on SpainSat NG II."},
    {"serial": "B1075", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 21, "comment": "In operation in CA."},
    {"serial": "B1071", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 32, "comment": "In operation in CA."},
    {"serial": "B1069", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 30, "comment": "In operation in FL."},
    {"serial": "B1067", "vehicle": "Falcon", "version": "Block 5", "status": "active", "flights": 33, "comment": "In operation in FL. Current fleet leader."},
]


BOOSTER_MISSIONS = [
    ("B1101", "USCV-12 (Crew-12)", "Feb 13, 2026", "LZ-40"),
    ("B1101", "Starlink Group 6-88", "Jan 04, 2026", "JRTI"),
    ("B1100", "Starlink Group 17-34", "Feb 11, 2026", "OCISLY"),
    ("B1100", "NROL-105", "Jan 17, 2026", "LZ-4"),
    ("B1097", "Starlink Group 17-18", "Mar 07, 2026", "OCISLY"),
    ("B1097", "Starlink Group 17-20", "Jan 25, 2026", "OCISLY"),
    ("B1096", "GPS III SV09", "Jan 28, 2026", "ASOG"),
    ("B1096", "NROL-77", "Dec 10, 2025", "LZ-2"),
    ("B1095", "Starlink Group 10-48", "Mar 12, 2026", "JRTI"),
    ("B1095", "Starlink Group 6-101", "Jan 30, 2026", "JRTI"),
    ("B1094", "Starlink Group 6-99", "Dec 17, 2025", "JRTI"),
    ("B1094", "USCV-11 (Crew-11)", "Aug 01, 2025", "LZ-1"),
    ("B1093", "Starlink Group 17-26", "Feb 25, 2026", "OCISLY"),
    ("B1093", "Starlink Group 17-30", "Jan 22, 2026", "OCISLY"),
    ("B1092", "Starlink Group 6-110", "Feb 25, 2026", "JRTI"),
    ("B1092", "USSF-36 (OTV-8)", "Aug 22, 2025", "LZ-2"),
    ("B1091", "Bandwagon-4", "Nov 02, 2025", "LZ-2"),
    ("B1090", "Starlink Group 10-46", "Mar 15, 2026", "ASOG"),
    ("B1090", "USCV-10 (Crew-10)", "Mar 15, 2025", "LZ-1"),
    ("B1089", "Europa Clipper", "Oct 14, 2024", None),
    ("B1088", "Starlink Group 17-24", "Mar 14, 2026", "OCISLY"),
    ("B1088", "Transporter 12", "Jan 15, 2025", "LZ-4"),
    ("B1087", "GOES-U", "Jun 26, 2024", None),
    ("B1086", "Starlink Group 12-20", "Mar 03, 2025", "JRTI"),
    ("B1085", "EchoStar XXV", "Mar 10, 2026", "ASOG"),
    ("B1085", "USCV-9 (Crew-9)", "Sep 28, 2024", "LZ-1"),
    ("B1083", "Starlink Group 6-90", "Dec 12, 2025", "JRTI"),
    ("B1083", "USCV-8 (Crew-8)", "Mar 04, 2024", "LZ-1"),
    ("B1082", "Starlink Group 17-23", "Mar 01, 2026", "OCISLY"),
    ("B1082", "OneWeb #20", "Oct 20, 2024", "LZ-4"),
    ("B1081", "Starlink Group 17-13", "Feb 15, 2026", "OCISLY"),
    ("B1081", "USCV-7 (Crew-7)", "Aug 26, 2023", "LZ-1"),
    ("B1080", "Starlink Group 10-40", "Mar 04, 2026", "ASOG"),
    ("B1080", "AX-3", "Jan 19, 2024", "LZ-1"),
    ("B1078", "Starlink Group 10-41", "Mar 02, 2026", "JRTI"),
    ("B1078", "USCV-6 (Crew-6)", "Mar 02, 2023", "JRTI"),
    ("B1077", "Starlink Group 10-36", "Feb 20, 2026", "JRTI"),
    ("B1077", "USCV-5 (Crew-5)", "Oct 05, 2022", "JRTI"),
    ("B1076", "SPAINSAT NG II", "Oct 24, 2025", None),
    ("B1075", "Starlink Group 11-5", "Oct 22, 2025", "OCISLY"),
    ("B1071", "Starlink Group 17-31", "Mar 10, 2026", "OCISLY"),
    ("B1069", "Starlink Group 6-108", "Feb 27, 2026", "ASOG"),
    ("B1067", "Starlink Group 6-104", "Feb 22, 2026", "ASOG"),
]


CAPSULES = [
    ("C213", "Crew", "active", 1, 'Named "Grace". Final built Dragon. Flew 1 Axiom mission.'),
    ("C212", "Crew", "in-flight", 5, 'Named "Freedom". Flew 3 NASA Crew and 2 Axiom missions.'),
    ("C211", "Cargo 2", "active", 3, "Flew 3 CRS missions. First Dragon to fly with the boost-trunk."),
    ("C210", "Crew", "active", 4, 'Named "Endurance". Flew 4 NASA Crew missions.'),
    ("C209", "Cargo 2", "active", 6, "Flew 5 CRS missions."),
    ("C208", "Cargo 2", "active", 5, "Flew 5 CRS missions."),
    ("C207", "Crew", "active", 4, 'Named "Resilience". Flew Polaris Dawn, Inspiration4, Fram2 and 1 NASA Crew mission.'),
    ("C206", "Crew", "active", 6, 'Named "Endeavour". First Dragon to carry astronauts to orbit.'),
    ("C205", "Crew", "retired", 1, "Flew In-Flight Abort Test (IFA)."),
    ("C204", "Crew", "destroyed", 1, "Flew DM-1. Exploded during a subsequent test."),
    ("C203", "Cargo 2", "retired", 0, "Never flew."),
    ("C202", "Cargo 2", "retired", 0, "Never flew."),
    ("C201", "Cargo 2", "retired", 1, 'Named "Dragonfly". Conducted Pad Abort Test (PAT).'),
    ("C113", "Cargo 1", "retired", 2, "Flew 2 CRS missions."),
    ("C112", "Cargo 1", "retired", 3, "Flew 3 CRS missions."),
    ("C111", "Cargo 1", "retired", 2, "Flew 2 CRS missions."),
    ("C110", "Cargo 1", "retired", 2, "Flew 2 CRS missions."),
    ("C109", "Cargo 1", "destroyed", 1, "Flew CRS-7; structural failure resulted in loss."),
    ("C108", "Cargo 1", "retired", 3, "Flew 3 CRS missions."),
    ("C107", "Cargo 1", "retired", 1, "Flew CRS-5."),
    ("C106", "Cargo 1", "retired", 3, "Flew 3 CRS missions."),
    ("C105", "Cargo 1", "retired", 1, "Flew CRS-3."),
    ("C104", "Cargo 1", "retired", 1, "Flew CRS-2."),
    ("C103", "Cargo 1", "retired", 1, "Flew CRS-1."),
    ("C102", "Cargo 1", "retired", 1, "Flew COTS-2."),
    ("C101", "Cargo 1", "retired", 1, "Flew COTS-1."),
]


CAPSULE_MISSIONS = [
    ("C213", "AX-4", "Jun 25, 2025"),
    ("C212", "USCV-12 (Crew-12)", "Feb 13, 2026"),
    ("C212", "USCV-9 (Crew-9)", "Sep 28, 2024"),
    ("C212", "AX-3", "Jan 19, 2024"),
    ("C212", "AX-2", "May 22, 2023"),
    ("C212", "USCV-4 (Crew-4)", "Apr 27, 2022"),
    ("C211", "CRS-33", "Aug 24, 2025"),
    ("C211", "CRS-29", "Nov 10, 2023"),
    ("C211", "CRS-26", "Nov 27, 2022"),
    ("C210", "USCV-10 (Crew-10)", "Mar 15, 2025"),
    ("C210", "USCV-7 (Crew-7)", "Aug 26, 2023"),
    ("C210", "USCV-5 (Crew-5)", "Oct 05, 2022"),
    ("C210", "USCV-3 (Crew-3)", "Nov 11, 2021"),
    ("C209", "CRS-32", "Apr 21, 2025"),
    ("C209", "CRS-30", "Mar 22, 2024"),
    ("C209", "CRS-27", "Mar 15, 2023"),
    ("C209", "CRS-24", "Dec 21, 2021"),
    ("C209", "CRS-22", "Jun 03, 2021"),
    ("C208", "CRS-31", "Nov 05, 2024"),
    ("C208", "CRS-28", "Jun 05, 2023"),
    ("C208", "CRS-25", "Jul 15, 2022"),
    ("C208", "CRS-23", "Aug 29, 2021"),
    ("C208", "CRS-21", "Dec 06, 2020"),
    ("C207", "Fram2", "Apr 01, 2025"),
    ("C207", "Polaris Dawn", "Sep 10, 2024"),
    ("C207", "Inspiration4", "Sep 16, 2021"),
    ("C207", "USCV-1 (Crew-1)", "Nov 16, 2020"),
    ("C206", "USCV-11 (Crew-11)", "Aug 01, 2025"),
    ("C206", "USCV-8 (Crew-8)", "Mar 04, 2024"),
    ("C206", "USCV-6 (Crew-6)", "Mar 02, 2023"),
    ("C206", "AX-1", "Apr 08, 2022"),
    ("C206", "USCV-2 (Crew-2)", "Apr 23, 2021"),
    ("C206", "SpX DM-2 (Crewed)", "May 31, 2020"),
]


LANDING_SITES = [
    ("LZ-1", "Landing Zone 1", 53, 54, "Landing Zone 1"),
    ("LZ-2", "Landing Zone 2", 16, 16, "Landing Zone 2"),
    ("LZ-4", "Landing Zone 4", 33, 33, "Landing Zone 4"),
    ("LZ-40", "Landing Zone 40", 1, 1, "Landing Zone 40"),
    ("ASOG", "A Shortfall of Gravitas", 144, 145, "A Shortfall of Gravitas droneship"),
    ("JRTI", "Just Read The Instructions", 151, 154, "Just Read The Instructions droneship"),
    ("OCISLY", "Of Course I Still Love You", 182, 190, "Of Course I Still Love You droneship"),
    ("Catch", "Mechazilla Catch Arms", 3, 4, "Mechazilla catch arms for Starship"),
]


def parse_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = value.strip()
    if text.startswith("NET "):
        return None
    try:
        return datetime.strptime(text, "%b %d, %Y").date().isoformat()
    except ValueError:
        return None


def seed():
    print("Ensuring SpaceX asset tables exist...")
    execute(DDL_SQL)

    print("Clearing previous SpaceX asset rows...")
    execute("DELETE FROM spacex_booster_missions")
    execute("DELETE FROM spacex_boosters")
    execute("DELETE FROM spacex_capsule_missions")
    execute("DELETE FROM spacex_capsules")
    execute("DELETE FROM spacex_landing_sites")

    now = datetime.now(timezone.utc)

    print(f"Inserting boosters: {len(BOOSTERS)}")
    executemany(
        """
        INSERT INTO spacex_boosters (
            serial, vehicle, version, status, flights, comment,
            landings_success, landings_attempts, updated_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        [
            (
                b["serial"],
                b["vehicle"],
                b["version"],
                b["status"],
                b["flights"],
                b["comment"],
                0,
                0,
                now,
            )
            for b in BOOSTERS
        ],
    )

    print(f"Inserting booster missions: {len(BOOSTER_MISSIONS)}")
    executemany(
        """
        INSERT INTO spacex_booster_missions (booster_serial, mission_name, mission_date, landing_site)
        VALUES (%s,%s,%s,%s)
        """,
        [(s, m, parse_date(d), l) for s, m, d, l in BOOSTER_MISSIONS],
    )

    print(f"Inserting capsules: {len(CAPSULES)}")
    executemany(
        """
        INSERT INTO spacex_capsules (capsule_id, version, status, flights, comment, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s)
        """,
        [(c, v, s, f, cm, now) for c, v, s, f, cm in CAPSULES],
    )

    print(f"Inserting capsule missions: {len(CAPSULE_MISSIONS)}")
    executemany(
        """
        INSERT INTO spacex_capsule_missions (capsule_id, mission_name, mission_date)
        VALUES (%s,%s,%s)
        """,
        [(c, m, parse_date(d)) for c, m, d in CAPSULE_MISSIONS],
    )

    print(f"Inserting landing sites: {len(LANDING_SITES)}")
    executemany(
        """
        INSERT INTO spacex_landing_sites (
            site_id, display_name, landings_success, landings_attempts, additional_info
        ) VALUES (%s,%s,%s,%s,%s)
        """,
        LANDING_SITES,
    )

    print("Seed complete.")


if __name__ == "__main__":
    seed()
