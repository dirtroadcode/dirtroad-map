import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('maplibre-gl', () => {
  const instances = []
  class FakePopup {
    constructor(opts) {
      this._opts = opts
      this._html = ''
      this._lngLat = null
      this._map = null
      this._removed = false
      instances.push(this)
    }
    setHTML(html) { this._html = html; return this }
    setLngLat(ll) { this._lngLat = ll; return this }
    addTo(m) { this._map = m; return this }
    remove() { this._removed = true }
  }
  // Expose instances array for test access
  FakePopup._instances = instances
  return {
    default: { Popup: FakePopup },
  }
})

import { renderPopupCard, renderPopupContent, attachPopupHandlers } from '../src/popupRenderer.js'

const { Popup: MockPopup } = (await import('maplibre-gl')).default

describe('renderPopupCard', () => {
  it('renders photo, linked name, office, district, and state', () => {
    const html = renderPopupCard({
      name: 'Jane Doe',
      office: 'State Senate',
      district: 'District 12',
      state: 'Tennessee',
      photo: 'https://example.com/jane.webp',
      website: 'https://janedoe.com',
      town: '',
      cycle: '2026',
    })

    expect(html).toContain('src="https://example.com/jane.webp"')
    expect(html).toContain('href="https://janedoe.com"')
    expect(html).toContain('Jane Doe')
    expect(html).toContain('State Senate')
    expect(html).toContain('District 12')
    expect(html).toContain('Tennessee')
  })

  it('renders plain text name when no website', () => {
    const html = renderPopupCard({
      name: 'John Smith',
      office: 'County Commissioner',
      district: '',
      state: 'Georgia',
      photo: '',
      website: '',
      town: '',
      cycle: '2026',
    })

    expect(html).toContain('John Smith')
    expect(html).not.toContain('<a')
    expect(html).not.toContain('href=')
  })

  it('omits photo element when no photo URL', () => {
    const html = renderPopupCard({
      name: 'No Photo',
      office: 'City Council',
      district: '',
      state: 'Ohio',
      photo: '',
      website: '',
      town: '',
      cycle: '2026',
    })

    expect(html).not.toContain('<img')
  })

  it('omits district when empty', () => {
    const html = renderPopupCard({
      name: 'Test',
      office: 'School Board',
      district: '',
      state: 'Texas',
      photo: '',
      website: '',
      town: '',
      cycle: '2026',
    })

    expect(html).not.toContain('District')
  })
})

describe('renderPopupContent', () => {
  it('renders a single card without divider', () => {
    const html = renderPopupContent([{
      name: 'Solo',
      office: 'Mayor',
      district: '',
      state: 'Vermont',
      photo: '',
      website: '',
      town: '',
      cycle: '2026',
    }])

    expect(html).toContain('Solo')
    expect(html).not.toContain('popup-divider')
  })

  it('renders multiple cards separated by dividers', () => {
    const html = renderPopupContent([
      { name: 'First', office: 'A', district: '', state: 'NY', photo: '', website: '', town: '', cycle: '2026' },
      { name: 'Second', office: 'B', district: '', state: 'NY', photo: '', website: '', town: '', cycle: '2026' },
    ])

    expect(html).toContain('First')
    expect(html).toContain('Second')
    expect(html).toContain('popup-divider')
  })
})

describe('attachPopupHandlers', () => {
  function createMockMap() {
    const listeners = {}
    const map = {
      on(event, layerOrHandler, handler) {
        if (typeof layerOrHandler === 'function') {
          if (!listeners[event]) listeners[event] = []
          listeners[event].push(layerOrHandler)
        } else {
          const key = `${event}:${layerOrHandler}`
          if (!listeners[key]) listeners[key] = []
          listeners[key].push(handler)
        }
      },
      _listeners: listeners,
    }
    return map
  }

  beforeEach(() => {
    MockPopup._instances.length = 0
  })

  it('registers click handlers on all 6 candidate layers', () => {
    const map = createMockMap()
    attachPopupHandlers(map)

    const expectedLayers = [
      'candidates-state-glow', 'candidates-state-dot',
      'candidates-county-glow', 'candidates-county-dot',
      'candidates-local-glow', 'candidates-local-dot',
    ]
    for (const layerId of expectedLayers) {
      expect(map._listeners[`click:${layerId}`]).toBeDefined()
      expect(map._listeners[`click:${layerId}`]).toHaveLength(1)
    }
  })

  it('opens a popup with candidate content when a candidate layer is clicked', () => {
    const map = createMockMap()
    map.queryRenderedFeatures = vi.fn().mockReturnValue([
      {
        properties: {
          candidates: [{ name: 'Alice', office: 'State Senate', district: 'D5', state: 'TN', photo: '', website: '', town: '', cycle: '2026' }],
        },
      },
    ])

    attachPopupHandlers(map)

    const handler = map._listeners['click:candidates-state-glow'][0]
    handler({ lngLat: { lng: -85, lat: 35 }, point: { x: 100, y: 100 } })

    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 100, y: 100 },
      { layers: ['candidates-state-glow'] },
    )
    expect(MockPopup._instances).toHaveLength(1)
    const popup = MockPopup._instances[0]
    expect(popup._html).toContain('Alice')
    expect(popup._html).toContain('State Senate')
    expect(popup._lngLat).toEqual({ lng: -85, lat: 35 })
    expect(popup._map).toBe(map)
  })

  it('closes popup when map background is clicked', () => {
    const map = createMockMap()
    map.queryRenderedFeatures = vi.fn()
      .mockReturnValueOnce([{ properties: { candidates: [{ name: 'A', office: 'O', district: '', state: 'S', photo: '', website: '', town: '', cycle: '2026' }] } }])

    attachPopupHandlers(map)

    // First: click a candidate layer to open a popup
    const layerHandler = map._listeners['click:candidates-state-glow'][0]
    layerHandler({ lngLat: { lng: -85, lat: 35 }, point: { x: 100, y: 100 } })

    // Then: click the map background to close it
    const bgHandler = map._listeners['click'][0]
    bgHandler({})

    expect(MockPopup._instances[0]._removed).toBe(true)
  })
})
