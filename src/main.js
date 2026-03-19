import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './style.css'
import candidates from '../data/candidates.json'
import usBoundary from '../data/us-boundary.json'

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

function popupContent(c) {
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
    <span class="popup-office">${c.office}</span>
    ${district}
    ${state}
  </div>`
}

candidates.forEach((c) => {
  const style = CATEGORY_STYLES[c.level] ?? CATEGORY_STYLES.local

  L.circleMarker([c.lat, c.lng], style)
    .addTo(map)
    .bindPopup(popupContent(c), { maxWidth: popupMaxWidth() })
})

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
