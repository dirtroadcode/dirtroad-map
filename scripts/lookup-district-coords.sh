#!/usr/bin/env bash
#
# Look up Census centroid coordinates for a US state legislative district.
#
# Usage:
#   ./scripts/lookup-district-coords.sh <state> <chamber> <district>
#
# Arguments:
#   state     Two-letter state abbreviation (e.g., NH, TN, OH)
#   chamber   "upper" (Senate) or "lower" (House/Assembly)
#   district  District name as it appears in the data (e.g., "Hillsborough 28", "32", "7B")
#
# Examples:
#   ./scripts/lookup-district-coords.sh NH lower "Hillsborough 28"
#   ./scripts/lookup-district-coords.sh TN lower 32
#   ./scripts/lookup-district-coords.sh OH upper 31

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data/gazetteer"

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <state> <upper|lower> <district>" >&2
  exit 1
fi

STATE="$1"
CHAMBER="$2"
DISTRICT="$3"

case "$CHAMBER" in
  upper) FILE="$DATA_DIR/2024_Gaz_sldu_national.txt" ;;
  lower) FILE="$DATA_DIR/2024_Gaz_sldl_national.txt" ;;
  *)
    echo "Error: chamber must be 'upper' or 'lower'" >&2
    exit 1
    ;;
esac

if [[ ! -f "$FILE" ]]; then
  echo "Error: gazetteer file not found: $FILE" >&2
  exit 1
fi

# Search for the district — match state + district identifier in the NAME column
# Gazetteer format: USPS<tab>GEOID<tab>NAME<tab>...rest...<tab>INTPTLAT<tab>INTPTLONG
MATCH=$(grep -P "^${STATE}\t" "$FILE" | grep -i "District ${DISTRICT}\b" || true)

if [[ -z "$MATCH" ]]; then
  # Try without "District " prefix for county-named districts (e.g., "Hillsborough 28")
  MATCH=$(grep -P "^${STATE}\t" "$FILE" | grep -i "${DISTRICT}" || true)
fi

if [[ -z "$MATCH" ]]; then
  echo "No match found for ${STATE} ${CHAMBER} '${DISTRICT}'" >&2
  exit 1
fi

COUNT=$(echo "$MATCH" | wc -l)
if [[ "$COUNT" -gt 1 ]]; then
  echo "Multiple matches found — showing all:" >&2
  echo "$MATCH" | while IFS=$'\t' read -r usps geoid name _ _ _ _ lat lng; do
    # Trim whitespace
    lat=$(echo "$lat" | tr -d '[:space:]')
    lng=$(echo "$lng" | tr -d '[:space:]')
    echo "  ${name}: ${lat}, ${lng}"
  done
  exit 1
fi

echo "$MATCH" | while IFS=$'\t' read -r usps geoid name _ _ _ _ lat lng; do
  lat=$(echo "$lat" | tr -d '[:space:]')
  lng=$(echo "$lng" | tr -d '[:space:]')
  echo "${lat}, ${lng}"
done
