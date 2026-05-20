import { createDeck } from './deck.js'

const HOLD_MS = 5000
const PAUSE_MS = 500
const INITIAL_HOLD_MS = 2000
const PAN_DURATION_S = 1.0

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

  function showNext() {
    if (killed) return

    const marker = deck.next()
    const target = marker.getLatLng()

    map.panTo(target, { animate: true, duration: PAN_DURATION_S })

    timer = setTimeout(() => {
      if (killed) return
      marker.openPopup()

      // Hold popup for N seconds, then close and pause before next
      timer = setTimeout(() => {
        if (killed) return
        marker.closePopup()

        timer = setTimeout(() => {
          showNext()
        }, PAUSE_MS)
      }, HOLD_MS)
    }, PAN_DURATION_S * 1000)
  }

  // Initial hold — let user see the full map before gliding
  timer = setTimeout(() => {
    showNext()
  }, INITIAL_HOLD_MS)
}
