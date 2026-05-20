import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startKiosk } from '../src/kiosk.js'

function createMockMarker(id) {
  return {
    id,
    _latlng: { lat: 0, lng: 0 },
    getLatLng() { return this._latlng },
    openPopup: vi.fn(),
    closePopup: vi.fn(),
    setStyle: vi.fn(),
    bindPopup: vi.fn(),
    addTo: vi.fn(),
    on: vi.fn(),
  }
}

function createMockContainer() {
  const listeners = {}
  return {
    addEventListener(event, fn, opts) { listeners[event] = { fn, opts } },
    dispatchKill() {
      // simulate the kill callback being invoked
      for (const key of Object.keys(listeners)) {
        listeners[key].fn()
      }
    },
    _listeners: listeners,
  }
}

function createMockMap(container) {
  return {
    panTo: vi.fn(),
    getContainer: () => container,
    getSize: () => ({ x: 800, y: 600 }),
    latLngToContainerPoint: () => ({ x: 400, y: 300, subtract: () => ({ lat: 0, lng: 0 }) }),
    containerPointToLatLng: () => ({ lat: 0, lng: 0 }),
  }
}

describe('startKiosk', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('stops permanently on mousedown — no further markers visited', () => {
    const container = createMockContainer()
    const map = createMockMap(container)
    const markers = [createMockMarker('a'), createMockMarker('b'), createMockMarker('c')]

    startKiosk(map, markers)

    // Advance past initial hold (2s) + pan duration (1s) — first marker gets a popup
    vi.advanceTimersByTime(3100)
    expect(markers.some(m => m.openPopup.mock.calls.length > 0)).toBe(true)

    // Simulate user interaction — fire the kill callback
    container.dispatchKill()

    // Advance a long time — no more popups should open
    const openCallCounts = markers.map(m => m.openPopup.mock.calls.length)
    vi.advanceTimersByTime(30000)
    const openCallCountsAfter = markers.map(m => m.openPopup.mock.calls.length)

    expect(openCallCountsAfter).toEqual(openCallCounts)
  })
})
