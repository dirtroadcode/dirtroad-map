#!/usr/bin/env python3
"""
Generate a single column of values for pasting into the Google Sheet.

Fetches the current published CSV to get the exact row order, then outputs
the requested column — one value per row (empty rows preserved for seamless
copy-paste). Supports computing Census centroid coordinates for district-based
candidates.

Usage:
    ./scripts/sheet-column.py <column>

Columns:
    lat         Census centroid latitude (falls back to current value for
                non-legislative districts, leaves blank if no match)
    lng         Census centroid longitude (same fallback behavior)
    <name>      Any column name from the sheet (pass-through, e.g. "name", "district")

Examples:
    ./scripts/sheet-column.py lat
    ./scripts/sheet-column.py lng
    ./scripts/sheet-column.py name
"""

import csv
import io
import os
import re
import sys
import urllib.request

SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vTWI2J4Ft6P1WzimxGQ39K7XcbEQv-3H6T6B2mnmq1w_nIxSLK_01pRJlGIdCT-PdDQK2WeUh-Xer_l"
    "/pub?gid=1399665600&single=true&output=csv"
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GAZ_DIR = os.path.join(SCRIPT_DIR, "..", "data", "gazetteer")
SLDL_FILE = os.path.join(GAZ_DIR, "2024_Gaz_sldl_national.txt")
SLDU_FILE = os.path.join(GAZ_DIR, "2024_Gaz_sldu_national.txt")

# Map state names to USPS abbreviations
STATE_ABBREV = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY",
}

# Offices that map to upper chamber (Senate) gazetteer
UPPER_CHAMBER_OFFICES = {"State Senate", "State Senator", "State Senate District"}


def load_gazetteer():
    """Load both gazetteer files into a lookup dict.

    Returns dict: (usps, chamber, district_key) -> (lat, lng)
    where district_key is the normalized district identifier.
    """
    lookup = {}

    for filepath, chamber in [(SLDL_FILE, "lower"), (SLDU_FILE, "upper")]:
        if not os.path.exists(filepath):
            print(f"Warning: {filepath} not found", file=sys.stderr)
            continue
        with open(filepath, "r") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) < 9 or parts[0] == "USPS":
                    continue
                usps = parts[0].strip()
                name = parts[2].strip()
                lat = parts[7].strip()
                lng = parts[8].strip()

                # Extract district identifier from the NAME field
                # Examples: "State House District 32", "State House District Hillsborough 28",
                #           "Orleans-4 State House District", "Assembly District 34"
                dist_key = normalize_gaz_name(name)
                if dist_key:
                    lookup[(usps, chamber, dist_key)] = (lat, lng)

    return lookup


def normalize_gaz_name(name):
    """Extract a normalized district key from a gazetteer NAME field."""
    # Remove common prefixes/suffixes
    name = re.sub(
        r"^(State House|State Senate|Assembly|Delegate|House|Senate)\s+District\s+",
        "",
        name,
    )
    name = re.sub(r"\s+(State House|State Senate|Assembly|Delegate)\s+District$", "", name)
    # Convert hyphens to spaces for matching (e.g., "Orleans-4" -> "Orleans 4")
    name = name.replace("-", " ")
    return name.strip().lower()


def normalize_candidate_district(district):
    """Normalize a candidate's district field for matching against gazetteer."""
    if not district:
        return None
    # Strip "District " prefix
    d = re.sub(r"^District\s+", "", district.strip())
    # Convert hyphens to spaces
    d = d.replace("-", " ")
    return d.strip().lower()


def determine_chamber(office):
    """Determine if an office is upper or lower chamber."""
    office_lower = office.lower() if office else ""
    if any(kw in office_lower for kw in ["senate", "senator"]):
        return "upper"
    if any(kw in office_lower for kw in [
        "representative", "assembly", "delegate", "house",
    ]):
        return "lower"
    return None


def is_legislative_district(row):
    """Check if a candidate has a legislative district we can look up."""
    office = row.get("office", "")
    district = row.get("district", "")
    if not district:
        return False
    # Skip county, city, school board, etc.
    office_lower = office.lower()
    if any(kw in office_lower for kw in [
        "county", "city council", "town", "board of education",
        "school board", "supervisor", "secretary",
    ]):
        return False
    return determine_chamber(office) is not None


def fetch_sheet():
    """Fetch and parse the published Google Sheet CSV."""
    req = urllib.request.Request(SHEET_CSV_URL)
    with urllib.request.urlopen(req) as resp:
        text = resp.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def lookup_centroid(row, gazetteer):
    """Look up Census centroid for a candidate row. Returns (lat, lng) or None."""
    if not is_legislative_district(row):
        return None

    state_abbrev = STATE_ABBREV.get(row.get("state", ""))
    if not state_abbrev:
        return None

    chamber = determine_chamber(row.get("office", ""))
    if not chamber:
        return None

    district = normalize_candidate_district(row.get("district", ""))
    if not district:
        return None

    # Try exact match first
    result = gazetteer.get((state_abbrev, chamber, district))
    if result:
        return result

    # For sub-districts like "1B" in Idaho, try the parent district number
    parent = re.match(r"^(\d+)[ab]$", district, re.IGNORECASE)
    if parent:
        result = gazetteer.get((state_abbrev, chamber, parent.group(1)))
        if result:
            return result

    # Try zero-padded version (e.g., "8" -> "08")
    if district.isdigit():
        padded = district.zfill(2)
        result = gazetteer.get((state_abbrev, chamber, padded))
        if result:
            return result

    # Try zero-padding the numeric suffix (e.g., "grafton 5" -> "grafton 05")
    m = re.match(r"^(.+\s)(\d+)([ab]?)$", district, re.IGNORECASE)
    if m:
        padded = f"{m.group(1)}{m.group(2).zfill(2)}{m.group(3)}"
        result = gazetteer.get((state_abbrev, chamber, padded))
        if result:
            return result

    return None


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    column = sys.argv[1]

    rows = fetch_sheet()
    gazetteer = load_gazetteer()

    if column in ("lat", "lng"):
        idx = 0 if column == "lat" else 1
        for row in rows:
            centroid = lookup_centroid(row, gazetteer)
            if centroid:
                print(centroid[idx])
            else:
                # Fall back to current value (preserve non-legislative coords)
                print(row.get(column, ""))
    elif column in rows[0] if rows else False:
        for row in rows:
            print(row.get(column, ""))
    else:
        avail = ", ".join(rows[0].keys()) if rows else "none"
        print(f"Unknown column: {column}", file=sys.stderr)
        print(f"Available: lat, lng, {avail}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
