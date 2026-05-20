import { createDeck } from './deck.js'

const HOLD_MS = 5000
const PAUSE_MS = 500
const INITIAL_HOLD_MS = 2000
const HIGHLIGHT_RADIUS = 12
const PAN_MIN_S = 0.5
const PAN_MAX_S = 2.0

/**
 * Calculate pan duration based on distance between two points.
 * Returns a value between PAN_MIN_S and PAN_MAX_S.
 */
function panDuration(from, to) {
  const dx = to.lng - from.lng
  const dy = to.lat - from.lat
  const dist = Math.sqrt(dx * dx + dy * dy)
  // ~60 degrees of lat/lng is roughly cross-country
  const t = Math.min(1, dist / 60)
  return PAN_MIN_S + t * (PAN_MAX_S - PAN_MIN_S)
}

/**
 * Start the kiosk animation loop on the given map.
 * Glides between markers, opening popups, until the user interacts.
 *
 * @param {L.Map} map
 * @param {L.CircleMarker[]} markers
 */
export function startKiosk(map, markers) {
  if (!markers.length) return

  const deck = createDeck(markers)
  let killed = false
  let timer = null

  function kill() {
    killed = true
    if (timer) clearTimeout(timer)
  }

  const container = map.getContainer()
  const killEvents = ['mousedown', 'touchstart', 'wheel']
  killEvents.forEach(event => {
    container.addEventListener(event, kill, { once: true })
  })

  let lastLatLng = null

  function showNext() {
    if (killed) return

    const marker = deck.next()
    const target = marker.getLatLng()
    const duration = lastLatLng ? panDuration(lastLatLng, target) : PAN_MIN_S
    lastLatLng = target

    // Offset pan target up by 10% of viewport so popup doesn't cover marker
    const px = map.latLngToContainerPoint(target)
    const offsetTarget = map.containerPointToLatLng(px.subtract([0, map.getSize().y / 10]))

    map.panTo(offsetTarget, { animate: true, duration })

    timer = setTimeout(() => {
      if (killed) return
      // Highlight active marker
      const originalRadius = marker.options?.radius ?? 8
      marker.setStyle({ radius: HIGHLIGHT_RADIUS })
      marker.openPopup()

      // Hold popup for N seconds, then close and pause before next
      timer = setTimeout(() => {
        if (killed) return
        marker.setStyle({ radius: originalRadius })
        marker.closePopup()

        timer = setTimeout(() => {
          showNext()
        }, PAUSE_MS)
      }, HOLD_MS)
    }, duration * 1000)
  }

  // Initial hold — let user see the full map before gliding
  timer = setTimeout(() => {
    showNext()
  }, INITIAL_HOLD_MS)
}
