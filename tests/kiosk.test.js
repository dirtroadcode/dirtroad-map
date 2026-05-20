import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startKiosk } from '../src/kiosk.js'

function createMockMarker(id) {
  return {
    id,
    _latlng: { lat: 0, lng: 0 },
    _options: { radius: 8 },
    getLatLng() { return this._latlng },
    openPopup: vi.fn(),
    closePopup: vi.fn(),
    setStyle: vi.fn(),
    bindPopup: vi.fn(),
    addTo: vi.fn(),
    on: vi.fn(),
    options: { radius: 8 },
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

  it('grows active marker radius and resets it on close', () => {
    const container = createMockContainer()
    const map = createMockMap(container)
    const markers = [createMockMarker('a'), createMockMarker('b')]

    startKiosk(map, markers)

    // Advance to first marker's popup opening
    vi.advanceTimersByTime(3100)

    // The featured marker should have setStyle called to grow radius
    const featured = markers.find(m => m.openPopup.mock.calls.length > 0)
    expect(featured.setStyle).toHaveBeenCalledWith(expect.objectContaining({ radius: 12 }))

    // Advance through hold (5s) — popup closes, marker shrinks
    vi.advanceTimersByTime(5000)
    expect(featured.setStyle).toHaveBeenCalledWith(expect.objectContaining({ radius: 8 }))
  })

  it('pans with longer duration for distant markers', () => {
    const container = createMockContainer()
    const map = createMockMap(container)
    // Two markers far apart
    const near = createMockMarker('near')
    near._latlng = { lat: 39.0, lng: -98.0 }
    const far = createMockMarker('far')
    far._latlng = { lat: 45.0, lng: -70.0 }
    const markers = [near, far]

    startKiosk(map, markers)

    // Advance through initial hold + first pan
    vi.advanceTimersByTime(3100)
    const firstPanDuration = map.panTo.mock.calls[0][1].duration

    // Advance through hold + close + pause to trigger second pan
    vi.advanceTimersByTime(6500)
    const secondPanDuration = map.panTo.mock.calls[1][1].duration

    // Pan durations should differ (variable by distance)
    expect(firstPanDuration).not.toEqual(secondPanDuration)
  })
})
