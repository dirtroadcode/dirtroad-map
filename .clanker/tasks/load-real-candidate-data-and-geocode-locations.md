---
type: chore
title: Load real candidate data and geocode locations
added: '2026-03-17'
---

Replace the sample candidates.json with real data exported from the Google Sheets spreadsheet. Write a one-time geocoding script (Node or Python) that takes district names and uses Nominatim (OpenStreetMap) to resolve lat/lng coordinates. Run the script, verify coordinates are reasonable, and commit the final data file.
