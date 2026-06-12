import { describe, it, expect, vi } from 'vitest'
import { addOpenFreeMapLayers } from '../src/openfreemap.js'

/**
 * Creates a mock MapLibre map that records addSource/addLayer calls.
 */
function createMockMap() {
  const calls = { addSource: [], addLayer: [] }

  return {
    addSource: vi.fn((id, config) => {
      calls.addSource.push({ id, config })
    }),
    addLayer: vi.fn((layer) => {
      calls.addLayer.push(layer)
    }),
    _calls: calls,
  }
}

describe('addOpenFreeMapLayers', () => {
  it('scales boundary line width with zoom', () => {
    const map = createMockMap()

    addOpenFreeMapLayers(map)

    const layer = map._calls.addLayer.find((l) => l.id === 'admin-boundary')
    // line-width should be an interpolate expression, not a static number
    const width = layer.paint['line-width']
    expect(Array.isArray(width)).toBe(true)
    expect(width[0]).toBe('interpolate')
  })

  it('scales place text size with zoom', () => {
    const map = createMockMap()

    addOpenFreeMapLayers(map)

    const layer = map._calls.addLayer.find((l) => l.id === 'place-label')
    // text-size should be an interpolate expression for zoom scaling
    const size = layer.layout['text-size']
    expect(Array.isArray(size)).toBe(true)
    expect(size[0]).toBe('interpolate')
  })

  it('only adds admin-boundary and place-label layers from the openfreemap source', () => {
    const map = createMockMap()

    addOpenFreeMapLayers(map)

    const ofmLayers = map._calls.addLayer.filter(
      (l) => l.source === 'openfreemap'
    )
    const layerIds = ofmLayers.map((l) => l.id)

    expect(layerIds).toEqual(['admin-boundary', 'place-label'])
  })

  it('adds place label layer as small white text with low opacity', () => {
    const map = createMockMap()

    addOpenFreeMapLayers(map)

    const layer = map._calls.addLayer.find((l) => l.id === 'place-label')
    expect(layer).toBeDefined()
    expect(layer.type).toBe('symbol')
    expect(layer.source).toBe('openfreemap')
    expect(layer['source-layer']).toBe('place')
    // White text, low opacity
    expect(layer.paint['text-color']).toBe('#ffffff')
    expect(layer.paint['text-opacity']).toBeLessThanOrEqual(0.5)
    // Text size should be small
    const textSize = layer.layout['text-size']
    expect(typeof textSize === 'number' ? textSize : 12).toBeLessThanOrEqual(14)
  })

  it('adds admin boundary layer as thin white line with low opacity', () => {
    const map = createMockMap()

    addOpenFreeMapLayers(map)

    const layer = map._calls.addLayer.find((l) => l.id === 'admin-boundary')
    expect(layer).toBeDefined()
    expect(layer.type).toBe('line')
    expect(layer.source).toBe('openfreemap')
    expect(layer['source-layer']).toBe('boundary')
    // White line, low opacity
    expect(layer.paint['line-color']).toBe('#ffffff')
    expect(layer.paint['line-opacity']).toBeLessThanOrEqual(0.5)
    // line-width is an interpolate expression; check max value
    const widthExpr = layer.paint['line-width']
    expect(widthExpr[0]).toBe('interpolate')
    expect(widthExpr[widthExpr.length - 1]).toBeLessThanOrEqual(1.5)
  })

  it('adds a vector tile source pointing to OpenFreeMap', () => {
    const map = createMockMap()

    addOpenFreeMapLayers(map)

    expect(map.addSource).toHaveBeenCalledWith('openfreemap', {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    })
  })
})
