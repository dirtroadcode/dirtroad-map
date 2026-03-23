import L from 'leaflet'
import Papa from 'papaparse'
import 'leaflet/dist/leaflet.css'
import './style.css'
import usBoundary from '../data/us-boundary.json'

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWI2J4Ft6P1WzimxGQ39K7XcbEQv-3H6T6B2mnmq1w_nIxSLK_01pRJlGIdCT-PdDQK2WeUh-Xer_l/pub?gid=1399665600&single=true&output=csv'

/** Styles for each level's circleMarker */
const CATEGORY_STYLES = {
  state: { color: '#C0690F', fillColor: '#E67E22', fillOpacity: 0.85, weight: 2, radius: 8 },
  county: { color: '#0E7A63', fillColor: '#16A085', fillOpacity: 0.85, weight: 2, radius: 8 },
  local: { color: '#6C3483', fillColor: '#8E44AD', fillOpacity: 0.85, weight: 2, radius: 8 },
}

/** Human-readable labels for the legend */
const CATEGORY_LABELS = {
  state: 'State',
  county: 'County',
  local: 'Local',
}

// --- Map setup ---

const isMobile = window.innerWidth < 768
const map = L.map('map').setView(isMobile ? [37, -80] : [39.8, -98.5], isMobile ? 4 : 4)

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
}).addTo(map)

window.addEventListener('resize', () => map.invalidateSize())

// --- Mask (dim areas outside the US) ---

;(function addMask() {
  const outer = [
    [90, -180],
    [90, 180],
    [-90, 180],
    [-90, -180],
  ]

  const holes = usBoundary.features[0].geometry.coordinates.map((polygon) =>
    polygon[0].map(([lng, lat]) => [lat, lng]),
  )

  L.polygon([outer, ...holes], {
    fillColor: '#000',
    fillOpacity: 0.4,
    stroke: false,
    interactive: false,
    renderer: L.svg({ padding: 1 }),
  }).addTo(map)
})()

// --- Markers ---

function popupMaxWidth() {
  return Math.min(300, map.getContainer().clientWidth - 40)
}

function candidateCard(c) {
  const photo = c.photo
    ? `<img class="popup-photo" src="${c.photo}" alt="${c.name}">`
    : ''
  const name = c.website
    ? `<a class="popup-name" href="${c.website}" target="_blank" rel="noopener">${c.name}</a>`
    : `<span class="popup-name">${c.name}</span>`
  const district = c.district
    ? `<span class="popup-detail">${c.district}</span>`
    : ''
  const state = c.state
    ? `<span class="popup-detail">${c.state}</span>`
    : ''

  return `<div class="popup-card">
    ${photo}
    <strong>${name}</strong>
    ${state}
    <span class="popup-office">${c.office}</span>
    ${district}
  </div>`
}

function popupContent(candidates) {
  return candidates.map(candidateCard).join('<hr class="popup-divider">')
}

async function fetchCandidates() {
  const res = await fetch(SHEET_CSV_URL)
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`)
  const csv = await res.text()
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true })
  return data.map((row) => ({
    ...row,
    lat: Number(row.lat),
    lng: Number(row.lng),
  }))
}

const LEVEL_PRIORITY = { state: 0, county: 1, local: 2 }

function addMarkers(candidates) {
  // Group candidates that share the same coordinates
  const groups = new Map()
  for (const c of candidates) {
    if (!c.lat || !c.lng) continue
    const key = `${c.lat},${c.lng}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }

  for (const [, group] of groups) {
    const { lat, lng } = group[0]
    // Use the highest-priority level for the marker color
    const topLevel = group.reduce(
      (best, c) => ((LEVEL_PRIORITY[c.level] ?? 2) < (LEVEL_PRIORITY[best] ?? 2) ? c.level : best),
      group[0].level,
    )
    const style = CATEGORY_STYLES[topLevel] ?? CATEGORY_STYLES.local

    L.circleMarker([lat, lng], style)
      .addTo(map)
      .bindPopup(popupContent(group), { maxWidth: popupMaxWidth() })
  }
}

fetchCandidates()
  .then(addMarkers)
  .catch((err) => console.error('Could not load candidate data:', err))

// --- Legend ---

const legend = L.control({ position: 'bottomright' })

legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'legend')

  div.innerHTML = Object.entries(CATEGORY_LABELS)
    .map(([cat, label]) => {
      const { fillColor } = CATEGORY_STYLES[cat]
      return `<div class="legend-row">
        <span class="legend-swatch" style="background:${fillColor}"></span>
        ${label}
      </div>`
    })
    .join('')

  return div
}

legend.addTo(map)

