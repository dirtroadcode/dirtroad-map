import Papa from 'papaparse'
import { LEVELS, COLORS, LEVEL_PRIORITY } from './levels.js'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWI2J4Ft6P1WzimxGQ39K7XcbEQv-3H6T6B2mnmq1w_nIxSLK_01pRJlGIdCT-PdDQK2WeUh-Xer_l/pub?gid=1399665600&single=true&output=csv'

// Re-export COLORS for backward compatibility during migration
export { COLORS }

/**
 * Fetch candidate CSV, build grouped GeoJSON, and add marker layers to the map.
 * @param {maplibregl.Map} map
 */
export function fetchCandidateCSV() {
  return fetch(SHEET_URL)
    .then(res => {
      if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)
      return res.text()
    })
}

export async function addMarkerLayers(map, csvPromise) {
  const csvText = await csvPromise
  const geojson = buildMarkerGeoJSON(csvText)

  map.addSource('candidates', {
    type: 'geojson',
    data: geojson,
  })

  for (const level of LEVELS) {
    const color = COLORS[level]

    // Candidate dot
    map.addLayer({
      id: `candidates-${level}-dot`,
      type: 'circle',
      source: 'candidates',
      filter: ['==', ['get', 'level'], level],
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          3, 2.5, 8, 5,
        ],
        'circle-color': color,
        'circle-opacity': 1,
        'circle-stroke-width': [
          'case', ['boolean', ['feature-state', 'highlight'], false],
          3, 0,
        ],
        'circle-stroke-color': '#ffffff',
      },
    })
  }

  return geojson
}

/**
 * Parse candidate CSV, group by shared coordinates, resolve level priority,
 * and return a GeoJSON FeatureCollection for MapLibre.
 *
 * @param {string} csvText — raw CSV from Google Sheet
 * @returns {GeoJSON.FeatureCollection}
 */
export function buildMarkerGeoJSON(csvText) {
  const { data: rows } = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  const groups = new Map()

  for (const row of rows) {
    const lat = parseFloat(row.lat)
    const lng = parseFloat(row.lng)
    if (!lat || !lng) continue

    const key = `${lat},${lng}`
    if (!groups.has(key)) {
      groups.set(key, { lat, lng, level: row.level, candidates: [] })
    }
    const g = groups.get(key)
    g.candidates.push({
      name: row.name,
      office: row.office,
      district: row.district,
      town: row.town,
      state: row.state,
      photo: row.photo,
      website: row.website,
      cycle: row.cycle,
    })
    if (LEVEL_PRIORITY[row.level] > LEVEL_PRIORITY[g.level]) {
      g.level = row.level
    }
  }

  return {
    type: 'FeatureCollection',
    features: [...groups.values()].map((g, i) => ({
      id: i,
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
      properties: {
        level: g.level,
        color: COLORS[g.level],
        names: g.candidates.map(c => c.name),
        count: g.candidates.length,
        candidates: g.candidates,
      },
    })),
  }
}
