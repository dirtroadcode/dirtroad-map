# do-map — Dirtroad Organizing Candidate Map

## Overview

Interactive Leaflet map of Dirtroad Organizing candidates, embedded in a Squarespace site via iframe. Hosted on GitHub Pages at `dirtroadcode.github.io/dirtroad-map`.

## Data Flow

**The live data source is a Google Sheet**, not a file in this repo. The map fetches it at runtime as CSV:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vTWI2J4Ft6P1WzimxGQ39K7XcbEQv-3H6T6B2mnmq1w_nIxSLK_01pRJlGIdCT-PdDQK2WeUh-Xer_l/pub?gid=1399665600&single=true&output=csv
```

Changes to the sheet are reflected on the map immediately (no deploy needed). Code changes require a git push to trigger GitHub Actions deploy.

## Sheet Schema

| Column   | Required | Notes |
|----------|----------|-------|
| name     | yes      | Full name, sorted alphabetically in sheet |
| level    | yes      | `state`, `county`, or `local` — drives marker color |
| office   | yes      | Canonical: `State Representative`, `State Senate`, `State Delegate`, `State Assembly`, `County Commissioner`, `County Supervisor`, `County Board of Supervisors`, `City Council`, `School Board`, `Board of Education`, `Town Supervisor`, `Secretary of State` |
| district | no       | e.g. "District 42", "Hillsborough 28", "Lawrence County" |
| town     | no       | **Only populated for `local` level** — state/county races leave this blank |
| state    | no       | Full state name (e.g. "Tennessee", not "TN") |
| photo    | no       | URL to self-hosted webp on GitHub Pages |
| website  | no       | Campaign website URL |
| cycle    | yes      | Election year (e.g. "2026") |
| lat      | yes      | Latitude (computed via gazetteer or Nominatim) |
| lng      | yes      | Longitude |

## Directory Structure

```
assets/          Raw candidate photos (various formats) — source files for processing
data/backups/    Timestamped CSV snapshots of the live sheet
data/gazetteer/  Census TIGER gazetteer files for district centroid lookups
public/photos/   Processed 400x400 webp thumbnails (deployed to GitHub Pages)
references/      HTML exports from Google Sheets, reference data
scripts/         Import, geocoding, and photo processing tools
src/             App code (main.js, style.css)
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/process-photos.mjs` | Matches `assets/` photos to sheet names, crops/resizes to 400x400 webp, outputs to `public/photos/`. **assets/ is single source of truth** — no downloading from sheet URLs. Run: `npm run photos` |
| `scripts/sheet-column.py` | Fetches live sheet and prints a single column to stdout (preserving row order) for paste-in. Also computes Census centroid coords via gazetteer lookup. Usage: `./scripts/sheet-column.py <column>` where column is any sheet column name, or `lat`/`lng` for computed coords |
| `scripts/lookup-district-coords.sh` | Single district centroid lookup from Census gazetteer. Usage: `./scripts/lookup-district-coords.sh <ST> <upper|lower> <district>` |
| `scripts/geocode.mjs` | Nominatim geocoding for non-legislative locations. Has a hardcoded `LOCATIONS` map — update before running |
| `scripts/import-directory.mjs` | Legacy: imports from a Directory zip export. Probably not the current workflow |

## Photo Processing Workflow

**`assets/` is the single source of truth for raw photos. `public/photos/` is fully regenerable derived output.** Never point the sheet's photo column back at our own hosted URLs as a source — that creates a circular dependency.

1. **Acquire raw photos** for new candidates. Options:
   - **Campaign websites**: use `curl_chrome131` (via `nix-shell -p curl-impersonate`) to fetch the page and extract `og:image` or prominent `<img>` tags. Most campaign sites (Squarespace, Wix, etc.) have usable og:image URLs. Some sites (GoDaddy/Sucuri) captcha-block automated requests.
   - **Facebook pages**: re-fetch the FB page to get a **fresh** CDN token (they expire), then download the `og:image` URL immediately. Must use `curl_chrome131` — regular curl gets 403 from FB CDN. VPN location matters — US-based works best.
   - **Ballotpedia**: og:image URLs point to thumbnails. Strip `/thumbs/WxH/` from the path to get full-size originals (e.g. `s3.amazonaws.com/ballotpedia-api4/files/{name}.jpg`).
   - **Manual**: user drops a file directly into `assets/`
2. **Save to `assets/`** — any format (jpg, png, webp, avif). Filename should match candidate name (e.g. `Brian Deer.jpg` auto-matches to "Brian Deer" in the sheet). Hyphenated names like "Tanner-Hughes" won't auto-match — add them to `MANUAL_OVERRIDES` in `scripts/process-photos.mjs`
3. **Run `npm run photos`** — the script:
   - Fetches the live sheet to get canonical names
   - Auto-matches `assets/` files by normalized filename (underscores/hyphens → spaces, case-insensitive)
   - Falls back to `MANUAL_OVERRIDES` for tricky filenames
   - Crops, resizes to 400x400, converts to webp
   - Outputs to `public/photos/{slug}.webp` (where slug is the lowercased, dashed name)
   - Prints a list of URLs matching sheet row order for paste-in
4. **Commit and push** the updated `public/photos/` directory
5. **Paste the photo URLs** into the sheet's `photo` column — use `scripts/sheet-column.py` or the script's output to get the list in sheet row order. Blank lines for candidates without photos keep alignment.

Photos are served from GitHub Pages at: `https://dirtroadcode.github.io/dirtroad-map/photos/{slug}.webp`

### Throttling & Bot Avoidance

- **Always throttle requests** to human speed (3-5s between requests, no parallelization)
- Use `curl_chrome131` (not regular curl) for all web fetching — it impersonates Chrome's TLS fingerprint
- Available via: `nix-shell -p curl-impersonate`
- The binary names are `curl_chrome131`, `curl_firefox135`, etc. (not `curl-impersonate-chrome`)

## Adding New Candidates

1. **Parse the source data** (usually an HTML export in `references/`) into the sheet schema
2. **Geocode**: state legislative districts → `lookup-district-coords.sh` (Census gazetteer). County/local → Nominatim
3. **Paste into Google Sheet** — column by column works best (terminal strips tabs)
4. **Photos**: user collects raw photos → drops in `assets/` → run `npm run photos` → paste URLs into sheet (see Photo Processing Workflow below)
5. **Backup**: save a snapshot to `data/backups/` before major changes

## Geocoding Details

- **State legislative districts**: use Census TIGER gazetteer files in `data/gazetteer/` (`2024_Gaz_sldl_national.txt` for lower chamber, `2024_Gaz_sldu_national.txt` for upper). The gazetteer maps `(state_abbrev, chamber, district_key)` → `(lat, lng)`
- **County/local offices**: use Nominatim (OpenStreetMap). Rate limited to 1 req/sec
- District matching handles variations: zero-padding, sub-districts (e.g. "7B" → parent "7"), named districts (e.g. "Hillsborough 28")

## Tech Stack

- Vite (vanilla JS, no framework)
- Leaflet map with PapaParse for CSV
- Sharp for image processing
- GitHub Actions auto-deploys `main` to GitHub Pages
- Nix flake for dev shell (`nodejs_22`, `gh`)
- Repo: `git@github.com:dirtroadcode/dirtroad-map.git`

## Common Dev Commands

```bash
npm run dev       # Vite dev server with hot reload
npm run build     # Production build to dist/
npm run photos    # Process candidate photos
```
