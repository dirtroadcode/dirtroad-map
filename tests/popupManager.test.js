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
      this._element = {
        classList: { add: vi.fn() },
        addEventListener: vi.fn(),
      }
      instances.push(this)
    }
    setHTML(html) { this._html = html; return this }
    setLngLat(ll) { this._lngLat = ll; return this }
    addTo(m) { this._map = m; return this }
    remove() { this._removed = true }
    getElement() { return this._element }
  }
  FakePopup._instances = instances
  return {
    default: { Popup: FakePopup },
  }
})

import { createPopupManager } from '../src/popupManager.js'
const { Popup: MockPopup } = (await import('maplibre-gl')).default

describe('createPopupManager', () => {
  beforeEach(() => {
    MockPopup._instances.length = 0
  })

  function createMap() {
    return { _fake: true }
  }

  it('open() creates popup with canonical config, HTML, and lngLat', () => {
    const map = createMap()
    const manager = createPopupManager(map)

    manager.open('<div>Hello</div>', { lng: -85, lat: 35 })

    expect(MockPopup._instances).toHaveLength(1)
    const popup = MockPopup._instances[0]
    expect(popup._opts).toEqual({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      offset: 12,
    })
    expect(popup._html).toBe('<div>Hello</div>')
    expect(popup._lngLat).toEqual({ lng: -85, lat: 35 })
    expect(popup._map).toBe(map)
  })

  it('open() closes previous popup before opening new one', () => {
    const map = createMap()
    const manager = createPopupManager(map)

    manager.open('<div>First</div>', { lng: -85, lat: 35 })
    expect(MockPopup._instances).toHaveLength(1)

    // Simulate animationend firing for the first popup's close
    const firstEl = MockPopup._instances[0]._element
    firstEl.addEventListener.mockImplementation((event, handler) => {
      if (event === 'animationend') handler()
    })

    manager.open('<div>Second</div>', { lng: -90, lat: 40 })
    expect(MockPopup._instances).toHaveLength(2)

    // First popup should have been removed (via animationend)
    expect(MockPopup._instances[0]._removed).toBe(true)
    // Second popup is active
    expect(MockPopup._instances[1]._html).toBe('<div>Second</div>')
  })

  it('close() adds fade-out class and removes popup on animationend', () => {
    const map = createMap()
    const manager = createPopupManager(map)

    manager.open('<div>Test</div>', { lng: -85, lat: 35 })
    const popup = MockPopup._instances[0]
    const el = popup._element

    // Capture animationend handler
    let animHandler = null
    el.addEventListener.mockImplementation((event, handler) => {
      if (event === 'animationend') animHandler = handler
    })

    manager.close()

    // Should add the close class
    expect(el.classList.add).toHaveBeenCalledWith('maplibregl-popup-close')
    // Popup not removed yet (waiting for animation)
    expect(popup._removed).toBe(false)

    // Fire animationend
    animHandler()
    expect(popup._removed).toBe(true)
  })

  it('close() falls back to immediate remove when getElement returns null', () => {
    const map = createMap()
    const manager = createPopupManager(map)

    manager.open('<div>Test</div>', { lng: -85, lat: 35 })
    const popup = MockPopup._instances[0]
    popup._element = null // simulate no DOM element

    manager.close()
    expect(popup._removed).toBe(true)
  })

  it('close() is a no-op when no popup is open', () => {
    const map = createMap()
    const manager = createPopupManager(map)

    // Should not throw
    manager.close()
    expect(MockPopup._instances).toHaveLength(0)
  })
})
