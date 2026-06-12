// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStyle, addUsBoundary } from '../src/map.js'
import usBoundary from '../data/us-boundary.json'

function createMockMap() {
  const map = {
    _sources: {},
    _layers: [],
    addSource(id, source) { map._sources[id] = source },
    addLayer(layer) { map._layers.push(layer) },
  }
  return map
}

describe('createStyle', () => {
  it('has a background layer with opacity 0', () => {
    const style = createStyle()
    const bgLayer = style.layers.find(l => l.type === 'background')
    expect(bgLayer).toBeDefined()
    expect(bgLayer.paint['background-opacity']).toBe(0)
  })

  it('has no tile sources', () => {
    const style = createStyle()
    const sources = Object.values(style.sources)
    for (const src of sources) {
      expect(src.type).not.toBe('raster')
      expect(src.type).not.toBe('vector')
    }
  })

  it('is a valid MapLibre style (version 8)', () => {
    const style = createStyle()
    expect(style.version).toBe(8)
    expect(style.layers).toBeInstanceOf(Array)
    expect(style.layers.length).toBeGreaterThan(0)
  })
})

describe('addUsBoundary', () => {
  it('adds a GeoJSON source with US boundary data', () => {
    const map = createMockMap()
    addUsBoundary(map)

    expect(map._sources['us-boundary']).toBeDefined()
    expect(map._sources['us-boundary'].type).toBe('geojson')
    expect(map._sources['us-boundary'].data).toEqual(usBoundary)
  })

  it('adds a fill layer with navy color', () => {
    const map = createMockMap()
    addUsBoundary(map)

    const layer = map._layers.find(l => l.id === 'us-boundary-fill')
    expect(layer).toBeDefined()
    expect(layer.type).toBe('fill')
    expect(layer.paint['fill-color']).toMatch(/^#/) // hex color
    expect(layer.paint['fill-opacity']).toBeGreaterThan(0)
  })

  it('source and layer share the same source ref', () => {
    const map = createMockMap()
    addUsBoundary(map)

    const layer = map._layers.find(l => l.id === 'us-boundary-fill')
    expect(layer.source).toBe('us-boundary')
  })
})

// --- initMap tests ---

vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: class MockMap {
        constructor(opts) {
          this._constructorOpts = opts
          this.scrollZoom = {
            _enabled: true,
            enable() { this._enabled = true },
            disable() { this._enabled = false },
            isEnabled() { return this._enabled },
          }
          this._listeners = []
          this.on = (event, handler) => {
            this._listeners.push({ event, handler })
          }
        }
      },
    },
  }
})

describe('initMap', () => {
  let container

  beforeEach(() => {
    container = document.createElement('div')
  })

  it('disables scrollZoom by default', async () => {
    const { initMap } = await import('../src/map.js?' + Date.now())
    const map = initMap({ container })
    expect(map.scrollZoom.isEnabled()).toBe(false)
  })

  it('enables scrollZoom on click', async () => {
    const { initMap } = await import('../src/map.js?' + Date.now())
    const map = initMap({ container })

    const clickListener = map._listeners.find(l => l.event === 'click')
    expect(clickListener).toBeDefined()

    clickListener.handler()
    expect(map.scrollZoom.isEnabled()).toBe(true)
  })

  it('adds map-interactive class to container on click activation', async () => {
    const { initMap } = await import('../src/map.js?' + Date.now())
    const map = initMap({ container })

    expect(container.classList.contains('map-interactive')).toBe(false)

    const clickListener = map._listeners.find(l => l.event === 'click')
    clickListener.handler()
    expect(container.classList.contains('map-interactive')).toBe(true)
  })

  it('uses mobile zoom for narrow viewports', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true })

    const { initMap } = await import('../src/map.js?' + Date.now())
    const map = initMap({ container })
    expect(map._constructorOpts.zoom).toBe(3.5)

    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
  })

  it('uses desktop zoom for wide viewports', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })

    const { initMap } = await import('../src/map.js?' + Date.now())
    const map = initMap({ container })
    expect(map._constructorOpts.zoom).toBe(4)

    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
  })
})
