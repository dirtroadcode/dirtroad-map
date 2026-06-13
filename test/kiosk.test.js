import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startKiosk, flyDuration } from '../src/kiosk.js'
import { renderPopupContent } from '../src/popupRenderer.js'
import { prepareFlyToOffset } from '../src/popupLayout.js'

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
vi.mock('../src/popupLayout.js', () => ({
  prepareFlyToOffset: vi.fn(() => Promise.resolve(0.5)),
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
      peek() {
        const item = items[idx % items.length]
        return item
      },
    }
  }),
}))

/**
 * Creates a mock MapLibre map that spies on flyTo, setFeatureState, etc.
 */
function createMockMap(viewportHeight = 600) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'addEventListener', { value: vi.fn() })
  Object.defineProperty(container, 'clientHeight', { value: viewportHeight })

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
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('flies to first feature after initial hold', async () => {
    const map = createMockMap()
    const feature = makeFeature(39.8, -98.5)
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)

    // Should not have flown yet
    expect(map.flyTo).not.toHaveBeenCalled()

    // Advance past initial hold (2s) and let promises flush
    await vi.advanceTimersByTimeAsync(2100)

    // Now flyTo should have been called
    expect(map.flyTo).toHaveBeenCalledTimes(1)

    // Should target the feature's coordinates (offset by prepareFlyToOffset mock)
    const call = map.flyTo.mock.calls[0][0]
    expect(call.center[0]).toBe(-98.5)
    // Center is offset north of marker by prepareFlyToOffset mock (returns 0.5)
    expect(call.center[1]).toBe(39.8 + 0.5)
  })

  it('uses cinematic arc — zooms out during travel, zooms in on landing', async () => {
    const map = createMockMap()
    const feature = makeFeature(39.8, -98.5)
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)
    await vi.advanceTimersByTimeAsync(2100)

    const opts = map.flyTo.mock.calls[0][0]
    // Should have a curve for the arc
    expect(opts.curve).toBeGreaterThan(1)
    // Should have easing config
    expect(typeof opts.easing).toBe('function')
  })

  it('kills permanently on user interaction (mousedown)', async () => {
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
    await vi.advanceTimersByTimeAsync(2100)

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

  it('opens a popup with candidate content after flyTo lands', async () => {
    const map = createMockMap()
    const candidates = [
      { name: 'Jane Doe', office: 'Governor', state: 'Texas', photo: '', website: '', district: '', town: '', cycle: '2026' },
    ]
    const feature = makeFeature(39.8, -98.5)
    feature.properties.candidates = candidates
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)

    // Advance past initial hold
    await vi.advanceTimersByTimeAsync(2100)

    // flyTo fires. Now simulate the map emitting 'moveend' to signal arrival.
    const moveEndCalls = map.on.mock.calls.filter(c => c[0] === 'moveend')
    expect(moveEndCalls.length).toBeGreaterThanOrEqual(1)
    const moveEndHandler = moveEndCalls[0][1]

    // Fire moveend
    moveEndHandler()

    // Should have called renderPopupContent with the feature's candidates
    expect(renderPopupContent).toHaveBeenCalledWith(candidates)
  })

  it('highlights the active feature with setFeatureState', async () => {
    const map = createMockMap()
    const feature = makeFeature(39.8, -98.5)
    feature.id = 42
    const geojson = makeGeoJSON([feature])

    startKiosk(map, geojson)
    await vi.advanceTimersByTimeAsync(2100)

    // Fire moveend to trigger landing
    const moveEndCalls = map.on.mock.calls.filter(c => c[0] === 'moveend')
    moveEndCalls[0][1]()

    // Should have highlighted the feature
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: 'candidates', id: 42 },
      { highlight: true }
    )
  })

  it('cycles through features — holds popup 5s, then flies to next', async () => {
    const map = createMockMap()
    const f1 = makeFeature(39.8, -98.5)
    const f2 = makeFeature(34.0, -118.2)
    const geojson = makeGeoJSON([f1, f2])

    startKiosk(map, geojson)

    // Advance past initial hold → first flyTo
    await vi.advanceTimersByTimeAsync(2100)
    expect(map.flyTo).toHaveBeenCalledTimes(1)

    // Simulate landing
    const moveEndCalls = map.on.mock.calls.filter(c => c[0] === 'moveend')
    const moveEndHandler = moveEndCalls[0][1]
    moveEndHandler()

    // Popup should be open now. Advance past 5s hold + 500ms pause
    await vi.advanceTimersByTimeAsync(5600)

    // Should have flown to second feature
    expect(map.flyTo).toHaveBeenCalledTimes(2)
  })

  it('removes highlight from previous feature before flying to next', async () => {
    const map = createMockMap()
    const f1 = makeFeature(39.8, -98.5)
    f1.id = 10
    const f2 = makeFeature(34.0, -118.2)
    f2.id = 20
    const geojson = makeGeoJSON([f1, f2])

    startKiosk(map, geojson)
    await vi.advanceTimersByTimeAsync(2100)

    // Land on f1
    const moveEndHandler = map.on.mock.calls.find(c => c[0] === 'moveend')[1]
    moveEndHandler()
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: 'candidates', id: 10 },
      { highlight: true }
    )

    // Advance past hold + pause → flies to f2
    await vi.advanceTimersByTimeAsync(5600)

    // Should have flown twice
    expect(map.flyTo).toHaveBeenCalledTimes(2)

    // Should have removed highlight from f1
    expect(map.removeFeatureState).toHaveBeenCalledWith(
      { source: 'candidates', id: 10 }
    )
  })

  it('uses prepareFlyToOffset to offset flyTo center', async () => {
    const map = createMockMap()
    const f1 = makeFeature(39.8, -98.5)
    const f2 = makeFeature(34.0, -118.2)
    const geojson = makeGeoJSON([f1, f2])

    // First flyTo (f1) uses default mock (0.5), second gets a custom offset
    prepareFlyToOffset
      .mockResolvedValueOnce(0.5)  // f1
      .mockResolvedValueOnce(1.5)  // f2

    startKiosk(map, geojson)
    await vi.advanceTimersByTimeAsync(2100)

    // Land on f1
    const moveEndHandler = map.on.mock.calls.find(c => c[0] === 'moveend')[1]
    moveEndHandler()

    // Wait for preload promise to resolve
    await vi.advanceTimersByTimeAsync(5600)

    // flyTo should have been called with offset center
    expect(map.flyTo).toHaveBeenCalledTimes(2)
    const lastCall = map.flyTo.mock.calls[1][0]
    // Center should be offset north of the marker by 1.5°
    expect(lastCall.center[1]).toBeCloseTo(34.0 + 1.5, 10)
  })

  it('awaits prepareFlyToOffset — no race condition with slow preload', async () => {
    const map = createMockMap()
    const f1 = makeFeature(39.8, -98.5)
    const f2 = makeFeature(34.0, -118.2)
    const geojson = makeGeoJSON([f1, f2])

    // First flyTo (f1) resolves fast, second (f2) resolves slowly
    prepareFlyToOffset.mockResolvedValueOnce(0.5)  // f1 — fast
    let resolvePreload
    prepareFlyToOffset.mockImplementationOnce(() =>
      new Promise(r => { resolvePreload = r })
    )  // f2 — slow

    startKiosk(map, geojson)
    await vi.advanceTimersByTimeAsync(2100)

    // First flyTo should have happened (f1, fast resolve)
    expect(map.flyTo).toHaveBeenCalledTimes(1)

    // Land on f1
    const moveEndHandler = map.on.mock.calls.find(c => c[0] === 'moveend')[1]
    moveEndHandler()

    // Advance past popup hold + pause — timer fires flyToNext for f2
    // but prepareFlyToOffset for f2 hasn't resolved yet
    await vi.advanceTimersByTimeAsync(5600)

    // flyTo should NOT have been called again — still awaiting
    expect(map.flyTo).toHaveBeenCalledTimes(1)

    // Now resolve the slow preload
    resolvePreload(2.5)
    await vi.advanceTimersByTimeAsync(0) // flush microtask queue

    // Now flyTo should have been called with the resolved offset
    expect(map.flyTo).toHaveBeenCalledTimes(2)
    const lastCall = map.flyTo.mock.calls[1][0]
    expect(lastCall.center[1]).toBeCloseTo(34.0 + 2.5, 10)
  })

  it('first feature uses prepareFlyToOffset — not hardcoded default', async () => {
    const map = createMockMap()
    const feature = makeFeature(35.0, -90.0)
    const geojson = makeGeoJSON([feature])

    // prepareFlyToOffset returns a specific offset for the first feature
    prepareFlyToOffset.mockResolvedValueOnce(1.23)

    startKiosk(map, geojson)
    await vi.advanceTimersByTimeAsync(2100)

    // First flyTo should use the offset from prepareFlyToOffset
    expect(map.flyTo).toHaveBeenCalledTimes(1)
    const call = map.flyTo.mock.calls[0][0]
    expect(call.center[1]).toBeCloseTo(35.0 + 1.23, 10)

    // And prepareFlyToOffset should have been called with the feature's candidates
    expect(prepareFlyToOffset).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Test Candidate' })]),
      35.0,
      8,
      600, // viewport height from createMockMap default
    )
  })
})
