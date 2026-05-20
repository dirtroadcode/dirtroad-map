/**
 * Process candidate photos for self-hosting on GitHub Pages.
 *
 * - Reads canonical names from the live Google Sheet CSV
 * - Matches local photos in assets/ to canonical names
 * - Crops, resizes, and converts all to 400x400 WebP
 * - Outputs to public/photos/{slug}.webp
 * - Prints a URL mapping table for pasting into the spreadsheet
 *
 * assets/ is the single source of truth for raw photos.
 * public/photos/ is fully regenerable derived output.
 *
 * Usage: npm run photos
 */

import sharp from 'sharp'
import { readdirSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'
import Papa from 'papaparse'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ASSETS_DIR = join(ROOT, 'assets')
const OUTPUT_DIR = join(ROOT, 'public', 'photos')

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWI2J4Ft6P1WzimxGQ39K7XcbEQv-3H6T6B2mnmq1w_nIxSLK_01pRJlGIdCT-PdDQK2WeUh-Xer_l/pub?gid=1399665600&single=true&output=csv'

const HOSTED_BASE = 'https://dirtroadcode.github.io/dirtroad-map/photos'

const SIZE = 400
const QUALITY = 80

// --- Manual overrides: asset filename -> canonical spreadsheet name ---
const MANUAL_OVERRIDES = {
  'joan pressley.jpg': 'Joan Harris Presley',
  'Iva.jpg': 'Iva Markicevic Daley',
  "Thomas O'Donnell.jpeg": "Tom O'Donnell",
  'Benjamin Schaeur.jpg': 'Benjamin Schauer',
  'Kathyrn Larson.jpg': 'Kathryn Larson',
  'Jacob-Brooks-908x1024.jpg': 'Jacob Brooks',
  'mira-tanner-hughes.jpg': 'Mira Tanner-Hughes',
}

// --- Helpers ---

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Normalize an asset filename (without extension) for matching */
function normalizeFilename(filename) {
  const name = filename.replace(/\.[^.]+$/, '') // strip extension
  return name
    .replace(/[_-]/g, ' ')  // underscores/hyphens to spaces
    .trim()
}

async function fetchCandidates() {
  const res = await fetch(SHEET_CSV_URL)
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`)
  const csv = await res.text()
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true })
  return data
}

async function processPhoto(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(SIZE)
    .webp({ quality: QUALITY })
    .toFile(outputPath)
}

async function main() {
  // 1. Fetch canonical candidate list
  console.log('Fetching candidate data from Google Sheet...')
  const candidates = await fetchCandidates()
  console.log(`  Found ${candidates.length} candidates\n`)

  // Build set of candidate names for matching
  const candidateNames = new Set(candidates.map((c) => c.name))

  // Build case-insensitive lookup for auto-matching
  const nameLookup = new Map()
  for (const name of candidateNames) {
    nameLookup.set(name.toLowerCase(), name)
  }

  // 2. Read assets/ and match to canonical names
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const assetFiles = existsSync(ASSETS_DIR)
    ? readdirSync(ASSETS_DIR).filter((f) => !f.startsWith('.'))
    : []

  const matched = new Map() // canonical name -> asset file path

  for (const file of assetFiles) {
    const ext = extname(file).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext)) continue

    let canonicalName = null

    // Check manual overrides first
    if (MANUAL_OVERRIDES[file]) {
      canonicalName = MANUAL_OVERRIDES[file]
    } else {
      // Auto-match: normalize filename and try case-insensitive lookup
      const normalized = normalizeFilename(file).toLowerCase()
      canonicalName = nameLookup.get(normalized) || null
    }

    if (canonicalName) {
      matched.set(canonicalName, join(ASSETS_DIR, file))
      console.log(`  MATCH  ${file} -> ${canonicalName}`)
    } else {
      console.log(`  SKIP   ${file} (no matching candidate in spreadsheet)`)
    }
  }

  console.log(`\nMatched ${matched.size} local photos\n`)

  // 3. Process all matched photos
  console.log('Processing photos...')
  let processed = 0
  const results = [] // { name, slug, url }

  for (const [name, inputPath] of matched) {
    const slug = toSlug(name)
    const outputPath = join(OUTPUT_DIR, `${slug}.webp`)

    try {
      await processPhoto(inputPath, outputPath)
      const url = `${HOSTED_BASE}/${slug}.webp`
      results.push({ name, slug, url })
      processed++
      console.log(`  OK  ${name} -> ${slug}.webp`)
    } catch (err) {
      console.log(`  FAIL  ${name}: ${err.message}`)
    }
  }

  // 5. Summary
  const missing = []
  for (const name of candidateNames) {
    if (!matched.has(name)) missing.push(name)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`SUMMARY: ${processed} processed, ${missing.length} missing`)
  console.log('='.repeat(60))

  if (missing.length > 0) {
    console.log('\nMissing photos (no matching file in assets/):')
    for (const name of missing) {
      console.log(`  - ${name}`)
    }
  }

  // 4. URL list matching spreadsheet row order (paste directly into photo column)
  const urlByName = new Map(results.map(({ name, url }) => [name, url]))
  const spreadsheetOrder = candidates.map((c) => c.name).sort((a, b) => a.localeCompare(b))

  console.log('\n' + '='.repeat(60))
  console.log('PASTE INTO PHOTO COLUMN (matches spreadsheet row order):')
  console.log('='.repeat(60))
  for (const name of spreadsheetOrder) {
    console.log(urlByName.get(name) || '')
  }
  console.log()

}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
