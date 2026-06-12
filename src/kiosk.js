import maplibregl from 'maplibre-gl'
import { createDeck } from './deck.js'
import { renderPopupContent } from './popupRenderer.js'

const INITIAL_HOLD_MS = 2000
const POPUP_HOLD_MS = 5000
const PAUSE_MS = 500
const DURATION_MIN_MS = 4000
const DURATION_MAX_MS = 12000

/**
 * Calculate fly duration in ms based on distance between two points.
 * Cross-country (~60°) → max; short hops → min.
 */
export function flyDuration(from, to) {
  const dx = to.lng - from.lng
  const dy = to.lat - from.lat
  const dist = Math.sqrt(dx * dx + dy * dy)
  const t = Math.min(1, dist / 60)
  return DURATION_MIN_MS + t * (DURATION_MAX_MS - DURATION_MIN_MS)
}

/**
 * Start the kiosk animation loop on the given map.
 * Flies between markers with cinematic arcs, opening popups, until the user interacts.
 *
 * @param {maplibregl.Map} map
 * @param {GeoJSON.FeatureCollection} geojson
 * @returns {{ kill: () => void }}
 */
export function startKiosk(map, geojson) {
  const features = geojson.features
  if (!features.length) return { kill() {} }

  const deck = createDeck(features)
  let killed = false
  let timer = null
  let currentPopup = null
  let currentFeature = null
  let previousFeature = null

  function kill() {
    killed = true
    if (timer) clearTimeout(timer)
    if (currentPopup) { currentPopup.remove(); currentPopup = null }
  }

  const container = map.getContainer()
  const killEvents = ['mousedown', 'touchstart', 'wheel']
  killEvents.forEach(event => {
    container.addEventListener(event, kill, { once: true })
  })

  function openPopup(feature) {
    if (killed) return

    const candidates = feature.properties.candidates
    if (!candidates) return

    const parsed = typeof candidates === 'string' ? JSON.parse(candidates) : candidates
    const html = renderPopupContent(parsed)
    const [lng, lat] = feature.geometry.coordinates

    currentPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      offset: 12,
    })
      .setHTML(html)
      .setLngLat([lng, lat])
      .addTo(map)
  }

  function closePopup() {
    if (currentPopup) {
      currentPopup.remove()
      currentPopup = null
    }
  }

  function onMoveEnd() {
    if (killed || !currentFeature) return

    // Highlight active feature
    if (currentFeature.id != null) {
      map.setFeatureState(
        { source: 'candidates', id: currentFeature.id },
        { highlight: true }
      )
      previousFeature = currentFeature
    }

    openPopup(currentFeature)

    // Hold popup for N seconds, then close and fly to next
    timer = setTimeout(() => {
      if (killed) return
      closePopup()

      timer = setTimeout(() => {
        flyToNext()
      }, PAUSE_MS)
    }, POPUP_HOLD_MS)
  }

  map.on('moveend', onMoveEnd)

  function flyToNext() {
    if (killed) return

    // Unhighlight previous feature
    if (previousFeature && previousFeature.id != null) {
      map.removeFeatureState({ source: 'candidates', id: previousFeature.id })
    }

    const feature = deck.next()
    const [lng, lat] = feature.geometry.coordinates
    currentFeature = feature

    const from = map.getCenter()
    const duration = flyDuration(
      { lat: from.lat, lng: from.lng },
      { lat, lng }
    )

    map.flyTo({
      center: [lng, lat],
      zoom: 8,
      curve: 1.42,
      duration,
      padding: { top: 80, bottom: 0, left: 0, right: 0 },
      easing(t) { return t },
    })
  }

  // Initial hold — let user see the full map before flying
  timer = setTimeout(() => {
    flyToNext()
  }, INITIAL_HOLD_MS)

  return { kill }
}
