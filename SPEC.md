# do-map Specification

## Overview

Dirtroad Organizing needs an interactive map of all their candidates, embedded on the org's Squarespace site via iframe. The map is hosted on GitHub Pages as a standalone page.

The map displays candidate locations as colored circle markers (color-coded by office type). Clicking a marker shows a popup with the candidate's name, office sought, district, thumbnail photo, and a link to their campaign website.

## MVP Scope

The MVP is a **static Leaflet map** with candidate data loaded from a JSON file checked into the repo. No filtering, no live data pull from Google Sheets.

### In Scope (MVP)
- Leaflet map centered on the US
- Colored circle markers (color per office type)
- Click-to-view popups with candidate details
- Hosted on GitHub Pages, embedded in Squarespace via iframe
- Auto-deploy via GitHub Actions on push to main

### Out of Scope (for now)
- User accounts or authentication (map is public, read-only)
- Editing candidates from the map UI (all data managed in Google Sheets, exported to JSON)
- Filtering by election cycle/year
- Marker clustering
- Live Google Sheets integration

## Tech Stack

| Component       | Choice              | Rationale                                                    |
| --------------- | ------------------- | ------------------------------------------------------------ |
| Map library     | Leaflet             | Lightweight, well-documented, standard for interactive maps  |
| Build tool      | Vite (vanilla JS)   | Dev server with hot reload, clean production builds, no framework overhead |
| Data format     | JSON file in repo   | Simple, version-controlled, no API keys needed for MVP       |
| Hosting         | GitHub Pages        | Free static hosting, easy CI/CD with GitHub Actions          |
| Embedding       | iframe              | Standard approach for Squarespace, most reliable             |
| CI/CD           | GitHub Actions      | Auto-deploy to GitHub Pages on push to main                  |

## Data Model

Each candidate has the following fields:

| Field       | Type   | Description                                  |
| ----------- | ------ | -------------------------------------------- |
| name        | string | Candidate's full name                        |
| office      | string | Office sought (e.g., "State House", "County Commissioner") |
| district    | string | District name or number                      |
| photo       | string | URL to a thumbnail photo                     |
| website     | string | URL to campaign website                      |
| cycle       | string | Election cycle/year (e.g., "2024", "2026")   |
| lat         | number | Latitude coordinate                          |
| lng         | number | Longitude coordinate                         |

Candidate data lives in Google Sheets as the source of truth. For updates, export from Google Sheets, convert to JSON, commit to the repo, and push to deploy.

### Geocoding

Candidate coordinates will be determined using a one-time geocoding approach:
- Use Nominatim (OpenStreetMap, free) or US Census TIGER data to geocode district names to center-point coordinates
- Cache the resulting lat/lng values directly in the JSON data file
- No ongoing geocoding service cost

## UI & Appearance

- **Map only** — no header, title bar, or branding in the map itself (Squarespace page handles branding)
- **Initial view**: Centered on the continental US, zoomed to show all markers
- **Markers**: Colored circle markers, color-coded by office type (e.g., state house = blue, state senate = green, county = orange, etc.)
- **Popups**: On marker click, display candidate name, office, district, thumbnail photo, and campaign website link
- **Map tiles**: OpenStreetMap (free, no API key)
- **Responsive**: Must work well at various iframe sizes on desktop and mobile

## Development & Deployment

- **Dev environment**: `npm run dev` starts Vite dev server with hot reload
- **Build**: `npm run build` produces static assets in `dist/`
- **Deploy**: Push to `main` triggers GitHub Actions workflow that builds and deploys to GitHub Pages
- **Maintainer**: Technical person comfortable with git and JSON

## Future Enhancements

These are explicitly deferred but tracked for later:
1. **Cycle filtering** — toggle between current and past election cycles
2. **Marker clustering** — group nearby markers when zoomed out (Leaflet.markercluster)
3. **Live Google Sheets integration** — pull data at build time via Sheets API
4. **Party color-coding** — additional color dimension for party affiliation
