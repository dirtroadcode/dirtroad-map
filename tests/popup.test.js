import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('maplibre-gl', () => {
  return {
    default: {},
  }
})

vi.mock('../src/popupManager.js', () => {
  const opens = []
  const closes = []
  function createPopupManager(map) {
    return {
      open(html, lngLat) {
        opens.push({ html, lngLat, map })
      },
      close() {
        closes.push(true)
      },
    }
  }
  createPopupManager._opens = opens
  createPopupManager._closes = closes
  return { createPopupManager }
})

import { renderPopupCard, renderPopupContent, attachPopupHandlers } from '../src/popupRenderer.js'
import { createPopupManager as mockPopupManager } from '../src/popupManager.js'

const popupOpens = mockPopupManager._opens
const popupCloses = mockPopupManager._closes

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

  it('applies inline width, height, and object-fit when photoSize is provided', () => {
    const html = renderPopupCard({
      name: 'Sized Photo',
      office: 'Mayor',
      district: '',
      state: 'Oregon',
      photo: 'https://example.com/sized.webp',
      website: '',
      town: '',
      cycle: '2026',
    }, { photoWidth: 180, photoHeight: 320 })

    expect(html).toContain('width="180"')
    expect(html).toContain('height="320"')
    expect(html).toContain('object-fit: cover')
  })

  it('uses default CSS sizing when photoSize is not provided', () => {
    const html = renderPopupCard({
      name: 'Default Size',
      office: 'Mayor',
      district: '',
      state: 'Oregon',
      photo: 'https://example.com/default.webp',
      website: '',
      town: '',
      cycle: '2026',
    })

    expect(html).toContain('popup-photo')
    expect(html).not.toContain('width="')
    expect(html).not.toContain('height="')
    expect(html).not.toContain('object-fit')
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

  it('passes photoSize through to each card', () => {
    const html = renderPopupContent([
      { name: 'A', office: 'Mayor', district: '', state: 'OR', photo: 'https://example.com/a.webp', website: '', town: '', cycle: '2026' },
    ], { photoWidth: 150, photoHeight: 200 })

    expect(html).toContain('width="150"')
    expect(html).toContain('height="200"')
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
    popupOpens.length = 0
    popupCloses.length = 0
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
    expect(popupOpens).toHaveLength(1)
    expect(popupOpens[0].html).toContain('Alice')
    expect(popupOpens[0].html).toContain('State Senate')
    expect(popupOpens[0].lngLat).toEqual({ lng: -85, lat: 35 })
    expect(popupOpens[0].map).toBe(map)
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

    expect(popupCloses).toHaveLength(1)
  })

  it('applies viewport-aware photo sizing when candidate has a photo', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })

    const map = createMockMap()
    map.getContainer = vi.fn(() => container)
    map.queryRenderedFeatures = vi.fn().mockReturnValue([
      {
        properties: {
          candidates: [{ name: 'Photo Candidate', office: 'Mayor', district: '', state: 'OR', photo: 'https://example.com/photo.webp', website: '', town: '', cycle: '2026' }],
        },
      },
    ])

    attachPopupHandlers(map)

    const handler = map._listeners['click:candidates-state-glow'][0]
    handler({ lngLat: { lng: -85, lat: 35 }, point: { x: 100, y: 100 } })

    expect(popupOpens).toHaveLength(1)
    // Photo should have inline width/height (viewport-scaled)
    expect(popupOpens[0].html).toContain('width="')
    expect(popupOpens[0].html).toContain('height="')
    expect(popupOpens[0].html).toContain('object-fit: cover')
  })
})
