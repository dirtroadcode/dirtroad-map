/**
 * Import candidates from an HTML export of the Directory spreadsheet.
 *
 * Parses Sheet1.html (main directory) and ExtraData.html (photo/website URLs),
 * joins them by name+email, filters to candidates only, and writes candidates.json.
 *
 * Preserves existing lat/lng for known candidates. New candidates get 0,0
 * and need geocoding (run scripts/geocode.mjs after).
 *
 * Usage: node scripts/import-directory.mjs [path-to-directory.zip]
 *   Defaults to references/Directory (1).zip
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_PATH = join(ROOT, 'data', 'candidates.json')

// --- HTML table parser ---

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
}

function parseHtmlTable(html) {
  const rows = []
  // Match each <tr> and extract <td> contents
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1]
    // Skip header rows (contain <th> only) and freezebar rows
    if (rowHtml.includes('freezebar-cell') && !rowHtml.includes('<td class="s')) continue
    const cells = []
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      const tdTag = tdMatch[0]
      // Skip freezebar cells — they're spacer columns, not data
      if (tdTag.includes('freezebar-cell')) continue
      let content = tdMatch[1]
      // Extract href from links if present
      const hrefMatch = content.match(/href="([^"]*)"/)
      // Strip all HTML tags to get text content, then decode entities
      const text = decodeEntities(content.replace(/<[^>]*>/g, '').trim())
      const href = hrefMatch ? decodeEntities(hrefMatch[1]) : null
      cells.push({ text, href })
    }
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

// --- Main ---

const zipPath = process.argv[2] || join(ROOT, 'references', 'Directory (1).zip')

// Extract zip to temp dir
const tmpDir = mkdtempSync(join(tmpdir(), 'do-map-import-'))
try {
  execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, { stdio: 'pipe' })
} catch {
  // Try with nix-shell if unzip not available
  execSync(`nix-shell -p unzip --run 'unzip -o "${zipPath}" -d "${tmpDir}"'`, { stdio: 'pipe' })
}

// Parse Sheet1 (main directory data)
const sheet1Html = readFileSync(join(tmpDir, 'Sheet1.html'), 'utf-8')
const sheet1Rows = parseHtmlTable(sheet1Html)

// Headers: first name, last name, email, phone, pronouns, town, county, state,
//          cohort, cohort(role), office sought, district, election year, google group, year
const HEADERS = sheet1Rows[0].map(c => c.text.toLowerCase())
const COL = Object.fromEntries(HEADERS.map((h, i) => [h, i]))

// Parse ExtraData (photo + website URLs)
const extraHtml = readFileSync(join(tmpDir, 'ExtraData.html'), 'utf-8')
const extraRows = parseHtmlTable(extraHtml)
// ExtraData headers: first name, last name, email, photo-url, website-url

// Build lookup by lowercase email
const extraByEmail = new Map()
for (let i = 1; i < extraRows.length; i++) {
  const row = extraRows[i]
  if (row.length < 5) continue
  const email = row[2].text.toLowerCase()
  extraByEmail.set(email, {
    photo: row[3].href || row[3].text || '',
    website: row[4].href || row[4].text || '',
  })
}

// Load existing candidates for lat/lng preservation
const existing = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
const existingByName = new Map(existing.map(c => [c.name, c]))

// Office value normalization — map spreadsheet values to our canonical office names
const OFFICE_MAP = {
  'state representative': 'State Representative',
  'state senate': 'State Senate',
  'state house': 'State House',
  'state assembly': 'State Assembly',
  'state delegate': 'State Representative',
  'county': 'County Commissioner',
  'county commissioner': 'County Commissioner',
  'commissioner, position 1': 'County Commissioner',
  'city council': 'City Council',
  'city council, then county comissioner': 'City Council',
  'town supervisor': 'City Council',
  'school board': 'School Board',
  'education/school board': 'School Board',
}

function normalizeOffice(raw) {
  const lower = raw.toLowerCase().trim()
  return OFFICE_MAP[lower] || raw
}

// Process Sheet1 rows (skip header)
const candidates = []
const skipped = []
const needsGeocode = []

for (let i = 1; i < sheet1Rows.length; i++) {
  const row = sheet1Rows[i]
  const get = (col) => row[col]?.text?.trim() || ''

  // Column J (index 9) is the role column — filter to candidates only
  const role = get(9).toLowerCase()
  if (role !== 'candidate') {
    skipped.push(`${get(0)} ${get(1)} (${role || 'unknown role'})`)
    continue
  }

  const firstName = get(0)
  const lastName = get(1)
  const name = `${firstName} ${lastName}`
  const email = get(2).toLowerCase()
  const town = get(5)
  const state = get(7)
  const rawOffice = get(10)
  const district = get(11)
  const electionYear = get(12)

  // Skip entries with unclear office
  if (rawOffice.toLowerCase().includes("not sure") || rawOffice.toLowerCase().includes("i'm not sure")) {
    skipped.push(`${name} (office: "${rawOffice}")`)
    continue
  }

  const office = normalizeOffice(rawOffice)

  // Look up photo/website from ExtraData
  const extra = extraByEmail.get(email) || { photo: '', website: '' }

  // Preserve existing lat/lng or set to 0 for geocoding
  const prev = existingByName.get(name)
  const lat = prev?.lat ?? 0
  const lng = prev?.lng ?? 0

  if (lat === 0 && lng === 0) {
    needsGeocode.push({ name, location: `${town}, ${state}` })
  }

  // Build district string — use district field if set, else fall back to "Town, State"
  let displayDistrict = district
  if (!displayDistrict) {
    // Avoid "Troy, Vermont, Vermont" — check if town already contains the state
    const townLower = town.toLowerCase()
    const stateLower = state.toLowerCase()
    // Also handle state abbreviations in town (e.g. "Savannah, GA" or "Whiteville, NC")
    const stateAbbrevs = { 'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar', 'california': 'ca', 'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de', 'florida': 'fl', 'georgia': 'ga', 'hawaii': 'hi', 'idaho': 'id', 'illinois': 'il', 'indiana': 'in', 'iowa': 'ia', 'kansas': 'ks', 'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md', 'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms', 'missouri': 'mo', 'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv', 'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', 'ohio': 'oh', 'oklahoma': 'ok', 'oregon': 'or', 'pennsylvania': 'pa', 'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd', 'tennessee': 'tn', 'texas': 'tx', 'utah': 'ut', 'vermont': 'vt', 'virginia': 'va', 'washington': 'wa', 'west virginia': 'wv', 'wisconsin': 'wi', 'wyoming': 'wy' }
    const abbrev = stateAbbrevs[stateLower] || ''
    const alreadyHasState = townLower.includes(stateLower) ||
      (abbrev && new RegExp(`\\b${abbrev}\\b`, 'i').test(town))
    displayDistrict = alreadyHasState ? town : `${town}, ${state}`
  }

  candidates.push({
    name,
    office,
    district: displayDistrict,
    photo: extra.photo,
    website: extra.website,
    cycle: electionYear || '2026',
    lat,
    lng,
  })
}

// Clean up temp dir
rmSync(tmpDir, { recursive: true })

// Write output
writeFileSync(DATA_PATH, JSON.stringify(candidates, null, 2) + '\n')

console.log(`Imported ${candidates.length} candidates to data/candidates.json`)
if (skipped.length > 0) {
  console.log(`\nSkipped ${skipped.length} entries:`)
  skipped.forEach(s => console.log(`  - ${s}`))
}
if (needsGeocode.length > 0) {
  console.log(`\nNeed geocoding (${needsGeocode.length}):`)
  needsGeocode.forEach(c => console.log(`  - ${c.name}: ${c.location}`))
  console.log('\nRun: node scripts/geocode.mjs')
}
