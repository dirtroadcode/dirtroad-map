import maplibregl from 'maplibre-gl'
import { createDeck } from './deck.js'
import { renderPopupContent } from './popupRenderer.js'
import { prepareFlyToOffset } from './popupLayout.js'

const INITIAL_HOLD_MS = 2000
const POPUP_HOLD_MS = 3000
const PAUSE_MS = 500
const DURATION_MIN_MS = 2000
const DURATION_MAX_MS = 6000

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

  function parseCandidates(feature) {
    const raw = feature.properties.candidates
    return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
  }

  function openPopup(feature) {
    if (killed) return

    const candidates = feature.properties.candidates
    if (!candidates) return

    const parsed = parseCandidates(feature)
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
    if (!currentPopup) return
    const el = currentPopup.getElement()
    el.classList.add('maplibregl-popup-close')
    const popup = currentPopup
    currentPopup = null
    setTimeout(() => {
      popup.remove()
    }, 150)
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

    // Defer popup to next frame — moveend fires before final render,
    // so the popup would flash at [0,0] for one frame otherwise
    requestAnimationFrame(() => {
      openPopup(currentFeature)
    })

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

  async function flyToNext() {
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

    // Await the deep module: preload images → compute height → lat offset
    const viewportHeight = map.getContainer().clientHeight
    const dlat = await prepareFlyToOffset(
      parseCandidates(feature),
      lat,
      6,
      viewportHeight,
    )

    if (killed) return  // may have been killed while awaiting

    map.flyTo({
      center: [lng, lat + dlat],
      zoom: 6,
      curve: 1.42,
      duration,
      easing(t) {
        // Piecewise: fast quadratic ease-in → capped cruise → smooth ease-out
        const a = 0.2, b = 0.7
        const S = 2 / (1 + b - a) // max slope ≈1.33, derived so f(1)=1
        if (t <= a) return S * t * t / (2 * a)
        if (t <= b) return S * a / 2 + S * (t - a)
        const dt = t - b, dur = 1 - b
        return S * a / 2 + S * (b - a) + S * dt - S * dt * dt / (2 * dur)
      },
    })
  }

  // Initial hold — let user see the full map before flying
  timer = setTimeout(() => {
    flyToNext()
  }, INITIAL_HOLD_MS)

  return { kill }
}
