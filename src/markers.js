import { LEVELS, COLORS } from './levels.js'
import { buildMarkerGeoJSON } from './candidateData.js'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWI2J4Ft6P1WzimxGQ39K7XcbEQv-3H6T6B2mnmq1w_nIxSLK_01pRJlGIdCT-PdDQK2WeUh-Xer_l/pub?gid=1399665600&single=true&output=csv'

// Re-export COLORS for backward compatibility during migration
export { COLORS }

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

// Re-export for any consumers importing from markers.js
export { buildMarkerGeoJSON } from './candidateData.js'
