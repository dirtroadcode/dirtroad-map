import { CANDIDATE_LAYERS } from './levels.js'
import { createPopupManager } from './popupManager.js'
import { computeTargetPhotoSize } from './popupLayout.js'

/**
 * Render a branded popup card for a single candidate.
 * @param {{ name: string, office: string, district: string, state: string, photo: string, website: string, town: string, cycle: string }} candidate
 * @returns {string} HTML string
 */
export function renderPopupCard(candidate, photoSize) {
  let photo = ''
  if (candidate.photo) {
    const style = photoSize && photoSize.photoWidth > 0
      ? ` width="${photoSize.photoWidth}" height="${photoSize.photoHeight}" style="object-fit: cover"`
      : ''
    photo = `<img class="popup-photo" src="${candidate.photo}" alt="${candidate.name}"${style}>`
  }

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
export function renderPopupContent(candidates, photoSize) {
  return candidates.map(c => renderPopupCard(c, photoSize)).join('<hr class="popup-divider">')
}

/**
 * Attach click handlers to all candidate layers to open branded popups.
 * Works with real MapLibre maps or mock maps for testing.
 * @param {maplibregl.Map} map
 */
export function attachPopupHandlers(map) {
  const popup = createPopupManager(map)

  // Close popup on background click
  map.on('click', () => popup.close())

  for (const layerId of CANDIDATE_LAYERS) {
    map.on('click', layerId, (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [layerId] })
      if (!features.length) return

      const candidates = features[0].properties.candidates
      if (!candidates) return

      const parsed = typeof candidates === 'string' ? JSON.parse(candidates) : candidates

      // Compute viewport-aware photo sizing (sync, uses square fallback for aspect ratio)
      const container = map.getContainer && map.getContainer()
      const viewportHeight = container ? container.clientHeight : undefined
      const photoSize = viewportHeight
        ? computeTargetPhotoSize(viewportHeight, parsed, new Map())
        : undefined

      popup.open(renderPopupContent(parsed, photoSize), e.lngLat)
    })
  }
}
