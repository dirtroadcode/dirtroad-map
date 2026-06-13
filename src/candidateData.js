import Papa from 'papaparse'
import { COLORS, LEVEL_PRIORITY } from './levels.js'

/**
 * Parse candidate CSV, group by shared coordinates, resolve level priority,
 * and return a GeoJSON FeatureCollection.
 *
 * Pure function — no side effects, no network, no MapLibre.
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
