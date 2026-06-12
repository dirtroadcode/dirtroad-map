import maplibregl from 'maplibre-gl'

/**
 * Render a branded popup card for a single candidate.
 * @param {{ name: string, office: string, district: string, state: string, photo: string, website: string, town: string, cycle: string }} candidate
 * @returns {string} HTML string
 */
export function renderPopupCard(candidate) {
  const photo = candidate.photo
    ? `<img class="popup-photo" src="${candidate.photo}" alt="${candidate.name}">`
    : ''

  const name = candidate.website
    ? `<a class="popup-name" href="${candidate.website}" target="_blank" rel="noopener">${candidate.name}</a>`
    : `<span class="popup-name">${candidate.name}</span>`

  const district = candidate.district
    ? `<span class="popup-detail">${candidate.district}</span>`
    : ''

  const state = candidate.state
    ? `<span class="popup-detail">${candidate.state}</span>`
    : ''

  return `<div class="popup-card">
  ${photo}
  <strong>${name}</strong>
  ${state}
  <span class="popup-office">${candidate.office}</span>
  ${district}
</div>`
}

/**
 * Render popup content for one or more candidates.
 * Multiple candidates are separated by dividers.
 * @param {Array} candidates
 * @returns {string} HTML string
 */
export function renderPopupContent(candidates) {
  return candidates.map(renderPopupCard).join('<hr class="popup-divider">')
}

const CANDIDATE_LAYERS = [
  'candidates-state-glow', 'candidates-state-dot',
  'candidates-county-glow', 'candidates-county-dot',
  'candidates-local-glow', 'candidates-local-dot',
]

/**
 * Attach click handlers to all candidate layers to open branded popups.
 * Works with real MapLibre maps or mock maps for testing.
 * @param {maplibregl.Map} map
 */
export function attachPopupHandlers(map) {
  let currentPopup = null

  function openPopup(html, lngLat) {
    closePopup()
    currentPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      offset: 12,
    })
      .setHTML(html)
      .setLngLat(lngLat)
      .addTo(map)
  }

  function closePopup() {
    if (currentPopup) {
      currentPopup.remove()
      currentPopup = null
    }
  }

  // Close popup on background click
  map.on('click', closePopup)

  for (const layerId of CANDIDATE_LAYERS) {
    map.on('click', layerId, (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [layerId] })
      if (!features.length) return

      const candidates = features[0].properties.candidates
      if (!candidates) return

      const parsed = typeof candidates === 'string' ? JSON.parse(candidates) : candidates
      openPopup(renderPopupContent(parsed), e.lngLat)
    })
  }
}
