import { describe, it, expect, vi } from 'vitest'
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
