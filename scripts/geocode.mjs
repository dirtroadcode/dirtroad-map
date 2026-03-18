/**
 * One-time geocoding script for candidate locations.
 * Uses Nominatim (OpenStreetMap) to resolve town + state to lat/lng.
 *
 * Usage: node scripts/geocode.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'candidates.json')

// Town + state for each candidate, used only for geocoding.
// Derived from the Google Sheets "Directory" export (columns F + H).
const LOCATIONS = {
  'Joan Presley': 'McMinnville, Tennessee',
  'Dustin Vigneault': 'Haverhill, New Hampshire',
  'Charles Tilburg': 'Buxton, Maine',
  'Charly Ray': 'Bayview Township, Wisconsin',
  'Kirstan Watson': 'Arundel, Maine',
  'Ali Simpson': 'Ten Mile, Tennessee',
  'Allen Davis': 'Dublin, New Hampshire',
  'Madison Cook': 'Belfast, Maine',
  'Reggie Spaulding': 'Missoula, Montana',
  'Hannah Cole': 'Teresita, Oklahoma',
  'Melanie Miller': 'White Plains, Georgia',
  'Chris Conroy': 'Weare, New Hampshire',
  'Azalea Cormier': 'Buckfield, Maine',
  'Brittany Newton': 'Whiteville, North Carolina',
  'Iva Markicevic Daley': 'Sandy Hook, Kentucky',
  'Steven Gupton': 'Louisburg, North Carolina',
  'Bobbi Cummiskey': 'Bend, Oregon',
  'Derek Hopkins': 'Asheville, North Carolina',
}

async function geocode(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'us')

  const res = await fetch(url, {
    headers: { 'User-Agent': 'dirtroad-do-map-geocoder/1.0' },
  })

  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`)

  const data = await res.json()
  if (data.length === 0) return null

  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const candidates = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  let updated = 0
  let failed = 0

  for (const c of candidates) {
    if (c.lat !== 0 || c.lng !== 0) continue

    const location = LOCATIONS[c.name]
    if (!location) {
      console.log(`  SKIP  ${c.name} — no location mapping`)
      failed++
      continue
    }

    const result = await geocode(location)
    if (result) {
      c.lat = result.lat
      c.lng = result.lng
      console.log(`  OK    ${c.name} → ${result.lat}, ${result.lng}`)
      updated++
    } else {
      console.log(`  FAIL  ${c.name} — no results for "${location}"`)
      failed++
    }

    // Respect Nominatim's 1 req/sec rate limit
    await sleep(1100)
  }

  writeFileSync(DATA_PATH, JSON.stringify(candidates, null, 2) + '\n')
  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`)
}

main()
