import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './style.css'
import candidates from '../data/candidates.json'

/** Map office strings from the data to display categories */
const OFFICE_CATEGORY = {
  'State House': 'state',
  'State Representative': 'state',
  'State Senate': 'state',
  'County Commissioner': 'county',
  'City Council': 'local',
  'School Board': 'local',
}

/** Styles for each category's circleMarker */
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

function officeCategory(office) {
  return OFFICE_CATEGORY[office] ?? 'local'
}

// --- Map setup ---

const map = L.map('map').setView([39.8, -98.5], 4)

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map)

window.addEventListener('resize', () => map.invalidateSize())

// --- Markers ---

function popupMaxWidth() {
  return Math.min(300, map.getContainer().clientWidth - 40)
}

function popupContent(c) {
  const photo = c.photo
    ? `<img class="popup-photo" src="${c.photo}" alt="${c.name}">`
    : ''
  const website = c.website
    ? `<a class="popup-link" href="${c.website}" target="_blank" rel="noopener">Campaign website</a>`
    : ''

  return `<div class="popup-card">
    ${photo}
    <strong class="popup-name">${c.name}</strong>
    <span class="popup-office">${c.office} &mdash; ${c.district}</span>
    ${website}
  </div>`
}

candidates.forEach((c) => {
  const category = officeCategory(c.office)
  const style = CATEGORY_STYLES[category]

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
