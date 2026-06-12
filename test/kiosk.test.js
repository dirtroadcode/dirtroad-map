import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startKiosk, flyDuration } from '../src/kiosk.js'
import { renderPopupContent } from '../src/popupRenderer.js'

vi.mock('maplibre-gl', () => {
  const MockPopup = vi.fn(function() {
    this.setHTML = vi.fn(function() { return this })
    this.setLngLat = vi.fn(function() { return this })
    this.addTo = vi.fn(function() { return this })
    this.remove = vi.fn()
  })
  return { default: { Popup: MockPopup, Map: vi.fn() }, Popup: MockPopup }
})
vi.mock('../src/popupRenderer.js', () => ({
  renderPopupContent: vi.fn(() => '<div>mock popup</div>'),
}))
vi.mock('../src/deck.js', () => ({
  createDeck: vi.fn((items) => {
    let idx = 0
    return {
      next() {
        const item = items[idx % items.length]
        idx++
        return item
      },
    }
  }),
}))

/**
 * Creates a mock MapLibre map that spies on flyTo, setFeatureState, etc.
 */
function createMockMap() {
  const container = document.createElement('div')
  Object.defineProperty(container, 'addEventListener', { value: vi.fn() })

  return {
    flyTo: vi.fn(),
    setFeatureState: vi.fn(),
    removeFeatureState: vi.fn(),
    getContainer: vi.fn(() => container),
    getCenter: vi.fn(() => ({ lat: 39.8, lng: -98.5 })),
    once: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
}

function makeFeature(lat, lng, level = 'state') {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      level,
      color: '#F5C518',
      names: ['Test Candidate'],
      count: 1,
      candidates: [
        { name: 'Test Candidate', office: 'Governor', state: 'Texas', photo: '', website: '', district: '', town: '', cycle: '2026' },
      ],
    },
  }
}

function makeGeoJSON(features) {
  return { type: 'FeatureCollection', features }
}

describe('startKiosk', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('flies to first feature after initial hold', () => {
    const map = createMockMap()
    const feature = makeFeature(39.8, -98.5)
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)

    // Should not have flown yet
    expect(map.flyTo).not.toHaveBeenCalled()

    // Advance past initial hold (2s)
    vi.advanceTimersByTime(2100)

    // Now flyTo should have been called
    expect(map.flyTo).toHaveBeenCalledTimes(1)

    // Should target the feature's coordinates
    const call = map.flyTo.mock.calls[0][0]
    expect(call.center).toEqual([-98.5, 39.8])
  })

  it('uses cinematic arc — zooms out during travel, zooms in on landing', () => {
    const map = createMockMap()
    const feature = makeFeature(39.8, -98.5)
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)
    vi.advanceTimersByTime(2100)

    const opts = map.flyTo.mock.calls[0][0]
    // Should zoom out for the arc (mid-trip overview)
    expect(opts.zoom).toBeGreaterThan(10)
    // Should have a curve for the arc
    expect(opts.curve).toBeGreaterThan(1)
    // Should have a speed/easing config
    expect(opts.speed).toBeDefined()
  })

  it('kills permanently on user interaction (mousedown)', () => {
    const map = createMockMap()
    const feature = makeFeature(39.8, -98.5)
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)

    // Find the mousedown handler registered on container
    const container = map.getContainer()
    const mousedownCalls = container.addEventListener.mock.calls.filter(
      c => c[0] === 'mousedown'
    )
    expect(mousedownCalls.length).toBe(1)
    const handler = mousedownCalls[0][1]

    // Fire mousedown
    handler()

    // Advance past initial hold
    vi.advanceTimersByTime(2100)

    // Should NOT have flown — kiosk was killed
    expect(map.flyTo).not.toHaveBeenCalled()
  })

  it('scales fly duration with distance — short hop is faster than cross-country', () => {
    const shortHop = flyDuration({ lat: 34.0, lng: -118.2 }, { lat: 34.1, lng: -118.0 })
    const crossCountry = flyDuration({ lat: 40.7, lng: -74.0 }, { lat: 34.0, lng: -118.2 })

    expect(crossCountry).toBeGreaterThan(shortHop)
    // Both should be in reasonable range (ms)
    expect(shortHop).toBeGreaterThan(0)
    expect(crossCountry).toBeGreaterThan(0)
  })

  it('opens a popup with candidate content after flyTo lands', () => {
    const map = createMockMap()
    const candidates = [
      { name: 'Jane Doe', office: 'Governor', state: 'Texas', photo: '', website: '', district: '', town: '', cycle: '2026' },
    ]
    const feature = makeFeature(39.8, -98.5)
    feature.properties.candidates = candidates
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)

    // Advance past initial hold
    vi.advanceTimersByTime(2100)

    // flyTo fires. Now simulate the map emitting 'moveend' to signal arrival.
    const moveEndCalls = map.on.mock.calls.filter(c => c[0] === 'moveend')
    expect(moveEndCalls.length).toBeGreaterThanOrEqual(1)
    const moveEndHandler = moveEndCalls[0][1]

    // Fire moveend
    moveEndHandler()

    // Should have called renderPopupContent with the feature's candidates
    expect(renderPopupContent).toHaveBeenCalledWith(candidates)
  })

  it('highlights the active feature with setFeatureState', () => {
    const map = createMockMap()
    const feature = makeFeature(39.8, -98.5)
    feature.id = 42
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)
    vi.advanceTimersByTime(2100)

    // Fire moveend to trigger landing
    const moveEndCalls = map.on.mock.calls.filter(c => c[0] === 'moveend')
    moveEndCalls[0][1]()

    // Should have highlighted the feature
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: 'candidates', id: 42 },
      { highlight: true }
    )
  })

  it('cycles through features — holds popup 5s, then flies to next', () => {
    const map = createMockMap()
    const f1 = makeFeature(39.8, -98.5)
    const f2 = makeFeature(34.0, -118.2)
    const geojson = makeGeoJSON([f1, f2])

    startKiosk(map, geojson)

    // Advance past initial hold → first flyTo
    vi.advanceTimersByTime(2100)
    expect(map.flyTo).toHaveBeenCalledTimes(1)

    // Simulate landing
    const moveEndCalls = map.on.mock.calls.filter(c => c[0] === 'moveend')
    const moveEndHandler = moveEndCalls[0][1]
    moveEndHandler()

    // Popup should be open now. Advance past 5s hold + 500ms pause
    vi.advanceTimersByTime(5600)

    // Should have flown to second feature
    expect(map.flyTo).toHaveBeenCalledTimes(2)
  })

  it('removes highlight from previous feature before flying to next', () => {
    const map = createMockMap()
    const f1 = makeFeature(39.8, -98.5)
    f1.id = 10
    const f2 = makeFeature(34.0, -118.2)
    f2.id = 20
    const geojson = makeGeoJSON([f1, f2])

    startKiosk(map, geojson)
    vi.advanceTimersByTime(2100)

    // Land on f1
    const moveEndHandler = map.on.mock.calls.find(c => c[0] === 'moveend')[1]
    moveEndHandler()
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: 'candidates', id: 10 },
      { highlight: true }
    )

    // Advance past hold + pause → flies to f2
    vi.advanceTimersByTime(5600)

    // Debug: check flyTo count
    expect(map.flyTo).toHaveBeenCalledTimes(2)

    // Should have removed highlight from f1
    expect(map.removeFeatureState).toHaveBeenCalledWith(
      { source: 'candidates', id: 10 }
    )
  })
})
